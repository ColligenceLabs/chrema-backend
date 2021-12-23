var historyRepository = require('../../repositories/history_repository');
var userRepository = require('../../repositories/user_repository');
var adminRepository = require('../../repositories/admin_repository');
var nftRepository = require('../../repositories/nft_repository');
var ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
var consts = require('../../utils/consts');
const logger = require('../../utils/logger');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');

module.exports = {
    classname: 'HistoryController',
    async history(req, res, next) {
        try {
            let uid = req.query.uid;
            let user = await userRepository.findByUid(uid);
            let adminIds = await adminRepository.getAdminIds();

            if (!user) {
                return handlerError(req, res, ErrorMessage.USER_IS_NOT_FOUND);
            }
            let ownerId = user._id;
            let txList = await historyRepository.getTxBybuyer({
                seller: {$in: adminIds},
                buyer: ownerId,
                status: {
                    $in: [consts.TRANSACTION_STATUS.SUCCESS, consts.TRANSACTION_STATUS.PROCESSING, consts.TRANSACTION_STATUS.ERROR],
                },
            });

            for (let i = 0; i < txList.length; i++) {
                txList[i] = JSON.parse(JSON.stringify(txList[i]));
                let nft = await nftRepository.findById(txList[i].serial_id.nft_id);
                if (nft) {
                    txList[i].serial_id.nft_id = nft;
                }

                if (txList[i].price == 0) {
                    txList[i].type = 1;
                } else {
                    txList[i].type = 0;
                }
            }

            return handlerSuccess(req, res, txList);
        } catch (error) {
            logger.error(new Error(error));
            return handlerError(req, res, error);
        }
    },
};
