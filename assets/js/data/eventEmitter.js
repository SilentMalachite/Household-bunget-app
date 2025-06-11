// イベントエミッター実装
export class EventEmitter {
    constructor() {
        this.events = new Map();
        this.maxListeners = 10; // メモリリーク防止
    }

    /**
     * イベントリスナーを追加
     * @param {string} event - イベント名
     * @param {Function} listener - リスナー関数
     * @returns {EventEmitter} - チェイン可能
     */
    on(event, listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('リスナーは関数である必要があります');
        }

        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listeners = this.events.get(event);
        
        // 最大リスナー数チェック
        if (listeners.length >= this.maxListeners) {
            console.warn(`イベント "${event}" のリスナー数が上限(${this.maxListeners})に達しました`);
        }

        listeners.push(listener);
        return this;
    }

    /**
     * 一度だけ実行されるリスナーを追加
     * @param {string} event - イベント名
     * @param {Function} listener - リスナー関数
     * @returns {EventEmitter} - チェイン可能
     */
    once(event, listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('リスナーは関数である必要があります');
        }

        const onceWrapper = (...args) => {
            this.off(event, onceWrapper);
            listener.apply(this, args);
        };

        this.on(event, onceWrapper);
        return this;
    }

    /**
     * イベントリスナーを削除
     * @param {string} event - イベント名
     * @param {Function} listenerToRemove - 削除するリスナー
     * @returns {EventEmitter} - チェイン可能
     */
    off(event, listenerToRemove) {
        if (!this.events.has(event)) {
            return this;
        }

        const listeners = this.events.get(event);
        const index = listeners.indexOf(listenerToRemove);
        
        if (index !== -1) {
            listeners.splice(index, 1);
        }

        // リスナーが0個になったらイベントを削除
        if (listeners.length === 0) {
            this.events.delete(event);
        }

        return this;
    }

    /**
     * 特定のイベントのすべてのリスナーを削除
     * @param {string} event - イベント名
     * @returns {EventEmitter} - チェイン可能
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
        return this;
    }

    /**
     * イベントを発火
     * @param {string} event - イベント名
     * @param {...any} args - イベントデータ
     * @returns {boolean} - リスナーが存在したかどうか
     */
    emit(event, ...args) {
        if (!this.events.has(event)) {
            return false;
        }

        const listeners = this.events.get(event).slice(); // コピーを作成

        listeners.forEach(listener => {
            try {
                listener.apply(this, args);
            } catch (error) {
                console.error(`イベント "${event}" のリスナーでエラーが発生:`, error);
                // エラーイベントとして再発火
                this.emit('error', error, event);
            }
        });

        return true;
    }

    /**
     * 非同期イベントを発火
     * @param {string} event - イベント名
     * @param {...any} args - イベントデータ
     * @returns {Promise<boolean>} - リスナーが存在したかどうか
     */
    async emitAsync(event, ...args) {
        if (!this.events.has(event)) {
            return false;
        }

        const listeners = this.events.get(event).slice();

        for (const listener of listeners) {
            try {
                await listener.apply(this, args);
            } catch (error) {
                console.error(`非同期イベント "${event}" のリスナーでエラーが発生:`, error);
                this.emit('error', error, event);
            }
        }

        return true;
    }

    /**
     * イベントのリスナー数を取得
     * @param {string} event - イベント名
     * @returns {number} - リスナー数
     */
    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }

    /**
     * イベントのリスナー一覧を取得
     * @param {string} event - イベント名
     * @returns {Array<Function>} - リスナー配列
     */
    listeners(event) {
        return this.events.has(event) ? this.events.get(event).slice() : [];
    }

    /**
     * 登録されているイベント名一覧を取得
     * @returns {Array<string>} - イベント名配列
     */
    eventNames() {
        return Array.from(this.events.keys());
    }

    /**
     * 最大リスナー数を設定
     * @param {number} n - 最大リスナー数
     * @returns {EventEmitter} - チェイン可能
     */
    setMaxListeners(n) {
        if (typeof n !== 'number' || n < 0) {
            throw new TypeError('最大リスナー数は0以上の数値である必要があります');
        }
        this.maxListeners = n;
        return this;
    }

    /**
     * 最大リスナー数を取得
     * @returns {number} - 最大リスナー数
     */
    getMaxListeners() {
        return this.maxListeners;
    }

    /**
     * プロミスベースのイベント待機
     * @param {string} event - 待機するイベント名
     * @param {number} timeout - タイムアウト時間（ミリ秒）
     * @returns {Promise} - イベントデータを含むプロミス
     */
    waitFor(event, timeout = 0) {
        return new Promise((resolve, reject) => {
            let timeoutId;

            const listener = (...args) => {
                if (timeoutId) clearTimeout(timeoutId);
                this.off(event, listener);
                resolve(args.length === 1 ? args[0] : args);
            };

            this.once(event, listener);

            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    this.off(event, listener);
                    reject(new Error(`イベント "${event}" のタイムアウト`));
                }, timeout);
            }
        });
    }

    /**
     * イベントパイプライン - 複数のイベントを順次実行
     * @param {Array<string>} events - イベント名配列
     * @param {...any} args - 初期引数
     * @returns {Promise} - パイプライン結果
     */
    async pipeline(events, ...args) {
        let result = args;

        for (const event of events) {
            if (this.events.has(event)) {
                const listeners = this.events.get(event);
                
                for (const listener of listeners) {
                    try {
                        const listenerResult = await listener.apply(this, result);
                        if (listenerResult !== undefined) {
                            result = Array.isArray(listenerResult) ? listenerResult : [listenerResult];
                        }
                    } catch (error) {
                        console.error(`パイプライン "${event}" でエラー:`, error);
                        throw error;
                    }
                }
            }
        }

        return result;
    }

    /**
     * 条件付きイベント発火
     * @param {string} event - イベント名
     * @param {Function} condition - 条件関数
     * @param {...any} args - イベントデータ
     * @returns {boolean} - イベントが発火されたかどうか
     */
    emitIf(event, condition, ...args) {
        if (typeof condition === 'function' && condition.apply(this, args)) {
            return this.emit(event, ...args);
        }
        return false;
    }

    /**
     * デバウンスされたイベント発火
     * @param {string} event - イベント名
     * @param {number} delay - 遅延時間（ミリ秒）
     * @param {...any} args - イベントデータ
     */
    emitDebounced(event, delay, ...args) {
        if (!this._debouncedEvents) {
            this._debouncedEvents = new Map();
        }

        const key = event;
        
        if (this._debouncedEvents.has(key)) {
            clearTimeout(this._debouncedEvents.get(key));
        }

        const timeoutId = setTimeout(() => {
            this.emit(event, ...args);
            this._debouncedEvents.delete(key);
        }, delay);

        this._debouncedEvents.set(key, timeoutId);
    }

    /**
     * リソースのクリーンアップ
     */
    destroy() {
        // デバウンスタイマーをクリア
        if (this._debouncedEvents) {
            this._debouncedEvents.forEach(timeoutId => clearTimeout(timeoutId));
            this._debouncedEvents.clear();
        }

        // すべてのイベントリスナーを削除
        this.removeAllListeners();
    }
}
