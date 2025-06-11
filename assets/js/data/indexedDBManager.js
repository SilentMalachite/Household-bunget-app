// IndexedDB管理クラス
import { CONSTANTS } from '../constants.js';

export class IndexedDBManager {
    constructor() {
        this.db = null;
        this.dbName = CONSTANTS.INDEXEDDB.DB_NAME;
        this.version = CONSTANTS.INDEXEDDB.VERSION;
        this.isReady = false;
    }

    /**
     * IndexedDBを初期化
     * @returns {Promise<void>}
     */
    async init() {
        return new Promise((resolve, reject) => {
            // IndexedDBがサポートされているかチェック
            if (!window.indexedDB) {
                reject(new Error('IndexedDBがサポートされていません'));
                return;
            }

            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error(`IndexedDBの初期化に失敗しました: ${request.error}`));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isReady = true;
                
                // データベース接続エラーのハンドリング
                this.db.onerror = (errorEvent) => {
                    console.error('IndexedDBエラー:', errorEvent.target.error);
                };

                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createObjectStores(db);
            };

            // ブロッキング状況の処理
            request.onblocked = () => {
                console.warn('IndexedDBのアップグレードがブロックされています');
            };
        });
    }

    /**
     * オブジェクトストアを作成
     * @param {IDBDatabase} db - データベースインスタンス
     */
    createObjectStores(db) {
        // トランザクションストア
        if (!db.objectStoreNames.contains(CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS)) {
            const transactionStore = db.createObjectStore(
                CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS,
                { keyPath: 'id' }
            );
            
            // インデックスを作成
            transactionStore.createIndex('date', 'date', { unique: false });
            transactionStore.createIndex('type', 'type', { unique: false });
            transactionStore.createIndex('category', 'category', { unique: false });
            transactionStore.createIndex('amount', 'amount', { unique: false });
            transactionStore.createIndex('dateType', ['date', 'type'], { unique: false });
        }

        // 設定ストア
        if (!db.objectStoreNames.contains(CONSTANTS.INDEXEDDB.STORES.SETTINGS)) {
            db.createObjectStore(
                CONSTANTS.INDEXEDDB.STORES.SETTINGS,
                { keyPath: 'key' }
            );
        }

        // バックアップストア
        if (!db.objectStoreNames.contains(CONSTANTS.INDEXEDDB.STORES.BACKUPS)) {
            const backupStore = db.createObjectStore(
                CONSTANTS.INDEXEDDB.STORES.BACKUPS,
                { keyPath: 'id', autoIncrement: true }
            );
            backupStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
    }

    /**
     * 準備完了をチェック
     * @throws {Error} データベースが準備できていない場合
     */
    checkReady() {
        if (!this.isReady || !this.db) {
            throw new Error('IndexedDBが初期化されていません');
        }
    }

    /**
     * すべてのトランザクションを取得
     * @returns {Promise<Array>} トランザクション配列
     */
    async getAllTransactions() {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS], 'readonly');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            
            request.onerror = () => {
                reject(new Error(`トランザクションの取得に失敗しました: ${request.error}`));
            };
        });
    }

    /**
     * 日付範囲でトランザクションを取得
     * @param {string} startDate - 開始日（YYYY-MM-DD）
     * @param {string} endDate - 終了日（YYYY-MM-DD）
     * @returns {Promise<Array>} トランザクション配列
     */
    async getTransactionsByDateRange(startDate, endDate) {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS], 'readonly');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS);
        const index = store.index('date');
        
        return new Promise((resolve, reject) => {
            const range = IDBKeyRange.bound(startDate, endDate);
            const request = index.getAll(range);
            
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            
            request.onerror = () => {
                reject(new Error(`日付範囲トランザクションの取得に失敗しました: ${request.error}`));
            };
        });
    }

    /**
     * トランザクションを追加
     * @param {object} transactionData - トランザクションデータ
     * @returns {Promise<void>}
     */
    async addTransaction(transactionData) {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS], 'readwrite');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS);
        
        return new Promise((resolve, reject) => {
            const request = store.add({
                ...transactionData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            request.onsuccess = () => resolve();
            
            request.onerror = () => {
                reject(new Error(`トランザクションの追加に失敗しました: ${request.error}`));
            };
        });
    }

    /**
     * トランザクションを更新
     * @param {object} transactionData - 更新するトランザクションデータ
     * @returns {Promise<void>}
     */
    async updateTransaction(transactionData) {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS], 'readwrite');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS);
        
        return new Promise((resolve, reject) => {
            const request = store.put({
                ...transactionData,
                updatedAt: new Date().toISOString()
            });
            
            request.onsuccess = () => resolve();
            
            request.onerror = () => {
                reject(new Error(`トランザクションの更新に失敗しました: ${request.error}`));
            };
        });
    }

    /**
     * トランザクションを削除
     * @param {string} id - トランザクションID
     * @returns {Promise<void>}
     */
    async deleteTransaction(id) {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS], 'readwrite');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            
            request.onerror = () => {
                reject(new Error(`トランザクションの削除に失敗しました: ${request.error}`));
            };
        });
    }

    /**
     * 複数のトランザクションを一括追加
     * @param {Array<object>} transactions - トランザクション配列
     * @returns {Promise<void>}
     */
    async addTransactionsBatch(transactions) {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS], 'readwrite');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS);
        
        return new Promise((resolve, reject) => {
            let completed = 0;
            const total = transactions.length;
            
            if (total === 0) {
                resolve();
                return;
            }
            
            transactions.forEach(transactionData => {
                const request = store.add({
                    ...transactionData,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                
                request.onsuccess = () => {
                    completed++;
                    if (completed === total) {
                        resolve();
                    }
                };
                
                request.onerror = () => {
                    reject(new Error(`バッチ追加中にエラーが発生しました: ${request.error}`));
                };
            });
        });
    }

    /**
     * すべてのトランザクションを削除
     * @returns {Promise<void>}
     */
    async clearTransactions() {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS], 'readwrite');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.TRANSACTIONS);
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            
            request.onerror = () => {
                reject(new Error(`トランザクションのクリアに失敗しました: ${request.error}`));
            };
        });
    }

    /**
     * 設定を保存
     * @param {object} settings - 設定オブジェクト
     * @returns {Promise<void>}
     */
    async saveSettings(settings) {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.SETTINGS], 'readwrite');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.SETTINGS);
        
        return new Promise((resolve, reject) => {
            const request = store.put({ 
                key: 'main', 
                ...settings,
                updatedAt: new Date().toISOString()
            });
            
            request.onsuccess = () => resolve();
            
            request.onerror = () => {
                reject(new Error(`設定の保存に失敗しました: ${request.error}`));
            };
        });
    }

    /**
     * 設定を取得
     * @returns {Promise<object|null>} 設定オブジェクト
     */
    async getSettings() {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.SETTINGS], 'readonly');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.SETTINGS);
        
        return new Promise((resolve, reject) => {
            const request = store.get('main');
            
            request.onsuccess = () => {
                resolve(request.result || null);
            };
            
            request.onerror = () => {
                reject(new Error(`設定の取得に失敗しました: ${request.error}`));
            };
        });
    }

    /**
     * バックアップを作成
     * @param {object} backupData - バックアップデータ
     * @returns {Promise<void>}
     */
    async createBackup(backupData) {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.BACKUPS], 'readwrite');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.BACKUPS);
        
        return new Promise((resolve, reject) => {
            const backup = {
                timestamp: new Date().toISOString(),
                data: backupData,
                version: CONSTANTS.INDEXEDDB.VERSION
            };
            
            const request = store.add(backup);
            
            request.onsuccess = () => {
                // 古いバックアップを削除（最新10個まで保持）
                this.cleanupOldBackups().catch(console.error);
                resolve();
            };
            
            request.onerror = () => {
                reject(new Error(`バックアップの作成に失敗しました: ${request.error}`));
            };
        });
    }

    /**
     * 最新のバックアップを取得
     * @returns {Promise<object|null>} バックアップオブジェクト
     */
    async getLatestBackup() {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.BACKUPS], 'readonly');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.BACKUPS);
        const index = store.index('timestamp');
        
        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, 'prev');
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                resolve(cursor ? cursor.value : null);
            };
            
            request.onerror = () => {
                reject(new Error(`バックアップの取得に失敗しました: ${request.error}`));
            };
        });
    }

    /**
     * 古いバックアップを削除
     * @param {number} keepCount - 保持するバックアップ数
     * @returns {Promise<void>}
     */
    async cleanupOldBackups(keepCount = 10) {
        this.checkReady();
        
        const transaction = this.db.transaction([CONSTANTS.INDEXEDDB.STORES.BACKUPS], 'readwrite');
        const store = transaction.objectStore(CONSTANTS.INDEXEDDB.STORES.BACKUPS);
        const index = store.index('timestamp');
        
        return new Promise((resolve, reject) => {
            const backups = [];
            const request = index.openCursor(null, 'prev');
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    backups.push(cursor.value);
                    cursor.continue();
                } else {
                    // 保持数を超えるバックアップを削除
                    if (backups.length > keepCount) {
                        const toDelete = backups.slice(keepCount);
                        let deleted = 0;
                        
                        toDelete.forEach(backup => {
                            const deleteRequest = store.delete(backup.id);
                            deleteRequest.onsuccess = () => {
                                deleted++;
                                if (deleted === toDelete.length) {
                                    resolve();
                                }
                            };
                        });
                        
                        if (toDelete.length === 0) {
                            resolve();
                        }
                    } else {
                        resolve();
                    }
                }
            };
            
            request.onerror = () => {
                reject(new Error(`バックアップのクリーンアップに失敗しました: ${request.error}`));
            };
        });
    }

    /**
     * データベースサイズを取得
     * @returns {Promise<object>} サイズ情報
     */
    async getDatabaseSize() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                return {
                    usage: estimate.usage || 0,
                    quota: estimate.quota || 0,
                    usagePercentage: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
                };
            } catch (error) {
                console.warn('ストレージ使用量の取得に失敗:', error);
            }
        }
        
        return {
            usage: 0,
            quota: 0,
            usagePercentage: 0
        };
    }

    /**
     * データベースを閉じる
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isReady = false;
        }
    }

    /**
     * データベースを削除
     * @returns {Promise<void>}
     */
    async deleteDatabase() {
        this.close();
        
        return new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(this.dbName);
            
            deleteRequest.onsuccess = () => resolve();
            
            deleteRequest.onerror = () => {
                reject(new Error(`データベースの削除に失敗しました: ${deleteRequest.error}`));
            };
            
            deleteRequest.onblocked = () => {
                console.warn('データベース削除がブロックされています');
            };
        });
    }
}
