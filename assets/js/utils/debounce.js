// Debounce実装とパフォーマンス最適化ユーティリティ

/**
 * デバウンス関数 - 連続する関数呼び出しを制御
 * @param {Function} func - 実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @param {boolean} immediate - 即座に実行するかどうか
 * @returns {Function} - デバウンスされた関数
 */
export function debounce(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        
        const callNow = immediate && !timeout;
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) func.apply(this, args);
    };
}

/**
 * スロットル関数 - 関数の実行頻度を制限
 * @param {Function} func - 実行する関数
 * @param {number} limit - 制限時間（ミリ秒）
 * @returns {Function} - スロットルされた関数
 */
export function throttle(func, limit) {
    let inThrottle;
    
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * リクエストアニメーションフレーム版デバウンス
 * DOM操作に最適化
 * @param {Function} func - 実行する関数
 * @returns {Function} - RAF デバウンスされた関数
 */
export function rafDebounce(func) {
    let rafId;
    
    return function(...args) {
        if (rafId) {
            cancelAnimationFrame(rafId);
        }
        
        rafId = requestAnimationFrame(() => {
            func.apply(this, args);
            rafId = null;
        });
    };
}

/**
 * 遅延実行クラス - より高度な制御が必要な場合
 */
export class DelayedExecution {
    constructor(func, delay = 300) {
        this.func = func;
        this.delay = delay;
        this.timeoutId = null;
        this.lastArgs = null;
    }
    
    /**
     * 関数を遅延実行
     * @param {...any} args - 関数の引数
     */
    execute(...args) {
        this.lastArgs = args;
        
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        
        this.timeoutId = setTimeout(() => {
            this.func.apply(null, this.lastArgs);
            this.timeoutId = null;
            this.lastArgs = null;
        }, this.delay);
    }
    
    /**
     * 遅延実行をキャンセル
     */
    cancel() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
            this.lastArgs = null;
        }
    }
    
    /**
     * 即座に実行（遅延をキャンセルして）
     */
    executeNow() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        
        if (this.lastArgs) {
            this.func.apply(null, this.lastArgs);
            this.lastArgs = null;
        }
    }
}

/**
 * バッチ実行 - 複数の操作をまとめて実行
 */
export class BatchProcessor {
    constructor(processor, delay = 100, maxBatchSize = 100) {
        this.processor = processor;
        this.delay = delay;
        this.maxBatchSize = maxBatchSize;
        this.queue = [];
        this.timeoutId = null;
    }
    
    /**
     * アイテムをキューに追加
     * @param {any} item - 処理するアイテム
     */
    add(item) {
        this.queue.push(item);
        
        // 最大バッチサイズに達した場合は即座に処理
        if (this.queue.length >= this.maxBatchSize) {
            this.process();
            return;
        }
        
        // タイマーをリセット
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        
        this.timeoutId = setTimeout(() => {
            this.process();
        }, this.delay);
    }
    
    /**
     * キューを処理
     */
    process() {
        if (this.queue.length === 0) return;
        
        const batch = this.queue.splice(0, this.maxBatchSize);
        
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        
        // プロセッサーが Promise を返す場合に対応
        const result = this.processor(batch);
        
        if (result && typeof result.then === 'function') {
            result.catch(error => {
                console.error('バッチ処理エラー:', error);
            });
        }
        
        // 残りのアイテムがある場合は次のバッチを処理
        if (this.queue.length > 0) {
            this.timeoutId = setTimeout(() => {
                this.process();
            }, this.delay);
        }
    }
    
    /**
     * キューをクリア
     */
    clear() {
        this.queue = [];
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
}

/**
 * メモ化関数 - 関数の結果をキャッシュして性能向上
 * @param {Function} func - メモ化する関数
 * @param {Function} keyGenerator - キャッシュキー生成関数（オプション）
 * @returns {Function} - メモ化された関数
 */
export function memoize(func, keyGenerator = JSON.stringify) {
    const cache = new Map();
    
    return function(...args) {
        const key = keyGenerator(args);
        
        if (cache.has(key)) {
            return cache.get(key);
        }
        
        const result = func.apply(this, args);
        cache.set(key, result);
        
        return result;
    };
}

/**
 * 非同期デバウンス - 非同期関数用のデバウンス
 * @param {Function} asyncFunc - 非同期関数
 * @param {number} wait - 待機時間
 * @returns {Function} - デバウンスされた非同期関数
 */
export function asyncDebounce(asyncFunc, wait) {
    let timeout;
    let resolveQueue = [];
    let rejectQueue = [];
    
    return function(...args) {
        return new Promise((resolve, reject) => {
            resolveQueue.push(resolve);
            rejectQueue.push(reject);
            
            clearTimeout(timeout);
            
            timeout = setTimeout(async () => {
                const currentResolveQueue = [...resolveQueue];
                const currentRejectQueue = [...rejectQueue];
                
                resolveQueue = [];
                rejectQueue = [];
                
                try {
                    const result = await asyncFunc.apply(this, args);
                    currentResolveQueue.forEach(resolve => resolve(result));
                } catch (error) {
                    currentRejectQueue.forEach(reject => reject(error));
                }
            }, wait);
        });
    };
}