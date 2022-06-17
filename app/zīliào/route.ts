import { action } from '@ember/object';
import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import Features from 'ember-feature-flags/services/features';
// import config from 'ember-get-config';
import Session from 'ember-simple-auth/services/session';

import requireAuth from 'ember-osf-web/decorators/require-auth';
import Analytics from 'ember-osf-web/services/analytics';
import CurrentUser from 'ember-osf-web/services/current-user';
import Ready from 'ember-osf-web/services/ready';
import ZīliàoController from './controller';

// const {
//     featureFlagNames: {
//         egapAdmins,
//     },
// } = config;

@requireAuth('home')
export default class ZīliàoRoute extends Route {
    @service analytics!: Analytics;
    @service features!: Features;
    @service currentUser!: CurrentUser;
    @service ready!: Ready;
    @service session!: Session;

    // model() {
    //     return this.modelFor('branded');
    // }

    // afterModel(provider: RegistrationProviderModel) {
    //     const { href, origin } = window.location;
    // }

    async setupController(controller: ZīliàoController): Promise<void> {
        const blocker = this.ready.getBlocker();

        try {
            await taskFor(controller.setupTask).perform();
            blocker.done();
        } catch(e) {
            blocker.errored(e);
        }
    }

    @action
    didTransition() {
        this.analytics.trackPage();
    }
}
