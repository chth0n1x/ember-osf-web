import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { hbs } from 'ember-cli-htmlbars';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { t } from 'ember-intl/test-support';
import { RevisionReviewStates } from 'ember-osf-web/models/revision';
import { setupEngineRenderingTest } from 'ember-osf-web/tests/helpers/engines';

module('Integration | Component | update-dropdown', hooks => {
    setupEngineRenderingTest(hooks, 'registries');
    setupMirage(hooks);

    test('it renders', async function(assert) {
        const registration = server.create('registration', {
            revisionState: RevisionReviewStates.Approved,
        });

        this.setProperties({ registration });
        await render(hbs`<Registries::UpdateDropdown @registration={{this.registration}}/>`);

        assert.dom('[data-test-update-content]').doesNotExist();

        assert.dom('[data-test-update-button]').exists({ count: 1 });

        assert.dom('[data-test-update-button]').hasText(t('registries.update_dropdown.dropdown_title').toString());
    });
});
