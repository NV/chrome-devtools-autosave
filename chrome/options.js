'use strict';

function Rules() {}
Rules.prototype = {

    NAME: '',
    FIELD_NAMES: [],

    initialize: function() {
        this.element = byId(this.NAME);
        this.rules = JSON.parse(localStorage.getItem(this.NAME));
        this.dummy = getDummy(this.NAME);
        this.ruleElements = this.element.getElementsByClassName('rule');
        return this;
    },

    createItem: function() {
        return this.dummy.cloneNode(true);
    },

    save: function() {
        var form = this.element;
        var rules = this.rules;
        rules.length = 0;
        var empty;
        for (var i = 0; i < form.length; i++) {
            var item = form[i];
            if (item.tagName == 'FIELDSET') {
                empty = true;
            } else {
                if (!item.name || !item.value) {
                    continue;
                }
                if (empty) {
                    if (item.name === 'id') {
                        // <input name=id> always comes last.
                        // It falls here when all the other inputs are empty.
                        continue;
                    }
                    empty = false;
                    var rule = {};
                    rules.push(rule);
                }
                rule[item.name] = item.value;
            }
        }
        this.saveToStorage(rules);
    },

    saveToStorage: function(rules) {
        localStorage.setItem(this.NAME, JSON.stringify(rules));
    },

    getEmptyFields: function(rule) {
        var result = [];
        for (var i = this.FIELD_NAMES.length; i--;) {
            var name = this.FIELD_NAMES[i];
            if (!rule[name]) {
                result.push(name);
            }
        }
        return result;
    },

    draw: function() {
        var fragment = document.createDocumentFragment();
        var rules = this.rules;
        for (var i = 0, ii = rules.length; i < ii; i++) {
            var rule = rules[i];

            var emptyFields = this.getEmptyFields(rule);
            if (emptyFields.length === this.FIELD_NAMES.length) {
                continue;
            }

            var clone = this.createItem();
            fill(clone, rule);

            // FIXME: it smells
            if (this.NAME === 'servers') {
                clone.setAttribute('id', this.NAME + '_' + rule.id);
            }

            fragment.appendChild(clone);

            for (var j = emptyFields.length; j--;) {
                clone.querySelector('[name="' + emptyFields[j] + '"]').up('.row').classList.add('row-error');
            }
        }
        this.element.insertBefore(fragment, this.element.firstChild);
    },

    withId: function(id) {
        var result = [];
        var elements = this.ruleElements;
        var length = elements.length;
        for (var i = 0; i < length; i++) {
            if (elements[i].querySelector('[name=id]').value === id) {
                result.push(elements[i]);
            }
        }
        return result;
    }
};


function RouteRules() {
    this.initialize();
}
RouteRules.prototype = new Rules;
RouteRules.prototype.NAME = 'routes';
RouteRules.prototype.FIELD_NAMES = ['match', 'savePath'];

function ServerRules() {
    this.initialize();
}
ServerRules.prototype = new Rules;
ServerRules.prototype.NAME = 'servers';
ServerRules.prototype.FIELD_NAMES = ['url'];


var DISABLED_PIPE_X2 = 5;

function createPipe() {
    var dummy;
    if (!createPipe._dummy) {
        dummy = createPipe._dummy = getDummy('pipes');
    } else {
        dummy = createPipe._dummy.cloneNode(true);
    }

    ['.pipe-line', '.pipe-fat-line', '.pipe-line-shadow', '.pipe-end-group', '.pipe-end-middle', '.pipe-end'].forEach(function(className) {
        dummy[className] = dummy.querySelector(className);
    });

    var lines = dummy.querySelectorAll('line');

    dummy.setX1 = function(x) {
        lines.setAttribute('x1', x);
    };
    dummy.setY1 = function(y) {
        lines.setAttribute('y1', y);
    };
    dummy.setX2 = function(x) {
        lines.setAttribute('x2', x);
        dummy['.pipe-end-group'].x = x;
    };
    dummy.setY2 = function(y) {
        lines.setAttribute('y2', y);
        dummy['.pipe-end-group'].y = y;
    };

    dummy.disable = function() {
        dummy.setX2(DISABLED_PIPE_X2);
        dummy.setY2(getMiddleY(dummy._route));
    };

    dummy.disableSmoothly = function() {
        var x2 = dummy['.pipe-end-group'].x;
        var y = getMiddleY(dummy._route);
        var y2 = dummy['.pipe-end-group'].y;
        animate(function(step) {
            dummy.setX2(between(x2, DISABLED_PIPE_X2, step));
            dummy.setY2(between(y2, y, step));
        }, 500);
    };

    return dummy;
}

function between(from, to, position) {
    if (position <= 0) {
        return from;
    }
    if (position >= 1) {
        return to;
    }
    return from * (1 - position) + to * position;
}

function createPipeFor(route) {
    var pipe = createPipe();
    route._pipe = pipe;
    pipe._route = route;
    pipe.setY1(getMiddleY(route));
    byId('pipes').appendChild(pipe);
    return pipe;
}

function createDisabledPipeFor(route) {
    var pipe = createPipeFor(route);
    pipe.addClass('pipe-new');
    pipe.disable();
    pipe.removeClass('pipe-new');
}

function getMiddleY(element) {
    return element.offsetTop + (element.offsetHeight / 2);
}

window.onload = function() {

    var routes = new RouteRules();
    routes.draw();

    var servers = new ServerRules();
    identify(servers.dummy);
    servers.draw();

    routes.element.addEventListener('input', function(event) {
        var element = event.target;
        var row = element.up('.row');
        if (element.name === 'match') {
            try {
                new RegExp(element.value);
            } catch (error) {
                row.classList.add('row-error');
                element.nextElementSibling.textContent = error.message;
                return;
            }
            row.classList.remove('row-error');
        } else {
            if (element.value === '') {
                row.classList.add('row-error');
            } else {
                row.classList.remove('row-error');
            }
        }
        routes.save();
    }, false);

    servers.element.addEventListener('input', function() {
        servers.save();
    }, false);

    repeatable(routes.dummy, function(element) {
        createDisabledPipeFor(element);
    });
    repeatable(servers.dummy, function(element) {
        identify(element);
    });

    routes.ruleElements.forEach(function(route) {
        createPipeFor(route);
    });

    function connectAll() {
        var map = {};
        var all = routes.ruleElements;
        for (var i = 0; i < all.length; i++) {
            var id = all[i].querySelector('[name=id]').value || '';
            if (!map[id]) {
                map[id] = [];
            }
            map[id].push(all[i]);
        }
        Object.keys(map).forEach(function(id) {
            if (id) {
                connectRoutesToServer(map[id], id);
            } else {
                connectDisabledRoutes(map[id]);
            }
        });
    }

    connectAll();

    function connectDisabledRoutes(routesList) {
        routesList.forEach(function(route) {
            route._pipe.disable();
        });
    }

    function connectRoutesToServer(routesList, serverId) {
        var server = document.getElementById('servers_' + serverId);
        var top = server.offsetTop;
        var length = routesList.length;
        var height = Math.round(server.offsetHeight / length);

        for (var i = 0; i < length; i++) {
            var route = routesList[i];
            var pipe = route._pipe;
            pipe['.pipe-end'].setAttribute('r', height / 2);
            pipe.setY1(getMiddleY(route));
            pipe.setY2(top + height / 2 + height * i);
            pipe.setX2(149);
        }
    }

    var activePipe = null;

    function isDraggable(element) {
        return !isDragging && (element.hasClass('draggable'));
    }

    var pipes = byId('pipes');

    pipes.addEventListener('mouseover', function(event) {
        if (isDraggable(event.target)) {
            if (activePipe) {
                activePipe.removeClass('pipe-hovered');
            }
            activePipe = event.target.up('.pipe');
            activePipe.addClass('pipe-hovered');
        }
    }, false);


    pipes.addEventListener('mouseout', function(event) {
        if (isDraggable(event.target)) {
            if (activePipe) {
                activePipe.removeClass('pipe-hovered');
            }
            if (event.target.up('.pipe') !== activePipe) {
                console.warn('FIXME!');
            }
            activePipe = null;
        }
    }, false);


    var isDragging = false;
    pipes.onmousedown = function(event) {
        if (event.button !== 0) {
            return;
        }
        var target = event.target;
        if (!isDraggable(target)) {
            return;
        }
        isDragging = true;

        document.body.classList.add('pipe-dragging');

        var pipe = activePipe = target.up('.pipe');
        var endGroup = pipe['.pipe-end-group'];
        var dot = pipe['.pipe-end-middle'];
        dot.setAttribute('r', 6);

        // http://stackoverflow.com/questions/482115/with-javascript-can-i-change-the-z-index-layer-of-an-svg-g-element
        pipe.parentNode.insertBefore(pipe, null);

        var middles = [];
        var serversElements = servers.element.querySelectorAll('.rule[id]');
        for (var i = 0, ii = serversElements.length; i < ii; i++) {
            var server = serversElements[i];
            middles[i] = getMiddleY(server);
        }
        var MIN_Y = Math.min(middles[0], parseInt(endGroup.y));
        var MAX_Y = Math.max(middles[middles.length - 1], endGroup.y, getMiddleY(pipe._route));
        var MIN_X = 0;
        var MAX_X = 149;
        var X_THRESHOLD = Math.floor(MAX_X / 3);

        var prevI = -1;
        function highlightNearest(x, y) {
            if (x < X_THRESHOLD) {
                removePreviousHighlight();
                return;
            }
            var i = findClosest(middles, y);
            if (prevI > -1) {
                if (prevI === i) {
                    return;
                }
                removePreviousHighlight();
            }
            serversElements[i].classList.add('rule-nearest');
            prevI = i;
        }

        function removePreviousHighlight() {
            if (prevI !== -1) {
                serversElements[prevI].classList.remove('rule-nearest');
                prevI = -1;
            }
        }

        var startY = event.pageY;
        var startX = event.pageX;
        var initialY = endGroup.y;
        var initialX = endGroup.x;
        highlightNearest(endGroup.x, endGroup.y);
        window.onmousemove = function(e) {
            var y = Math.max(MIN_Y, Math.min(MAX_Y, e.pageY - startY + initialY));
            var x = Math.max(MIN_X, Math.min(MAX_X, e.pageX - startX + initialX));
            pipe.setX2(x);
            pipe.setY2(y);
            highlightNearest(x, y);
            return false;
        };
        window.onmouseup = function() {
            window.onmousemove = window.onmouseup = null;

            var inputElement = target.up('.pipe')._route.querySelector('[name=id]');
            var server = serversElements[prevI];
            if (endGroup.x < X_THRESHOLD) {
                inputElement.value = '';
                pipe.disableSmoothly();
            } else {
                inputElement.value = server.id.split('_')[1];
                endGroup.x += 10;
                connectRoutesToServer(routes.withId(inputElement.value),inputElement.value);
            }

            routes.save();

            document.body.classList.remove('pipe-dragging');
            dot.setAttribute('r', 4);
            removePreviousHighlight();
            isDragging = false;
        };
        return false;
    };
};

function repeatable(item, onNewItem) {
    item.addEventListener('input', function addedOne() {
        item.removeEventListener('input', addedOne, false);
        var clone = dummy.cloneNode(true);

        clone.addEventListener('input', addedOne, false);
        item.parentNode.appendChild(clone);
        if (onNewItem) {
            onNewItem(clone);
        }

        item = clone;
        webkitRequestAnimationFrame(function() {
            clone.classList.remove('repeatable-invisible');
        });
    }, false);

    var dummy = item.cloneNode(true);
    dummy.classList.add('repeatable-invisible');
}



/*= UTILITIES */

/**
 * @param {string} id
 * @return {Element}
 */
function byId(id) {
    return document.getElementById(id);
}

function getDummy(id) {
    var dummy = byId(id + '_dummy');
    dummy.removeAttribute('id');
    return dummy;
}

/**
 * @param {Array} array
 * @param {number} value
 * @return {number}
 */
function findClosest(array, value) {
    // I don't use binary search because array.length usually < 10
    for (var i = 0; i < array.length; i++) {
        if (array[i] === value) {
            return i;
        } else if (array[i] > value) {
            break;
        }
    }
    var prev = array[i - 1];
    var next = array[i];
    if (!prev || next && (next - value < value - prev)) {
        return i;
    } else {
        return i - 1;
    }
}

function identify(item) {
    item.querySelector('[name=id]').value = generateId();
}

/**
 * @see http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
 * @return {string}
 */
function generateId() {
    return Date.now().toString(32) + '-' + (Math.random() * 0x10000 | 0).toString(36);
}

function fill(element, data) {
    Object.keys(data).forEach(function(name) {
        if (!name || name.charAt(0) == '_') {
            return;
        }
        var input = element.querySelector('[name="' + name + '"]');
        if (input.tagName == 'button') {
            input.textContent = data[name];
        } else if (input.type == 'checkbox') {
            input.checked = !!data[name];
        } else {
            input.value = data[name];
        }
    });
}

/**
 * @param {string} selector
 * @return {Element|null}
 */
Element.prototype.up = function(selector) {
    var element = this;
    while (element = element.parentElement) {
        if (element.webkitMatchesSelector(selector)) {
            return element;
        }
    }
    return null;
};

NodeList.prototype.forEach = Array.prototype.forEach;
NodeList.prototype.setAttribute = function(name, value) {
    for (var i = this.length; i--;) {
        this[i].setAttribute(name, value);
    }
};

Object.defineProperty(SVGGElement.prototype, 'x', {
    get: function() {
        if (typeof this.dataset.x === 'undefined') {
            var matched = this.getAttribute('transform').match(/translate\(([\d.]+),[\d.]+\)/);
            this.dataset.x = matched ? matched[1] : 0;
        }
        return parseInt(this.dataset.x);
    },
    set: function(x) {
        this.dataset.x = x;
        this.setAttribute('transform', 'translate(' + x + ',' + this.y + ')');
    }
});

Object.defineProperty(SVGGElement.prototype, 'y', {
    get: function() {
        if (typeof this.dataset.y === 'undefined') {
            var matched = this.getAttribute('transform').match(/translate\([\d.]+,([\d.]+)\)/);
            this.dataset.y = matched ? matched[1] : 0;
        }
        return parseInt(this.dataset.y);
    },
    set: function(y) {
        this.dataset.y = y;
        this.setAttribute('transform', 'translate(' + this.x + ',' + y + ')');
    }
});

SVGElement.prototype.hasClass = function(name) {
    return this.className.baseVal.split(/\s+/).indexOf(name) !== -1;
};
SVGElement.prototype.addClass = function(name) {
    if (!this.hasClass(name)) {
        this.className.baseVal += ' ' + name;
    }
};
SVGElement.prototype.removeClass = function(name) {
    this.className.baseVal = (' ' + this.className.baseVal + ' ').replace(' ' + name + ' ', ' ').trim();
};

function animate(onStep, duration) {
    if (!duration) {
        duration = 300;
    }
    var start = Date.now();
    (function loop() {
        webkitRequestAnimationFrame(function(time) {
            // `time` supposed to be the same as Date.now(), but in Chrome 20.0.1124.0 it shows something weird.
            var diff = Date.now() - start;
            var x = bounce(diff / duration);
            onStep(x);
            if (diff < duration) {
                loop();
            }
        });
    })();
}

function bounce(k) {
    if (k < (1 / 2.75)) {
        return 7.5625 * k * k;
    } else if (k < (2 / 2.75)) {
        return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
    } else if (k < (2.5 / 2.75)) {
        return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
    } else {
        return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
    }
}
