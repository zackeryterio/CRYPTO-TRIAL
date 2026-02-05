// Main Application
class BinanceApp {
    constructor() {
        this.db = binanceDB;
        this.auth = auth;
        this.currentUser = null;
        this.currentPair = 'BTCEUR';
        this.currentPrice = 0;
        this.websockets = {};
        this.chartWidget = null;
        this.marketData = {};
        this.watchlistData = {};
        
        this.init();
    }

    init() {
        this.currentUser = this.auth.getUser();
        if (!this.currentUser) return;
        
        this.loadUserData();
        this.loadAllMarkets();
        this.setupWebSockets();
        this.setupEventListeners();
        this.setupTradingViewChart();
        this.startPriceUpdates();
        
        // Listen for database updates
        window.addEventListener('dbUpdate', () => this.onDatabaseUpdate());
        
        // Auto-refresh portfolio
        setInterval(() => this.updatePortfolio(), 5000);
    }

    loadUserData() {
        if (!this.currentUser) return;
        
        // Update UI with user data
        this.updateBalanceDisplay();
        this.updatePortfolioDisplay();
        this.updateWatchlist();
        this.loadOpenOrders();
        this.loadTradeHistory();
    }

    async loadAllMarkets() {
        try {
            // Load all trading pairs from Binance
            const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
            const allMarkets = await response.json();
            
            // Filter and sort
            const eurMarkets = allMarkets
                .filter(m => m.symbol.endsWith('EUR') || m.symbol.endsWith('USDT'))
                .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, 100); // Top 100 by volume
            
            this.marketData = {};
            eurMarkets.forEach(market => {
                this.marketData[market.symbol] = {
                    symbol: market.symbol,
                    price: parseFloat(market.lastPrice),
                    change: parseFloat(market.priceChangePercent),
                    high: parseFloat(market.highPrice),
                    low: parseFloat(market.lowPrice),
                    volume: parseFloat(market.quoteVolume)
                };
            });
            
            this.renderMarketList();
            this.renderWatchlist();
        } catch (error) {
            console.error('Error loading markets:', error);
            // Fallback to static data
            this.loadStaticMarkets();
        }
    }

    loadStaticMarkets() {
        TOP_PAIRS.forEach(pair => {
            const randomChange = (Math.random() * 10) - 5; // -5% to +5%
            this.marketData[pair] = {
                symbol: pair,
                price: 1000 * Math.random(),
                change: randomChange,
                high: 1100,
                low: 900,
                volume: 1000000 * Math.random()
            };
        });
        this.renderMarketList();
    }

    renderMarketList() {
        const container = document.getElementById('market-list');
        if (!container) return;
        
        const markets = Object.values(this.marketData)
            .sort((a, b) => b.volume - a.volume);
        
        container.innerHTML = markets.map(market => `
            <div class="market-item ${market.symbol === this.currentPair ? 'active' : ''}" 
                 data-pair="${market.symbol}"
                 onclick="app.switchPair('${market.symbol}')">
                <div class="market-pair">
                    <span class="market-symbol">${market.symbol}</span>
                </div>
                <div class="market-price">
                    <div class="market-last-price">€${market.price.toFixed(2)}</div>
                    <div class="market-change ${market.change >= 0 ? 'positive' : 'negative'}">
                        ${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)}%
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderWatchlist() {
        const container = document.getElementById('watchlist');
        if (!container || !this.currentUser) return;
        
        const watchlistPairs = this.currentUser.watchlist || [];
        const watchlistData = watchlistPairs
            .map(pair => this.marketData[pair])
            .filter(data => data);
        
        container.innerHTML = watchlistData.map(market => `
            <div class="market-item" data-pair="${market.symbol}"
                 onclick="app.switchPair('${market.symbol}')">
                <div class="market-pair">
                    <span class="market-symbol">${market.symbol}</span>
                </div>
                <div class="market-price">
                    <div class="market-last-price">€${market.price.toFixed(2)}</div>
                    <div class="market-change ${market.change >= 0 ? 'positive' : 'negative'}">
                        ${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)}%
                    </div>
                </div>
            </div>
        `).join('');
    }

    switchPair(pair) {
        this.currentPair = pair;
        
        // Update UI
        document.querySelectorAll('.market-item').forEach(item => {
            item.classList.toggle('active', item.dataset.pair === pair);
        });
        
        // Update pair info
        const market = this.marketData[pair];
        if (market) {
            document.getElementById('current-pair').textContent = pair;
            document.getElementById('current-price').textContent = `€${market.price.toFixed(2)}`;
            
            const changeElement = document.getElementById('price-change');
            changeElement.textContent = `${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)}%`;
            changeElement.className = `price-change ${market.change >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Update chart
        this.updateChart();
        
        // Update order book and trades
        this.setupWebSockets();
    }

    setupTradingViewChart() {
        if (typeof TradingView === 'undefined') {
            // Load TradingView script
            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = () => this.createChartWidget();
            document.head.appendChild(script);
        } else {
            this.createChartWidget();
        }
    }

    createChartWidget() {
        if (!window.TradingView || this.chartWidget) return;
        
        const symbol = this.getTradingViewSymbol();
        
        this.chartWidget = new TradingView.widget({
            container_id: "tradingview-chart",
            width: "100%",
            height: "100%",
            symbol: symbol,
            interval: "15",
            timezone: "exchange",
            theme: "dark",
            style: "1",
            locale: "en",
            toolbar_bg: "#1e2329",
            enable_publishing: false,
            hide_side_toolbar: false,
            allow_symbol_change: false,
            details: true,
            hotlist: true,
            calendar: true,
            studies: [
                "Volume@tv-basicstudies",
                "MovingAverage@tv-basicstudies",
                "RSI@tv-basicstudies"
            ],
            show_popup_button: true,
            popup_width: "1000",
            popup_height: "650"
        });
    }

    getTradingViewSymbol() {
        // Convert Binance symbol to TradingView format
        const pair = this.currentPair;
        const base = pair.replace(/EUR|USDT$/, '');
        const quote = pair.includes('EUR') ? 'EUR' : 'USD';
        return `BINANCE:${base}${quote}`;
    }

    updateChart() {
        if (!this.chartWidget) return;
        
        // TradingView widget doesn't support dynamic symbol changes easily
        // We'll need to recreate the widget
        if (this.chartWidget) {
            this.chartWidget.remove();
            this.chartWidget = null;
        }
        setTimeout(() => this.createChartWidget(), 100);
    }

    setupWebSockets() {
        const symbol = this.currentPair.toLowerCase();
        
        // Close existing connections
        Object.values(this.websockets).forEach(ws => ws.close());
        this.websockets = {};
        
        // Ticker WebSocket
        this.websockets.ticker = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@ticker`);
        this.websockets.ticker.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.updatePrice(data);
        };
        
        // Depth WebSocket (Order Book)
        this.websockets.depth = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@depth20@100ms`);
        this.websockets.depth.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.updateOrderBook(data);
        };
        
        // Trade WebSocket
        this.websockets.trades = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);
        this.websockets.trades.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.updateRecentTrades(data);
        };
    }

    updatePrice(data) {
        this.currentPrice = parseFloat(data.c);
        const changePercent = parseFloat(data.P);
        
        // Update UI
        const priceElement = document.getElementById('current-price');
        const changeElement = document.getElementById('price-change');
        
        if (priceElement) {
            priceElement.textContent = `€${this.currentPrice.toFixed(2)}`;
        }
        
        if (changeElement) {
            changeElement.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
            changeElement.className = `price-change ${changePercent >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Update market data
        if (this.marketData[this.currentPair]) {
            this.marketData[this.currentPair].price = this.currentPrice;
            this.marketData[this.currentPair].change = changePercent;
        }
        
        // Update order total
        this.updateOrderTotal();
    }

    updateOrderBook(data) {
        const container = document.getElementById('order-book');
        if (!container) return;
        
        const bids = data.bids.slice(0, 15).map(b => ({
            price: parseFloat(b[0]),
            amount: parseFloat(b[1])
        }));
        
        const asks = data.asks.slice(0, 15).map(a => ({
            price: parseFloat(a[0]),
            amount: parseFloat(a[1])
        })).reverse();
        
        let html = '';
        
        // Asks (red)
        asks.forEach(ask => {
            const total = ask.price * ask.amount;
            html += `
                <div class="order-book-row ask" onclick="app.setOrderPrice(${ask.price})">
                    <span class="order-price ask">€${ask.price.toFixed(2)}</span>
                    <span>${ask.amount.toFixed(6)}</span>
                    <span>€${total.toFixed(2)}</span>
                </div>
            `;
        });
        
        // Spread
        if (asks.length > 0 && bids.length > 0) {
            const spread = asks[asks.length - 1].price - bids[0].price;
            const spreadPercent = (spread / bids[0].price) * 100;
            html += `
                <div class="order-book-row spread">
                    <span>Spread: €${spread.toFixed(2)} (${spreadPercent.toFixed(2)}%)</span>
                </div>
            `;
        }
        
        // Bids (green)
        bids.forEach(bid => {
            const total = bid.price * bid.amount;
            html += `
                <div class="order-book-row bid" onclick="app.setOrderPrice(${bid.price})">
                    <span class="order-price bid">€${bid.price.toFixed(2)}</span>
                    <span>${bid.amount.toFixed(6)}</span>
                    <span>€${total.toFixed(2)}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    updateRecentTrades(data) {
        const container = document.getElementById('recent-trades');
        if (!container) return;
        
        const trade = {
            price: parseFloat(data.p),
            amount: parseFloat(data.q),
            time: new Date(data.T).toLocaleTimeString(),
            isBuyerMaker: data.m
        };
        
        const tradeElement = document.createElement('div');
        tradeElement.className = `trade-row ${trade.isBuyerMaker ? 'sell' : 'buy'}`;
        tradeElement.innerHTML = `
            <span>€${trade.price.toFixed(2)}</span>
            <span>${trade.amount.toFixed(6)}</span>
            <span>${trade.time}</span>
        `;
        
        container.insertBefore(tradeElement, container.firstChild);
        
        // Keep only last 20 trades
        if (container.children.length > 20) {
            container.removeChild(container.lastChild);
        }
    }

    setupEventListeners() {
        // Buy/Sell buttons
        document.getElementById('buy-btn')?.addEventListener('click', () => this.placeOrder('buy'));
        document.getElementById('sell-btn')?.addEventListener('click', () => this.placeOrder('sell'));
        
        // Order form inputs
        document.getElementById('order-price')?.addEventListener('input', () => this.updateOrderTotal());
        document.getElementById('order-amount')?.addEventListener('input', () => this.updateOrderTotal());
        document.getElementById('order-total')?.addEventListener('input', () => this.updateOrderAmount());
        
        // Order type tabs
        document.querySelectorAll('.order-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                this.switchOrderType(type);
            });
        });
        
        // Time intervals
        document.querySelectorAll('.time-interval').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const interval = e.target.dataset.interval;
                this.switchTimeInterval(interval);
            });
        });
        
        // Percentage buttons
        document.querySelectorAll('.percent-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const percent = parseFloat(e.target.dataset.percent) / 100;
                this.setOrderAmountByPercent(percent);
            });
        });
        
        // Logout button
        document.getElementById('logout-btn')?.addEventListener('click', () => this.auth.logout());
    }

    switchOrderType(type) {
        document.querySelectorAll('.order-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });
        
        // Show/hide relevant inputs
        const isLimit = type === 'limit';
        document.getElementById('order-price-container').style.display = isLimit ? 'block' : 'none';
        
        if (type === 'market') {
            document.getElementById('order-price').value = this.currentPrice;
            this.updateOrderTotal();
        }
    }

    switchTimeInterval(interval) {
        document.querySelectorAll('.time-interval').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.interval === interval);
        });
        
        // Update TradingView chart interval
        if (this.chartWidget) {
            this.chartWidget.chart().setResolution(interval);
        }
    }

    updateOrderTotal() {
        const price = parseFloat(document.getElementById('order-price')?.value) || this.currentPrice;
        const amount = parseFloat(document.getElementById('order-amount')?.value) || 0;
        const total = price * amount;
        
        const totalElement = document.getElementById('order-total');
        if (totalElement) {
            totalElement.value = total.toFixed(2);
        }
        
        // Update fee display
        const fee = total * CONFIG.FEES.TAKER;
        const feeElement = document.getElementById('order-fee');
        if (feeElement) {
            feeElement.textContent = `€${fee.toFixed(2)}`;
        }
    }

    updateOrderAmount() {
        const price = parseFloat(document.getElementById('order-price')?.value) || this.currentPrice;
        const total = parseFloat(document.getElementById('order-total')?.value) || 0;
        const amount = total / price;
        
        const amountElement = document.getElementById('order-amount');
        if (amountElement) {
            amountElement.value = amount.toFixed(6);
        }
    }

    setOrderAmountByPercent(percent) {
        if (!this.currentUser) return;
        
        const pair = this.currentPair;
        const baseCoin = pair.replace(/EUR|USDT$/, '');
        const quoteCoin = pair.includes('EUR') ? 'EUR' : 'USDT';
        
        const orderType = document.querySelector('.order-tab.active')?.dataset.type;
        const price = parseFloat(document.getElementById('order-price')?.value) || this.currentPrice;
        
        let amount = 0;
        
        if (orderType === 'buy') {
            const balance = this.currentUser.balance[quoteCoin] || 0;
            const maxAmount = balance / price;
            amount = maxAmount * percent;
        } else {
            const balance = this.currentUser.balance[baseCoin] || 0;
            amount = balance * percent;
        }
        
        const amountElement = document.getElementById('order-amount');
        if (amountElement) {
            amountElement.value = amount.toFixed(6);
            this.updateOrderTotal();
        }
    }

    setOrderPrice(price) {
        const priceElement = document.getElementById('order-price');
        if (priceElement) {
            priceElement.value = price.toFixed(2);
            this.updateOrderTotal();
        }
    }

    async placeOrder(side) {
        if (!this.currentUser) return;
        
        const orderType = document.querySelector('.order-tab.active')?.dataset.type || 'limit';
        const price = parseFloat(document.getElementById('order-price')?.value) || this.currentPrice;
        const amount = parseFloat(document.getElementById('order-amount')?.value);
        
        if (!amount || amount <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }
        
        const total = price * amount;
        const pair = this.currentPair;
        const baseCoin = pair.replace(/EUR|USDT$/, '');
        const quoteCoin = pair.includes('EUR') ? 'EUR' : 'USDT';
        
        // Validation
        if (side === 'buy') {
            if (total > (this.currentUser.balance[quoteCoin] || 0)) {
                this.showToast(`Insufficient ${quoteCoin} balance`, 'error');
                return;
            }
        } else {
            if (amount > (this.currentUser.balance[baseCoin] || 0)) {
                this.showToast(`Insufficient ${baseCoin} balance`, 'error');
                return;
            }
        }
        
        // Create order
        const order = {
            pair: pair,
            side: side,
            type: orderType,
            price: price,
            amount: amount,
            total: total,
            timestamp: new Date().toISOString()
        };
        
        const orderId = this.db.placeOrder(this.currentUser.id, order);
        
        this.showToast(`Order placed: ${side.toUpperCase()} ${amount} ${pair}`, 'success');
        
        // Clear form
        document.getElementById('order-amount').value = '';
        document.getElementById('order-total').value = '';
        
        // Update UI
        this.updateBalanceDisplay();
        this.loadOpenOrders();
    }

    cancelOrder(orderId) {
        if (!this.currentUser) return;
        
        const success = this.db.cancelOrder(this.currentUser.id, orderId);
        if (success) {
            this.showToast('Order cancelled', 'success');
            this.loadOpenOrders();
        }
    }

    updateBalanceDisplay() {
        if (!this.currentUser) return;
        
        const balance = this.currentUser.balance;
        
        // Update header balance
        document.getElementById('eur-balance')?.textContent = `€${balance.EUR?.toFixed(2) || '0.00'}`;
        document.getElementById('btc-balance')?.textContent = `${balance.BTC?.toFixed(6) || '0.000000'}`;
        document.getElementById('usdt-balance')?.textContent = `${balance.USDT?.toFixed(2) || '0.00'}`;
        
        // Update order form balance
        const pair = this.currentPair;
        const baseCoin = pair.replace(/EUR|USDT$/, '');
        const quoteCoin = pair.includes('EUR') ? 'EUR' : 'USDT';
        
        document.getElementById('buy-balance')?.textContent = `${balance[quoteCoin]?.toFixed(2) || '0.00'} ${quoteCoin}`;
        document.getElementById('sell-balance')?.textContent = `${balance[baseCoin]?.toFixed(6) || '0.000000'} ${baseCoin}`;
    }

    updatePortfolioDisplay() {
        if (!this.currentUser) return;
        
        const portfolio = this.db.getPortfolio(this.currentUser.id);
        
        document.getElementById('portfolio-total')?.textContent = `€${portfolio.totalValue?.toFixed(2) || '0.00'}`;
        document.getElementById('portfolio-change')?.textContent = `€${portfolio.dayChange?.toFixed(2) || '0.00'}`;
        
        // Update assets page if open
        this.renderAssets();
    }

    updatePortfolio() {
        if (!this.currentUser) return;
        this.db.updatePortfolio(this.currentUser.id);
        this.updatePortfolioDisplay();
    }

    loadOpenOrders() {
        if (!this.currentUser) return;
        
        const orders = this.db.getOpenOrders(this.currentUser.id);
        const container = document.getElementById('open-orders');
        
        if (!container) return;
        
        if (orders.length === 0) {
            container.innerHTML = '<div class="empty-state">No open orders</div>';
            return;
        }
        
        container.innerHTML = orders.map(order => `
            <tr>
                <td>${new Date(order.timestamp).toLocaleString()}</td>
                <td>${order.pair}</td>
                <td class="${order.side === 'buy' ? 'text-success' : 'text-danger'}">
                    ${order.side.toUpperCase()}
                </td>
                <td>${order.type}</td>
                <td>${order.amount}</td>
                <td>€${order.price.toFixed(2)}</td>
                <td>€${(order.price * order.amount).toFixed(2)}</td>
                <td><span class="order-status ${order.status}">${order.status}</span></td>
                <td>
                    <button class="cancel-order-btn" onclick="app.cancelOrder('${order.id}')">
                        Cancel
                    </button>
                </td>
            </tr>
        `).join('');
    }

    loadTradeHistory() {
        if (!this.currentUser) return;
        
        const trades = this.db.getTradeHistory(this.currentUser.id);
        const container = document.getElementById('trade-history');
        
        if (!container) return;
        
        if (trades.length === 0) {
            container.innerHTML = '<div class="empty-state">No trade history</div>';
            return;
        }
        
        container.innerHTML = trades.map(trade => `
            <tr>
                <td>${new Date(trade.timestamp).toLocaleString()}</td>
                <td>${trade.pair}</td>
                <td class="${trade.side === 'buy' ? 'text-success' : 'text-danger'}">
                    ${trade.side.toUpperCase()}
                </td>
                <td>${trade.amount}</td>
                <td>€${trade.price.toFixed(2)}</td>
                <td>€${trade.total.toFixed(2)}</td>
                <td>€${trade.fee?.toFixed(2) || '0.00'}</td>
            </tr>
        `).join('');
    }

    renderAssets() {
        const container = document.getElementById('assets-list');
        if (!container || !this.currentUser) return;
        
        const portfolio = this.db.getPortfolio(this.currentUser.id);
        const assets = portfolio.assets || [];
        
        if (assets.length === 0) {
            container.innerHTML = '<div class="empty-state">No assets</div>';
            return;
        }
        
        container.innerHTML = assets.map(asset => `
            <div class="asset-card">
                <div class="asset-header">
                    <div class="asset-name">
                        <div class="asset-icon">${asset.coin.charAt(0)}</div>
                        <div>
                            <div class="asset-symbol">${asset.coin}</div>
                            <div class="asset-full-name">${asset.coin}</div>
                        </div>
                    </div>
                    <div class="asset-price">€${asset.value.toFixed(2)}</div>
                </div>
                <div class="asset-details">
                    <div class="detail-item">
                        <div class="detail-label">Balance</div>
                        <div class="detail-value">${asset.balance.toFixed(6)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Price</div>
                        <div class="detail-value">€${asset.price.toFixed(2)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Allocation</div>
                        <div class="detail-value">${asset.allocation.toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateWatchlist() {
        if (!this.currentUser) return;
        
        const watchlist = this.currentUser.watchlist || [];
        const container = document.getElementById('watchlist');
        
        if (!container) return;
        
        container.innerHTML = watchlist.map(pair => {
            const market = this.marketData[pair];
            if (!market) return '';
            
            return `
                <div class="market-item" onclick="app.switchPair('${pair}')">
                    <div class="market-pair">${pair}</div>
                    <div class="market-price">
                        <div>€${market.price.toFixed(2)}</div>
                        <div class="${market.change >= 0 ? 'text-success' : 'text-danger'}">
                            ${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)}%
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    addToWatchlist(pair) {
        if (!this.currentUser) return;
        this.db.addToWatchlist(this.currentUser.id, pair);
        this.updateWatchlist();
    }

    removeFromWatchlist(pair) {
        if (!this.currentUser) return;
        this.db.removeFromWatchlist(this.currentUser.id, pair);
        this.updateWatchlist();
    }

    startPriceUpdates() {
        // Update prices every 5 seconds
        setInterval(() => {
            this.updateAllPrices();
        }, 5000);
    }

    async updateAllPrices() {
        try {
            const response = await fetch('https://api.binance.com/api/v3/ticker/price');
            const prices = await response.json();
            
            prices.forEach(item => {
                if (this.marketData[item.symbol]) {
                    this.marketData[item.symbol].price = parseFloat(item.price);
                }
            });
            
            this.renderMarketList();
            this.renderWatchlist();
            this.updatePortfolioDisplay();
        } catch (error) {
            console.error('Error updating prices:', error);
        }
    }

    onDatabaseUpdate() {
        this.currentUser = this.auth.getUser();
        if (!this.currentUser) return;
        
        this.updateBalanceDisplay();
        this.updatePortfolioDisplay();
        this.loadOpenOrders();
        this.loadTradeHistory();
        this.renderAssets();
    }

    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${type === 'success' ? '#0ecb81' : type === 'error' ? '#f6465d' : '#2b3139'};
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Admin functions for demo
    resetDemo() {
        if (!this.currentUser) return;
        
        if (confirm('Are you sure you want to reset your demo account? All trades and balances will be reset to initial values.')) {
            this.db.resetDemo(this.currentUser.id);
            this.showToast('Demo account reset successfully', 'success');
            setTimeout(() => location.reload(), 1000);
        }
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new BinanceApp();
});
