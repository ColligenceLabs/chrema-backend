var {body, param, query} = require('express-validator');

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
    saleList: () => {
        return [
            param('nftId').not().isEmpty().withMessage('Missing nftId parameter'),
        ]
    },
    selectUserSerials: () => {
        return [
            query('nft_id').not().isEmpty().withMessage('Missing nft id parameter'),
            query('buyer').not().isEmpty().withMessage('Missing buyer parameter'),
            query('seller').not().isEmpty().withMessage('Missing seller parameter'),
            query('amount').not().isEmpty().withMessage('Missing amount parameter'),
            query('sale_id').not().isEmpty().withMessage('Missing sale id parameter'),
        ]
    },
    cancelBuy: () => {
        return [
            query('nft_id').not().isEmpty().withMessage('Missing nft id parameter'),
            query('buyer').not().isEmpty().withMessage('Missing buyer parameter'),
            query('seller').not().isEmpty().withMessage('Missing seller parameter'),
            query('sale_id').not().isEmpty().withMessage('Missing sale id parameter'),
        ]
    },
    cancelSale: () => {
        return [
            param('id').not().isEmpty().withMessage('Missing sale id parameter'),
            query('seller').not().isEmpty().withMessage('Missing seller parameter'),
        ]
    },
    getEvents: () => {
        return [
            param('id').not().isEmpty().withMessage('Missing nft id parameter')
        ]
    },
    offerNft: () => {
        return [
            body('bidder').not().isEmpty().withMessage('Missing bidder parameter'),
            body('quantity').not().isEmpty().withMessage('Missing quantity parameter'),
            body('price').not().isEmpty().withMessage('Missing price parameter'),
            body('collectionId').not().isEmpty().withMessage('Missing collectionId parameter'),
            body('nftId').not().isEmpty().withMessage('Missing nftId parameter'),
            body('tokenId').not().isEmpty().withMessage('Missing tokenId parameter'),
        ];
    },
};
