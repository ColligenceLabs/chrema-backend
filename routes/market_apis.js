const express = require('express');
const router = express.Router();

// Require controller modules.
const profileController = require('../controllers/admin/profile_controller');

// Require request validators
const validateProfile = require('../requests/validate_profile');

// Require utils
const isAuth = require('../utils/validate_token');

// var multer  = require('multer');
// var upload = multer({ dest: './uploads/' });

const uploadProfile = require('../repositories/profile_upload_repository');

// router.post('/profile/register', uploadProfile, validateProfile.register(), profileController.profileRegister);
router.post('/profile/update', uploadProfile, validateProfile.update(), profileController.profileUpdate);
router.get('/profile/login/:id', validateProfile.login(), profileController.login);
// router.get('/profile/indexs', isAuth.validateToken, profileController.indexProfiles);
// router.get('/profile/detail/:id',validateProfile.getProfileDetail() , isAuth.validateToken, profileController.getProfileDetail);

module.exports = router;