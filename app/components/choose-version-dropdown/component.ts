import Component from '@ember/component';
import { computed } from '@ember/object';
import config from 'ember-get-config';
import { inject as service } from '@ember/service';

import Intl from 'ember-intl/services/intl';

import RegistrationModel from 'ember-osf-web/models/registration'; // , { RegistrationReviewStates }

import pathJoin from 'ember-osf-web/utils/path-join';

const { OSF: { url: baseURL } } = config;

export default class ChooseVersionDropdown extends Component {
    registration!: RegistrationModel;
    isVersioned!: boolean;

    // Private
    @service intl!: Intl;

    @computed('registration.getEditsAll')
    get userEditsAll() {
        // return array of all previously approved edits in a descending list, most recent first
        // the first in the unordered list will be marked 'Current Version'
        return;
    }

    @computed('registration.getEditLastApproved')
    get editLastApproved() {
        // TODO return most recently approved edit, alternatively may return last edit
        return;
    }

    @computed('registration.getEditLastUnapproved')
    get editLastUnapproved() {
        // TODO return last unapproved edit, so user may do so
        return;
    }

    @computed('registration.versionNumber')
    get versionNumber() {
        // TODO change isVersioned to its actual verison number
        return this.registration && pathJoin(baseURL, `${this.registration.versionNumber}`);
    }
}
