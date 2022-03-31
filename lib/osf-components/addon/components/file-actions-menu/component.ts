/* eslint-disable eqeqeq */
/* eslint-disable no-console */
import { action } from '@ember/object';
import Component from '@glimmer/component';

export default class FileActionsMenu extends Component {

    @action
    focusActions() {
        $(document).keypress(function(e) {
            if (e.code == 'Enter' || e.code == 'Tab') {
                const trigger = document.getElementById('actionsEllipse');
                if(trigger) {
                    trigger.click();
                    const actionItem = document.getElementById('downloadButton');
                    if(actionItem && (e.code == 'Tab' || e.code == 'Enter')) {
                        actionItem.focus();

                        actionItem.addEventListener('keypress', function(event) {
                            if (event.code == 'Enter') {
                                console.log('Enter pressed');
                                actionItem.click();
                            }
                        });
                    } else {
                        console.log('other key was pressed or focus lost');

                    }
                }
            }
        });
    }
}
