import Model, { AsyncBelongsTo, AsyncHasMany, attr, belongsTo, hasMany } from '@ember-data/model';

import IndexPropertySearchModel from './index-property-search';
import SearchResultModel from './search-result';

export interface SearchFilter {
    propertyPath: string;
    filterValue: string[];
    filterType?: string;
}

export default class IndexCardSearchModel extends Model {
    @attr('string') cardSearchText!: string;
    @attr('array') cardSearchFilters!: SearchFilter[];
    @attr('number') totalResultCount!: number;

    @hasMany('search-result', { inverse: null })
    searchResultPage!: AsyncHasMany<SearchResultModel> & SearchResultModel[];

    @belongsTo('index-property-search', { inverse: null })
    relatedPropertySearch!: AsyncBelongsTo<IndexPropertySearchModel> & IndexPropertySearchModel;

    get firstPageCursor() {
        if (this.searchResultPage.links.first?.href) {
            const firstPageLinkUrl = new URL(this.searchResultPage.links.first?.href);
            return firstPageLinkUrl.searchParams.get('page[cursor]');
        }
        return null;
    }

    get prevPageCursor() {
        if (this.searchResultPage.links.prev?.href) {
            const prevPageLinkUrl = new URL(this.searchResultPage.links.prev?.href);
            return prevPageLinkUrl.searchParams.get('page[cursor]');
        }
        return null;
    }

    get nextPageCursor() {
        if (this.searchResultPage.links.next?.href) {
            const nextPageLinkUrl = new URL(this.searchResultPage.links.next?.href);
            return nextPageLinkUrl.searchParams.get('page[cursor]');
        }
        return null;
    }
}

declare module 'ember-data/types/registries/model' {
    export default interface ModelRegistry {
        'index-card-search': IndexCardSearchModel;
    } // eslint-disable-line semi
}
