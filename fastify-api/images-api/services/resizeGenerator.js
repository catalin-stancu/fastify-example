import sharp from 'sharp';

/**
 * Resize and crop image
 *
 * @param {Object} resizeOptions - resize options
 * @param {Object} resizeOptions.resolution - resize resolution
 * @param {Object} resizeOptions.resolution.width - resize horizontal resolution
 * @param {Object} resizeOptions.resolution.height - resize vertical resolution
 * @param {Buffer} resizeOptions.fileBuffer - buffer with image file to be resized / cropped
 * @param {Object} resizeOptions.backgroundColor - Object containing the background color
 * @param {number} resizeOptions.backgroundColor.r - red color channel intensity
 *   (integer in [0 - 255] range)
 * @param {number} resizeOptions.backgroundColor.g - green color channel intensity
 *   (integer in [0 - 255] range)
 * @param {number} resizeOptions.backgroundColor.b - blue color channel intensity
 *   (integer in [0 - 255] range)
 * @param {number} resizeOptions.backgroundColor.alpha - alpha channel / transparency
 *   (float in [0, 1] range)
 * @param {Object} resizeOptions.cropOptions - Crop offsets (relative to top-left image corner)
 *   and width / height
 * @returns {Promise} - resized file
 */
export async function resizeImage({ resolution, fileBuffer, backgroundColor, cropOptions }) {
  try {
    const buffer = Buffer.from(fileBuffer.buffer);
    if (cropOptions?.width && cropOptions?.height) {
      return sharp(buffer)
        .extract(cropOptions)
        .resize(resolution.width, resolution.height, {
          fit: sharp.fit.contain,
          background: backgroundColor
        })
        .toBuffer();
    }

    return sharp(buffer)
      .resize(resolution.width, resolution.height, {
        fit: sharp.fit.contain,
        background: backgroundColor
      })
      .toBuffer();
  } catch (error) {
    error.message = 'Error while resizing the image - ' + error.message;
    throw error;
  }
}