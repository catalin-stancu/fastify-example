import { httpErrors } from './utils.js';

/**
 * Parse multi-part form data payload from request
 *
 * @param {object} req - fastify request object
 * @param {object} options - object with rules for multipart form data content
 * @param {object} options.maxFileBytes - maximum file size allowed
 * @param {object} options.maxFiles - maximum uploaded files in the form data payload
 * @param {object} options.maxFields - maximum number of non-file fields allowed in form data
 * @param {object} options.[params] - any other params, will be made available to the function
 *   below (via the fieldData.options object which will be passed as is to it)
 * @param {function} processFileStreamAsync - async function which will be called
 *   for every file stream corresponding to a file upload in the multipart form
 *   data payload with the signature: (fieldData) => void, where fieldData is an
 *   object with the following properties:
 *    - value
 *    - fieldName
 *    - fileName
 *    - fileStream
 *    - mimeType
 *    - options
 * @returns {Map} parsed multipart form data payload
 */
export async function parseFormDataAsync(
  req, options, processFileStreamAsync
) {
  // Use a Map because it preserves insertion order
  const formDataFieldsMap = new Map();
  const errClass = 5;

  if (!req.isMultipart()) {
    return null;
  }

  // Set up control limits for fields in form data
  const { maxFileBytes, maxFiles, maxFields } = options;
  const formFieldsIterator = req.parts({
    limits: {
      // For multipart forms, the max file size
      fileSize: maxFileBytes,
      // Max number of file fields
      files: maxFiles,
      // Max number of non-file fields
      fields: maxFields
    }
  });

  try {
    // Iterate over all form fields including file uploads and preprocess them
    for await (const formField of formFieldsIterator) {
      const { fieldname: fieldName, file: fileStream, value } = formField;
      const { filename: fileName, mimetype: mimeType } = formField;

      let processedValue = value;
      if (fileStream) {
        processedValue = await processFileStreamAsync({
          value: 'multipart file stream',
          fieldName,
          fileName,
          fileStream,
          mimeType,
          options
        });
      }

      if (fieldName.endsWith('[]')) {
        if (Array.isArray(formDataFieldsMap.get(fieldName))) {
          formDataFieldsMap.get(fieldName).push(processedValue);
        } else {
          formDataFieldsMap.set(fieldName, [processedValue]);
        }
      } else {
        formDataFieldsMap.set(fieldName, processedValue);
      }
    }
  } catch (err) {
    const { part, statusCode, code } = err;
    const { filename: fileName } = part || {};

    switch (code) {
      case 'FST_FILES_LIMIT': {
        httpErrors.throwBadRequest(
          'The limit of [{{maxFiles}}] files was exceeded in the form payload',
          { statusCode, params: { maxFiles }, errClass }
        );
        break;
      }
      case 'FST_FIELDS_LIMIT': {
        httpErrors.throwBadRequest(
          'The limit of [{{maxFields}}] non-file fields was exceeded'
          + ' in the form data payload',
          { statusCode, params: { maxFields }, errClass }
        );
        break;
      }
      case 'FST_REQ_FILE_TOO_LARGE': {
        httpErrors.throwBadRequest(
          'File upload failed for [{{fileName}}] because file size exceeds '
          + 'maximum limit of [{{maxFileBytes}}] bytes',
          { statusCode, params: { fileName, maxFileBytes }, errClass }
        );
        break;
      }
      case 'FST_PROTO_VIOLATION': {
        httpErrors.throwBadRequest(
          'Invalid field name [{{fieldName}}] in form data payload',
          { statusCode, params: { fieldName: '__proto__' }, errClass }
        );
        break;
      }
      default: {
        httpErrors.throwBadRequest(
          'Bad multipart payload data',
          { statusCode, errClass }
        );
      }
    }
  }

  return formDataFieldsMap;
}