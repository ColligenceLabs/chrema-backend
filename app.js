require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const cors = require('cors');
const i18n = require('i18n');
const mongoose = require('mongoose');
const env = process.env.NODE_ENV || 'development';
// const config = require(__dirname + '/config/config.json')[env]; // use in env
var cron = require('node-cron');

var indexRouter = require('./routes/index');
var marketRouter = require('./routes/market_apis');
var apisRouter = require('./routes/webview_apis');
var apisAdminRouter = require('./routes/admin_apis');
var apisBlockchainRouter = require('./routes/blockchain_apis'); // for testing
var getBlockchainEvent = require('./controllers/blockchain/index');
var statisticsService = require('./service/statistical_service');

var app = express();

// enabling cors
app.use(cors({
        origin: ['http://localhost:3000', 'http://localhost:8080', 'https://nft.taal.fi'],
        credentials: true
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/bootstrap', express.static(path.join(__dirname, '/node_modules/bootstrap/dist/css/')));
// initialize language package
app.use(i18n.init);
mongoose.connect(process.env.MONGO_HOST, {
    maxPoolSize: 20,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: false,
    useFindAndModify: false
});
// config language package
i18n.configure({
    locales: ['en', 'vi', 'ko'],
    directory: __dirname + '/locales',
    defaultLocale: 'en',
});

app.use('/admp', indexRouter);
app.use(`${process.env.API_PREFIX}/market`, marketRouter);
app.use('/user-api', apisRouter);
app.use(`${process.env.API_PREFIX}/admin-api`, apisAdminRouter);
// app.use('/admin-api', apisAdminRouter);

// for testing
app.use('/nft-api', apisBlockchainRouter);
// app.use('/api/transaction', apisTransactionRouter);
// app.use('/api/nft', apisNftRouter);
// app.use('/api/serial', apisSerialRouter);
// app.use('/api/collection', apisCollectionRouter);

// serve static files
app.use('/images', express.static('images'));
app.use(`${process.env.API_PREFIX}/taalNft`, express.static('uploads'));
app.use(`${process.env.API_PREFIX}/talkenNft`, express.static('uploads'));
// app.use('/taalNft', express.static('uploads'));

app.use('/health', function (req, res, next) {
    // next(createError(404));
    res.status(200).json({ result: "Alive..." });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    // next(createError(404));
    res.status(404).json({ error: "Page Not Found" });
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

//‘0 0 * * *’  0h0’ daily
// Run at 15:15 UTC daily, 00:15 in KR-JP
// cron.schedule('15 15 * * *', async function() {
cron.schedule('*/1 * * * *', async function() {
    //call statistic function
    statisticsService.statistics();
});

module.exports = app;
