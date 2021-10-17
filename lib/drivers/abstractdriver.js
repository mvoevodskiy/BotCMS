const mt = require('mvtools')

/**
 * BotCMS driver interface
 * @class
 *
 * @property {Object} config
 * @property {string} driverName
 * @property {string} name
 *
 * @property {Object<import('botcms')>} BC
 * @property {Object} Transport
 */

class AbstractDriver {
  constructor (BC, ...configs) {
    if (this.constructor === AbstractDriver) throw new Error('Object of abstract class can not be created')
    this.BC = BC
    this.user = {
      id: 0,
      name: '',
      username: ''
    }
    this.defaultConfig = {
      name: 'drvintf',
      driverName: 'drvintf',
      humanName: 'Driver interface',
      debug: false
    }
    this.config = mt.mergeRecursive(this.defaultConfig, ...configs)
    this.name = this.config.name || this.defaults.name
    this.driverName = this.config.driverName
    this.humanName = this.config.humanName || this.name
    this._transport = null
    /** @deprecated */
    this.transport = null
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. CONSTRUCT]')
  }

  get Transport () {
    return this._transport || this.transport
  }

  set Transport (transport) {
    this._transport = transport
  }

  isAvailable () {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. IS AVAILABLE]')
    return true
  }

  /**
   * @deprecated
   * @param ctx
   */
  async defaultCallback (ctx) {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. DEFAULT CALLBACK]')
    await this.processUpdate(ctx)
  }

  /**
   * @deprecated
   * @param ctx
   */
  async messageCallback (ctx) {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. MESSAGE CALLBACK]')
    await this.processUpdate(ctx)
  }

  /**
   * Process received update
   * @abstract
   * @param {Object} ctx Context from Transport
   * @return {Promise<void>}
   */
  async processUpdate (ctx) {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. PROCESS UPDATE]')
    throw new Error('Abstract Method has no implementation')
  }

  /**
   * Set triggers, events and callbacks
   * @abstract
   */
  listen () {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. LISTEN]')
    throw new Error('Abstract Method has no implementation')
  }

  /**
   * Keyboard builder
   * @param {{ buttons: [], options: [] }} keyboard
   * @return {{}}
   */
  kbBuild (keyboard) {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. KB BUILD]')
    return {}
  }

  /**
   * Keyboard remover. Return empty object
   * @return {{}}
   */
  kbRemove () {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. REPLY] KB REMOVE')
    return {}
  }

  /**
   * Send parcel to same peerId. Allow empty Parcel's peerId property
   * @deprecated
   * @param {Object<this.BC.Context>} ctx
   * @param {Object<this.BC.Parcel>}Parcel
   * @return {Promise<[]>}
   */
  reply (ctx, Parcel) {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. REPLY]')
    return this.send(Parcel)
  }

  /**
   * Send parcel
   * @param {Object<this.BC.Parcel>} Parcel
   * @return {Promise<[]>}
   */
  async send (Parcel) {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. SEND]')
    return []
  }

  /**
   * Remove messages
   * @param {String} peerId
   * @param {String[]} ids
   * @return {*[]}
   */
  remove (peerId, ids) {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. REMOVE]')
    return []
  }

  /**
   * Answer for user's callback
   * @param {import('../context.js').answerCallbackData} data
   */
  answerCB (data) {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. ANSWER CB]')
    return true
  }

  /**
   * Send user's callback
   * @param {Object} data
   */
  sendCB (data) {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. SEND CB]')
    return true
  }

  restrict (userId, peerId, permissions = {}) {
    return true
  }

  promote (userId, peerId, permissions = {}) {
    return true
  }

  /**
   * Fetch user info by userId
   * @param {String} userId
   * @param {Object<this.BC.Context>|String} ctxOrChatId
   * @return {Promise<{id}>}
   */
  async fetchUserInfo (userId, ctxOrChatId) {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. FETCH USER INFO]')
    return { id: userId }
  }

  /**
   * Fetch chat info by chatId
   * @param {String} chatId
   * @param {Object<this.BC.Context>} ctx
   * @return {Promise<{id}>}
   */
  async fetchChatInfo (chatId, ctx) {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. FETCH CHAT INFO]')
    return { id: chatId }
  }

  /**
   * Launch network
   * @abstract
   * @return {Promise<boolean>}
   */
  async launch () {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. LAUNCH]')
    throw new Error('Abstract Method has no implementation')
  }

  /**
   * Stop network
   * @abstract
   * @return {Promise<boolean>}
   */
  async stop () {
    if (this.config.debug) console.log('[DRIVER ' + this.name + '. LAUNCH]')
    throw new Error("Abstract Method has no implementation");
  }
}

module.exports = AbstractDriver