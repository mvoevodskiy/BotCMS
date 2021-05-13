/**
 * @typedef {Object} loggerData
 * @property {string} bridge
 * @property {boolean} outbound
 * @property {string} [driver]
 * @property {string} [fromMethod]
 * @property {string} [method]
 * @property {string} [event]
 * @property {string} [path]
 * @property {string|int} [sid]
 * @property {Object<string, *>} [additional]
 * @property {*} [result]
 * @property {Object<import('./parcel.js')>|Object<string,*>} [methodParams]
 * @property {Object<import('./context.js')>|undefined} [ctx]
 */

/**
 * @typedef {Object} logUser
 * @property {int|string} id
 * @property {string} [username]
 * @property {string} [fullname]
 */

/**
 * @typedef {Object} logChat
 * @property {int|string} id
 * @property {string} [username]
 * @property {string} [title]
 * @property {string} [type]
 */

/**
 * @typedef {Object} normLogData
 * @property {string} bridge
 * @property {string} event
 * @property {string} path
 * @property {string} fromMethod
 * @property {string} method
 * @property {boolean} methodResult
 * @property {boolean} [outbound]
 * @property {logUser} user
 * @property {logChat} chat
 * @property {Object<string,*>} additional
 */

/**
 * @class
 * @property {import('./botcms.js')} BC
 * @property {import('./botcms.js').MVTools} MT
 * @property {Object<string, *>} config
 * @property {Object<loggerData>} emptyDTO
 */

class Logger {
  BC
  MT
  config
  emptyDTO

  constructor (BC) {
    this.defaults = {
      handlers: [],
      errorHandlers: []
    }

    this.BC = BC
    this.MT = this.BC.MT

    this.emptyDTO = {
      bridge: '',
      outbound: true,
      method: '',
      event: '',
      result: undefined,
      params: {},
      ctx: null
    }

    this.emptyNormLogData = {
      bridge: '',
      outbound: true,
      fromMethod: '',
      method: '',
      methodResult: null,
      event: '',
      path: '',
      params: {},
      ctx: null,
      user: {
        id: 0,
        username: '',
        fullname: ''
      },
      chat: {
        id: 0,
        username: '',
        title: '',
        type: 'user'
      },
      additional: {}
    }

    this.config = this.BC.MT.merge(this.defaults, this.BC.config.Logger || {})
    // console.log('BOTCMS LOGGER CONSTRUCTED. CONFIG', this.config)
  }

  /**
   * @method Handler for logger dto
   * @param {loggerData} dto
   */
  async handle (dto) {
    // console.log('BOTCMS LOGGER HANDLER')
    if (!this.config.handlers.length) return
    dto = this.normalizeDTO(dto)
    /** @type {normLogData} */
    const normStatData = this.MT.mergeRecursive(this.emptyNormLogData, {
      bridge: typeof dto.bridge === 'object' ? dto.bridge.name : dto.bridge,
      driver: typeof dto.bridge === 'object' ? dto.bridge.driverName : dto.driver,
      outbound: 'outbound' in dto ? dto.outbound : true,
      fromMethod: dto.fromMethod || '',
      method: dto.method,
      methodResult: dto.result !== false,
      event: dto.event || (dto.ctx ? dto.ctx.Message.event : dto.method),
      path: dto.path || (this.MT.extract('ctx.session.step.path', dto, '')),
      user: this.MT.extract('ctx.Message.sender', dto, { id: this.MT.extract('methodParams.0.peerId', dto, 0) }),
      chat: this.MT.extract('ctx.Message.chat', dto, { id: this.MT.extract('methodParams.0.peerId', dto, 0) }),
      language: dto.ctx ? dto.ctx.language : this.BC.config.language,
      sid: dto.sid || (dto.ctx ? dto.ctx.getUid() : this.getSid()),
      requestStartTime: dto.ctx ? dto.ctx.getStartTime() : Date.now(),
      additional: dto.additional || {}
    })
    // console.log('BOTCMS LOGGER. NORMALIZED LOG DATA:', normStatData)
    const promises = []
    for (let extHandler of this.config.handlers) {
      promises.push((() => extHandler.handle(normStatData))())
    }
    Promise.all(promises).catch(error => console.error('ERROR IN LOGGER HANDLERS:', error))
  }

  normalizeDTO (partedDTO = {}) {
    return this.MT.merge(this.emptyDTO, partedDTO)
  }

  getSid () {
    return Date.now()
  }
}

/** @type {Object<loggerData>} */
Logger.DTO = {}
module.exports = Logger
