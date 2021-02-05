const Telegraf = require('telegraf');
const TelegramAPI = require('telegraf/telegram');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');

/** Telegram driver
 * @class
 *
 * @property {Object} defaults
 * @property {string} driverName
 * @property {string} name
 *
 * @property {Object<import('botcms')>} BC
 * @property {Object<import('telegraf')>} Transport
 * @property {Object<import('telegraf/telegram)>} Telegram
 */

class Telegram {
    constructor (BC, params = {}) {
        this.BC = BC;

        this.defaults = {
            name: 'tg',
            driverName: 'tg',
            humanName: 'Telegram',
            useSession: true,
            extraParams: {
                markup: {
                    key: 'parse_mode',
                    values: {
                        md: 'MarkdownV2',
                        html: 'HTML',
                    }
                },
                noPreview: 'disable_web_page_preview',
                silent: 'disable_notification',
                caption: 'caption',
                duration: 'duration',
                title: 'title',
                performer: 'performer',
                width: 'width',
                height: 'height',
                latitude: 'latitude',
                longitude: 'longitude',
            },
            EscapeSymbolsReplace: {},
            htmlEscapeSymbolsReplace: {},
            mdEscapeSymbolsReplace: {
                // '_': '\\_',
                '-': '\\-',
                '+': '\\+',
                // '*': '\\*',
                '#': '\\#',
                '.': '\\.',
                '(': '\\(',
                ')': '\\)',
                '[': '\\[',
                ']': '\\]',
                '{': '\\{',
                '}': '\\}',
                '<': '\\<',
                '>': '\\>',
                '|': '\\|',
                '!': '\\!',
                // '`': '\\`',
                // '\\': '\\\\',
            },
            /** @ */
            returnSentMsg: false,
            attachmentTypesEqual: {
                [this.BC.ATTACHMENTS.FILE]: 'document',
                // [this.BC.ATTACHMENTS.POLL]: 'poll',
                [this.BC.ATTACHMENTS.PHOTO]: 'photo',
                [this.BC.ATTACHMENTS.AUDIO]: 'audio',
                [this.BC.ATTACHMENTS.VIDEO]: 'video',
                [this.BC.ATTACHMENTS.STICKER]: 'sticker',
                [this.BC.ATTACHMENTS.VIDEONOTE]: 'video_note',
            },
            attachmentFieldsEqual: {
                id: 'file_id',
                width: 'width',
                height: 'height',
                fileSize: 'file_size',
                mimeType: 'mime_type',
                title: 'title',
                animated: 'is_animated',
                emoji: 'emoji',
                groupName: 'set_name'
            }
        };
        this.user = {};
        this.config = this.BC.MT.merge(this.defaults, params)
        this.name = params.name || this.defaults.name;
        this.driverName = params.driverName || this.defaults.driverName;
        this.humanName = params.humanName || this.defaults.humanName;
        // console.log('TG: ');
        // console.log(params);
        this.transport = new Telegraf(params.token);
        this.Telegram = new TelegramAPI(params.token);
        if (Array.isArray(params.middlewares)) {
            for (let mw of params.middlewares) {
                this.transport.use(mw);
            }
        }
        this.transport.catch((err, ctx) => {
            console.log(`Ooops, encountered an error for ${ctx.updateType}`, err)
        })

        this.waitUser = async (n = 0) => {
            if (n > 0 && n % 500 === 0) console.debug('TG', this.name, 'WAITING USER (getMe). CURRENT ID:', this.user.id, 'N:', n)
            if (this.user.id !== 0) {
                return this.user
            } else {
                await this.MT.sleep(5)
                n++
                return this.waitUser(n)
            }
        }
    }

    /**
     * @deprecated
     * @return {{}}
     */
    get tgUser () {
        return this.user
    }

    /**
     * @deprecated
     * @param {Object} user
     */
    set tgUser (user) {
        this.user = user
    }

    isAvailable () {
        return typeof this.transport === 'object';
    }

    /**
     * @param {Telegram} t
     * @param ctx
     * @return {Promise<boolean|*>}
     */
    async messageCallback (t, ctx) {
        // console.dir(ctx.update, {depth: 5});
        // console.log(ctx.update.message.photo);
        await this.waitUser()

        /** @type {Object<import('../context.js')>} **/
        let bcContext = new this.BC.config.classes.Context(this.BC, this, ctx, this.config);
        let message = {};
        let from = {};
        let author = {}
        let edited = false;
        let event = '';
        let queryData = {
            id: '',
            data: '',
            msgId: '',
            chatId: '',
            senderId: '',
        }
        let forwarded = {sender: {}, chat: {}};
        let EVENTS = bcContext.Message.EVENTS;

        bcContext.genUid(ctx.update.update_id)

        if ('message' in ctx.update) {
            message = ctx.update.message;
            event = EVENTS.MESSAGE_NEW;
            from = message.from || {id: -1};
        } else if ('edited_message' in ctx.update) {
            message = ctx.update.edited_message;
            edited = true;
            event = EVENTS.MESSAGE_EDIT;
            from = message.from || {id: -1};
        } else if ('channel_post' in ctx.update) {
            message = ctx.update.channel_post;
            event = EVENTS.CHAT_MESSAGE_NEW;
            from = {id: -1};
        } else if ('edited_channel_post' in ctx.update) {
            message = ctx.update.edited_channel_post;
            edited = true;
            event = EVENTS.CHAT_MESSAGE_EDIT;
            from = {id: -1};
        } else if ('inline_query' in ctx.update) {
            // message = ctx.update.edited_channel_post;
            event = EVENTS.QUERY_INLINE;
            from = ctx.update.message.from;
        } else if ('chosen_inline_result' in ctx.update) {
            // message = ctx.update.edited_channel_post;
            event = EVENTS.RESULT_INLINE_CHOSEN;
            from = ctx.update.message.from;
        } else if ('callback_query' in ctx.update) {
            event = EVENTS.QUERY_CALLBACK
            message = ctx.update.callback_query.message
            from = ctx.update.callback_query.from || {id: -1}
            author = message.from || {id: -1}
            queryData.id = ctx.update.callback_query.id
            queryData.data = ctx.update.callback_query.data
            queryData.msgId = ctx.update.callback_query.message.message_id
            queryData.senderId = from.id
            queryData.chatId = message.chat.id
        } else if ('shipping_query' in ctx.update) {
            // message = ctx.update.edited_channel_post;
            event = EVENTS.QUERY_SHIPPING;
            from = ctx.update.message.from;
        } else if ('pre_checkout_query' in ctx.update) {
            // message = ctx.update.edited_channel_post;
            event = EVENTS.QUERY_PRE_CHECKOUT;
            from = ctx.update.message.from;
        } else if ('poll' in ctx.update) {
            // message = ctx.update.edited_channel_post;
            event = EVENTS.POLL_NEW;
        } else if ('poll_answer' in ctx.update) {
            // message = ctx.update.edited_channel_post;
            event = EVENTS.POLL_ANSWER;
        } else if ('new_chat_members' in ctx.update) {
            event = EVENTS.CHAT_MEMBER_NEW;
        } else if ('left_chat_member' in ctx.update) {
            event = EVENTS.CHAT_MEMBER_LEFT;
        }

        if (message.hasOwnProperty('forward_date')) {
            forwarded.date = message.forward_date;
            if ('forward_from_message_id' in message) {
                forwarded.id = message.forward_from_message_id;
            }
            if ('forward_signature' in message) {
                forwarded.sender.fullname = message.forward_signature;
            }
            if ('forward_sender_name' in message) {
                forwarded.sender.fullname = message.forward_sender_name;
            }
            if ('forward_from' in message) {
                forwarded.sender = bcContext.Message.fillUser(this.normalizeUser(message.forward_from));
            }
            if ('forward_from_chat' in message) {
                forwarded.chat = {
                    id: message.forward_from_chat.id,
                    type: t.getChatType(message.forward_from_chat.type),
                };
            }
            bcContext.Message.handleForwarded(forwarded);
            console.log('TG DRV. FORWARDED', forwarded)
        }

        if (this.user.id === from.id) {
            bcContext.Message.sender = bcContext.Message.fillUser({
                id: this.BC.SELF_SEND,
                isBot: true,
                username: this.name,
            });
        } else if (Object.keys(from).length) {
            bcContext.Message.sender = bcContext.Message.fillUser(this.normalizeUser(from));
        }
        if (this.user.id === author.id) {
            bcContext.Message.author = bcContext.Message.fillUser({
                id: this.BC.SELF_SEND,
                isBot: true,
                username: this.name,
            });
        } else if (Object.keys(author).length) {
            bcContext.Message.author = bcContext.Message.fillUser(this.normalizeUser(from));
        } else if (Object.keys(forwarded.sender).length) {
            bcContext.Message.author = bcContext.Message.fillUser(this.normalizeUser(forwarded.sender));
        }

        if (message === {}) {
            return false;
        }

        let chatType = t.getChatType(message.chat.type);

        bcContext.Message.chat = {
            id: message.chat.id,
            type: chatType,
        };
        bcContext.Message.query = queryData
        bcContext.Message.id = message.message_id;
        bcContext.Message.date = message.date;
        bcContext.Message.text = message.text;
        bcContext.Message.edited = edited;
        bcContext.Message.event = event;

        if (message.hasOwnProperty('reply_to_message')) {
            bcContext.Message.reply = {
                id: message.reply_to_message.message_id,
                text: message.reply_to_message.text,
                chatId: message.reply_to_message.chat.id,
                senderId: message.reply_to_message.from ? message.reply_to_message.from.id : 0,
            }
        }

        if (message.hasOwnProperty('new_chat_members')) {
            bcContext.Message.event = EVENTS.CHAT_MEMBER_NEW;
            for (let member of message.new_chat_members) {
                bcContext.Message.handleUsers(this.normalizeUser(member));
            }
        }

        if (message.hasOwnProperty('left_chat_member')) {
            bcContext.Message.event = EVENTS.CHAT_MEMBER_LEFT;
            bcContext.Message.handleUsers(this.normalizeUser(message.left_chat_member));
            // bcContext.Message.sender = bcContext.Message.fillUser(this.normalizeUser(message.left_chat_member));
        }

        if (message.hasOwnProperty('new_chat_title')) {
            bcContext.Message.event = EVENTS.CHAT_TITLE_NEW;
            // @TODO Add processing of title
        }

        if (message.hasOwnProperty('new_chat_photo')) {
            bcContext.Message.event = EVENTS.CHAT_PHOTO_NEW;
            // @TODO Add processing of photo
        }

        if (message.hasOwnProperty('delete_chat_photo')) {
            bcContext.Message.event = EVENTS.CHAT_PHOTO_REMOVE;
        }

        if (message.hasOwnProperty('pinned_message')) {
            bcContext.Message.event = EVENTS.CHAT_MESSAGE_PIN;
            // @TODO Add processing of pinned message
        }

        // console.log(bcContext.Message);

        for (let type in this.config.attachmentTypesEqual) {
            if (Object.prototype.hasOwnProperty.call(this.config.attachmentTypesEqual, type)) {
                let tgType = this.config.attachmentTypesEqual[type]
                if (tgType in message) {
                    let file
                    if (type === this.BC.ATTACHMENTS.PHOTO) {
                        file = this.getMaxPhoto(message[tgType]);
                    } else {
                        file = message[tgType]
                    }
                    let link = await this.Telegram.getFileLink(file.file_id).catch(() => '')
                    if (link !== '') {
                        let attachment = {
                            type,
                            link
                        }
                        for (let field in this.config.attachmentFieldsEqual) {
                            if (Object.prototype.hasOwnProperty.call(this.config.attachmentFieldsEqual, field)) {
                                let tgField = this.config.attachmentFieldsEqual[field]
                                if (tgField in file) {
                                    attachment[field] = file[tgField]
                                }
                            }
                        }
                        bcContext.Message.handleAttachment(attachment)
                    }
                }
            }
        }
        return bcContext.process()
    }

    listen () {
        this.transport.on('message', (ctx) => {return this.messageCallback(this, ctx)});
        this.transport.on('edited_message', (ctx) => {return this.messageCallback(this, ctx)});
        this.transport.on('channel_post', (ctx) => {return this.messageCallback(this, ctx)});
        this.transport.on('edited_channel_post', (ctx) => {return this.messageCallback(this, ctx)});
        this.transport.on('callback_query', (ctx) => {return this.messageCallback(this, ctx)});
        // this.transport.on('inline_query', (ctx) => {return this.messageCallback(this, ctx)});
        // this.transport.on('shipping_query', (ctx) => {return this.messageCallback(this, ctx)});
        // this.transport.on('pre_checkout_query', (ctx) => {return this.messageCallback(this, ctx)});
        // this.transport.on('chosen_inline_result', (ctx) => {return this.messageCallback(this, ctx)});
    }

    kbBuild (keyboard) {
        let inline = keyboard.options.indexOf('inline') !== -1
        let inButtons = this.BC.MT.makeArray(keyboard.buttons)
        let buttons = []
        for (let inRow of inButtons) {
            let row = []
            inRow = this.BC.MT.makeArray(inRow)
            for (let inBtn of inRow) {
                if (typeof inBtn === 'string') {
                    inBtn = {text: inBtn}
                }
                try {
                    let button
                    if (inline) {
                        if (inBtn.url !== undefined) button = Markup.urlButton(inBtn.text || inBtn.url, inBtn.url)
                        else button = Markup.callbackButton(inBtn.text, inBtn.data || inBtn.text)
                    } else {
                        button = inBtn.text
                    }
                    row.push(button)
                } catch (e) {
                    console.error('ERROR IN KB BUILD IN TG DRV', e)
                }
            }
            buttons.push(row)
        }
        let kb = inline ? {reply_markup: Markup.inlineKeyboard(buttons)} : Markup.keyboard(buttons)
        // console.log(kb.removeKeyboard);
        // kb = kb.removeKeyboard();

        for (let option of keyboard.options) {
            // console.log('[TG] BUILD KB. OPTION: ' + option + ', kb[option]: ', kb[option]);
            if (!this.BC.MT.empty(kb[option])) {
                // console.log('[TG] BUILD KB. OPTION FOUND: ' + option);
                kb = kb[option]();
            }
        }
        return kb;

    }

    kbRemove (ctx) {
        // console.log('[TG] KB REMOVE');
        return Markup.removeKeyboard().extra();
    }

    getMaxPhoto (photos) {
        let result = {};
        let size = 0;
        for (const photo of photos) {
            if (photo.file_size > size) {
                result = photo;
            }
        }
        return result;
    }

    getChatType (tgType) {
        let chatType = '';
        switch (tgType) {
            case 'private':
                chatType = 'user';
                break;
            case 'supergroup':
            case 'group':
                chatType = 'chat';
                break;
            case 'channel':
                chatType = 'channel';
                break;
        }
        return chatType;
    }

    reply (ctx, Parcel) {
        return this.send(Parcel);
    }

    async send (Parcel) {
        console.log('TG SEND MESSAGE. IN DATA ', Parcel);
        let messageIds = [];
        let afterSend = message => {
            this.messageCallback(this, {update: {message: message}});
            return this.config.returnSentMsg ? message : message.message_id;
        };
        for (let type in Parcel.attachments) {
            if (Parcel.attachments.hasOwnProperty(type)) {
                if (Array.isArray(Parcel.attachments[type]))
                    for (let attachment of Parcel.attachments[type]) {
                        let file
                        if (typeof attachment === 'object') {
                            file = 'id' in attachment ? attachment.id : attachment
                        } else {
                            file = {source: attachment}
                        }
                        // let file = this.BC.MT.isString(attachment) ? {source: attachment.file} : attachment;
                        // delete attachment.file;
                        let params = [Parcel.peerId];
                        let method = '';
                        let action = '';
                        if (type === this.BC.ATTACHMENTS.AUDIO) {
                            method = 'sendAudio';
                            action = 'upload_audio';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.PHOTO) {
                            method = 'sendPhoto';
                            action = 'upload_photo';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.FILE) {
                            method = 'sendDocument';
                            action = 'upload_document';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.POLL) {
                            method = 'sendPoll';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.STICKER) {
                            method = 'sendSticker';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.VIDEO) {
                            method = 'sendVideo';
                            action = 'upload_video';
                            params.push(file);
                        }
                        let extra = this.BC.MT.merge(Parcel.keyboard, this.extraBuild(attachment));
                        if (!this.BC.MT.empty(extra)) {
                            params.push(extra);
                        }
                        //  LINK, POST, FORWARD
                        // console.log('ATTACHMENT SEND. METHOD: ', method, ' PARAMS ', params);

                        if (method !== '') {
                            if (action !== '') {
                                this.Telegram.sendChatAction(Parcel.peerId, action).catch(() => {});
                            }
                            messageIds.push(await this.Telegram[method](...params).then(afterSend));
                        }
                }
            }
        }
        if (Parcel.fwChatId) {
            for (let fwId of Parcel.fwMsgIds) {
                let id = await this.Telegram.forwardMessage(Parcel.peerId, Parcel.fwChatId, fwId)
                    .then(afterSend)
                    .catch((e) => console.error(e));
                if (id) {
                    messageIds.push(id);
                }
            }
        }
        if (Parcel.message !== '') {
            let message = Parcel.message;
            let extra = {};
            if (typeof Parcel.message === 'object') {
                message = this.escapeText(Parcel.message.text, Parcel.message.markup);
                extra = this.extraBuild(Parcel.message);
            }
            extra = this.BC.MT.mergeRecursive(Parcel.keyboard, extra);
            if (Parcel.replyMsgId) {
                extra.reply_to_message_id = Parcel.replyMsgId;
            }
            if (Parcel.peerId === undefined) {
                try {
                    throw new Error('PEER ID IS UNDEFINED')
                } catch (e) {
                    console.error(e, e.stack)
                }
            }
            let params = Parcel.editMsgId ? [Parcel.peerId, Parcel.editMsgId, Parcel.editMsgId, message, extra] : [Parcel.peerId, message, extra]
            let method = Parcel.editMsgId ? 'editMessageText' : 'sendMessage'
            let id = await this.Telegram[method](...params)
                .then(afterSend)
                .catch((e) => this.sendErrorHandler(e));
            if (!this.BC.MT.empty(id)) {
                messageIds.push(id);
            }
        }
        return messageIds;
    }

    sendErrorHandler (e, ctx) {
        console.error('ERROR WHILE SENDING MESSAGE IN TG DRIVER. NAME:', e.name, 'MESSAGE', e.message)
        console.error('ERROR WHILE SENDING MESSAGE IN TG DRIVER. STACK:', e.stack)
        console.error('ERROR WHILE SENDING MESSAGE IN TG DRIVER. e.description:', e.description)
        for (let k in e) {
            console.error('ERROR WHILE SENDING MESSAGE IN TG DRIVER. FOR. KEY', k, ':', e[k])
        }
        return {}
    }

    remove (peerId, ids) {
        let promises = []
        ids = this.BC.MT.makeArray(ids)
        for (let id of ids) {
            if (typeof id === 'object') {
                id = id.message_id
            }
            promises.push((() => this.Telegram.deleteMessage(peerId, id))())
        }
        return Promise.all(promises).catch((e) => console.error('ERROR WHILE DELETE MESSAGES IN TG:', e))
    }

    /**
     * @param {import('../context.js').answerCallbackData} data
     */
    answerCB (data) {
        data.alert = data.alert || false
        let extra = {
            url: data.url || '',
            cache_time: data.cacheTime || 0
        }
        return this.Telegram.answerCbQuery(data.id, typeof data.answer === 'string' ? data.answer : '', data.alert, extra)
    }

    extraBuild (params, markup = '') {
        let extra = {};
        if ('markup' in params) {
            markup = params.markup
        }
        for (let key in this.defaults.extraParams) {
            if (this.defaults.extraParams.hasOwnProperty(key) && params.hasOwnProperty(key) /*&& key !== 'markup'*/) {
                let eKey = this.defaults.extraParams[key];
                if (this.BC.MT.isString(eKey)) {
                    extra[eKey] = this.escapeText(params[key], markup);
                } else {
                    let value = this.BC.MT.extract(params[key], eKey.values);
                    if (!this.BC.MT.empty(value)) {
                        extra[ eKey.key ] = this.escapeText(value, markup);
                    }
                }
            }
        }
        // console.log('TG EXTRA BUILD: ', extra);
        return extra;
    }

    escapeText (text, markup = '') {
        const symbols = this.defaults[markup + 'EscapeSymbolsReplace'] || {}
        let re = new RegExp('[' + Object.values(symbols).join('') + ']', 'g');
        // console.log('RE ', re, ' TEXT: ', text);
        return String(text).replace(re, (s) => {
            // console.log('ESCAPE TEXT. S: ', s, ' REPLACE: ', this.defaults.EscapeSymbolsReplace[s]);
            return symbols[s];
        });
    }

    async fetchUserInfo (userId, bcContext) {
        await this.waitUser()
        let result = {};
        if (userId === this.BC.SELF_SEND || userId === 0 || userId === undefined) {
            result = {
                id: this.tgUser.id,
                username: this.tgUser.username,
                first_name: this.tgUser.first_name,
                last_name: this.tgUser.last_name,
            }
        } else {
            // console.log(typeof this);
            // console.log(typeof this.Telegram);
            let chatId = bcContext.Message.chat.id;
            // console.log("USER ID: %s, CHAT ID: %s", userId, chatId);
            if (this.BC.MT.empty(chatId)) {
                chatId = userId;
            }
            let userInfo = await this.Telegram.getChatMember(chatId, userId).catch(this.sendErrorHandler);
            // console.log(userInfo);
            if (!this.BC.MT.empty(userInfo)) {
                result = {
                    id: userInfo.user.id,
                    username: userInfo.user.username,
                    first_name: userInfo.user.first_name,
                    last_name: userInfo.user.last_name,
                    fullName: [(userInfo.user.first_name || '').trim(), (userInfo.user.last_name || '').trim()].join(' ').replace('  ', ' '),
                    type: userInfo.user.is_bot ? 'bot' : 'user',
                    memberState: userInfo.status
                }
            }
        }
        return result;
    }

    async fetchChatInfo (chatId) {
        let result = {};
        // console.log(typeof this);
        // console.log(typeof this.Telegram);
        // console.log("CHAT ID: %s", chatId);
        let chatInfo = await this.Telegram.getChat(chatId);
        // console.log(chatInfo);
        if (!this.BC.MT.empty(chatInfo)) {
            result = {
                id: this.BC.MT.extract('id', chatInfo, null),
                username: this.BC.MT.extract('username', chatInfo, null),
                title: this.BC.MT.extract('title', chatInfo, null),
                first_name: this.BC.MT.extract('first_name', chatInfo, null),
                last_name: this.BC.MT.extract('last_name', chatInfo, null),
                full_name: this.BC.MT.extract('first_name', chatInfo, null) + ' ' + this.BC.MT.extract('first_name', chatInfo, null),
                description: this.BC.MT.extract('description', chatInfo, null),
                type: this.getChatType(this.BC.MT.extract('type', chatInfo, null)),
            }
        }
        return result;
    }

    async launch (middleware, ...middlewares) {
        let result = this.transport.launch(middleware, ...middlewares).then(() => {
            console.log('TG', this.name, 'started');
            this.Telegram.getMe().then(user => {this.tgUser = user; console.log(user)});
        });

        return result;
    }

    normalizeUser (values) {
        // console.log('NORMALIZE USER. IN: ', values);
        return {
            id: values.id,
            isBot: values.is_bot,
            username: values.username,
            firstName: values.first_name,
            lastName: values.last_name,
        }
    }

}

module.exports = Object.assign(Telegram, {Telegraf});
module.exports.default = Object.assign(Telegram, {Telegraf});