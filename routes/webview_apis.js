var express = require('express');
var router = express.Router();

// Require controller modules.
var userController = require('../controllers/webview/user_controller');
var collectionWebViewController = require('../controllers/webview/collection_controller');
var collectionAdminController = require('../controllers/admin/collection_controller');
var transactionWebViewController = require('../controllers/webview/transaction_controller');
var transactionAdminController = require('../controllers/admin/transaction_controller');
var nftWebViewController = require('../controllers/webview/nft_controller');
var companyWebViewController = require('../controllers/admin/company_controller');

// Require request validators
var validateNft = require('../requests/validate_webapp');

// Require utils
// var isAuth = require('../utils/validate_token');
// user controller
// validateUser.createUser(),

//User apis
router.post('/user/create', userController.createUser);
router.get('/user/collection/get-all', userController.myCollection);
router.get('/user/nft/get-all', userController.myIndividualNFTs);
router.get('/user/nft/my-collection', userController.myNFTs);

//Transaction apis
router.get('/transaction/history', transactionWebViewController.history);

router.get('/transaction/detail/:id', transactionAdminController.getDetailTx);

//NFTs apis
router.get('/nft/detail/:id', nftWebViewController.getDetailNft);

router.post('/user/send-serial', userController.sendSerial);

router.get('/nft/get-all', nftWebViewController.indexNfts);

router.get('/airdrop/get-all', nftWebViewController.indexAirdrops);

router.get('/nft/category', collectionAdminController.indexCollectionCategories);

router.post('/nft/collect', validateNft.nftCollect(), userController.nftCollect);

router.post('/nft/transfer-to-wallet', validateNft.nftTransfer(), userController.transferToWallet);

router.get('/nft/get-top-artists', nftWebViewController.getTopArtists);

//Collection apis
router.get('/collection/get-all', collectionWebViewController.indexCollections);

router.get('/collection/category', collectionAdminController.indexCollectionCategories);

router.get('/collection/detail/:id', collectionAdminController.getDetailCollection);

//Company apis

router.get('/company/get-all', companyWebViewController.indexCompany);
module.exports = router;
