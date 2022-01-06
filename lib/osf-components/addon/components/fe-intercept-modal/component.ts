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
import IssueType from 'ember-osf-web/models/issue-type';
import IssueTypeModel from 'ember-osf-web/models/issue-type';

import Intl from 'ember-intl/services/intl';
import { layout, requiredAction } from 'ember-osf-web/decorators/component';
import Node from 'ember-osf-web/models/node';
import User from 'ember-osf-web/models/user';
import Analytics from 'ember-osf-web/services/analytics';
import CurrentUser from 'ember-osf-web/services/current-user';
import captureException, { getApiErrorMessage } from 'ember-osf-web/utils/capture-exception';
import Toast from 'ember-toastr/services/toast';
import styles from './styles';
import template from './template';

@layout(template, styles)
export default class FeInterceptModal extends Component {
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
    issueTypes: IssueType[] = [];

    // cosReports = this.store.findAll('cosReport');

    @alias('currentUser.user') user!: User;

    @reads('issue-type') selectedIssues!: IssueTypeModel[];

    @task({ on: 'init' })
    @waitFor
    async initTask() {
        this.set('issueTypes', ['BUG', 'SECURITY', 'SPAM']);
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
            category: 'cos report',
            description,
            public: isPublic !== undefined ? isPublic : false,
            title,
        });

        if (templateFrom) {
            node.set('templateFrom', templateFrom.id);
        }
        if (this.issueTypes.length) {
            node.set('selectableIssues', this.issueTypes.slice());
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
        this.set('selectedIssues', this.issueTypes.slice()); // TODO fix this
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
    toggleMore() {
        this.toggleProperty('more');
    }

    @action
    create(this: FeInterceptModal) {
        taskFor(this.createNodeTask).perform(
            this.nodeTitle,
            this.description,
            this.isPublic,
        );
    }

    @action
    searchNodes(this: FeInterceptModal, searchTerm: string) {
        return taskFor(this.searchUserNodesTask).perform(searchTerm);
    }
}
