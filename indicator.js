// إصلاح الأخطاء في ملف المؤشر الرئيسي

class TrendChangeIndicator {
    constructor() {
        this.config = {
            emaFast: 30,
            emaSlow: 60,
            atrLength: 60,
            atrMargin: 0.3,
            smaLength: 140,
            timeframe: '4H',
            symbol: 'BTCUSDT'
        };
        
        this.data = [];
        this.canvas = document.getElementById('chart');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        if (this.ctx) {
            this.initializeEventListeners();
            this.generateSampleData();
            this.calculate();
        }
    }

    initializeEventListeners() {
        const elements = {
            emaFast: document.getElementById('emaFast'),
            emaSlow: document.getElementById('emaSlow'),
            atrLength: document.getElementById('atrLength'),
            atrMargin: document.getElementById('atrMargin'),
            smaLength: document.getElementById('smaLength'),
            timeframe: document.getElementById('timeframe'),
            symbol: document.getElementById('symbol')
        };

        // التحقق من وجود العناصر قبل إضافة المستمعين
        if (elements.emaFast) {
            elements.emaFast.addEventListener('change', (e) => {
                this.config.emaFast = parseInt(e.target.value);
                this.calculate();
            });
        }
        
        if (elements.emaSlow) {
            elements.emaSlow.addEventListener('change', (e) => {
                this.config.emaSlow = parseInt(e.target.value);
                this.calculate();
            });
        }
        
        if (elements.atrLength) {
            elements.atrLength.addEventListener('change', (e) => {
                this.config.atrLength = parseInt(e.target.value);
                this.calculate();
            });
        }
        
        if (elements.atrMargin) {
            elements.atrMargin.addEventListener('change', (e) => {
                this.config.atrMargin = parseFloat(e.target.value);
                this.calculate();
            });
        }
        
        if (elements.smaLength) {
            elements.smaLength.addEventListener('change', (e) => {
                this.config.smaLength = parseInt(e.target.value);
                this.calculate();
            });
        }
        
        if (elements.timeframe) {
            elements.timeframe.addEventListener('change', (e) => {
                this.config.timeframe = e.target.value;
                this.calculate();
            });
        }
        
        if (elements.symbol) {
            elements.symbol.addEventListener('change', (e) => {
                this.config.symbol = e.target.value;
                this.calculate();
            });
        }
    }

    // حساب المتوسط المتحرك الأسي
    calculateEMA(data, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        if (data.length === 0) return ema;
        
        ema[0] = data[0];
        
        for (let i = 1; i < data.length; i++) {
            ema[i] = (data[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
        }
        
        return ema;
    }

    // حساب المتوسط المتحرك البسيط
    calculateSMA(data, period) {
        const sma = [];
        
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                sma[i] = null;
            } else {
                let sum = 0;
                for (let j = 0; j < period; j++) {
                    sum += data[i - j];
                }
                sma[i] = sum / period;
            }
        }
        
        return sma;
    }

    // حساب ATR
    calculateATR(highs, lows, closes, period) {
        const trueRanges = [];
        const atr = [];
        
        if (closes.length < 2) return atr;
        
        for (let i = 1; i < closes.length; i++) {
            const tr1 = highs[i] - lows[i];
            const tr2 = Math.abs(highs[i] - closes[i - 1]);
            const tr3 = Math.abs(lows[i] - closes[i - 1]);
            
            trueRanges[i] = Math.max(tr1, tr2, tr3);
        }
        
        // حساب ATR باستخدام SMA للفترات الأولى
        for (let i = period; i < trueRanges.length; i++) {
            if (i === period) {
                let sum = 0;
                for (let j = 1; j <= period; j++) {
                    sum += trueRanges[i - j + 1];
                }
                atr[i] = sum / period;
            } else {
                atr[i] = (atr[i - 1] * (period - 1) + trueRanges[i]) / period;
            }
        }
        
        return atr;
    }

    // توليد بيانات تجريبية
    generateSampleData() {
        this.data = [];
        let basePrice = 50000;
        
        for (let i = 0; i < 200; i++) {
            const change = (Math.random() - 0.5) * 1000;
            basePrice += change;
            
            const high = basePrice + Math.random() * 500;
            const low = basePrice - Math.random() * 500;
            const close = basePrice + (Math.random() - 0.5) * 200;
            
            this.data.push({
                timestamp: Date.now() - (200 - i) * 24 * 60 * 60 * 1000,
                open: basePrice,
                high: high,
                low: low,
                close: close
            });
            
            basePrice = close;
        }
    }

    // حساب توقعات SMA
    calculateSMAForecasts(closes, sma, smaLength) {
        const forecasts = [];
        
        if (sma.length === 0 || closes.length === 0) return forecasts;
        
        const currentSMA = sma[sma.length - 1];
        const currentClose = closes[closes.length - 1];
        
        if (currentSMA === null || currentSMA === undefined) return forecasts;
        
        for (let days = 1; days <= 9; days++) {
            let forecast = currentSMA;
            let numerator = currentSMA * smaLength;
            
            // إضافة الأسعار المستقبلية المتوقعة
            numerator += currentClose * days;
            
            // طرح الأسعار القديمة
            for (let j = 0; j < days; j++) {
                if (smaLength - 1 - j >= 0 && closes.length - 1 - (smaLength - 1 - j) >= 0) {
                    numerator -= closes[closes.length - 1 - (smaLength - 1 - j)];
                }
            }
            
            forecast = numerator / smaLength;
            forecasts.push(forecast);
        }
        
        return forecasts;
    }

    // الحسابات الرئيسية
    calculate() {
        if (!this.data || this.data.length === 0) return;
        
        const closes = this.data.map(d => d.close);
        const highs = this.data.map(d => d.high);
        const lows = this.data.map(d => d.low);
        
        // حساب EMAs
        const emaFast = this.calculateEMA(closes, this.config.emaFast);
        const emaSlow = this.calculateEMA(closes, this.config.emaSlow);
        
        // حساب ATR
        const atr = this.calculateATR(highs, lows, closes, this.config.atrLength);
        
        // حساب SMA
        const sma = this.calculateSMA(closes, this.config.smaLength);
        
        // حساب توقعات SMA
        const smaForecasts = this.calculateSMAForecasts(closes, sma, this.config.smaLength);
        
        // تحديد الاتجاهات للإطار الزمني المحدد
        const currentIndex = closes.length - 1;
        const emaFastCurrent = emaFast[currentIndex] || 0;
        const emaSlowCurrent = emaSlow[currentIndex] || 0;
        const atrCurrent = atr[currentIndex] || 100;
        
        const emaDiff = emaFastCurrent - emaSlowCurrent;
        const atrThreshold = this.config.atrMargin * atrCurrent;
        
        const isBullTimeframe = emaDiff > atrThreshold;
        const isBearTimeframe = emaDiff < -atrThreshold;
        const isOverTimeframe = emaFastCurrent > emaSlowCurrent;
        
        // محاكاة الاتجاه اليومي (في التطبيق الحقيقي، ستحتاج لبيانات يومية منفصلة)
        const dailyEmaDiff = emaDiff * (Math.random() * 0.5 + 0.75); // محاكاة
        const isBullDaily = dailyEmaDiff > atrThreshold;
        const isBearDaily = dailyEmaDiff < -atrThreshold;
        const isOverDaily = dailyEmaDiff > 0;
        
        // تحديد التحذيرات
        const warningBull = isBullDaily && isBearTimeframe;
        const warningBear = isBearDaily && isBullTimeframe;
        const warning = warningBull || warningBear;
        // تحديد تغيير الاتجاه
        const noTrend = !isBullDaily && !isBearDaily;
        const trend = isBullDaily || isBearDaily;
        
        // تحديث واجهة المستخدم
        this.updateStatus(isBullTimeframe, isBearTimeframe, isOverTimeframe, 
                         isBullDaily, isBearDaily, isOverDaily);
        this.checkAlerts(warning, warningBull, warningBear, noTrend);
        
        if (this.ctx) {
            this.drawChart(closes, emaFast, emaSlow, sma, smaForecasts);
        }
        
        // حفظ النتائج للاستخدام المستقبلي
        this.results = {
            emaFast,
            emaSlow,
            sma,
            smaForecasts,
            atr,
            timeframe: {
                isBull: isBullTimeframe,
                isBear: isBearTimeframe,
                isOver: isOverTimeframe
            },
            daily: {
                isBull: isBullDaily,
                isBear: isBearDaily,
                isOver: isOverDaily
            },
            warnings: {
                warning,
                warningBull,
                warningBear
            }
        };
    }

    // تحديث حالة المؤشرات
    updateStatus(isBullTimeframe, isBearTimeframe, isOverTimeframe, 
                isBullDaily, isBearDaily, isOverDaily) {
        const timeframeStatus = document.getElementById('timeframeStatus');
        const dailyStatus = document.getElementById('dailyStatus');
        const overallTrend = document.getElementById('overallTrend');
        
        // التحقق من وجود العناصر
        if (!timeframeStatus || !dailyStatus || !overallTrend) return;
        
        // حالة الإطار الزمني المحدد
        if (isBullTimeframe) {
            timeframeStatus.textContent = isOverTimeframe ? 'صاعد قوي' : 'صاعد';
            timeframeStatus.className = 'status-cell bull';
        } else if (isBearTimeframe) {
            timeframeStatus.textContent = isOverTimeframe ? 'هابط' : 'هابط قوي';
            timeframeStatus.className = 'status-cell bear';
        } else {
            timeframeStatus.textContent = isOverTimeframe ? 'صاعد ضعيف' : 'هابط ضعيف';
            timeframeStatus.className = 'status-cell neutral';
        }
        
        // حالة اليومي
        if (isBullDaily) {
            dailyStatus.textContent = isOverDaily ? 'صاعد قوي' : 'صاعد';
            dailyStatus.className = 'status-cell bull';
        } else if (isBearDaily) {
            dailyStatus.textContent = isOverDaily ? 'هابط' : 'هابط قوي';
            dailyStatus.className = 'status-cell bear';
        } else {
            dailyStatus.textContent = isOverDaily ? 'صاعد ضعيف' : 'هابط ضعيف';
            dailyStatus.className = 'status-cell neutral';
        }
        
        // الاتجاه العام
        if (isBullDaily && isBullTimeframe) {
            overallTrend.textContent = 'صاعد قوي';
            overallTrend.className = 'status-cell bull';
        } else if (isBearDaily && isBearTimeframe) {
            overallTrend.textContent = 'هابط قوي';
            overallTrend.className = 'status-cell bear';
        } else if (isBullDaily || isBullTimeframe) {
            overallTrend.textContent = 'صاعد متذبذب';
            overallTrend.className = 'status-cell neutral';
        } else if (isBearDaily || isBearTimeframe) {
            overallTrend.textContent = 'هابط متذبذب';
            overallTrend.className = 'status-cell neutral';
        } else {
            overallTrend.textContent = 'محايد';
            overallTrend.className = 'status-cell neutral';
        }
    }

    // فحص التحذيرات
    checkAlerts(warning, warningBull, warningBear, trendChange) {
        const alertsContainer = document.getElementById('alerts');
        if (!alertsContainer) return;
        
        alertsContainer.innerHTML = '';
        
        if (trendChange) {
            const alert = document.createElement('div');
            alert.className = 'alert alert-warning';
            alert.textContent = '⚠️ تحذير! تغيير في الاتجاه!';
            alertsContainer.appendChild(alert);
        }
        
        if (warning) {
            const alert = document.createElement('div');
            alert.className = 'alert alert-danger';
            if (warningBull) {
                alert.textContent = '🔴 تحذير! فكر في جني الأرباح - اتجاه يومي صاعد مع إطار زمني هابط';
            } else if (warningBear) {
                alert.textContent = '🔴 تحذير! فكر في جني الأرباح - اتجاه يومي هابط مع إطار زمني صاعد';
            }
            alertsContainer.appendChild(alert);
        }
    }

    // رسم الرسم البياني
    drawChart(closes, emaFast, emaSlow, sma, smaForecasts) {
        if (!this.ctx || !this.canvas) return;
        
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // تنظيف الرسم
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // تحديد النطاق
        const dataLength = Math.min(100, closes.length); // عرض آخر 100 نقطة
        const startIndex = closes.length - dataLength;
        
        const visibleCloses = closes.slice(startIndex);
        const visibleEmaFast = emaFast.slice(startIndex);
        const visibleEmaSlow = emaSlow.slice(startIndex);
        const visibleSma = sma.slice(startIndex);
        
        // حساب القيم الدنيا والعليا
        const allValues = [...visibleCloses, ...visibleEmaFast, ...visibleEmaSlow, 
                          ...visibleSma.filter(v => v !== null), ...smaForecasts];
        
        if (allValues.length === 0) return;
        
        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        const range = maxValue - minValue;
        const padding = range * 0.1;
        
        // دوال التحويل
        const xScale = (index) => (index / (dataLength - 1)) * (canvas.width - 40) + 20;
        const yScale = (value) => canvas.height - 20 - ((value - minValue + padding) / (range + 2 * padding)) * (canvas.height - 40);
        
        // رسم الشبكة
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i < 10; i++) {
            const y = (canvas.height / 10) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // رسم خط السعر
        this.drawLine(ctx, visibleCloses, xScale, yScale, '#ffffff', 2);
        
        // رسم EMA السريع
        this.drawLine(ctx, visibleEmaFast, xScale, yScale, '#00ff00', 2);
        
        // رسم EMA البطيء
        this.drawLine(ctx, visibleEmaSlow, xScale, yScale, '#ff0000', 2);
        
        // رسم SMA
        const validSma = visibleSma.map((v, i) => v !== null ? v : visibleCloses[i]);
        this.drawLine(ctx, validSma, xScale, yScale, '#ffff00', 2);
        
        // رسم توقعات SMA
        if (smaForecasts && smaForecasts.length > 0) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            
            const lastX = xScale(dataLength - 1);
            const lastY = yScale(validSma[validSma.length - 1]);
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            
            for (let i = 0; i < smaForecasts.length; i++) {
                const x = lastX + (i + 1) * 20;
                const y = yScale(smaForecasts[i]);
                ctx.lineTo(x, y);
                
                // رسم نقاط التوقع
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // رسم المنطقة بين EMAs
        this.fillBetweenLines(ctx, visibleEmaFast, visibleEmaSlow, xScale, yScale);
        
        // إضافة التسميات
        this.drawLabels(ctx, canvas, minValue, maxValue);
    }
    
    // رسم خط
    drawLine(ctx, data, xScale, yScale, color, lineWidth) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        
        let started = false;
        for (let i = 0; i < data.length; i++) {
            if (data[i] !== null && data[i] !== undefined) {
                const x = xScale(i);
                const y = yScale(data[i]);
                
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
        ctx.stroke();
    }
    
    // ملء المنطقة بين الخطوط
    fillBetweenLines(ctx, data1, data2, xScale, yScale) {
        if (data1.length === 0 || data2.length === 0) return;
        
        const currentEmaFast = data1[data1.length - 1];
        const currentEmaSlow = data2[data2.length - 1];
        
        let fillColor;
        if (currentEmaFast > currentEmaSlow) {
            fillColor = 'rgba(0, 255, 0, 0.1)'; // أخضر شفاف للاتجاه الصاعد
        } else {
            fillColor = 'rgba(255, 0, 0, 0.1)'; // أحمر شفاف للاتجاه الهابط
        }
        
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        
        // رسم الخط العلوي
        let started = false;
        for (let i = 0; i < data1.length; i++) {
            if (data1[i] !== null && data2[i] !== null) {
                const x = xScale(i);
                const y = yScale(data1[i]);
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
        
        // رسم الخط السفلي بالعكس
        for (let i = data2.length - 1; i >= 0; i--) {
            if (data1[i] !== null && data2[i] !== null) {
                const x = xScale(i);
                const y = yScale(data2[i]);
                ctx.lineTo(x, y);
            }
        }
        
        ctx.closePath();
        ctx.fill();
    }
    
    // رسم التسميات
    drawLabels(ctx, canvas, minValue, maxValue) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        
        // تسميات الأسعار
        for (let i = 0; i <= 5; i++) {
            const value = minValue + (maxValue - minValue) * (i / 5);
            const y = canvas.height - 20 - (i / 5) * (canvas.height - 40);
            ctx.fillText(value.toFixed(0), canvas.width - 5, y + 4);
        }
        
        // وسيلة الإيضاح
        this.drawLegend(ctx, canvas);
    }
    
    // رسم وسيلة الإيضاح
    drawLegend(ctx, canvas) {
        const legends = [
            { color: '#ffffff', text: 'السعر' },
            { color: '#00ff00', text: `EMA ${this.config.emaFast}` },
            { color: '#ff0000', text: `EMA ${this.config.emaSlow}` },
            { color: '#ffff00', text: `SMA ${this.config.smaLength}` }
        ];
        
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        
        legends.forEach((legend, index) => {
            const x = 10;
            const y = 20 + index * 20;
            
            // رسم مربع اللون
            ctx.fillStyle = legend.color;
            ctx.fillRect(x, y - 8, 15, 3);
            
            // رسم النص
            ctx.fillStyle = '#ffffff';
            ctx.fillText(legend.text, x + 20, y);
        });
    }
    
    // تحديث المؤشر
    update() {
        this.calculate();
    }
}

// دالة تحديث المؤشر من الخارج
function updateIndicator() {
    if (window.trendIndicator) {
        // تحديث الإعدادات من المدخلات
        const emaFastEl = document.getElementById('emaFast');
        const emaSlowEl = document.getElementById('emaSlow');
        const atrLengthEl = document.getElementById('atrLength');
        const atrMarginEl = document.getElementById('atrMargin');
        const smaLengthEl = document.getElementById('smaLength
        const timeframeEl = document.getElementById('timeframe');
        const symbolEl = document.getElementById('symbol');
        
        // التحقق من وجود العناصر قبل التحديث
        if (emaFastEl) window.trendIndicator.config.emaFast = parseInt(emaFastEl.value);
        if (emaSlowEl) window.trendIndicator.config.emaSlow = parseInt(emaSlowEl.value);
        if (atrLengthEl) window.trendIndicator.config.atrLength = parseInt(atrLengthEl.value);
        if (atrMarginEl) window.trendIndicator.config.atrMargin = parseFloat(atrMarginEl.value);
        if (smaLengthEl) window.trendIndicator.config.smaLength = parseInt(smaLengthEl.value);
        if (timeframeEl) window.trendIndicator.config.timeframe = timeframeEl.value;
        if (symbolEl) window.trendIndicator.config.symbol = symbolEl.value;
        
        // إعادة توليد البيانات وإعادة الحساب
        window.trendIndicator.generateSampleData();
        window.trendIndicator.calculate();
        
        // إظهار إشعار التحديث
        if (window.notificationManager) {
            window.notificationManager.success('تم تحديث المؤشر بنجاح');
        }
    }
}

// تهيئة المؤشر عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    try {
        window.trendIndicator = new TrendChangeIndicator();
        
        // تحديث تلقائي كل 30 ثانية
        setInterval(() => {
            if (window.trendIndicator) {
                window.trendIndicator.generateSampleData();
                window.trendIndicator.calculate();
            }
        }, 30000);
        
        // إظهار إشعار التهيئة
        if (window.notificationManager) {
            window.notificationManager.success('تم تهيئة المؤشر بنجاح');
        }
    } catch (error) {
        console.error('خطأ في تهيئة المؤشر:', error);
        if (window.notificationManager) {
            window.notificationManager.error('خطأ في تهيئة المؤشر');
        }
    }
});

// إضافة دعم للبيانات الحقيقية من API
class DataProvider {
    constructor() {
        this.apiKey = 'YOUR_API_KEY'; // ضع مفتاح API الخاص بك هنا
        this.baseUrl = 'https://api.binance.com/api/v3';
    }
    
    // جلب البيانات من Binance API
    async fetchKlineData(symbol, interval, limit = 200) {
        try {
            const url = `${this.baseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            return data.map(kline => ({
                timestamp: kline[0],
                open: parseFloat(kline[1]),
                high: parseFloat(kline[2]),
                low: parseFloat(kline[3]),
                close: parseFloat(kline[4]),
                volume: parseFloat(kline[5])
            }));
        } catch (error) {
            console.error('خطأ في جلب البيانات:', error);
            if (window.notificationManager) {
                window.notificationManager.error('خطأ في جلب البيانات من API');
            }
            return null;
        }
    }
    
    // تحويل الإطار الزمني إلى تنسيق Binance
    convertTimeframe(timeframe) {
        const mapping = {
            '1H': '1h',
            '2H': '2h',
            '4H': '4h',
            '6H': '6h',
            '8H': '8h',
            '12H': '12h',
            '1D': '1d'
        };
        return mapping[timeframe] || '4h';
    }
}

// دالة لاستخدام البيانات الحقيقية
async function useRealData() {
    try {
        if (window.notificationManager) {
            window.notificationManager.show('جاري جلب البيانات...', 'info');
        }
        
        const dataProvider = new DataProvider();
        const symbolEl = document.getElementById('symbol');
        const timeframeEl = document.getElementById('timeframe');
        
        const symbol = symbolEl ? symbolEl.value : 'BTCUSDT';
        const timeframe = timeframeEl ? timeframeEl.value : '4H';
        
        const interval = dataProvider.convertTimeframe(timeframe);
        const data = await dataProvider.fetchKlineData(symbol, interval);
        
        if (data && window.trendIndicator) {
            window.trendIndicator.data = data;
            window.trendIndicator.calculate();
            
            if (window.notificationManager) {
                window.notificationManager.success('تم جلب البيانات الحقيقية بنجاح');
            }
        } else {
            throw new Error('فشل في جلب البيانات');
        }
    } catch (error) {
        console.error('خطأ في استخدام البيانات الحقيقية:', error);
        if (window.notificationManager) {
            window.notificationManager.error('فشل في جلب البيانات الحقيقية');
        }
    }
}

// دالة تصدير البيانات
function exportData() {
    if (!window.trendIndicator || !window.trendIndicator.results) {
        if (window.notificationManager) {
            window.notificationManager.warning('لا توجد بيانات للتصدير');
        }
        return;
    }
    
    try {
        const exportData = {
            config: window.trendIndicator.config,
            results: window.trendIndicator.results,
            timestamp: new Date().toISOString()
        };
        
        if (window.exportManager) {
            window.exportManager.exportData(exportData, 'trend-indicator-data', 'json');
            if (window.notificationManager) {
                window.notificationManager.success('تم تصدير البيانات بنجاح');
            }
        }
    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);
        if (window.notificationManager) {
            window.notificationManager.error('فشل في تصدير البيانات');
        }
    }
}

// دالة حفظ الإعدادات
function saveSettings() {
    if (!window.trendIndicator || !window.storageManager) return;
    
    try {
        const settings = window.trendIndicator.config;
        window.storageManager.save('settings', settings);
        
        if (window.notificationManager) {
            window.notificationManager.success('تم حفظ الإعدادات');
        }
    } catch (error) {
        console.error('خطأ في حفظ الإعدادات:', error);
        if (window.notificationManager) {
            window.notificationManager.error('فشل في حفظ الإعدادات');
        }
    }
}

// دالة تحميل الإعدادات
function loadSettings() {
    if (!window.trendIndicator || !window.storageManager) return;
    
    try {
        const settings = window.storageManager.load('settings');
        if (settings) {
            // تحديث الإعدادات
            Object.assign(window.trendIndicator.config, settings);
            
            // تحديث واجهة المستخدم
            const elements = {
                emaFast: document.getElementById('emaFast'),
                emaSlow: document.getElementById('emaSlow'),
                atrLength: document.getElementById('atrLength'),
                atrMargin: document.getElementById('atrMargin'),
                smaLength: document.getElementById('smaLength'),
                timeframe: document.getElementById('timeframe'),
                symbol: document.getElementById('symbol')
            };
            
            if (elements.emaFast) elements.emaFast.value = settings.emaFast;
            if (elements.emaSlow) elements.emaSlow.value = settings.emaSlow;
            if (elements.atrLength) elements.atrLength.value = settings.atrLength;
            if (elements.atrMargin) elements.atrMargin.value = settings.atrMargin;
            if (elements.smaLength) elements.smaLength.value = settings.smaLength;
            if (elements.timeframe) elements.timeframe.value = settings.timeframe;
            if (elements.symbol) elements.symbol.value = settings.symbol;
            
            // إعادة حساب المؤشر
            window.trendIndicator.calculate();
            
            if (window.notificationManager) {
                window.notificationManager.success('تم تحميل الإعدادات');
            }
        }
    } catch (error) {
        console.error('خطأ في تحميل الإعدادات:', error);
        if (window.notificationManager) {
            window.notificationManager.error('فشل في تحميل الإعدادات');
        }
    }
}

// دالة إعادة تعيين الإعدادات
function resetSettings() {
    if (!window.trendIndicator) return;
    
    try {
        // الإعدادات الافتراضية
        const defaultSettings = {
            emaFast: 30,
            emaSlow: 60,
            atrLength: 60,
            atrMargin: 0.3,
            smaLength: 140,
            timeframe: '4H',
            symbol: 'BTCUSDT'
        };
        
        // تحديث الإعدادات
        Object.assign(window.trendIndicator.config, defaultSettings);
        
        // تحديث واجهة المستخدم
        const elements = {
            emaFast: document.getElementById('emaFast'),
            emaSlow: document.getElementById('emaSlow'),
            atrLength: document.getElementById('atrLength'),
            atrMargin: document.getElementById('atrMargin'),
            smaLength: document.getElementById('smaLength'),
            timeframe: document.getElementById('timeframe'),
            symbol: document.getElementById('symbol')
        };
        
        if (elements.emaFast) elements.emaFast.value = defaultSettings.emaFast;
        if (elements.emaSlow) elements.emaSlow.value = defaultSettings.emaSlow;
        if (elements.atrLength) elements.atrLength.value = defaultSettings.atrLength;
        if (elements.atrMargin) elements.atrMargin.value = defaultSettings.atrMargin;
        if (elements.smaLength) elements.smaLength.value = defaultSettings.smaLength;
        if (elements.timeframe) elements.timeframe.value = defaultSettings.timeframe;
        if (elements.symbol) elements.symbol.value = defaultSettings.symbol;
        
        // إعادة حساب المؤشر
        window.trendIndicator.generateSampleData();
        window.trendIndicator.calculate();
        
        if (window.notificationManager) {
            window.notificationManager.success('تم إعادة تعيين الإعدادات');
        }
    } catch (error) {
        console.error('خطأ في إعادة تعيين الإعدادات:', error);
        if (window.notificationManager) {
            window.notificationManager.error('فشل في إعادة تعيين الإعدادات');
        }
    }
}

// تحميل الإعدادات المحفوظة عند بدء التطبيق
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadSettings();
    }, 1000);
});
