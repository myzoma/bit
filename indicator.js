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
        this.ctx = this.canvas.getContext('2d');
        
        this.initializeEventListeners();
        this.generateSampleData();
        this.calculate();
    }

    initializeEventListeners() {
        document.getElementById('emaFast').addEventListener('change', (e) => {
            this.config.emaFast = parseInt(e.target.value);
        });
        
        document.getElementById('emaSlow').addEventListener('change', (e) => {
            this.config.emaSlow = parseInt(e.target.value);
        });
        
        document.getElementById('atrLength').addEventListener('change', (e) => {
            this.config.atrLength = parseInt(e.target.value);
        });
        
        document.getElementById('atrMargin').addEventListener('change', (e) => {
            this.config.atrMargin = parseFloat(e.target.value);
        });
        
        document.getElementById('smaLength').addEventListener('change', (e) => {
            this.config.smaLength = parseInt(e.target.value);
        });
        
        document.getElementById('timeframe').addEventListener('change', (e) => {
            this.config.timeframe = e.target.value;
        });
        
        document.getElementById('symbol').addEventListener('change', (e) => {
            this.config.symbol = e.target.value;
        });
    }

    // حساب المتوسط المتحرك الأسي
    calculateEMA(data, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
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

    // الحسابات الرئيسية
    calculate() {
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
        
        // تحديد الاتجاهات
        const currentIndex = closes.length - 1;
        const emaFastCurrent = emaFast[currentIndex];
        const emaSlowCurrent = emaSlow[currentIndex];
        const atrCurrent = atr[currentIndex] || 100;
        
        const emaDiff = emaFastCurrent - emaSlowCurrent;
        const atrThreshold = this.config.atrMargin * atrCurrent;
        
        const isBull = emaDiff > atrThreshold;
        const isBear = emaDiff < -atrThreshold;
        const isOver = emaFastCurrent > emaSlowCurrent;
        
        // تحديث واجهة المستخدم
        this.updateStatus(isBull, isBear, isOver);
        this.checkAlerts(isBull, isBear);
        this.drawChart(closes, emaFast, emaSlow, sma);
        
        // حفظ النتائج للاستخدام المستقبلي
        this.results = {
            emaFast,
            emaSlow,
            sma,
            atr,
            isBull,
            isBear,
            isOver
        };
    }

    // تحديث حالة المؤشرات
    updateStatus(isBull, isBear, isOver) {
        const timeframeStatus = document.getElementById('timeframeStatus');
        const dailyStatus = document.getElementById('dailyStatus');
        const overallTrend = document.getElementById('overallTrend');
        
        // حالة الإطار الزمني المحدد
        if (isBull) {
            timeframeStatus.textContent = 'صاعد';
            timeframeStatus.className = 'status-cell bull';
        } else if (isBear) {
            timeframeStatus.textContent = 'هابط';
            timeframeStatus.className = 'status-cell bear';
        } else {
            timeframeStatus.textContent = 'محايد';
            timeframeStatus.className = 'status-cell neutral';
        }
        
        // حالة اليومي (محاكاة)
        const dailyBull = Math.random() >
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
        this.ctx = this.canvas.getContext('2d');
        
        this.initializeEventListeners();
        this.generateSampleData();
        this.calculate();
    }

    initializeEventListeners() {
        document.getElementById('emaFast').addEventListener('change', (e) => {
            this.config.emaFast = parseInt(e.target.value);
        });
        
        document.getElementById('emaSlow').addEventListener('change', (e) => {
            this.config.emaSlow = parseInt(e.target.value);
        });
        
        document.getElementById('atrLength').addEventListener('change', (e) => {
            this.config.atrLength = parseInt(e.target.value);
        });
        
        document.getElementById('atrMargin').addEventListener('change', (e) => {
            this.config.atrMargin = parseFloat(e.target.value);
        });
        
        document.getElementById('smaLength').addEventListener('change', (e) => {
            this.config.smaLength = parseInt(e.target.value);
        });
        
        document.getElementById('timeframe').addEventListener('change', (e) => {
            this.config.timeframe = e.target.value;
        });
        
        document.getElementById('symbol').addEventListener('change', (e) => {
            this.config.symbol = e.target.value;
        });
    }

    // حساب المتوسط المتحرك الأسي
    calculateEMA(data, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
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
        const currentSMA = sma[sma.length - 1];
        const currentClose = closes[closes.length - 1];
        
        for (let days = 1; days <= 9; days++) {
            let forecast = currentSMA;
            let numerator = currentSMA * smaLength;
            
            // إضافة الأسعار المستقبلية المتوقعة
            numerator += currentClose * days;
            
            // طرح الأسعار القديمة
            for (let j = 0; j < days; j++) {
                if (smaLength - 1 - j >= 0) {
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
        const emaFastCurrent = emaFast[currentIndex];
        const emaSlowCurrent = emaSlow[currentIndex];
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
        this.drawChart(closes, emaFast, emaSlow, sma, smaForecasts);
        
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
        for (let i = 0; i < data1.length; i++) {
            if (data1[i] !== null && data2[i] !== null) {
                const x = xScale(i);
                const y = yScale(data1[i]);
                if (i === 0) {
                    ctx.moveTo(x, y);
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
        window.trendIndicator.config.emaFast = parseInt(document.getElementById('emaFast').value);
        window.trendIndicator.config.emaSlow = parseInt(document.getElementById('emaSlow').value);
        window.trendIndicator.config.atrLength = parseInt(document.getElementById('atrLength').value);
        window.trendIndicator.config.atrMargin = parseFloat(document.getElementById('atrMargin').value);
        window.trendIndicator.config.smaLength = parseInt(document.getElementById('smaLength').value);
        window.trendIndicator.config.timeframe = document.getElementById('timeframe').value;
        window.trendIndicator.config.symbol = document.getElementById('symbol').value;
        
        // إعادة توليد البيانات وإعادة الحساب
        window.trendIndicator.generateSampleData();
        window.trendIndicator.calculate();
    }
}

// تهيئة المؤشر عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    window.trendIndicator = new TrendChangeIndicator();
    
    // تحديث تلقائي كل 30 ثانية
    setInterval(() => {
        if (window.trendIndicator) {
            window.trendIndicator.generateSampleData();
            window.trendIndicator.calculate();
        }
    }, 30000);
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
            '12H': '12h'
        };
        return mapping[timeframe] || '4h';
    }
}

// دالة لاستخدام البيانات الحقيقية
async function useRealData() {
    const dataProvider = new DataProvider();
    const symbol = document.getElementById('symbol').value;
    const timeframe = document.getElementById('timeframe').value;
    
    const interval = dataProvider.convertTimeframe(timeframe);
    const data = await dataProvider.fetchKlineData(symbol, interval);
    
    if (data && window.trendIndicator) {
        window.trendIndicator.data = data;
        window.trendIndicator.calculate();
    }
}

// إضافة زر للبيانات الحقيقية في HTML
document.addEventListener('DOMContentLoaded', function() {
    const controlsDiv = document.querySelector('.controls');
    const realDataButton = document.createElement('div');
    realDataButton.className = 'control-group';
    realDataButton.innerHTML = `
        <label>&nbsp;</label>
        <button onclick="useRealData()" style="padding: 5px 15px; background-color: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">
            استخدام البيانات الحقيقية
        </button>
    `;
    controlsDiv.appendChild(realDataButton);
});
