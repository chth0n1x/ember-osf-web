import * as fs from 'fs';

import Controller from '@ember/controller';
import { Session } from 'ember-simple-auth/services/session';
import RegistrationModel from 'ember-osf-web/models/registration';
import { Permission } from 'ember-osf-web/models/osf-model';

import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import Toast from 'ember-toastr/services/toast';
import Intl from 'ember-intl/services/intl';
import { waitFor } from '@ember/test-waiters';

import currentUser from 'ember-osf-web/services/current-user';
import { tracked } from '@glimmer/tracking';
import { restartableTask, task } from 'ember-concurrency';
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
    MEDIUM = 'medium',              // default value
    HIGH = 'high',                  // devops notification
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

// Low risk behaviour will decrease the total risk score over time
// Session risk cannot be decremented, only increased
// Any banned user also raises their overall group's score
// Email notifications are sent anytime a group score is raised
const lmhValues = {
    low: 1,
    medium: 3,
    high: 5,
    warning: 10,          // user is warned
    critical: 15,         // user is banned
};

export const SampleCodeProfile = {
    name: 'emberr-osf-web',
    link: 'https://github.com/CenterForOpenScience/ember-osf-web',
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
        totalEscalations: [0, 0],          // number, sum
        sessionEscalations: [0, 0],        // number, sum
    },
};

export default class Niflheim extends Controller {
    @service session?: Session;
    @service intl!: Intl;
    @service toast!: Toast;
    @service router!: RouterService;

    @tracked headersTemp!: [];
    @tracked statusCodesTemp!: [];
    @tracked headersApp = apiHeaders;
    @tracked statusCodesApp = statusCodes;

    registration!: RegistrationModel;
    isModeratorMode!: boolean;
    isSpam?: boolean;

    totalRisk!: number;
    totalReputation!: number;
    sessionRisk =  0;
    sessionReputation = 0;
    groupRisk?: number;
    groupReputation?: number;

    elements = ['hydrogen', 'helium', 'lithium', 'beryllium', 'boron', 'flourine', 'oxygen'];

    codeAnalyzedName = SampleCodeProfile.name;
    codeAnalyzedLink = SampleCodeProfile.link;

    itemsAnalyzed = ['headers', 'methods', 'requests', 'responses'];

    hexColorCodes = ['#8b1a1a','#26619c','#00ffff'];

    @restartableTask
    @waitFor
    async setUpTask() {
        this.set('totalRisk', SampleUserProfile.UserData.totalRisk);
        this.set('totalReputation', SampleUserProfile.UserData.totalReputation);
        this.set('groupRisk', SampleUserProfile.GroupData.groupRisk);
        this.set('groupReputation', SampleUserProfile.GroupData.groupReputation);

        console.log(this.totalRisk);
        console.log(this.totalReputation);
        console.log(this.groupRisk);
        console.log(this.groupReputation);
    }

    @action
    callElement() {
        console.log('Element called.');
    }

    @action
    startUserStory() {
        console.log('User story started.');
    }

    @action
    stopUserStory() {
        console.log('User story stopped.');
    }

    @action
    increaseRiskLevel(severity: string): void {
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

        if (this.totalRisk >= 10 || this.sessionRisk >= 10) { // this.groupRisk
            // user is marked as spam
            // permissions are updated
            if (this.session) {
                this.session.invalidate();
            }
        } else {
            console.log(`User risk level: ${this.sessionRisk}`);
        }
    }

    // decreaseRiskLevel() reduces the user's overall total risk score based on time elapsed
    // Repuation can positively influence the score, as well as badges earned on the OSF
    // This method is run at the end of the Session by the interceptor and verified by its corresponding Python module.
    // 'High' and 'Medium' risk violations take longer to decrement than 'Low' risk violations
    @action
    decreaseRiskLevel(severity: string): void {
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
    }
}

