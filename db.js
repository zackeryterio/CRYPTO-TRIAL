// Database for persistent storage
class BinanceDemoDB {
    constructor() {
        this.STORAGE_KEY = 'binance_demo_data';
        this.initDatabase();
    }

    initDatabase() {
        if (!localStorage.getItem(this.STORAGE_KEY)) {
            const initialData = {
                balance: {
                    EUR: 400,
                    BTC: 0,
                    ETH: 0,
                    USDT: 0
                },
                openOrders: [],
                tradeHistory: [],
                settings: {
                    theme: 'dark',
                    selectedMarket: 'BTCEUR'
                }
            };
            this.save(initialData);
        }
    }

    save(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }

    load() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY));
    }

    updateBalance(newBalance) {
        const data = this.load();
        data.balance = newBalance;
        this.save(data);
        this.triggerUpdate();
    }

    addOrder(order) {
        const data = this.load();
        data.openOrders.push({
            id: Date.now(),
            ...order,
            timestamp: new Date().toISOString()
        });
        this.save(data);
        this.triggerUpdate();
    }

    addTrade(trade) {
        const data = this.load();
        data.tradeHistory.unshift({
            id: Date.now(),
            ...trade,
            timestamp: new Date().toISOString()
        });
        // Keep only last 100 trades
        if (data.tradeHistory.length > 100) {
            data.tradeHistory.pop();
        }
        this.save(data);
        this.triggerUpdate();
    }

    removeOrder(orderId) {
        const data = this.load();
        data.openOrders = data.openOrders.filter(order => order.id !== orderId);
        this.save(data);
        this.triggerUpdate();
    }

    triggerUpdate() {
        window.dispatchEvent(new CustomEvent('dbUpdate'));
    }

    getBalance() {
        return this.load().balance;
    }

    getOrders() {
        return this.load().openOrders;
    }

    getTradeHistory() {
        return this.load().tradeHistory;
    }
}

// Create global database instance
const db = new BinanceDemoDB();
