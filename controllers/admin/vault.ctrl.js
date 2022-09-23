const { addJson } = require('../../utils/ipfs');
const consts = require('../../utils/consts');
const { validationResult } = require('express-validator');
const { _errorFormatter } = require('../../utils/helper');
const { handlerError, handlerSuccess } = require('../../utils/handler_response');
const { getPresignedUrl } = require('../../utils/steganography');

module.exports = {
  metadata: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        let errorMsg = _errorFormatter(errors.array());
        return handlerError(req, res, errorMsg);
      }

      // Follow... OpenSea NFT Metadata Standard
      const metaData = {};
      // Upload onto Vault
      const imageUrl = await getPresignedUrl(
        req.body.filename,
        parseInt(req.body.expires, 10) * 3600 * 24,
        req.body.vault_name,
      );
      metaData.name = req.body.name;
      metaData.description = req.body.description;
      metaData.image = imageUrl;
      metaData.external_url = req.body.external_url ?? '';
      metaData.attributes = [];
      if (req.body.attributes) metaData.attributes.push(req.body.attributes);

      // Upload to IPFS
      const metadataUrl = await addJson(metaData);

      const result = {};
      result.metaData = metaData;
      result.metaLink = consts.IPFS_URL + metadataUrl.Hash;

      return handlerSuccess(req, res, { result });
    } catch (e) {
      return handlerError(req, res, e.message);
    }
  },
};
