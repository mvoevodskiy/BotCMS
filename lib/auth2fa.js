/** Class for 2-factor authentication
 * @class
 *
 * @property {import('./botcms.js)} BC
 * @property {BC.Tools} T
 * @property {BC.MVTools} MT
 */

class Auth2FA {

    /**
     * @constructor
     * @param {Object<import('./botcms.js')>} BC
     */
    constructor (BC) {
        this.BC = BC;
        this.T = BC.T;
        this.MT = BC.MT;

        this.config = this.MT.mergeRecursive({
            handlers: []
        }, this.BC.config.Auth2FA)

        this.requestCode = async (bridge, params) => {
            const promises = []
            for (let handler of this.config.handlers) {
                // console.log(handler)
                let waiter = typeof handler === 'function' ? handler : handler.handle2fa
                promises.push(waiter(bridge, params).catch(error => {
                    console.error('ERROR CALL 2FA HANDLER:', error)
                    return null
                }))
            }
            return Promise.all(promises)
        }
    }
}

module.exports = Auth2FA;
module.exports.defaults = Auth2FA;