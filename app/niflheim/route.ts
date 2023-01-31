import Route from '@ember/routing/route';
import RouterService from '@ember/routing/router-service';
import { inject as service } from '@ember/service';

import Session from 'ember-simple-auth/services/session';

import requireAuth from 'ember-osf-web/decorators/require-auth';
import RegistrationModel from 'ember-osf-web/models/registration';
import CurrentUser from 'ember-osf-web/services/current-user';
import Ready from 'ember-osf-web/services/ready';

import BitbucketFile from 'ember-osf-web/packages/files/bitbucket-file';
import BoxFile from 'ember-osf-web/packages/files/box-file';
import DataverseFile from 'ember-osf-web/packages/files/dataverse-file';
import DropboxFile from 'ember-osf-web/packages/files/dropbox-file';
import FigshareFile from 'ember-osf-web/packages/files/figshare-file';
import GithubFile from 'ember-osf-web/packages/files/github-file';
import GitlabFile from 'ember-osf-web/packages/files/gitlab-file';
import GoogleDriveFile from 'ember-osf-web/packages/files/google-drive-file';
import OneDriveFile from 'ember-osf-web/packages/files/one-drive-file';
import OsfStorageFile from 'ember-osf-web/packages/files/osf-storage-file';
import OwnCloudFile from 'ember-osf-web/packages/files/own-cloud-file';
import S3File from 'ember-osf-web/packages/files/s3-file';

@requireAuth('home')
export default class Niflheim extends Route {
    @service currentUser!: CurrentUser;
    @service ready!: Ready;
    @service session!: Session;
    @service router!: RouterService;

    modelA?: any;                                           // TODO update to model
    modelB?: any;                                           // TODO update to model
    controllerA?: any;
    controllerB?: any;

    guid: string = 'pg5s5';                                     // TODO remove hardcoded value

    constructor() {
        super(...arguments);

        this.router.on('routeWillChange', transition => {
            if (!transition.to.find(route =>
                route.name === this.routeName) && !confirm('Leaving current page. Continue?')) {
                transition.abort();
            }
        });
    }

    init() {
        const controllerA = this.controllerFor('guid-file');
        this.set('controllerA', controllerA);
    }

    async model() {
        const guid = 'pg5s5';
        try {
            const file = await this.store.findRecord('file', guid, {include: 'target'});
            const target = await file.target as unknown as RegistrationModel;
            if (target.withdrawn === true) {
                this.transitionTo('guid-registration', target.id);
            }
            const provider = file.provider;
            let storageFile;

            switch(provider){
            case 'osfstorage':
                storageFile = new OsfStorageFile(this.currentUser, file);
                break;
            case 'bitbucket':
                storageFile = new BitbucketFile(this.currentUser, file);
                break;
            case 'box':
                storageFile = new BoxFile(this.currentUser, file);
                break;
            case 'dataverse':
                storageFile = new DataverseFile(this.currentUser, file);
                break;
            case 'dropbox':
                storageFile = new DropboxFile(this.currentUser, file);
                break;
            case 'figshare':
                storageFile = new FigshareFile(this.currentUser, file);
                break;
            case 'github':
                storageFile = new GithubFile(this.currentUser, file);
                break;
            case 'gitlab':
                storageFile = new GitlabFile(this.currentUser, file);
                break;
            case 'googledrive':
                storageFile = new GoogleDriveFile(this.currentUser, file);
                break;
            case 'onedrive':
                storageFile = new OneDriveFile(this.currentUser, file);
                break;
            case 'owncloud':
                storageFile = new OwnCloudFile(this.currentUser, file);
                break;
            case 's3':
                storageFile = new S3File(this.currentUser, file);
                break;
            default:
                this.transitionTo('not-found', guid);
            }
            this.set('modelA', storageFile);
            return storageFile;
        } catch (error) {
            this.transitionTo('not-found', guid);
            throw error;
        }
    }

    renderTemplate() {
        this.render();
        this.render('guid-file', { outlet: 'home', model: this.modelA, controller: this.controllerA, into: 'niflheim'});
    }
}
