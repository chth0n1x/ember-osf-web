/* eslint-disable no-var */
/* eslint-disable no-console */
/* eslint-disable eqeqeq */
import Controller from '@ember/controller';
import { action } from '@ember/object';
import { alias, and } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
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
        // window.scrollTo(0, 0);
        const userInput = document.getElementById('userInput');
        // const placeholder = document.getElementById('userInput-placeholder');
        if (userInput){
            // const userInput = document.getElementById('userInput').getAttribute('placeholder');
            // const placeHolderText = document.getElementById('userInput').getAttribute('placeholder');
            // console.log('Placeholder text: ', placeHolderText);
            // const placeHolderLength = placeHolderText.length * 2;
            // .toString();
            // if (placeHolderName) {
            // userInput.setAttribute('size', placeHolderName);
            // placeHolderLength.toString();
            // const placeholderSize = placeHolderLength.toString() + 'ch';
            // const placeholderPixel = placeHolderText.valueOf + 'px';
            // userInput.style.width = placeholderSize;
            const currentFileName = this.model.name;
            console.log('File name is:', currentFileName);
            const inputWidth = currentFileName.length;
            console.log('File name length is:', inputWidth);
            // userInput.style.width = inputWidth + 'px';
            userInput.style.width = '1000px';
            // if (placeHolderText) {
            //     userInput.style.width = inputWidth + 'px';//  + 'px';
            // }
            // console.log(userInput.style.width);
            // console.log('Size is ', placeholderSize);
            // console.log('Pixels are ', placeholderPixel);
            window.scrollTo(0, 0);
            userInput.focus();
        }
    }

    //     var input = document.getElementById('input-1');

    // // measure width of same text as placeholder
    // var placeholder =  document.getElementById('input-1-placeholder');


    // input.style.width = placeholder.offsetWidth + "px"

    @action
    renameFile() {
        const input = document.getElementById('userInput');
        if (input) {
            const newName = input.value;
            console.log('The files new name is:', newName);
            try {
                const dialogBox = document.getElementById('dialogBox');
                let message = '';
                console.log('The model is: ', this.model);
                const currentFileName = this.model.name;

                if (newName == '' || newName == null || newName == undefined) {
                    console.log('No name entered');
                    message = 'Please enter a name.';
                }
                if (newName == currentFileName) {
                    console.log('File name and user input SAME');
                    message = 'Please rename the file.';
                    this.clearField();

                } else {
                    console.log('File name and user input DIFFERENT');
                    message = 'Rename successful';
                }
                const p = document.createElement('p');
                const textNode = document.createTextNode('td');
                textNode.textContent = message;
                p.appendChild(textNode);
                if (dialogBox) {
                    dialogBox.appendChild(p);

                    setTimeout(() => {
                        dialogBox.removeChild(p);
                        // textNode.remove();
                        // p.remove();
                    }, 5000);
                }

                console.log('The file model target is', this.model.fileModel.target);
                // this.model.file.rename(newName);
            } catch (e) {
                throw new Error('That didnt work');
            }
        }
    }

    @action
    cancelRename() {
        console.log('cancel button clicked');
        this.shouldShowEdit = false;
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
