import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import Session from 'ember-simple-auth/services/session';

import NiflheimController from 'ember-osf-web/dashboard/controller';
import requireAuth from 'ember-osf-web/decorators/require-auth';
import CurrentUser from 'ember-osf-web/services/current-user';
import Ready from 'ember-osf-web/services/ready';

@requireAuth('home')
export default class Niflheim extends Route.extend({
    // anything which *must* be merged to prototype here
}) {
    @service currentUser!: CurrentUser;
    @service ready!: Ready;
    @service session!: Session;

    async setupController(controller: NiflheimController): Promise<void> {
        const blocker = this.ready.getBlocker();

        try {
            await taskFor(controller.setupTask).perform();
            blocker.done();
        } catch (e) {
            blocker.errored(e);
        }
    }
}
