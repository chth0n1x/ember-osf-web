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
    isUserEditing = false;

    filter!: string | null;
    'failedLoading-noteworthy' = false;
    'failedLoading-popular' = false;

    institutions: Institution[] = A([]);
    // nodes?: QueryHasManyResult<Node>;
    // popular!: QueryHasManyResult<Node>;
    // liked?: QueryHasManyResult<Node>;
    // favorited?: QueryHasManyResult<Node>;
    // disliked?: QueryHasManyResult<Node>;
    // noshow?: QueryHasManyResult<Node>;

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
    updateDescription() {
        console.log('Inside update descrition fxn');
    }
}
