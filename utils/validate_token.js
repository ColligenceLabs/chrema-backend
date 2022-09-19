var jwt = require('jsonwebtoken');
const adminRepository = require('../repositories/admin_repository');
const profileRepository = require('../repositories/profile_repository');

module.exports = {
    validateToken: async (req, res, next) => {
        let token =
            (req.headers.authorization && req.headers.authorization.split(' ')[1]) ||
            req.headers.accesstoken;
        let result;
        if (token) {
            try {
                console.log(token);
                result = jwt.verify(token, process.env.JWT_SECRET);
                req.decoded = result;
                console.log(result);
                const admin = await adminRepository.findById(result.id);
                if (!admin) {
                    const creator = await profileRepository.findById(result.id);
                    if (!creator)
                        throw {message: 'Account is not existed!'};
                }

                // set the user id to body, query for further usage
                if (admin && req.body && !req.body.admin_address) {
                    req.body.admin_address = admin.admin_address;
                }
                if (admin && req.query && !req.query.admin_address) {
                    req.query.admin_address = admin.admin_address;
                }
                next();
            } catch (error) {
                console.log(error);
                result = {
                    status: 0,
                    data: null,
                    code: 11,
                    message: (error && error?.message) || 'Invalid signature',
                };
                res.status(401).send(result);
            }
        } else {
            result = {
                status: 0,
                data: null,
                code: 12,
                message: 'Authentication error. Token required.',
            };
            res.status(401).send(result);
        }
    },
    validateMarketToken: async (req, res, next) => {
        let token =
            (req.headers.authorization && req.headers.authorization.split(' ')[1]) ||
            req.headers.accesstoken;
        let result;
        if (token) {
            try {
                result = jwt.verify(token, process.env.JWT_SECRET);
                req.decoded = result;
                const user = await adminRepository.findById(result.id);
                const profile = await profileRepository.findById(result.id);
                if (!profile && !user) {
                    throw {message: 'Profile is not existed!'};
                }
                next();
            } catch (error) {
                console.log(error);
                result = {
                    status: 0,
                    data: null,
                    code: 11,
                    message: (error && error?.message) || 'Invalid signature',
                };
                res.status(401).send(result);
            }
        } else {
            result = {
                status: 0,
                data: null,
                code: 12,
                message: 'Authentication error. Token required.',
            };
            res.status(401).send(result);
        }
    },
    validateTokenForKAS: async (req, res, next) => {
        let token =
            (req.headers.authorization && req.headers.authorization.split(' ')[1]) ||
            req.headers.accesstoken;
        let result;
        if (token) {
            try {
                result = jwt.verify(token, process.env.JWT_SECRET);
                req.decoded = result;
                const user = await adminRepository.findById(result.id);
                if (!user) {
                    throw {message: 'Account is not existed!'};
                }

                // set the user id to body, query for further usage
                if (req.body) {
                    // req.body.admin_address = user.admin_address;
                    req.body.admin_address = process.env.ADMIN_ADDRESS;
                }
                if (req.query) {
                    // req.query.admin_address = user.admin_address;
                    req.query.admin_address = process.env.ADMIN_ADDRESS;
                }
                next();
            } catch (error) {
                console.log(error);
                result = {
                    status: 0,
                    data: null,
                    code: 11,
                    message: (error && error?.message) || 'Invalid signature',
                };
                res.status(401).send(result);
            }
        } else {
            result = {
                status: 0,
                data: null,
                code: 12,
                message: 'Authentication error. Token required.',
            };
            res.status(401).send(result);
        }
    },
    generateAccessToken: (user) => {
        return jwt.sign(user, process.env.JWT_SECRET, {expiresIn: process.env.EXPIRE_ACCESSTOKEN});
    },
    generateRefreshToken: (user) => {
        return jwt.sign(user, process.env.JWT_REFRESH_TOKEN, {expiresIn: '10d'});
    },
    verifyRefreshToken: (refreshToken) => {
        return jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN);
    },
};
