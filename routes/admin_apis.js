const express = require('express');
const router = express.Router();

// Require controller modules.
const adminController = require('../controllers/admin/admin_controller');
const collectionController = require('../controllers/admin/collection_controller');
const serialController = require('../controllers/admin/serial_controller');
const nftController = require('../controllers/admin/nft_controller');
const transactionController = require('../controllers/admin/transaction_controller');
const userController = require('../controllers/admin/user_controller');
const companyController = require('../controllers/admin/company_controller');
const rewardController = require('../controllers/admin/reward_controller');
const statisticsController = require('../controllers/admin/statistics_controller');
const historyController = require('../controllers/admin/history_controller');
const creatorController = require('../controllers/admin/creator_controller');
const marketController = require('../controllers/admin/market_controller');

// Require request validators
const validateAdmin = require('../requests/validate_admin');
const validateNft = require('../requests/validate_nft');
const validateSerial = require('../requests/validate_serial');
const validateReward = require('../requests/validate_reward');
const validateMarket = require('../requests/validate_market');

// Require utils
const isAuth = require('../utils/validate_token');

const multer  = require('multer');
const upload = multer({ dest: './uploads/' });

const uploadAdmin = require('../repositories/creator_upload_repository');
const uploadCollection = require('../repositories/collection_upload_repository');
const uploadNFT = require('../repositories/upload_repository');

//Admin apis
const ipCheck = (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip && ip === "106.243.97.163") next();
    else res.status(401).json({ error: "Auth Error from authcheck" });
};
// router.use(ipCheck);

// router.post('/admin/register', upload.single('image'), validateAdmin.register(), adminController.adminRegister);
// router.post('/admin/register', validateAdmin.register(), adminController.adminRegister);
router.post('/admin/register', uploadAdmin, validateAdmin.register(), adminController.adminRegister);

router.post('/admin/login', validateAdmin.login(), adminController.adminlogin);

router.get('/admin/indexs', isAuth.validateToken, adminController.indexAdmins);

router.get('/admin/detail/:id', isAuth.validateToken, adminController.getDetailAdmin);

router.put('/admin/update/:id', uploadAdmin, isAuth.validateToken, adminController.updateAdmin);

router.put('/admin/update-status/:id', isAuth.validateToken, adminController.updateAdminAll);

router.put('/admin/update-mine/:id', isAuth.validateToken, adminController.updateMyInfo);

router.put('/admin/password/:id', isAuth.validateToken, adminController.updatePassword);

//Collection apis
router.get('/collection/getnfts', isAuth.validateToken, collectionController.getAvailableNfts);

router.get('/collection/category', isAuth.validateToken, collectionController.indexCollectionCategories);

// router.post('/collection/create', upload.single('image'), isAuth.validateToken, collectionController.createCollection);
// router.post('/collection/create', isAuth.validateToken, collectionController.createCollection);
router.post('/collection/create', uploadCollection, isAuth.validateToken, collectionController.createCollection);

router.get('/collection/indexs', isAuth.validateToken, collectionController.indexCollections);

router.get('/collection/creator/:id', isAuth.validateToken, collectionController.getMyCollections);

router.get(
    '/collection/detail/:id',
    collectionController.getDetailCollection,
);

router.put('/collection/update/:id', uploadCollection, isAuth.validateToken, collectionController.updateCollection);

router.put('/collection/update-status/:id', isAuth.validateToken, collectionController.updateCollectionStatus);

router.put('/collection/addnft/:id', isAuth.validateToken, collectionController.addNftToCollection);

router.get('/collection/top', collectionController.getTopCollections)

router.put(
    '/collection/removenft/:id',
    isAuth.validateToken,
    collectionController.removeNftFromCollection,
);

router.delete(
    '/collection/delete/:id',
    isAuth.validateToken,
    collectionController.deleteCollection,
);

router.put('/collection/deletes', isAuth.validateToken, collectionController.deleteCollections);

// Market APIs
router.get('/market/indexs', marketController.indexCollections);
router.get('/market/indexsR', marketController.indexCollectionsR);
router.post('/market/sellNft', isAuth.validateMarketToken, validateMarket.sellUserNft(), marketController.sellUserNft);
router.get('/market/saleList/:nftId', validateMarket.saleList(), marketController.saleList);
router.get('/market/select-user-serials', validateMarket.selectUserSerials(), marketController.selectUserSerials);
router.get('/market/cancel-buy-usernft', validateMarket.cancelBuy(), marketController.cancelBuy);
router.get('/market/nft-events/:id', validateMarket.getEvents(), marketController.getEvents);
router.delete('/market/cancel-sale/:id', isAuth.validateMarketToken, validateMarket.cancelSale(), marketController.cancelSale);

//Serials apis
router.post('/serial/create', isAuth.validateToken, validateSerial.createSerial(), serialController.createSerial);

router.get('/serial/indexs', isAuth.validateToken, serialController.indexSerials);

router.get('/serial/sales-count/:id', isAuth.validateToken, serialController.salesCount);


router.get('/serial/detail/:id', isAuth.validateToken, serialController.getDetailSerial);

router.put('/serial/update/:id', isAuth.validateToken, serialController.updateSerial);

router.put('/serial/update-serials', isAuth.validateToken, serialController.updateSerials);

router.delete('/serial/delete/:id', isAuth.validateToken, serialController.deleteSerial);

router.delete('/serial/delete-many', isAuth.validateToken, serialController.deleteManySerial);

//Nft apis
// router.post('/nft/create', upload.array('files', 2), isAuth.validateToken, nftController.createNft);
// router.post('/nft/batchcreate', upload.array('files', 2), isAuth.validateToken, nftController.createNftBatch);
router.post('/nft/create', uploadNFT, isAuth.validateToken, nftController.createNft);
router.delete('/nft/cancel-create/:id', isAuth.validateToken, nftController.cancelCreateNft);
router.post('/nft/batchcreate', uploadNFT, isAuth.validateTokenForKAS, nftController.createNftBatchNew);
router.post('/nft/solanacreate', uploadNFT, isAuth.validateToken, nftController.createSolanaNft);

router.post('/nft/transfer', isAuth.validateTokenForKAS, nftController.kasTransferNft);

router.post('/nft/kas/transfer17', isAuth.validateTokenForKAS, nftController.kasTransfer17);
router.post('/nft/kas/transfer37', isAuth.validateTokenForKAS, nftController.kasTransfer37);

router.post('/nft/kas/deploy17', isAuth.validateToken, nftController.deploy17);
router.post('/nft/kas/deploy37', isAuth.validateToken, nftController.deploy37);

router.get('/nft/indexs', nftController.indexNfts);

router.get('/nft/indexsR', nftController.indexNftsR);

router.get('/nft/indexsM', nftController.indexNftsM);

router.get('/nft/detail/:id', nftController.getDetailNft);

router.put('/nft/update/:id', isAuth.validateToken, nftController.updateNft);

router.put('/nft/update-status/:id', isAuth.validateToken, nftController.updateNftStatus);

router.put('/nft/update-schedule', isAuth.validateToken, nftController.updateSchedule);

router.put('/nft/stop-selling', isAuth.validateToken, nftController.stopSelling);

router.put('/nft/update-onchain/:id', isAuth.validateToken, nftController.updateNftOnchain);

router.put('/nft/update-transfered/:id', isAuth.validateToken, nftController.increaseTransfered);

router.post('/nft/set-transfered', isAuth.validateToken, nftController.setNftTransferData);

router.get('/nft/user-nfts', validateNft.userNFTs(), isAuth.validateMarketToken, nftController.userNFTs);

router.get('/nft/user-serials', validateNft.userSerials(), isAuth.validateMarketToken, nftController.userSerials);

router.get('/nft/batch-sell', isAuth.validateToken, nftController.sellNFTs);

router.get('/nft/select-serials', isAuth.validateToken, nftController.selectSerials);
router.get('/nft/cancel-buy', isAuth.validateMarketToken, nftController.cancelBuy);

router.put(
    '/nft/update-schedule',
    validateNft.updateNftSchedule(),
    isAuth.validateToken,
    nftController.updateSchedule,
);

router.delete('/nft/delete/:id', isAuth.validateToken, nftController.deleteNft);

router.put('/nft/delete-many', isAuth.validateToken, nftController.deleteManyNft);

//Transaction apis
router.post('/transaction/create', isAuth.validateToken, transactionController.createTx);

router.get('/transaction/indexs', isAuth.validateToken, transactionController.indexTxs);

router.put('/transaction/update/:id', isAuth.validateToken, transactionController.updateTx);

router.delete('/transaction/delete/:id', isAuth.validateToken, transactionController.deleteTx);

router.get('/transaction/detail/:id', isAuth.validateToken, transactionController.getDetailTx);

//History apis
router.post('/history/create', isAuth.validateToken, historyController.createTx);

router.get('/history/indexs', isAuth.validateToken, historyController.indexTxs);

router.put('/history/update/:id', isAuth.validateToken, historyController.updateTx);

router.delete('/history/delete/:id', isAuth.validateToken, historyController.deleteTx);

router.get('/history/detail/:id', isAuth.validateToken, historyController.getDetailTx);

//User apis
router.get('/user/indexs', isAuth.validateToken, userController.indexUsers);

router.get('/user/detail/:id', isAuth.validateToken, userController.getDetailUser);

router.post('/user/create', isAuth.validateToken, userController.createUser);

router.put('/user/update/:id', isAuth.validateToken, userController.updateUser);

router.delete('/user/delete/:id', isAuth.validateToken, userController.deleteUser);

router.delete('/user/delete-many', isAuth.validateToken, userController.deleteManyUser);

//Company apis
router.get('/company/indexs', isAuth.validateToken, companyController.indexCompany);

router.get('/company/detail/:id', isAuth.validateToken, companyController.getCompanyDetail);

router.post('/company/create', isAuth.validateToken, companyController.createCompany);

router.put('/company/update/:id', isAuth.validateToken, companyController.updateCompany);

router.delete('/company/delete/:id',isAuth.validateToken, companyController.deleteCompany);

//Creator apis
router.get('/creator/indexs', isAuth.validateToken, creatorController.indexCreator);

router.get('/creator/detail/:id', isAuth.validateToken, creatorController.getCreatorDetail);

// router.post('/creator/create', upload.single('image'), isAuth.validateToken, creatorController.createCreator);
// router.post('/creator/create', isAuth.validateToken, creatorController.createCreator);
router.post('/creator/create', uploadAdmin, isAuth.validateToken, creatorController.createCreator);

router.put('/creator/update/:id', isAuth.validateToken, creatorController.updateCreator);

router.delete('/creator/delete/:id',isAuth.validateToken, creatorController.deleteCreator);

//Reward apis
router.get('/reward/indexs', isAuth.validateToken, rewardController.indexRewards);

router.get('/reward/detail/:id', isAuth.validateToken, rewardController.getRewardDetail);

router.post('/reward/create', isAuth.validateToken, validateReward.createReward(), rewardController.createReward);

router.put('/reward/update/:id', isAuth.validateToken, rewardController.updateReward);

router.delete('/reward/delete/:id', isAuth.validateToken, rewardController.deleteReward);

//Statistics apis
router.get('/statistics/line', isAuth.validateToken, statisticsController.getLine);

router.get('/statistics/chart', isAuth.validateToken, statisticsController.getChart);

router.get('/statistics/summarypie', isAuth.validateToken, statisticsController.getSummaryPie);

module.exports = router;