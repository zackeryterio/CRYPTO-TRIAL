// Advanced LocalStorage Database
class BinanceDB {
    constructor() {
        this.USER_KEY = 'binance_user_';
        this.SETTINGS_KEY = 'binance_settings';
        this.initDatabase();
    }

    initDatabase() {
        if (!localStorage.getItem(this.SETTINGS_KEY)) {
            const settings = {
                theme: 'dark',
                language: 'en',
                sound: true,
                notifications: true,
                defaultPair: 'BTCEUR',
                defaultView: 'chart',
                timezone: 'UTC'
            };
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
        }
    }

    // User Management
    createUser(email, password) {
        const userId = btoa(email).replace(/=/g, '');
        const userData = {
            id: userId,
            email: email,
            password: btoa(password), // Simple encoding (not secure for production)
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            balance: CONFIG.INITIAL_BALANCE,
            portfolio: {
                totalValue: 0,
                dayChange: 0,
                dayChangePercent: 0,
                assets: []
            },
            openOrders: [],
            orderHistory: [],
            tradeHistory: [],
            depositHistory: [],
            withdrawalHistory: [],
            watchlist: ['BTCEUR', 'ETHEUR', 'BNBEUR'],
            apiKeys: [],
            settings: JSON.parse(localStorage.getItem(this.SETTINGS_KEY))
        };
        
        localStorage.setItem(`${this.USER_KEY}${userId}`, JSON.stringify(userData));
        this.setCurrentUser(userId);
        return userId;
    }

    authenticateUser(email, password) {
        const userId = btoa(email).replace(/=/g, '');
        const userData = JSON.parse(localStorage.getItem(`${this.USER_KEY}${userId}`));
        
        if (userData && btoa(password) === userData.password) {
            userData.lastLogin = new Date().toISOString();
            localStorage.setItem(`${this.USER_KEY}${userId}`, JSON.stringify(userData));
            this.setCurrentUser(userId);
            return userId;
        }
        return null;
    }

    setCurrentUser(userId) {
        localStorage.setItem('current_user', userId);
        localStorage.setItem('session_start', new Date().toISOString());
    }

    getCurrentUser() {
        const userId = localStorage.getItem('current_user');
        if (!userId) return null;
        
        // Check session timeout
        const sessionStart = localStorage.getItem('session_start');
        if (sessionStart) {
            const sessionAge = (new Date() - new Date(sessionStart)) / (1000 * 60); // minutes
            if (sessionAge > CONFIG.SESSION_TIMEOUT) {
                this.logout();
                return null;
            }
        }
        
        return this.getUser(userId);
    }

    getUser(userId) {
        return JSON.parse(localStorage.getItem(`${this.USER_KEY}${userId}`));
    }

    updateUser(userId, data) {
        const userData = this.getUser(userId);
        const updatedData = { ...userData, ...data };
        localStorage.setItem(`${this.USER_KEY}${userId}`, JSON.stringify(updatedData));
        this.triggerUpdate();
    }

    logout() {
        localStorage.removeItem('current_user');
        localStorage.removeItem('session_start');
        window.location.href = 'login.html';
    }

    // Trading Functions
    placeOrder(userId, order) {
        const user = this.getUser(userId);
        const orderId = `ORD${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
        
        const newOrder = {
            id: orderId,
            timestamp: new Date().toISOString(),
            status: 'open',
            filled: 0,
            remaining: order.amount,
            ...order
        };
        
        user.openOrders.push(newOrder);
        this.updateUser(userId, { openOrders: user.openOrders });
        
        // Simulate order execution (in real app, this would be on exchange)
        setTimeout(() => this.executeOrder(userId, orderId), 1000);
        
        return orderId;
    }

    executeOrder(userId, orderId) {
        const user = this.getUser(userId);
        const orderIndex = user.openOrders.findIndex(o => o.id === orderId);
        
        if (orderIndex === -1) return;
        
        const order = user.openOrders[orderIndex];
        const baseCoin = order.pair.replace(/EUR|USDT$/, '');
        const quoteCoin = order.pair.includes('EUR') ? 'EUR' : 'USDT';
        const total = order.price * order.amount;
        
        // Update balances
        if (order.side === 'buy') {
            user.balance[quoteCoin] -= total;
            user.balance[baseCoin] = (user.balance[baseCoin] || 0) + order.amount;
        } else {
            user.balance[baseCoin] -= order.amount;
            user.balance[quoteCoin] += total;
        }
        
        // Update order
        order.status = 'filled';
        order.filled = order.amount;
        order.remaining = 0;
        order.executedAt = new Date().toISOString();
        
        // Add to trade history
        const trade = {
            id: `TRD${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
            orderId: orderId,
            pair: order.pair,
            side: order.side,
            price: order.price,
            amount: order.amount,
            total: total,
            fee: total * CONFIG.FEES.TAKER,
            feeCoin: quoteCoin,
            timestamp: new Date().toISOString()
        };
        
        user.orderHistory.push(order);
        user.tradeHistory.unshift(trade);
        user.openOrders.splice(orderIndex, 1);
        
        // Update portfolio value
        this.updatePortfolio(userId);
        
        this.updateUser(userId, {
            balance: user.balance,
            openOrders: user.openOrders,
            orderHistory: user.orderHistory,
            tradeHistory: user.tradeHistory
        });
        
        this.triggerUpdate();
        return trade;
    }

    cancelOrder(userId, orderId) {
        const user = this.getUser(userId);
        const orderIndex = user.openOrders.findIndex(o => o.id === orderId);
        
        if (orderIndex === -1) return false;
        
        const order = user.openOrders[orderIndex];
        order.status = 'cancelled';
        order.cancelledAt = new Date().toISOString();
        
        user.orderHistory.push(order);
        user.openOrders.splice(orderIndex, 1);
        
        this.updateUser(userId, {
            openOrders: user.openOrders,
            orderHistory: user.orderHistory
        });
        
        this.triggerUpdate();
        return true;
    }

    // Portfolio Management
    updatePortfolio(userId) {
        const user = this.getUser(userId);
        let totalValue = 0;
        let assets = [];
        
        // Get latest prices from Binance API
        const prices = window.marketData || {};
        
        Object.keys(user.balance).forEach(coin => {
            const balance = user.balance[coin];
            if (balance > 0) {
                let price = 1; // Default for EUR/USDT
                
                if (coin !== 'EUR' && coin !== 'USDT') {
                    // Try to get price in EUR first, then USDT
                    const eurPair = `${coin}EUR`;
                    const usdtPair = `${coin}USDT`;
                    price = prices[eurPair] || prices[usdtPair] || 1;
                }
                
                const value = balance * price;
                totalValue += value;
                
                assets.push({
                    coin: coin,
                    balance: balance,
                    price: price,
                    value: value,
                    allocation: 0 // Will calculate after total
                });
            }
        });
        
        // Calculate allocations
        assets.forEach(asset => {
            asset.allocation = totalValue > 0 ? (asset.value / totalValue) * 100 : 0;
        });
        
        user.portfolio = {
            totalValue: totalValue,
            assets: assets,
            lastUpdated: new Date().toISOString()
        };
        
        this.updateUser(userId, { portfolio: user.portfolio });
        return user.portfolio;
    }

    // Watchlist
    addToWatchlist(userId, pair) {
        const user = this.getUser(userId);
        if (!user.watchlist.includes(pair)) {
            user.watchlist.push(pair);
            this.updateUser(userId, { watchlist: user.watchlist });
        }
    }

    removeFromWatchlist(userId, pair) {
        const user = this.getUser(userId);
        user.watchlist = user.watchlist.filter(p => p !== pair);
        this.updateUser(userId, { watchlist: user.watchlist });
    }

    // Settings
    updateSettings(userId, settings) {
        const user = this.getUser(userId);
        user.settings = { ...user.settings, ...settings };
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(user.settings));
        this.updateUser(userId, { settings: user.settings });
    }

    // Event System
    triggerUpdate() {
        window.dispatchEvent(new CustomEvent('dbUpdate', { detail: { timestamp: new Date() } }));
    }

    // Getter Methods
    getBalance(userId) {
        const user = this.getUser(userId);
        return user ? user.balance : CONFIG.INITIAL_BALANCE;
    }

    getOpenOrders(userId) {
        const user = this.getUser(userId);
        return user ? user.openOrders : [];
    }

    getTradeHistory(userId, limit = 50) {
        const user = this.getUser(userId);
        return user ? user.tradeHistory.slice(0, limit) : [];
    }

    getPortfolio(userId) {
        const user = this.getUser(userId);
        return user ? user.portfolio : { totalValue: 0, assets: [] };
    }

    getWatchlist(userId) {
        const user = this.getUser(userId);
        return user ? user.watchlist : [];
    }

    // Admin Functions (for demo)
    resetDemo(userId) {
        const user = this.getUser(userId);
        user.balance = CONFIG.INITIAL_BALANCE;
        user.openOrders = [];
        user.tradeHistory = [];
        this.updateUser(userId, {
            balance: user.balance,
            openOrders: user.openOrders,
            tradeHistory: user.tradeHistory
        });
        return true;
    }
}

// Create global instance
const binanceDB = new BinanceDB();
