class SupportResistanceAnalyzer {
    constructor() {
        this.leftBars = 15;
        this.rightBars = 15;
        this.volumeThreshold = 20;
        this.changeThreshold = 2;
        this.cryptoData = [];
        this.binanceBaseUrl = 'https://api1.binance.com/api/v3';
        this.updateInterval = 15 * 60 * 1000; // 15 دقيقة
        this.maxResults = 10; // أفضل 10 عملات فقط
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadCryptoData();
        
        // تحديث تلقائي كل 15 دقيقة
        setInterval(() => {
            this.loadCryptoData();
        }, this.updateInterval);
    }

    bindEvents() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadCryptoData();
        });

        document.getElementById('volumeThreshold').addEventListener('change', (e) => {
            this.volumeThreshold = parseFloat(e.target.value);
            this.filterAndDisplayBreakouts();
        });

        document.getElementById('changeThreshold').addEventListener('change', (e) => {
            this.changeThreshold = parseFloat(e.target.value);
            this.filterAndDisplayBreakouts();
        });
    }

    // جلب قائمة العملات النشطة من Binance
    async fetchTradingPairs() {
        try {
            const response = await fetch(`${this.binanceBaseUrl}/exchangeInfo`);
            const data = await response.json();
            
            // فلترة العملات المقترنة بـ USDT والنشطة فقط
            const usdtPairs = data.symbols
                .filter(symbol => 
                    symbol.symbol.endsWith('USDT') && 
                    symbol.status === 'TRADING' &&
                    !symbol.symbol.includes('UP') &&
                    !symbol.symbol.includes('DOWN') &&
                    !symbol.symbol.includes('BULL') &&
                    !symbol.symbol.includes('BEAR')
                )
                .map(symbol => symbol.symbol)
                .slice(0, 50); // أخذ أول 50 عملة للتحليل
            
            return usdtPairs;
        } catch (error) {
            console.error('خطأ في جلب أزواج التداول:', error);
            return [];
        }
    }

    // جلب بيانات السعر الحالي والتغيير 24 ساعة
    async fetch24hrStats() {
        try {
            const response = await fetch(`${this.binanceBaseUrl}/ticker/24hr`);
            const data = await response.json();
            
            // فلترة العملات المقترنة بـ USDT فقط
            return data.filter(ticker => ticker.symbol.endsWith('USDT'));
        } catch (error) {
            console.error('خطأ في جلب إحصائيات 24 ساعة:', error);
            return [];
        }
    }

    // جلب بيانات الشموع اليابانية
    async fetchKlineData(symbol, interval = '1h', limit = 100) {
        try {
            const response = await fetch(
                `${this.binanceBaseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
            );
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
            console.error(`خطأ في جلب بيانات الشموع لـ ${symbol}:`, error);
            return [];
        }
    }

    // جلب بيانات عمق السوق للسيولة
    async fetchOrderBookDepth(symbol) {
        try {
            const response = await fetch(
                `${this.binanceBaseUrl}/depth?symbol=${symbol}&limit=100`
            );
            const data = await response.json();
            
            // حساب السيولة من عمق السوق
            const bidLiquidity = data.bids.reduce((sum, bid) => 
                sum + (parseFloat(bid[0]) * parseFloat(bid[1])), 0
            );
            const askLiquidity = data.asks.reduce((sum, ask) => 
                sum + (parseFloat(ask[0]) * parseFloat(ask[1])), 0
            );
            
            return bidLiquidity + askLiquidity;
        } catch (error) {
            console.error(`خطأ في جلب عمق السوق لـ ${symbol}:`, error);
            return 0;
        }
    }

    // تحميل البيانات الحقيقية من Binance
    async loadCryptoData() {
        this.showLoading(true);
        
        try {
            console.log('جاري تحميل البيانات من Binance...');
            
            // جلب إحصائيات 24 ساعة لجميع العملات
            const stats24hr = await this.fetch24hrStats();
            
            // فلترة العملات بناءً على الحجم والتغيير
            const filteredStats = stats24hr
                .filter(stat => {
                    const change = parseFloat(stat.priceChangePercent);
                    const volume = parseFloat(stat.volume);
                    return change > this.changeThreshold && volume > 1000;
                })
                .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
                .slice(0, 30); // أخذ أفضل 30 عملة للتحليل التفصيلي

            console.log(`تم العثور على ${filteredStats.length} عملة مرشحة للتحليل`);

            // تحليل كل عملة بالتفصيل
            const cryptoPromises = filteredStats.map(async (stat) => {
                try {
                    const symbol = stat.symbol;
                    const klineData = await this.fetchKlineData(symbol);
                    
                    if (klineData.length < 50) return null;

                    const liquidity = await this.fetchOrderBookDepth(symbol);
                    
                    return {
                        symbol: symbol.replace('USDT', '/USDT'),
                        currentPrice: parseFloat(stat.lastPrice),
                        priceHistory: klineData,
                        volumeHistory: klineData.map(k => k.volume),
                        volume24h: parseFloat(stat.volume),
                        change24h: parseFloat(stat.priceChangePercent),
                        liquidity: liquidity,
                        marketCap: parseFloat(stat.lastPrice) * parseFloat(stat.volume), // تقدير تقريبي
                        rawData: stat
                    };
                } catch (error) {
                    console.error(`خطأ في معالجة ${stat.symbol}:`, error);
                    return null;
                }
            });

            // انتظار جميع الطلبات مع معالجة الأخطاء
            const results = await Promise.allSettled(cryptoPromises);
            this.cryptoData = results
                .filter(result => result.status === 'fulfilled' && result.value !== null)
                .map(result => result.value);

            console.log(`تم تحليل ${this.cryptoData.length} عملة بنجاح`);

            // تحليل الاختراقات
            this.analyzeBreakouts();
            
            // تحديث الإحصائيات
            this.updateStats();
            
            // عرض أفضل النتائج
            this.filterAndDisplayBreakouts();
            
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            this.showError('فشل في تحميل البيانات من Binance. سيتم المحاولة مرة أخرى...');
        } finally {
            this.showLoading(false);
        }
    }

    // حساب نقاط الدعم والمقاومة
    calculatePivotPoints(priceHistory) {
        const pivotHighs = [];
        const pivotLows = [];
        
        for (let i = this.leftBars; i < priceHistory.length - this.rightBars; i++) {
            let isHigh = true;
            let isLow = true;
            
            // فحص النقاط المحورية العالية
            for (let j = i - this.leftBars; j <= i + this.rightBars; j++) {
                if (j !== i && priceHistory[j].high >= priceHistory[i].high) {
                    isHigh = false;
                    break;
                }
            }
            
            // فحص النقاط المحورية المنخفضة
            for (let j = i - this.leftBars; j <= i + this.rightBars; j++) {
                if (j !== i && priceHistory[j].low <= priceHistory[i].low) {
                    isLow = false;
                    break;
                }
            }
            
            if (isHigh) {
                pivotHighs.push({
                    index: i,
                    price: priceHistory[i].high,
                    timestamp: priceHistory[i].timestamp
                });
            }
            
            if (isLow) {
                pivotLows.push({
                    index: i,
                    price: priceHistory[i].low,
                    timestamp: priceHistory[i].timestamp
                });
            }
        }
        
        return { pivotHighs, pivotLows };
    }

    // حساب مؤشر الحجم
    calculateVolumeOscillator(volumeHistory) {
        if (volumeHistory.length < 10) return 0;
        
        const shortEMA = this.calculateEMA(volumeHistory.slice(-5), 5);
        const longEMA = this.calculateEMA(volumeHistory.slice(-10), 10);
        
        return longEMA !== 0 ? 100 * (shortEMA - longEMA) / longEMA : 0;
    }

    calculateEMA(data, period) {
        if (data.length === 0) return 0;
        
        const multiplier = 2 / (period + 1);
        let ema = data[0];
        
        for (let i = 1; i < data.length; i++) {
            ema = (data[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }

    // تحليل الاختراقات
    analyzeBreakouts() {
        this.cryptoData.forEach(crypto => {
            const { pivotHighs, pivotLows } = this.calculatePivotPoints(crypto.priceHistory);
            const volumeOsc = this.calculateVolumeOscillator(crypto.volumeHistory);
            const currentPrice = crypto.currentPrice;
            
            // العثور على أحدث مستويات المقاومة والدعم
            const latestResistance = pivotHighs.length > 0 ? 
                pivotHighs[pivotHighs.length - 1].price : null;
            const latestSupport = pivotLows.length > 0 ? 
                pivotLows[pivotLows.length - 1].price : null;
            
            // فحص الاختراق الصعودي مع شروط أكثر دقة
            const bullishBreakout = latestResistance && 
                currentPrice > latestResistance && 
                volumeOsc > this.volumeThreshold &&
                crypto.change24h > this.changeThreshold &&
                crypto.volume24h > 100000; // حد أدنى للحجم
            
            // حساب الأهداف
            const targets = this.calculateTargets(currentPrice, pivotHighs, latestResistance);
            
            // حساب قوة الاختراق
            const breakoutStrength = this.calculateBreakoutStrength(crypto, volumeOsc, latestResistance);
            
            crypto.analysis = {
                pivotHighs,
                pivotLows,
                latestResistance,
                latestSupport,
                volumeOscillator: volumeOsc,
                bullishBreakout,
                targets,
                breakoutStrength
            };
        });
    }

    calculateTargets(currentPrice, pivotHighs, latestResistance) {
        const targets = [];
        
        // الهدف الأول: المقاومة التالية
        const nextResistance = pivotHighs
            .filter(pivot => pivot.price > currentPrice)
            .sort((a, b) => a.price - b.price)[0];
            
        if (nextResistance) {
            targets.push({
                level: nextResistance.price,
                type: 'مقاومة تالية',
                distance: ((nextResistance.price - currentPrice) / currentPrice * 100).toFixed(2)
            });
        }
        
        // الهدف الثاني: إسقاط فيبوناتشي
        if (latestResistance) {
            const fibTarget = currentPrice + (currentPrice - latestResistance) * 1.618;
            targets.push({
                level: fibTarget,
                type: 'هدف فيبوناتشي 161.8%',
                distance: ((fibTarget - currentPrice) / currentPrice * 100).toFixed(2)
            });
        }
        
        // الهدف الثالث: نسبة مئوية ثابتة
        const percentTarget = currentPrice * 1.05; // 5% أعلى
        targets.push({
            level: percentTarget,
            type: 'هدف 5%',
            distance: '5.00'
        });
        
        return targets.slice(0, 3);
    }

      calculateBreakoutStrength(crypto, volumeOsc, latestResistance) {
        let strength = 0;
        
        // قوة الحجم (30%)
        const volumeStrength = Math.min(volumeOsc / 100, 0.3);
        strength += Math.max(0, volumeStrength);
        
        // قوة التغيير السعري (25%)
        const changeStrength = Math.min(crypto.change24h / 20, 0.25);
        strength += Math.max(0, changeStrength);
        
        // قوة الاختراق (25%)
        if (latestResistance) {
            const breakoutPercent = ((crypto.currentPrice - latestResistance) / latestResistance) * 100;
            const breakoutStrength = Math.min(breakoutPercent / 10, 0.25);
            strength += Math.max(0, breakoutStrength);
        }
        
        // قوة السيولة (20%)
        const liquidityStrength = Math.min(crypto.liquidity / 10000000, 0.2);
        strength += Math.max(0, liquidityStrength);
        
        return Math.min(strength * 100, 100);
    }

    // فلترة وعرض أفضل الاختراقات
    filterAndDisplayBreakouts() {
        const breakouts = this.cryptoData
            .filter(crypto => crypto.analysis && crypto.analysis.bullishBreakout)
            .sort((a, b) => b.analysis.breakoutStrength - a.analysis.breakoutStrength)
            .slice(0, this.maxResults); // أفضل 10 عملات فقط

        console.log(`تم العثور على ${breakouts.length} اختراق صعودي`);
        
        this.displayBreakouts(breakouts);
        this.updateStats(breakouts.length);
    }

    displayBreakouts(breakouts) {
        const grid = document.getElementById('cryptoGrid');
        
        if (breakouts.length === 0) {
            grid.innerHTML = `
                <div class="no-results">
                    <h3>🔍 لا توجد اختراقات صعودية حالياً</h3>
                    <p>جاري البحث عن فرص جديدة...</p>
                    <p>آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = breakouts.map(crypto => this.createCryptoCard(crypto)).join('');
        
        // إضافة تأثير الظهور التدريجي
        const cards = grid.querySelectorAll('.crypto-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('fade-in');
        });
    }

    createCryptoCard(crypto) {
        const analysis = crypto.analysis;
        const strengthClass = this.getStrengthClass(analysis.breakoutStrength);
        const targetsHtml = analysis.targets.map(target => `
            <div class="target-item">
                <span class="target-type">${target.type}</span>
                <span class="target-price">$${parseFloat(target.level).toFixed(6)}</span>
                <span class="target-distance">+${target.distance}%</span>
            </div>
        `).join('');

        const breakoutDistance = analysis.latestResistance ? 
            (((crypto.currentPrice - analysis.latestResistance) / analysis.latestResistance) * 100).toFixed(2) : '0.00';

        return `
            <div class="crypto-card ${strengthClass}">
                <div class="card-header">
                    <div class="crypto-symbol">
                        <h3>${crypto.symbol}</h3>
                        <span class="breakout-badge">🚀 اختراق صعودي</span>
                    </div>
                    <div class="strength-indicator">
                        <div class="strength-bar">
                            <div class="strength-fill" style="width: ${analysis.breakoutStrength}%"></div>
                        </div>
                        <span class="strength-text">${analysis.breakoutStrength.toFixed(1)}%</span>
                    </div>
                </div>

                <div class="price-info">
                    <div class="current-price">
                        <span class="price-label">السعر الحالي:</span>
                        <span class="price-value">$${crypto.currentPrice.toFixed(6)}</span>
                    </div>
                    <div class="price-change ${crypto.change24h >= 0 ? 'positive' : 'negative'}">
                        <span>${crypto.change24h >= 0 ? '↗' : '↘'} ${Math.abs(crypto.change24h).toFixed(2)}%</span>
                    </div>
                </div>

                <div class="resistance-info">
                    <div class="resistance-level">
                        <span class="level-label">مستوى الاختراق:</span>
                        <span class="level-value">$${analysis.latestResistance ? analysis.latestResistance.toFixed(6) : 'غير محدد'}</span>
                    </div>
                    <div class="breakout-distance">
                        <span class="distance-text">
                            المسافة: +${breakoutDistance}%
                        </span>
                    </div>
                </div>

                <div class="targets-section">
                    <h4>🎯 الأهداف المتوقعة</h4>
                    <div class="targets-list">
                        ${targetsHtml}
                    </div>
                </div>

                <div class="market-data">
                    <div class="data-row">
                        <div class="data-item">
                            <span class="data-label">الحجم 24س:</span>
                            <span class="data-value">$${this.formatNumber(crypto.volume24h)}</span>
                        </div>
                        <div class="data-item">
                            <span class="data-label">السيولة:</span>
                            <span class="data-value">$${this.formatNumber(crypto.liquidity)}</span>
                        </div>
                    </div>
                    <div class="data-row">
                        <div class="data-item">
                            <span class="data-label">مؤشر الحجم:</span>
                            <span class="data-value volume-osc ${analysis.volumeOscillator > 0 ? 'positive' : 'negative'}">
                                ${analysis.volumeOscillator.toFixed(1)}%
                            </span>
                        </div>
                        <div class="data-item">
                            <span class="data-label">القيمة السوقية:</span>
                            <span class="data-value">$${this.formatNumber(crypto.marketCap)}</span>
                        </div>
                    </div>
                </div>

                <div class="card-footer">
                    <div class="timestamp">
                        آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}
                    </div>
                    <div class="action-buttons">
                        <button class="btn-small btn-analyze" onclick="analyzer.showDetailedAnalysis('${crypto.symbol}')">
                            تحليل مفصل
                        </button>
                        <button class="btn-small btn-alert" onclick="analyzer.setAlert('${crypto.symbol}')">
                            إنشاء تنبيه
                        </button>
                        <a href="https://www.binance.com/en/trade/${crypto.symbol.replace('/', '_')}" 
                           target="_blank" class="btn-small btn-trade">
                            تداول
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    getStrengthClass(strength) {
        if (strength >= 80) return 'strength-very-high';
        if (strength >= 60) return 'strength-high';
        if (strength >= 40) return 'strength-medium';
        return 'strength-low';
    }

    formatNumber(num) {
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toFixed(2);
    }

    updateStats(breakoutCount = 0) {
        document.getElementById('totalCoins').textContent = breakoutCount;
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('ar-SA');
        
        // إضافة إحصائيات إضافية
        const nextUpdate = new Date(Date.now() + this.updateInterval);
        document.getElementById('nextUpdate').textContent = nextUpdate.toLocaleTimeString('ar-SA');
    }

    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        const grid = document.getElementById('cryptoGrid');
        
        if (show) {
            spinner.style.display = 'flex';
            grid.style.opacity = '0.5';
        } else {
            spinner.style.display = 'none';
            grid.style.opacity = '1';
        }
    }

    showError(message) {
        const grid = document.getElementById('cryptoGrid');
        grid.innerHTML = `
            <div class="error-message">
                <h3>⚠️ خطأ في التحميل</h3>
                <p>${message}</p>
                <button class="btn-primary" onclick="analyzer.loadCryptoData()">
                    إعادة المحاولة
                </button>
            </div>
        `;
    }

    // عرض تحليل مفصل
    showDetailedAnalysis(symbol) {
        const crypto = this.cryptoData.find(c => c.symbol === symbol);
        if (!crypto) return;

        const analysis = crypto.analysis;
        const modalContent = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>تحليل مفصل - ${symbol}</h2>
                        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="analysis-section">
                            <h3>نقاط الدعم والمقاومة</h3>
                            <div class="levels-grid">
                                <div class="level-item resistance">
                                    <span class="level-label">آخر مقاومة:</span>
                                    <span class="level-value">$${analysis.latestResistance ? analysis.latestResistance.toFixed(6) : 'غير محدد'}</span>
                                </div>
                                <div class="level-item support">
                                    <span class="level-label">آخر دعم:</span>
                                    <span class="level-value">$${analysis.latestSupport ? analysis.latestSupport.toFixed(6) : 'غير محدد'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="analysis-section">
                            <h3>تفاصيل الاختراق</h3>
                            <div class="breakout-details">
                                <p><strong>قوة الاختراق:</strong> ${analysis.breakoutStrength.toFixed(1)}%</p>
                                <p><strong>مؤشر الحجم:</strong> ${analysis.volumeOscillator.toFixed(2)}%</p>
                                <p><strong>التغيير 24 ساعة:</strong> ${crypto.change24h.toFixed(2)}%</p>
                                <p><strong>الحجم 24 ساعة:</strong> $${this.formatNumber(crypto.volume24h)}</p>
                                <p><strong>السيولة:</strong> $${this.formatNumber(crypto.liquidity)}</p>
                            </div>
                        </div>

                        <div class="analysis-section">
                            <h3>نقاط المحورية</h3>
                            <div class="pivot-points">
                                <div class="pivot-highs">
                                    <h4>نقاط المقاومة (${analysis.pivotHighs.length})</h4>
                                    ${analysis.pivotHighs.slice(-3).map(pivot => `
                                        <div class="pivot-item">
                                            <span>$${pivot.price.toFixed(6)}</span>
                                            <small>${new Date(pivot.timestamp).toLocaleDateString('ar-SA')}</small>
                                        </div>
                                    `).join('')}
                                </div>
                                <div class="pivot-lows">
                                    <h4>نقاط الدعم (${analysis.pivotLows.length})</h4>
                                    ${analysis.pivotLows.slice(-3).map(pivot => `
                                        <div class="pivot-item">
                                            <span>$${pivot.price.toFixed(6)}</span>
                                            <small>${new Date(pivot.timestamp).toLocaleDateString('ar-SA')}</small>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <div class="analysis-section">
                            <h3>السيناريوهات المتوقعة</h3>
                            <div class="scenarios">
                                <div class="scenario bullish">
                                    <h4>🟢 السيناريو الإيجابي (احتمالية ${this.calculateBullishProbability(analysis)}%)</h4>
                                    <p>استمرار الاتجاه الصعودي نحو الأهداف المحددة</p>
                                </div>
                                <div class="scenario neutral">
                                    <h4>🟡 السيناريو المحايد (احتمالية 25%)</h4>
                                    <p>تماسك حول المستوى الحالي مع تذبذب محدود</p>
                                </div>
                                <div class="scenario bearish">
                                    <h4>🔴 السيناريو السلبي (احتمالية ${100 - this.calculateBullishProbability(analysis) - 25}%)</h4>
                                    <p>عودة تحت مستوى المقاومة المخترقة</p>
                                                    </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalContent);
    }

    calculateBullishProbability(analysis) {
        let probability = 50; // احتمالية أساسية
        
        // زيادة الاحتمالية بناءً على قوة الاختراق
        probability += (analysis.breakoutStrength / 100) * 30;
        
        // زيادة الاحتمالية بناءً على مؤشر الحجم
        if (analysis.volumeOscillator > 50) probability += 15;
        else if (analysis.volumeOscillator > 20) probability += 10;
        
        return Math.min(Math.round(probability), 75);
    }

    // إنشاء تنبيه
    setAlert(symbol) {
        const crypto = this.cryptoData.find(c => c.symbol === symbol);
        if (!crypto) return;

        const modalContent = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content alert-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>إنشاء تنبيه - ${symbol}</h2>
                        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <form class="alert-form" onsubmit="analyzer.createAlert(event, '${symbol}')">
                            <div class="form-group">
                                <label>نوع التنبيه:</label>
                                <select name="alertType" required>
                                    <option value="price_above">السعر أعلى من</option>
                                    <option value="price_below">السعر أقل من</option>
                                    <option value="volume_spike">ارتفاع الحجم</option>
                                    <option value="breakout">اختراق جديد</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>القيمة المستهدفة:</label>
                                <input type="number" name="targetValue" step="0.000001" 
                                      value="${crypto.currentPrice.toFixed(8)}" step="0.00000001" min="0" required>

                            </div>
                            
                            <div class="form-group">
                                <div class="checkbox-group">
                                    <label>
                                        <input type="checkbox" name="emailAlert" checked>
                                        تنبيه بالإيميل
                                    </label>
                                    <label>
                                        <input type="checkbox" name="browserAlert" checked>
                                        تنبيه المتصفح
                                    </label>
                                    <label>
                                        <input type="checkbox" name="soundAlert">
                                        تنبيه صوتي
                                    </label>
                                </div>
                            </div>
                            
                            <button type="submit" class="btn-primary">إنشاء التنبيه</button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalContent);
    }

    createAlert(event, symbol) {
        event.preventDefault();
        const formData = new FormData(event.target);
        
        const alert = {
            id: Date.now(),
            symbol: symbol,
            type: formData.get('alertType'),
            targetValue: parseFloat(formData.get('targetValue')),
            emailAlert: formData.get('emailAlert') === 'on',
            browserAlert: formData.get('browserAlert') === 'on',
            soundAlert: formData.get('soundAlert') === 'on',
            created: new Date(),
            active: true
        };

        // حفظ التنبيه في localStorage
        const alerts = JSON.parse(localStorage.getItem('cryptoAlerts') || '[]');
        alerts.push(alert);
        localStorage.setItem('cryptoAlerts', JSON.stringify(alerts));

        // طلب إذن التنبيهات
        if (alert.browserAlert && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // إغلاق النافذة وإظهار رسالة نجاح
        event.target.closest('.modal-overlay').remove();
        this.showSuccessMessage(`تم إنشاء التنبيه لـ ${symbol} بنجاح!`);
    }

    // فحص التنبيهات
    checkAlerts() {
        const alerts = JSON.parse(localStorage.getItem('cryptoAlerts') || '[]');
        const activeAlerts = alerts.filter(alert => alert.active);

        activeAlerts.forEach(alert => {
            const crypto = this.cryptoData.find(c => c.symbol === alert.symbol);
            if (!crypto) return;

            let triggered = false;
            let message = '';

            switch (alert.type) {
                case 'price_above':
                    if (crypto.currentPrice >= alert.targetValue) {
                        triggered = true;
                        message = `${alert.symbol} وصل إلى $${crypto.currentPrice.toFixed(6)} (الهدف: $${alert.targetValue})`;
                    }
                    break;
                case 'price_below':
                    if (crypto.currentPrice <= alert.targetValue) {
                        triggered = true;
                        message = `${alert.symbol} انخفض إلى $${crypto.currentPrice.toFixed(6)} (الهدف: $${alert.targetValue})`;
                    }
                    break;
                case 'volume_spike':
                    if (crypto.analysis && crypto.analysis.volumeOscillator > alert.targetValue) {
                        triggered = true;
                        message = `${alert.symbol} ارتفاع حجم غير عادي: ${crypto.analysis.volumeOscillator.toFixed(1)}%`;
                    }
                    break;
                case 'breakout':
                    if (crypto.analysis && crypto.analysis.bullishBreakout) {
                        triggered = true;
                        message = `${alert.symbol} اختراق صعودي جديد!`;
                    }
                    break;
            }

            if (triggered) {
                this.triggerAlert(alert, message);
                // إلغاء تفعيل التنبيه
                alert.active = false;
                localStorage.setItem('cryptoAlerts', JSON.stringify(alerts));
            }
        });
    }

       triggerAlert(alert, message) {
        // تنبيه المتصفح
        if (alert.browserAlert && Notification.permission === 'granted') {
            new Notification('تنبيه العملات الرقمية', {
                body: message,
                icon: '/favicon.ico'
            });
        }

        // عرض رسالة في الصفحة
        this.showSuccessMessage(message);
    }

    showSuccessMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'success-message';
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
showErrorMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'error-message';
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

    // تشغيل فحص التنبيهات مع كل تحديث
    startAlertMonitoring() {
        setInterval(() => {
            this.checkAlerts();
        }, 60000); // فحص كل دقيقة
    }
}

// تهيئة التطبيق
const analyzer = new SupportResistanceAnalyzer();

// بدء مراقبة التنبيهات
analyzer.startAlertMonitoring();

// طلب إذن التنبيهات عند تحميل الصفحة
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}
// معالج الأخطاء العامة
window.addEventListener('error', (event) => {
    console.error('خطأ عام:', event.error);
});

// معالج Promise غير المعالجة
window.addEventListener('unhandledrejection', (event) => {
    console.error('خطأ Promise:', event.reason);
    event.preventDefault();
});


