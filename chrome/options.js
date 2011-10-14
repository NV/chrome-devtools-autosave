'use strict';

/**
 * @param {string} selector
 * @nosideeffects
 * @return {Element|null}
 */
HTMLElement.prototype.up = function(selector) {
    var element = this;
    while (element = element.parentElement) {
        if (element.webkitMatchesSelector(selector)) {
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
 * @param {HTMLElement} button
 */
function _onDeleteRule(button) {
    deleteRule(button.up('.rule'));
}

/**
 * @param {HTMLElement} rule
 */
function deleteRule(rule) {
    rule.style.height = rule.clientHeight + 'px';
    rules.splice(getRuleIndex(rule), 1);
    setTimeout(function() {
        rule.classList.add('rule-animation');
        rule.classList.add('rule-hidden');
        rule.addEventListener('webkitTransitionEnd', function transitionEnded(event) {
            if (event.propertyName == 'height') {
                rule.parentNode.removeChild(rule);
                saveRoutes();
            }
        }, false);
    }, 0);
}

/**
 * @param {HTMLButtonElement} button
 */
function _onToggleRule(button) {
    toggleRule(button);
    saveRoutes();
}

/**
 *
 * @param {HTMLButtonElement} button
 */
function toggleRule(button) {
    var rule = button.up('.rule');
    var disabled = rule.classList.toggle('rule-disabled');
    button.textContent = disabled ? 'Enable' : 'Disable';
    var inputs = rule.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) {
        inputs[i][disabled ? 'setAttribute' : 'removeAttribute']('disabled');
    }
}


/**
 * @param {HTMLElement} rule
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
                var rule = rules[j] = {};
                if (element.up('.rule').classList.contains('rule-disabled')) {
                    rule._disabled = true;
                }
            }
            var value;
            if (element.type == 'checkbox' && !element.checked) {
                value = '';
            } else {
                value = element.value;
            }
            rule[element.name] = value;
        }
    }
    return rules;
}


window.onload = function() {

    var dummy = document.getElementById('dummy_rule');
    var RULE_HEIGHT = dummy.clientHeight;
    var dummyClone = dummy.cloneNode(true);
    dummyClone.removeAttribute('id');
    dummy.parentNode.removeChild(dummy);

    /**
     * @param {Array} rules
     */
    function showRules(rules) {
        var rulesElem = document.getElementById('rules');
        rules.forEach(function(rule) {
            if (!rule.match || !rule.to) {
                return;
            }
            var clone = dummyClone.cloneNode(true);
            if (rule._disabled) {
                toggleRule(clone.querySelector('.toggle'));
            }
            Object.keys(rule).forEach(function(name) {
                if (name.charAt(0) == '_') {
                    return;
                }
                var input = clone.querySelector('[name="' + name + '"]');
                if (input.tagName == 'button') {
                    input.textContent = rule[name];
                } else if (input.type == 'checkbox') {
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

    document.getElementById('add_row').onclick = function() {
        var clone = dummyClone.cloneNode(true);
        clone.classList.add('rule-hidden');
        clone.classList.add('rule-animation');
        rules.appendChild(clone);
        setTimeout(function() {
            clone.style.height = RULE_HEIGHT + 'px';
            clone.classList.remove('rule-hidden');
            clone.addEventListener('webkitTransitionEnd', function transitionEnded(event) {
                if (event.propertyName == 'height') {
                    clone.removeAttribute('style');
                    clone.classList.remove('rule-animation');
                    clone.removeEventListener('webkitTransitionEnd', transitionEnded, false);
                }
            }, false);
        }, 0);
        saveRoutes();
    };

};
