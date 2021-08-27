/**
* This class models the common response format used across all Explorado APIs
* Adapted from the `catalog-api` project
* https://explorado.atlassian.net/wiki/spaces/EXP/pages/122093631/2021-02-01+Meeting+notes+Arhitectura
*/
export default class Response {
  // We set these static properties only with getter to make them read-only
  // This prevents tampering with the response message codes

  /** Info Message Type */
  static get INFO_MESSAGE() { return 0; }

  /** Warning Message Type */
  static get WARNING_MESSAGE() { return 1; }

  /** Error Message Type */
  static get ERROR_MESSAGE() { return 2; }

  /**
  * Set application code (can be done only once)
  *
  * @param {string} code - application code e.g. '002'
  * @returns {void}
  */
  static setAppCode(code) {
    // Once set, don't allow the application code to be changed to
    // prevent tampering with the error codes
    Object.defineProperty(Response, 'appCode', {
      value: code,
      writable: false
    });
  }

  /**
  * Set optional i18n helper
  *
  * @param {object} i18nMap - Object which stores keys with i18n library
  *    instances to use (the values)
  * @returns {void}
  */
  static setI18nHelper(i18nMap) {
    Object.defineProperty(Response, 'i18nMap', {
      value: i18nMap,
      writable: false
    });
  }

  /**
  * Create a new Response according to the standard structure
  *
  * @param {object|Array<object>} data - response payload
  * @param {object} meta - payload meta
  */
  constructor(data, meta = null) {
    this.response = {
      data,
      messages: [],
      meta
    };
  }

  /**
  * Add a message to the response
  *
  * @param {string} content - message in plain language
  * @param {number} type - message type
  * @param {string|null} classCode - error class code, for error messages, if
  *   not provided the default value of 0 will be used. We should not use it
  *   anywhere else because this allows us to know when we forget to set it
  * @param {string|null} errorCode - error internal code, for error messages,
  *   if not provided the default value of 0 will be used. We should not use it
  *   anywhere else because this allows us to know when we forget to set it
  * @param {string|null} field - field that triggered the error in payload
  *   validation, useful to display in frontend forms as red wavy lines
  * @returns {Response} the response instance, useful for fluent chaining
  */
  addMessage(
    content = '',
    type = Response.INFO_MESSAGE,
    classCode = null,
    errorCode = null,
    field = null
  ) {
    if (content.length === 0) {
      return;
    }

    const detail = {
      content
    };

    if (field) {
      detail.field = field;
    }

    const message = {
      type,
      details: [detail]
    };

    if (type !== Response.INFO_MESSAGE) {
      message.code = `${Response.appCode}.${classCode || '000'}.${errorCode || '0'}`;
    }

    this.response.messages.push(message);
    return this;
  }

  /**
  * Add an error message to the response
  *
  * @param {object|Error} error - error object
  * @param {string} locale - locale to use for localizing error message
  * @returns {Response} the response instance, useful for fluent chaining
  */
  addError(error, locale) {
    let errorObj = error;
    if (!(error instanceof Error)) {
      errorObj = new Error('Received input in response.addError() is not an instance of Error');
      Object.assign(errorObj, {
        localeNamespace: 'global',
        internalCode: 1
      });
      throw errorObj;
    }

    const {
      localeNamespace = 'default',
      validation,
      internalCode,
      errClass,
      message,
      validationContext,
      params
    } = errorObj;

    // Format validation errors
    if (validation) {
      let details = '';
      const { dataPath, params: validationParams } = validation[0];
      const [paramName, paramValue] = Object.entries(validationParams)[0];
      if (paramName === 'allowedValues') {
        details = `: ${paramValue}`;
      }

      return this.addMessage(
        `Validation failed: ${message}${details}`,
        Response.ERROR_MESSAGE,
        4,
        internalCode || 902,
        `${validationContext}${dataPath || `.${paramValue}`}`
      );
    }

    let finalMessage = message;

    // If an i18n helper is registered, then use it to localize the error messages
    if (Response.i18nMap?.[localeNamespace]) {
      // eslint-disable-next-line no-underscore-dangle
      finalMessage = Response.i18nMap[localeNamespace].__({
        phrase: message,
        locale: locale || Response.i18nMap[localeNamespace].getLocale()
      }, params);
    }

    return this.addMessage(
      finalMessage,
      Response.ERROR_MESSAGE,
      errClass,
      internalCode
    );
  }

  /**
  * Format the response instance to the standard structure
  *
  * @returns {object} response formatted to standard structure,
  *   ready to be sent as the payload response in a request
  */
  toJSON() {
    if (!this.response?.meta) {
      delete this.response.meta;
    }

    if (!this.response?.messages?.length) {
      delete this.response.messages;
    }

    return this.response;
  }
}