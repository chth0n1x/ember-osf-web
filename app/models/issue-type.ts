import { attr } from '@ember-data/model';

import OsfModel, { Permission } from './osf-model';

export const permissions = Object.freeze(Object.values(Permission));

export enum IssueType {
    BUG = 'BUG',
    SECURITY = 'SECURITY',
    SPAM = 'SPAM',
}

export default class IssueTypeModel extends OsfModel {
    @attr('string') name!: string;
    @attr('fixstring') description!: string;
    @attr('string') logoRoundedUrl!: string; // user's auth
    @attr('string') foundAtUrl!: string; // path where issue was reported
    @attr('string') currentUserIsAdmin!: boolean;
    @attr('array') typeOfIssue?: IssueType[];
}
