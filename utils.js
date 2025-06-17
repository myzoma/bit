// ملف المساعدات والوظائف الإضافية

// فئة لإدارة الإشعارات
class NotificationManager {
    constructor() {
        this.notifications = [];
    }
    
    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // إزالة الإشعار بعد المدة المحددة
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.5s ease-out';
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 500);
            }
        }, duration);
        
        return notification;
    }
    
    success(message) {
        return this.show(message, 'success');
    }
    
    error(message) {
        return this.show(message, 'error');
    }
    
    warning(message) {
        return this.show(message, 'warning');
    }
}

// فئة لإدارة التخزين المحلي
class StorageManager {
    constructor(prefix = 'trendIndicator_') {
        this.prefix = prefix;
    }
    
    save(key, data) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('خطأ في حفظ البيانات:', error);
            return false;
        }
    }
    
    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            return defaultValue;
        }
    }
    
    remove(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.error('خطأ في حذف البيانات:', error);
            return false;
        }
    }
    
    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('خطأ في مسح البيانات:', error);
            return false;
        }
    }
}

// فئة لإدارة الصوت
class SoundManager {
    constructor() {
        this.sounds = {
            alert: this.createBeep(800, 200),
            warning: this.createBeep(600, 300),
            success: this.createBeep(1000, 150)
        };
        this.enabled = true;
    }
    
    createBeep(frequency, duration) {
        return () => {
            if (!this.enabled) return;
            
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration / 1000);
        };
    }
    
    play(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName]();
        }
    }
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// فئة لإدارة الاختصارات
class KeyboardManager {
    constructor() {
        this.shortcuts = new Map();
        this.init();
    }
    
    init() {
        document.addEventListener('keydown', (e) => {
            const key = this.getKeyString(e);
            if (this.shortcuts.has(key)) {
                e.preventDefault();
                this.shortcuts.get(key)();
            }
        });
    }
    
    getKeyString(event) {
        let key = '';
        if (event.ctrlKey) key += 'Ctrl+';
        if (event.altKey) key += 'Alt+';
        if (event.shiftKey) key += 'Shift+';
        key += event.key;
        return key;
    }
    
    register(keyString, callback) {
        this.shortcuts.set(keyString, callback);
    }
    
    unregister(keyString) {
        this.shortcuts.delete(keyString);
    }
}

// فئة لإدارة الثيمات
class ThemeManager {
    constructor() {
        this.themes = {
            dark: {
                background: '#1a1a1a',
                surface: '#2a2a2a',
                text: '#ffffff',
                primary: '#007bff',
                success: '#28a745',
                danger: '#dc3545',
                warning: '#ffc107'
            },
            light: {
                background: '#ffffff',
                surface: '#f8f9fa',
                text: '#000000',
                primary: '#007bff',
                success: '#28a745',
                danger: '#dc3545',
                warning: '#ffc107'
            }
        };
        this.currentTheme = 'dark';
    }
    
    apply(themeName) {
        if (!this.themes[themeName]) return false;
        
        const theme = this.themes[themeName];
        const root = document.documentElement;
        
        Object.entries(theme).forEach(([key, value]) => {
            root.style.setProperty(`--color-${key}`, value);
        });
        
        this.currentTheme = themeName;
        return true;
    }
    
    toggle() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        return this.apply(newTheme);
    }
}

// فئة لإدارة التصدير
class ExportManager {
    constructor() {
        this.formats = ['json', 'csv', 'png'];
    }
    
    exportData(data, filename, format = 'json') {
