var {body} = require('express-validator');

module.exports = {
    classname: 'ValidateReward',

    createReward: () => {
        return [
            body('name').not().isEmpty().withMessage('Missing name parameter'),
            body('type').not().isEmpty().withMessage('Missing type parameter'),
            body('description').not().isEmpty().withMessage('Missing description parameter'),
            body('tp_amount').not().isEmpty().withMessage('Missing tp_amount parameter'),
            body('quantity').not().isEmpty().withMessage('Missing quantity parameter'),
            body('tp_amount')
                .custom((value, { req }) => {
                    
                    if (value <= 0) {
                        return false;
                    }

                    return true;
                })
                .withMessage('tp_amount is invalid!'),
            body('quantity')
                .custom((value, { req }) => {
                    console.log(value)
                    
                    if (value <= 0) {
                        return false;
                    }

                    return true;
                })
                .withMessage('quantity is invalid!'),
        ];
    },
};