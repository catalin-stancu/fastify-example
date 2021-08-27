/**
 * Order helper class
 */
export class OrderHelper {
  /**
   * Constructor for the Order Helper
   *
   * @param {string} BASE_IMAGE_URL prefix for images in DAM
   */
  constructor(BASE_IMAGE_URL) {
    this.BASE_IMAGE_URL = BASE_IMAGE_URL;
  }

  /**
   * Format payload received from CHECKOUT to fulfill conditions set by OMS
   *
   * client_name is set as the recipient_name from the billing address
   * The string received in the URL for each item will be prefixed with BASE_IMAGE_URL,
   * and the image URL is chosen as the mobile v1 variant
   *
   *
   * @param {object} payload payload received from PubSub
   * @returns {object} object containing mocked fields
   */
  formatFieldsForOMS(payload) {
    // TODO: Change this in the future, when the CHECKOUT response format is finished
    const mockedPayload = {
      ...payload,
      client_name: payload.address.shipping.recipient_name,
      items: payload.items.map(({ id, image, ...restOfItem }) => ({
        product_id: id,
        image: this.BASE_IMAGE_URL + image.desktop.v1.url,
        ...restOfItem
      }))
    };

    return mockedPayload;
  }

  /**
   * Format payload before delivery from OMS to COM
   *
   * Hardcode email, as CHECKOUT doesn't send this yet
   * Set item's id back to CHECKOUT's format, id which is stored in product_id
   * in OMS.
   * This is needed for establishing future relations with potential parent products
   *
   * @param {object} payload payload received from PubSub
   * @returns {object} object containing mocked fields
   */
  static formatFieldsForCOM(payload) {
    const { created_at: createdAt, modified_at: modifiedAt, status, ...restOfPayload } = payload;
    const mockedPayload = {
      ...restOfPayload,
      // TODO: remove this email when we have email from CHECKOUT
      email: 'testexploradonotif@gmail.com',
      items: payload.items.map(({
        product_parent_id: productParentId,
        product_id: productId,
        ...restOfItem
      }) => ({
        ...restOfItem,

        // overwrite id
        id: productId,
        parent_id: productParentId
      }))
    };

    return mockedPayload;
  }
}