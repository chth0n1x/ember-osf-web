/* eslint-disable max-len */
/* eslint-disable no-console */
import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';
import { action } from '@ember/object';

import { layout } from 'ember-osf-web/decorators/component';
import styles from './styles';
import template from './template';

@layout(template, styles)
@tagName('')
export default class FilesActionMenu extends Component {
    // private property

    @action
    toggleEdit() {
        // this.toggleProperty('shouldShowEdit');
        // const userInput = document.getElementById('userInput');
        // if (userInput){
        //     window.scrollTo(0, 0);
        //     userInput.focus();
        // }
        // console.log(this.shouldShowEdit);
        console.log('Inside FileActionsMenu: toggle edit');
    }
}
