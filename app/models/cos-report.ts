
import { attr, hasMany, AsyncHasMany } from '@ember-data/model';
import IssueModel from 'ember-osf-web/models/issue-type';
import OsfModel, { Permission } from './osf-model';

export const permissions = Object.freeze(Object.values(Permission));

export enum IssueType {
    BUG = 'BUG',
    SECURITY_CONCERN = 'SECURITY',
    SPAM = 'SPAM'
}

export default class CosReportModel extends OsfModel {
    @attr('string') name!: string;
    @attr('date') dateCreated!: Date;
    @attr('fixstring') description!: string;
    @attr('string') authUrl!: string; // user's auth
    @attr('string') foundAturl!: string; // path where issue was reported
    @attr('string') currentUserIsAdmin!: boolean;
    @attr('string') issueType!: IssueType[];

    @hasMany('issueTypes') // add model for overall module{ inverse: 'cos-report' })
    isueTypes!: AsyncHasMany<IssueModel>;
}
