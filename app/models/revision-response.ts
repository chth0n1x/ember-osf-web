import { attr, belongsTo } from '@ember-data/model';
import Registration from 'ember-osf-web/models/registration';

import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import pathJoin from 'ember-osf-web/utils/path-join';
import config from 'ember-get-config';

const { OSF: { url: baseURL } } = config;

// import Session from 'ember-simple-auth/services/session';
// import CurrentUser from 'ember-osf-web/services/current-user';

import Intl from 'ember-intl/services/intl';

export default class RevisionResponse {
    isVersioned?: boolean;
    isApproved?: boolean;

    // for timezones
    @service intl!: Intl;

    @attr('fixstring') type!: string;
    @attr('fixstring') reviewState!: string;
    @attr('date') dateCreated?: Date;
    @attr('date') dateSubmitted?: Date;
    @attr('date') dateLastModified?: Date;
    @attr('string') submittedBy!: string;
    @attr('string') revisionJustification!: string; // in the form of a dropdown itself
    @attr('string') response!: string; // only one response at a time, sanitized

    @belongsTo('registration', { inverse: 'draftRegistration'})
    registration!: Registration;

    @computed('registration.getEditsAll')
    get editsAll() {
        // return array of all previously approved edits in a descending list, most recent first
        // the first in the unordered list will be appended with: '(current version)'
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
