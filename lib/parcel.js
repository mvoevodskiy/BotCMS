/** Class for parcel from bot to user
 * @class
 *
 * @property {Object} _scripts
 *
 * @property {BotCMS} BC
 * @property {Tools} T
 */

class Parcel {
    constructor (content) {

        this.keyboard = {
            buttons: [],
            options: [],
        };
        this.message = '';
        this.peerId = '';
        this.attachments = {

        };
        this.replyMsgId = 0;
        this.fwMsgIds = [];
        this.fwChatId = 0;
        this.editMsgId = 0

        switch (typeof content) {
            case 'string' :
                this.message = content;
                break;

            case 'object':
                for (let key in content) {
                    if (content.hasOwnProperty(key)) {
                        this[key] = content[key];
                    }
                }
                break;
        }

    }


}

module.exports = Parcel;
module.exports.default = Parcel;