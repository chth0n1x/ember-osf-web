import { AsyncHasMany, attr, belongsTo, hasMany } from '@ember-data/model';
import CollectionModel from 'ember-osf-web/models/collection';
import InstitutionModel from 'ember-osf-web/models/institution';
import NodeModel from 'ember-osf-web/models/node';
import OsfModel from 'ember-osf-web/models/osf-model';
import PreprintModel from 'ember-osf-web/models/preprint';
import RegistrationModel from 'ember-osf-web/models/registration';
import User from './user';

export interface Badges {
    name: string;
    dateAcquired: Date;
    url: string;
}

export default class UserCompassModel extends OsfModel {
    @attr('fixstring') description!: string;
    @attr('fixstring') totalRisk!: string;
    @attr('fixstring') totalReputation!: string;
    @attr('fixstring') badges!: Badges[]; // create badges class

    @belongsTo('user') user!: User;

    @hasMany('node')
    nodes!: AsyncHasMany<NodeModel>;

    @hasMany('registrations')
    registrations!: AsyncHasMany<RegistrationModel>;

    @hasMany('preprints')
    preprints!: AsyncHasMany<PreprintModel>;

    @hasMany('collections')
    collections!: AsyncHasMany<CollectionModel>;

    @hasMany('institution', { inverse: 'users' })
    institutions!: AsyncHasMany<InstitutionModel>;

    // increaseRisk(id, increment, group) { console.log('risk increased')};
    // decreaseRisk(id, decrement, group) { console.log('risk decreased')};
}
