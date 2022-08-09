/* eslint-disable max-len */
/* eslint-disable eqeqeq */
/* eslint-disable @typescript-eslint/prefer-for-of */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/quotes */
/* eslint-disable no-console */
import Controller from '@ember/controller';
import { alias, or } from '@ember/object/computed';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { waitFor } from '@ember/test-waiters';
import { tracked } from '@glimmer/tracking';
import { all, restartableTask, task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { QueryHasManyResult } from 'ember-osf-web/models/osf-model';
import Registration, { RegistrationReviewStates } from 'ember-osf-web/models/registration';

import { A } from '@ember/array';
import Institution from 'ember-osf-web/models/institution';
import User from 'ember-osf-web/models/user';
import CurrentUserService from 'ember-osf-web/services/current-user';
import { typeOf } from '@ember/utils';

// const usersListConfig = [
//     {
//         id: 10,
//         fullname: "Researcher A",
//         locationKey: "Charlottesville", // for Policy

//     },
// ];

export class JSHTMLElement {
    static HTML = new JSHTMLElement('<html>');
    static DIV = new JSHTMLElement('<div>');
    static BODY = new JSHTMLElement('<body>');
    static PARA = new JSHTMLElement('<p>');
    static TEXT = new JSHTMLElement('');
    static END_HTML = new JSHTMLElement('</html>');
    static END_DIV = new JSHTMLElement('</div>');
    static END_BODY = new JSHTMLElement('</body>');
    static END_PARA = new JSHTMLElement('</p>');

    constructor(name: string) {
        console.log(name);
        // this.name = name;
    }
    toString() {
        return `JSHTMLElement name.${name}`;
    }
}

export default class ZīliàoController extends Controller {
    @service currentUser!: CurrentUserService;

    @tracked newDescription?: string;
    @tracked originalDescription?: string;
    @tracked favoritedItems?: any[];
    @tracked likedItems?: any[];
    @tracked dislikedItems?: any[];
    @tracked noshow?: any[]; // filtered out items, text, and profiles based on default and added tagged filters
    @tracked compassJSON?: {};

    @tracked registrationsFeed = document.getElementById('rssFeed');

    node?: Node | Registration;
    nodes?: QueryHasManyResult<Node>;
    popular!: QueryHasManyResult<Node>;
    filter!: string | null;
    institutions: Institution[] = A([]);

    isEditing = false;
    rssRegistrations = [];
    rssSocial = [];
    topRegistration = [];
    groupName = '';

    @alias('currentUser.user') user!: User;
    @or('nodes.length', 'filter', 'findNodes.isRunning') hasNodes!: boolean;

    @restartableTask
    @waitFor
    async setupTask() {
        this.set('filter', null);
        this.originalDescription = 'I am a software developer with a background in Java, Python, and JavaScript.';
        this.newDescription = 'I am a software developer with a background in Java, Python, JavaScript, and Bash.';

        const institutions = this.store.findAll('institution');
        if (institutions) {
            console.log('Institutions are:', institutions);
        }

        // TODO set refresh here
        const registrations = this.store.findAll('registration');
        if (registrations) {
            console.log('Registrations are:', registrations);
        }

        const userGroup = this.user.employment.firstObject;
        console.log('User group (employment):', userGroup);
        if (userGroup) {
            const groupName = userGroup.institution;
            this.set('groupName', groupName);
        }

        await all([
            institutions,
            registrations,
            userGroup,
            taskFor(this.findBestNodes).perform(),
            // taskFor(this.findBestNodes).perform('registrations meetings profiles'),
            // taskFor(this.createRegistrationsFeed).perform(userFavoritedArray),
            // taskFor(this.linkSocial).perform(),
        ]);
        console.log('Liked items in setup task', this.likedItems);
        console.log('Favorited items in setup task', this.favoritedItems);
        console.log('Compass data in setup task', this.compassJSON);

        // this.set('institutions', institutions.toArray());
        // this.set('registrations', registrations.toArray());
    }

    @restartableTask
    @waitFor
    async findBestNodes() {

        const myHeaders = new Headers();
        const compassData = new Request('./assets/rss/config/compass_model_config.JSON', {
            method: 'GET',
            headers: myHeaders,
            mode: 'cors',
            cache: 'default',
        });

        fetch(compassData).then(response => {
            const responseJSON = response.json();

            // const likedReponses = userLiked.filter(({liked}) => {    <---- ***remember this is here
            //     console.log('liked responses are ');
            // });

            const dataText = JSON.stringify(response); // used to update feed object
            const isTextPresent = dataText.indexOf('guid') !== -1;
            // console.log('Guid regex: ', guidRegex); // for noshow items array
            console.log('Data text after response.json is: ', dataText);
            console.log('is guid found in compass data?', isTextPresent);
            return responseJSON;
        }).then(data => {
            console.log('Data after fetch is', data);
            this.set('compassJSON', data);
            console.log('Set compassJSON is : ', this.compassJSON);
            let message = '';
            let guidValue = '';
            let fullName = '';
            let userDescription = '';
            let earnedBadges = [];
            let userTotalRisk = [];
            let userTotalReputation = [];

            let likedItem: any[] = [];
            let favoritedItem: any[] = [];

            Object.keys(data).forEach(key => {
                // console.log('Key is: ', key);
                // console.log('Data at key: ', data[key]); // 'Bob', 47
                const dataAtKey = data[key];
                const readKey = key;
                const keyString = String(readKey);

                switch(keyString) {
                case 'guid':
                    guidValue = dataAtKey;
                    console.log('Guid is: ', dataAtKey);
                    break;
                case 'fullname':
                    fullName = dataAtKey;
                    console.log('Full name is: ', dataAtKey);
                    break;
                case 'description':
                    userDescription = dataAtKey;
                    console.log('Description is: ', dataAtKey);
                    break;
                // TODO calculate values here
                case 'totalRisk':
                    userTotalRisk = dataAtKey;
                    console.log('User\'s total risk is: ', dataAtKey);
                    break;
                case 'totalReputation':
                    userTotalReputation = dataAtKey;
                    console.log('User\'s total reputation is: ', dataAtKey);
                    break;
                case 'badges':
                    earnedBadges = dataAtKey;
                    console.log('Earned badges are: ', dataAtKey);
                    break;
                case 'favorited':
                    favoritedItem = dataAtKey;
                    this.set('favoritedItems', favoritedItem);
                    break;
                case 'liked':
                    likedItem = dataAtKey;
                    // userLikedArray.push(likedItem);
                    this.set('likedItems', likedItem);
                    console.log('likedItem in switch is:', likedItem);
                    break;
                case 'disliked':
                    // dislikedItem = dataAtKey;
                    console.log('Disliked items are:', dataAtKey);
                    break;
                default:
                    message = 'No content to display.';
                    console.log('No other elements to parse.', message);
                    break;
                }
            });
            const userLikedArray: any[] = [];
            const userFavoritedArray: any[] = [];
            console.log('User guid outside switch: ', guidValue);
            console.log('User liked array outside switch: ', userLikedArray);
            console.log('Favorited item array outside switch: ', userFavoritedArray);

            if (favoritedItem) {
                Object.entries(favoritedItem).forEach(item => {
                    const favoriteItemObject = item.lastObject;
                    userFavoritedArray.push(favoriteItemObject);
                    console.log('iteration of liked item', item);
                    console.log('favoriteItemObject in userFavoritedArray creation: ', favoriteItemObject);
                });
                console.log('favorited item array after iteration in switch', userFavoritedArray);
            }

            if (likedItem) {
                Object.entries(likedItem).forEach(item => {
                    const likedItemObject = item.lastObject;
                    userLikedArray.push(likedItemObject);
                    console.log('iteration of liked item in for each in switch', item);
                    console.log('favoriteItemObject in userFavoritedArray creation: ', likedItemObject);
                });
                console.log('userLikedArray in switch:', userLikedArray);
            }
            console.log('favoritedItems tracked after switch: ', this.favoritedItems);
            console.log('data after switch before favorite items set', data);
            taskFor(this.createRegistrationsFeed).perform(userLikedArray, userFavoritedArray);
        });
    }

    @task
    @waitFor
    async createRegistrationsFeed(userLikedArray: any[], userFavoritedArray: any[]) {

        let guidRegex;
        let state: string;
        let title: string;
        let dateCreated: Date;
        let lastModified: Date;
        let contributors: [];
        let description : string;
        let type: string; // TODO make as enum
        let status: {};
        let ranking: number;
        let message = '';

        let innerKeyId = '';
        const userLiked = this.likedItems;
        // const favoritedGuidArray = userFavoritedArray;

        // concat arrays for liked and favorited, remove duplicated, sort by ranking
        // add clicker that increments and decrements likes, write to local storage
        if (userLiked) {
            console.log('Inside create registration feed fxn with items:', userLiked);
            console.log('userLikedArray as parameter in createRegistrationsFeed', userLikedArray);
            console.log('userFavoritedArray as parameter in createRegistrationsFeed', userFavoritedArray);
            userLiked.forEach(item => {
                Object.keys(item).forEach(key => {
                    console.log('Key in createLikedFeed is:', key);
                    const dataAtKey = item[key];

                    switch(key) {
                    case 'guid':
                        guidRegex = dataAtKey;
                        console.log('Guid regex new assignment is: ', guidRegex);
                        Object.keys(dataAtKey).forEach(guidKey => {
                            const innerKey = guidKey;
                            const innerDataAtKey = dataAtKey[guidKey];
                            // const innerDataAtKey = <T extends object, U extends keyof T>(testKey: U) => (newTestObj: T) => newTestObj[testKey];
                            console.log('Inner Key in guid JSON is:', innerKey);
                            console.log('Inner data at Key in guid JSON is:', innerDataAtKey);

                            switch (guidKey) {
                            case 'id':
                                innerKeyId = innerDataAtKey;
                                console.log('Type of innerKeyID:', typeOf(innerKeyId));
                                // userLikedItems.push(item);
                                // console.log('userLikedItems array after push', userLikedItems);
                                console.log('ID liked item innerDataAtKey:', innerDataAtKey);
                                console.log('ID liked item variable innerKeyId: ', innerKeyId);
                                break;
                            case 'state':
                                state = innerDataAtKey;
                                console.log('State of liked item:', innerDataAtKey);
                                console.log('Item state: ', state);
                                break;
                            case 'title':
                                title = innerDataAtKey;
                                console.log('Title of liked item:', innerDataAtKey);
                                console.log('Title of liked item: ', title);
                                break;
                            case 'dateCreated':
                                dateCreated = innerDataAtKey;
                                console.log('Date created of liked item:', innerDataAtKey);
                                console.log('Date created liked item variable: ', dateCreated);
                                break;
                            case 'lastModified':
                                lastModified = innerDataAtKey;
                                console.log('Date modified of liked item:', innerDataAtKey);
                                console.log('Date modified item variable: ', lastModified);
                                break;
                            case 'contributors':
                                contributors = innerDataAtKey;
                                console.log('Contributors to liked item:', innerDataAtKey);
                                console.log('Contributor item variable: ', contributors);
                                break;
                            case 'description':
                                description = innerDataAtKey;
                                console.log('Description of liked item:', innerDataAtKey);
                                console.log('Description of item variable: ', description);
                                // use for testing prohibited noshow stirngs
                                break;
                            default:
                                break;
                            }
                        });
                        break;
                    case 'type':
                        type = dataAtKey;
                        console.log('Item type is: ', dataAtKey);
                        break;
                    case 'status':
                        status = dataAtKey;
                        console.log('Current status is : ', dataAtKey);
                        break;
                    case 'ranking':
                        ranking = dataAtKey;
                        console.log('Item rank is: ', dataAtKey);
                        break;
                    default:
                        message = 'No content to display.';
                        console.log('No other elements to parse', message);
                        break;
                    }
                });

                // TODO update to a for each for liked items
                console.log('innerKeyId before RSS card construct', innerKeyId);
                // const method = 'action this.toggleFavorited';
                // const method = '@onClick={{action this.toggleFavorited}}';
                // const buttonText = '<div>' + '<FaIcon @icon="fa-regular fa-heart" />' + '</div>';
                const likeButton = '<link rel="icon" type="image/ico" src="/assets/images/new-profile/like.svg" alt="like icon">';
                const dislikeButton = '<link rel="icon" type="image/ico" src="/assets/images/new-profile/dislike.svg" alt="dislike icon">';
                const favoriteButton = '<link rel="icon" type="image/ico" src="/assets/images/new-profile/heart-regular.svg" alt="favorite icon">';
                // const buttonText = '<p>Heart</p>';
                let cardID = innerKeyId;

                const rssCard = '<div class="card" local-class="RegistrationCard">' +
                '<dl data-test-rss-card>' + '<dt>' + title + '</dt>' +
                '<dd data-test-contributors>' + contributors + '</dd>' + '<br />' +
                '<dd data-test-date-created>' + dateCreated + '</dd>' + '<br />' +
                '<dd data-test-last-modified>' + lastModified + '</dd>' + '<br />' +
                '<dd data-test-description>' + description + '</dd>' + '</dl>' +
                '<div id="totalCount">' + '</div>' +
                '<div class="like-btn" style="width:50px; height: 50px; border: 1px solid #000;">' + likeButton + '</div>' +
                '<div class="dislike-btn" style="width:50px; height: 50px; border: 1px solid #000;">' + dislikeButton + '</div>' +
                '<div class="favorite-btn" style="width:50px; height: 50px; border: 1px solid #000;">' + favoriteButton + '</div>' +
                '<div class="hidden" data-test-description>' + cardID + '</div>' + '</div>';

                console.log('RSS card is: ', rssCard);

                if (this.registrationsFeed) {
                    this.registrationsFeed.insertAdjacentHTML('beforeend', rssCard);
                    console.log('current registration feed: ', this.registrationsFeed);
                }
            });

            // TODO partition algorithm for likes, dislikes and favorites
            if (this.registrationsFeed !== null) {
                const rssCards = this.registrationsFeed.querySelectorAll('div.card');
                let favoritedIDs = []; // TODO update from Object
                let favoriteIcons: NodeListOf<HTMLDivElement> = this.registrationsFeed.querySelectorAll('div.favorite-btn');
                // const userFavoritedItems = userFavoritedArray; // tracked
                console.log('total rss cards:', rssCards.length);
                console.log('total favorite buttons: ', favoriteIcons.length);
                for (let i=0; i < rssCards.length; i++) {
                    const currentCard = rssCards[i].lastChild;
                    let isFavorited;
                    if (currentCard) {
                        const elementsID = currentCard.textContent;
                        console.log('rss card elementsID in rss.length for loop', elementsID);

                        if (elementsID) {
                            favoritedIDs.push(elementsID);
                            console.log('favoritedIDs inside event listener: ', elementsID);
                        }

                        // rssCards[i].addEventListener('click', e => {

                        favoriteIcons[i].addEventListener('click', e => {
                            // console.log('favoritedGuidArray inside event listener: ', favoritedGuidArray);

                            if (rssCards[i].classList.contains('favorited-item')) {
                                isFavorited = true;
                            } else {
                                isFavorited = false;
                            }

                            if (userFavoritedArray) {
                                let guidFavorite = {};
                                console.log('userFavoritedItems:', userFavoritedArray);

                                const userFavoritedValues = Object.values(userFavoritedArray);
                                console.log('userFavoritedValues: ', userFavoritedValues);

                                userFavoritedValues.forEach(entry => {
                                    const dataAtKey = entry;
                                    console.log('data entry at key in newSetFavoriteValues', dataAtKey);

                                    const filteredKeys = Object.values(Object.fromEntries(Object.entries(dataAtKey).filter(([key]) => key.includes('id'))));
                                    console.log('filteredKeys', filteredKeys);

                                    if (filteredKeys)  {
                                        const filteredKeys2 = Object.values(filteredKeys);
                                        console.log('filteredKeys2: ', filteredKeys2);
                                        const id = filteredKeys.firstObject;
                                        console.log('id in filteredKeys:', id);
                                        const guidID2a = id['id'];
                                        console.log('guidId2a ', guidID2a);
                                        const filteredKeyGuidValue = guidID2a;

                                        console.log('rss card guid id is' + elementsID + 'and the current favorited key guid value is' + filteredKeyGuidValue);
                                        // console.log('favoritedGuidArray before push', favoritedGuidArray);
                                        console.log('String rss card guid id is' + String(elementsID) + 'and the String current favorited key guid value is' + String(filteredKeyGuidValue));
                                        const filteredKeyGuidValueStr = String(filteredKeyGuidValue);
                                        typeOf(filteredKeyGuidValueStr);
                                        const elementsIDStr = String(elementsID);
                                        typeOf(elementsIDStr);
                                        if (filteredKeyGuidValueStr == elementsIDStr) {
                                            isFavorited = false; // TODO update to addFavorite
                                            console.log('match found');
                                        } else {
                                            isFavorited = true;
                                            console.log('match not found');
                                            guidFavorite = dataAtKey;
                                            console.log('guid item to push before userFavoritedArray', dataAtKey);
                                        }
                                    }
                                });

                                const cls = ["card", "favorited-item"];

                                console.log('isFavorited after loop:', isFavorited);
                                const rssCardsClassList = rssCards[i].classList;
                                console.log('rssCards[i] class list ', rssCardsClassList);

                                if (isFavorited === true) {
                                    let classList = rssCards[i].classList;
                                    let isCurrentFavorite = classList.contains('favorite-item');
                                    if (!isCurrentFavorite) {
                                        rssCards[i].classList.add('favorited-item');
                                        console.log('rssCard[i] with favorited-item', rssCards[i]);
                                        favoriteIcons[i].style.backgroundColor='#cd5c5c';
                                        favoriteIcons[i].style.color='#fff';
                                        console.log('before update userFavoritedArray', userFavoritedArray);
                                        userFavoritedArray.push(guidFavorite); // this.favoritedItems
                                        userFavoritedArray = [... new Set(userFavoritedArray)];
                                        console.log('updated userFavoritedArray with Set', userFavoritedArray);
                                    }
                                } else if (isFavorited === false) {
                                    rssCards[i].classList.remove('card', 'favorited-item');
                                    rssCards[i].classList.add('card');
                                    console.log('rssCard[i] without favorited-item', rssCards[i]);
                                    favoriteIcons[i].style.backgroundColor='#fff';
                                    favoriteIcons[i].style.color='#000';
                                    // delete dataAtKey;
                                } else {
                                    alert('something else occured');
                                }

                                const rssCardsClassListToggle = rssCards[i].classList;
                                console.log('rssCards[i] class list ', rssCardsClassListToggle);
                                // favoritedCardID = [];
                                // console.log('favoritedCardID in favorited-item', favoritedCardID);
                                const setFavorites = JSON.stringify(userFavoritedArray);
                                // userFavoritedArray = setFavorites;
                                this.set('favoritedItems', setFavorites);
                                console.log('favorited items after Set: ' , this.favoritedItems);
                            }
                    });
                }
            }
        }

    }
}

    @action
    updateFeed(...args: any[]) {
        // taskFor(this.createRegistrationsFeed).perform(this.likedItems, this.favoritedItems);
        console.log('inside updateFeed() fxn');
    }

    @action
    getTrending() {
        console.log('inside getTrending() fnx');
    }

    @action
    increaseLikes() {
        let count = 0;
        const increaseLikeButton = document.getElementById('likeButton');
        const decreaseLikeButton = document.getElementById('dislikeButton');
        const totalCount = document.getElementById('totalCount');

        if (totalCount) {
            const countStr = String(count);
            const handleIncrement = () => {
                count++;
                totalCount.innerHTML = countStr;
            };

            const handleDecrement = () => {
                count++;
                totalCount.innerHTML = countStr;
            };

            console.log('current likes', count);
            if (increaseLikeButton && decreaseLikeButton) {
                increaseLikeButton.addEventListener("click", handleIncrement);
                decreaseLikeButton.addEventListener("click", handleDecrement);
            }
        }
    }

    @action
    editDescription() {
        this.toggleProperty('isEditing');
    }

    @action
    updateDescription() {
        console.log('Inside updateDescrition() fxn');
    }
}
