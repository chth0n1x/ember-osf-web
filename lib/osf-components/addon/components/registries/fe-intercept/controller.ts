import * as fs from 'fs';
import * as nm from 'nodemailer';
import * as http from 'http';

import Controller from '@ember/controller';
import { Session } from 'ember-simple-auth/services/session';
import RegistrationModel from 'ember-osf-web/models/registration';
import { Permission } from 'ember-osf-web/models/osf-model';

import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import Toast from 'ember-toastr/services/toast';
import Intl from 'ember-intl/services/intl';
import { waitFor } from '@ember/test-waiters';

import { taskFor } from 'ember-concurrency-ts';
import currentUser from 'ember-osf-web/services/current-user';
import { tracked } from '@glimmer/tracking';
import { restartableTask, task } from 'ember-concurrency';
import { getOwner } from '@ember/application';
import RouterService from '@ember/routing/router-service';
import NodeModel from 'ember-osf-web/models/node';

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
]

const statusCodes = {
    'e400' : [400, 'Bad Request', 'Medium'],
    'e401' : [401, 'Unauthorized', 'Medium'],
    'e402' : [402, 'Payment Required', 'None'],
    'e403' : [403, 'Forbidden', 'High'],
    'e404' : [404, 'Not Found', 'None'],
    'e405' : [405, 'Method Not Allowed', 'Medium'],
    'e408' : [408, 'Request Timeout', 'Medium'],
    'e412' : [412, 'Precondition failed', 'Medium'],
    'e414' : [414, 'URI Too Long', 'Medium'],
    'e415' : [415, 'Unsupported Media Type', 'Medium'],
    'e423' : [423, 'Locked', 'High'],
    'e424' : [424, 'Failed Dependency', 'High'],
    'e425' : [425, 'Too Early', 'None'],
    'e429' : [429, 'Too Many Requests', 'Medium'],
    'e431' : [431, 'Request Header Fields Too Large', 'Medium'],
    'e451' : [451, 'Unavailable for Legal Reasons', 'Medium'],
    'e500' : [500, 'Internal Server Error', 'None'],
}

// Low risk behaviour will decrease the total risk score over time
// Session risk cannot be decremented, only increased
// Any banned user also raises their overall group's score
// Email notifications are sent anytime a group score is raised
const lmhValues = {
    'low': 1,
    'medium': 3,
    'high': 5,
    'warning': 10,          // user is warned
    'critical': 15,         // user is banned
}

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
        totalRisk: 2,
        sessionReputation: 6,
        totalReputation: 6,
    },
}

/**
 *
 * FEIntercept Module
 * Author: Ashley Robinson
 * Description: An interactive security module
 * Created: July 2021
 * ad Astra.
 *
 **/
export default class FEIntercpt extends Controller {
    @service user!: currentUser;
    @service session!: Session;
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

    sessionEscalations = [0, 0];        // number, sum
    totalEscalations = [0, 0];          // number, sum
    sessionReputation = 5;
    sessionRisk = 5;
    totalReputation = 5;
    totalRisk = 5;
    groupReputation = 5;
    groupRisk = 5;

    @restartableTask
    @waitFor
    async setUpTask() {
        this.set('totalRisk', SampleUserProfile.UserData.totalRisk);
        this.set('totalReputation', SampleUserProfile.UserData.totalReputation);
    }

    @task
    @waitFor
    checkPermission(item: RegistrationModel) {
        console.log('In checkPermissions() fxn.');
        let userPermission = 0;
        const permissions = this.registration.userHasAdminPermission;
        if (permissions === true) {
            userPermission = 1;
        } else {
            userPermission = 0;
        }
        return userPermission;
    }

    // honeypot bot
    @action
    detectOffensive() {
        console.log('In detectOffensive() fxn.');
    }

    @action
    increaseRiskLevel(severity: string): void {
        console.log('In increaseRiskLevel() fxn.');

        switch(severity) {
            case 'low':
                this.sessionRisk += lmhValues.low;
                break;
            case 'medium':
                this.sessionRisk += lmhValues.medium;
                break;
            case 'high':
                this.sessionRisk += lmhValues.high;
                break;
            default:
                break;
        }

        if (this.totalRisk >= 10 || this.sessionRisk >= 10 || this.groupRisk >= 10) {
            // user is marked as spam
            // permissions are updated
            this.session.invalidate();
        } else {
            console.log(`User risk level: ${this.sessionRisk}`);
        }
    }

    // decreaseRiskLevel() takes the user and the user group's overall risk score based on elapsed
    // time since the violation occurred and decreases the score should approving criteria be met.
    // This method run at the end of the Session by the interceptor and verified by its corresponding Python module.
    // 'High' and 'Medium' risk violations will take longer to decrement than 'Low' risk violations.
    // The FEIntercept is not meant to decrement a user's risk level, but it does so understanding
    // that humans err. There is a feature for Moderators to temporarily lift 'Read' and 'Write'
    // blocks as well as a spam label, but it will need to be verified by COS Support within 24 hours
    // when the cron job runs.
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

        // get the epoch time of the last high risk violation

            // 1 + multiply total high risk behaviour by (1 * highRiskIncrease), subtract threatSlowDecrease

        // get the epoch time of the last medium risk violation

            // 1 + multiply total high risk behaviour by (1 * mediumRiskIncrease), subtract threatSlowDecrease // both medium and high decrease at the same rate

        // get the epoch time of the last low risk violation

            // 1 + multiply total high risk behaviour by (1 * lowRiskIncrease), subtract threatNormalDecrease

        // multiply threat factor by 1.2 if user is anonymous

        // sum and divide by the total threat items considered above

        // if the calculated risk is below recommended applications levels

            // decrease totalUser risk

            // decrease group  // inverse from threat analysis to prevent user action

            // boost user's reputation score
    }

    // collects app surface area and runs detectoffensive(), checkXHR(), and isRequestAllowed()
    @action
    allTheBase() {
        console.log('In allTheBase() fxn.');
    }

    // checks request upon xhr codes 1-4 and verifies server response
    @action
    checkXHR(statusCode: string) {
        console.log('In checkXHR() fxn.');
        const moduleResponse = false;
        const xhr = new XMLHttpRequest();
        const responseHeaders = xhr.getAllResponseHeaders();
        console.log('Current response headers are:', responseHeaders);
        const onReadyStateChange = xhr.readyState;

        if (statusCode == '200' && onReadyStateChange === 2) {
            try {
                // code here
            } catch (error) {
                throw new Error('No form data available.');
            }
        }
        return moduleResponse;
    }

    @action
    get isRequestAllowed() {
        console.log('In isRequestAllowed() fxn.');
        return;
    }

    // bot writes to file with this
    @action
    sendViolationToLog() {
        console.log('In sendViolationToLog() fxn.');
    }

    @action
    sendViolationToCOS() {
        console.log('In sendViolationToCOS() fxn.');
        const emailConfig = {
            subject: 'OSF Test Email',
            message: 'This is a test email for the OSF. If you have received this message in error, please contact engineering@cos.io for further assistance.',
            to: 'config.email.userOne',
            from: 'config.email.userTwo',
        };

        const transporter = nm.createTransport(emailConfig);

        // send an email to Support for any users marked spam

        // returnValidUsers() checks against an internal blacklist and returns any users not
        // in the blacklist so they will receive appropriate customer support first

        // Optionally send violation to DevOps

            // if prod goes down

            // if user is a repeat offender of any risk level within a set time period

            // if user creates the same risk factor increase with medium or low violations over a long time period

            // when analytics shows osf links in .com, .net domains

                // if the user email used to post in the cross-site site matches any domain from the blacklist when invoking any the OSF's links

                    // record to log the user's Session, IP, and mac address

                    // record to log any data including screenshots of the link posting

                    // sort for any of those put at the top of the DevOps log

    }

    // TODO add activate() method when entering route
    @action
    getEventLogTime() {
        const date = new Date();
        const epoch = date.getTime();
        const dateZero = new Date(0)
        const gregorian = dateZero.setUTCSeconds(epoch)
        return gregorian
    }

    @task
    @waitFor
    async getTotalRisk() {
        // get current risk for user's Session

            // if it hits a maximum threat value

                // set delay for http method's execution until for interceptor's and server's response for yes or no

                        // get user & group permissons

                        // get user and group security levels; compare and decide if user should proceed

        // check if outbound request or inbound response

            // if outbound:

                //check xhr code at ready state 0-4

                    //return handling as appropriate and log errors, violations

                    // initiate interceptor if malicious

        // verify transitions and update headers{Meta,Body}Temporal and statusCodes{Meta,Body}Temporal objects

    }

    // checks if an authorized user's request has been returned and recalls the module until
    // user session is closed; this data is written to by and queried from by the bot
    @restartableTask
    @waitFor
    async followUp() {
        // check original client side request retrieved from logs or local storage
        // check the server response
        // verify that the user initiated method call completed or did not complete
            // if not, include status code and state of headers
        // log exit point of user until didTransision is no longer recursively called
    }

    // pair with detectOffensive()
    @task
    @waitFor
    async assignViolation(violation: string, securityLevel: string) {
        console.log('In the assign violation function');
    }

    @action
    alertUser() {
        let interceptorResponse = false;
        // // // current_group_permissions: this.args.node.currentUserPermissions = Permission.Admin;
        // // // interceptorDecision = false;
        // allow user to retry; only a repeated attempt will increment but logs both

        // have user click acknowledgement button of their action. There should not be an 'x' to escape and the
        // method should not be written into the alert twice.
        // when group or user permissions are not found, make node read only if public and not available
        // if private

        // check that permissions match that which is set for their corresponding groups (query other
        // users in the group and check their permissions, should be the same)
        // Note: this will require all users registered within the app to belong to some group

        // permit the user a retry but log the failure and increment risk + 1 lowRiskIncrease // TODO go bavk to contributor.ts ln12
        // TODO discuss risk threshold sensitivity and security concerns on warning a user

        // await response

        // collect status code for {body, meta}

        // return headers from previous method

        // collect the server's yes or no ultimatum response

        // add events within browser with xhr; log and handle codes

        // either pass back requested data, alert the user to fix their inputs, or redirect or boot the user

        // if (group.USER_INTERNAL_ADMIN && statusCode.contains(neutralStatusCodeList[]) {
        return interceptorResponse;
    }

    @action
    returnDOMState(node: NodeModel, header: string, statusCode: number) {
        const owner = getOwner(this);
        const route: string[] = this.router.currentRouteName.split('.');
        const body = document.body;
        const headers = [];
        const codes = [];
        let domTree = {};

        // walk the DOM using recursion
        const walkOSFView = function walkOSF(node: any, walk: any) {
            walk(node);
            node = node.firstChild;
            while (node) {
                walkOSF(node, walk);
                node = node.nextSibling;
            }
        }

        const getAllFormElements = function (att: any, value: any) {
            const results = [];

            walkOSFView(document.body, function (node:any) {
                const nodeType = node.nodeType;
                const attrType = node.getAttribute(att);

                    if (nodeType === 'form' && attrType) {
                        const actual = nodeType && attrType;
                        if (typeof actual === value || typeof value !== 'string') {
                            results.push(node);
                        }
                    }
            });
        }

        if (body) {
            console.log('The body is: ', body);
        }

        // temporary headers
        if (apiHeaders.includes(header) || Object.keys(statusCodes).includes(statusCode.toString())) {
            headers.push(header);
            codes.push(statusCode);
        }

        // verify URL
        const url = 'this.route.currentRouteName';
        // verify domain

        // verify meta headers
        const metadata = []

        // collect interactable elements
        const elements = []; // array of elements
        const history = [] // array of timestamps

        return domTree;
    }

    // Note: wireVulnerability() is referenced as isRequestAllowed()
    @task
    @waitFor
    async wireVulnerability() {
        const OWASPVulnerabilityLog = 'curl --head  > \'osfs_headers_\' + epochTime ' + '.txt';
        const generalErrorLog = {};
        const isOk = false;

        const headers: string[] = [];
        const methods: string[] = [];
        let XHRCode;

        // get element data collected by allTheBase()

        // for each element in submitted form

        // check the entered input for malicious code

            // if malicious:
            // const decoder = document.createElement('div')
            // decoder.innerHTML = YourXSSAttackHere
            // const sanitized = decoder.textContent

            // if violation in one of the OWASP Top Ten Critical

                // write to OSF_OWASPTop10VulnerabilityLog.txt

                // if critical vulnerability, increase user score by 5, group by 5 * group size (default value, may adjust)

                // if medium vulnerability, increase user score by 3, group score by 3 * group size

                // if low vulnerability, increase user score by 1, group score by 1 * group size

                // if user score exceeds 10

                    // mark user as spam, send email to user and OSF support to investigate

                    // if group score's composite exceeds group size / 10 > 0.1 or 10% :

                        // mark group as spam;

                        // send out bulk email

                        // alert Product and DevOps

        for (let i=0; i < methods.length; i++) {
            const method = methods[i]; // todo add analysis of headers

            if (method === 'GET') {
                // code here
            }
            if (method === 'POST') {
                // code here
            }
            if (method === 'PUT') {
                // code here
            }
            if (method === 'PATCH') {
                // code here
            }

            // XMLHttpRequest.open(method, url[, async[, user[, password]]])
            if (XHRCode === 0) {
                // code here
            } else if (XHRCode === 1) {
                // code here
            } else if (XHRCode === 2) {
                // code here
            } else if (XHRCode === 3) {
                // code here
            } else if (XHRCode === 4) {
                // code here
            } else {
                console.log('That was not a valide XHR Code.');
            }
        }
        // check ajax body, ensure not null, make sure not malicious

        // check to make sure no secrets, keys, or user data is xmitted

        // error check and make sure that the correct typeOf data (Object)
        return isOk;
    }

    @task
    @waitFor
    async allowRequest() {
        // code here
    }

    @task
    @waitFor
    async allowResponse() {
        // code here
    }

    @action
    processStatusCode(statusCode: number) {
        if (typeof(statusCode) != 'number') {
            console.log(`That is not a parsable status code: ${statusCode}.`);
        }
        let decision = false;

        switch(statusCode) {
        // used for when a registration is pending approvals
        // in embargo status, or potentially when credentials
        // are given for login or authentication of sessions
        // TODO right now, assign console logs; add writes
        // to specific log files or create own and place in folder
        // increment by date or by bug issue type (different sorts)
        case 100: // Continue
            console.log('Action completed; user continuing to ${actionType}');
            break;
        // this is to be used in future implementations with
        // security protocols/classes also added. Essentially
        // this will trip to different states of various
        // monitoring and or logging, logout actions, counter
        // incrementation against a security risk factor score
        // or for sensitive data transfer where a line should
        // be sealed for copyright or public trust laws
        case 101: // Switching Protocols
            console.log('Switching protocols to ${high}');
            break;
        case 200: // OK
            console.log('All good, forwarding request.');
            // req.forward();
            break;
        case 201: // Created
            console.log('All good, forwarding request.');
            // req.forward();
            break;
        case 202: // Accepted
            // send email notification to all contributors
            console.log('Moderator ${moderator} has approved the Registration.');
            break;
        // this requires an internal validation for whether or not this is True
        // if so, the logic processes the request
        case 203: // Non-Authoritative Information
            console.log('Metadata from resource ${url} is not the same as our records.');
            // req.forward();
            break;
        // this is sets a Boolean to True should Results be be Reported
        // A timer starts upon the Creation of the Registration, and should
        // an agreed upon time elapse, follow up notifications are sent to
        // participants of the project. Note, this should be a request for
        // data and not a requirement. There are times when you should not
        // publish results, regardless. If this is a choice of the researchers,
        // then an option for them to describe why they are declining to share
        // results should be provided, but again not mandatory.
        case 204: // No Content
            console.log('Metadata from resource ${url} is not the same as our records.');
            // req.forward();
            break;
        case 205: // Reset Content
            console.log('Page refreshing, please wait....');
            break;
        // For our own internal logging/workflow logic purposes, to see the current
        // and other potential states for a Registration at any particular state
        // each time a mod approves an embargo, or a Regisgtration is rejected
        // (are Registrations dead in the water here? or do we want some cached state
        // they will revert too?) this offeres an internal feedback that will allow an
        // admin to glance and tell the state, thus overall improving our service
        // support for COS products
        case 302: // Found
            console.log('DOI ${DOI_VALUE} is temporarily found at ${DOI_URL}.');
            // display card to user notifiying them of the redirect
            // have card stand until user decides if they would like to proceed
            // think 'this is dangerous...would you like to proceed' caution but more...OK
            break;
        // For DOIs when an alternative resource is found. Use ML/web scraping to do a deep crawl for the resource.
        case 303: // Found using another
            console.log('DOI found at resource ${DOI_URL}');
            console.log('This resource is found here: ${DOI_RESOURCE} and no longer at the original: ${DOI_URL_REDIRECT}');
            // require user verification in order to redirect
            alert('Would you like to proceed?');
            // await user input
            // open resource in a new tab
            break;
        case 404: // Not Found
            console.log('404 found here: ${url}.');
            // redirect user to a formal 404 not found page
            // send email notification to backend team/group email account
            break;
        case 502: // Bad Gateway
            console.log('The gateway is compromised; would you like to proceed?');
            // req.forward();
            break;
        default:
            console.log('Currently unhandled: ${status_code} returned from url: ${url}');
            break;
        }
    }
}

// For reference:

// Process URL Header for status code and based on returned
// value, funnel output via a switch for further logical processing.
// NOTE: Some switches result in redirects and notifications;
// some will only log for internal reconnaissance purposes.
// For status codes that are logged, they will dump to
// files based on bug report, Date, or status code; see note below.

// Security violations for a given user total and for a given
// user during any one session will increment and fire notifications
// and alerts based on certain status codes generated. For users that
// exceed some set threshold, they will be booted from the system with an email
// sent to both the associated email account, any back up account listed
// (recommend to be mandatory, please change my mind. Note, this account
// should not be linked between each other whether similar domains...including aliases
// such as @gmail & @gmail+800-789-1234 or other ultimately
// linked domains such as @outlook.com @hotmail.com. Consideration should be
// given for headless implementations of emails such as nodemailer, bash initiated
// emails and those which originate from non-U.S. soil-based server domains.
// This is similar to when you bring multiple forms of identification with
// you to the DMV, etc.

// For regions or communities where multiple forms of authentication due to
// technological infrastructure concerns are unfeasible, phone verification
// should be the reserved form of communicating status updates. These could be
// set to a certain threshold, so that only critical, breaking, or requested
// notifications are sent through. For added availability, teams could configure
// these landline or satellite-based notifications to fire only at certain times
// of the day, when or if they have the resources to receive them. Otherwise
// this communication is enveloped for them with a tamper-proof certificate
// at and endpoint that they may retrieve when resources are available. These
// options should be configurable for both the Admin and the user of the OSF -
// without Admin approval - as it is ultimately their data and should be available
// when and as they need it. Further authentication measures should be set in
// place so that this functionality does not encounter performance issues

// Should the first be compromised (with interception actively occurring)
// the administrator for instances where high or critical
// statuses are reached. Note, these can always be adjusted in the
// settings profile.

// Configure logging to route various groups and permission levels
// of logs. E.g. all 200s could be routinely cleared; ones involving
// IAM, security, DevOps, FE, or Platform could similarly cleared either
// manually or with an automated task
// This also would allow each team to have provisions over cleanup for
// their internal monitoring

// Note: this type of monitoring as any logging schema can be memory intensive
// logs therefore will be purged on a set basis to ensure unnecessary resources
// are not consumed.

// Idea Box
// If multiple tab && same user, same session, or same user with different session, could optionally prompt the user
// if they would like to redirect from their open tab. This serves the dual purpose of interrupting any malicious  or
// automated tests (pair with qa to test) and devs can set this variable in a config file to override a default for
// testing if (env == 'dev' || env == 'test') { url.redirect('${newURL}', queryParameters : { 'home' }.
// Ask if we have honeypot/honeynets; may we build one? .....would help a lot with spam

// Error handling in routes.ts
//
// error() {
//     this.replaceWith('page-not-found', notFoundURL(this.router.currentURL));
// }
// return this.currentUser.authenticatedAJAX(options);
//
// var client = new XMLHttpRequest();
// client.open('GET', 'unicorns-are-teh-awesome.txt', true);
// client.send();
//
// client.onreadystatechange = function() {
//   if(this.readyState == this.HEADERS_RECEIVED) {
//     var contentType = client.getResponseHeader('Content-Type');
//     if (contentType != my_expected_type) {
//       client.abort();
//     }
//   }
// }

// algorithm for processing action and assigning increased risk if necessary
// add events within browser with xhr; log and handle codes
// if any malicious code exists, write to log file
// add events within browser with xhr; log and handle codes
// increase security risk - decide on and test various values for certain actions
// run method to sanitize data

// get form data outgoing after sanitization
// find python API webhooks within our own OSF
// find endpoints where we connect to different services
// to consider: our own old/newCAS, OAuth, FakeCAS, Share.js, metrics analytics
// any versioning library and other project dependencies

// var client = new XMLHttpRequest();
// client.open('GET', 'unicorns-are-teh-awesome.txt', true);
// client.send();
//
// client.onreadystatechange = function() {
//   if(this.readyState == this.HEADERS_RECEIVED) {
//     var contentType = client.getResponseHeader('Content-Type');
//     if (contentType != my_expected_type) {
//       client.abort();
//     }
//   }
// }

// console.log(`The current mod is: `, modUserName);
