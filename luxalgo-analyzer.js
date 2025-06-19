class LuxAlgoBreakoutAnalyzer {
    constructor() {
        this.ws = null;
        this.cryptoData = new Map();
        this.priceHistory = new Map();
        this.dailyData = new Map(); // بيانات 24 ساعة
        this.persistentCards = new Map(); // البطاقات المثبتة
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
        this.startDailyDataUpdate();
    }

    // جلب البيانات التاريخية مع بيانات 24 ساعة
    async fetchHistoricalData(symbol) {
        console.log("استدعاء fetchHistoricalData لـ", symbol);
        
        const proxies = [
            'https://bitter-flower-8531.dr-glume.workers.dev/?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://api.allorigins.win/raw?url=',
            'https://thingproxy.freeboard.io/fetch/'
        ];

        // جلب بيانات الدقيقة الواحدة
        const minuteApiUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1h&limit=500`;
        // جلب بيانات 24 ساعة
        const dailyApiUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1d&limit=7`;

        try {
            console.log(`🔄 محاولة جلب ${symbol} مباشرة من Binance`);
            
            // جلب بيانات الدقيقة
            const minuteResponse = await this.fetchWithTimeout(minuteApiUrl, 10000);
            if (minuteResponse.ok) {
                const minuteData = await minuteResponse.json();
                this.processKlineData(symbol, minuteData);
            }

            // جلب البيانات اليومية
            const dailyResponse = await this.fetchWithTimeout(dailyApiUrl, 10000);
            if (dailyResponse.ok) {
                const dailyData = await dailyResponse.json();
                this.processDailyData(symbol, dailyData);
                return true;
            }
        } catch (error) {
            console.log(`⚠️ فشل الاتصال المباشر لـ ${symbol}:`, error.message);
        }

        // محاولة استخدام البروكسيات
        for (let i = 0; i < proxies.length; i++) {
            const proxy = proxies[i];
            
            try {
                console.log(`🔄 محاولة جلب ${symbol} عبر البروكسي ${i + 1}/${proxies.length}`);
                
                // جلب بيانات الدقيقة
                const minuteFullUrl = proxy + encodeURIComponent(minuteApiUrl);
                const minuteResponse = await this.fetchWithTimeout(minuteFullUrl, 15000);
                
                if (minuteResponse.ok) {
                    const minuteData = await this.parseResponse(minuteResponse);
                    if (Array.isArray(minuteData) && minuteData.length > 0) {
                        this.processKlineData(symbol, minuteData);
                    }
                }

                // جلب البيانات اليومية
                const dailyFullUrl = proxy + encodeURIComponent(dailyApiUrl);
                const dailyResponse = await this.fetchWithTimeout(dailyFullUrl, 15000);
                
                if (dailyResponse.ok) {
                    const dailyData = await this.parseResponse(dailyResponse);
                    if (Array.isArray(dailyData) && dailyData.length > 0) {
                        this.processDailyData(symbol, dailyData);
                        return true;
                    }
                }
                
            } catch (error) {
                console.warn(`❌ فشل البروكسي ${i + 1} لـ ${symbol}:`, error.message);
                if (i < proxies.length - 1) {
                    await this.delay(2000);
                }
            }
        }

        console.error(`❌ فشل جلب البيانات التاريخية لـ ${symbol} من جميع المصادر`);
        this.priceHistory.set(symbol, []);
        this.dailyData.set(symbol, []);
        return false;
    }

    // معالجة البيانات اليومية
    processDailyData(symbol, data) {
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid daily data format');
        }

        const dailyCandles = data.map((k, index) => {
            try {
                return {
                    time: parseInt(k[0]),
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5])
                };
            } catch (error) {
                console.warn(`خطأ في معالجة البيانات اليومية ${index} للرمز ${symbol}:`, error);
                return null;
            }
        }).filter(candle => candle !== null);

        this.dailyData.set(symbol, dailyCandles);
        console.log(`✅ تم جلب البيانات اليومية للرمز ${symbol}`);
    }

    // حساب التغيير على 24 ساعة
    calculate24HourChange(symbol) {
        const dailyData = this.dailyData.get(symbol);
        if (!dailyData || dailyData.length < 2) return null;

        const yesterday = dailyData[dailyData.length - 2];
        const today = dailyData[dailyData.length - 1];
        
        const change = ((today.close - yesterday.close) / yesterday.close) * 100;
        const volume24h = today.volume;

        return {
            change: change.toFixed(2),
            volume24h: volume24h,
            high24h: today.high,
            low24h: today.low
        };
    }

    // حساب مؤشر RSI
    calculateRSI(history, period = 14) {
        if (history.length < period + 1) return null;

        const prices = history.slice(-period - 1);
        let gains = 0;
        let losses = 0;

        for (let i = 1; i < prices.length; i++) {
            const change = prices[i].close - prices[i - 1].close;
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        
        return rsi.toFixed(2);
    }

    // حساب مؤشر MACD
    calculateMACD(history) {
        if (history.length < 26) return null;

        const prices = history.map(candle => candle.close);
        
        // حساب EMA 12 و EMA 26
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        
        if (!ema12 || !ema26) return null;

        const macdLine = ema12 - ema26;
        const signalLine = this.calculateEMA([macdLine], 9);
        
        return {
            macd: macdLine.toFixed(4),
            signal: signalLine ? signalLine.toFixed(4) : null,
            histogram: signalLine ? (macdLine - signalLine).toFixed(4) : null
        };
    }

    // حساب EMA
    calculateEMA(prices, period) {
        if (prices.length < period) return null;

        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }

        return ema;
    }

    // العثور على الهدف التالي للمقاومة
    findNextResistanceTarget(pivotHighs, currentPrice) {
        const resistanceLevels = pivotHighs
            .filter(pivot => pivot.price > currentPrice)
            .sort((a, b) => a.price - b.price);
        
        return resistanceLevels.length > 0 ? resistanceLevels[0] : null;
    }

    // العثور على الهدف التالي للدعم
    findNextSupportTarget(pivotLows, currentPrice) {
        const supportLevels = pivotLows
            .filter(pivot => pivot.price < currentPrice)
            .sort((a, b) => b.price - a.price);
        
        return supportLevels.length > 0 ? supportLevels[0] : null;
    }

    // فحص الانعكاس السعري
    checkPriceReversal(symbol, currentPrice) {
        const persistentCard = this.persistentCards.get(symbol);
        if (!persistentCard) return false;

        const history = this.priceHistory.get(symbol);
        if (!history || history.length < 5) return false;

        const recentCandles = history.slice(-5);
        
        if (persistentCard.type === 'BreakResistance') {
            // فحص الانعكاس الهبوطي
            const highs = recentCandles.map(c => c.high);
            const currentHigh = Math.max(...highs);
            
            if (currentPrice < persistentCard.resistance * 0.98) { // انخفاض 2%
                return true;
            }
        } else if (persistentCard.type === 'BreakSupport') {
            // فحص الانعكاس الصعودي
            const lows = recentCandles.map(c => c.low);
            const currentLow = Math.min(...lows);
            
            if (currentPrice > persistentCard.support * 1.02) { // ارتفاع 2%
                return true;
            }
        }

        return false;
    }

    async fetchWithTimeout(url, timeout = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    async parseResponse(response) {
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            
            try {
                data = JSON.parse(text);
            } catch (e) {
                const jsonMatch = text.match(/\[[\s\S]*?\]/);
                if (jsonMatch) {
                    data = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No valid JSON found in response');
                }
            }
        }

        return data;
    }

    processKlineData(symbol, data) {
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid kline data format');
        }

        const candles = data.map((k, index) => {
            try {
                return {
                    time: parseInt(k[0]),
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5])
                };
            } catch (error) {
                console.warn(`خطأ في معالجة الشمعة ${index} للرمز ${symbol}:`, error);
                return null;
            }
        }).filter(candle => candle !== null);

        if (candles.length === 0) {
            throw new Error('No valid candles after processing');
        }

        this.priceHistory.set(symbol, candles);
        console.log(`✅ تم جلب ومعالجة ${candles.length} شمعة للرمز ${symbol}`);
        return true;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

  // استبدل كامل دالة connectWebSocket:
async connectWebSocket() {
    this.updateConnectionStatus('جاري فحص جميع العملات...', 'connecting');
    
    const validSymbols = await this.scanAndFilterSymbols();
    
    if (validSymbols.length === 0) {
        this.updateConnectionStatus('لا توجد عملات تحقق شروط الاستراتيجية', 'error');
        return;
    }
    
    this.updateConnectionStatus(`تم اختيار ${validSymbols.length} عملة بواسطة الاستراتيجية`, 'connected');
    
    validSymbols.forEach(symbol => {
        this.connectKlineStream(symbol);
        // البيانات محفوظة مسبقاً من scanAndFilterSymbols
    });
}

// الدالة الرئيسية للفحص والفلترة
// استبدل scanAndFilterSymbols بالكامل:
async scanAndFilterSymbols() {
    try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const allTickers = await response.json();
        
        const usdtSymbols = allTickers
            .filter(t => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) > 1000000)
            .map(t => t.symbol.toLowerCase());
        
        console.log(`فحص ${usdtSymbols.length} عملة...`);
        
        const validSymbols = [];
        
        for (const symbol of usdtSymbols) {
            try {
                const response = await fetch(
                    `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1h&limit=100`
                );
                const klineData = await response.json();
                
                if (klineData.length < 50) continue;
                
                const historyData = klineData.map(candle => ({
                    time: candle[0],
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    volume: parseFloat(candle[5])
                }));
                
                const signals = this.runOriginalAnalysis(historyData, symbol);
                
                if (signals.length > 0) {
                    validSymbols.push(symbol);
                    
                    // حفظ البيانات
                    this.priceHistory.set(symbol, historyData);
                    this.dailyData.set(symbol, historyData.slice(-24));
                    
                    console.log(`✅ ${symbol.toUpperCase()} - وجد ${signals.length} إشارة`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (error) {
                continue;
            }
        }
        
        console.log(`العملات المختارة: ${validSymbols.length}`);
        return validSymbols;
        
    } catch (error) {
        return [];
    }
}
runOriginalAnalysis(historyData, symbol) {
    const signals = [];
    
    for (let i = 1; i < historyData.length; i++) {
        const currentCandle = historyData[i];
        
        const tailSize = this.calculateTailSize(currentCandle);
        const bodySize = this.calculateBodySize(currentCandle);
        
        if (tailSize > 50 && bodySize < 30 && currentCandle.close > currentCandle.open) {
            signals.push({
                symbol: symbol,
                type: 'bullish_tail',
                time: currentCandle.time,
                tailSize: tailSize,
                bodySize: bodySize
            });
        }
    }
    
    return signals;
}
// الاستراتيجية الحقيقية
checkLuxAlgoSignal(klineData) {
    const latestCandles = klineData.slice(-10); // آخر 10 شموع
    
    for (const candle of latestCandles) {
        const open = parseFloat(candle[1]);
        const high = parseFloat(candle[2]);
        const low = parseFloat(candle[3]);
        const close = parseFloat(candle[4]);
        
        // حساب الذيل والجسم
        const totalRange = high - low;
        if (totalRange === 0) continue;
        
        const bodySize = Math.abs(close - open);
        const lowerTail = Math.min(open, close) - low;
        const upperTail = high - Math.max(open, close);
        
        const lowerTailPercent = (lowerTail / totalRange) * 100;
        const bodyPercent = (bodySize / totalRange) * 100;
        
        // شروط إشارة الذيل الصاعد
        if (lowerTailPercent > 50 && bodyPercent < 40 && close > open) {
            return true;
        }
        
        // شروط إشارة الذيل الهابط  
        if (upperTail / totalRange > 0.5 && bodyPercent < 40 && close < open) {
            return true;
        }
    }
    
    return false;
}

// جلب بيانات تاريخية للتحليل
async fetchHistoricalDataForAnalysis(symbol, limit = 100) {
    try {
        const response = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1h&limit=${limit}`
        );
        
        if (!response.ok) return [];
        
        const data = await response.json();
        return data.map(candle => ({
            open_time: candle[0],
            open: candle[1],
            high: candle[2],
            low: candle[3],
            close: candle[4],
            volume: candle[5],
            close_time: candle[6]
        }));
        
    } catch (error) {
        return [];
    }
}

// دالة مساعدة للانتظار
sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

    connectKlineStream(symbol) {
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_1h`);
        
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

        // فحص الانعكاس السعري للبطاقات المثبتة
        if (this.persistentCards.has(symbol)) {
            if (this.checkPriceReversal(symbol, newCandle.close)) {
                this.persistentCards.delete(symbol);
                console.log(`تم إلغاء تثبيت البطاقة للرمز ${symbol} بسبب الانعكاس السعري`);
            }
        }

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
                const change24h = this.calculate24HourChange(symbol);
                const rsi = this.calculateRSI(history);
                const macd = this.calculateMACD(history);

                const resistance = this.findNearestResistance(pivotHighs, latestCandle.close);
                
                if (resistance && latestCandle.close > resistance.price) {
                    const volumeCheck = this.checkVolumeThreshold(history);
                    if (volumeCheck) {
                        const nextTarget = this.findNextResistanceTarget(pivotHighs, latestCandle.close);
                        
                        const signal = {
                            symbol: symbol.toUpperCase(),
                            type: 'BreakResistance',
                            price: latestCandle.close,
                            resistance: resistance.price,
                            nextTarget: nextTarget ? nextTarget.price : null,
                            volume: latestCandle.volume,
                           time: latestCandle.time,
                            change: ((latestCandle.close - resistance.price) / resistance.price * 100).toFixed(2),
                            change24h: change24h,
                            rsi: rsi,
                            macd: macd
                        };

                        signals.push(signal);
                        
                        // تثبيت البطاقة في حالة الاختراق الصعودي
                        this.persistentCards.set(symbol, signal);
                    }
                }

                const support = this.findNearestSupport(pivotLows, latestCandle.close);
                
                if (support && latestCandle.close < support.price) {
                    const volumeCheck = this.checkVolumeThreshold(history);
                    if (volumeCheck) {
                        const nextTarget = this.findNextSupportTarget(pivotLows, latestCandle.close);
                        
                        const signal = {
                            symbol: symbol.toUpperCase(),
                            type: 'BreakSupport',
                            price: latestCandle.close,
                            support: support.price,
                            nextTarget: nextTarget ? nextTarget.price : null,
                            volume: latestCandle.volume,
                            time: latestCandle.time,
                            change: ((support.price - latestCandle.close) / support.price * 100).toFixed(2),
                            change24h: change24h,
                            rsi: rsi,
                            macd: macd
                        };

                        signals.push(signal);
                        
                        // تثبيت البطاقة في حالة كسر الدعم
                        this.persistentCards.set(symbol, signal);
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
                        wickPercent: wickSignal.data.wickPercent,
                        change24h: change24h,
                        rsi: rsi,
                        macd: macd
                    });
                }

            } catch (error) {
                console.error(`خطأ في تحليل ${symbol}:`, error);
            }
        }

        // إضافة البطاقات المثبتة للإشارات
        for (const [symbol, persistentSignal] of this.persistentCards) {
            if (!signals.some(signal => signal.symbol === symbol && signal.type === persistentSignal.type)) {
                signals.push({
                    ...persistentSignal,
                    isPersistent: true
                });
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
        const bodyPercent = (body / totalRange) * 100;

        if (lowerWickPercent > 60 && bodyPercent < 30) {
            return {
                type: 'BullWick',
                size: lowerWickPercent.toFixed(1),
                data: {
                    bodySize: bodyPercent.toFixed(1),
                    wickPercent: lowerWickPercent.toFixed(1)
                }
            };
        }

        if (upperWickPercent > 60 && bodyPercent < 30) {
            return {
                type: 'BearWick',
                size: upperWickPercent.toFixed(1),
                data: {
                    bodySize: bodyPercent.toFixed(1),
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
            const persistentClass = signal.isPersistent ? 'persistent-card' : '';
            
            return `
                <div class="crypto-card ${typeClass} new-signal ${persistentClass}">
                    <div class="crypto-header">
                        <div class="crypto-symbol">${signal.symbol}</div>
                        <div class="time-ago">${this.getTimeAgo(signal.time)}</div>
                        ${signal.isPersistent ? '<div class="persistent-badge">مثبت</div>' : ''}
                    </div>
                    <div class="signal-type">${this.getSignalTypeText(signal.type)}</div>
                    <div class="signal-details">
                                               <div><strong>السعر:</strong> <span>$${signal.price?.toFixed(4) || 'N/A'}</span></div>
                        ${this.getSignalDetails(signal)}
                        ${this.getIndicatorData(signal)}
                        ${this.get24HourData(signal)}
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
                    <div><strong>الهدف التالي:</strong> <span style="color: #28a745;">$${signal.nextTarget?.toFixed(4) || 'غير محدد'}</span></div>
                    <div><strong>نسبة الاختراق:</strong> <span style="color: #28a745;">+${signal.change}%</span></div>
                    <div><strong>الحجم:</strong> <span>${this.formatVolume(signal.volume)}</span></div>
                `;
            case 'BreakSupport':
                return `
                    <div><strong>مستوى الدعم:</strong> <span>$${signal.support?.toFixed(4) || 'N/A'}</span></div>
                    <div><strong>الهدف التالي:</strong> <span style="color: #dc3545;">$${signal.nextTarget?.toFixed(4) || 'غير محدد'}</span></div>
                    <div><strong>نسبة الكسر:</strong> <span style="color: #dc3545;">-${signal.change}%</span></div>
                    <div><strong>الحجم:</strong> <span>${this.formatVolume(signal.volume)}</span></div>
                `;
            case 'BullWick':
                return `
                    <div><strong>حجم الذيل:</strong> <span style="color: #ffc107;">${signal.wickSize}%</span></div>
                    <div><strong>حجم الجسم:</strong> <span>${signal.bodySize || 'N/A'}%</span></div>
                    <div><strong>نوع الإشارة:</strong> <span>إشارة صعود محتملة</span></div>
                `;
            case 'BearWick':
                return `
                    <div><strong>حجم الذيل:</strong> <span style="color: #6f42c1;">${signal.wickSize}%</span></div>
                    <div><strong>حجم الجسم:</strong> <span>${signal.bodySize || 'N/A'}%</span></div>
                    <div><strong>نوع الإشارة:</strong> <span>إشارة هبوط محتملة</span></div>
                `;
            default:
                return '<div>تفاصيل غير متوفرة</div>';
        }
    }

    // عرض بيانات المؤشرات
    getIndicatorData(signal) {
        let indicatorHtml = '';
        
        if (signal.rsi) {
            const rsiColor = signal.rsi > 70 ? '#dc3545' : signal.rsi < 30 ? '#28a745' : '#ffc107';
            const rsiStatus = signal.rsi > 70 ? 'تشبع شرائي' : signal.rsi < 30 ? 'تشبع بيعي' : 'محايد';
            indicatorHtml += `<div><strong>RSI:</strong> <span style="color: ${rsiColor};">${signal.rsi} (${rsiStatus})</span></div>`;
        }

        if (signal.macd) {
            const macdColor = parseFloat(signal.macd.macd) > 0 ? '#28a745' : '#dc3545';
            const macdTrend = parseFloat(signal.macd.macd) > parseFloat(signal.macd.signal || 0) ? 'صاعد' : 'هابط';
            indicatorHtml += `
                <div><strong>MACD:</strong> <span style="color: ${macdColor};">${signal.macd.macd}</span></div>
                <div><strong>اتجاه MACD:</strong> <span>${macdTrend}</span></div>
            `;
        }

        return indicatorHtml;
    }

    // عرض بيانات 24 ساعة
    get24HourData(signal) {
        if (!signal.change24h) return '';

        const changeColor = parseFloat(signal.change24h.change) >= 0 ? '#28a745' : '#dc3545';
        const changeSign = parseFloat(signal.change24h.change) >= 0 ? '+' : '';

        return `
            <div><strong>تغيير 24س:</strong> <span style="color: ${changeColor};">${changeSign}${signal.change24h.change}%</span></div>
            <div><strong>أعلى 24س:</strong> <span>$${signal.change24h.high24h?.toFixed(4) || 'N/A'}</span></div>
            <div><strong>أقل 24س:</strong> <span>$${signal.change24h.low24h?.toFixed(4) || 'N/A'}</span></div>
            <div><strong>حجم 24س:</strong> <span>${this.formatVolume(signal.change24h.volume24h)}</span></div>
        `;
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

    // بدء تحديث البيانات اليومية
    startDailyDataUpdate() {
        // تحديث البيانات اليومية كل ساعة
        setInterval(() => {
            for (const symbol of this.priceHistory.keys()) {
                this.fetchHistoricalData(symbol);
            }
        }, 3600000); // كل ساعة
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

        // أزرار التصفية
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // إخفاء أو إظهار الإعدادات (مخفية افتراضياً)
        const settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel) {
            settingsPanel.style.display = 'none';
        }

        // الاحتفاظ بوظائف الإعدادات في الكود دون عرضها
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
        this.dailyData.clear();
        this.persistentCards.clear();
        
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
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            if (!this.isPaused) {
                this.analyzeLuxAlgoBreaks();
            }
        }, 60000); // كل 60 دقيقة
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
                Math.round(Array.from(this.priceHistory.values()).reduce((sum, history) => sum + history.length, 0) / this.priceHistory.size) : 0,
            persistentCards: this.persistentCards.size
        };

        const statsElement = document.getElementById('stats');
        if (statsElement) {
            statsElement.innerHTML = `
                <div>الرموز المتصلة: <span class="stat-value">${stats.connectedSymbols}</span></div>
                <div>إجمالي الشموع: <span class="stat-value">${stats.totalCandles}</span></div>
                <div>متوسط الشموع لكل رمز: <span class="stat-value">${stats.avgCandlesPerSymbol}</span></div>
                <div>البطاقات المثبتة: <span class="stat-value">${stats.persistentCards}</span></div>
            `;
        }
      
    }
      calculateTailSize(candle) {
    const open = parseFloat(candle.open);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);
    const close = parseFloat(candle.close);
    
    const totalRange = high - low;
    if (totalRange === 0) return 0;
    
    // حساب الذيل السفلي
    const bodyLow = Math.min(open, close);
    const lowerTail = bodyLow - low;
    
    // إرجاع النسبة المئوية للذيل
    return (lowerTail / totalRange) * 100;
}

calculateBodySize(candle) {
    const open = parseFloat(candle.open);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);
    const close = parseFloat(candle.close);
    
    const totalRange = high - low;
    if (totalRange === 0) return 0;
    
    // حساب حجم الجسم
    const bodySize = Math.abs(close - open);
    
    // إرجاع النسبة المئوية للجسم
    return (bodySize / totalRange) * 100;
}
}

// تشغيل المحلل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const analyzer = new LuxAlgoBreakoutAnalyzer();
    
    // تحديث الإحصائيات كل 10 ثواني
    setInterval(() => {
        analyzer.displayStats();
    }, 10000);

    // تنظيف الموارد عند إغلاق الصفحة
    window.addEventListener('beforeunload', () => {
        analyzer.destroy();
    });
});

