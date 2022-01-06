
import { attr  } from '@ember-data/model';
import IssueType from 'ember-osf-web/models/issue-type';
import OsfModel, { Permission } from './osf-model';

export const permissions = Object.freeze(Object.values(Permission));

export default class CosReportModel extends OsfModel {
    @attr('string') name!: string;
    @attr('date') dateCreated!: Date;
    @attr('fixstring') description!: string;
    @attr('string') authUrl!: string; // user's auth
    @attr('string') foundAturl!: string; // path where issue was reported
    @attr('string') currentUserIsAdmin!: boolean;
    @attr('array') selectableIssues?: IssueType[];
    @attr('array') typeOfIssue!: IssueType[];
}
