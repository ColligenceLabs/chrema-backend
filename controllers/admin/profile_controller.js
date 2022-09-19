const {validationResult} = require('express-validator');
const profileRepository = require('../../repositories/profile_repository');
const adminRepository = require('../../repositories/admin_repository');
const walletRepository = require('../../repositories/wallet_repository');
const {verifyMessage} = require('@ethersproject/wallet');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const auth = require('../../utils/validate_token');
const {
    validateRouter,
    isEmptyObject,
} = require('../../utils/helper');
const logger = require('../../utils/logger');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const tokenList = [];

module.exports = {
    classname: 'ProfileController',
    login: async (req, res, next) => {
        try {
            const validate = validateRouter(req, res);
            if (validate) {
                return handlerError(req, res, validate);
            }
            if (req.params.id === 'undefined' || req.query.chainId === 'undefined') {
                return handlerError(req, res, ErrorMessage.WALLET_ADDRESS_IS_UNDEFINED);
            }
            // wallet collection 에서 조회
            let wallet = await walletRepository.find(req.params.id, req.query.chainId);
            let profile;
            let admin;
            if (!wallet) {
                console.log('not exist.');
                // create default profile and create wallet
                const newAdmin = {
                    email: req.params.id,
                    full_name: 'Unnamed',
                    admin_address: req.params.id,
                    status: 'active',
                    level: 'Creator',
                    password: 'asdfjklm'
                };
                admin = await adminRepository.create(newAdmin);
                profile = await profileRepository.createProfile(admin._id);
                wallet = await walletRepository.createWallet(profile._id, req.params.id, req.query.chainId);
            } else {
                profile = wallet.profile_id;
            }
            console.log(profile, wallet);
            const profileInfo = {
                id: profile.admin_id,
                full_name: profile.name,
                email: profile.email,
                level: profile.is_creator ? 'Creator' : 'User',
                image: profile.image,
                banner: profile.banner,
                description: profile.description
            };
            let accessToken = auth.generateAccessToken(profileInfo);
            let refreshToken = auth.generateRefreshToken({id: profile._id});
            tokenList[profile._id] = refreshToken;

            return handlerSuccess(req, res, {
                infor: profileInfo,
                accessToken: accessToken,
                refreshToken: refreshToken,
            });
        } catch (e) {
            console.log(e);
            return handlerError(req, res, e);
        }
    },
    profileUpdate: async (req, res, next) => {
        // 이미지 처리 필요, image, banner
        // signmessage 로 지갑주소 인증 처리 필요.
        try {
            const validate = validateRouter(req, res);
            if (validate) {
                return handlerError(req, res, validate);
            }

            const data = getUpdateBodys(req.body);
            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }
            const message = 'Welcome to Taal NFT Marketplace!';
            const account = verifyMessage(message, req.body.signedMessage);
            const wallets = await walletRepository.findByProfileId(req.body.id);
            console.log(wallets);
            const exist = wallets.find(wallet => wallet.address === account);
            console.log(exist);
            const profile = await profileRepository.findById(req.body.id);
            if (!profile || !exist) {
                return handlerError(req, res, ErrorMessage.PROFILE_IS_NOT_FOUND);
            }
            // image 처리
            if (req.files.image) {
                data.image = process.env.ALT_URL + 'profiles/' + req.files.image[0].filename;
            }

            if (req.files.banner) {
                data.banner = process.env.ALT_URL + 'profiles/' + req.files.banner[0].filename;
            }
            const updateAdmin = await adminRepository.update(req.body.id, {
                email: data.email,
                full_name: data.name,
                image: data.image,
                description: data.description
            });
            if (!updateAdmin) {
                return handlerError(req, res, ErrorMessage.UPDATE_USER_IS_NOT_SUCCESS);
            }
            const updateProfile = await profileRepository.update(req.body.id, data);
            if (!updateProfile) {
                return handlerError(req, res, ErrorMessage.UPDATE_USER_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateProfile);
        } catch (error) {
            logger.error(new Error(error));
            console.log(error);
            return handlerError(req, res, error);
        }
    },

    findProfile: async (req, res, next) => {
        // 지갑주소, 체인아이디로 wallet 에서 조회

    },
};

function getUpdateBodys(updates) {
    let updateBodys = {};

    if (updates?.name) {
        updateBodys.name = updates.name;
    }
    if (updates?.email) {
        updateBodys.email = updates.email;
    }
    if (updates?.description) {
        updateBodys.description = updates.description;
    }
    return updateBodys;
}
