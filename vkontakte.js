// import VK from 'vk-io';
const { VK, Keyboard } = require('vk-io');
const { SessionManager } = require('@vk-io/session');
const BotCMSContext = require('./botcmscontext');

class VKontakte {
    constructor (BC, params = {}) {
        this.BW = BC;
        this.name = 'vk';
        this.sessionManager = new SessionManager();
        this.transport = new VK(params);

        this.transport.updates.on('message', this.sessionManager.middleware);
    }

    isAvailable () {
        return typeof this.transport === 'object';
    }

    loadSchema (schema) {
        this.schema = schema;
    }

    defaultCallback (t, ctx) {
        if (ctx.payload.out === 1) {
            return;
        }
        console.log(ctx);
        // for (let key in ctx) {
        //     // if (key.startsWith('is')) {
        //         console.log('DEFAULT CB. VK. ' + key + ' : ' + ctx[key]);
        //     // }
        // }
        const params = {
            context: ctx,
            bridge: t,
            bw: t.BC,
            message: {
                type: ctx.type === 'message' ? 'text' : ctx.type,
                text: ctx.text,
                message_id: ctx.id,
                from: {
                    id: ctx.senderId
                },
                chat: {
                    id: ctx.peerId
                }
            },
            match: () => {},
            reply: (ctx, sendObject) => this.reply(ctx, sendObject),
            session: ctx.session,
        };

        let BWContext = new BotCMSContext(params);
        return t.BC.handleUpdate(BWContext);
    }

    listen () {
        this.transport.updates.on('message', (ctx) => {return this.defaultCallback(this, ctx)});
    }

    kbBuild (keyboard, recursive = false) {
        // console.log(keyboard.buttons);
        let kb = [];
        if (keyboard.options.indexOf('simple') > -1) {
            for (let key in keyboard.buttons) {
                if (!keyboard.buttons.hasOwnProperty(key)) {
                    continue;
                }
                if (Array.isArray(keyboard.buttons[key])) {
                    kb[key] = this.kbBuild({
                        buttons: keyboard.buttons[key],
                        options: keyboard.options
                    }, true);
                } else {
                    kb[key] = Keyboard.textButton({
                        label: keyboard.buttons[key],
                        payload: {
                            command: keyboard.buttons[key]
                        }
                    });
                }
            }
            // let kb = Markup.keyboard(keyboard.buttons);
            //
            // // console.log(kb.removeKeyboard);
            // // kb = kb.removeKeyboard();
            //
            // for (let option of keyboard.options) {
            //     console.log('[TG] BUILD KB. OPTION: ' + option + ', kb[option]: ', kb[option]);
            //     if (!this.BC.T.empty(kb[option])) {
            //         console.log('[TG] BUILD KB. OPTION FOUND: ' + option);
            //         kb = kb[option]();
            //     }
            // }
            // return kb;
        }
        if (!recursive) {
            kb = Keyboard.keyboard(kb);
            if (keyboard.options.indexOf('oneTime') > -1) {
                kb = kb.oneTime(true);
            }
        }
        console.log(kb);
        return kb;
    }

    kbRemove (ctx) {
        console.log('[VK] KB REMOVE');
        return [];
    }

    reply (ctx, sendObject) {
        // for (let key in sendObject) {
        //     if (sendObject.hasOwnProperty(key)) {
        //         if (this.BC.T.empty(sendObject[key])) {
        //             delete sendObject[key];
        //         }
        //     }
        // }
        console.log(sendObject);
        return ctx.send(sendObject);
    }

    start (middleware, ...middlewares) {
        this.transport.updates.hear('/start', middleware, ...middlewares);
    }

    help (middleware, ...middlewares) {
        this.transport.updates.hear('/help', middleware, ...middlewares);
    }

    on (updateType, middleware, ...middlewares) {
        this.transport.on(updateType, middleware, ...middlewares);
    }

    command (command, middleware, ...middlewares) {
        this.hear('/' + command, middleware, ...middlewares);
    }

    hear (trigger, middleware, ...middlewares) {
        // console.log('VK.updates.hear. TRIGGER: ' + trigger);
        this.transport.updates.hear(trigger, middleware, ...middlewares);
    }

    launch(middleware, ...middlewares) {
        // this.transport.updates.start().catch(console.error);
        this.transport.updates.startPolling();
        console.log('VK started');
    }
}


//     vk.updates.hear(/hello/i, context => (
//     context.send('World!')
// ));


module.exports = Object.assign(VKontakte, {VK});
module.exports.default = Object.assign(VKontakte, {VK});