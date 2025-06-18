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

        // استخدام kline بدلاً من ticker
        const streams = symbols.map(symbol => `${symbol}@kline_1m`).join('/');
        this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);

        this.ws.onopen = () => {
            this.updateConnectionStatus('متصل', 'connected');
            console.log('WebSocket connected');
            // جلب البيانات التاريخية للرموز
            this.fetchHistoricalData(symbols);
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.k) {
                this.processKline(data.k);
            }
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

    // جلب البيانات التاريخية
    async fetchHistoricalData(symbols) {
        for (const symbol of symbols) {
            try {
                const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1m&limit=500`);
                const data = await response.json();
                
                if (data && Array.isArray(data)) {
                    const history = data.map(kline => ({
                        timestamp: kline[0],
                        open: parseFloat(kline[1]),
                        high: parseFloat(kline[2]),
                        low: parseFloat(kline[3]),
                        close: parseFloat(kline[4]),
                        volume: parseFloat(kline[5])
                    }));
                    
                    this.priceHistory.set(symbol, history);
                    
                    // تحديث cryptoData أيضاً
                    const lastCandle = history[history.length - 1];
                    this.cryptoData.set(symbol, {
                        symbol: symbol,
                        price: lastCandle.close,
                        volume: lastCandle.volume,
                        priceChange: ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100,
                        high24h: lastCandle.high,
                        low24h: lastCandle.low,
                        history: history
                    });
                }
            } catch (error) {
                console.error(`Error fetching data for ${symbol}:`, error);
            }
        }
        
        // تحليل البيانات بعد جلبها
        setTimeout(() => this.analyzeLuxAlgoBreaks(), 1000);
    }

    processKline(kline) {
        const symbol = kline.s.toLowerCase();
        
        if (!this.priceHistory.has(symbol)) {
            this.priceHistory.set(symbol, []);
        }

        const history = this.priceHistory.get(symbol);
        const candleData = {
            timestamp: kline.t,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
            volume: parseFloat(kline.v)
        };

        // إضافة الشمعة الجديدة أو تحديث الأخيرة
        if (history.length > 0 && history[history.length - 1].timestamp === kline.t) {
            history[history.length - 1] = candleData;
        } else {
            history.push(candleData);
        }

        // الاحتفاظ بآخر 500 شمعة فقط
        if (history.length > 500) {
            history.shift();
        }

        // تحديث البيانات
        this.cryptoData.set(symbol, {
            symbol: symbol,
            price: candleData.close,
            volume: candleData.volume,
            priceChange: ((candleData.close - candleData.open) / candleData.open) * 100,
            high24h: candleData.high,
            low24h: candleData.low,
            history: history
        });
    }

    // تحسين حساب EMA
    ema(data, period) {
        if (!data || data.length < period) return 0;
        
        const multiplier = 2 / (period + 1);
        let ema = data[0];
        
        for (let i = 1; i < data.length; i++) {
            ema = (data[i] - ema) * multiplier + ema;
        }
        
        return ema;
    }

    // تحسين Pivot High
    getPivotHigh(data, idx, left = this.leftBars, right = this.rightBars) {
        if (idx < left || idx >= data.length - right) return null;
        
        const currentHigh = data[idx].high;
        
        // التحقق من الجانب الأيسر
        for (let i = idx - left; i < idx; i++) {
            if (data[i].high >= currentHigh) return null;
        }
        
        // التحقق من الجانب الأيمن
        for (let i = idx + 1; i <= idx + right; i++) {
            if (data[i].high >= currentHigh) return null;
        }
        
        return currentHigh;
    }

    // تحسين Pivot Low
    getPivotLow(data, idx, left = this.leftBars, right = this.rightBars) {
        if (idx < left || idx >= data.length - right) return null;
        
        const currentLow = data[idx].low;
        
        // التحقق من الجانب الأيسر
        for (let i = idx - left; i < idx; i++) {
            if (data[i].low <= currentLow) return null;
        }
        
        // التحقق من الجانب الأيمن
        for (let i = idx + 1; i <= idx + right; i++) {
            if (data[i].low <= currentLow) return null;
        }
        
        return currentLow;
    }

    detectLuxAlgoBreaks(history) {
        if (history.length < 100) return [];
        
        const signals = [];
        const volumes = history.map(h => h.volume);
        
        // تحليل الشموع (باستثناء الشموع الأخيرة التي قد تكون غير مكتملة)
        for (let i = this.leftBars; i < history.length - this.rightBars - 1; i++) {
            const highPivot = this.getPivotHigh(history, i);
            const lowPivot = this.getPivotLow(history, i);
            
            // التحقق من الاختراق في الشمعة التالية
            const breakIdx = i + this.rightBars;
            if (breakIdx >= history.length) continue;
            
            const breakBar = history[breakIdx];
            
            // حساب مؤشر الحجم
            const recentVolumes = volumes.slice(Math.max(0, breakIdx - 20), breakIdx + 1);
            const oscShort = this.ema(recentVolumes.slice(-5), 5);
            const oscLong = this.ema(recentVolumes.slice(-10), 10);
            const osc = oscLong > 0 ? 100 * (oscShort - oscLong) / oscLong : 0;
            
            // كسر المقاومة
            if (highPivot && breakBar.close > highPivot && osc > this.volumeThresh) {
                const bodySize = Math.abs(breakBar.close - breakBar.open);
                const lowerWick = breakBar.open - breakBar.low;
                
                if (lowerWick <= bodySize) { // ليس Bull Wick
                    signals.push({
                        type: "BreakResistance",
                        idx: breakIdx,
                        price: breakBar.close,
                        osc: osc,
                        level: highPivot,
                        timestamp: breakBar.timestamp
                    });
                } else {
                    signals.push({
                        type: "BullWick",
                        idx: breakIdx,
                        price: breakBar.close,
                        level: highPivot,
                        timestamp: breakBar.timestamp
                    });
                }
            }
            
            // كسر الدعم
            if (lowPivot && breakBar.close < lowPivot && osc > this.volumeThresh) {
                const bodySize = Math.abs(breakBar.close - breakBar.open);
                const upperWick = breakBar.high - breakBar.open;
                
                if (upperWick <= bodySize) { // ليس Bear Wick
                    signals.push({
                        type: "BreakSupport",
                        idx: breakIdx,
                        price: breakBar.close,
                        osc: osc,
                        level: lowPivot,
                        timestamp: breakBar.timestamp
                    });
                } else {
                    signals.push({
                        type: "BearWick",
                        idx: breakIdx,
                        price: breakBar.close,
                        level: lowPivot,
                        timestamp: breakBar.timestamp
                    });
                }
            }
        }
        
        return signals;
    }

    analyzeLuxAlgoBreaks() {
        const allSignals = [];
        
        this.cryptoData.forEach((data, symbol) => {
            const history = data.history;
            if (!history || history.length < 100) return;
            
            const signals = this.detectLuxAlgoBreaks(history);
            
            // أخذ أحدث 3 إشارات فقط لكل رمز
            const recentSignals = signals.slice(-3);
            
            recentSignals.forEach(sig => {
                allSignals.push({
                    symbol: symbol.replace('usdt', '').toUpperCase(),
                    ...sig
                });
            });
        });
        
        // ترتيب الإشارات حسب الوقت
        allSignals.sort((a, b) => b.timestamp - a.timestamp);
        
        this.displayLuxAlgoSignals(allSignals.slice(0, 20)); // عرض أحدث 20 إشارة
    }

    displayLuxAlgoSignals(signals) {
        const grid = document.getElementById('cryptoGrid');
        if (!grid) return;

        if (signals.length === 0) {
            grid.innerHTML = '<div class="no-data">🔍 جاري البحث عن إشارات...</div>';
            return;
        }

        const html = signals.map(sig => {
            const timeAgo = this.getTimeAgo(sig.timestamp);
            const signalClass = sig.type.toLowerCase().replace(/([A-Z])/g, '-$1');
            
            return `
                <div class="crypto-card ${signalClass}">
                    <div class="crypto-header">
                        <span class="crypto-symbol">${sig.symbol}/USDT</span>
                        <span class="time-ago">${timeAgo}</span>
                    </div>
                    <div class="signal-type">
                        ${this.getSignalTypeText(sig.type)}
                    </div>
                    <div class="signal-details">
                        <div>المستوى: <strong>$${sig.level.toFixed(4)}</strong></div>
                        <div>السعر: <strong>$${sig.price.toFixed(4)}</strong></div>
                        ${sig.osc ? `<div>مؤشر الحجم: <strong>${sig.osc.toFixed(2)}%</strong></div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        grid.innerHTML = html;
        this.updateLastUpdateTime();
    }

       getSignalTypeText(type) {
        const types = {
            'BreakResistance': '🚀 اختراق مقاومة',
            'BreakSupport': '📉 كسر دعم', 
            'BullWick': '🕯️ شمعة ذيل صاعد',
            'BearWick': '🕯️ شمعة ذيل هابط'
        };
        return types[type] || type;
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        
        if (minutes < 1) return 'الآن';
        if (minutes < 60) return `${minutes}د`;
        if (hours < 24) return `${hours}س`;
        return `${Math.floor(hours / 24)}ي`;
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
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.analyzeLuxAlgoBreaks();
            });
        }

        // إضافة مستمع لتغيير الإعدادات
        const leftBarsInput = document.getElementById('leftBars');
        const rightBarsInput = document.getElementById('rightBars');
        const volumeThreshInput = document.getElementById('volumeThresh');

        if (leftBarsInput) {
            leftBarsInput.addEventListener('change', (e) => {
                this.leftBars = parseInt(e.target.value) || 15;
                this.analyzeLuxAlgoBreaks();
            });
        }

        if (rightBarsInput) {
            rightBarsInput.addEventListener('change', (e) => {
                this.rightBars = parseInt(e.target.value) || 15;
                this.analyzeLuxAlgoBreaks();
            });
        }

        if (volumeThreshInput) {
            volumeThreshInput.addEventListener('change', (e) => {
                this.volumeThresh = parseFloat(e.target.value) || 20;
                this.analyzeLuxAlgoBreaks();
            });
        }
    }

    startPeriodicUpdate() {
        // تحليل كل دقيقة
        this.updateInterval = setInterval(() => {
            this.analyzeLuxAlgoBreaks();
        }, 60000);
    }

    destroy() {
        if (this.ws) {
            this.ws.close();
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    // إضافة دالة لعرض إحصائيات
    displayStats() {
        const stats = {
            connectedSymbols: this.cryptoData.size,
            totalCandles: Array.from(this.priceHistory.values()).reduce((sum, history) => sum + history.length, 0),
            avgCandlesPerSymbol: this.priceHistory.size > 0 ? 
                Math.round(Array.from(this.priceHistory.values()).reduce((sum, history) => sum + history.length, 0) / this.priceHistory.size) : 0
        };

        const statsElement = document.getElementById('stats');
        if (statsElement) {
            statsElement.innerHTML = `
                <div>الرموز المتصلة: ${stats.connectedSymbols}</div>
                <div>إجمالي الشموع: ${stats.totalCandles}</div>
                <div>متوسط الشموع لكل رمز: ${stats.avgCandlesPerSymbol}</div>
            `;
        }
    }
}

// تشغيل التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const analyzer = new LuxAlgoBreakoutAnalyzer();
    
    // عرض الإحصائيات كل 10 ثوان
    setInterval(() => {
        analyzer.displayStats();
    }, 10000);

    window.addEventListener('beforeunload', () => {
        analyzer.destroy();
    });
});
