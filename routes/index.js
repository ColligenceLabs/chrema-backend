var express = require('express');
var router = express.Router();
const {USER_TABLE} = require('../utils/consts');

/* GET home page. */
router.get('/backend', function (req, res, next) {
    res.render('index', {title: 'Home'});
});

router.get('/login', function (req, res, next) {
    res.render('sign_in', {title: 'login'});
});

router.get('/user', function (req, res, next) {
    res.render('user/index', {title: 'User Management', table_head: USER_TABLE});
});

router.get('/nft', function (req, res, next) {
    res.render('product/index', {title: 'NFT Management', table_head: USER_TABLE});
});

router.get('/airdrop', function (req, res, next) {
    res.render('product/airdrop', {title: 'AirDrop Management', table_head: USER_TABLE});
});

router.get('/serials', function (req, res, next) {
    res.render('serial/index', {title: 'Edition Management', table_head: USER_TABLE});
});

router.get('/transaction', function (req, res, next) {
    res.render('transaction/index', {title: 'Edition Management', table_head: USER_TABLE});
});

router.get('/collection', function (req, res, next) {
    res.render('collection/index', {title: 'Collection Management', table_head: USER_TABLE});
});

router.get('/company', function (req, res, next) {
    res.render('company/index', {title: 'Company Management', table_head: USER_TABLE});
});
router.get('/profile', function (req, res, next) {
    res.render('profile', {title: 'Profile Management', table_head: USER_TABLE});
});

router.get('/reward', function (req, res, next) {
    res.render('reward/index', {title: 'Reward Management', table_head: USER_TABLE});
});

//test
var admin = {
    name: 'hungdh 1996',
};
var users = [
    {
        id: 13,
        address: '13rhfjbfg',
        status: 'active',
    },
];

router.get('/user-management', function (req, res, next) {
    res.render('user_management', {
        title: 'user management',
        admin: admin,
        users: users,
        itemActive: 0,
    });
});

router.get('/product-management', function (req, res, next) {
    res.render('product_management', {
        title: 'product management',
        admin: admin,
        products: [],
        itemActive: 1,
    });
});

router.get('/edition-management', function (req, res, next) {
    res.render('edition_management', {
        title: 'edition management',
        admin: admin,
        editions: [],
        itemActive: 2,
    });
});

router.get('/transaction-management', function (req, res, next) {
    res.render('transaction_management', {
        title: 'transaction management',
        admin: admin,
        transactions: [],
        itemActive: 3,
    });
});

module.exports = router;
