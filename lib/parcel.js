const mt = require('mvtools')
const types = require('./types')

/** Parcel from bot to user
 * @class
 *
 * @property {Object<string, []>} keyboard
 * @property {string} message
 * @property {string|int} peerId
 * @property {Object<string, Object<string, string>|string>} attachments
 * @property {string|int} replyMsgId
 * @property {string|int} fwdMsgId
 * @property {string[]|int[]} fwdMsgIds
 */

class Parcel {
    constructor (content) {

        this.ctx = null
        this.keyboard = {
            buttons: [],
            options: [],
        };
        this.message = '';
        this.peerId = '';
        this.attachments = {};
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

    async handleAttachments (attachments, defType = types.ATTACHMENTS.FILE) {
        console.log('PARCEL HANDLE ATTACHMENTS. ATTACHMENTS: ', attachments, 'DEF TYPE:', defType)
        const fromMethod = await mt.call(attachments, this.ctx)
        if (fromMethod) attachments = mt.makeArray(fromMethod)
        console.log('ATTACHMENTS:', attachments)
        for (let attachment of attachments) {
            if (typeof attachment === 'string') attachment = { file: attachment }
            const type = attachment.type || defType
            this.attachments[type] = this.attachments[type] || []
            this.attachments[type].push(attachment)
        }
    }

}

module.exports = Parcel;
module.exports.default = Parcel;
