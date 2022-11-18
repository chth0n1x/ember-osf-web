/* eslint-disable no-console */
/* eslint-disable prefer-const */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Controller from '@ember/controller';
import { Session } from 'ember-simple-auth/services/session';
import RegistrationModel from 'ember-osf-web/models/registration';

import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import Toast from 'ember-toastr/services/toast';
import Intl from 'ember-intl/services/intl';
import { waitFor } from '@ember/test-waiters';

import { tracked } from '@glimmer/tracking';
import { restartableTask } from 'ember-concurrency';
import RouterService from '@ember/routing/router-service';

enum userType {
    UNREGISTERED_USER = '1',
    EXTERNAL_NONADMIN = '2',
    EXTERNAL_ADMIN = '3',
    INTERNAL_NONADMIN = '4',
    INTERNAL_ADMIN = '5',
}

enum securityLevel {
    LOW = 'low',
    MEDIUM = 'medium',                                          // default value
    HIGH = 'high',                                              // devops notification
    CRITICAL = 'critical'
}

type messageType = 'error' | 'info' | 'success' | 'warning';

const apiHeaders = [
    'Authorization',
    'Proxy-Authenticate',
    'Proxy-Authorization',
    'Age',
    'Cache-Control',
    'Clear-Site-Data',
    'Expires',
    'Pragma',
    'Warning',
    'Sec-CH-UA-Bitness',
    'Sec-CH-UA-Arch',
    'Sec-CH-UA-Model',
    'Sec-CH-UA-Mobile',
    'Viewport-Width',
    'If-Modified-Since',
    'Connection',
    'Keep-Alive',
    'Accept-Encoding',
    'Accept-Language',
    'Expect',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Origin',
    'Content-Length',
    'Content-Type',
    'Content-Encoding',
    'Location',
    'From',
    'Host',
    'Referer',
    'User-Agent',
    'Allow',
];

const statusCodes = {
    e400 : [400, 'Bad Request', 'Medium'],
    e401 : [401, 'Unauthorized', 'Medium'],
    e402 : [402, 'Payment Required', 'None'],
    e403 : [403, 'Forbidden', 'High'],
    e404 : [404, 'Not Found', 'None'],
    e405 : [405, 'Method Not Allowed', 'Medium'],
    e408 : [408, 'Request Timeout', 'Medium'],
    e412 : [412, 'Precondition failed', 'Medium'],
    e414 : [414, 'URI Too Long', 'Medium'],
    e415 : [415, 'Unsupported Media Type', 'Medium'],
    e423 : [423, 'Locked', 'High'],
    e424 : [424, 'Failed Dependency', 'High'],
    e425 : [425, 'Too Early', 'None'],
    e429 : [429, 'Too Many Requests', 'Medium'],
    e431 : [431, 'Request Header Fields Too Large', 'Medium'],
    e451 : [451, 'Unavailable for Legal Reasons', 'Medium'],
    e500 : [500, 'Internal Server Error', 'None'],
};

// + actions and reputation decreases the score over time
// session risk cannot be decremented, only increased
// any banned user also raises their overall group's score
// email notifications are sent anytime a group score is raised
const lmhValues = {
    low: 1,
    medium: 3,
    high: 5,
    warning: 10,                                                // user is warned
    critical: 15,                                               // user is banned
};

const hexColorCodes = {
    get: ['#ccff00', 'Electric Lime'],
    post: ['#1034a6', 'Egyptian Blue'],
    put: ['#bf00ff', 'Electric Purple'],
    patch: ['#483d8b', 'Dark Slate Blue'],
    option: ['#00ffff', 'Cyan1'],
    trace: ['#6f006f', 'Electric Indigo'],
    head: ['#9d2933','Japanese Carmine'],
    other: ['#0a7e8c', ''],
    badRequest: ['#e30022', 'Cadmium Red'],
};

const internalStatusCodes = {
    interim: 'in-progress',
    withdrawn: 'withdrawn',
    complete: 'complete',
};

const interceptorStatus = {
    1: 'inactive',
    2: 'active',
    3: 'quiet-mode',
};

// Shiva.io module data
export const SampleCodeProfile = {
    name: 'ember-osf-web',
    link: 'https://github.com/CenterForOpenScience/ember-osf-web',
    stats: {
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
};

export const SampleUserProfile = {
    UserData: {
        guid: '123az',
        sessionRisk: 2,
        totalRisk: 2,
        sessionReputation: 5,
        totalReputation: 5,
    },
    GroupData: {
        guid: '321za',
        sessionRisk: 2,
        groupRisk: 2,
        sessionReputation: 6,
        groupReputation: 6,
    },
    Summary: {
        totalEscalations: [1, [statusCodes.e404]],              // number, sum
        sessionEscalations: [1, 0],                             // number, sum
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
            userStoriesInitiated: ['createRegistration'],
            userStoriesCompleted: ['createRegistration', 'createRevisionRegistration', 'comment'],
        },
    },
};

// Ifrit.io module data
const SampleElementData = {
    name: 'navbar',
    type: 'DIV',
};

export default class Niflheim extends Controller {
    @service router!: RouterService;
    @service intl!: Intl;
    @service session?: Session;
    @service toast!: Toast;

    @tracked headersTemp?: [];
    @tracked statusCodesTemp?: [];
    @tracked headersApp = apiHeaders;
    @tracked statusCodesApp = statusCodes;

    registration!: RegistrationModel;
    isModeratorMode!: boolean;
    isSpam?: boolean;
    isListening?: boolean = false;

    totalRisk?: number;
    totalReputation?: number;
    sessionRisk =  0;
    sessionReputation = 0;
    groupRisk?: number;
    groupReputation?: number;
    interceptStatus!: number;

    elements = ['hydrogen', 'helium', 'lithium', 'beryllium', 'boron', 'flourine', 'oxygen'];

    codeAnalyzedName = SampleCodeProfile.name;
    codeAnalyzedLink = SampleCodeProfile.link;

    itemsAnalyzed = ['Headers', 'Auth', 'Scripts', 'Styles', 'Requests', 'Responses'];

    requestTypes = ['get', 'post', 'put', 'patch', 'head', 'options', 'trace', 'other', 'bad-request'];

    @restartableTask
    @waitFor
    async setUpTask() {
        this.set('totalRisk', SampleUserProfile.UserData.totalRisk);
        this.set('totalReputation', SampleUserProfile.UserData.totalReputation);
        this.set('groupRisk', SampleUserProfile.GroupData.groupRisk);
        this.set('groupReputation', SampleUserProfile.GroupData.groupReputation);

        sessionStorage.setItem('totalRisk', String(SampleUserProfile.UserData.totalRisk));
        sessionStorage.setItem('totalReputation', String(SampleUserProfile.UserData.totalReputation));
        sessionStorage.setItem('sessionRisk', String(SampleUserProfile.UserData.sessionRisk));
        sessionStorage.setItem('sessionReputation', String(SampleUserProfile.UserData.sessionReputation));

        // taskFor(this.displayRiskAreas).perform();

        console.log(this.totalRisk);
        console.log(this.totalReputation);
        console.log(this.groupRisk);
        console.log(this.groupReputation);
    }

    getCurrentTime() {
        const date = new Date();
        const epoch = date.getTime();
        const gregorian = new Date(epoch);
        return gregorian;
    }

    @action
    callElement(element: any) {
        console.log(`Element called: ${element}`);

        switch(element){
        case 'beryllium':
            console.log('Calling beryllium');
            this.processBeryllium(element);
        }
    }

    @action
    startUserStory() {
        console.log('User story started: ');
    }

    @action
    stopUserStory() {
        console.log('User story stopped.');
    }

    // data from beryllium.py
    @action
    processBeryllium(elementData: any) {
        let existingModules:  any[] = [];
        let matchingModules:  any[] = [];

        const time = this.getCurrentTime();
        const body = document.body;
        const denserObjects = `Modules entry at ${time}: ${matchingModules} `;

        try {
            existingModules.forEach(entry => {
                if (existingModules.includes(elementData)) {
                    // TODO add file location data from Ifrit
                    matchingModules.push(elementData);
                }
            });
        } catch (e) {
            throw new Error('something occured');
        }
        console.log('Matching modules are:', denserObjects);
        // this.writeFile(denserObjects);
        return matchingModules;
    }

    @action
    readFile() {
        const file = document.querySelector('input[type=file]');
        const output = document.getElementById('output');
        console.log(`Output element is: ${output} and file element is ${file}.`);

        file!.addEventListener('change', event => {
            event.preventDefault();
            let files = event.target.files;
            let f = files[0];
            const fileReader = new FileReader();
            fileReader.onload=function() {
                fileReader.readAsText(f);
                let result=fileReader.result;
                // output!.textContent = String(result);
            };
            const modules = fileReader.readAsText(files[0]);
            console.log(modules);
        });
    }

    @action
    returnUserSession() {
        console.log('Inside returnUserSession()');
        // const { user } = this.user;
        // if (this.user) {
        //     console.log(`Current user is: ${user}`);
        // }
    }

    @action
    wireVulnerability() {
        const moduleList  = document.getElementById('output') as HTMLElement;
        const outputText = moduleList?.textContent;
        let matchingElements = [];

        document.addEventListener('click', event => {
            const time = this.getCurrentTime();
            let eventTarget = event.target;
            let eventCurrentTarget = event.currentTarget;
            let eventRelatedTarget = event.relatedTarget;
            let eventType = event.type;
            let eventPropertyName = event.propertyName;
            let elementName = eventTarget?.tagName;

            // TODO match attributes for data-test-*, print files

            const elementData = `Event: ${event} at ${time}. Type: ${eventType} Target Element: ${eventTarget} Current Target: ${eventCurrentTarget} Related target:  ${eventRelatedTarget} PropertyType: ${eventPropertyName} Name: ${elementName}`;
            console.log(`Element data: ${elementData}`);

            try {
                const currentElementDiv = document.getElementsByName('current-element')[0];
                const currentElementList = document.getElementsByName('current-element-list')[0];

                const eventTypeStr = String(eventType);
                const eventNameStr = String(elementName);

                // switch(eventNameStr) {
                // case 'DIV':
                //     elementData = ['<div>', '</div>', 'divider']
                // }

                let severityValues = Object.values(lmhValues);
                let severity = severityValues[Math.floor(severityValues.length * Math.random())];

                const elementCard = '<li class="card" local-class="current-element-card">' +
                '<dl data-test-rss-card>' + '<dt>' + 'Element Data at ' + time + ': ' + '</dt>' +
                '<dd data-test-event-type>' + eventTypeStr + '</dd>' + '<br />' +
                '<dd data-test-event-name>' + eventNameStr + '</dd>' + '<br />' + '</li>';

                if (currentElementDiv) {
                    currentElementList.insertAdjacentHTML('beforeend', elementCard);
                }

                const timeline = document.getElementsByName('time-data')[0];

                let kittenCounter = 0;
                const mittens = 'ΩΩ';
                const kitten = document.createTextNode(mittens);
                let box = document.createElement('div');
                box.appendChild(kitten);

                const dotPositionColors = ['red', 'pink', 'yellow', 'green', 'blue'];
                let dotPositionColor;

                switch (severity) {
                case 1:
                    console.log(`No severity event : ${severity}`);
                    dotPositionColor = dotPositionColors[4];
                    break;
                case 3:
                    console.log(`Low severity event : ${severity}`);
                    dotPositionColor = dotPositionColors[3];
                    break;
                case 5:
                    console.log(`Medium severity event : ${severity}`);
                    dotPositionColor = dotPositionColors[2];
                    break;
                case 10:
                    console.log(`HIGH severity event : ${severity}`);
                    dotPositionColor = dotPositionColors[1];
                    break;
                case 15:
                    console.log(`CRITICAL severity event : ${severity}`);
                    dotPositionColor = dotPositionColors[0];
                    break;
                }

                let severityHeights = [25, 50, 75, 100, 125];

                let kittyLaunch = '<li class="'+dotPositionColor+'" style="background-color: ' + dotPositionColor +'" data-test-kitten-in-box>' + kitten.textContent +
                '<p class="hidden">' + kittenCounter + '</p>' +
                '<p class="hidden">' + severity +
                '</li>';

                if (box) {
                    timeline.insertAdjacentHTML('beforeend', kittyLaunch);
                    if (dotPositionColor) {
                        let currentKitten = document.querySelectorAll('ol li:last-child')[0] as HTMLElement;
                        currentKitten.classList.add(dotPositionColor);
                        currentKitten.style.backgroundColor = dotPositionColor;
                        if (dotPositionColor === 'blue') {
                            currentKitten.style.marginTop = '125px';
                        } else if (dotPositionColor === 'green') {
                            currentKitten.style.marginTop = '100px';
                        } else if (dotPositionColor === 'yellow'){
                            currentKitten.style.marginTop = '75px';
                        } else if (dotPositionColor === 'pink'){
                            currentKitten.style.marginTop = '50px';
                        } else if (dotPositionColor === 'red'){
                            currentKitten.style.marginTop = '25px';
                        }
                        console.log(currentKitten);
                    }
                    kittenCounter += 1;
                    console.log(kittenCounter);
                }
            } catch (e) {
                console.log(`No element data available at ${time}.`, e);
            }
        }, false);
    }

    @action
    buildTimeline() {
        // code here from above
    }

    // initiate Ifrit.io or return its data
    @action
    findInRepo(elementData: any) {
        console.log('Inside findInRepo() fxn');
        const [elementName] = SampleElementData.name;
        const [repositoryName] = SampleCodeProfile.name;
        const outputText = document.getElementsByName('output')[0]!.textContent;
        const time = this.getCurrentTime();
        let matchingElements = [];

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

        const matchingElementName = Object.values(exampleOutput).filter(n => n.includes(elementName)).filter(m => m.includes(repositoryName));

        if (matchingElementName) {
            console.log(`Matching element found: ${elementName}`);
            matchingElements.push(elementName);
        } else  {
            console.log(`No available element data at: ${time}`);
        }
        return matchingElements;
    }

    @action
    increaseRiskLevel(totalRisk: number, severity: string): void {
        const time = this.getCurrentTime();
        console.log('In increaseRiskLevel() fxn.');
        let risk = this.sessionRisk;

        switch(severity) {
        case 'low':
            risk += lmhValues.low;
            break;
        case 'medium':
            risk += lmhValues.medium;
            break;
        case 'high':
            risk += lmhValues.high;
            break;
        default:
            break;
        }

        this.set('sessionRisk', risk);

        if (SampleUserProfile.UserData.totalRisk >= 10 || this.sessionRisk >= 10) {
            // user is marked as spam, permissions updated
            if (this.session) {
                this.session.invalidate();
                console.log(`Invalidating session: ${this.totalRisk} at time ${time}`);
            }
        } else {
            console.log(`User risk level: ${this.totalRisk}`);
        }
    }

    // reduces the user's overall total risk score based on time elapsed
    // Positive repuation and actions such as the earning of badges decrease the score
    // 'High' and 'Medium' risk violations take longer to decrement than 'Low' risk violations
    @action
    decreaseRiskLevel(severity: string): void {
        const time = this.getCurrentTime();
        console.log('In decreaseRiskLevel() fxn.');

        switch(severity) {
        case 'low':
            this.sessionRisk -= lmhValues.low;
            break;
        case 'medium':
            this.sessionRisk -= lmhValues.medium;
            break;
        case 'high':
            this.sessionRisk -= lmhValues.high;
            break;
        default:
            break;
        }
        console.log(`Decreasing risk at ${time}. Current risk level: ${this.totalRisk}`);
    }

    // returns the totalUserRisk score based on actions within the app during
    // a single session and historical actions over time
    @action
    displayRiskAreas() {
        const getRequests = SampleCodeProfile.stats.sessionRequests.get;
        const postRequests = SampleCodeProfile.stats.sessionRequests.post;
        const putRequests = SampleCodeProfile.stats.sessionRequests.put;
        const patchRequests = SampleCodeProfile.stats.sessionRequests.patch;
        const optionRequests = SampleCodeProfile.stats.sessionRequests.option;
        const headRequests = SampleCodeProfile.stats.sessionRequests.head;
        const traceRequests = SampleCodeProfile.stats.sessionRequests.trace;
        const otherRequests = SampleCodeProfile.stats.sessionRequests.other;
        const badRequests = SampleCodeProfile.stats.sessionRequests.badRequest;

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
        console.log(`totalValueChart: ${totalValueChart}`);
        const totalStr = String(total);

        if (totalValueChart){
            totalValueChart.textContent = totalStr;
        }

        getSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        getSegment.style.strokeDasharray = getPercent+' '+(100-getPercent);
        getSegment.style.strokeDashoffset = String(offset);

        getSegment.style.stroke = hexColorCodes.get[0];

        postSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        postSegment.style.strokeDasharray = postPercent+' '+(100-postPercent);
        postSegment.style.strokeDashoffset = String(100-postPercent+offset);

        postSegment.style.stroke = hexColorCodes.post[0];

        putSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        putSegment.style.strokeDasharray = putPercent+' '+(100-putPercent);
        putSegment.style.strokeDashoffset = String(100-(postPercent+getPercent)+
             offset);

        putSegment.style.stroke = hexColorCodes.put[0];

        patchSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        patchSegment.style.strokeDasharray = patchPercent+' '+(100-patchPercent);
        patchSegment.style.strokeDashoffset = String(100-(putPercent+postPercent+getPercent)+offset);

        patchSegment.style.stroke = hexColorCodes.patch[0];

        optionSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        optionSegment.style.strokeDasharray = optionPercent+' '+(100-optionPercent);
        optionSegment.style.strokeDashoffset = String(100-(patchPercent+putPercent+postPercent+getPercent)+offset);

        optionSegment.style.stroke = hexColorCodes.option[0];

        headSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        headSegment.style.strokeDasharray = headPercent+' '+(100-headPercent);
        headSegment.style.strokeDashoffset = String(100-(optionPercent+patchPercent+putPercent+postPercent+getPercent)+offset);

        headSegment.style.stroke = hexColorCodes.head[0];

        traceSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        traceSegment.style.strokeDasharray = tracePercent+' '+(100-(tracePercent));
        traceSegment.style.strokeDashoffset = String(100-(headPercent+optionPercent+patchPercent+putPercent+postPercent+getPercent)+offset);

        traceSegment.style.stroke = hexColorCodes.trace[0];

        otherSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        otherSegment.style.strokeDasharray = otherPercent+' '+(100-otherPercent);
        otherSegment.style.strokeDashoffset = String(100-(tracePercent+headPercent+optionPercent+patchPercent+putPercent+postPercent+getPercent)+offset);

        otherSegment.style.stroke = hexColorCodes.other[0];

        badRequestSegment.style.transition = 'stroke-dasharray 0.5s ease-in-out, stroke-dasharray 0.5s ease-in-out';
        badRequestSegment.style.strokeDasharray = badRequestPercent+' '+(100-badRequestPercent);
        badRequestSegment.style.strokeDashoffset = String(100-(otherPercent+tracePercent+headPercent+optionPercent+patchPercent+putPercent+postPercent+getPercent)+offset);

        badRequestSegment.style.stroke = hexColorCodes.badRequest[0];
    }

    @action
    calculateRiskAreas() {
        console.log('Calculated risk is: ');
    }
}
