var {body} = require('express-validator');

module.exports = {
    classname: 'ValidateSerial',

    createSerial: () => {
        return [
            body('quantity').not().isEmpty().withMessage('Missing quantity parameter'),
        ];
    },
};