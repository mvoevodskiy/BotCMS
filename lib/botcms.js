const MVTools = require('mvtools');
const CronJob = require('cron').CronJob;
const {MiddlewareManager} = require('js-middleware');

const Answer = require('./answer')
const Attachment = require('./attachment')
const Context = require('./context')
const Keyboard = require('./keyboard')
const Lexicons = require('./lexicons')
const Message = require('./message')
const Parcel = require('./parcel')
const SessionManager = require('./sessionmanager')
const Logger = require('./logger')
const StorageManager = require('./storagemanager')
const Scripts = require('./scripts')
const Templater = require('mvl-handlebars-handler')
const Tools = require('./tools')

/**
 * @typedef {string|Object} scriptStepTrigger
 * @property {string} [type]
 * @property {string|string[]} value
 */

/**
 * @typedef {string|Object} scriptStepValidator
 * @property {string} validator
 * @property {any} params
 * @property @deprecated {any} validator-params
 * @property {string} failure
 * @property {string} success
 * @property {Object<string, string>} switch
 */

/**
 * @typedef {boolean|Object} scriptStepStore
 * @property {boolean} [clean]
 * @property {string} [thread]
 * @property {string} [key]
 */

/**
 * @typedef {Object} scriptStep
 * @property {scriptStepTrigger|scriptStepTrigger[]} [trigger]
 * @property {boolean} [command]
 * @property {string|{text: string, markup: string}} [message]
 * @property {Object<string, Object[]>} [attachments]
 * @property {import('./keyboard.js').kbObject} [keyboard]
 * @property {string} [keyboard_name] DEPRECATED. Use "keyboard" instead of this
 * @property {string|{type: string, name: string, params: *}} [action]
 * @property {scriptStepValidator} [validate]
 * @property {scriptStepValidator} [goto]
 * @property {scriptStepStore} [store]
 * @property {scriptStepStore} [storePre]
 * @property {scriptStepStore} [store_pre] DEPRECATED: Use "storePre" instead of this
 * @property {boolean} [replace] Indicates if new messages must replace (edit) original
 * @property {Object<string, scriptStep>} [c]
 * @property {string} [path]
 */

/**
 * BotCMS is a simple way to use bots at most popular networks from one point
 * @class
 *
 * @property {Object<string, string>} ATTACHMENTS
 * @property {Object<string, string>} BINDINGS
 * @property {string} SELF_SEND=__self__
 * @property {Object<string, Object>} bridges
 * @property {Array} commands
 * @property {Object} config
 * @property {Object} defaults
 * @property {Object} keyboards
 *
 * @property {MVTools} MT
 * @property {Tools} T
 * @property {Scripts} Scripts
 * @property {MiddlewareManager} MiddlewareManager
 * @property {Object<Lexicons>} Lexicons
 * @property {Scripts} Scripts
 * @property {Object<Logger>} Logger
 * @property {Templater} Templater
 * @property {Object|null} DB
 *
 * @function lexicon
 *
 */

class BotCMS {

    /**
     * @constructor
     * @param {Object} config
     */
    constructor (config = {}) {

        this.ATTACHMENTS = {
            PHOTO: 'photo',
            VIDEO: 'video',
            AUDIO: 'audio',
            VOICE: 'voice',
            FILE: 'file',
            LINK: 'link',
            POST: 'post',
            POLL: 'poll',
            STICKER: 'sticker',
            FORWARD: 'forward',
            ANIMATION: 'animation',
            VIDEONOTE: 'videoNote'
        };
        this.BINDINGS = {
            FILE: '$FILE ',
            METHOD: '$METHOD ',
        };
        this.SELF_SEND = '__self__';

        this.bridges = {};
        this.commands = [];
        this.config = {};
        this.keyboards = {};

        this.defaults = {
            classes: {
                /** @deprecated */
                Answer,
                Attachment,
                Context,
                /** @deprecated */
                KeyBoard: Keyboard,
                Keyboard,
                Lexicons,
                Message,
                Parcel,
                SessionManager,
                Logger,
                StorageManager,
                Scripts,
                Templater,
                Tools,
            },
            db: {},
            Context: {},
            Lexicons: {},
            SessionManager: {},
            StorageManager: {},
            language: 'en',
            drivers: {
                tg: './drivers/telegram',
                vk: './drivers/vkontakte',
            },
            launchDelay: 500,
            loaders: ['lexicons', 'keyboards', 'scripts', 'config', 'cron', 'middlewares'],
            middlewareMethods: [],
            middlewares: {},
            networks: [],
            requireModule: false,
            callbackDataPrefix: 'cb:',
            callbackDataKeys: ['data', 'handler', 'params', 'answer', 'path'],
        };

        this.MT = new MVTools();
        this.loadConfig(config);

        this.T = new this.config.classes.Tools(this);
        this.Lexicons = new this.config.classes.Lexicons(this);
        this.Scripts = new this.config.classes.Scripts(this);
        this.Templater = new this.config.classes.Templater();
        this.MiddlewareManager = new MiddlewareManager(this);
        this.Logger =  new this.config.classes.Logger(this)
        this.StorageManager =  new this.config.classes.StorageManager(this)
        this.DB = null;

        this.useMultiple(this.config.middlewareMethods);
        this.useMultiple(this.config.middlewares);
    }

    async loadSchema (schema = {}, path = '') {
        schema = this.MT.readConfig(schema, this.BINDINGS.FILE, path, true);
        for (let loader of this.config.loaders) {
            if (schema.hasOwnProperty(loader) && !this.MT.empty(schema[loader])) {
                let method = 'load' + loader[0].toUpperCase() + loader.substring(1);
                try {
                    this[method](schema[loader]);
                } catch (e) {}
            }
        }
    }

    loadConfig (config) {
        this.config = this.MT.mergeRecursive(this.defaults, this.config, config);
    }

    loadLexicons (lexicons) {
        this.Lexicons.load(lexicons);
    }

    loadKeyboards (keyboards) {
        this.keyboards = this.MT.mergeRecursive(this.keyboards, keyboards);
    }

    loadScripts (scripts) {
        this.Scripts.load(scripts);
    }

    /**
     * @param {Object<string, scriptStep>} jobs
     */
    loadCron (jobs) {
        for (let key in jobs) {
            if (Object.prototype.hasOwnProperty.call(jobs, key)) {
                this.addCronJob(jobs[key]);
            }
        }
    }

    /**        let noProcess = false

     * @param {scriptStep} jobData
     */
    addCronJob (jobData) {
        let schedule = this.MT.isString(jobData.trigger) ? jobData.trigger : jobData.trigger.value;
        let job = new CronJob(schedule, () => this.processCronJob((jobData)), () => {}, false, 'Atlantic/Reykjavik');
        job.start();
    }

    processCronJob (jobData) {
        return this.doAction(jobData);
    }

    /**
     * Load middleware packages from definitions in schema
     * @deprecated
     * @param middlewares
     * @return {Promise<void>}
     */
    async loadMiddlewares (middlewares) {
        for (let name in middlewares) {
            if (Object.prototype.hasOwnProperty.call(middlewares, name)) {
                await new Promise((resolve) => {
                    // this.mwParams[name] = middlewares[name];
                    // console.log(name);
                    // console.log(middlewares[name]);
                    let mw;
                    if (this.config.requireModule) {
                        mw = this.config.requireModule(name);
                    } else {
                        mw = require(name);
                    }
                    resolve(new mw);
                })
                    .then(m => {
                        // console.log(m);
                        this.use(m);
                    })
                    .catch(reason => console.error('MIDDLEWARE ' + name + ' FAILED TO START. SKIPPED. DETAILS', reason));
            }
        }
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
            switch (step) {
                case 'handle':
                    step = 'handleUpdate';
                    break;
                case 'process':
                    step = 'doUpdate';
                    break;
                case 'action':
                    step = 'doAction';
                    break;
                default:
                    step = '';
            }
            if (!this.MT.empty(step)) {
                this.MiddlewareManager.use(step, method);
            }
        } else {
            method = step;
            this.MiddlewareManager.use(method);
        }
    }

    async init () {
        await this.initNetworks(this.config.networks);
        await this.initDB();
    }

    async initNetworks (networks) {
        let promises = [];
        if (!this.MT.empty(networks)) {
            for (let network in networks) {
                if (!networks.hasOwnProperty(network)) {
                    continue;
                }
                promises.push( (async () => {
                    let name = networks[network]['name'] ? networks[network]['name'] : network;
                    let driver;
                    let driverName = this.MT.empty(networks[network]['driver']) ? name : networks[network]['driver'];
                    if (typeof this.config.drivers[driverName] === 'string') {
                        driver = require(this.config.drivers[driverName]);
                    } else {
                        driver = this.config.drivers[driverName];
                    }
                    if (this.MT.empty(driver)) {
                        console.error('ERROR. NO DRIVER FOR NETWORK ', driverName);
                        return;
                    }
                    // console.log('INIT NETWORKS. NAME', name, 'DRIVER NAME', driverName);
                    let tmp = new driver(this, networks[network]);
                    if (tmp.isAvailable() === true) {
                        this.bridges[name] = tmp;
                        await this.bridges[name].listen();
                    } else {
                        console.error('ERROR. DRIVER FOR NETWORK ' + driverName + ' FOUND, BUT NETWORK NOT AVAILABLE');
                    }
                    return true;
                })());
            }
        }
        return Promise.all(promises);
    }

    async initDB() {
        return this.DB !== null ? this.successDB() : this.failDB('NO ACTIVE DB')
    }

    successDB () {}

    failDB (error) {}

    async handleUpdate (ctx) {
        // return;
        console.debug('======================');
        console.debug('=== HANDLE UPDATE ====');
        console.debug('======================');

        /** @type {import(Logger).loggerData} */
        const logData = {
            ctx,
            outbound: false,
            fromMethod: 'BotCMS.handleUpdate',
            additional: {
                text: ctx.msg
            }
        }

        if (ctx.Message.sender.id === this.SELF_SEND) {
            console.debug(' ');
            console.debug('======================');
            console.debug('=== SELF  MESSAGE ====');
            console.debug('======= RETURN =======');
            console.debug('======================');
            return ctx
        }

        let noProcess = false
        if (ctx.isProcessed) {
            console.debug(' ');
            console.debug('======================');
            console.debug('== MESSAGE  ALREADY ==');
            console.debug('===== PROCESSED. =====');
            console.debug('======= RETURN =======');
            console.debug('======================');
            noProcess = true
        }

        if (noProcess) {
            await this.Logger.handle(logData)
            return ctx
        }
        console.log('MESSAGE: ' + ctx.Message.text);
        // console.log('SESSION: ', ctx.session);

        let opts = {updateSession: true}
        let path = this.MT.extract('Message.query.path', ctx)
        if (path) {
            opts.updateSession = false
        }
        if (!path) {
            path = this.MT.extract('session.step.path', ctx)
        }
        if (!path) {
            // scope -- deprecated
            path = this.MT.extract('session.step.scope', ctx)
        }
        if (!path) {
            path = 'c'
        }
        logData.path = path
        // console.log('PATH', path)

        let keyboardOptions = this.Scripts.extract(path + '.keyboard.options');
        opts.kbRemove = Array.isArray(keyboardOptions) && keyboardOptions.indexOf('oneTime') > -1;

        // console.log('COMMANDS PATH: ', this.commands);
        let nextStep = {};
        let step = await this.getStepByCommand(ctx);
        if (step !== undefined) {
            logData.additional.command = true
            nextStep = step;
        } else {
            step = this.Scripts.extract(path);
            // console.log('HANDLE UPDATE. STEP', step)
            if (!this.MT.empty(step)) {
                let validate = this.MT.extract('validate', step, {});
                let actions = await this.T.processGotos(ctx, validate);
                await this.doMethods(actions.methods);
                await this.doHelp(ctx, actions.help, opts);
                this.store(step, ctx);
                nextStep = await this.findNextStep(actions, ctx);
            } else {
                console.error('NEXT STEP PATH ' + path + ' SPECIFIED AND NOT FOUND');
                logData.additional.notFoundStep = true
            }
        }

        if (!this.MT.empty(nextStep)) {
            opts = this.MT.merge(opts, await this.formStore(ctx, step, ctx.Message.id))
            if (opts.formMsgId) {
                opts.updateSession = true
                opts.fromStep = step
            }
        }

        let result
        if (this.MT.empty(nextStep)) {
            logData.additional.stepNotFound = true
            if (this.MT.extract('defaults.action', this.config) === 'help') {
                nextStep = this.Scripts.extract('c.help')
                opts.updateSession = false
            }
        }

        await this.Logger.handle(logData)
        result = await this.doUpdate(nextStep, ctx, opts);
        return result
    }

    /**
     *
     * @param {scriptStep} current
     * @param {Context} ctx
     * @param {Object} opts
     * @return {Promise<null|*>}
     */
    async doUpdate (current, ctx, opts = {}) {

        // console.log('DO UPDATE. CURRENT: ', current);
        // console.log('DO UPDATE. OPTS', opts);
        if (this.MT.empty(current)) {
            return null;
        }
        let updateSession = this.MT.extract('updateSession', opts, true)
        ctx[updateSession ? 'session' : 'state'].step = current;
        this.store(current, ctx, true);
        let result = null;

        if (current.replace === 'forceNone') opts.replace = current.replace

        await this.doAction(current, ctx);

        if (!this.MT.empty(current.message)) {
            let parcel = new this.config.classes.Parcel();
            parcel.message = await ctx.lexicon(current.message);
            parcel.peerId = !!current.replace && opts.formChatId ? opts.formChatId : ctx.Message.chat.id;
            parcel.keyboard = await (new this.config.classes.Keyboard(ctx))
              .fromKBObject(current.keyboard_name || current.keyboard)
              .then(kb => kb.build());
            parcel.attachments = current.attachments || {};
            let  editMsgId = 0
            if (current.replace && opts.replace !== 'forceNone') {
                if (this.isFormOpen(current)) {
                    if (opts.formMsgId) editMsgId = opts.formMsgId
                    else if (!this.isFormQuestion(opts.fromStep)) editMsgId = ctx.Message.id
                } else if (this.isFormQuestion(current)) {
                    if (ctx.Message.selfWrote()) editMsgId = ctx.Message.id
                    else editMsgId = this.getFormLastQuestionId(ctx)
                } else if (this.getFormId(ctx)) editMsgId = this.getFormId(ctx)
                else if (ctx.Message.selfWrote()) editMsgId = ctx.Message.id

                 // /*&& !this.isFormQuestion(opts.fromStep)*/ ? ctx.Message.id : (opts.formMsgId || 0)
            }
            parcel.editMsgId = editMsgId
            result = await ctx.reply(parcel);
            // console.log(current, result)
            await this.formStore(ctx, current, result, true)
        }
        let goto = this.MT.extract('goto', current);
        // console.log('DO ACTION. GOTO', goto)
        if (!this.MT.empty(goto)) {
            let actions = await this.T.processGotos(ctx, goto);
            // console.log('DO ACTION. GOTO ACTIONS', actions)
            await this.doMethods(actions.methods);
            await this.doHelp(ctx, actions.help, opts);
            let nextStep = await this.findNextStep(actions, ctx, [current.path]);
            if (!this.MT.empty(nextStep)) {
                opts.updateSession = 'updateSession' in opts ? opts.updateSession : true
                return this.doUpdate(nextStep, ctx, opts);
            }
        }
        return result;
    }

    async doAction(step, ctx = undefined) {
        let promises = [];
        if (!this.MT.empty(step.action)) {
            // console.log('BOTCMS DO ACTION. ACTION: ', step.action);
            if (this.MT.isString(step.action)) {
                step.action = {type: 'method', name: step.action};
            }
            let type = this.MT.extract('type', step.action, 'method');
            let parameters = this.MT.extract('params', step.action, this.MT.extract('options', step.action, {}));
            let params = this.MT.copyObject(parameters);
            switch (type) {
                case 'send':
                    let fromScope = this.MT.extract('from_scope', params);
                    let targets = this.MT.extract('target', params);
                    let message = ctx ? await ctx.lexicon(step.message) : await this.Lexicons.process(step.message);

                    if (!this.MT.empty(fromScope) && !this.MT.empty(ctx)) {
                        let answers = ctx.session.answers;
                        if (!this.MT.empty(answers[fromScope])) {
                            message = await ctx.lexicon(this.MT.extract('message', params, step.message)) + "\n\n";
                            for (let key in answers[fromScope]) {
                                if (answers[fromScope].hasOwnProperty(key)) {
                                    message = message + await ctx.lexicon(answers[fromScope][key].message) + '>> ' + answers[fromScope][key].answer + "\n\n";
                                }
                            }
                        }
                    }

                    if (!this.MT.empty(targets)) {
                        for (let name in targets) {
                            if (targets.hasOwnProperty(name) && !this.MT.empty(this.bridges[name])) {
                                let peers = this.MT.makeArray(targets[name]);
                                let kb = new this.config.classes.Keyboard(this, params.keyboard || step.keyboard);
                                kb.bridge = name;
                                let keyboard = await kb.build()
                                for (let peer of peers) {
                                    if (this.MT.empty(this.bridges[name])) {
                                        console.error('WRONG TRANSPORT NAME ' + name + ' IN ACTION BLOCK');
                                        continue;
                                    }
                                    let parcel = new this.config.classes.Parcel();
                                    peer = (peer === this.SELF_SEND) ? ctx.Message.sender.id : peer;
                                    parcel.peerId = peer;
                                    parcel.message = message || '';
                                    parcel.keyboard = keyboard
                                    promises.push(this.bridgeExec({ bridge: name, method: 'send', params: parcel }))
                                }
                            }
                        }
                    }
                    break;

                case 'method':
                    let path = step.action.method || step.action.name || step.action.value;
                    let method = this.MT.extract(path);
                    if (method) {
                        promises.push(method(ctx, params));
                    } else {
                        console.error('BOTCMS DO ACTION. METHOD ' + step.action.name + ' NOT FOUND');
                    }
                    break;
            }
        }
        return Promise.all(promises).catch(reason => console.error('ERROR WHILE EXEC ACTION: ', reason));
    }

    async doMethods (ctx, methods) {
        methods = this.MT.makeArray(methods);
        for (let method of methods) {
            method = this.MT.extract(method);
            if (!this.MT.empty(method)) {
                await method(ctx);
            }
        }
    }

    async doHelp (ctx, helpPath, opts = {}) {
        if (this.MT.empty(helpPath)) {
            return;
        }
        const helpStep = this.Scripts.extract(helpPath);
        if (!this.MT.empty(helpStep)) {
            opts.updateSession = false
            await this.doUpdate(helpStep, ctx, opts);
        } else {
            console.error('PATH ' + helpPath + ' NOT FOUND');
        }
    }

    async getStepByCommand (ctx) {
        // console.log('GET STEP BY COMMAND. TYPE OF COMMAND: ', typeof ctx);
        // if (typeof ctx.Message.text !== 'string') {
        //     return undefined;
        // }
        for (let i in this.commands) {
            if (!this.commands.hasOwnProperty(i)) {
                continue;
            }
            const path = this.commands[i];
            // console.log('GET STEP BY COMMAND. PATH: ' + path);
            let step = this.Scripts.extract(path);
            if (step !== undefined && !this.MT.empty(step.trigger) && await this.T.checkTrigger(ctx, step.trigger)) {
                // console.log('GET STEP BY COMMAND. FOUND');
                return step;
            }
        }
        return undefined;
    }

    async findNextStep (actions, ctx, exclude = []) {
        let nextStep = {};
        if (!this.MT.empty(actions)) {
            // console.log('FIND NEXT STEP. ACTIONS', actions)
            if (!this.MT.empty(actions.goto)) {
                const next = this.Scripts.extract(actions.goto);
                // console.info('BOTCMS HANDLE UPDATE. NEXT STEP: ', next);
                if (!this.MT.empty(next)) {
                    if (this.T.isChildrenPath(actions.goto)) {
                        // console.error('FIND NEXT STEP. NEXT PATH IS CHILDREN');
                        for (let key in next) {
                            if (next.hasOwnProperty(key)) {
                                // console.error('FIND NEXT STEP. CHECK KEY: ', key, ' TRIGGER: ', next[key].trigger);
                                if (await this.T.checkTrigger(ctx, next[key].trigger)) {
                                    if (exclude.indexOf(next[key].path) === -1) {
                                        nextStep = next[key];
                                        break;
                                    }
                                }
                            }
                        }
                    } else {
                        if (exclude.indexOf(next.path) === -1) {
                            nextStep = next;
                        }
                    }
                } else {
                    console.error('NEXT STEP PATH ' + actions.goto + ' SPECIFIED AND NOT FOUND');
                }
            } else {
                console.error('FIND NEXT STEP. ACTIONS IS NOT undefined BUT GOTO NOT FOUND');
            }
        }
        // console.log('FOUND NEXT STEP: ', nextStep);
        return nextStep;
    }

    /** @deprecated */
    async buildAnswer (ctx, step) {
        // console.log('BUILD ANSWER. STEP ', step);
        const Answer = new this.config.classes.Answer(this, ctx, step);
        return Answer.build();
    }

    /**
     *
     * @param {scriptStep} step
     * @param {Context} ctx
     * @param {boolean} pre
     */
    store (step, ctx, pre = false) {
        let store = (pre ? (step.storePre || step.store_pre) : step.store) || {};
        if (this.MT.empty(store)) {
            return;
        }
        if (store === true) {
            store = {};
        }
        store.thread = store.thread || this.T.extractAnswerThread(step);
        ctx.session.answers = ctx.session.answers || {};
        let cleanOld = store.clear || store.clean || !this.MT.empty(step['store-clean']) || !this.MT.empty(step['store_clean']);
        if (cleanOld || !(ctx.session.answers[store.thread] instanceof Object)) {
            ctx.session.answers[store.thread] = {};
        }
        let key = store.key || Object.keys(ctx.session.answers[store.thread]).length + 1;
        let answerData = {
            message: step.message,
            answer: ('value' in store) ? store.value : ctx.msg,
        };
        ctx.session.answers[store.thread] = this.MT.setByPath(key, ctx.session.answers[store.thread], answerData);
        // console.log('STORE ANSWER. ANSWERS THREAD ' + store.thread + ' UPDATED: ', ctx.session.answers[store.thread]);
    }

    getFormLastQuestionId (ctx) {
        const answers = this.MT.extract('form.formQuestionIds', ctx.session, [])
        return Array.isArray(answers) && answers.length ? answers[answers.length - 1] : 0
    }

    getFormId (ctx) {
        return this.MT.extract('formMsgId', ctx.session.form, 0)
    }

    isFormOpen (step) {
        return step.form === true || (typeof step.form === 'object' && step.form.open === true)
    }

    isFormQuestion (step) {
        return typeof step === 'object' && (typeof step.form === 'object' && step.form.question === true || step.form === 'question')
    }

    isFormClear (step) {
        return typeof step === 'object' && (typeof step.form === 'object' && step.form.clear === true || step.form === 'clear')
    }

    async formStore (ctx, step, ids = [], outboundIds = false) {
        // console.log('FORM STORE. CTX STEP PATH', ctx.session.step.path, 'STEP PATH', step.path, 'STEP FORM', step.form, 'MSG', ctx.msg, 'IDS', ids)
        // let form = {}
        // @TODO Hack for returned message objects instead of ids after send
        ids = this.MT.makeArray(ids)
        for (let i in ids) {
            if (Object.prototype.hasOwnProperty.call(ids, i) && typeof ids[i] === 'object') {
                ids[i] = ids[i].message_id
            }
        }
        let isFormOpen = this.isFormOpen(step)
        // console.log('FORM STORE. IS FORM OPEN', isFormOpen)
        if (isFormOpen) {
            // console.log('FORM STORE. IF SECTION IS FORM OPEN')
            if (typeof ctx.session.form !== 'object' || this.MT.empty(ctx.session.form)) {
                ctx.session.prevStep = ctx.session.step
                ctx.session.step = this.MT.copyObject(step)

                // ctx.session.form = {
                //     formChatId: ctx.Message.chat.id,
                //     formMsgId: ids[0],
                //     formQuestionIds: [],
                //     formAnswerIds: []
                // }
            } else {
                // form = ctx.session.form
                if (ctx.session.form.formQuestionIds.length) {
                    await ctx.remove(ctx.session.form.formQuestionIds, ctx.session.form.formChatId)
                    ctx.session.form.formQuestionIds = []
                }
                if (ctx.session.form.formAnswerIds.length) {
                    await ctx.remove(ctx.session.form.formAnswerIds, ctx.session.form.formChatId)
                    ctx.session.form.formAnswerIds = []
                }
            }
            const oldFormId = this.MT.extract('form.formMsgId', ctx.session, 0)
            // if (this.MT.empty(ctx.session.form)) {
                ctx.session.form = {
                    formChatId: ctx.Message.chat.id,
                    formMsgId: oldFormId ? oldFormId : ids[0],
                    formQuestionIds: [],
                    formAnswerIds: []
                }
            // }
            if (ctx.Message.selfWrote()) ctx.session.form.formMsgId = ids[0]
        }

        if (this.isFormQuestion(step)) {
            // console.log('FORM STORE. IF SECTION IS FORM QUESTION')
            if (ctx.session.form) {
                ctx.session.step = this.MT.copyObject(step)
                ids = this.MT.makeArray(ids)
                ctx.session.form.formQuestionIds = ctx.session.form.formQuestionIds || []
                ctx.session.form.formAnswerIds = ctx.session.form.formAnswerIds || []
                // console.log('FORM STORE. QUESTION. SENDER', ctx.Message.sender, 'AUTHOR', ctx.Message.author)
                if (outboundIds) {
                    // console.log('FORM STORE. SELF WROTE. IDS', ids)
                    for (let id of ids) {
                        if (ctx.session.form.formQuestionIds.indexOf(id) === -1) {
                            ctx.session.form.formQuestionIds.push(id)
                        }
                    }
                } else {
                    // console.log('FORM STORE. NOT SELF WROTE. IDS', ids)
                    for (let id of ids) {
                        if (ctx.session.form.formAnswerIds.indexOf(id) === -1 && ctx.session.form.formQuestionIds.indexOf(id) === -1) {
                            ctx.session.form.formAnswerIds.push(id)
                        }
                    }
                }
                // form = ctx.session.form

            }

        }

        if (this.isFormClear(step) && typeof ctx.session.form === 'object') await this.formClear(ctx)

        if (this.MT.empty(ctx.session.form)) {
            // console.log('FORM STORE. IF SECTION NO FORM')
            if (ctx.session.prevStep) {
                ctx.session.step = ctx.session.prevStep
                delete ctx.session.prevStep
            }
            if (ctx.session.form) {
                // form = ctx.session.form
                // if (!this.isFormClear(step))
                delete ctx.session.form
                await this.formClear(ctx)
            }
        }
        // console.log('FORM STORE. RETURN FORM DATA', form)
        // console.log('FORM STORE. STORED FORM DATA', ctx.session.form)
        return ctx.session.form || {}
    }

    async formClear (ctx) {
        const formQuestionIds = this.MT.extract('formQuestionIds', ctx.session.form, [])
        if (formQuestionIds.length) {
            await ctx.remove(ctx.session.form.formQuestionIds, form.formChatId)
        }
        const formAnswerIds = this.MT.extract('formAnswerIds', ctx.session.form, [])
        if (formAnswerIds.length) {
            await ctx.remove(ctx.session.form.formAnswerIds, form.formChatId)
        }
    }

    /**
     *
     * @param {string} key Key of lexicon entry
     * @param {Object} [params] Additional params
     * @param {string} [language] Language
     * @param {Context} [ctx] Context of user message
     * @return {*|Promise<*>|string}
     */
    lexicon (key, params = {}, language = undefined, ctx = undefined) {
        return this.Lexicons.process(key, params, (language ? language : this.config.language), (ctx ? ctx : this));
    }

    launch (middleware, ...middlewares) {
        let i = 0;
        let bridges = this.bridges;
        for (let network in this.bridges) {
            if (this.bridges.hasOwnProperty(network)) {
                setTimeout((bridge, method, middleware, ...middlewares) => {
                    this.launchNetwork(bridge, middleware, ...middlewares)
                }, this.config.launchDelay * i, bridges[network], middleware, ...middlewares);
            }
            i = i + 1;
        }
    }

    launchNetwork(bridge, middleware, ...middlewares) {
        bridge.launch(middleware, ...middlewares).then(() => {
            if (this.MT.extract('notifyLaunch.bridge', this.config) === bridge.name) {
                let parcel = new this.config.classes.Parcel();
                parcel.peerId = this.MT.extract('notifyLaunch.peerId', this.config);
                parcel.message = this.MT.extract('notifyLaunch.message', this.config);
                this.bridgeExec({ bridge, method: 'send', params: parcel }).catch(e => console.error('ERROR WHILE NOTIFY ABOUT START:', e))
            }
        });
        // console.log('TIMED OUT. NETWORK %s, METHOD %s', network, method);
    }

    /**
     *
     * @param {Object<Logger.DTO>} execParams
     */
    async bridgeExec (execParams, logParams = {}) {
        const bridge = this.MT.empty(execParams.bridge) && !this.MT.empty(execParams.ctx) ? execParams.ctx.Bridge : this.getBridge(execParams.bridge)
        const bridgeName = (typeof execParams.bridge === 'string') ? execParams.bridge : bridge.name
        if (execParams.method in bridge) {
            execParams.methodParams = this.MT.makeArray(execParams.methodParams)
            const methodResult = bridge[execParams.method](...execParams.params)
            if (!execParams.noLog) {
                const logData = this.MT.mergeRecursive({
                    bridge: bridgeName,
                    driver: bridge.driverName,
                    method: execParams.method,
                    methodParams: execParams.params,
                    ctx: execParams.ctx,
                    result: methodResult,
                    // outbound: execParams.outbound,
                    event: execParams.event,
                }, logParams)
                if ('outbound' in execParams) logData.outbound = execParams.outbound
                setTimeout(() => this.Logger.handle(logData).catch(e => console.error('LOGGER HANDLER ERROR:', e)), 0)
            }
            return methodResult
        } else {
            throw new Error('METHOD ' + execParams.method + ' NOT FOUND IN BRIDGE ' + bridgeName)
        }
    }

    getBridge (bridge) {
        let resultBridge = bridge
        if (typeof bridge === 'string') resultBridge = this.bridges[bridge]
        else if (bridge === undefined) {
            if (Object.keys(this.bridges).length === 1) {
                resultBridge = this.bridges[Object.keys(this.bridges)[0]]
            }
        }
        return resultBridge
    }

    /**
     * @param {string} key
     * @return {Object<string, *>}
     */
    getCBData (key) {
        return this.getStorageData(key)
    }

    storeCBData (cbData) {
        let data = {}
        // console.log('STORE CALLBACK DATA. VALUES 1', cbData)
        for (let key of this.config.callbackDataKeys) {
            if (key in cbData) {
                data[key] = cbData[key]
            }
        }
        // console.log('STORE CALLBACK DATA. DATA 1', data)
        if (this.MT.empty(data.data) && !this.MT.empty(cbData.text)) {
            data.data = cbData.text
        }
        const key = this.config.callbackDataPrefix + this.MT.md5(JSON.stringify(data))
        // console.log('STORE CALLBACK DATA. DATA 2', data)
        return this.setStorageData(key, data)
    }

    getStorageData (key) {
        return this.StorageManager.storeGet(key)
    }

    async setStorageData (key, data) {
        await this.StorageManager.storeSet(key, data)
        return key
    }
}

BotCMS.Attachment = Attachment
BotCMS.Context = Context
BotCMS.Keyboard = Keyboard
BotCMS.Message = Message
BotCMS.Parcel = Parcel
BotCMS.Logger = Logger
BotCMS.Tools = Tools
BotCMS.MVTools = MVTools

module.exports = BotCMS;
module.exports.default = BotCMS;