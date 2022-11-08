FEIntercept
An interactive security module
README
Created: 1667854758
Modified: 1667854758

# About

 This Module analyzes http requests, their responses and provides error
 handling for users within the application. The aim of this project is
 to reduce the overall work on the back end servers and increase user experience within the
 app for all users. Users and user sessions are assigned an overall reputation and risk
 score that influences certain actions available to them while within the application.

 Should the user's individual score exceed a certain threshold and based on the type of
 violation, the user will either be issued an in-browser warning, their account will be banned
 and marked as spam, or they will simply be prompted to re-verify their credentials to prevent logout.

 Following a significant increase or decrease to their score, an email will be sent
 with the violation and the opportunity to follow-up to prevent their account from being banned.
 Should the user continue to engage in risky behavior, they will be banned,
 their group risk score increases, and they will be redirected to the Login Gateway.

 For Accounts that regularly publish spam content, this aims to be a tool that can also
 identify, log, track, and detain or collect information about its source so the Company
 may Provision and Maintain a Secure Network Application within the OSF.

# Usage
