import Store from '@ember-data/store';
import { A } from '@ember/array';
import Component from '@ember/component';
import { action } from '@ember/object';
import { alias, reads } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { waitFor } from '@ember/test-waiters';
import { dropTask, restartableTask, task, timeout } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import Features from 'ember-feature-flags/services/features';

import Intl from 'ember-intl/services/intl';
import { layout, requiredAction } from 'ember-osf-web/decorators/component';
import { IssueType } from 'ember-osf-web/models/cos-report';
import Node from 'ember-osf-web/models/node';
import Region from 'ember-osf-web/models/region';
import User from 'ember-osf-web/models/user';
import Analytics from 'ember-osf-web/services/analytics';
import CurrentUser from 'ember-osf-web/services/current-user';
import captureException, { getApiErrorMessage } from 'ember-osf-web/utils/capture-exception';
import Toast from 'ember-toastr/services/toast';
import styles from './styles';
import template from './template';


@layout(template, styles)
export default class NewProjectModal extends Component {
    @service analytics!: Analytics;
    @service currentUser!: CurrentUser;
    @service store!: Store;
    @service features!: Features;
    @service intl!: Intl;
    @service toast!: Toast;

    // Required arguments
    @requiredAction afterProjectCreated!: (newNode: Node) => void;

    // Optional arguments
    isPublic?: boolean;

    // Private fields
    nodeTitle?: string;
    description?: string;
    more = false;
    templateFrom?: Node;
    selectedRegion?: Region;
    issueTypes: IssueType[] = [];
    regions: Region[] = [];

    @alias('currentUser.user') user!: User;

    @reads('cos-report') selectedIssues!: IssueType[];

    @task({ on: 'init' })
    @waitFor
    async initTask() {
        this.set('issueTypes', (await this.user.currentUser.cosReport.issueTypes));
    }


    @restartableTask
    @waitFor
    async searchUserNodesTask(title: string) {
        await timeout(500);
        const userNodes = await this.user.queryHasMany('nodes', { filter: { title } });
        return userNodes;
    }

    @dropTask
    @waitFor
    async createNodeTask(
        title = '',
        description = '',
        templateFrom?: Node,
        isPublic?: boolean,
        // selectedIssues?: IssueType[],
        // issueUrl = '',
        // ipAddress = '',
        // macAddress = '',
        // issueType: IssueModel,
        // userAuthLevel : UserAuthModel = {}, (username, emailAddress[],
        // .... primaryEmail, lastLogin, dateCreated, issueCountAgainst,
        // .... issueCountMade (no factor against, only for data)), totalLoginCount,
        // .... totalRequestsMade : RequestsMadeModel (http method, status code returned
        // .... on attempt, if sucessful, why looking to a lookup table if not, no data if
        // .... successful)

    ) {
        if (!title) {
            return;
        }
        const node = this.store.createRecord('node', {
            category: 'project',
            description,
            public: isPublic !== undefined ? isPublic : false,
            title,
        });

        if (templateFrom) {
            node.set('templateFrom', templateFrom.id);
        }
        if (this.issueTypes.length) {
            node.set('this.selectedIssues', this.issueTypes.slice());
        }
        if (storageRegion) {
            node.set('region', storageRegion);
        }

        try {
            await node.save();
        } catch (e) {
            const errorMessage = this.intl.t('new_project.could_not_create_project');
            captureException(e, { errorMessage });
            this.toast.error(getApiErrorMessage(e), errorMessage);
        }

        this.afterProjectCreated(node);
    }

    @action
    selectIssue(issueType: IssueType) {
        const selected = this.set('selectedIssues', this.selectedIssues.slice());

        if (selected.includes(issueType)) {
            selected.removeObject(issueType);
        } else {
            selected.pushObject(issueType);
        }
    }

    @action
    selectAllIssues() {
        this.set('selectedIssues', this.issueTypes.slice());
    }

    @action
    removeAllIssues() {
        this.set('selectedIssues', A([]));
    }

    @action
    selectTemplateFrom(templateFrom: Node) {
        this.set('templateFrom', templateFrom);
        this.analytics.click('button', 'New project - Select template from');
    }

    @action
    selectRegion(region: Region) {
        this.set('selectedRegion', region);
        this.analytics.click('button', 'New project - Select storage region');
    }

    @action
    toggleMore() {
        this.toggleProperty('more');
    }

    @action
    create(this: NewProjectModal) {
        taskFor(this.createNodeTask).perform(
            this.nodeTitle,
            this.description,
            this.selectedIssues,
            this.templateFrom,
            this.selectedRegion,
            this.isPublic,
        );
    }

    @action
    searchNodes(this: NewProjectModal, searchTerm: string) {
        return taskFor(this.searchUserNodesTask).perform(searchTerm);
    }
}
