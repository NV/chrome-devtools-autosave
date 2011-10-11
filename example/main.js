'use strict';

window.addEventListener('load', function(event) {

    document.body.className += ' loaded';

    document.body.addEventListener('click', function(event) {
        console.log('click', event);
    }, true);

}, false);
