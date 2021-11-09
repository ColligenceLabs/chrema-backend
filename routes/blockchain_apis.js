// for testing
var express = require('express');
var router = express.Router();

// Require controller modules.
var nftController = require('../controllers/blockchain/nft_controller');

// blockchain nft apis
router.get('/list', nftController.tokenList);
router.post('/mint', nftController.mint);
router.post('/burn', nftController.burn);
router.post('/transfer', nftController.transfer);

module.exports = router;
