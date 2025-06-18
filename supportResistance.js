class SupportResistanceAnalyzer {
    constructor() {
        this.leftBars = 15;
        this.rightBars = 15;
        this.volumeThreshold = 20;
        this.changeThreshold = 2;
        this.cryptoData = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadCryptoData();
        
        // تحديث تلقائي كل 30 ثانية
        setInterval(() => {
            this.loadCryptoData();
        }, 30000);
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

    // محاكاة بيانات العملات المشفرة
    async loadCryptoData() {
        this.showLoading(true);
        
        try {
            // في التطبيق الحقيقي، ستستخدم API حقيقي مثل Binance أو CoinGecko
            this.cryptoData = await this.generateMockData();
            this.analyzeBreakouts();
            this.updateStats();
            this.filterAndDisplayBreakouts();
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
        } finally {
            this.showLoading(false);
        }
    }

    async generateMockData() {
        // محاكاة بيانات العملات مع أسعار وأحجام متغيرة
        const cryptos = [
            'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT',
            'XRP/USDT', 'DOT/USDT', 'DOGE/USDT', 'AVAX/USDT', 'LUNA/USDT',
            'LINK/USDT', 'ATOM/USDT', 'LTC/USDT', 'UNI/USDT', 'ALGO/USDT',
            'MATIC/USDT', 'FTT/USDT', 'ICP/USDT', 'VET/USDT', 'TRX/USDT'
        ];

        return cryptos.map(symbol => {
            const basePrice = Math.random() * 1000 + 10;
            const priceHistory = this.generatePriceHistory(basePrice, 50);
            const volumeHistory = this.generateVolumeHistory(50);
            
            return {
                symbol,
                currentPrice: priceHistory[priceHistory.length - 1].close,
                priceHistory,
                volumeHistory,
                volume24h: volumeHistory[volumeHistory.length - 1] * Math.random() * 1000000,
                marketCap: basePrice * Math.random() * 1000000000,
                change24h: (Math.random() - 0.5) * 20,
                liquidity: Math.random() * 10000000
            };
        });
    }

    generatePriceHistory(basePrice, length) {
        const history = [];
        let currentPrice = basePrice;
        
        for (let i = 0; i < length; i++) {
            const change = (Math.random() - 0.5) * 0.1;
            currentPrice *= (1 + change);
            
            const high = currentPrice * (1 + Math.random() * 0.05);
            const low = currentPrice * (1 - Math.random() * 0.05);
            const open = i === 0 ? currentPrice : history[i-1].close;
            
            history.push({
                open,
                high,
                low,
                close: currentPrice,
                timestamp: Date.now() - (length - i) * 3600000
            });
        }
        
        return history;
    }

    generateVolumeHistory(length) {
        const baseVolume = Math.random() * 1000000;
        return Array.from({length}, () => baseVolume * (0.5 + Math.random()));
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
            const lastCandle = crypto.priceHistory[crypto.priceHistory.length - 1];
            
            // العثور على أحدث مستويات المقاومة والدعم
            const latestResistance = pivotHighs.length > 0 ? 
                pivotHighs[pivotHighs.length - 1].price : null;
            const latestSupport = pivotLows.length > 0 ? 
                pivotLows[pivotLows.length - 1].price : null;
            
            // فحص الاختراق الصعودي
            const bullishBreakout = latestResistance && 
                currentPrice > latestResistance && 
                volumeOsc > this.volumeThreshold &&
                Math.abs(crypto.change24h) > this.changeThreshold;
            
            // حساب الأهداف (المقاومات التالية)
            const targets = this.calculateTargets(currentPrice, pivotHighs, latestResistance);
            
            crypto.analysis = {
                pivotHighs,
                pivotLows,
                latestResistance,
                latestSupport,
                volumeOscillator: volumeOsc,
                bullishBreakout,
                targets,
                breakoutStrength: this.calculateBreakoutStrength(crypto, volumeOsc)
            };
        });
    }

    calculateTargets(currentPrice, pivotHighs, latestResistance) {
        const targets = [];
        
        // الهدف الأول: المقاومة التالية
        const nextResistance = pivotHighs.find(pivot => pivot.price > currentPrice);
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
        const percentTarget = currentPrice * 1.1; // 10% أعلى
        targets.push({
            level: percentTarget,
            type: 'هدف 10%',
            distance: '10.00'
        });
        
        return targets.slice(0, 3); // أول 3 أهداف فقط
    }

    calculateBreakoutStrength(crypto, volumeOsc) {
        let strength = 0;
        
        // قوة الحجم (40%)
        strength += Math.min(volumeOsc / 100, 0.4);
        
        // قوة التغيير السعري (30%)
        strength += Math.min(Math.abs(crypto.change24h) / 50, 0.3);
        
        // السيولة (20%)
        const liquidityScore = Math.min(crypto.liquidity / 10000000, 0.2);
        strength += liquidityScore;
        
        // حجم التداول (10%)
        const volumeScore = Math.min(crypto.volume24h / 100000000, 0.1);
        strength += volumeScore;
        
        return Math.min(strength * 100, 100);
    }

    filterAndDisplayBreakouts() {
        const breakouts = this.cryptoData.filter(crypto => 
            crypto.analysis && crypto.analysis.bullishBreakout
        );
        
        // ترتيب حسب قوة الاختراق
        breakouts.sort((a, b) => b.analysis.breakoutStrength - a.analysis.breakoutStrength);
        
        this.displayBreakouts(breakouts);
        document.getElementById('activeBreakouts').textContent = breakouts.length;
    }

    displayBreakouts(breakouts) {
        const grid = document.getElementById('cryptoGrid');
         // إنشاء العنصر إذا لم يكن موجوداً
    if (!grid) {
        const newGrid = document.createElement('div');
        newGrid.id = 'cryptoGrid';
        newGrid.className = 'crypto-grid';
        document.body.appendChild(newGrid);
        return this.displayBreakouts(breakouts); // إعادة استدعاء الدالة
    }
        const noResults = document.getElementById('noResults');
        
        if (breakouts.length === 0) {
            grid.innerHTML = '';
            noResults.style.display = 'block';
            return;
        }
        
        noResults.style.display = 'none';
        
        grid.innerHTML = breakouts.map(crypto => this.createCryptoCard(crypto)).join('');
    }

       createCryptoCard(crypto) {
        const analysis = crypto.analysis;
        const strengthClass = this.getStrengthClass(analysis.breakoutStrength);
        const targetsHtml = analysis.targets.map(target => `
            <div class="target-item">
                <span class="target-type">${target.type}</span>
                <span class="target-price">$${target.level.toFixed(4)}</span>
                <span class="target-distance">+${target.distance}%</span>
            </div>
        `).join('');

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
                        <span class="level-value">$${analysis.latestResistance.toFixed(6)}</span>
                    </div>
                    <div class="breakout-distance">
                        <span class="distance-text">
                            المسافة: ${(((crypto.currentPrice - analysis.latestResistance) / analysis.latestResistance) * 100).toFixed(2)}%
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

    updateStats() {
        document.getElementById('totalCoins').textContent = this.cryptoData.length;
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('ar-SA');
    }

  showLoading(show) {
    let spinner = document.getElementById('loadingSpinner');
    let grid = document.getElementById('cryptoGrid');
    
    // إنشاء العناصر إذا لم تكن موجودة
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'loadingSpinner';
        spinner.innerHTML = '<div class="spinner"></div><p>جاري التحميل...</p>';
        spinner.style.display = 'none';
        document.body.appendChild(spinner);
    }
    
    if (!grid) {
        grid = document.createElement('div');
        grid.id = 'cryptoGrid';
        grid.className = 'crypto-grid';
        document.body.appendChild(grid);
    }
    
    if (show) {
        spinner.style.display = 'flex';
        grid.style.opacity = '0.5';
    } else {
        spinner.style.display = 'none';
        grid.style.opacity = '1';
    }
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
                                    <span class="level-value">$${analysis.latestResistance.toFixed(6)}</span>
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
                                <p><strong>نوع الاختراق:</strong> اختراق صعودي بحجم عالي</p>
                            </div>
                        </div>

                        <div class="analysis-section">
                            <h3>السيناريوهات المتوقعة</h3>
                            <div class="scenarios">
                                <div class="scenario bullish">
                                    <h4>🟢 السيناريو الإيجابي (احتمالية 70%)</h4>
                                    <p>استمرار الاتجاه الصعودي نحو الأهداف المحددة</p>
                                </div>
                                <div class="scenario neutral">
                                    <h4>🟡 السيناريو المحايد (احتمالية 20%)</h4>
                                    <p>تماسك حول المستوى الحالي مع تذبذب محدود</p>
                                </div>
                                <div class="scenario bearish">
                                    <h4>🔴 السيناريو السلبي (احتمالية 10%)</h4>
                                    <p>عودة تحت مستوى المقاومة المخترقة</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalContent);
    }

    // إنشاء تنبيه
    setAlert(symbol) {
        const crypto = this.cryptoData.find(c => c.symbol === symbol);
        if (!crypto) return;

        const alertContent = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content alert-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>إنشاء تنبيه - ${symbol}</h2>
                        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="alert-form">
                            <div class="form-group">
                                <label>نوع التنبيه:</label>
                                <select id="alertType">
                                    <option value="price">تنبيه سعر</option>
                                    <option value="volume">تنبيه حجم</option>
                                    <option value="breakout">تنبيه اختراق</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>السعر المستهدف:</label>
                                <input type="number" id="targetPrice" value="${crypto.currentPrice.toFixed(6)}" step="0.000001">
                            </div>
                            <div class="form-group">
                                <label>طريقة التنبيه:</label>
                                <div class="checkbox-group">
                                    <label><input type="checkbox" checked> إشعار متصفح</label>
                                    <label><input type="checkbox"> بريد إلكتروني</label>
                                    <label><input type="checkbox"> رسالة نصية</label>
                                </div>
                            </div>
                            <button class="btn-primary" onclick="analyzer.createAlert('${symbol}'); this.closest('.modal-overlay').remove();">
                                إنشاء التنبيه
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', alertContent);
    }

    createAlert(symbol) {
        // في التطبيق الحقيقي، ستحفظ التنبيه في قاعدة البيانات
        alert(`تم إنشاء تنبيه لـ ${symbol} بنجاح!`);
        
        // طلب إذن الإشعارات
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
}

// تشغيل التطبيق
const analyzer = new SupportResistanceAnalyzer();

// إشعارات المتصفح للاختراقات الجديدة
function showBreakoutNotification(symbol, price) {
    if (Notification.permission === 'granted') {
        new Notification(`اختراق صعودي جديد!`, {
            body: `${symbol} اخترق المقاومة عند $${price}`,
            icon: '/favicon.ico',
            tag: symbol
        });
    }
}
