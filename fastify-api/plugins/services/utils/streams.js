import sizeOfImage from 'probe-image-size';
import { fastClone } from './functions.js';

/**
 * Creates a Transform stream implemented using an async iterator inside
 * an async generator that performs reducer operations on all
 * data chunks passing through the stream
 *
 * @param {object} measurementsDict - object with measurement functions:
 *  - each key is the name of the measurement (the result will be the same name)
 *  - each value must be an object with two properties:
 *    > + fn: the measurement reducer function to apply to each stream data chunk
 *    > + initial: initial value used when reducing all measurements
 *    > + postProcessFn: optional function that transforms the final reduced result
 * @return {object} object with two properties:
 *  - reduceStreamAsyncIterator - stream to pipe to other stream to be measured
 *  - measurementResults - available only when the stream was finished
 */
export function makeStreamIterator(measurementsDict) {
  // Initialize results
  const measurementResults = {};
  Object.entries(measurementsDict).forEach(([key, val]) => {
    // Make sure to make a new copy of the initial value, otherwise multiple instances
    // will use the same reference to the initial value and may modify its contents, causing bugs
    measurementResults[key] = fastClone(val.initial);
  });

  /**
   * This is a Transform stream implemented using an async iterator inside an
   * async generator that operates as a reducer on data passing into the stream
   *
   * @param {Stream} inputStream - stream to transform
   * @returns {Promise<void>}
   */
  async function* reduceStreamAsyncIterator(inputStream) {
    let index = 1;
    for await (const chunk of inputStream) {
      // Perform reducer operation
      // eslint-disable-next-line no-loop-func
      Object.entries(measurementsDict).forEach(([key, val]) => {
        measurementResults[key] = val.fn(measurementResults[key], chunk, index);
      });

      // Keep track of iteration count
      index += 1;

      // Pass chunk along unchanged
      yield chunk;
    }

    // Apply post-processing functions to final results
    Object.entries(measurementsDict).forEach(([key, val]) => {
      if (typeof val.postProcessingFn === 'function') {
        measurementResults[key] = val.postProcessingFn(measurementResults[key]);
      }
    });
  }

  return {
    reduceStreamAsyncIterator,
    measurementResults
  };
}

/**
 * Convert a buffer or string (will be converted to a buffer internally)
 * into an iterator over its chunks.
 * Inspired from https://github.com/creeperyang/buffer-to-stream
 * This is useful especially when using the stream pipeline function which accepts
 * an iterator as equivalent to a readable stream.
 *
 * This utility is needed when we want to avoid send a huge buffer chunk directly
 * to a stream. That is not recommended, according to NodeJS 14.x docs because:
 * 'While calling write() on a stream that is not draining is allowed, Node.js
 * will buffer all written chunks until maximum memory usage occurs, at which
 * point it will abort unconditionally. Even before it aborts, high memory
 * usage will cause poor garbage collector performance and high RSS (which is
 * not typically released back to the system, even after the memory is no longer
 * required). Since TCP sockets may never drain if the remote peer does not read
 * the data, writing a socket that is not draining may lead to a remotely
 * exploitable vulnerability.'
 * https://nodejs.org/dist/latest-v14.x/docs/api/stream.html#stream_writable_write_chunk_encoding_callback
 *
 * @param {Buffer|string} bufferOrString - input buffer or string to split
 * @param {number} chunkSize - size of buffer chunks to split input into
 * @returns {Iterator} iterator that yields chunks of fixed size
 *   by splitting the input buffer or string
 * @example pipeline(bufferToIterator(largeBuffer), writableStream, cb);
 */
export function bufferToIterator(bufferOrString, chunkSize = 2 ** 14) {
  let buffer = bufferOrString;
  if (typeof bufferOrString === 'string') {
    buffer = Buffer.from(bufferOrString, 'utf8');
  }
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('The "bufferOrString" argument must be a string'
      + ' or an instance of Buffer');
  }

  // If chunkSize is invalid, set to 16 Kb
  let finalChunkSize = chunkSize;
  if (typeof chunkSize !== 'number' || chunkSize < 1 || chunkSize > 2 ** 16) {
    finalChunkSize = 2 ** 14;
  }

  const bufferSize = buffer.length;

  /**
   * Iterate over a large Buffer and yield smaller chunks
   *
   * @returns {Buffer} buffer slices
   */
  function* chunkIterator() {
    let start = 0;
    let end;

    while (true) {
      end = start + finalChunkSize;
      yield buffer.slice(start, end);
      start = end;

      // If all data was pushed, just end the iterator
      if (end >= bufferSize) return;
    }
  }

  return chunkIterator;
}

export const bytesMeasurement = {
  /**
   * Reduce sizes in bytes of a sequence of buffers
   *
   * @param {number} accum - size accumulator
   * @param {Buffer} chunk - stream buffer chunk
   * @returns {number} - stream data size
   */
  fn: function measureSizeReducer(accum, chunk) {
    return accum + Buffer.byteLength(chunk);
  },
  initial: 0
};

export const imageDimensionsMeasurement = {
  /**
   * Perform image dimensions measurements on first buffer chunks, but only take the
   * minimum number of chunks. This was tested to work on png, jpeg, gif files always
   * on the first chunks, even with small files (down to 3kB)
   *
   * @param {number} accum - accumulator
   * @param {Buffer} chunk - stream buffer chunk
   * @param {number} index - reducer operation number
   * @returns {object} - image dimensions, if file is an image. In case of error it returns null
   */
  fn: function measureDimensionsReducer(accum, chunk, index) {
    const { size, chunksSoFar } = accum;
    // If we have a valid size result we can stop consuming stream data
    // If we exceed several chunks then it cannot be determined or it's not an image
    if (size || index > 3) return accum;

    chunksSoFar.push(chunk);
    accum.size = sizeOfImage.sync(Buffer.concat(chunksSoFar));

    return accum;
  },
  initial: {
    chunksSoFar: [],
    size: null
  },
  postProcessingFn: accum => accum.size
};

export const contentAsBufferReducer = {
  /**
   * Convert stream of buffers into a single buffer
   *
   * @param {number} accum - buffer accumulator
   * @param {Buffer} chunk - stream buffer chunk
   * @returns {number} - stream data size
   */
  fn: function joinBufferChunks(accum, chunk) {
    accum.push(chunk);
    return accum;
  },
  initial: [],
  postProcessingFn: Buffer.concat
};