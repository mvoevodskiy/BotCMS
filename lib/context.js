const {MiddlewareManager} = require('js-middleware');

/**
 * @typedef {Object} kbButtonCallbackData
 * @property {string} data Data to replace empty Message text after button pressed
 * @property {string} [handler] Method name to handle pressed button
 * @property {any} [params] Additional params (to lexicon or handler)
 * @property {string} [hash] Hash as key to store data
 * @property {string} [path] Path from schema
 */

/**
 * If string with query id will only stop processing pressed button
 *
 * @typedef {string|Object} answerCallbackData
 * @property {string} id Unique identifier for the query to be answered
 * @property {string} [answer] Text of the notification. If not specified, nothing will be shown to the user, 0-200 characters
 * @property {boolean} [alert] If true, an alert will be shown by the client instead of a notification at the top of the chat screen
 * @property {int} [cacheTime] The maximum amount of time in seconds that the result of the callback query may be cached client-side. Telegram apps will support caching starting in version 3.14. Defaults to 0.
 */

/**
 * @class Class for Inbound message context
 *
 * @property {Object<string, *>} context
 * @property {Object<import('./message.js')>} Message
 * @property {Object<string, *>} session
 * @property {Object<string, *>} state
 * @property {boolean} isProcessed
 * @property {string} msg Text of inbound message
 * @property {string} language User selected language
 * @property {int} startTime
 *
 * @property {Object} Bridge
 * @property {Object<import('./botcms.js')>} BC
 *
 * @property {int} _startTime
 * @property {boolean} _processed
 * @property {string} _uid Unique ID for the current request
 */

class Context {
    /**
     *
     * @param {import('./botcms.js')} BC
     * @param Bridge
     * @param {Object} [context]
     * @param {Object} [config]
     */
    constructor (BC, Bridge, context, config = {}) {
        this._startTime = Date.now()
        this.defaults = {
            useSession: true,
            session: {
                getStorageKey: context => this.Message.selfSend() ? '' : (String(context.Bridge.name) + ':' + String(context.Message.chat.id) + ':' + String(context.Message.sender.id)),
                targetKey: 'session'
            },
        }
        this.BC = BC;
        this.Bridge = Bridge;
        this.context = context;
        this.config = this.BC.MT.merge(this.defaults, this.BC.config.Context || {}, config)

        this.Message = new this.BC.config.classes.Message(this);
        this.session = {};
        this.state = {}
        this._processed = false;
        this._uid = ''

        this.MiddlewareManager = new MiddlewareManager(this);
        if (this.config.useSession) {
            this.SessionManager = new this.BC.config.classes.SessionManager(this.BC, this.config.session || {})
            this.use('process', this.SessionManager.middleware)
        }

        this.useMultiple(this.config.middlewareMethods);
        this.useMultiple(this.config.middlewares);
    }

    getUid () {
        return this._uid
    }

    /**
     * Generate UID for context
     * @param {int|string} uid
     */
    genUid (uid) {
        this._uid = isNaN(uid) ? (this.Bridge ? this.Bridge.name + ':' : '') + uid : Math.round(uid * this.getStartTime() / 10000)
    }

    getStartTime () {
        return this._startTime
    }

    async bridgeExec (execParams, logParams) {
        execParams.bridge = this.Bridge
        execParams.ctx = this
        return this.BC.bridgeExec(execParams, logParams)
    }

    async process () {
        // console.log(this.Message.query)
        if (this.Message.query.id !== '') {

            // console.log(this.Message.query.data)
            // console.log(this.config.callbackDataSessionKey, this.session)
            let stored = await this.getCBData(this.Message.query.data)
            // console.log('STORED', stored)
            if (this.BC.MT.empty(stored)) {
                stored = {}
            }
            if (this.BC.MT.empty(stored.data)) {
                stored.data = stored.text
            }
            this.Message.query = this.BC.MT.merge(this.Message.query, stored)
            this.Message.text = this.Message.query.data
            // console.log('CTX MSG QUERY', this.Message.query)
            if (!!this.Message.query.answer) {
                await this.answerCB(this.Message.query).catch(err => console.error('ERROR IN CTX ANSWER CB:', err))
            }
            if (!!this.Message.query.handler) {
                await this.BC.T.execMessage(this.Message.query.handler, this, ctx.Message.query.params)
                  .catch(err => console.error('ERROR IN EXEC MESSAGE:', err))
            }
        }
        return await this.BC.handleUpdate(this)
    }

    /**
     * Send parcel from user to bot.л
     * @param Parcel
     * @return {*}
     */
    async reply (Parcel) {
        await this.answerCB(true)
        if (this.BC.MT.isString(Parcel)) {
            Parcel = new this.BC.config.classes.Parcel(Parcel);
        }
        Parcel.peerId = this.Message.chat.id;

        return this.BC.bridgeExec({method: 'send', bridge: this.Bridge, ctx: this, params: Parcel, event: this.Message.EVENTS.CHAT_MESSAGE_NEW, outbound: true})
    }

    remove (msgIds = undefined, peerId = undefined) {
        if (msgIds === undefined) msgIds = [this.Message.id]
        if (!peerId) {
            peerId = this.Message.chat.id
        }
        const params = [peerId, msgIds]
        return this.BC.bridgeExec({
            method: 'remove',
            params,
            event: this.Message.EVENTS.CHAT_MESSAGE_REMOVE
        })
          .catch((e) => console.error('ERROR IN REMOVE:', e))
    }

    /**
     * @param {answerCallbackData} data
     */
    async answerCB (data= true) {
        if (typeof data === 'boolean' || typeof data === 'string') {
            data = this.BC.MT.merge(this.Message.query, { answer: data })
        }
        if (this.BC.MT.empty(data.id)) {
            data.id = this.Message.query.id
        }
        if (data.id !== '') {
            if (data.answer === undefined) {
                data.answer = true
            }
            if (typeof data.answer === 'string') {
                data.answer = await this.lexicon(data.answer, data.params)
            }
            // console.log('ANSWER CB. DATA FINAL', data)
            await this.BC.bridgeExec({
                method: 'answerCB',
                params: data,
                event: this.Message.EVENTS.QUERY_CALLBACK_ANSWER
            })
              .catch((e) => console.error('ERROR IN ANSWER CALLBACK:', e))
            await this.Bridge.answerCB(data)
        }
    }

    async restrict (permissions = {}) {
        return this.bridgeExec({
            method: 'restrict',
            params: {
                userId: this.Message.sender.id,
                chatId: this.Message.chat.id,
                permissions
            },
            event: this.BC.EVENTS.RESTRICT_USER
        })
    }

    async promote (permissions = {}) {
        return this.bridgeExec({
            method: 'promote',
            params: {
                userId: this.Message.sender.id,
                chatId: this.Message.chat.id,
                permissions
            },
            event: this.BC.EVENTS.RESTRICT_USER
        })
    }

    get isProcessed () {
        return this._processed;
    }

    /**
     * @deprecated
     * @returns {Object<string, *>}
     */
    get singleSession () {
        return this.state
    }

    /**
     * @deprecated
     * @param {Object<string, *>}values
     */
    set singleSession (values) {
        this.state = values
    }

    get msg () {
        return this.Message.text || '';
    }

    /**
     * Set flag processed for context
     * @function
     * @param {boolean} val
     */
    setProcessed (val) {
        this._processed = val;
    }

    get language () {
        return (this.session && typeof this.session === 'object') ? this.session.language : this.BC.config.language
    }

    /**
     * @function
     * @param {string} value
     */
    set language (value) {
        this.session.language = value;
    }

    /**
     * Parse key with params by Lexicon
     * @function
     * @param {string} key
     * @param {Object<string, string>}params
     * @returns {string}
     */
    async lexicon (key, params = {}) {
        return this.BC.lexicon(key, params, this.language, this);
    }

    /**
     * Extract lexicon entry by key and current language
     * @function
     * @param {string} key
     * @returns {string|Object<string, string>}
     */
    lexiconExtract (key) {
        return this.BC.Lexicons.extract(this.language + '.' + key);
    }

    useMultiple (middlewares) {
        if (Array.isArray(middlewares)) {
            for (let middleware of middlewares) {
                this.use(new middleware(this));
            }
        }
    }

    use (step, method) {
        if (typeof step === 'string') {
            if (step in this) {
                // console.log(step, method)
                this.MiddlewareManager.use(step, method);
            }
        } else {
            method = step;
            this.MiddlewareManager.use(method);
        }
    }

    /**
     * @param {string|kbButtonCallbackData} cbData
     * @return {*}
     */
    storeCBData (cbData) {
        if (typeof cbData === 'string') {
            cbData = { data: cbData }
        }
        if (this.BC.MT.empty(cbData.path)) {
            let path = this.BC.MT.extract('step.path', this.state, '')
            if (path === '') {
                path = this.BC.MT.extract('step.path', this.session, 'c')
            }
            cbData.path = path
        }
        return this.BC.storeCBData(cbData)
    }

    /**
     * @param {string} key
     * @return {kbButtonCallbackData|{}}
     */
    getCBData (key) {
        return this.BC.getCBData(key)
    }

    getAnswer (thread, key, defaults = undefined, includeQuestion = false) {
        return this.BC.MT.extract('answers.' + thread + '.' + key + (includeQuestion ? '' : '.answer'), this.session, defaults)
    }

    /**
     * @param {string} thread
     * @param {boolean} includeQuestions
     * @return {Object<string, string|Object<string, string>>}
     */
    getAnswers (thread, includeQuestions = false) {
        let rawAnswers = this.BC.MT.extract('answers.' + thread, this.session, {})
        let answers = {}
        for (let key in rawAnswers) {
            if (Object.prototype.hasOwnProperty.call(rawAnswers, key)) {
                answers[key] = includeQuestions ? rawAnswers[key] : rawAnswers[key].answer
            }
        }
        return answers
    }

    setAnswer (thread, key, answer, message = '') {
        this.BC.MT.setByPath('answers.' + thread + '.' + key, this.session, { answer, message })
    }

    newParcel (content = {}) {
        const parcel = new this.BC.config.classes.Parcel()
        parcel.ctx = this
        return parcel
    }

}

module.exports = Context;
module.exports.default = Context;
