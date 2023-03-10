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
            // wallet collection ์์ ์กฐํ
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
        // ์ด๋ฏธ์ง ์ฒ๋ฆฌ ํ์, image, banner
        // signmessage ๋ก ์ง๊ฐ์ฃผ์ ์ธ์ฆ ์ฒ๋ฆฌ ํ์.
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
            const profile = await profileRepository.findByAdminId(req.body.id);
            const wallets = await walletRepository.findByProfileId(profile._id);
            const exist = wallets.find(wallet => wallet.address === account);
            if (!profile || !exist) {
                return handlerError(req, res, ErrorMessage.PROFILE_IS_NOT_FOUND);
            }

            // image ์ฒ๋ฆฌ
            if (req.files.image) {
                data.image = process.env.ALT_URL + 'profiles/' + req.files.image[0].filename;
            }

            if (req.files.banner) {
                data.banner = process.env.ALT_URL + 'profiles/' + req.files.banner[0].filename;
            }
            const updateProfile = await profileRepository.update(profile._id, data);
            if (!updateProfile) {
                return handlerError(req, res, ErrorMessage.UPDATE_USER_IS_NOT_SUCCESS);
            }
            const updateAdmin = await adminRepository.update(updateProfile.admin_id, {
                email: data.email,
                full_name: data.name,
                image: data.image,
                description: data.description
            });
            if (!updateAdmin) {
                return handlerError(req, res, ErrorMessage.UPDATE_USER_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateProfile);
        } catch (error) {
            logger.error(new Error(error));
            console.log(error);
            return handlerError(req, res, error);
        }
    },
    getProfileDetail: async (req, res, next) => {
        try {
            const profile = await profileRepository.findByAdminId(req.params.id);
            if (!profile) {
                return handlerError(req, res, ErrorMessage.PROFILE_IS_NOT_FOUND);
            }
            return handlerSuccess(req, res, profile);
        } catch (error) {
            logger.error(new Error(error));
            console.log(error);
            return handlerError(req, res, error);
        }
    },
    findProfile: async (req, res, next) => {
        // ์ง๊ฐ์ฃผ์, ์ฒด์ธ์์ด๋๋ก wallet ์์ ์กฐํ

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
