class LuxAlgoBreakoutAnalyzer {
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
        const open = parseFloat(ticker.o);

        if (!this.priceHistory.has(symbol)) {
            this.priceHistory.set(symbol, []);
        }
        const history = this.priceHistory.get(symbol);

        // Binance Ticker لا يحتوي على high/low لكل شمعة؛ سنقدرها من 24h أو نعيد استخدام آخر قيم:
        const last = history.length ? history[history.length - 1] : {};
        history.push({
            open: last.close || open,
            high: high24h,
            low: low24h,
            close: price,
            volume: volume,
            timestamp: Date.now()
        });
        if (history.length > 200) {
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

        this.analyzeLuxAlgoBreaks();
    }

    // EMA Function
    ema(data, period) {
        if (data.length < period) return 0;
        const multiplier = 2 / (period + 1);
        let ema = data[data.length - period];
        for (let i = data.length - period + 1; i < data.length; i++) {
            ema = (data[i] - ema) * multiplier + ema;
        }
        return ema;
    }

    // Pivot High
    getPivotHigh(data, idx, left = this.leftBars, right = this.rightBars) {
        if (idx < left || idx > data.length - right - 1) return null;
        const curr = data[idx].high;
        for (let i = idx - left; i <= idx + right; i++) {
            if (i !== idx && data[i].high >= curr) return null;
        }
        return curr;
    }

    // Pivot Low
    getPivotLow(data, idx, left = this.leftBars, right = this.rightBars) {
        if (idx < left || idx > data.length - right - 1) return null;
        const curr = data[idx].low;
        for (let i = idx - left; i <= idx + right; i++) {
            if (i !== idx && data[i].low <= curr) return null;
        }
        return curr;
    }

    detectLuxAlgoBreaks(history) {
        const signals = [];
        const volumes = history.map(h => h.volume);
        for (let i = this.leftBars; i < history.length - this.rightBars; i++) {
            const highPivot = this.getPivotHigh(history, i);
            const lowPivot = this.getPivotLow(history, i);

            const idx = i + 1;
            if (idx >= history.length) break;

            const bar = history[idx];
            const oscShort = this.ema(volumes.slice(0, idx + 1), 5);
            const oscLong = this.ema(volumes.slice(0, idx + 1), 10);
            const osc = oscLong > 0 ? 100 * (oscShort - oscLong) / oscLong : 0;

            // Break Resistance (green)
            if (
                highPivot !== null &&
                bar.close > highPivot &&
                !(bar.open - bar.low > bar.close - bar.open) &&
                osc > this.volumeThresh
            ) {
                signals.push({ type: "BreakResistance", idx, price: bar.close, osc, level: highPivot });
            }
            // Break Support (red)
            if (
                lowPivot !== null &&
                bar.close < lowPivot &&
                !(bar.open - bar.close < bar.high - bar.open) &&
                osc > this.volumeThresh
            ) {
                signals.push({ type: "BreakSupport", idx, price: bar.close, osc, level: lowPivot });
            }
            // Bull Wick
            if (
                highPivot !== null &&
                bar.close > highPivot &&
                (bar.open - bar.low > bar.close - bar.open)
            ) {
                signals.push({ type: "BullWick", idx, price: bar.close, level: highPivot });
            }
            // Bear Wick
            if (
                lowPivot !== null &&
                bar.close < lowPivot &&
                (bar.open - bar.close < bar.high - bar.open)
            ) {
                signals.push({ type: "BearWick", idx, price: bar.close, level: lowPivot });
            }
        }
        return signals;
    }

    analyzeLuxAlgoBreaks() {
        const allSignals = [];
        this.cryptoData.forEach((data, symbol) => {
            const history = data.history;
            if (history.length < 50) return;
            const signals = this.detectLuxAlgoBreaks(history);
            signals.forEach(sig => {
                allSignals.push({
                    symbol: symbol.replace('USDT', ''),
                    ...sig
                });
            });
        });
        this.displayLuxAlgoSignals(allSignals);
    }

    displayLuxAlgoSignals(signals) {
        const grid = document.getElementById('cryptoGrid');
        if (!grid) return;
        if (signals.length === 0) {
            grid.innerHTML = '<div class="no-data">لا يوجد اختراقات/كسور حالياً</div>';
            return;
        }
        const html = signals.map(sig => `
            <div class="crypto-card ${sig.type}">
                <div><b>${sig.symbol}/USDT</b></div>
                <div>
                    ${
                        sig.type === "BreakResistance" ? 'اختراق مقاومة ⬆️'
                        : sig.type === "BreakSupport" ? 'كسر دعم ⬇️'
                        : sig.type === "BullWick" ? 'شمعة ذيل صاعد (Bull Wick)'
                        : sig.type === "BearWick" ? 'شمعة ذيل هابط (Bear Wick)' : ''
                    } عند مستوى <b>${sig.level.toFixed(4)}</b>
                </div>
                <div>السعر: $${sig.price.toFixed(4)}, مؤشر الحجم: ${sig.osc ? sig.osc.toFixed(2) : ''}%</div>
            </div>
        `).join('');
        grid.innerHTML = html;
        this.updateLastUpdateTime();
    }

    updateConnectionStatus(status, className) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `status ${className}`;
        }
    }

    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ar-SA');
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) lastUpdate.textContent = timeString;
    }

    setupEventListeners() {
        const btn = document.getElementById('refreshBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                this.analyzeLuxAlgoBreaks();
            });
        }
    }

    startPeriodicUpdate() {
        this.updateInterval = setInterval(() => {
            this.analyzeLuxAlgoBreaks();
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
    const analyzer = new LuxAlgoBreakoutAnalyzer();
    window.addEventListener('beforeunload', () => {
        analyzer.destroy();
    });
});
