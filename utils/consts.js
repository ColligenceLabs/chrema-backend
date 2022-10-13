module.exports = {
    ADMIN_STATUS: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        SUSPEND: 'suspend',
    },
    USER_STATUS: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        SUSPEND: 'suspend',
    },
    TRANSACTION_STATUS: {
        SUCCESS: 'success',
        FAIL: 'fail',
        PENDING: 'pending',
        PROCESSING: 'processing',
        ERROR: 'error',
        CANCEL: 'cancel',
    },
    TRANSACTION_TYPE: {
        BUY: 0,
        AIRDROP: 1,
    },
    NFT_STATUS: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        SUSPEND: 'suspend',
    },
    NFT_TYPE: {
        NORMAL: 0,
        AIRDROP: 1,
    },
    //listener type
    LISTENER_TYPE: {
        BURN: 0,
        MINT: 1,
        SELL: 2,
        BUY: 3,
        CANCEL: 4,
        TRANSFER: 5
    },
    SELLING_STATUS: {
        SELL: 0,
        STOP: 1,
    },
    SELLING_TIME_STATUS: {
        COMMING_SOON: 0,
        SELLING: 1,
        CLOSED: 2,
    },
    SERIAL_STATUS: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        SUSPEND: 'suspend',
        SELLING: 'selling',
        BUYING: 'buying'
    },
    //transfer to wallet
    TRANSFERED: {
        NOT_TRANSFER: 0,
        TRANSFERED: 1,
    },
    COLLECTION_STATUS: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        SUSPEND: 'suspend',
    },
    COMPANY_STATUS: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        SUSPEND: 'suspend',
    },
    CREATOR_STATUS: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        SUSPEND: 'suspend',
    },
    REWARD_STATUS: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        SUSPEND: 'suspend',
    },
    REWARD_TYPE: {
        TRANSFER: 0,
        BUY: 1,
    },
    STATISTICS_TYPE: {
        LINE: 'line',
        CHART: 'chart',
    },
    USER_TABLE: [{name: 'No'}, {name: 'Address'}, {name: 'Status'}, {name: 'Action'}],
    ADMIN_FIELD: '_id full_name email admin_address solana_address level status image description createdAt updatedAt',
    USER_FIELD: '_id uid address status createdAt updatedAt tp_amount',
    STATISTICS_LINE_FIELD: '_id type name value date createdAt updatedAt',
    // STATISTICS_CHART_FIELD:
    //     '_id type name nft_id company_id collection_id value date createdAt updatedAt',
    STATISTICS_CHART_FIELD:
        '_id type name nft_id creator_id collection_id value date createdAt updatedAt',
    ADMIN_ADDRESS: process.env.ADMIN_ADDRESS,
    NFT_CONTRACT_ADDR: process.env.NFT_CONTRACT_ADDR,
    BCN_KLAYTN_URL: process.env.BCN_KLAYTN_URL,
    IPFS: {
        INFURA_IPFS_PROJECT_ID: process.env.INFURA_IPFS_PROJECT_ID,
        INFURA_IPFS_PROJECT_SECRET: process.env.INFURA_IPFS_PROJECT_SECRET,
    },
    // IPFS_URL: 'https://ipfs.io/ipfs/',
    IPFS_URL: 'https://infura-ipfs.io/ipfs/',
    ALT_URL: process.env.ALT_URL,
    // UPLOAD_PATH: './uploads/' + process.env.NFT_CONTRACT_ADDR + '/',
    UPLOAD_PATH: './uploads/nfts/',
    STATISTICS: {
        LINE: {
            NFT_REVENUE: 'nft_revenue',
            COLLECTION_REVENUE: 'collection_revenue',
            COMPANY_REVENUE: 'company_revenue',
            TOTAL_REVENUE: 'total_revenue',
        },
        CHART: {
            NFT_REVENUE: 'nft_revenue',
            NFT_QUANTITY: 'nft_quantity',
            COLLECTION_REVENUE: 'collection_revenue',
            COLLECTION_QUANTITY: 'collection_quantity',
            COMPANY_REVENUE: 'company_revenue',
            COMPANY_QUANTITY: 'company_quantity',
        },
    },
    COLLECTION_CATE: {
        ART: {
            value: 'art',
            title: 'Art',
        },
        GAMEITEM: {
            value: 'gameItem',
            title: 'Game Item'
        },
        MUSIC: {
            value: 'music',
            title: 'Music'
        },
        CAR: {
            value: 'car',
            title: 'Car'
        },
        HOUSE: {
            value: 'house',
            title: 'House'
        },
        NFTPROJECT: {
            value: 'nftProject',
            title: 'NFT Project'
        },
        VIRTUALLAND: {
            value: 'virtualLand',
            title: 'Virtual Land'
        },
    },
    HISTORY_MEMO: {
        PAYMENT: 'Payment',
        NFT_AIRDROP: 'NFT Airdrop',
        WALLET_TRANSFER: 'Wallet Transfer',
        TRANSFER_ERROR: 'Transfer Error',
    },
    CHAIN_NAMES: ['eth', 'klaytn', 'binance']
};
