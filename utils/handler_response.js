module.exports = {
    handlerSuccess(req, res, data) {
        res.status(200).send({
            status: 1,
            data: data,
            message: 'done!',
        });
    },

    handlerError(req, res, message) {
        res.status(200).send({
            status: 0,
            data: null,
            message: message,
        });
    },
};
