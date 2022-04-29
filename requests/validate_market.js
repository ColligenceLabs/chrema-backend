var {body} = require('express-validator');

module.exports = {
    classname: 'ValidateMarket',

    sellUserNft: () => {
        return [
            body('seller').not().isEmpty().withMessage('Missing seller parameter'),
            body('quantity').not().isEmpty().withMessage('Missing quantity parameter'),
            body('price').not().isEmpty().withMessage('Missing price parameter'),
            body('collectionId').not().isEmpty().withMessage('Missing collectionId parameter'),
            body('nftId').not().isEmpty().withMessage('Missing nftId parameter'),
            body('tokenId').not().isEmpty().withMessage('Missing tokenId parameter'),
            body('serialIds').not().isEmpty().withMessage('Missing serialIds parameter'),
        ];
    },
};