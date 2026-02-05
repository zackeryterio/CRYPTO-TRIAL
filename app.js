class BinanceApp {
    constructor() {
        this.db = database;
        this.ws = ws;
        this.currentUser = null;
        this.currentPair = 'BTCEUR';
        this.currentPrice = 0;
        this.marketData = {};
        this.chart = null;
        this.allCoins = [];
        
        this.init();
    }

    async init() {
        // Check authentication
        this.currentUser = this.db.getCurrentUser();
        
        if (!this.currentUser && !window.location.href.includes('login.html')) {
            window.location.href = 'login.html';
            return;
        }
        
        if (this.currentUser && window.location.href.includes('login.html')) {
            window.location.href = 'index.html';
            return;
        }

        // Load all market data
        await this.loadAllMarkets();
        
        // Setup WebSocket for current pair
        this.setupWebSocket();
        
        // Initialize UI
        this.updateUI();
        this.setupEventListeners();
        
        // Listen for balance updates
        window.addEventListener('balanceUpdated', () => this.updateUI());
    }

    async loadAllMarkets() {
        try {
            console.log('Loading all Binance markets...');
            
            // Get ALL trading pairs
            const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
            const allTickers = await response.json();
            
            console.log(`Found ${allTickers.length} markets`);
            
            // Filter for EUR pairs
            const eurMarkets = allTickers
                .filter(ticker => ticker.symbol.endsWith('EUR'))
                .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, 200); // Top 200 by volume
            
            // Store in memory
            this.marketData = {};
            eurMarkets.forEach(ticker => {
                this.marketData[ticker.symbol] = {
                    symbol: ticker.symbol,
                    price: parseFloat(ticker.lastPrice),
                    change: parseFloat(ticker.priceChangePercent),
                    volume: parseFloat(ticker.quoteVolume),
                    high: parseFloat(ticker.highPrice),
                    low: parseFloat(ticker.lowPrice)
                };
            });
            
            // Update UI if on markets page
            if (document.getElementById('marketsList')) {
                this.renderMarkets();
            }
            
            // Update watchlist
            if (document.getElementById('watchlist')) {
                this.renderWatchlist();
            }
            
        } catch (error) {
            console.error('Error loading markets:', error);
            this.loadFallbackMarkets();
        }
    }

    loadFallbackMarkets() {
        // Fallback data with top 50 coins
        const fallbackPairs = [
            'BTCEUR', 'ETHEUR', 'BNBEUR', 'ADAEUR', 'XRPEUR', 'SOLEUR', 'DOTEUR', 'DOGEEUR',
            'MATICEUR', 'SHIBEUR', 'TRXEUR', 'LTCEUR', 'UNIEUR', 'ATOMEUR', 'LINKEUR',
            'XLMEUR', 'ETCEUR', 'BCHEUR', 'XMREUR', 'VETEUR', 'FILEUR', 'THETAEUR',
            'AXSEUR', 'FTMEUR', 'AAVEEUR', 'ALGOEUR', 'SANDEUR', 'MANAEUR', 'GALAEUR',
            'KLAYEUR', 'FLOWEUR', 'XTZEUR', 'CHZEUR', 'CRVEUR', 'KSMEUR', 'AREUR',
            'ONEEUR', 'BATEUR', 'ENJEUR', 'SNXEUR', 'COMPEUR', 'YFIEUR', 'MKREUR',
            'ZILEUR', 'IOTAEUR', 'WAVESEUR', 'OMGEUR', 'QTUMEUR', 'RVNEUR', 'SCEUR'
        ];
        
        this.marketData = {};
        fallbackPairs.forEach(symbol => {
            const price = Math.random() * 1000 + 10;
            const change = (Math.random() * 20) - 10;
            
            this.marketData[symbol] = {
                symbol: symbol,
                price: price,
                change: change,
                volume: Math.random() * 1000000,
                high: price * 1.05,
                low: price * 0.95
            };
        });
        
        if (document.getElementById('marketsList')) {
            this.renderMarkets();
        }
    }

    renderMarkets() {
        const container = document.getElementById('marketsList');
        if (!container) return;
        
        const markets = Object.values(this.marketData)
            .sort((a, b) => b.volume - a.volume);
        
        container.innerHTML = markets.map(market => `
            <div class="market-item" data-pair="${market.symbol}" onclick="app.selectPair('${market.symbol}')">
                <div class="market-info">
                    <div class="market-symbol">${market.symbol}</div>
                    <div class="market-name">${market.symbol.replace('EUR', '')}/EUR</div>
                </div>
                <div class="market-price">
                    <div class="price">€${market.price.toFixed(2)}</div>
                    <div class="change ${market.change >= 0 ? 'positive' : 'negative'}">
                        ${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)}%
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderWatchlist() {
        const user = this.db.getCurrentUser();
        if (!user) return;
        
        const container = document.getElementById('watchlist');
        if (!container) return;
        
        const watchlist = user.watchlist || [];
        
        container.innerHTML = watchlist.map(pair => {
            const market = this.marketData[pair];
            if (!market) return '';
            
            return `
                <div class="market-item" data-pair="${pair}" onclick="app.selectPair('${pair}')">
                    <div class="market-info">
                        <div class="market-symbol">${pair}</div>
                        <div class="market-name">${pair.replace('EUR', '')}/EUR</div>
                    </div>
                    <div class="market-price">
                        <div class="price">€${market.price.toFixed(2)}</div>
                        <div class="change ${market.change >= 0 ? 'positive' : 'negative'}">
                            ${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)}%
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    setupWebSocket() {
        // Connect to current pair
        this.ws.connect(this.currentPair, (data) => {
            this.currentPrice = parseFloat(data.c);
            this.updatePriceDisplay();
            this.updateOrderTotal();
        });
    }

    selectPair(pair) {
        this.currentPair = pair;
        
        // Update WebSocket connection
        this.ws.disconnect(this.currentPair);
        this.setupWebSocket();
        
        // Update UI
        this.updatePairDisplay();
        
        // If on trading page, update chart
        if (this.chart) {
            this.updateChart();
        }
    }

    updatePairDisplay() {
        const market = this.marketData[this.currentPair];
        if (!market) return;
        
        document.getElementById('currentPair').textContent = `${this.currentPair.replace('EUR', '')}/EUR`;
        document.getElementById('currentPrice').textContent = `€${market.price.toFixed(2)}`;
        
        const changeElement = document.getElementById('priceChange');
        changeElement.textContent = `${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)}%`;
        changeElement.className = `change ${market.change >= 0 ? 'positive' : 'negative'}`;
    }

    updatePriceDisplay() {
        document.getElementById('currentPrice').textContent = `€${this.currentPrice.toFixed(2)}`;
        document.getElementById('orderPrice').value = this.currentPrice.toFixed(2);
    }

    setupEventListeners() {
        // Buy/Sell buttons
        document.getElementById('buyButton')?.addEventListener('click', () => this.placeOrder('buy'));
        document.getElementById('sellButton')?.addEventListener('click', () => this.placeOrder('sell'));
        
        // Order form inputs
        document.getElementById('orderAmount')?.addEventListener('input', () => this.updateOrderTotal());
        document.getElementById('orderPrice')?.addEventListener('input', () => this.updateOrderTotal());
        
        // Percentage buttons
        document.querySelectorAll('.percent-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const percent = parseFloat(e.target.dataset.percent) / 100;
                this.setOrderAmount(percent);
            });
        });
        
        // Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const page = e.target.dataset.page;
                this.switchPage(page);
            });
        });
        
        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.db.logout();
            window.location.href = 'login.html';
        });
    }

    setOrderAmount(percent) {
        const user = this.db.getCurrentUser();
        if (!user) return;
        
        const pair = this.currentPair;
        const baseCoin = pair.replace('EUR', '');
        const quoteCoin = 'EUR';
        const price = this.currentPrice || this.marketData[pair]?.price || 1;
        
        const orderType = document.querySelector('.order-tab.active')?.dataset.type || 'limit';
        const side = orderType === 'buy' ? 'buy' : 'sell';
        
        let amount = 0;
        
        if (side === 'buy') {
            const balance = user.balance[quoteCoin] || 0;
            const maxAmount = balance / price;
            amount = maxAmount * percent;
        } else {
            const balance = user.balance[baseCoin] || 0;
            amount = balance * percent;
        }
        
        document.getElementById('orderAmount').value = amount.toFixed(6);
        this.updateOrderTotal();
    }

    updateOrderTotal() {
        const price = parseFloat(document.getElementById('orderPrice')?.value) || this.currentPrice || 0;
        const amount = parseFloat(document.getElementById('orderAmount')?.value) || 0;
        const total = price * amount;
        
        document.getElementById('orderTotal').textContent = `€${total.toFixed(2)}`;
    }

    placeOrder(side) {
        const user = this.db.getCurrentUser();
        if (!user) {
            alert('Please login first');
            return;
        }
        
        const amount = parseFloat(document.getElementById('orderAmount').value);
        const price = parseFloat(document.getElementById('orderPrice').value) || this.currentPrice;
        
        if (!amount || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        
        if (price <= 0) {
            alert('Please enter a valid price');
            return;
        }
        
        const total = price * amount;
        const pair = this.currentPair;
        const baseCoin = pair.replace('EUR', '');
        
        // Validate balance
        if (side === 'buy') {
            if (total > (user.balance.EUR || 0)) {
                alert('Insufficient EUR balance');
                return;
            }
        } else {
            if (amount > (user.balance[baseCoin] || 0)) {
                alert(`Insufficient ${baseCoin} balance`);
                return;
            }
        }
        
        // Place order
        const orderData = {
            pair: pair,
            side: side,
            type: 'limit',
            price: price,
            amount: amount
        };
        
        const orderId = this.db.placeOrder(orderData);
        
        if (orderId) {
            alert(`Order placed successfully!`);
            document.getElementById('orderAmount').value = '';
            this.updateOrderTotal();
        } else {
            alert('Failed to place order');
        }
    }

    updateUI() {
        const user = this.db.getCurrentUser();
        if (!user) return;
        
        // Update balance display
        document.getElementById('eurBalance')?.textContent = `€${(user.balance.EUR || 0).toFixed(2)}`;
        document.getElementById('btcBalance')?.textContent = `${(user.balance.BTC || 0).toFixed(6)}`;
        document.getElementById('ethBalance')?.textContent = `${(user.balance.ETH || 0).toFixed(4)}`;
        
        // Update portfolio
        document.getElementById('portfolioValue')?.textContent = `€${user.portfolioValue.toFixed(2)}`;
        
        // Update assets list
        this.renderAssets();
        
        // Update open orders
        this.renderOpenOrders();
        
        // Update trade history
        this.renderTradeHistory();
    }

    renderAssets() {
        const container = document.getElementById('assetsList');
        if (!container) return;
        
        const user = this.db.getCurrentUser();
        if (!user) return;
        
        const assets = Object.entries(user.balance)
            .filter(([coin, amount]) => amount > 0)
            .map(([coin, amount]) => {
                const market = this.marketData[`${coin}EUR`];
                const price = market?.price || 1;
                const value = amount * price;
                
                return { coin, amount, price, value };
            })
            .sort((a, b) => b.value - a.value);
        
        container.innerHTML = assets.map(asset => `
            <div class="asset-item">
                <div class="asset-info">
                    <div class="asset-symbol">${asset.coin}</div>
                    <div class="asset-name">${asset.coin}</div>
                </div>
                <div class="asset-details">
                    <div class="asset-amount">${asset.amount.toFixed(6)}</div>
                    <div class="asset-value">€${asset.value.toFixed(2)}</div>
                </div>
            </div>
        `).join('');
    }

    renderOpenOrders() {
        const container = document.getElementById('openOrdersList');
        if (!container) return;
        
        const orders = this.db.getOpenOrders();
        
        if (orders.length === 0) {
            container.innerHTML = '<div class="empty">No open orders</div>';
            return;
        }
        
        container.innerHTML = orders.map(order => `
            <div class="order-item">
                <div class="order-header">
                    <span class="order-pair">${order.pair}</span>
                    <span class="order-side ${order.side}">${order.side.toUpperCase()}</span>
                </div>
                <div class="order-details">
                    <div>Price: €${order.price.toFixed(2)}</div>
                    <div>Amount: ${order.amount.toFixed(6)}</div>
                    <div>Total: €${order.total.toFixed(2)}</div>
                </div>
                <button class="cancel-btn" onclick="app.cancelOrder('${order.id}')">Cancel</button>
            </div>
        `).join('');
    }

    renderTradeHistory() {
        const container = document.getElementById('tradeHistoryList');
        if (!container) return;
        
        const trades = this.db.getTradeHistory(20);
        
        if (trades.length === 0) {
            container.innerHTML = '<div class="empty">No trade history</div>';
            return;
        }
        
        container.innerHTML = trades.map(trade => `
            <div class="trade-item">
                <div class="trade-header">
                    <span class="trade-pair">${trade.pair}</span>
                    <span class="trade-side ${trade.side}">${trade.side.toUpperCase()}</span>
                    <span class="trade-time">${new Date(trade.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="trade-details">
                    <div>Price: €${trade.price.toFixed(2)}</div>
                    <div>Amount: ${trade.amount.toFixed(6)}</div>
                    <div>Total: €${trade.total.toFixed(2)}</div>
                    <div>Fee: €${trade.fee.toFixed(2)}</div>
                </div>
            </div>
        `).join('');
    }

    cancelOrder(orderId) {
        if (confirm('Are you sure you want to cancel this order?')) {
            const success = this.db.cancelOrder(orderId);
            if (success) {
                alert('Order cancelled');
                this.updateUI();
            }
        }
    }

    switchPage(page) {
        window.location.href = `${page}.html`;
    }

    resetDemo() {
        if (confirm('Reset demo account? All trades and balances will be reset to initial values.')) {
            this.db.resetDemo();
            alert('Demo account reset successfully!');
        }
    }
}

// Global app instance
const app = new BinanceApp();
