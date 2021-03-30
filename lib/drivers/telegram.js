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

        this.ERRORS = {
            NOT_MODIFIED: 'Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message',
            CHAT_CHANGED_ID: 'Bad Request: group chat was upgraded to a supergroup chat',
            CHAT_CHANGED_ID_2: 'Bad Request: group chat was migrated to a supergroup chat',
            CHAT_DEACTIVATED: 'Bad Request: group chat was deactivated',
            CHAT_NOT_FOUND: 'Bad Request: chat not found',
            USER_NOT_FOUND: 'Bad Request: user not found',
            PEER_ID_INVALID: 'Bad Request: PEER_ID_INVALID',
            USER_BLOCKED: 'Forbidden: user is deactivated',
            BOT_KICKED_FROM_CHAT: 'Forbidden: bot was kicked from the group chat',
            BOT_KICKED_FROM_CHAT_2: 'Forbidden: bot was kicked from the supergroup chat',
            BOT_KICKED_FROM_CHAT_3: 'Forbidden: bot was kicked from the channel chat',
            BOT_NOT_IN_CHAT: 'Forbidden: bot is not a member of the group chat',
            BOT_BLOCKED_BY_USER: 'Forbidden: bot was blocked by the user',
            BOT_CAN_NOT_WRITE_FIRST: 'Forbidden: bot can\'t initiate conversation with a user',
            MESSAGE_ID_IS_NOT_SPECIFIED: 'Bad Request: message identifier is not specified',
            MESSAGE_TO_DELETE_NOT_FOUND: 'Bad Request: message to delete not found',
            MESSAGE_CAN_NOT_BE_EDITED: 'Bad Request: message can\'t be edited',
            QUERY_IS_TOO_OLD: 'Bad Request: query is too old and response timeout expired or query ID is invalid',
            TOO_MANY_REQUESTS: 'Too Many Requests: retry after '
        }

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

        this.errorHandler = async (error, parcel = {}) => {
            let message = {}
            const peerId = parcel.peerId
            switch (error.response.description) {
                case this.ERRORS.CHAT_NOT_FOUND:
                    message = { event: this.BC.EVENTS.USER_NOT_FOUND, from: { id: peerId }, chat: { id: peerId } }
                    console.error('TG DRIVER. CHAT', peerId, 'NOT FOUND')
                    break

                case this.ERRORS.USER_NOT_FOUND:
                    message = { event: this.BC.EVENTS.CHAT_NOT_FOUND, chat: { id: peerId } }
                    console.error('TG DRIVER. USER', peerId, 'NOT FOUND')
                    break

                case this.ERRORS.USER_BLOCKED:
                    message = { event: this.BC.EVENTS.USER_BLOCKED, from: { id: peerId }, chat: { id: peerId } }
                    console.error('[TG DRIVER] USER', peerId, 'IS DEACTIVATED. DO NOTHING')
                    break

                case this.ERRORS.BOT_BLOCKED_BY_USER:
                    message = { event: this.BC.EVENTS.BOT_BLOCKED_BY_USER, from: { id: peerId }, chat: { id: peerId } }
                    break

                case this.ERRORS.BOT_KICKED_FROM_CHAT:
                case this.ERRORS.BOT_KICKED_FROM_CHAT_2:
                case this.ERRORS.BOT_KICKED_FROM_CHAT_3:
                    message = { event: this.BC.EVENTS.BOT_KICKED_FROM_CHAT, chat: { id: peerId } }
                    break

                case this.ERRORS.CHAT_CHANGED_ID:
                case this.ERRORS.CHAT_CHANGED_ID_2:
                    message = {
                        event: this.BC.EVENTS.CHAT_CHANGED_ID,
                        chat: { id: peerId },
                        migrated_to_chat_id: error.response.parameters.migrate_to_chat_id
                    }
                    break

                case this.ERRORS.NOT_MODIFIED:
                    console.debug('[TG DRIVER]. MESSAGE', parcel.editMsgId, 'IN CHAT', peerId, 'NOT MODIFIED')
                    break

                case this.ERRORS.MESSAGE_TO_DELETE_NOT_FOUND:
                    console.debug('[TG DRIVER]. MESSAGE TO DELETE NOT FOUND. SENT DATA', error.on)
                    break

                case this.ERRORS.BOT_CAN_NOT_WRITE_FIRST:
                    console.error('[TG DRIVER]. CONVERSATION WITH PEER', peerId, 'ABSENT. BOT CAN NOT WRITE FIRST')
                    message = { event: this.BC.EVENTS.CHAT_NOT_FOUND, chat: { id: peerId } }
                    break

                case this.ERRORS.BOT_NOT_IN_CHAT:
                    console.error('[TG DRIVER]. BOT IS NOT MEMBER OF GROUP CHAT', peerId)
                    message = { event: this.BC.EVENTS.BOT_KICKED_FROM_CHAT, chat: { id: peerId } }
                    break

                case this.ERRORS.MESSAGE_ID_IS_NOT_SPECIFIED:
                    console.error('[TG DRIVER]. MESSAGE ID IS NOT SPECIFIED TO METHOD', error.on.method, 'SENT DATA', error.on)
                    break

                case this.ERRORS.PEER_ID_INVALID:
                    console.error('[TG DRIVER]. PEER ID IS INVALID. METHOD', error.on.method, 'SENT DATA', error.on)
                    message = { event: this.BC.EVENTS.CHAT_NOT_FOUND, chat: { id: peerId } }
                    break

                case this.ERRORS.CHAT_DEACTIVATED:
                    console.error('[TG DRIVER]. CHAT', peerId, 'WAS DEACTIVATED')
                    message = { event: this.BC.EVENTS.CHAT_NOT_FOUND, chat: { id: peerId } }
                    break

                case this.ERRORS.MESSAGE_CAN_NOT_BE_EDITED:
                    console.error('[TG DRIVER]. MESSAGE CAN NOT BE EDITED. SENT DATA', error.on)
                    break

                case this.ERRORS.QUERY_IS_TOO_OLD:
                    console.error('[TG DRIVER]. QUERY IS TOO OLD AND RESPONSE TIMEOUT EXPIRED OR QUERY ID IS INVALID')
                    break

                case error.response.description.startsWith(this.ERRORS.TOO_MANY_REQUESTS):
                    console.log('[TG DRIVER]. TOO MANY REQUESTS. RETRY AFTER ',error.on.parameters.retry_after, 'PEER ID', parcel.peerId)
                    setTimeout(() => this.send(parcel), error.on.parameters.retry_after * 1000)
                    break

                default:
                    console.error('ERROR WHILE SENDING MESSAGE IN TG DRIVER. NAME:', error.name, 'MESSAGE', error.message)
                    console.error('ERROR WHILE SENDING MESSAGE IN TG DRIVER. STACK:', error.stack)
                    console.error('ERROR WHILE SENDING MESSAGE IN TG DRIVER. error.description:', error.description)
                    for (let k in error) {
                        if (Object.prototype.hasOwnProperty.call(error, k)) {
                            console.error('ERROR WHILE SENDING MESSAGE IN TG DRIVER. FOR. KEY', k, ':', error[k])
                        }
                    }

            }
            return Object.keys(message).length ? this.messageCallback(this, { update: { message } }) : {}
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
        console.dir(ctx.update, {depth: 5});
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
            event = message.event || (message.chat.id > 0 ? EVENTS.MESSAGE_NEW : EVENTS.CHAT_MESSAGE_NEW);
            from = message.from || {id: -1};
        } else if ('edited_message' in ctx.update) {
            message = ctx.update.edited_message;
            edited = true;
            event = message.chat.id > 0 ? EVENTS.MESSAGE_EDIT : EVENTS.CHAT_MESSAGE_EDIT
            from = message.from || {id: -1};
        } else if ('channel_post' in ctx.update) {
            message = ctx.update.channel_post;
            event = EVENTS.CHAT_MESSAGE_NEW;
            from = {id: -1};
        } else if ('edited_channel_post' in ctx.update) {
            message = ctx.update.edited_channel_post;
            edited = true;
            event = message.chat.id > 0 ? EVENTS.MESSAGE_EDIT : EVENTS.CHAT_MESSAGE_EDIT
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

        if ('group_chat_created' in message) event = EVENTS.CHAT_CREATED

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
        bcContext.Message.text = this.BC.T.removeUsernameFromCommand(message.text || '', '@' + this.user.username);
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

        if (Object.prototype.hasOwnProperty.call(message, 'migrate_to_chat_id')) {
            bcContext.Message.event = EVENTS.CHAT_CHANGED_ID
            bcContext.Message.changeId = {new: message.migrate_to_chat_id}
        }
        if (Object.prototype.hasOwnProperty.call(message, 'migrate_from_chat_id')) {
            bcContext.Message.event = EVENTS.CHAT_CHANGED_ID
            bcContext.Message.changeId = {old: message.migrate_from_chat_id}
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
                .catch((e) => this.errorHandler(e, Parcel));
            if (!this.BC.MT.empty(id)) {
                messageIds.push(id);
            }
        }
        return messageIds;
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
        return Promise.all(promises).catch((e) => this.errorHandler(e))
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
            let userInfo = await this.Telegram.getChatMember(chatId, userId).catch(this.errorHandler);
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
            const id = this.BC.MT.extract('id', chatInfo, null)
            result = {
                id,
                username: this.BC.MT.extract('username', chatInfo, null),
                title: this.BC.MT.extract('title', chatInfo, null),
                first_name: this.BC.MT.extract('first_name', chatInfo, null),
                last_name: this.BC.MT.extract('last_name', chatInfo, null),
                full_name: this.BC.MT.extract('first_name', chatInfo, null) + ' ' + this.BC.MT.extract('first_name', chatInfo, null),
                description: this.BC.MT.extract('description', chatInfo, null),
                type: this.getChatType(this.BC.MT.extract('type', chatInfo, null)),
                state: id !== null ? 'active' : 'notFound'
            }
        }
        return result;
    }

    async launch (middleware, ...middlewares) {
        let result = this.transport.launch(middleware, ...middlewares).then(() => {
            console.log('TG', this.name, 'started');
            this.Telegram.getMe().then(user => {this.tgUser = user; console.log(user)});
        }).catch(reason => console.error('ERROR WHILE TG LAUNCH:', reason));

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