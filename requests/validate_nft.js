var {body, query} = require('express-validator');

module.exports = {
    classname: 'ValidateNft',

    updateNft: () => {
        return [body('user_name').not().isEmpty().withMessage('Missing user_name parameter')];
    },

    updateNftSchedule: () => {
        return [
            body('start_date').not().isEmpty().withMessage('Missing start_date parameter'),
            body('end_date').not().isEmpty().withMessage('Missing end_date parameter'),
        ];
    },

    createNft: () => {
        return [body('start_date').not().isEmpty().withMessage('Missing start_date parameter')];
    },

    userNFTs: () => {
        return [
            query('address').not().isEmpty().withMessage('Missing address parameter'),
            query('size').not().isEmpty().withMessage('Missing size parameter'),
        ]
    },

    userSerials: () => {
        return [
            query('owner_id').not().isEmpty().withMessage('Missing owner_id parameter'),
            query('nft_id').not().isEmpty().withMessage('Missing nft_id parameter'),
        ];
    }
};
