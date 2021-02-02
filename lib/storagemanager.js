const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');


class StorageManager {
    constructor(BC, ...configs) {
        this.defaults = {
            storage: 'storage.json',
            adapter: 'file',
            serviceKeys: ['__wrapped__', '__actions__', '__chain__', '__index__', '__values__', '$forceUpdate']
        }
        this.BC = BC
        this.config = this.BC.MT.merge(this.defaults, this.BC.config.StorageManager || {}, ...configs)
        if (this.config.adapter === 'file') {
            this.adapter = new FileSync(this.config.storage)
            this.store = low(this.adapter)
        } else {
            this.store = new this.config.store(this, this.config)
        }
        this.serviceKeys = this.config.serviceKeys
    }

    storeGet (key) {
        if (this.config.adapter === 'file') {
            // console.log('BOTCMS STORAGE MANAGER STORE GET. KEY ' + key);
            let value = this.store.get(key) || null;
            // console.log('BOTCMS STORAGE MANAGER STORE GET. KEY', key, 'VALUE', value);
            return value.__wrapped__[key];
        } else return this.store.get(key)
    }

    storeSet (key, value) {
        // console.log('BOTCMS STORAGE MANAGER STORE SET ' + key + ', VALUE ', value);
        if (this.config.adapter === 'file') {
            let primitive = {};
            for (let k in value) {
                if (value.hasOwnProperty(k) && this.serviceKeys.indexOf(k) === -1) {
                    primitive[k] = value[k];
                    // console.log('BOTCMS STORAGE MANAGER STORE SET ' + k + ' VALUE ', value[k]);
                }
            }
            // console.log('BOTCMS STORAGE MANAGER STORE SET ' + key + ' FINAL VALUE ', primitive);
            this.store.set(key, primitive).write()
        } else this.store.set(key, value);
        // console.log('BOTCMS STORAGE MANAGER STORE SET ' + key /*+ ', ALL ', this.store*/);
        return true;
    }
}

module.exports = StorageManager;