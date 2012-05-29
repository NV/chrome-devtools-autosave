'use strict';

localStorage.ROUTE_SCHEMA = 'id,match,savePath';
localStorage.SERVER_SCHEMA = 'id,url';

if (!localStorage.routes) {
    // First run after installation
    localStorage.routes = JSON.stringify([{
        id: '0',
        match: '^file://[^/]*/',
        savePath: '/'
    }]);
    localStorage.servers = JSON.stringify([{
        id: '0',
        url: 'http://127.0.0.1:9104'
    }]);
} else if (!localStorage.servers) {
    // First run after updating to version 1.x
    (function migrateRules() {
        var routes = JSON.parse(localStorage.routes);
        var endsWithSave = /\/save$/;
        var servers = [];
        var serversSet = {};
        var id = 0;
        for (var i = 0, ii = routes.length; i < ii; i++) {
            var route = routes[i];
            var updatedTo = route.to.replace(endsWithSave, '');
            if (serversSet.hasOwnProperty(updatedTo)) {
                route.id = serversSet[updatedTo];
            } else {
                serversSet[updatedTo] = route.id = id.toString();
                servers.push({url: updatedTo, id: id.toString()});
                id++;
            }
            delete route.stylesheet;
            delete route.script;
            delete route.document;
            delete route.to;
        }
        localStorage.servers = JSON.stringify(servers);
        localStorage.routes = JSON.stringify(routes);
    })();
}

/**
 * @nosideeffects
 * @return Array
 */
function getRoutes() {
    var json = localStorage.routes;
    if (!json) {
        return [];
    }
    var requiredFields = localStorage.ROUTE_SCHEMA.split(',');
    var routes = JSON.parse(json);
    OUTER: for (var i = routes.length; i--;) {
        var route = routes[i];
        for (var j = requiredFields.length; j--;) {
            if (!route[requiredFields[j]]) {
                routes.splice(i, 1);
                continue OUTER;
            }
        }
        route.match = new RegExp(route.match);
    }
    return routes;
}

/**
 * @nosideeffects
 * @return Array
 */
function getServers() {
    return localStorage.servers ? JSON.parse(localStorage.servers) : [];
}

/**
 * @param {Object} request
 * @nosideeffects
 * @return Object
 */
function getBackend(request) {
    var routes = getRoutes();
    for (var i = 0; i < routes.length; i++) {
        var route = routes[i];
        if (!route.match.test(request.url)) {
            continue;
        }
        var servers = getServers();
        for (i = 0; i < servers.length; i++) {
            if (servers[i].id === route.id) {
                return {
                    serverURL: servers[i].url,
                    savePath: urlToPath(request.url.replace(route.match, route.savePath))
                };
            }
        }
    }
    return null;
}

/**
 * @param {string} url
 * @nosideeffects
 * @return {string}
 */
function urlToPath(url) {
    var queryIndex = url.indexOf('?');
    if (queryIndex !== -1) {
        url = url.slice(0, queryIndex);
    }
    if (/^\/[C-Z]:\//.test(url)) {
        // Oh, Windows.
        url = url.slice(1);
    }
    return decodeURIComponent(url);
}

/**
 * @param {number} major
 * @param {number} minor
 * @nosideeffects
 * @return {Object}
 */
function versionPair(major, minor) {
    return {
        major: parseInt(major),
        minor: parseInt(minor),
        toString: function() {
            return this.major + '.' + this.minor;
        }
    }
}

var protocolVersion = versionPair(1, 0);

/**
 * @param {Object} request
 */
function sendToBackend(request) {
    var xhrHandshake = new XMLHttpRequest();
    xhrHandshake.open('GET', request.url, true);

    function onError(event) {
        var error;
        if (event.target.status == 0) {
            error = 'Autosave Server doesn\'t run on ' + request.url;
        } else if (event.target.status >= 300) {
            error = event.target.responseText;
        }
        if (error) {
            webkitNotifications.createNotification('', '', error).show();
        }
        return error;
    }

    xhrHandshake.onerror = onError;

    xhrHandshake.onload = function(event) {
        if (onError(event)) {
            return;
        }
        var versionMatch = xhrHandshake.responseText.match(/DevTools Autosave (\d+)\.(\d+)/);
        var serverVersion = versionPair(versionMatch[1], versionMatch[2]);
        if (serverVersion.major !== protocolVersion.major) {
            var error = 'Cannot save. ';
            if (serverVersion.major < protocolVersion.major) {
                error += 'Autosave Server ' + serverVersion + ' is out of date. Update it by running `npm install -g autosave@' + protocolVersion + '` in the terminal.';
            } else {
                error += 'You\'re using an old version of DevTools Autosave extension (' + protocolVersion[0] + '.x) that is incompatible with Autosave Server ' + serverVersion + '.';
            }
            webkitNotifications.createNotification('', '', error).show();
            console.error(error);
            return;
        } else if (serverVersion.minor !== protocolVersion.minor) {
            if (serverVersion.minor < protocolVersion.minor) {
                console.info('Autosave Server is using a slightly older version of Autosave protocol (' + serverVersion + ') than Chrome DevTools Autosave (' + protocolVersion + '). You might want to update the server by running `npm install -g autosave@' + protocolVersion + '` in the terminal.');
            } else {
                console.info('DevTools Autosave extension is using a slightly older version of Autosave protocol (' + protocolVersion  + ') than Autosave Server (' + serverVersion + '). You might want to update the extension.');
            }
        }
        var xhr = new XMLHttpRequest();
        xhr.open('POST', request.url, true);
        xhr.setRequestHeader('x-autosave-version', protocolVersion.toString());
        var headers = request.headers;
        for (var key in headers) {
            xhr.setRequestHeader(key, headers[key]);
        }
        xhr.onload = xhr.onerror = onError;
        xhr.send(request.content);
    };

    xhrHandshake.send(null);
}


/**
 * @param {Object} request
 * @param {MessageSender} sender
 * @param {Function} sendResponse
 */
function onRequest(request, sender, sendResponse) {
    if (request.method == 'getBackend') {
        sendResponse(getBackend(request));
    } else if (request.method == 'send') {
        sendToBackend(request);
    }
}


chrome.extension.onRequest.addListener(onRequest);
chrome.extension.onRequestExternal.addListener(onRequest);
