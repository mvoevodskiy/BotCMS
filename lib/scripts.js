const mt = require('mvtools')

/** Class for user scripts
 * @class
 *
 * @private
 * @property {Object<string, *>} _scripts
 *
 * @property {import('./botcms.js)} BC
 * @property {BC.Tools} T
 * @property {BC.MVTools} MT
 */

class Scripts {

    /**
     * @constructor
     * @param {import('./botcms.js')} BC
     */
    constructor (BC) {
        this._scripts = {};

        this.BC = BC;
        this.T = BC.T;
        this.MT = BC.MT;

        this.gotos = [
            'goto',
            'validate',
        ];

        this.shorteners = {
            root: {
                trg: 'trigger',
                cmd: 'command',
                msg: 'message',
                kb: 'keyboard',
                vld: 'validate'
            },
            validate: {
                vld: 'validator',
                f: 'failure',
                t: 'success',
                sw: 'switch'
            }
        }
    }

    /**
     * Merge new script with already loaded
     * @function
     * @param {Object} scripts
     */
    load (scripts) {
        if (!this.MT.empty(scripts)) {
            try {
                scripts = this.prepareScripts('', scripts);
                this._scripts = this.BC.MT.mergeRecursive(this._scripts, scripts);
            } catch (e) {
                console.error(e);
            }
        }
    }

    /**
     * Prepare script to load
     * @param {string} parent
     * @param {Object} script
     * @param {Object<string,string>} additional
     * @returns {Object}
     */
    prepareScripts (parent, script, additional = {}) {
        for (const name in script) {
            if (!script.hasOwnProperty(name) || script[name] === null) {
                continue;
            }

            const grandpa = parent.lastIndexOf('.') !== -1 ? parent.substr(0, parent.lastIndexOf('.')) : '';
            const grandpa2 = grandpa.lastIndexOf('.') !== -1 ? grandpa.substr(0, grandpa.lastIndexOf('.')) : '';
            const grandpa3 = grandpa2.lastIndexOf('.') !== -1 ? grandpa2.substr(0, grandpa2.lastIndexOf('.')) : '';
            const grandpa4 = grandpa3.lastIndexOf('.') !== -1 ? grandpa3.substr(0, grandpa3.lastIndexOf('.')) : '';
            const grandpa5 = grandpa4.lastIndexOf('.') !== -1 ? grandpa4.substr(0, grandpa4.lastIndexOf('.')) : '';
            const grandpa6 = grandpa5.lastIndexOf('.') !== -1 ? grandpa5.substr(0, grandpa5.lastIndexOf('.')) : '';
            const path = this.MT.empty(parent) ? name : parent + '.' + name;
            const children = path + '.c';
            const isC = this.T.isChildrenPath(path);
            // console.log('LOAD SCRIPT FOR THREAD ' + path);
            if (isC) {
                additional.grandpa = parent;
                script[name] = this.prepareScripts(path, script[name], additional);
                break;
            } else {
                script[name] = this.expandShorteners(script[name], this.shorteners.root)
                if (!this.MT.empty(script[name]['command'])) {
                    this.BC.commands.push(path);
                }
                for (const key in additional) {
                    if (additional.hasOwnProperty(key)) {
                        script[name][key] = additional[key];
                    }
                }

                if (!mt.empty(script[name].validate)) script[name].validate = this.expandShorteners(script[name].validate, this.shorteners.validate)
                if (!mt.empty(script[name].goto)) script[name].goto = this.expandShorteners(script[name].goto, this.shorteners.validate)
                if (script[name].trigger !== undefined) script[name].trigger = this.parseTrigger(script[name].trigger)

                script[name].parent = parent;
                script[name].path = path;
                script[name].children = children;
                script[name].isParent = !this.MT.empty(script[name]['c']);
                if (script[name].isParent) {
                    additional.grandpa = path;
                    script[name]['c'] = this.prepareScripts(path + '.c', script[name]['c'], additional);
                }

                let replaceGoto = {
                    '((s))': path,
                    '((self))': path,
                    '((path))': path,
                    '((p))': parent,
                    '((parent))': parent,
                    '((gp))': grandpa,
                    '((grandpa))': grandpa,
                    '((gp2))': grandpa2,
                    '((grandpa2))': grandpa2,
                    '((gp3))': grandpa3,
                    '((grandpa3))': grandpa3,
                    '((gp4))': grandpa4,
                    '((grandpa4))': grandpa4,
                    '((gp5))': grandpa5,
                    '((grandpa5))': grandpa5,
                    '((gp6))': grandpa6,
                    '((grandpa6))': grandpa6,
                    '((c))': children,
                    '((children))': children
                };
                for (let goto of this.gotos) {
                    let value = this.MT.extract(goto, script[name]);
                    // console.log('SCRIPTS PREPARE SCRIPTS. NAME: ' + name + ' GOTO: ' + goto + ' VALUE BEFORE: ', value);
                    if (!this.MT.empty(value)) {
                        // console.log('GOTO: ' + goto + ' VALUE: ', value);
                        let replaced = this.MT.replaceRecursive(replaceGoto, value);
                        // console.log('GOTO: ' + goto + ' REPLACED: ', replaced);
                        script[name] = this.MT.setByPath(goto, script[name], replaced);
                    }
                    // console.log('SCRIPTS PREPARE SCRIPTS. NAME: ' + name + ' GOTO: ' + goto + ' VALUE AFTER: ', script[name][goto]);
                }
            }
        }
        return script;
    }

    parseTrigger (triggerFull) {
        triggerFull = mt.makeArray(triggerFull)
        for (const i in triggerFull) {
            if (Object.prototype.hasOwnProperty.call(triggerFull, i)) {
                let trigger = triggerFull[i]
                if (typeof trigger === 'string') {
                    const pos = trigger.indexOf(':')
                    if (pos !== -1) {
                        trigger = { type: trigger.substring(0, pos), value: trigger.substring(pos + 1) }
                    }
                }
                if (typeof trigger === 'string' || Array.isArray(trigger)) trigger = { value: mt.makeArray(trigger) }
                triggerFull[i] = trigger
            }
        }
        return triggerFull
    }

    expandShorteners (object, shorteners) {
        if (typeof object === 'object' && !mt.empty(object)) {
            for (const shortener in shorteners) {
                if (Object.prototype.hasOwnProperty.call(shorteners, shortener)) {
                    if (shortener in object && !(shorteners[shortener] in object)) {
                        object[shorteners[shortener]] = object[shortener]
                        delete object[shortener]
                    }
                }
            }
        }
        return object
    }

    /**
     * Extract thread of scripts by path
     * @param {string} path
     * @returns {undefined|NodeJS.Process|NodeJS.Process}
     */
    extract (path) {
        return this.T.extract(path, this._scripts);
    }

}

module.exports = Scripts;
module.exports.defaults = Scripts;