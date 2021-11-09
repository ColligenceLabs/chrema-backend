var {body} = require('express-validator');

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
};
