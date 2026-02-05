// Configuration
const CONFIG = {
    APP_NAME: 'Binance Clone',
    VERSION: '1.0.0',
    INITIAL_BALANCE: {
        EUR: 400.00,
        USDT: 1000.00,
        BTC: 0.5,
        ETH: 5.0,
        BNB: 10.0,
        ADA: 1000.0,
        XRP: 5000.0,
        SOL: 20.0,
        DOGE: 10000.0
    },
    FEES: {
        MAKER: 0.001,  // 0.1%
        TAKER: 0.001   // 0.1%
    },
    SUPPORTED_PAIRS: ['EUR', 'USDT'],
    REFRESH_INTERVAL: 3000, // 3 seconds
    SESSION_TIMEOUT: 30 // minutes
};

// All Binance coins (top 100 by volume)
const ALL_COINS = [
    'BTC', 'ETH', 'BNB', 'ADA', 'XRP', 'SOL', 'DOT', 'DOGE', 'AVAX', 'MATIC',
    'SHIB', 'TRX', 'LTC', 'UNI', 'ATOM', 'LINK', 'XLM', 'ETC', 'BCH', 'XMR',
    'VET', 'FIL', 'THETA', 'AXS', 'FTM', 'AAVE', 'ALGO', 'SAND', 'MANA', 'GALA',
    'KLAY', 'FLOW', 'XTZ', 'CHZ', 'CRV', 'KSM', 'AR', 'ONE', 'BAT', 'ENJ',
    'SNX', 'COMP', 'YFI', 'MKR', 'ZIL', 'IOTA', 'WAVES', 'OMG', 'QTUM', 'RVN',
    'SC', 'ANKR', 'CELO', 'DASH', 'ZEC', 'NEO', 'EGLD', 'GRT', 'OCEAN', 'BAND',
    'RSR', 'REN', 'STORJ', 'COTI', 'OGN', 'REEF', 'TOMO', 'DENT', 'HOT', 'STMX',
    'PERP', 'DODO', 'TRB', 'BAL', 'RLC', 'NKN', 'CTK', 'ORN', 'PSG', 'JUV',
    'CITY', 'ASR', 'ATM', 'OG', 'ACM', 'BAR', 'TKO', 'ALICE', 'SLP', 'SFP'
];

// Trading pairs (combine with supported pairs)
const TRADING_PAIRS = [];
ALL_COINS.forEach(coin => {
    CONFIG.SUPPORTED_PAIRS.forEach(pair => {
        TRADING_PAIRS.push(`${coin}${pair}`);
    });
});

// For quick testing, use top 30 pairs
const TOP_PAIRS = [
    'BTCEUR', 'ETHEUR', 'BNBEUR', 'ADAEUR', 'XRPEUR', 'SOLEUR', 'DOTEUR', 'DOGEEUR', 'AVAXEUR', 'MATICEUR',
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT',
    'SHIBUSDT', 'TRXUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'LINKUSDT', 'XLMUSDT', 'ETCUSDT', 'BCHUSDT', 'XMRUSDT'
];
