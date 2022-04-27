/* eslint-disable no-var */
/* eslint-disable no-console */
/* eslint-disable eqeqeq */
import Controller from '@ember/controller';
import { action } from '@ember/object';
import { alias, and } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { waitFor } from '@ember/test-waiters';
import { tracked } from '@glimmer/tracking';
import { restartableTask } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import Media from 'ember-responsive';
import Toast from 'ember-toastr/services/toast';

export default class GuidFile extends Controller {
    @service media!: Media;
    @service toast!: Toast;
    // @service file!: File;

    @tracked revisionsOpened = false;
    @tracked tagsOpened = false;
    @tracked viewedVersion?: number;

    @tracked shouldShowEdit = false;
    renamedFile: String = '';

    @alias('registration.userHasWritePermission') userCanEdit!: boolean;

    @and('userCanEdit', 'requestedEditMode') inEditMode!: boolean;

    get rightColumnClosed() {
        return !(this.revisionsOpened || this.tagsOpened);
    }

    get isMobile() {
        return this.media.isMobile;
    }

    get isTablet() {
        return this.media.isTablet;
    }

    @action
    shouldShowEditToggle() {
        this.toggleProperty('shouldShowEdit');
        const userInput = document.getElementById('userInput');
        if (userInput){
            window.scrollTo(0, 0);
            userInput.focus();
        }
    }

    @restartableTask
    @waitFor
    async renameFile() {
        const input = document.getElementById('userInput');
        if (input) {
            const newName = input.value;
            console.log('The files new name is:', newName);
        }

        try {
            console.log(this.model);
            console.log(this.model.file);
            console.log(this.model.fileModel.target);
            // this.model.file.rename(newName);

        } catch (e) {
            throw new Error('That didnt work');
        }
    }

    @action
    validateFileName() {
        const userInputField = document.getElementById('userInput');
        console.log('User input field is', userInputField);
        if (userInputField) {
            const inputValue = userInputField.name;
            const inputName = userInputField.value;
            console.log('Inner text value:', inputValue);
            console.log('Input name:', inputName);
            if (inputName == inputValue) {
                console.log('File name and user input SAME');
            } else {
                console.log('File name and user input DIFFERENT');
            }
        }
    }

    @action
    clearField() {
        console.log('Inside clear field function.');
        const userInputField = document.getElementById('userInput');
        if (userInputField) {
            console.log(userInputField);
            userInputField.value = '';
        }
    }

    @action
    changeVersion(version: number) {
        this.viewedVersion = version;
    }

    @action
    toggleRevisions() {
        if (!this.model.waterButlerRevisions) {
            taskFor(this.model.getRevisions).perform();
        }
        if (this.isMobile) {
            this.revisionsOpened = true;
            this.tagsOpened = false;
        } else {
            if (this.tagsOpened) {
                this.tagsOpened = false;
            }
            this.toggleProperty('revisionsOpened');
        }
    }

    @action
    toggleTags() {
        if (this.isMobile) {
            this.tagsOpened = true;
            this.revisionsOpened = false;
        } else {
            if (this.revisionsOpened) {
                this.revisionsOpened = false;
            }
            this.toggleProperty('tagsOpened');
        }
    }

    @action
    toggleFileRenderer() {
        if (this.isMobile) {
            this.tagsOpened = false;
            this.revisionsOpened = false;
        } else {
            if (this.rightColumnClosed) {
                this.revisionsOpened = true;
                this.tagsOpened = false;
            } else {
                this.revisionsOpened = false;
                this.tagsOpened = false;
            }
        }
    }
}
