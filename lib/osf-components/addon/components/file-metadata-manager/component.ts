import Store from '@ember-data/store';
import { assert } from '@ember/debug';
import { action } from '@ember/object';
import { alias, or } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { waitFor } from '@ember/test-waiters';
import Component from '@glimmer/component';
import Intl from 'ember-intl/services/intl';
import Toast from 'ember-toastr/services/toast';
import { BufferedChangeset } from 'ember-changeset/types';
import { restartableTask, task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

import CustomFileMetadataRecordModel from 'ember-osf-web/models/custom-file-metadata-record';
import CustomItemMetadataRecordModel from 'ember-osf-web/models/custom-item-metadata-record';
import FileModel from 'ember-osf-web/models/file';
import { Permission } from 'ember-osf-web/models/osf-model';
import { getApiErrorMessage } from 'ember-osf-web/utils/capture-exception';
import buildChangeset from 'ember-osf-web/utils/build-changeset';
import { tracked } from '@glimmer/tracking';
import NodeModel from 'ember-osf-web/models/node';
import RegistrationModel from 'ember-osf-web/models/registration';
import LicenseModel from 'ember-osf-web/models/license';
import InstitutionModel from 'ember-osf-web/models/institution';

interface Args {
    file: FileModel;
}

export interface FileMetadataManager {
    edit: () => void;
    save: () => void;
    cancel: () => void;
    metadata: CustomFileMetadataRecordModel;
    targetMetadata: CustomItemMetadataRecordModel;
    file: FileModel;
    target: (NodeModel | RegistrationModel);
    targetInstitutions: InstitutionModel[];
    targetLicense: LicenseModel;
    changeset: BufferedChangeset;
    inEditMode: boolean;
    isSaving: boolean;
    userCanEdit: boolean;
    isDirty: boolean;
    isGatheringData: boolean;
}

export default class FileMetadataManagerComponent extends Component<Args> {
    @service store!: Store;
    @service intl!: Intl;
    @service toast!: Toast;

    @tracked metadataRecord!: CustomFileMetadataRecordModel;
    @tracked targetMetadata!: CustomItemMetadataRecordModel;
    file: FileModel = this.args.file;
    @tracked target!: (NodeModel | RegistrationModel);
    @tracked targetInstitutions!: InstitutionModel[];
    @tracked targetLicense!: LicenseModel;
    @tracked changeset!: BufferedChangeset;
    @tracked inEditMode = false;
    @tracked userCanEdit!: boolean;
    @or(
        'getGuidMetadata.isRunning',
        'getTarget.isRunning',
    )
    isGatheringData!: boolean;
    @alias('changeset.isDirty') isDirty!: boolean;
    @alias('save.isRunning') isSaving!: boolean;

    constructor(owner: unknown, args: Args) {
        super(owner, args);
        assert(
            'You will need pass in a FileModel object to the FileMetadataManager component to get metadata',
            Boolean(args.file instanceof FileModel),
        );
        try {
            taskFor(this.getGuidMetadata).perform();
            taskFor(this.getTarget).perform();
        } catch (e) {
            const errorTitle = this.intl.t('osf-components.file-metadata-manager.error-getting-metadata');
            this.toast.error(getApiErrorMessage(e), errorTitle);
        }
    }

    @task
    @waitFor
    async getTarget() {
        this.target = await this.file.target as NodeModel;
        this.targetLicense = await this.target.license;
        this.targetInstitutions = await this.target.affiliatedInstitutions as InstitutionModel[];
        this.userCanEdit = this.target.currentUserPermissions.includes(Permission.Write);
        await taskFor(this.getTargetMetadata).perform();
    }

    @task
    @waitFor
    async getGuidMetadata() {
        const guidRecord = await this.store.findRecord('guid', this.file.guid, {
            include: 'metadata',
            resolve: false,
        });
        this.metadataRecord = guidRecord.customMetadata as CustomFileMetadataRecordModel;
        this.changeset = buildChangeset(this.metadataRecord, null);
    }

    @task
    @waitFor
    async getTargetMetadata() {
        const guidRecord = await this.store.findRecord('guid', this.target.id, {
            include: 'metadata',
            resolve: false,
        });
        this.targetMetadata = await guidRecord.customMetadata as CustomItemMetadataRecordModel;
    }

    @action
    edit(){
        this.inEditMode = true;
    }

    @action
    cancel(){
        this.changeset.rollback();
        this.inEditMode = false;
    }

    @restartableTask
    @waitFor
    async save(){
        try {
            this.changeset.execute();
            this.inEditMode = false;
        } catch (e) {
            const errorTitle = this.intl.t('osf-components.file-metadata-manager.error-saving-metadata');
            this.toast.error(getApiErrorMessage(e), errorTitle);
        }
    }

    get nodeWord() {
        if(this.target) {
            if (this.target.isRegistration) {
                return 'registration';
            }
            if (this.target.parent.id) {
                return 'component';
            }
        }
        return 'project';
    }
}
