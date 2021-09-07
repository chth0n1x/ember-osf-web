    // ************Error Reporting Module for the Front End.************
    // This Module will intercept various http methods, check their status codes, and
    // handle them as appropriate. The aim of this project is to reduce the overall
    // work on the back end Linux servers. Users and Sessions will be assigned a total
    // security risk factor score that will determine whether a user is permitted within 
    // their expressed privileges. Should the user's individual score reach a certain 
    // threshold, they will receive may or may not receive an in-browser warning.
    // Following a significant increase or decrease to their score, an email will be sent 
    // to their associated email and the violation or their reprieve is recorded for the 
    // Session. Should the user continue to engage in risky behaviour, they will be banned, 
    // their Session will end, and they will be redirected to the Login Gateway.

    // For Accounts that regularly publish spam content, this aims to be a tool that can also
    // identify, log, track, and detain or collect information about its source so the Company
    // may Provision and Maintain a Secure Network Application within the OSF.

    // NOTE: This is the active working version
    // TODO migrate Legacy code with FeIntercept.ts once fully Emberized
    // TODO create route in lib/osf-components/addon

    // Native JS/Node imports
    // Native JavaScript functions will be replaced by any available Ember corollary.
    // Following the migration, the Legacy version will serve as a reference if/when any
    // breaking change occurs within the application.
    import * as fetch from 'fetch/lib/fetch.js';
    import * as nodemailer from 'nodemailer/lib/nodemailer';
    import $ from 'jquery';
    import * as fs from '/node_modules/file-system';
    import * as http from 'http';

    // Ember imports:
    // config
    import * as env from '../config/environment';
    // auth/services
    import * as currentUser from 'app/services/current-user';
    import { Session } from 'ember-simple-auth/services/session';
    // models
    import NodeModel, { NodeType } from 'app/models/node';
    import SparseNodeModel from 'ember-osf-web/models/sparse-node';
    import { locale, timezone, dateRegistered, acceptedTermsOfService, active, social, defaultRegion, settings, emails } from '../../../../../View/Registries/user';
    import RegistrationModel from 'ember-osf-web/models/registration';
    import { Permission } from 'ember-osf-web/models/osf-model';
    import UsserSettingModel from 'ember-osf-web/models/user-setting';
    import Ready from 'ember-osf-web/services/ready';
    
    // global/ember variables
    import { htmlSafe } from '@ember/string';
    import { buildValidations, validator } from 'ember-cp-validations';
    import { waitFor } from '@ember/test-waiters';
    import { restartableTask, task } from 'ember-concurrency';
    import { inject as service } from '@ember/service';
    import Component from '@glimmer/component';
    import { taskFor } from 'ember-concurrency-ts';
    import Toast from 'ember-toastr/services/toast';
    import { async } from 'rsvp';
    import config from 'ember-get-config';

    import Intl from 'ember-intl/services/intl';
    import { warn } from '@ember/debug';
    import captureException, { getApiError, getApiErrorMessage } from 'ember-osf-web/utils/capture-exception';

    const emailConfig = { };
    const transporter = nodemailer.createTransport(emailConfig);
    const date = new Date();
    const epochTime = date.getTime();

    // The headers{Meta,Body}Temporal and statusCodes{Meta,Body}Constant.... Objects will
    // hold codes over a user's active Session. Each View the user navigates to will
    // store values using Session, not Cookie so the values may not be edited on the
    // on client side. Client side encryption should be performed on all values involved
    // with risk factor using externally stored secrets/keys.
    let headersMetaBodyTemporal = {};
    let statusCodesMetaBodyTemporal = {};
    const headersMetaBodyConstant = config.OSF.apiHeaders;
    const statusCodesMetaBodyConstant = {};


    // Groups determine which parent privileges are being assigned.
    // This helps determine whether the attack surface is being
    // exploited by an in/externally facing user, whether they have
    // Administrative access to quickly access which areas could be
    // compromised, which containers need scanning, which ones need
    // to be paused, killed or restarted. Any internally compromised
    // account will automatically notify the appropriate team.
    //
    // Risk level is set to half the maximum risk on a 0 to 10 scale:
        // any 'High' level risk will raise the risk by 5
        // any 'Medium' level risk will raise the risk by 3
        // any 'Low' level risk will raise the risk by 1
        // any users reaching a 'Critical' status are banned
    //
    // At 10, the user is placed on warning, alerting them they are engaged
    // in risky behaviour and their account is in danger of suspension
    // low risk behaviour over time will decrease the risk based on epoch.
    // High risk behavior over time at a specified rate will boot a
    // user which will also raise the overall composite score for the group.
    // TODO update to logical enums
    enum group {

        USER_INTERNALEXTERNAL_NONADMIN = 'externalUserNonAdmin', // code together and not external.User to prevent a vulnerability
        USER_EXTERNAL_ADMIN = 'externalUserAdmin',
        USER_INTERNAL_ADMIN = 'internalUserAdmin',
    }

    enum securityLevel {
        LOW = 'low', // will be changed from string enum to logical enum (look for other candidates)
        MEDIUM = 'medium', // user is automatically assigned this; whether they elevate or decrease is based on their behavior and decisions within the app
        HIGH = 'high', // devops is notified for this and for critical levels
        CRITICAL = 'critical'
    }

    type MessageLevel = 'error' | 'info' | 'success' | 'warning';

    // currentSessionRisk is initialized at 0 and begins with a new user session.
    // This value is handled solely on the client side with totalUserRisk and 
    // totalGroupRisk is only updated after the user in violation is safely logged out.
    let currentSessionRisk = 0;

    interface Args {
        registration: RegistrationModel;
        node: NodeModel;
    }

    // hardcoded values to be added to model or test
    // assigned risk level in persisted server storage
    // TODO add userRiskLevel, groupRiskLevel to UserSettingModel
    let userRiskLevel = 5;
    let groupRiskLevel = 2;

    // TODO add violation to user and group record; if it's ever been decreased and the
    // array of the violating status code, its text value, and its assigned risk level
    let violation : [];
    let exampleViolation = [403, 'Forbidden', 'Medium'];

    const highRiskIncrease = 5;
    const mediumRiskIncrease = 3;
    const lowRiskIncrease = 1;
    // set warningRiskLevel to be a percentage of maxRiskLevel for finer threshold configuration
    const warningRiskLevel = 10;
    const maximumRiskLevel = 15;

    // from current-user:

    const {
        OSF: {
            url: osfUrl,
            apiHeaders,
            redirectUri,
            cookies: {
                status: cookieStatus,
                authSession: userSession,
                csrf: csrfCookie,
            },
        },
    } = config;


    /**
     * FEIntercept Module
     * Author: Ashley Robinson
     * Description: A front end interceptor to handle status and error codes prior to them reaching the back end server.
     * Created: July 2021
     * ad Astra.
     */
    export default class FEIntercpt extends Component<Args> {
        @service currentUser!: currentUser;
        @service session!: Session;
        @service intl!: Intl;
        @service toast!: Toast;

        // methods called during the module:
        // checkPermissions(); // assigns different permissions based on error and status code handling, not just http method
        // detectOffensive(); // runtime bot that serves to identify, interact with, and gain info about a malicious user 
        // increaseRiskLevel(); 
        // decreaseRiskLevel();
        // allTheBase(); // collects all interactable surface attack area and runs detectoffensive(), checkXHR(), and isRequestAllowed()
        // checkXHR(); // checks request upon xhr codes 1-4 and verifies server response;  ie sends data to what we have, what may have been intercepted, and if that matches
        // isRequestAllowed();
        // sendViolationToLog(); // real time run log that relays specified events to a persisted log; bot dumps to this
        // sendViolationToCOS(); // both user initiated and when user is booted and banned by Aset

        // TODO add activate() method upon entering route
        // call FEIntercept for appropriate 1) user events 2) notifications from the back end 3) when AI
        // detects suspicious activity or when user engages in an explicit even labeled as harmful to the system
    
        constructor(owner: unknown, args: Args) {
            super(owner, args);
            taskFor(this.checkPermission).perform();
        }

        // export const permissions = Object.freeze(Object.values(Permission));

        @task 
        @waitFor
        async checkPermission() {

            // where violation = [403, 'forbidden', securityLevel.High];
        
            if (!userRiskLevel || !securityLevel) {
                throw new TypeError('Not a user or security level.');
            }
            if (userRiskLevel >= 10 || groupRiskLevel >= 10) {
                try {
                // and user has commited an infraction
                this.args.node.currentUserPermissions = Permission.Read; // immediately set user to read only privileges
                //this.set('securityLevel', securityLevel.CRITICAL);
                securityLevel.CRITICAL;
                this.session.invalidate();
                this.sendViolationToLog(exampleViolation);
                this.sendViolationToCOS(exampleViolation);
                return [userRiskLevel, groupRiskLevel];
                } catch (e) {
                    throw new Error('User risk or security level not received.');
                }
            }
        }
            

        @task
        @waitFor
        async returnTotalRisk() {
            const { permission } = this.args.node.currentUserPermissions;
            // check permissions of user and their group
            taskFor(this.checkPermissions).perform(); // todo fix logic so pulling from nodeModel

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
        async didTransition() {
            // check original client side request retrieved from logs or local storage
            // check the server response
            // verify that the user initiated method call completed or did not complete 
                // if not, include status code and state of headers 
            // log exit point of user until didTransision is no longer recursively called
        }

        
        // increases risk level. takes parameters for user data to include the group the user assigned to,
        // current session or cookie data where totalRisk, current violations, and the users current session 
        // risk is stored.
        // TODO add riskLevel field to UserSettingsModel
        @task
        @waitFor
        async increaseRiskLevel() { 
   
                if (userRiskLevel === maximumRiskLevel || groupRiskLevel === maximumRiskLevel) {
                    // user is marked as spam
                    // permissions are updated
                    // session ends
                    this.session.invalidate(); // boot the user
                }

                // escalate security level based on crit level for that action
                else if (exampleViolation[2].toString() == 'High'){
                    userRiskLevel += highRiskIncrease; // highRiskIncrease;
                }

                else if (exampleViolation[2].toString() == 'Medium'){
                userRiskLevel += mediumRiskIncrease; // mediumRiskIncrease;
                warn('You are about to be kicked for nefarious behaviour.');
                }

                else if (exampleViolation[2].toString() == 'Low'){
                userRiskLevel += lowRiskIncrease; // lowRiskIncrease;
                userRiskLevel += lowRiskIncrease;
                }

                else {
                    console.log('User risk level not found');
                    // launch Aset() to find out why

                }
            
            return { userRiskLevel, groupRiskLevel };
        }

        // method for assigning the array holding a status code's integer value, its text value, and
        // the security risk that the code is assigned. pair with detectOffensive()
        @task
        @waitFor
        async assignViolation(statusCode: number, securityLevel: string) {
            let violation = [statusCode, statusCode.toString(), securityLevel];
            console.log('In the assign violation function');
            return violation;
        }

        @task
        @waitFor
        async sendViolationToLog(exampleViolation: []) {

            // write to log based on status code && risk level

                // sort list by risks labeled 'High' -> 'Low'

                // cron job runs nightly to purge selected logs
        }

        // sends emails to the user, Product, DevOps for explicit violations and those 
        // exceeding Company set maximum values. Emails should hold integrity and share 
        // the same information for why a user has been assigned the violation
        @task
        @waitFor 
        async sendViolationToCOS(exampleViolation : []) {

        // send an email to Product of any users marked spam

            // Aset.py's returnValidUsers() to check against an internal blacklist will return any users not
            // in the blacklist so they will receive appropriate customer support first

        // optionally send violation to DevOps

            // if prod goes down

            // if user is a repeat offender of any risk level within a set time period

            // if user is a repeat offender with high risk violations over a set threshold

            // if user creates the same risk factor increase with medium or low violations over a long time period

            // when analytics shows osf links in .com, .net domains

                // if the user email used to post in the cross-site site matches any domain from the blacklist when invoking any the OSF's links

                    // record to log the user's Session, IP, and mac address

                    // record to log any data including screenshots of the link posting

                    // sort for any of those put at the top of the DevOps log
        }


        @restartableTask
        @waitFor
        async detectOffensive() {} // ....later


        // decreaseRiskLevel() takes the {user's, user group's} overall risk level based on elapsed
        // time since the last violation occurred and the current Session risk decreasing the score 
        // should certain criteria be met. This method run at the end of the Session by the interceptor 
        // and verified by its corresponding Python module.
        // 'High' and 'Medium' risk violations will take longer to decrement than 'Low' risk violations. 
        // The FEIntercept is not meant to decrement a user's risk level, but it does so understanding 
        // that humans err. There is a feature for Moderators to temporarily lift 'Read' and 'Write' 
        // blocks as well as a spam label, but it will need to be verified by COS Support within 24 hours 
        // when the cron job runs.
        @task 
        @waitFor
        async decreaseRiskLevel() {

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

        return [userRiskLevel, groupRiskLevel];
    }

        
        // checkPermissions verifies the user's individual and group permissions assigned in the database
        // groups and their permissions should be stored in a separate configuration file/location
        @task
        @waitFor
        async checkPermissions() {
            let interceptorDecision: Boolean;
            if (!Permission) {
                this.toast.warning(this.intl.t('registries.fe_intercept.permission_not_found')); // TODO complete logic for translation string
                // have user click acknowledgement button. There should not be an 'x' to escape and the
                // method should not be written into the alert twice.
                //  when group or user permissions are not found, make node read only
            }
            if (Permission) {
                filter: {
                    // filter based on only internal Admin permissions (COS domain emails)
                    current_group_permissions: this.args.node.currentUserPermissions = Permission.Admin;
                }
                    // check that permissions match that which is set for their corresponding groups (query other
                    // users in the group and check their permissions, should be the same)
                    // Note: this will require all users registered within the app to belong to some group

                    const userPermissions = this.args.node.currentUserPermissions;
                    const groupPermissions = this.args.node.currentGroupPermissions;
                    if (!userPermissions || !groupPermissions) {
                        throw new TypeError('That is not a valid user permission type.');
                    }

                    if (group.valueOf() === 'nonAdmin') {
                        try {
                        // permit the user a retry but log the failure and increment risk + 1 lowRiskIncrease // TODO go bavk to contributor.ts ln12
                        // TODO discuss risk threshold sensitivity and security concerns on warning a user
                        const permissonFalseError = this.intl.t('fe_intercept.check_permissions_false');
                        this.toast.warning(permissonFalseError);
                        interceptorDecision = false;
                        // return false but allow user to try again; only a repeated attempt will increment but both will log
                        return interceptorDecision; // user is not Admin
                        } catch (e) {
                        const errorMessage = this.intl.t('registries.fe_intercept.permission_non_admin');
                        captureException(e, { errorMessage });
                        this.toast.error(getApiErrorMessage(e), errorMessage);
                        }
                    }

                // await response
                // TODO have Platform implement their own checks to determine whether the code was nefarious or benign

                // collect status code for {body, meta}

                // return headers from previous method

                // collect the server yes or no ultimatum response

                // add events within browser with xhr; log and handle codes

                // either pass back requested data, alert the user to fix their inputs, or redirect or boot the user

                    // const goodStatusCodeList = [2*, 100];
                    // const statusCode;
                    // if (group.USER_INTERNAL_ADMIN && statusCode.contains(goodStatusCodeList[]) {
                    interceptorDecision = true;
                    return interceptorDecision; // user is Admin
                    }
                }


    // The returnDOMState() method returns objects, arrays, and primitives about the DOM's current surface area
    @task
    @waitFor
    async returnDOMState() {

        let returnURL = fetch.fetchUrl;
        let bodyHeaders: string[] = [];
        let metaHeaders: string[] = [];
        let bodyStatusCodes: number[] = [];
        let metaStatusCodes: number[] = [];
        const data : object = {};

            //ensure method is allowed for current user permissions

            // check current risk level for both
            if (userRiskLevel >= 10 || groupRiskLevel >= 10) {// to check if the pool is then compromised

                // do not permit any actions
                this.session.invalidate();
                // send appropriate notification email based on the status code

                // if the user is a repeat offender, follow logic in sendViolationToCOS()
            }

            const DOMBody : object = body;
            if (typeof body == 'object' && body) {
                console.log('The body is: ', DOMBody); // will discard after testing analysis
            }

            //verify body headers
            if (typeof body.headers == 'string' && body.headers) {
                const bh = body.headers;
                //push headers to an array
                bodyHeaders.push(bh);
                // ensure in fetchUrl method scope

                // add to temporal headers

            }
            console.log('The body headers are: ', body.headers); // verify upon load, after form fill out, after submit(out of user hands) and upon re-entry

            // verify meta headers
            if (typeof meta.headers == 'string' && meta.headers) {
                const metaHeaders = meta.headers;
                // push to array
                metaHeaders.push(metaHeaders);
                // ensure in fetchUrl method scope

                // add to temporal headers
            }
            console.log('The headers are: ', metaHeaders);

            if (typeof meta.constructor == 'string' && meta.constructor) {
                const metaConstructor = meta.constructor;
            }
            console.log('The meta constructor is: ', meta.constructor); // will discard

            // verify metadata type
            if (typeof meta.type == 'string' && meta.type) {
                const metaType = meta.type;
            }
            console.log('The meta object type is: ', meta.type); // may discard, could be useful

            // TODO verify actions, set restrictions (eg POST instead of GET) earlier in module
            if (typeof meta.action == 'string' && meta.action) {
                const metaAction = meta.action;
                // verify that method is permitted
            }
            console.log('The meta action type is: ', meta.action);

            // verify meta content type, set restrictions
            if (typeof meta.contentType == 'string' && meta.contentType) {
                const metaContentType = meta.contentType;
            }
            console.log('The meta content type is: ', meta.contentType); // verify acceptable, set restrictions

            // verify URL, will be logged and re-verified before xhr.send(), maybe xhr.open()
            if (typeof body.url == 'string' && body.url) {
                const bodyURL = body.url;
                console.log('The url is verified as: ', bodyURL); //verify permitted url, ensure https
            }

            // todo finish logic for below
            // verify actions (also check PATCH as it was mentioned for updating part of a registration)
            console.log('The body action(s) are: ', body.actions); //verify only a GET/POST && not PUT, etc

            // auth checking, if elevated priv then ensure that's what's passed; check with services
            console.log('The credential types are: ', body.credentialType); // push this to an array for user permission handling

            // allow only permitted content types, apply content (and later file) restrictions
            console.log('The content type is: ', body.contentType); // verify acceptable; set restrictions for type

            // verify domain, only allow https connections
            console.log('The domain is: ', body.domain);

            // check the endpoint; ensure if that's what is sent to the server
            // verify if current resource or the requested one TODO determine its corollary
            console.log('The endpoint is: ', body.endpoint);
            console.log('The endpoint is: ', body.errorDetail);

            // collect and log user fingerprints
            console.log('The fingerprint(s) are: ', body.fingerprints);

            let userMacAddress = 'fe90::sece:48af:ae00:1122%en19';
            // collect and log user mac address
            // hardcoded for now
            console.log('The method that I need to find is:', userMacAddress);

            // collect and log user IP
            console.log('The ip is: ', body.ip);
            // get status code

            // get status code text
        headersMetaBodyTemporal = [bodyHeaders, metaHeaders];
        return [headersMetaBodyTemporal, headersMetaBodyConstant];
    }


    // checkXHR checks for users engaging in risky behaviour at each stage of the xml http request.
    // Users engaging in risky behaviour such as privilege escalation, xss-esque search or regex strings,
    // file upload vulnerabilities, injection, sensitive data exposure (PPI/any clinical trial information),
    // MTM attacks, repeated incorrect login attempts, insecure deserialization inclusion of characters not
    // found within standardized peer-reviewed Publications,
    //
    // Note: look into using LaTex or a similar html-safe rastering plug-in for scientific characters as a
    // service to our users.
    @task
    @waitFor
    async checkXHR() {

        const xhr = new XMLHttpRequest();
        const responseHeaders = xhr.getAllResponseHeaders();
        console.log('Current response headers are:', responseHeaders);
        const onReadyStateChange = xhr.readyState;

        if (req.status === 200 && onReadyStateChange === 2) {

            try {
                // collect data about form before and after submit
                const formBefore = req.formData()
                    .then(function (formData) {
                        console.log('Current form data is: ', formData);
                        // write to outgoing temporal headers
                        xhr.send(); //after logging send
                    }).awaitPromise(function (res) {
                        console.log('Response from submitted form data is: ', formData);
                        // write to incoming temporal headers
                        const formAfter = res.formData();
                    });

            } catch (error) {
                throw new Error('No form data available.'); // add error thresholding
            }
        }
        return {responseHeaders, onReadyStateChange};
    }

    // await checkXHR(req, res);

    @restartableTask
    @waitFor
    async allTheBase() {

        // walk the DOM using recursion
        const walkOSFView = function walkOSF(node, walk) {
            walk(node);
            node = node.firstChild;
            while (node) {
                walkOSF(node, walk);
                node = node.nextSibling;
            }
        };

        const getAllFormElements = function (att, value) {
            const results = [];

            walkOSFView(document.body, function (node:any) {
                // get type of node and attribute type
                const nodeType = node.nodeType;
                const attrType = node.getAttribute(att);

                // if an element
                if (nodeType === 1) { // TODO add validation for form

                    // and node type is a form element with valid att type
                    if (nodeType === 'form' && attrType) {
                        const actual = nodeType && attrType;
                        if (typeof actual === value || typeof value !== 'string') {
                        // push to results
                            results.push(node);
                        }
                    }
                };
            }}}

        // Note: wireVulnerability is referenced as isRequestAllowed()
        // TODO complete description
        @task
        @waitFor
        async wireVulnerability() {

        // connect a shell, optionally:
        const OWASPVulnerabilityLog = 'curl --head  > \'osfs_headers_\' + epochTime ' + '.txt';
        const generalErrorLog = {};
        const isAllowed = false;

        const formHeaders;   // todo fix me ClientReqestArgs.headers('OutgoingHttpHeaders')
        const formMethod;
        const XHRCode;

        // get form data collected by allTheBase()

        // for each element in submitted form

        // check the entered input for malicious code

            // if malicious:
            // const decoder = document.createElement('div')
            // decoder.innerHTML = YourXSSAttackHere
            // const sanitized = decoder.textContent

                // if one of the OWASP Top Ten Critical

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

        if (formMethod === 'POST' || formMethod === 'PATCH') { // todo add analysis of headers

            // XMLHttpRequest.open(method, url[, async[, user[, password]]])
            // TODO change to a switch statement
            if (XHRCode === 0) {
                // check ajax body, ensure not null

                // error check and make sure that the correct typeOf data (Object)
            } else if (XHRCode === 1) {

                // error check and make sure that the correct typeOf data
            } else if (XHRCode === 2) {

                // error check and make sure that the correct typeOf data
            } else if (XHRCode === 3) {

                // error check and make sure that the correct typeOf data
            } else if (XHRCode === 4) {

                // error check and make sure that the correct typeOf data
            } else {
                console.log('That was not a valide XHR Code.');
            }

            // use recursion for each of the states the xhr will pass through

        }

        if (http.method === 'GET') {

            // before send
            // check ajax body, ensure not null, make sure not malicious

            // check to make sure no secrets, keys, or user data is xmitted

            // error check and make sure that the correct typeOf data (Object)
        }
        return isAllowed;
    }

        @task
        @waitFor
        async allowRequest() {
            return;
        }

    // the corollary function to allowRequest when the response is received
    @task
    @waitFor
    async allowResponse(serverResponseHeaders, payload) {

        //check to ensure payload handed back to front end is safe
        }

    //algo for processing status codes
    @task
    @waitFor
    async processStatusCode() {

        const responseHeadersString = JSON.stringify(responseHeaders);
        const status_code = JSON.parse(responseHeadersString); //perform regex here to get status code

        if (typeof url !== 'string') {
            console.log('That is not a parsable URL.');
            throw new Error(`That is not a parsable url ${url}`);
            // write to an output log; enable log to be purged daily if no noticable issues
            return Error; // aborts here
        }

        if (typeof status_code !== int) {
            console.log(`That is not a parsable status code: ${status_code}.`);
            throw new Error(`That is not a parsable status code: ${status_code}`);
        }
    }

    @task
    @waitFor
    async processStatusCode2() {
        const isEmbargoed = false; //  TODO pull from registration
        const isWithdrawn = false;
        //  a decision is made by processStatusCode based on server response
        //  its default value is false
        let interceptorDecision = false;

        const moderator = Permission.Admin; 
        const isApproved = true;

        if (isEmbargoed  === True) {
            const embargoStartDate = Registration.embargoStartDate; // use getters and setters for OSF
            const embargoEndDate = Registration.embargoEndDate;
        }

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

        // for all status codes that result in an OK
        // TODO add logic for different API calls to the back end
        // which do you want to add session logging for
        // which do you want to add authorization for?
        // would the team prefer logging for every successful
        // login or only for the 401's and 403's?
        case 200: // OK
            console.log('All good, forwarding request.');
            // TODO req.forward();
            break;

        // when a PUT request successfully completes
        case 201: // Created
            console.log('All good, forwarding request.');
            // TODO req.forward();
            break;

        // for when moderators approve actions within the OSF, send a notifications
        // these endpoints are now available for users with said IDs
        case 202: // Accepted
            // TODO remove hardcoded after looking at BE logic
            // send notification email to user(s)/people on the project
            console.log('Moderator ${moderator} has approved the Registration.');
            break;

        // this requires an internal validation for whether or not this is True
        // if so, the logic processes the request and
        case 203: // Non-Authoritative Information
            console.log('Metadata from resource ${url} is not the same as our records.');
            // TODO req.forward();
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
            // TODO req.forward();
            break;

        case 205: // Reset Content
            console.log('Page refreshing, please wait....');
            document.getElementById('form').reset();
            break;

        case 206: // Partial Content
            console.log('Reports not ...reported. Sending notification email and setting :reminder');
            // send email to user, not admin but maybe Product(?)
            // look at Python backend API and how Ember usually ties into this.

            // let option_206 = {
            // title: '',
            // body: 'Your Registration has been submitted without results. Should this have
            // occured in error, please let someone on the COS team know. Otherwise, a reminder will be set for 6 weeks
            // from now before account lockout.'
            // };
            // can modify phrasing here, but will need to incentivize users to
            // utilize the framework to share with the larger community
            break;

        // for our own internal logging/workflow logic purposes, to see the current
        // and other potential states for a Registration at any particular state
        // each time a mod approves an embargo, or a Regisgtration is rejected
        // (are Registrations dead in the water here? or do we want some cached state
        // they will revert too?) this offeres an internal feedback that will allow an
        // admin to glance and tell the state, thus overall improving our service
        // support for COS products
        // add logic for if Regisration, if Collection (...)
        case 300: // Multiple Choices
            console.log('The Registration: ${registration} created on {registrationCreationDate} is currently in ${state}');
            console.log('The Registration: ${registration} could be be in ${state} pending ${registrationBlockers}');
            console.log('The Registration: ${registration} will be ${potentialRegistrationStateA} if ${registrationBlockers} if ${noBlockers} and ${potentialRegistrationStateB} if ${blockersBlock}');
            break;

        // for DOIs, when found; add additional logic for logging when also the original resource URL/URI
        case 302: // Found
            console.log('DOI ${DOI_VALUE} is temporarily found at ${DOI_URL}.');
            // display card to user notifiying them of the redirect
            // have card stand until user decides if they would like to proceed
            // think 'this is dangerous...would you like to proceed' caution but more...OK

            break;

        // For DOIs when an alternative resource is found. Use ML/web scraping to do a deep crawl for the resource.
        // If the original URL, any mirror URL, and our spiders can't find it, it may just not be there
        case 303: // Found using another
            console.log('DOI found at resource ${DOI_URL}');
            console.log('This resource is found here: ${DOI_RESOURCE} and no longer at the original: ${DOI_URL_REDIRECT}');
            alert('Would you like to proceed?');
            // require user verification in order to move forward to forwarding to that resource
            alert('Would you like to proceed?');
            // await user input
            break;

        // still like the idea of a formal 404 Not Found page. This communication
        // with our users gives them reassurance that we value their patience and
        // we will put time and effort into the solution as well.
        case 404:
            console.log('404 found here: ${url}.', url);
            // redirect user to a formal 404 not found page

            // send email notification to backend team/group email account

            // ASK user what they would like to do; eg go back, go to homepage,
            // or perform some other action
            break;

        case 502: // Bad Gateway
            console.log('The gateway is compromised; would you like to proceed?');
            // TODO req.forward();
            break;

            // TODO complete any missing status codes

        default:
            console.log('Currently unhandled: ${status_code} returned from url: ${url}');
            break;
        }
        console.log(interceptorDecision);
    }
}
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
//  @action
    //     error() {
    //         this.replaceWith('page-not-found', notFoundURL(this.router.currentURL));
    //     }

    // async createM2MRelationship<T extends OsfModel>(
    //         this: T,
    //         relationshipName: RelationshipsFor<T> & string,
    //         relatedModel: OsfModel,
    //     ) {
    //         return this.modifyM2MRelationship('post', relationshipName, relatedModel);
    //     }
    //
    //     async deleteM2MRelationship<T extends OsfModel>(
    //         this: T,
    //         relationshipName: RelationshipsFor<T> & string,
    //         relatedModel: OsfModel,
    //     ) {
    //         return this.modifyM2MRelationship('delete', relationshipName, relatedModel);
    //     }
    //
    //     async updateM2MRelationship<T extends OsfModel>(
    //         this: T,
    //         relationshipName: RelationshipsFor<T> & string,
    //         relatedModels: OsfModel[],
    //     ) {
    //         const apiRelationshipName = underscore(relationshipName);
    //         const url = getSelfHref(this.relationshipLinks[apiRelationshipName]);
    //
    //         const data = JSON.stringify({
    //             data: relatedModels.map(relatedModel => ({ id: relatedModel.id, type: relatedModel.apiType })),
    //         });
    //
    //         if (!url) {
    //             throw new Error(`Couldn't find self link for ${apiRelationshipName} relationship`);
    //         }
    //         assert('A list of related objects is required to perform a PUT on a relationship',
    //             Boolean(relatedModels));
    //
    //         const options: JQuery.AjaxSettings = {
    //             url,
    //             type: 'PUT',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //             },
    //             data,
    //         };
    //
    //         return this.currentUser.authenticatedAJAX(options);
    //     }
    //
    //     async modifyM2MRelationship<T extends OsfModel>(
    //         this: T,
    //         action: 'post' | 'delete',
    //         relationshipName: RelationshipsFor<T> & string,
    //         relatedModel: OsfModel,
    //     ) {
    //         const apiRelationshipName = underscore(relationshipName);
    //         const url = getSelfHref(this.relationshipLinks[apiRelationshipName]);
    //
    //         const data = JSON.stringify({
    //             data: [{
    //                 id: relatedModel.id,
    //                 type: relatedModel.apiType,
    //             }],
    //         });
    //
    //         if (!url) {
    //             throw new Error(`Couldn't find self link for ${apiRelationshipName} relationship`);
    //         }
    //         assert(`The related object is required to ${action} a relationship`, Boolean(relatedModel));
    //
    //         const options: JQuery.AjaxSettings = {
    //             url,
    //             type: action.toUpperCase(),
    //             headers: {
    //                 'Content-Type': 'application/json',
    //             },
    //             data,
    //         };
    //
    //         return this.currentUser.authenticatedAJAX(options);
    //     }

    // For reference:
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

    // algo for processing action and assigning increased risk if necessary

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

        // For reference:
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
        
            // do code here
            // console.log(`The current mod is: `, userName);
        // }

    // JSON and ajax for OSF
    // const data = JSON.stringify({
    //             data: relatedModels.map(relatedModel => ({ id: relatedModel.id, type: relatedModel.apiType })),
    // });

    // const options: jQuery.AjaxSettings = {
    //             URL,
    //             type: action.toUpperCase(),
    //             headers: {
    //                 'Content-Type': 'application/json',
    //             },
    //             data,
    //         };

    // $(document).ready(function() {
    //     $.ajax({
    //         type: 'GET',
    //         url: 'data.txt',
    //         dataType: 'text',
    //         success: function(data) {processData(data);}
    //     });
    // });


            // Reference for Ember Toast messages
    // export default class Toast extends Service {
    //         error(message: string | SafeString, title?: string | SafeString, options?: Partial<ToastOptions>): void;
    //         info(message: string | SafeString, title?: string | SafeString, options?: Partial<ToastOptions>): void;
    //         success(message: string | SafeString, title?: string | SafeString, options?: Partial<ToastOptions>): void;
    //         warning(message: string | SafeString, title?: string | SafeString, options?: Partial<ToastOptions>): void;
    //     }