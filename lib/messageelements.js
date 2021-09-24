const mt = require('mvtools')

/**
 * @typedef {Object} MessageElement
 * @property {string} type
 * @property {int} offset
 * @property {int} length
 * @property {string} value
 * @property {string} [id]
 * @property {string} [username]
 * @property {string} [url]
 * @property {string} [language]
 */

/**
 * @class
 * @property {import('./message')} Message
 * @property {MessageElement[]} elements
 * @property {import('./types').MESSAGE_ELEMENTS} TYPES
 */

class MessageElements {
  constructor (Message, entities = []) {
    this.Message = Message
    this.TYPES = this.Message.BC.TYPES.MESSAGE_ELEMENTS

    this.elements = []
  }

  /**
   *
   * @param {MessageElement|MessageElement[]} elements
   * @param {string} text
   */
  add (elements, text = '') {
    /** @type {MessageElement[]} */
    elements = mt.makeArray(elements).map(
      /**
       * @param {MessageElement} element
       */
      element => {
        if (mt.empty(element.value) && text.length) {
          element.value = text.substr(element.offset, element.length)
        }

        if (element.type === this.TYPES.URL && (typeof element.url !== 'string' || !element.url.length) && text.length) element.url = text.substr(element.offset, element.length).trim()
        return element
      }
    )
    this.elements.push(...elements)
  }

  /**
   *
   * @return {MessageElement[]}
   */
  all () {
    return this.elements
  }

  /**
   *
   * @param {string|string[]} types
   * @return {MessageElement[]}
   */
  filter (types = []) {
    types = mt.makeArray(types)
    return this.elements.filter((e) => types.indexOf(e.type) > -1)
  }

  textFormat () {
    return this.filter([this.TYPES.BOLD, this.TYPES.ITALIC, this.TYPES.STRIKE, this.TYPES.UNDERLINE])
  }

  mentionId () {
    return this.filter(this.TYPES.MENTION_ID)
  }

  mentionUsername () {
    return this.filter(this.TYPES.MENTION_USERNAME)
  }

  mention () {
    return this.filter([this.TYPES.MENTION_USERNAME, this.TYPES.MENTION_ID])
  }

  emails() {
    return this.filter(this.TYPES.EMAIL)
  }

  phone () {
    return this.filter(this.TYPES.PHONE)
  }

  bankCard () {
    return this.filter(this.TYPES.BANK_CARD)
  }

  code () {
    return this.filter(this.TYPES.CODE)
  }

  command () {
    return this.filter(this.TYPES.COMMAND)
  }

  hashtag () {
    return this.filter(this.TYPES.HASHTAG)
  }

  url () {
    return this.filter(this.TYPES.URL)
  }

  containsPersonal (id, username = '') {
    const filtered = this.mention().filter(v => v.username === username || v.id === id)
    return filtered.length > 0
  }
}

/** @type {MessageElement} */
MessageElements.MessageElement = {}

module.exports = MessageElements