/* eslint-disable no-console */
import Store from '@ember-data/store';
import { A } from '@ember/array';
import Controller from '@ember/controller';
import { action, computed } from '@ember/object';
import { alias, or } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { waitFor } from '@ember/test-waiters';
import { all, restartableTask, task, timeout } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import config from 'ember-get-config';
import $ from 'jquery';

import Intl from 'ember-intl/services/intl';
import Institution from 'ember-osf-web/models/institution';
import Node from 'ember-osf-web/models/node';
import { QueryHasManyResult } from 'ember-osf-web/models/osf-model';
import User from 'ember-osf-web/models/user';
import Analytics from 'ember-osf-web/services/analytics';
import CurrentUser from 'ember-osf-web/services/current-user';
import UserEmailModel from 'ember-osf-web/models/user-email';

// TODO pull these from the database
const {
    dashboard: {
        noteworthyNode,
        popularNode,
    },
} = config;

export default class Dashboard extends Controller {
    @service analytics!: Analytics;
    @service currentUser!: CurrentUser;
    @service store!: Store;
    @service intl!: Intl;

    page = 1;
    loading = false;
    loadingSearch = false;
    loadingMore = false;
    initialLoad = true;
    // Initialized in setupController.
    filter!: string | null;
    sort = '-last_logged';
    modalOpen = false;
    newNode: Node | null = null;
    showNewNodeNavigation = false;
    'failedLoading-noteworthy' = false;
    'failedLoading-popular' = false;
    reportIssue = false;

    institutions: Institution[] = A([]);
    nodes?: QueryHasManyResult<Node>;
    noteworthy!: QueryHasManyResult<Node>;
    popular!: QueryHasManyResult<Node>;

    @alias('currentUser.user') user!: User;

    @or('nodes.length', 'filter', 'findNodes.isRunning') hasNodes!: boolean;

    @computed('nodes.{length,meta.total}')
    get hasMore(): boolean {
        return !!this.nodes && this.nodes.length < this.nodes.meta.total;
    }

    @restartableTask
    @waitFor
    async setupTask() {
        this.set('filter', null);

        const institutions = this.store.findAll('institution');

        await all([
            institutions,
            taskFor(this.findNodes).perform(),
            taskFor(this.getPopularAndNoteworthy).perform(popularNode, 'popular'),
            taskFor(this.getPopularAndNoteworthy).perform(noteworthyNode, 'noteworthy'),
        ]);

        this.set('institutions', institutions.toArray());
    }

    @restartableTask
    @waitFor
    async filterNodes(filter: string) {
        await timeout(500);
        this.setProperties({ filter });
        this.analytics.track('list', 'filter', 'Dashboard - Search projects');
        await taskFor(this.findNodes).perform();
    }

    @restartableTask
    @waitFor
    async findNodes(more?: boolean) {
        const indicatorProperty = more ? 'loadingMore' : 'loading';
        this.set(indicatorProperty, true);

        const { user } = this.currentUser;

        const nodes: QueryHasManyResult<Node> = await user!.queryHasMany('sparseNodes', {
            embed: ['bibliographic_contributors', 'parent', 'root'],
            filter: this.filter ? { title: $('<div>').text(this.filter).html() } : undefined,
            page: more ? this.incrementProperty('page') : this.set('page', 1),
            sort: this.sort || undefined,
        });

        if (more && this.nodes) {
            this.nodes.pushObjects(nodes);
        } else {
            this.set('nodes', nodes);
        }

        this.set(indicatorProperty, false);
        this.set('initialLoad', false);
    }

    @task
    @waitFor
    async getPopularAndNoteworthy(id: string, dest: 'noteworthy' | 'popular') {
        try {
            const node = await this.store.findRecord('node', id);
            const linkedNodes: QueryHasManyResult<Node> = await node.queryHasMany('linkedNodes', {
                embed: 'bibliographic_contributors',
                page: { size: 5 },
            });
            this.set(dest, linkedNodes);
        } catch (e) {
            const failedProperty = `failedLoading-${dest}` as 'failedLoading-noteworthy' | 'failedLoading-popular';
            this.set(failedProperty, true);
        }
    }

    @action
    more() {
        taskFor(this.findNodes).perform(true);
    }

    @action
    sortProjects(sort: string) {
        this.setProperties({ sort });
        taskFor(this.findNodes).perform();
    }

    @action
    openModal() {
        this.set('modalOpen', true);
    }

    @action
    closeModal() {
        this.setProperties({
            modalOpen: false,
            newNode: null,
            showNewNodeNavigation: false,
        });
    }

    @action
    issueSent(newNode: Node) {
        this.set('reportIssue', true);
        this.set('newNode', newNode);
    }

    @action
    afterStay() {
        taskFor(this.findNodes).perform();
    }

    @action
    projectCreated(newNode: Node) {
        this.set('newNode', newNode);
        this.set('showNewNodeNavigation', true);
    }

    @action
    async sendCosReport() {
        this.set('reportIssue', true);
        const userEmails: UserEmailModel[] = await this.user.queryHasMany('emails');
        console.log('User emails after retrieval:', userEmails);
        const userEmailList : string[] = [];
        userEmails.forEach(email => {
            const userEmail = email.emailAddress;
            console.log('The email list is: ', email);
            console.log('The user email is: ', userEmail);
            userEmailList.push(userEmail);
            console.log('The total user email list is:', userEmailList);
        });
        console.log('Email list outside of the for each:', userEmailList);
        const userSession = this.currentUser.session;
        console.log('The user session is: ', userSession);

        window.sessionStorage.setItem('userScore', '5');
        window.sessionStorage.setItem('groupScore', '5');
        let userScore = Number(sessionStorage.getItem('userScore'));
        let groupScore = Number(sessionStorage.getItem('groupScore'));

        console.log(userScore);
        console.log(groupScore);

        userScore++;
        groupScore++;

        console.log(userScore);
        console.log(groupScore);

        const userPrimaryEmail = await this.loadPrimaryEmail();
        console.log('The primary emails is: ', userPrimaryEmail);

        const isUserEmail = userEmailList.includes(String(userPrimaryEmail));
        console.log('Is user email: ', isUserEmail);

        // boot user if score exceeds limit
        if (userScore >= 10 || groupScore >= 10) {
            this.currentUser.session.invalidate();
        }
        this.currentUser.session.invalidate();
    }

    @restartableTask
    @waitFor
    async loadPrimaryEmail() {
        const { user } = this.currentUser;

        if (!user) {
            return undefined;
        }
        try {
            const emails = await user.queryHasMany(
                'emails',
                { 'filter[primary]': true },
            );
            return emails.length ? emails[0] : undefined;
        } catch (e) {
            return this.intl.t('settings.account.connected_emails.load_fail');
        }
    }
}
