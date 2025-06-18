class BreakoutAnalyzer {
    constructor() {
        this.ws = null;
        this.cryptoData = new Map();
        this.priceHistory = new Map();
        this.leftBars = 15;
        this.rightBars = 15;
        this.volumeThresh = 20;
        this.updateInterval = null;
        
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.startPeriodicUpdate();
    }

    connectWebSocket() {
        const symbols = [
            'btcusdt', 'ethusdt', 'bnbusdt', 'adausdt', 'xrpusdt',
            'solusdt', 'dotusdt', 'dogeusdt', 'avaxusdt', 'linkusdt',
            'ltcusdt', 'bchusdt', 'xlmusdt', 'vetusdt', 'filusdt',
            'trxusdt', 'etcusdt', 'xmrusdt', 'algousdt', 'atomusdt'
        ];

        const streams = symbols.map(symbol => `${symbol}@ticker`).join('/');
        this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);

        this.ws.onopen = () => {
            this.updateConnectionStatus('متصل', 'connected');
            console.log('WebSocket connected');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.processTicker(data);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('خطأ في الاتصال', 'error');
        };

        this.ws.onclose = () => {
            this.updateConnectionStatus('منقطع', 'error');
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }

    processTicker(ticker) {
        const symbol = ticker.s;
        const price = parseFloat(ticker.c);
        const volume = parseFloat(ticker.v);
        const priceChange = parseFloat(ticker.P);
        const high24h = parseFloat(ticker.h);
        const low24h = parseFloat(ticker.l);

        if (!this.priceHistory.has(symbol)) {
            this.priceHistory.set(symbol, []);
        }

        const history = this.priceHistory.get(symbol);
        history.push({
            price: price,
            volume: volume,
            high: high24h,
            low: low24h,
            timestamp: Date.now()
        });

        if (history.length > 100) {
            history.shift();
        }

        this.cryptoData.set(symbol, {
            symbol: symbol,
            price: price,
            volume: volume,
            priceChange: priceChange,
            high24h: high24h,
            low24h: low24h,
            history: history
        });

        this.analyzeBreakouts();
    }

    calculatePivotHigh(data, index) {
        if (index < this.leftBars || index >= data.length - this.rightBars) {
            return null;
        }

        const currentHigh = data[index].high;
        
        for (let i = index - this.leftBars; i < index + this.rightBars; i++) {
            if (i !== index && data[i].high >= currentHigh) {
                return null;
            }
        }
        
        return currentHigh;
    }

    calculateVolumeOscillator(history) {
        if (history.length < 10) return 0;

        const volumes = history.slice(-10).map(h => h.volume);
        const short = this.ema(volumes.slice(-5), 5);
        const long = this.ema(volumes, 10);
        
        return long > 0 ? 100 * (short - long) / long : 0;
    }

    ema(data, period) {
        if (data.length === 0) return 0;
        
        const multiplier = 2 / (period + 1);
        let ema = data[0];
        
        for (let i = 1; i < data.length; i++) {
            ema = (data[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }

    analyzeBreakouts() {
        const breakouts = [];

        this.cryptoData.forEach((data, symbol) => {
            const history = data.history;
            if (history.length < 50) return;

            const resistanceLevels = this.findResistanceLevels(history);
            const volumeOsc = this.calculateVolumeOscillator(history);
            const currentPrice = data.price;

            resistanceLevels.forEach(resistance => {
                if (currentPrice > resistance && volumeOsc > this.volumeThresh) {
                    const nextTargets = this.calculateTargets(resistance, resistanceLevels);
                    
                    breakouts.push({
                        symbol: symbol.replace('USDT', ''),
                        price: currentPrice,
                        breakoutLevel: resistance,
                        targets: nextTargets,
                        volume: data.volume,
                        volumeOsc: volumeOsc,
                        priceChange: data.priceChange,
                        liquidity: this.calculateLiquidity(data)
                    });
                }
            });
        });

        this.displayBreakouts(breakouts);
    }

    findResistanceLevels(history) {
        const levels = [];
        
        for (let i = this.leftBars; i < history.length - this.rightBars; i++) {
            const pivotHigh = this.calculatePivotHigh(history, i);
            if (pivotHigh) {
                levels.push(pivotHigh);
            }
        }
        
        return levels.sort((a, b) => a - b);
    }

    calculateTargets(breakoutLevel, allLevels) {
        return allLevels
            .filter(level => level > breakoutLevel)
            .slice(0, 3)
            .map(level => level.toFixed(4));
    }

    calculateLiquidity(data) {
        return (data.volume * data.price / 1000000).toFixed(2);
    }

    displayBreakouts(breakouts) {
        const grid = document.getElementById('cryptoGrid');
        
        if (breakouts.length === 0) {
            grid.innerHTML = '<div class="no-data">لا توجد اختراقات صعودية حالياً</div>';
            return;
        }

        const html = breakouts.map(breakout => `
            <div class="crypto-card">
                <div class="card-header">
                    <div class="crypto-name">${breakout.symbol}/USDT</div>
                    <div class="price-change positive">+${breakout.priceChange.toFixed(2)}%</div>
                </div>
                <div class="card-body">
                    <div class="info-row">
                        <span class="info-label">السعر الحالي</span>
                        <span class="info-value">$${breakout.price.toFixed(4)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">مستوى الاختراق</span>
                        <span class="info-value breakout-level">$${breakout.breakoutLevel.toFixed(4)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">الأهداف التالية</span>
                        <span class="info-value targets">${breakout.targets.length > 0 ? breakout.targets.join(' | ') : 'غير محدد'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">الحجم (24س)</span>
                        <span class="info-value volume-info">${this.formatVolume(breakout.volume)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">السيولة</span>
                        <span class="info-value volume-info">$${breakout.liquidity}M</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">مؤشر الحجم</span>
                        <span class="info-value volume-info">${breakout.volumeOsc.toFixed(2)}%</span>
                    </div>
                </div>
            </div>
        `).join('');

        grid.innerHTML = html;
        this.updateLastUpdateTime();
    }

    formatVolume(volume) {
        if (volume >= 1000000) {
            return (volume / 1000000).toFixed(2) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(2) + 'K';
        }
        return volume.toFixed(2);
    }

    updateConnectionStatus(status, className) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = status;
        statusElement.className = `status ${className}`;
    }

    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ar-SA');
        document.getElementById('lastUpdate').textContent = timeString;
    }

    setupEventListeners() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.analyzeBreakouts();
        });
    }

    startPeriodicUpdate() {
        this.updateInterval = setInterval(() => {
            this.analyzeBreakouts();
        }, 30000); // تحديث كل 30 ثانية
    }

    destroy() {
        if (this.ws) {
            this.ws.close();
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// تشغيل التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const analyzer = new BreakoutAnalyzer();
    
    // تنظيف الموارد عند إغلاق الصفحة
    window.addEventListener('beforeunload', () => {
        analyzer.destroy();
    });
});
