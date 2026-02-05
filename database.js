const CONFIG = {
    INITIAL_BALANCE: {
        EUR: 400.00,
        BTC: 0.005,
        ETH: 0.05,
        BNB: 1.0,
        ADA: 200,
        XRP: 500,
        SOL: 2.5,
        DOGE: 5000
    },
    DEFAULT_PAIR: 'BTCEUR',
    FEES: { MAKER: 0.001, TAKER: 0.001 }
};

class BinanceDB {
    constructor() {
        this.STORAGE_KEY = 'binance_v3';
        this.currentUser = null;
        this.init();
    }

    init() {
        if (!localStorage.getItem(this.STORAGE_KEY)) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                users: {},
                settings: { theme: 'dark' }
            }));
        }
        this.load();
    }

    load() {
        this.data = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
    }

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    }

    // User management
    register(email) {
        const userId = btoa(email).slice(0, 20);
        
        const user = {
            id: userId,
            email: email,
            createdAt: new Date().toISOString(),
            balance: { ...CONFIG.INITIAL_BALANCE },
            portfolioValue: 400,
            openOrders: [],
            orderHistory: [],
            tradeHistory: [],
            depositHistory: [],
            watchlist: ['BTCEUR', 'ETHEUR', 'BNBEUR'],
            settings: { theme: 'dark', leverage: 1 }
        };

        if (!this.data.users) this.data.users = {};
        this.data.users[userId] = user;
        this.save();
        
        return this.login(email);
    }

    login(email) {
        const userId = btoa(email).slice(0, 20);
        const user = this.data.users?.[userId];
        
        if (user) {
            user.lastLogin = new Date().toISOString();
            this.currentUser = user;
            this.save();
            
            sessionStorage.setItem('user_id', userId);
            sessionStorage.setItem('login_time', Date.now());
            return user;
        }
        return null;
    }

    getCurrentUser() {
        const userId = sessionStorage.getItem('user_id');
        const loginTime = sessionStorage.getItem('login_time');
        
        if (userId && loginTime && (Date.now() - loginTime < 30 * 60 * 1000)) {
            return this.data.users?.[userId];
        }
        return null;
    }

    logout() {
        sessionStorage.clear();
        this.currentUser = null;
    }

    // Trading functions
    placeOrder(orderData) {
        const user = this.getCurrentUser();
        if (!user) return null;

        const orderId = `ORD${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
        const pair = orderData.pair;
        const baseCoin = pair.replace(/EUR|USDT$/, '');
        const quoteCoin = pair.includes('EUR') ? 'EUR' : 'USDT';
        const total = orderData.price * orderData.amount;
        const fee = total * CONFIG.FEES.TAKER;

        const order = {
            id: orderId,
            ...orderData,
            total: total,
            fee: fee,
            status: 'open',
            timestamp: new Date().toISOString(),
            filled: 0,
            remaining: orderData.amount
        };

        // Reserve funds
        if (orderData.side === 'buy') {
            if (user.balance[quoteCoin] < total) return null;
            user.balance[quoteCoin] -= total;
        } else {
            if ((user.balance[baseCoin] || 0) < orderData.amount) return null;
            user.balance[baseCoin] -= orderData.amount;
        }

        user.openOrders.push(order);
        this.save();

        // Auto-fill order after 1 second (demo)
        setTimeout(() => this.fillOrder(orderId), 1000);
        
        return orderId;
    }

    fillOrder(orderId) {
        const user = this.getCurrentUser();
        if (!user) return;

        const orderIndex = user.openOrders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return;

        const order = user.openOrders[orderIndex];
        const pair = order.pair;
        const baseCoin = pair.replace(/EUR|USDT$/, '');
        const quoteCoin = pair.includes('EUR') ? 'EUR' : 'USDT';

        // Complete the trade
        if (order.side === 'buy') {
            user.balance[baseCoin] = (user.balance[baseCoin] || 0) + order.amount;
            user.balance[quoteCoin] -= order.fee;
        } else {
            user.balance[quoteCoin] += order.total - order.fee;
        }

        // Update order status
        order.status = 'filled';
        order.filled = order.amount;
        order.remaining = 0;
        order.executedAt = new Date().toISOString();

        // Record trade
        const trade = {
            id: `TRD${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
            orderId: orderId,
            pair: order.pair,
            side: order.side,
            price: order.price,
            amount: order.amount,
            total: order.total,
            fee: order.fee,
            timestamp: new Date().toISOString()
        };

        user.tradeHistory.unshift(trade);
        user.orderHistory.unshift(order);
        user.openOrders.splice(orderIndex, 1);
        
        this.save();
        window.dispatchEvent(new Event('balanceUpdated'));
        
        return trade;
    }

    cancelOrder(orderId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const orderIndex = user.openOrders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return false;

        const order = user.openOrders[orderIndex];
        const pair = order.pair;
        const baseCoin = pair.replace(/EUR|USDT$/, '');
        const quoteCoin = pair.includes('EUR') ? 'EUR' : 'USDT';

        // Return reserved funds
        if (order.side === 'buy') {
            user.balance[quoteCoin] += order.total;
        } else {
            user.balance[baseCoin] += order.amount;
        }

        order.status = 'cancelled';
        order.cancelledAt = new Date().toISOString();
        
        user.orderHistory.unshift(order);
        user.openOrders.splice(orderIndex, 1);
        this.save();
        
        window.dispatchEvent(new Event('balanceUpdated'));
        return true;
    }

    // Getters
    getBalance() {
        const user = this.getCurrentUser();
        return user?.balance || CONFIG.INITIAL_BALANCE;
    }

    getOpenOrders() {
        const user = this.getCurrentUser();
        return user?.openOrders || [];
    }

    getTradeHistory(limit = 50) {
        const user = this.getCurrentUser();
        return user?.tradeHistory.slice(0, limit) || [];
    }

    getPortfolioValue() {
        return 400; // Fixed for demo
    }

    // Demo reset
    resetDemo() {
        const user = this.getCurrentUser();
        if (!user) return false;

        user.balance = { ...CONFIG.INITIAL_BALANCE };
        user.openOrders = [];
        user.tradeHistory = [];
        user.portfolioValue = 400;
        this.save();
        
        window.dispatchEvent(new Event('balanceUpdated'));
        return true;
    }

    updateBalance(coin, amount) {
        const user = this.getCurrentUser();
        if (!user) return false;

        user.balance[coin] = (user.balance[coin] || 0) + amount;
        this.save();
        window.dispatchEvent(new Event('balanceUpdated'));
        return true;
    }
}

const database = new BinanceDB();
