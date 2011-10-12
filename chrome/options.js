'use strict';

/**
 * @param {string} className
 * @nosideeffects
 * @return {Element|null}
 */
HTMLElement.prototype.up = function(selector) {
    var element = this;
    while (element = element.parentNode) {
        if ('webkitMatchesSelector' in element && element.webkitMatchesSelector(selector)) {
            return element;
        }
    }
    return null;
};


var rules = [];

var defaultRules = [
    {
        match: '^file://',
        to: 'http://127.0.0.1:9104/save',
        script: 'on',
        stylesheet: 'on',
        document: ''
    }
];

if (!localStorage.routes) {
    // First run
    localStorage.routes = JSON.stringify(defaultRules);
}


function saveRoutes() {
    localStorage.routes = JSON.stringify(serializeForm(document.getElementById('rules')));
}


/**
 * @param {Element} button
 */
function deleteRule(button) {
    var rule = button.up('.rule');
    rule.style.height = rule.clientHeight + 'px';
    rules.splice(getRuleIndex(rule), 1);
    setTimeout(function() {
        rule.classList.add('rule-animation');
        rule.classList.add('rule-hidden');
        setTimeout(function() {
            rule.parentNode.removeChild(rule);
            saveRoutes();
        }, 200);
    }, 0);
}


/**
 * @param {HTMLFieldSetElement} rule
 * @return {number} index
 */
function getRuleIndex(rule) {
    var index = 0;
    while (rule = rule.previousElementSibling) {
        if (!rule.classList.contains('rule')) {
            break;
        }
        index++;
    }
    return index;
}

/**
 * @param {HTMLFormElement} form
 * @nosideeffects
 * @return {Array}
 */
function serializeForm(form) {
    var rules = [];
    var j = -1;
    for (var i = 0; i < form.length; i++) {
        var element = form[i];
        if (element.tagName == 'FIELDSET') {
            j++;
        } else {
            if (!element.name) {
                continue;
            }
            if (!rules[j]) {
                rules[j] = {};
            }
            var value;
            if (element.disabled || element.type == 'checkbox' && !element.checked) {
                value = '';
            } else {
                value = element.value;
            }
            rules[j][element.name] = value;
        }
    }
    return rules;
}


window.onload = function() {

    var dummy = document.getElementById('dummy_rule');
    var RULE_HEIGHT = dummy.clientHeight;

    function cloneDummy() {
        var clone = dummy.cloneNode(true);
        clone.removeAttribute('id');
        return clone;
    }

    /**
     * @param {Array} rules
     */
    function showRules(rules) {
        var dummyClone = cloneDummy();
        var rulesElem = document.getElementById('rules');
        rules.forEach(function(rule) {
            if (!rule.match || !rule.to) {
                return;
            }
            var clone = dummyClone.cloneNode(true);
            Object.keys(rule).forEach(function(name) {
                var input = clone.querySelector('[name="' + name + '"]');
                if (input.type == 'checkbox') {
                    input.checked = !!rule[name];
                } else {
                    input.value = rule[name];
                }
            });
            rulesElem.appendChild(clone);
        });
    }

    if (localStorage.routes) {
        showRules(JSON.parse(localStorage.routes));
    } else {
        showRules(defaultRules);
    }

    var rules = document.getElementById('rules');

    rules.oninput = rules.onchange = function(event) {
        var element = event.target;
        if (element.name === 'match') {
            var row = element.up('.row');
            try {
                new RegExp(element.value);
            } catch (error) {
                row.classList.add('row-error');
                element.nextElementSibling.textContent = error.message;
                return;
            }
            row.classList.remove('row-error');
        }
        saveRoutes();
    };

    rules.onmouseover = function(event) {
        if (event.target.classList.contains('delete')) {
            event.target.up('.rule').classList.add('rule-delete');
        }
    };

    rules.onmouseout = function(event) {
        if (event.target.classList.contains('delete')) {
            event.target.up('.rule').classList.remove('rule-delete');
        }
    };

    document.getElementById('add_row').onclick = function() {
        var clone = cloneDummy();
        clone.classList.add('rule-hidden');
        clone.classList.add('rule-animation');
        rules.appendChild(clone);
        setTimeout(function() {
            clone.style.height = RULE_HEIGHT + 'px';
            clone.classList.remove('rule-hidden');
            setTimeout(function() {
                clone.removeAttribute('style');
                clone.classList.remove('rule-animation');
            }, 200);
        }, 0);
        saveRoutes();
    };

};
