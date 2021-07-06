import { attr, hasMany } from '@ember-data/model';
import OsfModel from './osf-model';

export default class SchemaResponses extends OsfModel {

    @attr('number') id!: string;
    @attr('boolean') isApproved?: boolean; // corresponds to EditType
    @attr('number') versionNumber?: number; // add logic that only approved get this
    @attr('object') editedText?: UserEdit[]; // text altered after the user clicks edit button,
    // API then sends 'PUT' or 'PATCH' http method ; see if this can be a stack
    @attr('object') nonEditedText?: UserEdit[]; // so we can analyze the diff
    @attr('string') editedTextColor?: string; // in hex, permit only /^#[A-FA-F0-9]{6}$/
    @attr('string') nonEditedTextColor?: string; // in hex, permit only /^#[A-FA-F0-9]{6}$/
    @attr('number') index?: number; // archive (discuss: would we like to store all edits?)

    @hasMany('user-edit', {inverse: 'edits', async: false})
    userEdits?: UserEdit[];
}

export type EditType =
    'approvedEdit' |
    'unapprovedEdit';

export interface UserEdit {

        id?: string;
        editType?: EditType; // either approved on unapproved
        registrationResponseKey?: string| null;
        version: number; // all edits would fall within a version since the last approval
        helpText?: string; // for moderators to explain why approved/rejected; after fix, would likely be approved
        editedText?: string; // make as a FIFO DS (stack)
        originalText?: string;
}
