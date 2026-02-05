class BinanceWebSocket {
    constructor() {
        this.connections = {};
        this.priceData = {};
        this.subscribers = {};
    }

    connect(pair, callback) {
        const symbol = pair.toLowerCase();
        
        if (this.connections[pair]) {
            this.connections[pair].close();
        }

        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@ticker`);
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            // Update price data
            this.priceData[pair] = {
                price: parseFloat(data.c),
                change: parseFloat(data.P),
                volume: parseFloat(data.v),
                high: parseFloat(data.h),
                low: parseFloat(data.l)
            };
            
            // Notify callback
            if (callback) callback(data);
            
            // Notify subscribers
            if (this.subscribers[pair]) {
                this.subscribers[pair].forEach(cb => cb(data));
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            delete this.connections[pair];
        };

        this.connections[pair] = ws;
        return ws;
    }

    subscribe(pair, callback) {
        if (!this.subscribers[pair]) {
            this.subscribers[pair] = [];
        }
        this.subscribers[pair].push(callback);
        
        // Connect if not already connected
        if (!this.connections[pair]) {
            this.connect(pair, callback);
        }
    }

    unsubscribe(pair, callback) {
        if (this.subscribers[pair]) {
            this.subscribers[pair] = this.subscribers[pair].filter(cb => cb !== callback);
        }
    }

    disconnect(pair) {
        if (this.connections[pair]) {
            this.connections[pair].close();
            delete this.connections[pair];
            delete this.subscribers[pair];
        }
    }

    getPrice(pair) {
        return this.priceData[pair]?.price || 0;
    }

    getChange(pair) {
        return this.priceData[pair]?.change || 0;
    }

    getAllPrices() {
        return this.priceData;
    }
}

const ws = new BinanceWebSocket();
