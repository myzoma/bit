class LuxAlgoBreakoutAnalyzer {
    constructor() {
        this.ws = null;
        this.cryptoData = new Map();
        this.priceHistory = new Map();
        this.leftBars = 15;
        this.rightBars = 15;
        this.volumeThresh = 20;
        this.updateInterval = null;
        this.isPaused = false;
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.startPeriodicUpdate();
    }

    // ✅ نسخة مُحدثة - تستخدم Cloudflare Worker Proxy فقط
    async fetchHistoricalData(symbol) {
          console.log("استدعاء fetchHistoricalData لـ", symbol);
       const proxy = 'https://bitter-flower-8531.dr-glume.workers.dev/?url=';
        const apiUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1m&limit=500`;
        const fullUrl = proxy + encodeURIComponent(apiUrl);

        try {
            console.log(`🔄 محاولة جلب ${symbol} عبر Cloudflare Worker Proxy`);
            const response = await fetch(fullUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            let data = await response.text();

            try {
                data = JSON.parse(data);
            } catch (e) {
                const jsonMatch = data.match(/\[.*\]/s);
                if (jsonMatch) {
                    data = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('Invalid JSON format');
                }
            }

            if (!Array.isArray(data)) {
                throw new Error('Data is not an array');
            }

            const candles = data.map(k => ({
                time: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            }));

            this.priceHistory.set(symbol, candles);
            console.log(`✅ تم جلب ${candles.length} شمعة للرمز ${symbol}`);
            return;

        } catch (error) {
            console.error(`❌ فشل جلب البيانات التاريخية لـ ${symbol}:`, error.message);
            this.priceHistory.set(symbol, []);
        }
    }

    connectWebSocket() {
        const symbols = ['btcusdt', 'ethusdt', 'adausdt', 'bnbusdt', 'xrpusdt', 'solusdt', 'dogeusdt', 'avaxusdt', 'linkusdt', 'maticusdt'];
        this.updateConnectionStatus('جاري الاتصال...', 'connecting');
        symbols.forEach(symbol => {
            this.connectKlineStream(symbol);
            this.priceHistory.set(symbol, []);
            this.fetchHistoricalData(symbol);
        });
    }

    connectKlineStream(symbol) {
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_1m`);
        ws.onopen = () => {
            console.log(`تم الاتصال بـ WebSocket للرمز ${symbol}`);
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const kline = data.k;
            const candleData = {
                time: kline.t,
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
                volume: parseFloat(kline.v),
                isComplete: kline.x
            };
            this.updatePriceHistory(symbol, candleData);
            this.updateConnectionStatus('متصل', 'connected');
        };
        ws.onerror = (error) => {
            console.error(`خطأ في WebSocket لـ ${symbol}:`, error);
            this.updateConnectionStatus('خطأ في الاتصال', 'error');
        };
        ws.onclose = (event) => {
            console.log(`انقطع الاتصال مع ${symbol}. كود: ${event.code}`);
            setTimeout(() => this.connectKlineStream(symbol), 5000);
        };
    }

    updatePriceHistory(symbol, newCandle) {
        if (!this.priceHistory.has(symbol)) {
            this.priceHistory.set(symbol, []);
        }
        const history = this.priceHistory.get(symbol);
        if (newCandle.isComplete) {
            history.push(newCandle);
            if (history.length > 100) {
                history.shift();
            }
            console.log(`${symbol}: تم إضافة شمعة جديدة. العدد الحالي: ${history.length}`);
        }
        this.cryptoData.set(symbol, newCandle);
        if (newCandle.isComplete && history.length >= this.leftBars + this.rightBars + 5 && !this.isPaused) {
            this.analyzeLuxAlgoBreaks();
        }
    }

    analyzeLuxAlgoBreaks() {
        const signals = [];
        let totalSymbolsWithData = 0;
        for (const [symbol, history] of this.priceHistory) {
            const minRequired = this.leftBars + this.rightBars + 5;
            if (history.length < minRequired) {
                console.log(`${symbol}: بيانات غير كافية (${history.length}/${minRequired})`);
                continue;
            }
            totalSymbolsWithData++;
            try {
                const pivotHighs = this.findPivotHighs(history);
                const pivotLows = this.findPivotLows(history);
                const latestCandle = history[history.length - 1];
                const resistance = this.findNearestResistance(pivotHighs, latestCandle.close);
                if (resistance && latestCandle.close > resistance.price) {
                    const volumeCheck = this.checkVolumeThreshold(history);
                    if (volumeCheck) {
                        signals.push({
                            symbol: symbol.toUpperCase(),
                            type: 'BreakResistance',
                            price: latestCandle.close,
                            resistance: resistance.price,
                            volume: latestCandle.volume,
                            time: latestCandle.time,
                            change: ((latestCandle.close - resistance.price) / resistance.price * 100).toFixed(2)
                        });
                    }
                }
                const support = this.findNearestSupport(pivotLows, latestCandle.close);
                if (support && latestCandle.close < support.price) {
                    const volumeCheck = this.checkVolumeThreshold(history);
                    if (volumeCheck) {
                        signals.push({
                            symbol: symbol.toUpperCase(),
                            type: 'BreakSupport',
                            price: latestCandle.close,
                            support: support.price,
                            volume: latestCandle.volume,
                            time: latestCandle.time,
                            change: ((support.price - latestCandle.close) / support.price * 100).toFixed(2)
                        });
                    }
                }
                const wickSignal = this.analyzeWicks(latestCandle);
                if (wickSignal) {
                    signals.push({
                        symbol: symbol.toUpperCase(),
                        type: wickSignal.type,
                        price: latestCandle.close,
                        wickSize: wickSignal.size,
                        time: latestCandle.time,
                        bodySize: wickSignal.data.bodySize,
                        wickPercent: wickSignal.data.wickPercent
                    });
                }
            } catch (error) {
                console.error(`خطأ في تحليل ${symbol}:`, error);
            }
        }
        console.log(`تم تحليل ${totalSymbolsWithData} رمز، وجد ${signals.length} إشارة`);
        this.displayLuxAlgoSignals(signals);
        this.updateLastUpdateTime();
    }

    displayDataStatus() {
        const statusInfo = [];
        for (const [symbol, history] of this.priceHistory) {
            const required = this.leftBars + this.rightBars + 5;
            const status = history.length >= required ? '✅' : '⏳';
            statusInfo.push(`${symbol.toUpperCase()}: ${history.length}/${required} ${status}`);
        }
        console.log('حالة البيانات:', statusInfo.join(', '));
    }

    findPivotHighs(history) {
        const pivots = [];
        for (let i = this.leftBars; i < history.length - this.rightBars; i++) {
            const current = history[i];
            let isPivot = true;
            for (let j = i - this.leftBars; j < i; j++) {
                if (history[j].high >= current.high) {
                    isPivot = false;
                    break;
                }
            }
            if (isPivot) {
                for (let j = i + 1; j <= i + this.rightBars; j++) {
                    if (history[j].high >= current.high) {
                        isPivot = false;
                        break;
                    }
                }
            }
            if (isPivot) {
                pivots.push({ price: current.high, time: current.time, index: i });
            }
        }
        return pivots;
    }

    findPivotLows(history) {
        const pivots = [];
        for (let i = this.leftBars; i < history.length - this.rightBars; i++) {
            const current = history[i];
            let isPivot = true;
            for (let j = i - this.leftBars; j < i; j++) {
                if (history[j].low <= current.low) {
                    isPivot = false;
                    break;
                }
            }
            if (isPivot) {
                for (let j = i + 1; j <= i + this.rightBars; j++) {
                    if (history[j].low <= current.low) {
                        isPivot = false;
                        break;
                    }
                }
            }
            if (isPivot) {
                pivots.push({ price: current.low, time: current.time, index: i });
            }
        }
        return pivots;
    }

    findNearestResistance(pivotHighs, currentPrice) {
        let nearest = null;
        let minDistance = Infinity;
        for (const pivot of pivotHighs) {
            if (pivot.price > currentPrice) {
                const distance = pivot.price - currentPrice;
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = pivot;
                }
            }
        }
        return nearest;
    }

    findNearestSupport(pivotLows, currentPrice) {
        let nearest = null;
        let minDistance = Infinity;
        for (const pivot of pivotLows) {
            if (pivot.price < currentPrice) {
                const distance = currentPrice - pivot.price;
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = pivot;
                }
            }
        }
        return nearest;
    }

    checkVolumeThreshold(history) {
        if (history.length < 20) return false;
        const recent20 = history.slice(-20);
        const avgVolume = recent20.reduce((sum, candle) => sum + candle.volume, 0) / 20;
        const latestVolume = history[history.length - 1].volume;
        const volumeIncrease = ((latestVolume - avgVolume) / avgVolume) * 100;
        return volumeIncrease >= this.volumeThresh;
    }

    analyzeWicks(candle) {
        const body = Math.abs(candle.close - candle.open);
        const upperWick = candle.high - Math.max(candle.open, candle.close);
        const lowerWick = Math.min(candle.open, candle.close) - candle.low;
        const totalRange = candle.high - candle.low;
        if (totalRange === 0) return null;
        const upperWickPercent = (upperWick / totalRange) * 100;
        const lowerWickPercent = (lowerWick / totalRange) * 100;
        if (lowerWickPercent > 60 && body / totalRange < 0.3) {
            return {
                type: 'BullWick',
                size: lowerWickPercent.toFixed(1),
                data: {
                    bodySize: ((body / totalRange) * 100).toFixed(1),
                    wickPercent: lowerWickPercent.toFixed(1)
                }
            };
        }
        if (upperWickPercent > 60 && body / totalRange < 0.3) {
            return {
                type: 'BearWick',
                size: upperWickPercent.toFixed(1),
                data: {
                    bodySize: ((body / totalRange) * 100).toFixed(1),
                    wickPercent: upperWickPercent.toFixed(1)
                }
            };
        }
        return null;
    }

    displayLuxAlgoSignals(signals) {
        const grid = document.getElementById('cryptoGrid');
        if (!grid) return;
        let filteredSignals = signals;
        if (this.currentFilter !== 'all') {
            filteredSignals = signals.filter(sig => sig.type === this.currentFilter);
        }
        const signalCount = document.getElementById('signalCount');
        if (signalCount) {
            signalCount.textContent = filteredSignals.length;
        }
        if (filteredSignals.length === 0) {
            grid.innerHTML = '<div class="no-data">🔍 لا توجد إشارات مطابقة للمرشح المحدد</div>';
            return;
        }
        filteredSignals.sort((a, b) => b.time - a.time);
        const html = filteredSignals.map(signal => {
            const typeClass = signal.type.toLowerCase().replace(/([A-Z])/g, '-$1').substring(1);
            return `
                <div class="crypto-card ${typeClass} new-signal">
                    <div class="crypto-header">
                        <div class="crypto-symbol">${signal.symbol}</div>
                        <div class="time-ago">${this.getTimeAgo(signal.time)}</div>
                    </div>
                    <div class="signal-type">${this.getSignalTypeText(signal.type)}</div>
                    <div class="signal-details">
                        <div><strong>السعر:</strong> <span>$${signal.price?.toFixed(4) || 'N/A'}</span></div>
                        ${this.getSignalDetails(signal)}
                    </div>
                </div>
            `;
        }).join('');
        grid.innerHTML = html;
    }

    getSignalDetails(signal) {
        switch (signal.type) {
            case 'BreakResistance':
                return `
                    <div><strong>مستوى المقاومة:</strong> <span>$${signal.resistance?.toFixed(4) || 'N/A'}</span></div>
                    <div><strong>نسبة الاختراق:</strong> <span style="color: #28a745;">+${signal.change}%</span></div>
                    <div><strong>الحجم:</strong> <span>${this.formatVolume(signal.volume)}</span></div>
                `;
            case 'BreakSupport':
                return `
                    <div><strong>مستوى الدعم:</strong> <span>$${signal.support?.toFixed(4) || 'N/A'}</span></div>
                    <div><strong>نسبة الكسر:</strong> <span style="color: #dc3545;">-${signal.change}%</span></div>
                    <div><strong>الحجم:</strong> <span>${this.formatVolume(signal.volume)}</span></div>
                `;
            case 'BullWick':
                return `
                    <div><strong>حجم الذيل:</strong> <span style="color: #ffc107;">${signal.wickSize}%</span></div>
                    <div><strong>حجم الجسم:</strong> <span>${signal.bodySize}%</span></div>
                    <div><strong>نوع الإشارة:</strong> <span>إشارة صعود محتملة</span></div>
                `;
            case 'BearWick':
                return `
                    <div><strong>حجم الذيل:</strong> <span style="color: #6f42c1;">${signal.wickSize}%</span></div>
                    <div><strong>حجم الجسم:</strong> <span>${signal.bodySize}%</span></div>
                    <div><strong>نوع الإشارة:</strong> <span>إشارة هبوط محتملة</span></div>
                `;
            default:
                return '<div>تفاصيل غير متوفرة</div>';
        }
    }

    formatVolume(volume) {
        if (!volume) return 'N/A';
        if (volume >= 1000000000) {
            return (volume / 1000000000).toFixed(2) + 'B';
        } else if (volume >= 1000000) {
            return (volume / 1000000).toFixed(2) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(2) + 'K';
        }
        return volume.toFixed(2);
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
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.togglePause();
            });
        }
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetData();
            });
        }
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
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

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseBtn');
        if (this.isPaused) {
            pauseBtn.textContent = '▶️ استئناف';
            pauseBtn.classList.add('paused');
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
        } else {
            pauseBtn.textContent = '⏸️ إيقاف مؤقت';
            pauseBtn.classList.remove('paused');
            this.startPeriodicUpdate();
        }
    }

    resetData() {
        this.cryptoData.clear();
        this.priceHistory.clear();
        const grid = document.getElementById('cryptoGrid');
        if (grid) {
            grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>جاري إعادة تحميل البيانات...</p></div>';
        }
        if (this.ws) {
            this.ws.close();
        }
        setTimeout(() => this.connectWebSocket(), 1000);
    }

    setFilter(filter) {
        this.currentFilter = filter;
        this.analyzeLuxAlgoBreaks();
    }

    startPeriodicUpdate() {
        this.updateInterval = setInterval(() => {
            if (!this.isPaused) {
                this.analyzeLuxAlgoBreaks();
            }
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
                <div>الرموز المتصلة: <span class="stat-value">${stats.connectedSymbols}</span></div>
                <div>إجمالي الشموع: <span class="stat-value">${stats.totalCandles}</span></div>
                <div>متوسط الشموع لكل رمز: <span class="stat-value">${stats.avgCandlesPerSymbol}</span></div>
            `;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const analyzer = new LuxAlgoBreakoutAnalyzer();
    setInterval(() => {
        analyzer.displayStats();
    }, 10000);
    window.addEventListener('beforeunload', () => {
        analyzer.destroy();
    });
});
