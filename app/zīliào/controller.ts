/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/quotes */
/* eslint-disable no-console */
import Controller from '@ember/controller';
import { alias, or } from '@ember/object/computed';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { waitFor } from '@ember/test-waiters';
import { tracked } from '@glimmer/tracking';
import { all, restartableTask } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { QueryHasManyResult } from 'ember-osf-web/models/osf-model';
import Registration, { RegistrationReviewStates } from 'ember-osf-web/models/registration';

import { A } from '@ember/array';
import Institution from 'ember-osf-web/models/institution';
import User from 'ember-osf-web/models/user';
import CurrentUserService from 'ember-osf-web/services/current-user';

// const usersListConfig = [
//     {
//         id: 10,
//         fullname: "Researcher A",
//         locationKey: "Charlottesville", // for Policy

//     },
// ];

class JSHTMLElement {
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
    // @tracked isFavorited = false;
    @tracked favoritedItems?: [];
    @tracked likedItems!: [];
    @tracked dislikedItems?: [];
    @tracked noshow?: []; // filtered out items, text, and profiles (to include options for profanity, etc if enabled)

    node?: Node | Registration;
    nodes?: QueryHasManyResult<Node>;
    popular!: QueryHasManyResult<Node>;
    filter!: string | null;
    // 'failedLoading-noteworthy' = false;
    // 'failedLoading-popular' = false;
    isUserEditing = false;
    descriptionEditMode = false;

    institutions: Institution[] = A([]);
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
        console.log('Institutions are:', institutions);

        const userGroup = this.user.employment.firstObject;
        console.log('User group (employment):', userGroup);
        if (userGroup) {
            const groupName = userGroup.institution;
            console.log('Group name is:', groupName);
            this.set('groupName', groupName);
        }

        await all([
            institutions,
            userGroup,
            taskFor(this.findBestNodes).perform(), // taskFor(this.findBestNodes).perform(likedRegistrations, 'liked),
            // taskFor(this.createLikedFeed).perform(),
        ]);
        console.log('Liked items in setup task', this.likedItems);
        // this.set('likedRegistrations', likedRegistrations.toArray());
        // this.set('institutions', institutions.toArray());
    }

    @restartableTask
    @waitFor
    async findBestNodes() {
        // retrieve all registrations
        const registrations = this.store.findAll('registration');
        if (registrations) {
            console.log('Registrations are:', registrations);

            fetch('./assets/rss/config/compass_model_config.JSON')
                .then(response => {
                    const responseJSON = response.json();
                    // const registrationsOnly = JSON.parse(response).filter(({liked}) => {
                    console.log('Response in response is: ', response);
                    console.log('Response JSON in response is:', responseJSON);
                    return responseJSON;
                })
                .then(data => {
                    Object.keys(data).forEach(key => {
                        // console.log('Key is: ', key);
                        // console.log('Data at key: ', data[key]); // 'Bob', 47
                        let message = '';
                        let likedItem = [];
                        let favoritedItem = [];
                        const dataAtKey = data[key];
                        const readKey = key;
                        const keyString = String(readKey);
                        // console.log('Key string is: ', keyString);
                        // console.log(dataAtKey);

                        switch(keyString) {
                        case 'guid':
                            // const guid = dataKey;
                            console.log('Guid is: ', dataAtKey);
                            break;
                        case 'fullname':
                            // const fullname = dataAtKey;
                            console.log('Full name is: ', dataAtKey);
                            break;
                        case 'description':
                            // const description = dataAtKey;
                            console.log('Description is: ', dataAtKey);
                            break;
                        case 'totalRisk':
                            // const totalRisk = dataAtKey;
                            console.log('User\'s total is: ', dataAtKey);
                            break;
                        case 'totalReputation':
                            // const totalReputation = dataAtKey;
                            console.log('User\'s total reputation is: ', dataAtKey);
                            break;
                        case 'badges':
                            // const badges = dataAtKey;
                            console.log('Earned badges are: ', dataAtKey);
                            break;
                        case 'favorited':
                            // const favorited = dataAtKey;
                            favoritedItem = dataAtKey;
                            this.set('favoritedItems', favoritedItem);
                            console.log('Favorited  is:', dataAtKey);
                            break;
                        // add filter for type to later include Preprints, Collections, Meetings, and Profiles
                        case 'liked':
                            likedItem = dataAtKey;
                            this.set('likedItems', likedItem);
                            console.log('Liked items are:', dataAtKey);
                            break;
                        case 'disliked':
                            // const disliked = dataAtKey;
                            console.log('Disliked items are:', dataAtKey);
                            break;
                        default:
                            message = 'No content to display.';
                            console.log('No other elements to parse', message);
                            break;
                        }
                    });
                    this.createLikedFeed(data);
                    return data;
                });
            // add a default statement that returns current ranked registrations
            // regardless of user compass model
            // const dataAtKey = data[key];
            // console.log('dataAtKey is ', dataAtKey);
            // const nestedValue = dataAtKey.forEach(entry => {
            //     console.log('Nested entry is:', entry);
            //     Object.keys(entry).find(key => entry[key] === "liked");
            //     console.log('Nested value is:', nestedValue);

            // console.log('Data is:', data);
            // const dataKeys = Object.keys(data);
            // console.log('Data keys are:', dataKeys);
            // const dataValues = Object.values(data);
            // console.log('Data values are:', dataValues);
            // const dataEntries = Object.entries(data);
            // console.log('Data entries are:', dataEntries);

            // const cardTitle = document.createTextNode(`${guidTitle}`);
            // // feedItem.setAttribute("node", "node");
            // // feedItem.setClass("btn btn-primary");
            // feedItem.append(cardTitle);
            // const feedDiv = document.getElementById('rssFeed');
            // if (feedDiv) {
            //     feedDiv.appendChild(feedItem);
            //     const lineBreak = document.createElement('br');
            //     feedDiv.appendChild(lineBreak);
            // }

            // retrieve ranking of each registration remaining

            // sort list of ranked registrations in descending order

            // return lists of Registrations and push to feed
            /**
             * Algorithm for top OSF registration
             * Receive registrations from database
             * Match against User's compass model
             * Remove items noshows based on filters set by user
             * Retrieve Registrations matching interest
             * Sort by descending order for rank
             * Retrieve and push top Registration to div
             */
            // sort by ascending order for rank
            // retrieve top registration for user
            // push to OSF Registrations slide
            // const topRegistration = this.liked.firstObject;
            // const registrationSlideDiv = document.getElementById('myRegistrations');
            // if (registrationSlideDiv && topRegistration) {
            //     const registrationName = this.liked["guid"]["title"];
            //     registrationSlideDiv.appendChild(registrationName);

            // }
            // console.log('Top Registration for Slide:', topRegistration);

            // remove noshows for user

            // retrieve ranking of each registration remaining (raw score will be converted to bandwidths
            // of what constitutes a recommended item. bandwidths will constitute a pool that will be randomly
            // selected from upon each user log in to show fresh data to the user )

            // sort list of ranked registrations in descending order
        }

    }

    @action
    createLikedFeed(data: any) {
        const registrationsFeed = document.getElementById('rssFeed');
        let message = '';
        let id: String;
        let state: String;
        let title: String;
        let dateCreated: Date;
        let lastModified: Date;
        let contributors: [];
        let description : string;
        let newObject: {};
        console.log('Inside create liked feed fxn.');
        this.likedItems.forEach(item => {
            console.log('Element in liked item feed:', item);
            const innerItem = item;
            Object.keys(item).forEach(key => {
                console.log('Key in createLikedFeed is:', key);
                const keyString = String(key);
                const dataAtKey = item[key];
                // const newObject = dataAtKey;

                switch(keyString) {
                case 'guid':
                    // const guid = dataKey;
                    console.log('Guid is: ', dataAtKey);
                    newObject = dataAtKey;
                    Object.keys(newObject).forEach(guidKey => {
                        const innerKey = String(guidKey);
                        const innerDataAtKey = newObject[guidKey];
                        console.log('Inner Key in guid JSON is:', innerKey);
                        console.log('Inner data at Key in guid JSON is:', innerDataAtKey);

                        switch (innerKey) {
                        case 'id':
                            id = String(innerDataAtKey);
                            console.log('ID liked item:', innerDataAtKey);
                            console.log('ID liked item variable: ', id);
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
                            break;
                        default:
                            break;
                        }
                    });
                    break;
                case 'type':
                    console.log('Item type is: ', dataAtKey);
                    break;
                case 'status':
                    console.log('Current status is : ', dataAtKey);
                    break;
                case 'ranking':
                    console.log('Item rank is: ', dataAtKey);
                    break;
                default:
                    message = 'No content to display.';
                    console.log('No other elements to parse', message);
                    break;
                }
            });
            if (registrationsFeed) {
                const rssCard = '<li local-class="table-item">' + '<table>' +
                    '<tr>' + '<td>' + title + '</td>' + '</tr>' +
                    '<tr>' + '<td>' + contributors + '</td>' + '</tr>' +
                    '<tr>' + '<td>' + dateCreated + '</td>' + '</tr>' +
                    '<tr>' + '<td>' + lastModified + '</td>' + '</tr>' +
                    '<tr>' + '<td>' + description + '</td>' + '</tr>' +
                    '</table>' + '</li>';
                registrationsFeed.insertAdjacentHTML('afterend', rssCard);
            }
        });
    }

    @action
    toggleFavorited() {
        this.toggleProperty('favoritedItems');
    }

    @action
    async getTrending() {
        console.log('inside getTrendingFnx');
    }

    @action
    editDescription() {
        this.toggleProperty('descriptionEditMode');
    }

    @action
    updateDescription() {
        console.log('Inside update descrition fxn');
    }
}
