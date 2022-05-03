const Context = require('./context')
const mt = require('mvtools')

/**
 * @typedef {string|Object} KeyboardObject
 * @property {string[]|string[][]|KeyboardButton[]|KeyboardButton[][]} [buttons] Array of buttons
 * @property {string[]} [options] Array of keyboard options
 * @property {string} [method] Method name to prepare keyboard fields
 * @property {string} [callback] Handler name for callback data from inline keyboards
 * @property {string} [language] Language of text on buttons
 * @property {string} [bridge]
 * @property {boolean} [clear] Flag to clear keyboard. Actually for reply keyboards
 * @property {boolean} translatable=true Flag to disallow lexicon
 */

/**
 * @typedef {string|Object} KeyboardButton
 * @property {string} text Button caption
 * @property {string} url Button URL
 * @property {string|KeyboardButtonData} [data] Data to replace empty Message text after button pressed
 * @property {string} [handler] Method name to handle pressed button
 * @property {any} [params] Additional params (to lexicon or handler)
 * @property {string} [answer] Text of the notification. If not specified, nothing will be shown to the user, 0-200 characters
 * @property {boolean} [showAlert] If true, an alert will be shown by the client instead of a notification at the top of the chat screen
 * @property {int} [cache_time] The maximum amount of time in seconds that the result of the callback query may be cached client-side. Telegram apps will support caching starting in version 3.14. Defaults to 0.
 * @property {boolean} [autoAnswer] If true, answer for the pressed button will be sent immediately
 */

/**
 * @typedef {string|Object} KeyboardButtonData
 * @property {int} [id]
 * @property {string} [data]
 * @property {string} [gameShortName]
 * @property {string} [password]
 * @property {string} [forwardText]
 * @property {string} [query]
 * @property {string} [gameShortName]
 * @property {boolean} [buy]
 * @property {boolean} [inCurrentChat]
 * @property {boolean} [requestPhone]
 * @property {boolean} [requestLocation]
 * @property {boolean} [requestPoll]
 */

/**
 * Keyboard builder
 * @class
 * @property {BotCMS} BC
 * @property {BotCMS.Context} ctx
 * @property {string[]} options
 * @property {string} bridge
 * @property {string[]|string[][]|KeyboardButton[]|KeyboardButton[][]} [buttons] Array of buttons
 * @property {boolean} translatable=true Flag to disallow lexicon
 */
class Keyboard {
    /**
     * @constructor
     * @param {Context|import('./botcms.js')} ctx
     * @param {KeyboardObject} [kbObject]
     */
    constructor (ctx, kbObject) {
        // console.log('KB. CTX INSTANCE OF BOTCMS? ', ctx instanceof BotCMS);
        if (ctx instanceof Context) {
            this.BC = ctx.BC
            this.ctx = ctx
            this._language = ctx.language
        } else {
            this.BC = ctx
            this.ctx = undefined
            this._language = this.BC.config.language
        }
        this.translatable = true
        this._options = ['simple', /*'resize',*/ 'extra'];
        this._buttons = [];
        this._params = {};
        this._bridge = '';
        this._clear = false;
        this._callback = ''
        this._inline = false
        this._method = null

        /**
         * Add buttons row
         * @function
         * @param {KeyboardButton|KeyboardButton[]} buttons Array of keyboard buttons
         * @returns {Promise.<Keyboard>}
         */
        this.addBtnRow = async (buttons) => {
            if (!Array.isArray(buttons)) {
                buttons = [ buttons ];
            }
            let translated = [];
            // console.log('ADD BTN ROW. IN ROW', buttons, 'TRANSLATED', translated)
            for (let button of buttons) {
                // console.log('ADD BTN ROW. BUTTON IN FOR', button)
                if (typeof button === 'string') {
                    const text = this.translatable ? await this.BC.lexicon(button, this._params, this._language, this.ctx) : button
                    // console.log('BOTCMS KB. ADD BTN ROW. BUTTON:', button, 'FROM STRING BUTTON', text)
                    button = typeof text === 'string' ? text : mt.mergeRecursive(button, text)
                } else if (typeof button === 'object') {
                    if (!button.data) {
                        button.data = button.text
                    }
                    if (this.translatable) {
                        const text = await this.BC.lexicon(button.text, mt.merge(this._params, button.params || {}), this._language, this.ctx)
                        const textObject = typeof text === 'string' ? { text } : text
                        button = mt.mergeRecursive(button, textObject)
                    }
                }
                translated.push(button)
                // console.log('ADD BTN ROW. BUTTON OUT FOR', button, 'TRANSLATED', translated)
            }
            // console.log('ADD BTN ROW. OUT ROW', translated)
            this._buttons.push(translated);
            return this;
        }

        /**
         * Add one custom button
         * @function
         * @param {string} caption Key of lexicon entry
         * @returns {Promise.<Keyboard>}
         */
        this.addBtn = async (caption) => {
            return this.addBtnRow([caption]);
        }

        /**
         * Add main menu button
         * @function
         * @returns {Promise.<Keyboard>}
         */
        this.addBtnMenuMain = async () => {
            return this.addBtnRow(['common.btn.menu.main']);
        }

        /**
         * Add manage menu button
         * @function
         * @returns {Promise.<Keyboard>}
         */
        this.addBtnMenuManage = async () => {
            return this.addBtnRow(['common.btn.menu.manage']);
        }

        /**
         * Add back button
         * @function
         * @returns {Promise.<Keyboard>}
         */
        this.addBtnBack = async () => {
            return this.addBtnRow(['common.btn.menu.back']);
        }

        /**
         * Add remove button
         * @function
         * @returns {Promise.<Keyboard>}
         */
        this.addBtnDel = async () => {
            return this.addBtnRow(['common.btn.action.remove']);
        }

        /**
         * Add buttons from array
         * @function
         * @param kbArray
         * @returns {Promise.<Keyboard>}
         */
        this.addBtnFromArray = async (kbArray = []) => {
            for (let row of kbArray) {
                await this.addBtnRow(row);
            }
            return this;
        }

        /**
         * Load all kb properties from Object
         * @function
         * @param {kbObject} kbObject
         * @returns {Promise.<Keyboard>}
         */
        this.fromKBObject = async (kbObject = {}) => {
            if (this.BC.MT.empty(kbObject)) {
                return this
            }
            if (this.BC.MT.isString(kbObject)) {
                kbObject = this.BC.MT.copyObject(this.BC.MT.extract(kbObject, this.BC.keyboards));
            }
            if ('name' in kbObject) {
                kbObject = mt.merge(kbObject, this.BC.MT.copyObject(this.BC.MT.extract(kbObject.name, this.BC.keyboards)));
            }
            // console.log('FROM KB OBJECT', kbObject)
            if ('translatable' in kbObject) this._translatable = kbObject.translatable
            if ('params' in kbObject) this._params = mt.copyObject(kbObject.params);
            if (kbObject.method !== undefined) {
                let method = this.BC.MT.extract(kbObject.method);
                if (method) {
                    this._method = kbObject.method
                    kbObject = this.BC.MT.mergeRecursive(await method(this.ctx, kbObject, this._params), kbObject);
                }
            }
            if (Array.isArray(kbObject.buttons)) {
                await this.addBtnFromArray(kbObject.buttons);
            }
            if (Array.isArray(kbObject.options)) {
                this._options = kbObject.options;
            }
            if (typeof kbObject.language === 'string') {
                this._language = kbObject.language;
            }
            if (typeof kbObject.callback === 'string') {
                this.callback = kbObject.callback;
            }
            if (typeof kbObject.bridge === 'string') {
                this.bridge = kbObject.bridge;
            }
            if (kbObject.inline !== undefined) this._options.push('inline')
            if (kbObject.clear === true) {
                this._clear = true;
                this.buttons = []
                this.options = []
            }
            return this;
        }

        /**
         * Set clear flag
         * @function
         * @param clear
         * @returns {Keyboard}
         */
        this.clear = (clear = true) => {
            this._clear = clear;
            return this;
        }

        /**
         * Build bridge-specific keyboard object
         * @function
         * @returns {[]|any|*[]}
         */
         this.build = async () => {
            let bridge = this.ctx ? this.ctx.Bridge : this.BC.bridges[this.bridge]
            if (bridge === undefined) bridge = this.BC.getBridge()
            // console.log('KB BUTTONS', this.buttons)
            // console.log('KB OPTIONS', this.options)
            if (this.options.indexOf('inline') !== -1) {
                // console.log('INLINE KB', this.buttons)
                for (let row in this.buttons) {
                    if (Object.prototype.hasOwnProperty.call(this.buttons, row)) {
                        let buttonsRow = this.BC.MT.makeArray(this.buttons[row])
                        // console.log('BUTTONS ROW', buttonsRow)
                        for (let i in buttonsRow) {
                            if (Object.prototype.hasOwnProperty.call(buttonsRow, i)) {
                                // console.log('BUTTON', buttonsRow[i])
                                if (typeof buttonsRow[i] === 'string') {
                                    buttonsRow[i] = {
                                        text: buttonsRow[i],
                                        data: buttonsRow[i],
                                        answer: false
                                    }
                                }
                                buttonsRow[i].data = await (this.ctx || this.BC).storeCBData(buttonsRow[i])
                            }
                        }
                    }
                }
                // console.log('RESULT KB', this.buttons)
            }
            return typeof bridge === 'object'
              ? (this._clear ? bridge.kbRemove() : bridge.kbBuild({ buttons: this.buttons, options: this.options, }))
              : []
        }

        if (kbObject) {
            // console.log(kbObject)
            if (this.BC.MT.isString(kbObject)) {
                kbObject = this.BC.MT.copyObject(this.BC.keyboards[kbObject]);
            }
            // console.log(kbObject)
            return this.fromKBObject(kbObject);
        }
    }

    get options () {
        return this._options;
    }

    set options (options) {
        this._options = options;
    }

    get bridge () {
        return this._bridge
    }

    set bridge (name) {
        this._bridge = name
    }

    get buttons () {
        return this._buttons;
    }

    set buttons (buttons) {
        this._buttons = buttons;
    }

    get translatable () {
        return this._translatable;
    }

    set translatable (translatable) {
        this._translatable = translatable;
    }

    get listButtons () {
        const buttons = []
        for (const row of this.buttons) {
            for (const button of row) buttons.push(button)
        }
        return buttons
    }

    get callback () {
        return this._callback;
    }

    set callback (callback) {
        this._callback = callback;
    }

    addOption (option) {
        if (this._options.indexOf(option) === -1) this._options.push(option)
    }

    removeOption (option) {
        this._options = this._options.filter((v) => v === option)
    }

    toKbObject () {
        const kbObject = {}
        for (const key of this) {
            if (Object.prototype.hasOwnProperty.call(this, key) && key.startsWith('_')) {
                kbObject[key.substring(1)] = this[key]
            }
        }
        return mt.copyObject(kbObject)
    }
}

/** @type {KeyboardObject} */
Keyboard.KeyboardObject = {}
/** @type {KeyboardButton} */
Keyboard.KeyboardButton = {}
/** @type {KeyboardButtonData} */
Keyboard.KeyboardButtonData = {}

module.exports = Keyboard;
