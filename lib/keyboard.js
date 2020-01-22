class Keyboard {
    constructor (ctx, kbObject) {
        this.ctx = ctx;
        this._options = ['simple', 'resize', 'extra'];
        this._buttons = [];
        if (kbObject) {
            this.fromKBObject(kbObject);
        }
    }

    get options () {
        return this._options;
    }

    set options (options) {
        this._options = options;
    }

    addBtnRow (captions) {
        if (!Array.isArray(captions)) {
            captions = [ captions ];
        }
        let translated = [];
        for (let caption of captions) {
            translated.push(this.ctx.lexicon(caption));
        }
        this._buttons.push(translated);
        return this;
    }

    addBtn (caption) {
        return this.addBtnRow([caption]);
    }

    addBtnMain () {
        return this.addBtnRow('common.btn.menu.main');
    }

    addBtnBack () {
        return this.addBtnRow('common.btn.menu.back');
    }

    addBtnDel () {
        return this.addBtnRow('common.btn.actions.remove');
    }

    addBtnFromArray (kbArray = []) {
        for (let row of kbArray) {
            this.addBtnRow(row);
        }
    }

    fromKBObject (kbObject) {
        kbObject = kbObject || {};
        if (Array.isArray(kbObject.buttons)) {
            this.addBtnFromArray(kbObject.buttons);
        }
        if (Array.isArray(kbObject.options)) {
            this._options = kbObject.options;
        }
    }

    build () {
        return this._buttons === [] ? ctx.Bridge.kbRemove() : this.ctx.Bridge.kbBuild({
            buttons: this._buttons,
            options: this._options,
        });
    }

    get buttons () {
        return this._buttons;
    }

    set buttons (buttons) {
        this._buttons = buttons;
    }
}

module.exports = Keyboard;