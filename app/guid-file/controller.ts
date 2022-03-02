/* eslint-disable no-console */
import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

import Media from 'ember-responsive';

export default class GuidFile extends Controller {
    @service media!: Media;

    revisionClicked = false;
    tagsClicked = false;

    get isMobile() {
        return this.media.isMobile;
    }

    get isTablet() {
        return this.media.isTablet;
    }

    @action
    toggleVersions() {
        this.toggleProperty('revisionClicked');

        if (this.tagsClicked === true) {
            this.closeTags();
        }
        if (this.revisionClicked === true) {
            this.openVersions();
        }
        if (this.revisionClicked === false) {
            this.closeVersions();
        }
    }

    @action
    toggleTags() {
        this.toggleProperty('tagsClicked');

        if (this.revisionClicked === true) {
            this.closeVersions();
        }
        if (this.tagsClicked === true) {
            this.openTags();
        }
        if (this.tagsClicked === false) {
            this.closeTags();
        }
    }

    openVersions() {
        if (this.tagsClicked === true) {
            this.closeTags();
            this.tagsClicked = false;
        }
        const versionSlide = document.getElementById('versions');
        if (versionSlide) {
            versionSlide.hidden = false;
            versionSlide.classList.add('col-lg-4');
            versionSlide.style.width = '450px';
        }

        if (this.isMobile) {
            console.log('Mobile device detected.');
            const fileViewer = document.getElementById('mfrIframeParent');
            if (fileViewer) {
                fileViewer.hidden = true;
            }
        }
    }

    closeVersions() {
        const versionSlide = document.getElementById('versions');
        if (versionSlide) {
            versionSlide.hidden = true;
            versionSlide.classList.remove('col-lg-4');
            versionSlide.style.width = '0px';
        }
    }

    openTags() {
        if (this.revisionClicked === true) {
            this.closeVersions();
            this.revisionClicked = false;
        }
        const tagsSlide = document.getElementById('tags');
        if (tagsSlide) {
            tagsSlide.hidden = false;
            tagsSlide.classList.add('col-lg-4');
            tagsSlide.style.width = '450px';
        }
    }

    closeTags() {
        const tagsSlide = document.getElementById('tags');
        if (tagsSlide) {
            tagsSlide.hidden = true;
            tagsSlide.classList.remove('col-lg-4');
            tagsSlide.style.width = '0px';
        }
    }
}
