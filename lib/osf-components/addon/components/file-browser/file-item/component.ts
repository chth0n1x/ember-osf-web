/* eslint-disable no-var */
/* eslint-disable no-console */
/* eslint-disable eqeqeq */
import Component from '@ember/component';
import { action } from '@ember/object';
import { Route } from '@ember/routing';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import Media from 'ember-responsive';
import Toast from 'ember-toastr/services/toast';

export default class FileItem extends Component {
    @service media!: Media;
    @service toast!: Toast;
    @service route!: Route;

    @tracked revisionsOpened = false;
    @tracked tagsOpened = false;
    @tracked viewedVersion?: number;

    @tracked shouldShowEdit = false;
    renamedFile: String = '';

    @action
    shouldShowEditToggle() {
        this.toggleProperty('shouldShowEdit');
        console.log('Should show edit', this.shouldShowEdit);
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
            const currentFileName = this.route.model.name;
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
                const currentFileName = this.route.model.name;

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

                // console.log('The file model target is', this.model.fileModel.target);
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
}
