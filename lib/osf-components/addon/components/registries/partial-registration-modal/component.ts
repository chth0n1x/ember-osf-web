import Component from '@glimmer/component';
import { assert } from '@ember/debug';
import { action } from '@ember/object';

import NodeModel from 'ember-osf-web/models/node';
import { HierarchicalListManager } from 'osf-components/components/registries/hierarchical-list';

export interface Args {
    manager: HierarchicalListManager;
}

export default class PartialRegistrationModal extends Component<Args> {
    constructor(owner: unknown, args: Args) {
        super(owner, args);
    }

    // Optional
    onContinue?: (nodes: NodeModel[]) => void;

    didReceiveAttrs() {
        assert('partial-registration-modal requires @manager!', Boolean(this.args.manager));
    }

    @action
    async continue() {
        const nodes = await this.args.manager.selectedNodes;

        if (this.onContinue) {
            this.onContinue(nodes);
        }
    }
}
