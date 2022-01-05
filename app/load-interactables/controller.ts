import Store from '@ember-data/store';
import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
// import config from 'ember-get-config';

import Intl from 'ember-intl/services/intl';
import Session from 'ember-simple-auth/services/session';

// const { OSF: { url: baseURL } } = config;

export default class Overview extends Controller {
    @service store!: Store;
    @service intl!: Intl;
    @service session?: Session;

    @tracked mode = '';
    @tracked revisionId = '';
}

