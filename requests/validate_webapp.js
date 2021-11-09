var {body, query, validationResult, param} = require('express-validator');

module.exports = {
    classname: 'ValidateWebapp',

    nftCollect: () => {
        return [
            body('user_address').not().isEmpty().withMessage('Missing user_address parameter'),
            body('nft_id').not().isEmpty().withMessage('Missing nft_id parameter'),
        ];
    },
    nftTransfer: () => {
        return [
            body('user_address').not().isEmpty().withMessage('Missing user_address parameter'),
            body('nft_id').not().isEmpty().withMessage('Missing nft_id parameter'),
        ];
    },
};
