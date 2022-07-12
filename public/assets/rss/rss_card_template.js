/* eslint-disable no-console */
let title;
let contributors;
let dateCreated;
let lastModified;
let description;
let action;
let buttonText;
let model;

const rssCardTemplate = '<dl>' + '<dt data-test-registration-template-name>' + title + '</dt>' +
    '<dd data-test-contributors>' + contributors + '</dd>' + '<br />' +
    '<dd data-test-date-created>' + dateCreated + '</dd>' + '<br />' +
    '<dd data-test-last-modified>' + lastModified + '</dd>' + '<br />' +
    '<dd data-test-description>' + description + '</dd>' + '<br />' + '</dl>' +
    '<BsButton @onclick={{' + action + '}}>' + buttonText + '</BsButton>';

const rssCard = '<div class="card" local-class="RegistrationCard">' +
    '<dl data-test-rss-card>' + '<dt>' + title + '</dt>' +
    '<dd data-test-contributors>' + contributors + '</dd>' + '<br />' +
    '<dd data-test-date-created>' + dateCreated + '</dd>' + '<br />' +
    '<dd data-test-last-modified>' + lastModified + '</dd>' + '<br />' +
    '<dd data-test-description>' + description + '</dd>' + '</dl>' +
    '<div class="like-btn" style="width:50px; height: 50px; border: 1px solid #000;">' + likeButton + '</div>' +
    '<div class="dislike-btn" style="width:50px; height: 50px; border: 1px solid #000;">' + dislikeButton + '</div>' +
    '<div class="favorite-btn" style="width:50px; height: 50px; border: 1px solid #000;">' + favoriteButton + '</div>' +
    '<div class="hidden" data-test-description>' + String(innerKeyId) + '</div>' + '</div>';

const buttonTemplate = '<BsButton @onclick={{' + action + '}}>' + buttonText + '</BsButton>';

const contributorsTemplate = '<dd>' + '<ContributorList @' + model + '={{@node}} @shouldLinkUsers={{true}} />' +
    '</dd>' + '<br />' + '<dd>' + '<TagsWidget @taggable={{@node}} @inline={{true}} />' + '</dd>' + '</dl>';

const increaseLikes = '<div class="container">' + '<div id="increaseLikes">' +
'<input type="image" id="up-arrow" src="up_arrow.png" />' + '</div>' +
'<div id="totalCount">' + '</div>' +
'<div id="decreaseLikes">' + '<input type="image" id="down-arrow" src="down_arrow.png" />' + '</div>';
console.log(rssCard);
console.log(increaseLikes);
console.log(rssCardTemplate);
console.log(contributorsTemplate);
console.log(buttonTemplate);
//     document.querySelector('#foo').classList.add('myClass');
// });
