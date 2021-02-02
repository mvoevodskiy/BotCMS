const StorageManager = require('./storagemanager')


class SessionManager extends StorageManager {
    constructor(BC, config = {}) {
        let defaults = {
            adapter: 'file',
            storage: 'sessions.json',
            getStorageKey: (context => (String(context.Bridge.name) + ':' + String(context.Message.chat.id) + ':' + String(context.Message.sender.id))),
            targetKey: 'session',
            storageHandler: {
                set: (key, value) => this.storeSet(key, value),
                get: (key) => this.storeGet(key),
                delete: (key) => this.storeSet(key, {}),
            },
        }
        super(BC, defaults, config)
        this.targetKey = this.config.targetKey
        this.getStorageKey = this.config.getStorageKey
        this.storageHandler = this.config.storageHandler

        this.middleware = (target) => {
            const {storageHandler, targetKey, getStorageKey} = this;
            return next => async () => {
                // console.log(context);
                const storageKey = getStorageKey(target);
                // console.log(storageKey);
                if (storageKey === '') {
                    return next()
                }
                let changed = false;
                const wrapSession = (targetRaw) => (
                    // eslint-disable-next-line no-use-before-define
                    new Proxy({ ...targetRaw, $forceUpdate }, {
                        set: (target, prop, value) => {
                            // console.log('SESSION SET. KEY', prop, 'VALUE', value)
                            changed = true;
                            target[prop] = value;
                            return true;
                        },
                        deleteProperty (target, prop) {
                            changed = true;
                            delete target[prop];
                            return true;
                        }
                    }))
                const $forceUpdate = () => {
                    // eslint-disable-next-line no-use-before-define
                    if (Object.keys(session).length > 1) {
                        changed = false;
                        // eslint-disable-next-line no-use-before-define
                        return storageHandler.set(storageKey, session);
                    }
                    return storageHandler.delete(storageKey);
                };
                const initialSession = await storageHandler.get(storageKey) || {};
                let session = wrapSession(initialSession);
                Object.defineProperty(target, targetKey, {
                    get: () => session,
                    set: (newSession) => {
                        // console.log('BOTCMS SESSION MANAGER. NEW SESSION: ', newSession);
                        session = wrapSession(newSession);
                        changed = true;
                    }
                });
                await next().catch((err) => console.error('ERROR WHILE PROCESSING CONTEXT', err))
                if (!changed) {
                    return;
                }
                await $forceUpdate();
            };
        }
    }
}

module.exports = SessionManager;