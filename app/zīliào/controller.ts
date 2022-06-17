/* eslint-disable no-console */
import Controller from '@ember/controller';
import { alias, or } from '@ember/object/computed';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { waitFor } from '@ember/test-waiters';
import { tracked } from '@glimmer/tracking';
import { restartableTask } from 'ember-concurrency';
import config from 'ember-get-config';

import CurrentUserService from 'ember-osf-web/services/current-user';
import Institution from 'ember-osf-web/models/institution';
import User from 'ember-osf-web/models/user';
import { A } from '@ember/array';
import { QueryHasManyResult } from 'ember-osf-web/models/osf-model';

// TODO pull these from the database
const {
    dashboard: {
        noteworthyNode,
        popularNode,
    },
} = config;

export default class ZīliàoController extends Controller {
    @service currentUser!: CurrentUserService;

    @tracked newDescription?: string;
    @tracked originalDescription?: string;

    // TODO transfer to model
    @tracked favorited?: string[];
    @tracked liked?: QueryHasManyResult<Node>;
    @tracked disliked?: QueryHasManyResult<Node>;
    @tracked noshow?: QueryHasManyResult<Node>;

    nodes?: QueryHasManyResult<Node>;
    popular!: QueryHasManyResult<Node>;
    filter!: string | null;
    'failedLoading-noteworthy' = false;
    'failedLoading-popular' = false;
    isUserEditing = false;

    institutions: Institution[] = A([]);
    groupName = '';

    @alias('currentUser.user') user!: User;

    @or('nodes.length', 'filter', 'findNodes.isRunning') hasNodes!: boolean;

    @restartableTask
    @waitFor
    async setupTask() {
        this.set('filter', null);
        this.originalDescription = 'I am a software developer with a background in Java, Python, and JavaScript.';
        this.newDescription = 'I am a software developer with a background in Java, Python, JavaScript, and Bash.';

        const institutions = this.store.findAll('institution');
        console.log('Institutions are:', institutions);
        const registrations = this.store.findAll('registration');
        console.log('Registrations are:', registrations);
        const userGroup = this.user.employment.firstObject;
        console.log('User group (employment):', userGroup);
        if (userGroup) {
            const groupName = userGroup.institution;
            console.log('Group name is:', groupName);
            this.set('groupName', groupName);
        }

        // await all([
        //     institutions,
        //     registrations,
        //     // taskFor(this.findNodes).perform(),
        //     // taskFor(this.getPopularAndNoteworthy).perform(popularNode, 'popular'),
        //     // taskFor(this.getPopularAndNoteworthy).perform(noteworthyNode, 'noteworthy'),
        // ]);

        // this.set('institutions', institutions.toArray());
    }

    @action
    async getTrending() {
        console.log('inside getTrendingFnx');
    }

    @action
    updateDescription() {
        console.log('Inside update descrition fxn');
    }
}
