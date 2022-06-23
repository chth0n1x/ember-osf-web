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

export interface NodeData {
    name: string; // name of project, component, or registraton
    type: string; // node type;
    isLiked: number;
    isFavorited: number;
    isDisliked: number;
    isNoshow: number;
}

export default class UserCompassModel extends OsfModel {
    @attr('fixstring') id!: string;
    @attr('fixstring') fullname!: string;
    @attr('fixstring') description!: string;
    @attr('fixstring') totalRisk!: number;
    @attr('fixstring') totalReputation!: number;
    @attr('fixstring') badges!: Badges[];
    @attr('fixstring') favorited!:  NodeData[];
    @attr('fixstring') liked!: NodeData[];
    @attr('fixstring') disliked!: NodeData[];
    @attr('fixstring') noshow!: NodeData[];

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
