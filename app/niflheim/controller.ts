/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Controller from '@ember/controller';
import { action } from '@ember/object';
import RouterService from '@ember/routing/router-service';
import { inject as service } from '@ember/service';
import { waitFor } from '@ember/test-waiters';

import { tracked } from '@glimmer/tracking';

import { restartableTask } from 'ember-concurrency';
import Intl from 'ember-intl/services/intl';
import Toast from 'ember-toastr/services/toast';
import { Session } from 'ember-simple-auth/services/session';

import RegistrationModel from 'ember-osf-web/models/registration';
import CurrentUser from 'ember-osf-web/services/current-user';

import config from 'ember-get-config';

import { resolve } from 'rsvp';

export const { OSF: { apiUrl, apiVersion } } = config;

export enum securityLevel {
    LOW = 'low',
    MEDIUM = 'medium',                                          // default neutral value
    HIGH = 'high',                                              // devops notification
    CRITICAL = 'critical',
}

export enum userType {
    UNREGISTERED_USER = '1',
    EXTERNAL_NONADMIN = '2',
    EXTERNAL_ADMIN = '3',                                       // project admins and mods
    INTERNAL_NONADMIN = '4',
    INTERNAL_ADMIN = '5',                                       // OSF admins and mods
}

export enum ProjectSelectState {
    main = 'main',
    newProject = 'newProject',
    newProjectSelected = 'newProjectSelected',
    existingProject = 'existingProject',
}

const apiHeaders = [
    'Accept-Encoding',
    'Accept-Language',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Age',
    'Allow',
    'Authorization',
    'Cache-Control',
    'Clear-Site-Data',
    'Connection',
    'Content-Encoding',
    'Content-Length',
    'Content-Type',
    'Expect',
    'Expires',
    'From',
    'Host',
    'If-Modified-Since',
    'Keep-Alive',
    'Location',
    'Proxy-Authenticate',
    'Proxy-Authorization',
    'Origin',
    'Pragma',
    'Sec-CH-UA-Bitness',
    'Sec-CH-UA-Arch',
    'Sec-CH-UA-Model',
    'Sec-CH-UA-Mobile',
    'Referer',
    'User-Agent',
    'Viewport-Width',
    'Warning',
];

const hexColorCodes: string[][] = [
    ['#ccff00', 'Electric Lime'],
    ['#1034a6', 'Egyptian Blue'],
    ['#bf00ff', 'Electric Purple'],
    ['#483d8b', 'Dark Slate Blue'],
    ['#00ffff', 'Cyan1'],
    ['#6f006f', 'Electric Indigo'],
    ['#9d2933','Japanese Carmine'],
    ['#0a7e8c', 'Metallic Seaweed'],
    ['#9900ffff', 'Cherry Red'],
    ['#bf3eff', 'Dark Orchid'],
    ['#0700C4','Blue 1'],
    ['#0000FF','Blue 2'],
    ['#0052FF','Blue 3'],
    ['#007AFF','Blue 4'],
    ['#00A3FF','Blue 5'],
    ['#00CCFF','Blue 6'],
];

export const interceptorStatus: { 1: string, 2: string, 3: string } = {
    1: 'inactive',
    2: 'active',
    3: 'quiet-mode',
};

const internalStatusCodes: { interim: string, withdrawn: string, complete: string } = {
    interim: 'in-progress',
    withdrawn: 'withdrawn',
    complete: 'complete',
};

/*
 * lmhValues are whole integer threshold values for calculated
 * risk. + actions and reputation lowers the total value over time.
 * Session risk cannot be decremented, only increased.
 * Any banned user also raises their overall group's score
 * with notifications sent to their moderator or administrator.
 * Risk values are calculated with floating point decimals where 0.0 -
 * 15.0 (floor/ceiling) numbers are rounded to whole integer values.
 * When lmh threshold values are met, that risk level is
 * assigned to the profile.
 */
const lmhValues = {
    low: 1,
    medium: 3,
    high: 5,
    warning: 10,                                                                    // user is warned
    critical: 15,                                                                   // user is banned
};

const statusCodes = {
    e400 : [400, 'Bad Request', 'Medium'],
    e401 : [401, 'Unauthorized', 'High'],
    e402 : [402, 'Payment Required', 'None'],
    e403 : [403, 'Forbidden', 'High'],
    e404 : [404, 'Not Found', 'Low'],
    e405 : [405, 'Method Not Allowed', 'Medium'],
    e408 : [408, 'Request Timeout', 'Low'],
    e412 : [412, 'Precondition failed', 'Medium'],
    e414 : [414, 'URI Too Long', 'High'],                                           // exploit, spam
    e415 : [415, 'Unsupported Media Type', 'Low'],
    e423 : [423, 'Locked', 'High'],                                                 // embargoed registratons
    e424 : [424, 'Failed Dependency', 'None'],
    e425 : [425, 'Too Early', 'None'],
    e429 : [429, 'Too Many Requests', 'High'],
    e431 : [431, 'Request Header Fields Too Large', 'High'],
    e451 : [451, 'Unavailable for Legal Reasons', 'Medium'],
    e500 : [500, 'Internal Server Error', 'None'],
};

// AppMapp and AppMapData to create the UI dashboard
interface AppMap {
    guid: string | undefined | null;
    repository: string | undefined;
    repositoryLink: string | undefined;
    responseURL: string | undefined;                                  // response URL, current environment
    requestsURL: string | undefined;
    route: string | 'niflheim';
    subroute: string | undefined | null;
    stats: {} | undefined;
    tiles: AppMapData[] | any[];
}

interface AppMapData {
    childElement: number | undefined;
    class: string[] | null | undefined;
    dataTest: string | null | undefined;
    elementData: [string | null | undefined, string | null | undefined];
    elementType: string | undefined;
    elementText: string | undefined;
    eventType: InputEvent | MouseEvent | KeyboardEvent | string | undefined;
    isDev: boolean | undefined;
    name: string | null | undefined;
    parentElement: HTMLElement | undefined;
}

// Shiva.io module data
export const _SampleAppMap = {
    guid: 'pg5s5',
    repository: 'ember-osf-web',
    repositoryLink: 'https://github.com/CenterForOpenScience/ember-osf-web',
    responseURL: 'http://localhost:4114/niflheim/log4j',                            // response URL, Ifrit.io server
    requestsURL: 'http://localhost:4114/niflheim',                                  // request URL, current environment
    route: 'guid-file',
    subroute: 'index',
    stats: {                                                                        // filterable by time
        sessionRequests: {
            get: 219,
            post: 317,
            put: 34,
            patch: 4,
            option: 10,
            head: 7,
            trace: 10,
            other: 15,
            badRequest: 48,
        },
    },
    tiles: [],
};

export const _SampleUserProfile = {
    UserData: {
        guid: '123az',
        emailModel: {
            isConfirmed: true,
            emailAddresses: ['employee@cos.io',
                'employee@privateDomain.us'],
        },
        sessionReputation: 8,
        sessionRisk: 2,
        totalReputation: 9,
        totalRisk: 2,
    },
    GroupData: {
        guid: '321za',
        sessionReputation: 9,
        sessionRisk: 2,
        groupReputation: 9,
        groupRisk: 2,
    },
    Stats: {
        // cleared after 5 min
        sessionRequests: {
            get: 19,
            post: 17,
            put: 4,
            patch: 1,
            option: 0,
            head: 0,
            trace: 0,
            other: 0,
            badRequest: 0,
            userStoriesInitiated: {
                createRegistration: 1,
            },
            userStoriesCompleted: ['createRegistration', 'createRevisionRegistration'],
        },
        // cleared monthly
        totalRequests: {
            get: 51,
            post: 71,
            put: 14,
            patch: 2,
            option: 0,
            head: 0,
            trace: 0,
            other: 0,
            badRequest: 0,
            userStoriesComplete: ['createRegistration', 'revisionOnRegistration', 'comment'],
            userStoriesIncomplete: ['createRegistration'],
        },
    },
    Summary: {
        sessionEscalations: [[1, statusCodes.e404], 1],                             // number, sum
        totalEscalations: [[[3, statusCodes.e404], [1, statusCodes.e403]], 8],      // number, sum
    },
};

// class selector, data test selector, isDev element
export const _SampleElementData = ['SlideButtons', 'data-test-versions-button', true];

// Ifrit.io return value per element
export const _SampleElementCode = {
    HBS:
        [
            [
                `<BsButton\n
                    aria-label={{if this.revisionsOpened (t 'file_detail.close_revisions') (t file_detail.view_revisions')}}\n
                    data-test-versions-button\n
                    data-analytics-name='Versions button'\n
                    local-class='SlideButtons {{if this.revisionsOpened 'Active'}}'\n
                    @size='lg'\n
                    @onClick={{this.toggleRevisions}}\n
                >`,
                'ember-osf-web/app/guid-file/template.hbs',
                85,
            ],
        ],
    SCSS:
        [
            [
                `.SlideButtons {\n
                margin: 20px 20px 0;\n
                border: 0;\n
                color: $color-link-dark;\n
                background-color: $color-bg-white;\n
                \n    
                @media (max-width: 767px) {\n
                    margin: 0;\n
                }\n
                \n
                &.Active {\n
                    @media (max-width: 767px) {\n
                        background-color: $color-bg-white;\n
                        color: $color-bg-black; ...`,
                'ember-osf-web/app/guid-file/styles.scss',
                40,
            ],
        ],
    TS: [],
    JS: [],
    ROUTES: [],
    TILES: [],
    NAMES: [
        'versionsButton',
        'VersionsButton',
        'versions-button',
        'versions_button',
    ],
};

export default class Niflheim extends Controller {
    @service currentUser!: CurrentUser;
    @service intl!: Intl;
    @service router!: RouterService;
    @service session!: Session;
    @service toast!: Toast;

    @tracked headersApp = apiHeaders;
    @tracked headersTemp?: [];
    @tracked statusCodesApp = statusCodes;
    @tracked statusCodesTemp?: [];

    codeAnalyzedGuid = _SampleAppMap.guid;
    codeAnalyzedName = _SampleAppMap.repository;
    codeAnalyzedLink = _SampleAppMap.repositoryLink;
    codeAnalyzedRoute = _SampleAppMap.route;
    codeAnalyzedSubroute = _SampleAppMap.subroute;

    dataCount?: number;
    FEUserID?: string | null | undefined;
    groupReputation?: number;
    groupRisk?: number;
    interceptStatus!: number;
    isModeratorMode!: boolean;
    isSpam?: boolean;
    registration?: RegistrationModel;
    sessionReputation?: number;
    sessionRisk?: number;
    totalReputation?: number;
    totalRisk?: number;
    mapPresent?: boolean;

    feMode: string = interceptorStatus[1];
    isCollapseAllowed = false;
    lastElement: string | null | undefined = null;
    mode: string = 'light';
    shouldCollapse = false;
    threatLevel: securityLevel = securityLevel.LOW;
    toggleTabView: boolean = false;
    appMapData: AppMapData[] = [];

    onLinkClicked?: () => void;

    mapData: AppMap = {
        guid: _SampleAppMap.guid,
        repository: _SampleAppMap.repository,
        repositoryLink: _SampleAppMap.repositoryLink,
        responseURL: _SampleAppMap.responseURL,
        requestsURL: _SampleAppMap.requestsURL,
        route: _SampleAppMap.route,
        subroute: _SampleAppMap.subroute,
        stats: _SampleAppMap.stats,
        tiles: [],
    };

    elements = ['hydrogen', 'helium', 'lithium', 'beryllium', 'boron', 'carbon', 'nitrogen', 'oxygen', 'flourine'];

    itemsAnalyzed = ['Auth', 'Headers', 'Requests', 'Responses', 'Scripts', 'Styles'];

    requestTypes = ['get', 'post', 'put', 'patch', 'head', 'options', 'trace', 'other', 'bad-request'];

    // TODO add route + imports array for routes in app/router.ts

    init() {
        super.init();

        const currentUserId = _SampleUserProfile.UserData.guid;

        if (currentUserId) {
            this.set('FEUserID', currentUserId);
        } else {
            this.returnUserSession(undefined);
        }

        this.set('mapPresent', false);
        this.set('groupReputation', _SampleUserProfile.GroupData.groupReputation);
        this.set('groupRisk', _SampleUserProfile.GroupData.groupRisk);
        this.set('feMode', interceptorStatus[1]);
        this.set('sessionReputation', 1);
        this.set('sessionRisk', 1);
        this.set('totalReputation', _SampleUserProfile.UserData.totalReputation);
        this.set('totalRisk', _SampleUserProfile.UserData.totalRisk);
        this.set('dataCount', 0);

        sessionStorage.setItem('sessionReputation', String(_SampleUserProfile.UserData.sessionReputation));
        sessionStorage.setItem('sessionRisk', String(_SampleUserProfile.UserData.sessionRisk));

        const tabList = document.getElementsByName('linkOutput')[0];
        if (tabList) {
            tabList.click();
        }
    }

    @action
    toggleFunctionality() {
        this.toggleProperty('shouldCollapse');
    }

    @restartableTask
    @waitFor
    async setUpTask() {
        this.addFileListener();
        console.log('Inside setUpTask.');
    }

    getCurrentTime() {
        const date = new Date();
        const epoch = date.getTime();
        const gregorian = new Date(epoch);
        return gregorian;
    }

    isAlpha(str: string) {
        let pattern = /^[a-z]$/i;
        let isAZ = str.match(pattern);
        console.log(isAZ);
        return isAZ;
    }

    // camelCase
    public toCamelCase(str: string[]): string {
        const nadir = str[0].toLowerCase();
        let zenith = '';

        for (let i = 1; i <= (str.length-1); i ++) {
            let upperCased;
            for (let j = 0; j < str[i].length; j++) {
                upperCased = str[i][0].toUpperCase();
                let strRmd = str[i].slice(1);
                upperCased += strRmd;
            }
            zenith += upperCased;
        }
        let name = nadir + zenith;
        return name.toString();
    }

    // kebob-case
    public toKebobCase(str: string[]): string {
        let zenith = '';
        for (let i=0; i < str.length; i++) {
            zenith += str[i].toLowerCase();
            zenith += '\u002d';
        }
        let name = zenith.slice(0, zenith.length - 1);
        return name.toString();
    }

    // PascalCase
    public toPascalCase(str: string[]): string {
        let zenith = '';
        for (let i=0; i < str.length; i ++) {
            let upperCased;
            for (let j = 0 ; j < str[i].length; j++) {
                upperCased = str[i][0].toUpperCase();
                let strRmd = str[i].slice(1);
                upperCased += strRmd;
            }
            zenith += upperCased;
        }
        let name = zenith;
        return name.toString();
    }

    public fromPascalCase(str: string, conversionType: string): string {
        console.log('In fromPascalCase fxn.');
        let name = str;
        switch(conversionType) {
        case 'cc':
            console.log('Converting to camelCase.');
            break;
        case 'kc':

            console.log('Converting to kebob-case.');
            break;
        case 'sc':
            console.log('Converting to snake_case.');
            break;
        default:
            break;
        }
        return name;
    }

    // snake_case
    public toSnakeCase(str: string[]): string {
        let zenith = '';
        for (let i=0; i < str.length; i++) {
            zenith += str[i].toLowerCase();
            zenith += '\u005f';
        }
        let name = zenith.slice(0, zenith.length - 1);
        return name.toString();
    }

    @action
    callElement(element: any): AppMap | void {
        let data: AppMap = {
            guid: _SampleAppMap.guid,
            repository: _SampleAppMap.repository,
            repositoryLink: _SampleAppMap.repositoryLink,
            responseURL: _SampleAppMap.responseURL,
            requestsURL: _SampleAppMap.requestsURL,
            route: _SampleAppMap.route,
            subroute: _SampleAppMap.subroute,
            stats: _SampleAppMap.stats,
            tiles: [],
        };

        switch(element){
        case 'hydrogen':
            this.toast.info('Calling hydrogen.');
            data.tiles[0] = this.processHydrogen();
            break;
        case 'helium':
            this.toast.info('Calling helium.');
            this.processHelium();
            break;
        case 'lithium':
            this.toast.info('Calling lithium.');
            this.processLithium();
            break;
        case 'beryllium':
            this.toast.info('Calling beryllium.');
            this.processBeryllium(this.FEUserID, element);
            break;
        case 'boron':
            this.toast.info('Calling boron.');
            this.processBoron();
            break;
        case 'carbon':
            this.toast.info('Calling carbon.');
            this.processCarbon();
            break;
        case 'nitrogen':
            this.toast.info('Calling nitrogen.');
            this.processNitrogen();
            break;
        case 'oxygen':
            this.toast.info('Calling oxygen.');
            this.processOxygen();
            break;
        case 'flourine':
            this.toast.info('Calling flourine.');
            this.processFlourine();
            break;
        default:
            this.toast.error('ERROR: Element name not recognized. Please try again or reload');
        }
        return data;
    }

    @action
    startUserStory(surfaceArea: HTMLElement, userStory: number) {
        switch(userStory){
        case 0:
            this.userStoryZero(surfaceArea);
            break;
        case 1:
            this.userStoryOne(surfaceArea);
            break;
        default:
            break;
        }
    }

    // select all surface area
    @action
    userStoryZero(surfaceArea: HTMLElement) {
        console.time();
        setTimeout(event => {
            for (let i = 0; i < Math.ceil(Number(surfaceArea.clientWidth)); i++) {
                for (let j= 0; j < Math.ceil(Number(surfaceArea.clientHeight)); j++) {
                    let posX = i;
                    let posY = j;
                    const pixelAt = document.getElementsByName('automatedPixel')[0] as HTMLElement;
                    pixelAt.style.left = String(posX.toString() + 'px');
                    pixelAt.style.top = String(posX.toString() + 'px');
                    this.toast.info(`Analysis target at ${posX} ${posY}`);
                    let analysisItem = document.elementFromPoint(posX, posY) as HTMLElement;
                    if (analysisItem) {
                        analysisItem.focus();
                        analysisItem.click();
                    }
                }
            }
        }, 1000);
        console.timeEnd();
    }

    // select all elements
    @action
    userStoryOne(surfaceArea: HTMLElement) {
        const currentElements = Object.values(surfaceArea.querySelectorAll('*'));
        const autoPixel = document.getElementsByName('automatedPixel')[0] as HTMLElement;

        currentElements.forEach((element: HTMLElement) => {
            autoPixel.style.position = 'absolute';
            autoPixel.style.left = String(element.clientLeft + 'px');
            autoPixel.style.top = String(element.clientTop + 'px');

            try {
                if (!element.tagName.toString().toLowerCase().includes('path')) {
                    element.focus();
                    element.click();
                }
            } catch (e) {
                const elementID = String('#' + element.id);
                const elementName = String(element.tagName + '.' + element.classList[0] + elementID);
                this.toast.error(`Element non-reactive: ${elementName}`);
            }
        });
    }

    @action
    stopUserStory() {
        console.log('User story stopped.');
    }

    // automates user stories
    @action
    startShiva(userStory: number): AppMapData[] {
        const surfaceArea = document.getElementsByName('analyzed-component')[0];

        let pixelCursor = '<div name="automatedPixel" style="position: relative; height: 1px; width: 1px; background-color: #000;  z-index: 999;">' + '@' + '</div>';

        if (surfaceArea) {
            surfaceArea.focus();
            surfaceArea.click();
            surfaceArea.insertAdjacentHTML('afterbegin', pixelCursor);
            surfaceArea.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
            });

            // user story selection
            this.startUserStory(surfaceArea, userStory);
        }
        return this.appMapData;
    }

    @action
    startIfrit(): string[] {
        const newMapTiles = new Set(this.mapData.tiles);
        let ifritTiles: string[] = new Array(4);
        const elementOutput = document.getElementsByName('appMapOutput')[0] as HTMLElement;
        newMapTiles.forEach(((uniqueTile, index) => {
            this.toast.info(`Tile ${index}: ${uniqueTile}`);
            elementOutput.insertAdjacentText('beforeend', uniqueTile);
        }));
        return ifritTiles;
    }

    @action
    processHydrogen(): AppMap | void {
        const analysisArea = document.getElementsByName('analysis-section')[0];
        const osfImages = document.querySelectorAll('img');
        const osfScripts = document.evaluate('/html/body//script', analysisArea, null, XPathResult.ANY_TYPE, null);
        const osfContent = document.head.querySelector('[content]')?.content;
        const osfLinks = document.evaluate('/html/body//a', analysisArea, null, XPathResult.ANY_TYPE, null);
        const linkOutput = document.getElementsByName('linkOutput')[0] as HTMLElement;
        const imageOutput = document.getElementsByName('imageOutput')[0] as HTMLElement;
        const metaOutput = document.getElementsByName('metadataOutput')[0] as HTMLElement;

        const images: string[] = [];
        const metas: string[] = [];
        const links: string[] = [];

        let thisScripts = osfScripts.iterateNext();
        let thisLink = osfLinks.iterateNext();

        while (thisLink) {
            try {
                let linkText =  thisLink.textContent?.trimLeft().trim();
                if (linkText) {
                    links.push(linkText);
                } else {
                    let linkData = thisLink.parentElement?.firstElementChild?.namespaceURI?.toString();
                    if (linkData) {
                        links.push(linkData);
                    }
                }
            } catch (e) {
                this.toast.error('Link element landmarks not found.');
            } finally {
                thisLink = osfLinks.iterateNext();
            }
        }

        while (thisScripts) {
            try {
                let placeholder =  thisScripts.textContent;
                if (placeholder) {
                    metas.push(placeholder);
                } else {
                    let parentDiv = thisScripts.parentElement?.nodeName;
                    parentDiv = 'parent:' + String(parentDiv);
                    metas.push(parentDiv);
                }
            } catch (e) {
                this.toast.error('Input element landmarks not found.');
            } finally {
                thisScripts = osfScripts.iterateNext();
            }
        }

        osfImages.forEach(image => {
            try {
                let imageText =  image.src;
                if (imageText) {
                    images.push((imageText));
                } else {
                    imageText = image.alt;
                    images.push((imageText));
                }
            } catch (e) {
                this.toast.error('Image element landmarks not found.');
            }
        });

        let denserObjects: AppMap = {
            guid: _SampleAppMap.guid,
            repository: _SampleAppMap.repository,
            repositoryLink: _SampleAppMap.repositoryLink,
            responseURL: _SampleAppMap.responseURL,
            requestsURL: _SampleAppMap.requestsURL,
            route: _SampleAppMap.route,
            subroute: _SampleAppMap.subroute,
            stats: _SampleAppMap.stats,
            tiles: [],
        };

        denserObjects.tiles['images'] = images;
        denserObjects.tiles['metas'] = metas;
        denserObjects.tiles['links'] = links;

        links.forEach(link => {
            linkOutput.insertAdjacentText('beforeend', String(link));
            linkOutput.insertAdjacentHTML('beforeend', '<br>');
        });
        images.forEach(image => {
            imageOutput.insertAdjacentText('beforeend', image);
            linkOutput.insertAdjacentHTML('beforeend', '<br>');
        });
        metas.forEach(meta => {
            metaOutput.insertAdjacentText('beforeend', String(meta));
            linkOutput.insertAdjacentHTML('beforeend','<br>');
        });

        linkOutput.insertAdjacentHTML('beforeend','<br>');
        metaOutput.insertAdjacentText('beforeend', 'Meta Content:');
        linkOutput.insertAdjacentHTML('beforeend','<br>');
        metaOutput.insertAdjacentText('beforeend', osfContent);

        return denserObjects;
    }

    @action
    processHelium(): AppMap | void {
        // code here
    }

    @action
    processLithium(): AppMap | void  {
        // code here
    }

    @action
    processBeryllium(): AppMap | void {
        let matchingModules: AppMap  = {
            guid: _SampleAppMap.guid,
            repository: _SampleAppMap.repository,
            repositoryLink: _SampleAppMap.repositoryLink,
            responseURL: _SampleAppMap.responseURL,
            requestsURL: _SampleAppMap.requestsURL,
            route: _SampleAppMap.route,
            subroute: _SampleAppMap.subroute,
            stats: _SampleAppMap.stats,
            tiles: [],
        };
        return matchingModules;
    }

    @action
    processBoron(): AppMap | void {
        // code here
    }

    @action
    processCarbon(): AppMap | void {
        // code here
    }

    @action
    processNitrogen(): AppMap | void {
        // code here
    }

    @action
    processOxygen(): AppMap | void {
        // code here
    }

    @action
    processFlourine(): AppMap | void {
        // code here
    }

    @action
    readFile(event: any) {
        document.querySelectorAll('input[type=file]')[0].addEventListener('change', function handleUpload() {
            const fileReader = new FileReader();
            fileReader.onloadend = function() {
                document.getElementsByName('configFile')[0].textContent = event.target.result;
            };
            let files = event.target?.files[0];
            fileReader.readAsText(files);
        }, true);
    }

    @action
    addFileListener(){
        document.getElementsByName('files[]')[0].addEventListener('change', this.handleFileSelect, true);
    }

    @action
    handleFileSelect(event: any) {
        const reader = new FileReader();
        reader.onload = this.handleFileLoad;
        reader.readAsText(event.target.files[0]);
        document.getElementsByName('configFile')[0].textContent = event.target.result;
    }

    @action
    handleFileLoad(event: any){
        let result = event.target.result.toString();
        let configUpload = document.getElementsByName('configFile')[0];
        configUpload.textContent = result;
    }

    @action
    async returnUserSession(userID: string | null | undefined) {
        const currentUser = this.currentUser;                                       // current user model
        const usr = currentUser.user;                                               // user model
        const url = _SampleAppMap.requestsURL;
        const userIDDiv = document.getElementsByName('currenUserID')[0] as HTMLElement;
        const userSession = this.session;
        let id: any = userID ? userID : currentUser.userID;
        let isConfirmed: boolean = false;
        let isCOS: boolean = false;
        let isMod: boolean = false;
        let userEmail;
        let usrType;
        let emailCOS;

        try {
            if  (usr) {
                isMod = usr.canViewReviews ? true : false;
                userEmail = usr.emails ? usr.emails : _SampleUserProfile.UserData.emailModel;

                if (userEmail) {
                    isConfirmed = userEmail.isConfirmed;
                    userEmail.emailAddresses.forEach((email: any) => {
                        console.log('email is:', email);
                        const domain = /@cos.io/;
                        emailCOS = email.search(domain);
                        this.toast.info(`COS account: is confirmed? ${isConfirmed}, email: ${emailCOS}`);
                    });
                    if (emailCOS && isConfirmed && isMod) {
                        isCOS = true;
                        usrType = userType.INTERNAL_ADMIN;
                    } else if (emailCOS && isConfirmed) {
                        isCOS = true;
                        usrType = userType.INTERNAL_NONADMIN;
                    } else if (isConfirmed && isMod) {
                        isCOS = false;
                        usrType = userType.EXTERNAL_ADMIN;
                    } else if (isConfirmed) {
                        isCOS = false;
                        usrType = userType.EXTERNAL_NONADMIN;
                    } else {
                        usrType = userType.UNREGISTERED_USER;
                    }
                }
            }
        } catch (e) {
            return resolve;
        }

        if (id) {
            this.set('FEUserID', id);
            userIDDiv.textContent =  String(id);
        } else {
            id = '1234';
            this.set('FEUserID', id);
            userIDDiv.textContent = String(id);
            this.toast.info(`No ID for user. Default ID set: ${id}`);
        }

        try {
            console.log(document);
            // await fetch('https://api.osf.io/v2/users/').then(data => {
            //     console.log('v2 fetch data:', data);
            // });

            // await fetch('http://localhost:4200/niflheim').then((response: any) =>{
            //     console.log('headers are:', response.headers.map);
            //     console.log('Response is:', response.ok);
            //     console.log('Status is', response.status);
            //     console.log('Status Code Text is:', response.statusText);
            //     console.log('Response url is: ', response.url);
            // });
        } catch (e) {
            this.toast.error(`URL unretrievable: ${e}`);
        } finally {
            // in debug
            console.log(`Current user is: ${usr}`);
            console.log('Current user id: ', id);
            console.log('Current url is: ', url);
            console.log('Current userSession is: ', userSession);
            console.log('Current userSession session is: ', userSession.session);
            console.log('Current userSession store is: ', userSession.store);
            console.log('Current currentUser cookies is: ', currentUser.cookies);
            console.log('Current currentUser session is: ', currentUser.session);
            console.log('Current currentUser store is: ', currentUser.store);
            console.log('USERTYPE', usrType);
            console.log('ISCOS', isCOS);
            console.log('isConfirmed', isConfirmed);
        }
        // allow updates from other user ids with different activity

        // allow user profile returns based on risk activity

        // have algorithm determine user story by completion points (http PUT vs GET)

        // upload csv where organization of actions falls into one of the categories

        // however many user storeis complete or partial updates an analytics map

        return id;
    }

    @action
    turnOnFE() {
        const allElements = Object.values(document.querySelectorAll('*'));
        const buttons = document.querySelectorAll('button');
        const inputs = document.querySelectorAll('input');
        const links = document.querySelectorAll('link');
        const images = document.querySelectorAll('img');

        allElements.forEach(element => {
            switch(element.tagName) {
            case 'button':
                buttons.forEach(button => {
                    button.addEventListener('click', () => {
                        console.log('buttons accounted for: ', button);
                        // TODO update with headers/request/response
                    }, true);
                });
                break;
            case 'input':
            case 'textarea':
                inputs.forEach(input => {
                    input.addEventListener('click', () => {
                        console.log('inputs accounted for: ', input);
                        // update with text analysis of content
                    }, true);
                });
                break;
            case 'a':
            case 'link':
                links.forEach(link => {
                    link.addEventListener('click', () => {
                        console.log('links accounted for: ', link);
                        // TODO update with route transition handling
                    }, true);
                });
                break;
            case 'image':
                images.forEach(image => {
                    image.addEventListener('click', () => {
                        console.log('images accounted for: ', images);
                        // TODO update with image analysis
                    }, true);
                });
                break;
            default:
                console.log('Unrecognizable element passed.');
                break;
            }
        });
    }

    @action
    viewRoute(transition: string) {
        let route = 'registries.overview.index';
        this.toast.info(`Transistioning to: ${transition} from: ${route}`);
        this.router.transitionTo(route);
    }

    @action
    protectKitten(value: AppMapData) {
        console.log('value in protectKitten()', value);
        const dataTest = value.elementData[1] || null;
        const elementType = value.elementType?.toUpperCase() || undefined;
        const elementText = value.elementText?.slice(0, 256).toString() || undefined;
        const elementClass = value.class || null || undefined;
        const numOfChildren = value.childElement || null || undefined;
        const parentElement = value.parentElement || null || undefined;
        const elementName = value.name || undefined;
        let boxColor: string = 'inherit';
        let parentElementType: string | undefined;

        const output = document.getElementsByName('appMapOutput')[0] as HTMLElement;

        if (parentElement?.tagName) {
            parentElementType = parentElement.tagName;
        } else if (parentElement?.nodeName){
            parentElementType = parentElement.nodeName;
        } else if (parentElement?.id) {
            parentElementType = parentElement?.id;
        } else {
            parentElementType = undefined;
        }

        switch (elementType) {
        case 'DIV':
            boxColor = hexColorCodes[0][0];
            break;
        case 'NAV':
        case 'NAVBAR':
            boxColor = hexColorCodes[14][0];
            break;
        case 'H1':
        case 'H2':
        case 'H3':
        case 'H4':
        case 'H5':
            boxColor = hexColorCodes[1][0];
            break;
        case 'HTML':
            boxColor = hexColorCodes[12][0];
            break;
        case 'P':
            boxColor = hexColorCodes[2][0];
            break;
        case 'TEXT':
            boxColor = hexColorCodes[3][0];
            break;
        case 'LI':
        case 'OL':
        case 'UL':
            boxColor = hexColorCodes[4][0];
            break;
        case 'INPUT':
        case 'TEXTAREA':
            boxColor = hexColorCodes[5][0];
            break;
        case 'LABEL':
            boxColor = hexColorCodes[6][0];
            break;
        case 'CIRCLE':
        case 'SVG':
        case 'GRAPH':
        case 'PATH':
        case 'G':
            boxColor = hexColorCodes[7][0];
            break;
        case 'BTN':
        case 'BUTTON':
        case 'BSBUTTON':
            boxColor = hexColorCodes[8][0];
            break;
        case 'A':
        case 'LINK':
        case 'OSFLINK':
            boxColor = hexColorCodes[9][0];
            break;
        case 'IMG':
        case 'FAICON':
            boxColor = hexColorCodes[10][0];
            break;
        case 'TABLE':
        case 'TBODY':
        case 'DT':
        case 'DL':
            boxColor = hexColorCodes[11][0];
            break;
        default:
            this.toast.error('Element type not apparent.');
            break;
        }

        const box = '<div name="mainMapElement" local-class="kitten-shuttle" style="max-width: fit-content; padding: 1vw; margin: 2vw; border: 2px solid rgb(171, 171, 171); background-color: ' + boxColor + '" data-test-protected-kitten>' +
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th>' + elementName + '</th>' +
        '</tr>' +
        '<tr>' +
        '<th>' + elementType + '</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        '<tr>' +
        '<td>' + 'Data Test: ' + '</td>' +
        '<td>' +  dataTest + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td>' + 'Text Content: ' + '</td>' +
        '<td>' + elementText + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td>' + 'Classes: ' + '</td>' +
        '<td>' + elementClass + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td>' + 'Parent Type: ' + '</td>' +
        '<td>' + parentElementType + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td>' + 'No. Children: ' + '</td>' +
        '<td>' + numOfChildren + '</td>' +
        '</tr>' +
        '</tbody>' +
        '</table>' +
        '</div>';

        if (output) {
            output.insertAdjacentHTML('beforeend', box);
        }
    }

    @action
    resetMap() {
        this.set('mapPresent', false);
        const appMap = document.getElementsByName('elementOutput')[0] as HTMLElement;
        while(appMap.hasChildNodes() ){
            const lstChild = appMap.lastChild as Node;
            appMap.removeChild(lstChild);
            this.set('appMapData', []);
        }
    }

    @action
    appMap() {
        this.set('mapPresent', true);
        const data = this.appMapData;
        try {
            for (let i=1; i < data.length; i++) {
                const [childElement, classes, dataTest, elementData, elementType, elementText, eventType, isDev, name, parentElement] = [data[i].childElement, data[i].class, data[i].dataTest, data[i].elementData, data[i].elementType, data[i].elementText, data[i].eventType, data[i].isDev, data[i].name, data[i].parentElement];
                let tile = i;
                let value: AppMapData = {
                    childElement: childElement,
                    class: classes,
                    dataTest: dataTest,
                    elementData: elementData,
                    elementType: elementType,
                    elementText: elementText,
                    eventType: eventType,
                    isDev: isDev,
                    name: name,
                    parentElement: parentElement,
                };

                this.mapData.tiles[tile] = value;
                this.protectKitten(this.mapData.tiles[tile]);
            }
        } catch (e) {
            this.toast.error('An error has occured: ', e);
        } finally {
            this.toast.info('Map Data available on Elements tab below.');
        }
    }

    @action
    wireVulnerability() {
        let mode = this.get('feMode');

        if (mode !== 'active') {
            this.set('feMode', interceptorStatus[2]);
        }

        try {
            document.addEventListener('click', (event: any) => {
                const windowTime = String(event.timeStamp.toFixed(3));
                const posX = event.clientX;
                const posY = event.clientY;
                const analysisItem = document.elementFromPoint(posX, posY) as HTMLElement;
                let classes: string | undefined;
                let currentElement: any | undefined;
                let dataTestSelector: string | null | undefined;
                let devElement: string | null | undefined;
                let elementText: string | undefined;
                let elementType: string | undefined;
                let eventType: MouseEvent | KeyboardEvent | string | undefined = event.type.trim();
                let isDev: boolean | undefined;
                let numberOfChildren: number;
                let parentElement: HTMLElement | undefined;
                let elementName: string | undefined;
                let currentElementID: string | undefined;
                let classList: string[] = [];
                let firstClass: string | undefined = classList[0];

                if (analysisItem) {
                    currentElement = analysisItem;
                    classes = analysisItem.classList.toString();
                    numberOfChildren = analysisItem.children.length;
                    elementText = analysisItem.textContent?.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();
                    elementType = analysisItem.tagName.toLowerCase();
                    parentElement = analysisItem.parentElement as HTMLElement;
                    currentElementID = currentElement.id;
                    classList.push(classes.split(' ').toString().toLowerCase());
                    classList.forEach((val:any) => {
                        let className: string;
                        let firstChar: string = val.slice(0,1).toString();
                        isDev = !this.isAlpha(firstChar);
                        if (isDev) {
                            className = val.split('\u005F')[1];
                            devElement = className;
                            isDev = true;
                        }
                    });
                } else if (event.path){
                    const eventPath = event.path;
                    classes = currentElement.classList;
                    currentElement = eventPath[0];
                    elementText = currentElement.textContent.slice(0, 256).replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();
                    elementType = currentElement.tagName.toLowerCase;
                    numberOfChildren = currentElement.childNodes.length;
                    parentElement = eventPath[1];
                } else {
                    currentElement = undefined;
                    classes = undefined;
                    dataTestSelector = null;
                    elementText = '';
                    elementType = undefined;
                    numberOfChildren = 0;
                    parentElement = undefined;
                    eventType = event.type;
                    this.toast.error(`No element landmarks found for event : ${event} at ${windowTime}`);
                }

                // get data test selector
                const currentElementAttributeList = Object.values(analysisItem.attributes);
                if (currentElementAttributeList) {
                    let splitAttrsValues = Object.values(currentElementAttributeList);
                    for (let i =0; i < splitAttrsValues.length; i++) {
                        let attribute = splitAttrsValues[i].nodeName;
                        let isDataTest = attribute.toString().search('data-test');
                        if (isDataTest !== -1) {
                            dataTestSelector = String(attribute);
                        } else {
                            dataTestSelector = null;
                        }
                    }
                }

                if (elementType && firstClass && currentElementID) {
                    elementName = String(elementType + '.' + firstClass);
                } else if (elementType && firstClass) {
                    elementName = String(elementType + '.' + firstClass);
                } else {
                    elementName = String(elementType);
                }

                let elementalData: AppMapData = {
                    childElement: numberOfChildren,
                    class: classList,
                    dataTest: dataTestSelector,
                    elementData: [devElement, dataTestSelector],
                    elementType: elementType,
                    elementText: elementText,
                    eventType: eventType,
                    isDev: isDev,
                    name: elementName,
                    parentElement: parentElement,
                };
                this.appMapData.push(elementalData);
                this.buildTimeline(windowTime, eventType, currentElement);
            }, true);
            // TODO overlap similar paths to root for total coverage and unique/absolute identification
        } catch (e) {
            this.toast.error(`No element data available at ${this.getCurrentTime()}: ${e}.`);
        }
    }

    @action
    buildTimeline(windowTime: any, eventType: MouseEvent | KeyboardEvent | string | undefined, currentElement: any | undefined) {
        const currentElementDiv = document.getElementsByName('current-element')[0];
        const currentElementList = document.getElementsByName('current-element-list')[0];
        const elementCard = '<li class="card" local-class="current-element-card">' +
        '<dl data-test-rss-card>' + '<dt>' + 'Element Data at ' + windowTime + ': ' + '</dt>' +
        '<dd data-test-event-type>' + currentElement.name + '</dd>' + '<br />' +
        '<dd data-test-event-http>' + currentElement.http + '</dd>' + '<br />' +
        '<dd data-test-event-name>' + eventType + '</dd>' + '<br />' +
        '</li>';
        const severityValues = Object.values(lmhValues);
        const severity = severityValues[Math.floor(severityValues.length * Math.random())];
        const timeline = document.getElementsByName('time-data')[0];

        if (currentElementDiv) {
            currentElementList.insertAdjacentHTML('beforeend', elementCard);
        }

        const mittens = 'ΩΩ';
        const kitten = document.createTextNode(mittens);
        let box = document.createElement('div');
        box.appendChild(kitten);

        let dotPositionColor;

        switch (severity) {
        case 1:
            dotPositionColor = hexColorCodes[15][0];
            break;
        case 3:
            dotPositionColor = hexColorCodes[14][0];
            break;
        case 5:
            dotPositionColor = hexColorCodes[12][0];
            break;
        case 10:
            this.toast.warning(`HIGH severity event : ${severity}`);
            dotPositionColor = hexColorCodes[11][0];
            break;
        case 15:
            this.toast.warning(`CRITICAL severity event : ${severity}`);
            dotPositionColor = hexColorCodes[10][0];
            break;
        default:
            this.toast.error('Color not found.');
            break;
        }

        const severityHeights = [25, 50, 75, 100, 125];

        const kittyLaunch = '<li class="'+ dotPositionColor + '" style="background-color: ' + dotPositionColor +'" data-test-kitten-in-box>' + kitten.textContent +
        '<p class="hidden">' + severity + '</p>' +
        '</li>';

        if (box) {
            timeline.insertAdjacentHTML('beforeend', kittyLaunch);
            if (dotPositionColor) {
                let currentKitten = document.querySelectorAll('ol li:last-child')[0] as HTMLElement;
                currentKitten.classList.add(dotPositionColor);
                currentKitten.style.backgroundColor = dotPositionColor;
                if (dotPositionColor === '#0700C4') {
                    currentKitten.style.marginTop = severityHeights[4]+ 'px';
                } else if (dotPositionColor === '#0000FF') {
                    currentKitten.style.marginTop = severityHeights[3]+ 'px';
                } else if (dotPositionColor === '#0052FF') {
                    currentKitten.style.marginTop = severityHeights[2]+ 'px';
                } else if (dotPositionColor === '#00A3FF') {
                    currentKitten.style.marginTop = severityHeights[1]+ 'px';
                } else if (dotPositionColor === '#00CCFF') {
                    currentKitten.style.marginTop = severityHeights[0]+ 'px';
                } else {
                    currentKitten.style.marginTop = '0';
                }
                console.log(currentKitten);
            }
            let dc: any = this.get('dataCount');
            // in debug
            console.log('Current dc: ' , dc);
            if (dc) {
                let val = Number(dc);
                val += 1;
                console.log('val: ' , val);
                this.set('dataCount', String(val));
                console.log('Current dataCount: ', this.dataCount);
            }
        }
    }

    // initiate Ifrit.io or read its data
    // in debug
    @action
    findInRepo(map: AppMap[]): any {
        const className = _SampleElementData[0];
        const dataTest = _SampleElementData[1];
        const outputText = document.getElementsByName('output')[0].textContent;
        const repositoryName = _SampleAppMap.repository;
        const time = this.getCurrentTime();

        let matchingElements: string[] = new Array(2);

        console.log('Output text: ', outputText);

        const exampleOutput = {
            1: 'ember-bootstrap/components/bs-navbar/contentember-bootstrap/components/bs-navbar/',
            2: 'link-toember-bootstrap/components/bs-navbar/navember-bootstrap/components/bs-navbar/',
            3: 'toggleosf-components/components/node-navbar/componentosf-components/components/',
            4: 'node-navbar/link/componentosf-components/components/node-navbar/link/',
            5: 'templateosf-components/components/node-navbar/stylesosf-components/components/',
            6: 'node-navbar/templateosf-components/components/osf-navbar/auth-dropdown/',
            7: 'componentosf-components/components/osf-navbar/auth-dropdown/stylesosf-components/',8: 'components/osf-navbar/auth-dropdown/templateosf-components/components/osf-navbar/',
            9: 'componentosf-components/components/osf-navbar/stylesosf-components/components/',
            10: 'osf-navbar/templateosf-components/components/osf-navbar/x-links/',
            11: 'componentosf-components/components/osf-navbar/x-links/global-link-to/',
            12: 'componentosf-components/components/osf-navbar/x-links/hyper-link/',
            13: 'componentosf-components/components/osf-navbar/x-links/hyper-link/',
            14: 'templateosf-components/components/osf-navbar/x-links/hyper-link/x-anchor/',
            15: 'componentosf-components/components/osf-navbar/x-links/hyper-link/x-anchor/',
            16: 'templateosf-components/components/osf-navbar/x-links/templateember-osf-web/components/',
            17: 'bs-navbarember-osf-web/components/bs-navbar/contentember-osf-web/components/bs-navbar/',
            18: 'link-toember-osf-web/components/bs-navbar/navember-osf-web/components/bs-navbar/',
            19: 'toggleember-osf-web/components/node-navbar/componentember-osf-web/components/',
            20: 'node-navbar/link/componentember-osf-web/components/osf-navbar/auth-dropdown/',
        };

        let classNameKC = this.fromPascalCase(className.toString(), 'kc');

        if (className || dataTest) {
            const matchingElementName = Object.values(exampleOutput).filter(n => n.includes(className.toString())).filter(m => m.includes(repositoryName.toLowerCase()));
            this.toast.info(`Matching element found: ${className}`);
            if (matchingElementName) {
                matchingElements[0] = classNameKC;
            } else {
                matchingElements[0] = '';
            }
        } else  {
            this.toast.info(`No available element data at: ${time}`);
        }
        return matchingElements;
    }

    @action
    increaseRiskLevel(severity: string): void {
        const time = this.getCurrentTime();
        let sessionRisk = this.sessionRisk;

        switch(severity) {
        case 'low':
            if (sessionRisk) {
                sessionRisk += lmhValues.low;
            }
            break;
        case 'medium':
            if (sessionRisk) {
                sessionRisk += lmhValues.medium;
            }
            break;
        case 'high':
            if (sessionRisk) {
                sessionRisk += lmhValues.high;
            }
            break;
        default:
            break;
        }

        this.set('sessionRisk', sessionRisk);
        sessionStorage.setItem('sessionRisk', String(sessionRisk));

        try {
            if ( (this.sessionRisk && this.sessionRisk >= 10) || (_SampleUserProfile.UserData.totalRisk >= 10)) {
                let totalRisk = Number(this.get('totalRisk'));
                totalRisk +=1;
                this.set('totalRisk', totalRisk);
                if (this.session) {
                    this.currentUser.anonymizedViewOnly = true;
                    this.currentUser.logout();
                    this.session.invalidate();
                    this.toast.warning(`Invalidating session at risk: ${this.totalRisk} and time ${time}`);
                    _SampleUserProfile.UserData.totalRisk += totalRisk;
                }
            }
        } catch (e) {
            this.toast.error(`Critical user session still active: ${this.FEUserID}. Please follow up with account.`);
        } finally {
            this.toast.info(`Increasing risk at ${time}. Current session risk level: ${sessionRisk}`);
        }
    }

    // reduces the user's overall total risk score based on time elapsed
    // + repuation and actions such as registering and the earning of badges decrease the score
    // 'High' and 'Medium' risk violations take longer to decrement than 'Low' risk violations
    @action
    decreaseRiskLevel(severity: string): void {
        const time = this.getCurrentTime();
        let sessionRisk = this.sessionRisk;

        switch(severity) {
        case 'low':
            if (sessionRisk) {
                sessionRisk -= lmhValues.low;
            }
            break;
        case 'medium':
            if (sessionRisk) {
                sessionRisk -= lmhValues.medium;
            }
            break;
        case 'high':
            if (sessionRisk) {
                sessionRisk -= lmhValues.high;
            }
            break;
        default:
            break;
        }

        this.set('sessionRisk', sessionRisk);
        sessionStorage.setItem('sessionRisk', String(sessionRisk));

        try {
            if ((this.sessionRisk && this.sessionRisk <= 0) || (_SampleUserProfile.UserData.totalRisk <= 0)) {
                this.set('sessionRisk', 0);
                sessionStorage.setItem('sessionRisk', String(0));
            }
        } catch (e) {
            this.toast.error(`User profile: ${this.FEUserID} risk not decreased. Please follow up with account.`);
        } finally {
            this.toast.info(`Decreasing risk at ${time}. Current session risk level: ${sessionRisk}`);
        }
    }

    @action
    calculateRiskAreas() {
        console.log('Inside calculateRiskAreas fxn.');
        // TBD
    }

    @action
    displayRiskAreas() {
        const getRequests = _SampleAppMap.stats.sessionRequests.get;
        const postRequests = _SampleAppMap.stats.sessionRequests.post;
        const putRequests = _SampleAppMap.stats.sessionRequests.put;
        const patchRequests = _SampleAppMap.stats.sessionRequests.patch;
        const optionRequests = _SampleAppMap.stats.sessionRequests.option;
        const headRequests = _SampleAppMap.stats.sessionRequests.head;
        const traceRequests = _SampleAppMap.stats.sessionRequests.trace;
        const otherRequests = _SampleAppMap.stats.sessionRequests.other;
        const badRequests = _SampleAppMap.stats.sessionRequests.badRequest;

        const getSegment = document.querySelectorAll('circle.request-type')[0] as HTMLElement;
        const postSegment = document.querySelectorAll('circle.request-type')[1] as HTMLElement;
        const putSegment = document.querySelectorAll('circle.request-type')[2] as HTMLElement;
        const patchSegment = document.querySelectorAll('circle.request-type')[3] as HTMLElement;
        const optionSegment = document.querySelectorAll('circle.request-type')[4] as HTMLElement;
        const headSegment = document.querySelectorAll('circle.request-type')[5] as HTMLElement;
        const traceSegment = document.querySelectorAll('circle.request-type')[6] as HTMLElement;
        const otherSegment = document.querySelectorAll('circle.request-type')[7] as HTMLElement;
        const badRequestSegment = document.querySelectorAll('circle.request-type')[8] as HTMLElement;

        const total = getRequests + postRequests + putRequests + patchRequests + optionRequests + otherRequests + headRequests + traceRequests;

        const getPercent = getRequests/total*100;
        const postPercent = postRequests/total*100;
        const putPercent = putRequests/total*100;
        const patchPercent = patchRequests/total*100;
        const optionPercent = optionRequests/total*100;
        const headPercent = headRequests/total*100;
        const tracePercent = traceRequests/total*100;
        const otherPercent = otherRequests/total*100;
        const badRequestPercent = badRequests/total*100;

        const offset = 25;

        const totalValueChart = document.querySelector('text.chart-number') as HTMLElement;
        const totalStr = String(total);

        if (totalValueChart){
            totalValueChart.textContent = totalStr;
        }

        getSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        getSegment.style.strokeDasharray = getPercent+' '+(100-getPercent);
        getSegment.style.strokeDashoffset = String(offset);

        getSegment.style.stroke = hexColorCodes[0][0];

        postSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        postSegment.style.strokeDasharray = postPercent+' '+(100-postPercent);
        postSegment.style.strokeDashoffset = String(100-postPercent+offset);

        postSegment.style.stroke = hexColorCodes[1][0];

        putSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        putSegment.style.strokeDasharray = putPercent+' '+(100-putPercent);
        putSegment.style.strokeDashoffset = String(100-(postPercent+getPercent)+
             offset);

        putSegment.style.stroke = hexColorCodes[2][0];

        patchSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        patchSegment.style.strokeDasharray = patchPercent+' '+(100-patchPercent);
        patchSegment.style.strokeDashoffset = String(100-(putPercent+postPercent+getPercent)+offset);

        patchSegment.style.stroke = hexColorCodes[3][0];

        optionSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        optionSegment.style.strokeDasharray = optionPercent+' '+(100-optionPercent);
        optionSegment.style.strokeDashoffset = String(100-(patchPercent+putPercent+postPercent+getPercent)+offset);

        optionSegment.style.stroke = hexColorCodes[4][0];

        headSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        headSegment.style.strokeDasharray = headPercent+' '+(100-headPercent);
        headSegment.style.strokeDashoffset = String(100-(optionPercent+patchPercent+putPercent+postPercent+getPercent)+offset);

        headSegment.style.stroke = hexColorCodes[5][0];

        traceSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        traceSegment.style.strokeDasharray = tracePercent+' '+(100-(tracePercent));
        traceSegment.style.strokeDashoffset = String(100-(headPercent+optionPercent+patchPercent+putPercent+postPercent+getPercent)+offset);

        traceSegment.style.stroke = hexColorCodes[6][0];

        otherSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        otherSegment.style.strokeDasharray = otherPercent+' '+(100-otherPercent);
        otherSegment.style.strokeDashoffset = String(100-(tracePercent+headPercent+optionPercent+patchPercent+putPercent+postPercent+getPercent)+offset);

        otherSegment.style.stroke = hexColorCodes[7][0];

        badRequestSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        badRequestSegment.style.strokeDasharray = badRequestPercent+' '+(100-badRequestPercent);
        badRequestSegment.style.strokeDashoffset = String(100-(otherPercent+tracePercent+headPercent+optionPercent+patchPercent+putPercent+postPercent+getPercent)+offset);

        badRequestSegment.style.stroke = hexColorCodes[8][0];
    }

    @action
    toggleDarkMode() {
        const testBrowser = document.getElementsByName('test-browser')[0];

        if (this.mode === 'light') {
            this.set('mode', 'dark');
            sessionStorage.setItem('mode', 'dark');
        } else {
            this.set('mode', 'light');
            sessionStorage.setItem('mode', 'light');
        }

        if (this.mode === 'dark') {
            if (testBrowser) {
                testBrowser.classList.add('dark-mode');
                testBrowser.style.color = 'inherit';
                testBrowser.style.filter = 'invert(100%)';
                testBrowser.style.webkitFilter = 'invert(100%)';
            }
        } else {
            if (testBrowser) {
                testBrowser.classList.remove('dark-mode');
                testBrowser.style.color = 'inherit';
                testBrowser.style.filter = 'invert(0%)';
                testBrowser.style.webkitFilter = 'invert(0%)';
            }
        }
    }

    @action
    openTab(tabName: string): void {
        const tab = document.getElementsByName(tabName)[0] as HTMLElement;

        let i;
        let tabcontent;
        let tablinks;

        tabcontent = document.getElementsByClassName('tabcontent') as HTMLCollectionOf<HTMLElement>;
        tablinks = document.getElementsByClassName('tablinks');

        this.set('toggleTabView', true);

        for (i = 0; i < tabcontent.length; i++) {
            try {
                tabcontent[i].style.display = 'none';
            } catch (e) {
                this.toast.error('Tab unopenable: $(tabcontent[i]}');
            }
        }

        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(' active', '');
        }

        tab.style.display = 'flex';
        tab.style.flexDirection = 'column';
        tab.style.gridRow = '3/4';
        tab.style.gridColumn = '1/6';
        tab.style.border = '1px solid #d9d9d9';
        tab.style.height = '20vh';
        tab.style.overflowY = 'scroll';
        tab.style.overflowX = 'scroll';
        tab.style.margin = '2vh 3vw 3vh';
        tab.classList.add('active');
    }
}
