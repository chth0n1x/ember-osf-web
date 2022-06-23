const rssCardTemplate = '<dl>' + '<dt data-test-registration-template-name>' + title + '</dt>' +
    '<dd data-test-contributors>' + contributors + '</dd>' +
    '<dd data-test-date-created>' + dateCreated + '</dd>' +
    '<dd data-test-last-modified>' + lastModified + '</dd>' +
    '<dd data-test-description>' + description + '</dd>' + '<br />' + '</dl>';

// TODO try linking model as below
const contributorsTemplate = '<dd>' + '<ContributorList @' + model + '={{@node}} @shouldLinkUsers={{true}} />' +
    '</dd>' + '<br />' + '<dd>' + '<TagsWidget @taggable={{@node}} @inline={{true}} />' + '</dd>' + '</dl>';
