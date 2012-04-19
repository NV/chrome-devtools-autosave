'use strict';

var routes = [
    {
        from: /^file:\/\/[^/]*\//,
        to: '/'
    }
];
var port = 9104;
var address = '127.0.0.1';
var version = '0.3.2';

function start(routes, port, address) {

    var fs = require('fs');

    require('http').createServer(function(request, response) {

        if (request.url !== '/save') {
            response.writeHead(200);
            response.end('DevTools Autosave ' + version + ' is running well.');
            return;
        };

        var url = request.headers['x-url'];

        if (!url) {
            internalServerError('X-URL header is missing');
            return;
        }

        var matches;
        for (var i = 0; i < routes.length; i++) {
            var route = routes[i];
            if (route.from.test(url)) {
                matches = true;
                break;
            }
        }

        if (!matches) {
            if (i === 1) {
                internalServerError(url + ' doesn’t match a route ' + route.from);
            } else {
                internalServerError(url + ' doesn’t match any of the following routes:\n' + routes.map(function(a) {
                    return a.from;
                }).join('\n'));
            }
            return;
        }

        var path = url.replace(route.from, route.to);

        if (/\/[C-Z]:\//.test(path)) {
            // Oh, Windows.
            path = path.slice(1);
        }

        var queryIndex = path.indexOf('?');
        if (queryIndex !== -1) {
            path = path.slice(0, queryIndex);
        }

        path = decodeURIComponent(path);

        var chunks = [];
        request.on('data', function(chunk) {
            chunks.push(chunk);
        });

        request.on('end', function() {
            var stream = fs.createWriteStream(path);
            for (var i = 0; i < chunks.length; i++) {
                stream.write(chunks[i]);
            }
            stream.on('error', function(error) {
                console.error(error.message);
                internalServerError(error.message);
            });
            stream.on('close', function() {
                response.writeHead(200);
                response.end('OK\n');
                var date = new Date();
                var dateString = ('0' + date.getDate()).slice(-2) + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + date.getFullYear();
                console.log(dateString + ' ' + date.toLocaleTimeString() + ': Saved a ' + request.headers['x-type'] + ' to ' + path);
            });
            stream.end();
        });

        function internalServerError(message) {
            response.writeHead(500);
            response.end(message);
        }

    }).on('error', function(err) {
        if (err.code === 'EADDRINUSE') {
            console.log('http://' + address + ':' + port + ' is already in use. Exiting.');
        }
    }).listen(port, address, function() {
        console.log('DevTools Autosave ' + version + ' is running on http://' + address + ':' + port);
    });
}

if (module.parent) {
    // Loaded via module, i.e. require('index.js')
    exports.start = start;
    exports.routes = routes;
    exports.defaultPort = port;
    exports.defaultAddress = address;
    exports.version = version;
} else {
    // Loaded directly, i.e. `node index.js`
    start(routes, port, address);
}
