import { render } from '@ember/test-helpers';
import triggerEvent from '@ember/test-helpers/dom/trigger-event';
import { hbs } from 'ember-cli-htmlbars';
import { TestContext } from 'ember-test-helpers';
import { setupIntl, t } from 'ember-intl/test-support';
import { setupRenderingTest } from 'ember-qunit';
import { setBreakpoint } from 'ember-responsive/test-support';
import { module, test } from 'qunit';
import { OsfLinkRouterStub } from '../../helpers/osf-link-router-stub';


module('Integration | Component | open-badges-list', hooks => {
    setupRenderingTest(hooks);
    setupIntl(hooks);

    hooks.beforeEach(function(this: TestContext) {
        this.store = this.owner.lookup('service:store');
        this.owner.unregister('service:router');
        this.owner.register('service:router', OsfLinkRouterStub.extend({
            urlFor(__: any, modelId: string) {
                return `/${modelId}`;
            },
        }));
    });

    test('it renders in the all true state desktop view', async function(assert) {
        setBreakpoint('desktop');
        await render(hbs`<OpenBadgesList
            @hasData={{true}}
            @hasAnalyticCode={{true}}
            @hasMaterials={{true}}
            @hasPapers={{true}}
            @hasSupplements={{true}}
            @registration='guid1'
        />`);
        assert.dom('[data-test-badge-list-title]')
            .hasText(t('osf-components.open-badges-list.title'), 'Title shows in desktop');
        assert.dom('[data-test-badge-item]').exists({count: 5}, 'All the badges are there');
    });

    test('it renders in the all false state mobile view', async function(assert) {
        setBreakpoint('mobile');
        await render(hbs`<OpenBadgesList
            @hasData={{false}}
            @hasAnalyticCode={{false}}
            @hasMaterials={{false}}
            @hasPapers={{false}}
            @hasSupplements={{false}}
            @registration='guid1'
        />`);
        assert.dom('[data-test-badge-list-title]')
            .doesNotExist('Title does not show in mobile');
        assert.dom('[data-test-badge-item]').exists({count: 5}, 'All the badges are there');
    });

    test('it renders in the all true state mobile view', async function(assert) {
        setBreakpoint('mobile');
        await render(hbs`<OpenBadgesList
            @hasData={{true}}
            @hasAnalyticCode={{true}}
            @hasMaterials={{true}}
            @registration='guid1'
        />`);
        assert.dom('[data-test-badge-image="data"]').hasAttribute(
            'src',
            '/assets/images/badges/data_small_color.png',
            'Data badge has correct image',
        );
        assert.dom('[data-test-badge-image="materials"]').hasAttribute(
            'src',
            '/assets/images/badges/materials_small_color.png',
            'Materials badge has correct image',
        );
        await triggerEvent('[data-test-badge-icon="data"]', 'mouseenter');
        assert.dom('.ember-bootstrap-tooltip .tooltip-inner').hasText(
            t('osf-components.open-badges-list.open-data'),
            'Correct tooltip in mobile view for data',
        );
        await triggerEvent('[data-test-badge-icon="data"]', 'mouseleave');
        await triggerEvent('[data-test-badge-icon="materials"]', 'mouseenter');
        assert.dom('.ember-bootstrap-tooltip .tooltip-inner').hasText(
            t('osf-components.open-badges-list.open-materials'),
            'Correct tooltip in mobile view for materials',
        );
    });
});


module('Integration | Component | open-badges-list | open-badge-card', hooks => {
    setupRenderingTest(hooks);
    setupIntl(hooks);

    hooks.beforeEach(function(this: TestContext) {
        this.store = this.owner.lookup('service:store');
        this.owner.unregister('service:router');
        this.owner.register('service:router', OsfLinkRouterStub.extend({
            urlFor(__: any, modelId: string) {
                return `/${modelId}/resources`;
            },
        }));
    });

    test('it renders data in the true state desktop view', async function(assert) {
        await render(hbs`<OpenBadgesList::OpenBadgeCard
            @hasResource={{true}}
            @resourceType='data'
            @isMobile={{false}}
            @registration='guid1'
        />`);
        assert.dom('[data-test-badge-image="data"]').hasAttribute(
            'src',
            '/assets/images/badges/data_small_color.png',
            'Data badge has correct image',
        );
        assert.dom('[data-test-badge-item="data"]').hasText(
            t('osf-components.open-badges-list.open-data'),
            'Text label shows for data badge in desktop',
        );
        assert.dom('a').hasAttribute(
            'href',
            '/guid1/resources',
            'Has a link to the registration resources page',
        );
        await triggerEvent('[data-test-badge-icon="data"]', 'mouseenter');
        assert.dom('.ember-bootstrap-tooltip .tooltip-inner').doesNotExist(
            'No tooltip in desktop view for data',
        );
    });

    test('it renders materials in the false state mobile view', async function(assert) {
        await render(hbs`<OpenBadgesList::OpenBadgeCard
            @hasResource={{false}}
            @resourceType='materials'
            @isMobile={{true}}
            @registration='guid1'
        />`);
        assert.dom('[data-test-badge-image="materials"]').hasAttribute(
            'src',
            '/assets/images/badges/materials_small_gray.png',
            'Materials badge has correct image',
        );
        assert.dom('[data-test-badge-item="materials"]').doesNotHaveTextContaining(
            t('osf-components.open-badges-list.open-materials'),
            'Text label does not show for materials badge in mobile',
        );
        assert.dom('a').hasAttribute(
            'href',
            '/guid1/resources',
            'Has a link to the registration resources page',
        );
        await triggerEvent('[data-test-badge-icon="materials"]', 'mouseenter');
        assert.dom('.ember-bootstrap-tooltip .tooltip-inner').hasText(
            t('osf-components.open-badges-list.open-materials'),
            'Correct tooltip in mobile view for materials',
        );
    });

    test('it renders materials in the true state mobile view', async function(assert) {
        await render(hbs`<OpenBadgesList::OpenBadgeCard
            @hasResource={{true}}
            @resourceType='materials'
            @isMobile={{true}}
            @registration='guid1'
        />`);
        assert.dom('[data-test-badge-image="materials"]').hasAttribute(
            'src',
            '/assets/images/badges/materials_small_color.png',
            'Materials badge has correct image',
        );
        assert.dom('a').hasAttribute(
            'href',
            '/guid1/resources',
            'Has a link to the registration resources page',
        );
        await triggerEvent('[data-test-badge-icon="materials"]', 'mouseenter');
        assert.dom('.ember-bootstrap-tooltip .tooltip-inner').hasText(
            t('osf-components.open-badges-list.open-materials'),
            'Correct tooltip in mobile view for materials',
        );
    });
});
