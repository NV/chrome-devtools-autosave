'use strict';

var diffMatchPatch;
/**
 * @param {Function} onload
 */
function loadDiffMatchPatch(onload) {
    var script = document.createElement('script');
    script.src = 'diff_match_patch.js';
    script.onload = function() {
        diffMatchPatch = new diff_match_patch();
        onload();
    };
    document.head.appendChild(script);
}

/**
 * @return {Object}
 */
function createResourceMap() {
    var map = {};
    function assertKey(key) {
        if (!key) {
            throw new Error('key is ' + JSON.stringify(key));
        }
    }
    return {
        get: function(key) {
            assertKey(key);
            if (!map.hasOwnProperty(key)) {
                throw new Error('resourceMap does not have "' + key + '" key.');
            }
            return map[key];
        },
        set: function(key, value) {
            assertKey(key);
            map[key] = value;
        }
    };
}

var resourceMap;
var lastStylesheetURL = '';
var addedCSS = '';

/**
 * @param {Object} event
 * @nosideeffects
 * @return {boolean}
 */
function isNewlyAdded(event) {
	return event.url.indexOf('inspector://') == 0 || event.type === 'document';
}

chrome.devtools.inspectedWindow.onResourceContentCommitted.addListener(function(event) {

    if (isNewlyAdded(event)) {
        if (lastStylesheetURL) {
            getBackend(lastStylesheetURL);
        } else {
            getLastStylesheetURL(getBackend);
        }
    } else {
        getBackend(event.url);
    }

    function getBackend(url) {
        chrome.extension.sendRequest({method: 'getBackend', url: url}, function(response) {

            if (!response) {
                console.error(url + ' doesn’t match any rules in the DevTools Autosave options.');
                return;
            }

            event.getContent(function(content) {
                if (diffMatchPatch) {
                    sendToBackgroundPage();
                } else {
                    loadDiffMatchPatch(sendToBackgroundPage);
                }

                function sendToBackgroundPage() {
                    var patch;
                    if (isNewlyAdded(event)) {
                        var oldAddedCSS = addedCSS;
                        if (content) {
                            addedCSS = '\n' + content + '\n';
                        } else {
                            addedCSS = '';
                        }
                        patch = diffMatchPatch.patch_make(resourceMap.get(lastStylesheetURL) + oldAddedCSS, resourceMap.get(lastStylesheetURL) + addedCSS);
                    } else {
                        patch = diffMatchPatch.patch_make(resourceMap.get(url), content);
                        resourceMap.set(url, content);
                    }

                    chrome.extension.sendRequest({
                        method: 'send',
                        content: JSON.stringify(patch),
                        url: response.serverURL,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-URL': url,
                            'X-Path': response.savePath,
                            'X-Type': event.type
                        }
                    });
                }
            });
        });
    }
});

/**
 * @param {Function} onSuccess
 */
function getLastStylesheetURL(onSuccess) {
    lastStylesheetURL = '';
    chrome.devtools.inspectedWindow.eval('(function() {\n\
    var links = document.head.querySelectorAll("link[rel=stylesheet][href]");\n\
    var last = links[links.length - 1];\n\
    return last && last.href})()', function(href, fail) {
        if (fail || !href) {
            throw new Error('Cannot find link[rel=stylesheet][href] in the head.');
        }
        lastStylesheetURL = href;
        onSuccess(href);
    });
}

/**
 * @param {Resource} resource
 */
function addResource(resource) {
    var url = resource.url;
    if (!url || url === 'about:blank') {
        return;
    }
    switch (resource.type) {
        case 'stylesheet':
        case 'script':
            resource.getContent(function(content) {
                resourceMap.set(url, content);
            });
            break;
    }
}

chrome.devtools.inspectedWindow.onResourceAdded.addListener(addResource);

function getAllResources() {
    resourceMap = createResourceMap();
    chrome.devtools.inspectedWindow.getResources(function(resources) {
        resources.forEach(addResource);
    });
}

getAllResources();

chrome.devtools.onReset.addListener(function() {
    console.log('Reloaded');
    addedCSS = '';
    getAllResources();
});
