// データ管理メインクラス
import { EventEmitter } from './eventEmitter.js';
import { IndexedDBManager } from './indexedDBManager.js';
import { CONSTANTS, DEFAULT_CATEGORIES, UTILS } from '../constants.js';
import { Sanitizer } from '../utils/sanitizer.js';

export class HouseholdBudgetData extends EventEmitter {
    constructor() {
        super();
        this.transactions = [];
        this.filteredTransactions = [];
        this.idCounter = 1;
        this.categories = { ...DEFAULT_CATEGORIES };
        this.filters = { type: '', category: '', month: '' };
        this.dbManager = new IndexedDBManager();
        this.isInitialized = false;
        
        // パフォーマンス最適化用のキャッシュ
        this.summaryCache = null;
        this.lastSummaryUpdate = null;
        this.monthlyDataCache = new Map();
        
        // 統計情報
        this.stats = {
            totalTransactions: 0,
            lastModified: null,
            createdAt: new Date().toISOString()
        };
    }

    /**
     * データマネージャーを初期化
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // IndexedDBを初期化
            await this.dbManager.init();
            
            // データを読み込み
            await this.loadData();
            
            this.isInitialized = true;
            this.emit('dataLoaded');
            this.emit('dataChanged');
            
        } catch (error) {
            console.error('IndexedDB初期化エラー:', error);
            // フォールバック: localStorageから読み込み
            await this.loadFromLocalStorage();
        }
    }

    /**
     * IndexedDBからデータを読み込み
     * @returns {Promise<void>}
     */
    async loadData() {
        try {
            // トランザクションを読み込み
            const transactions = await this.dbManager.getAllTransactions();
            this.transactions = transactions || [];
            
            // 設定を読み込み
            const settings = await this.dbManager.getSettings();
            if (settings) {
                this.categories = settings.categories || this.categories;
                this.filters = settings.filters || this.filters;
                this.idCounter = settings.idCounter || this.idCounter;
                this.stats = settings.stats || this.stats;
            }
            
            // 統計情報を更新
            this.updateStats();
            
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            throw error;
        }
    }

    /**
     * localStorageから読み込み（フォールバック）
     * @returns {Promise<void>}
     */
    async loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem(CONSTANTS.STORAGE_KEYS.MAIN_DATA);
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                if (Array.isArray(parsedData)) {
                    this.transactions = parsedData;
                } else {
                    this.fromSaveFormat(parsedData);
                }
            }
            
            this.isInitialized = true;
            this.updateStats();
            this.emit('dataLoaded');
            this.emit('dataChanged');
            
        } catch (error) {
            console.error('localStorage読み込みエラー:', error);
            this.isInitialized = true;
            this.emit('dataLoaded');
        }
    }

    /**
     * 一意のIDを生成
     * @returns {string} 一意のID
     */
    generateUniqueId() {
        return UTILS.generateId();
    }

    /**
     * トランザクションを追加
     * @param {object} transactionData - トランザクションデータ
     * @returns {Promise<object>} 追加されたトランザクション
     */
    async addTransaction(transactionData) {
        // データの検証とサニタイズ
        const validation = Sanitizer.validateAndSanitizeTransaction(transactionData);
        
        if (!validation.isValid) {
            throw new Error(validation.errors.join('\n'));
        }

        const transaction = {
            id: this.generateUniqueId(),
            ...validation.sanitizedData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.transactions.push(transaction);
        
        // IndexedDBに保存
        if (this.isInitialized && this.dbManager.db) {
            try {
                await this.dbManager.addTransaction(transaction);
            } catch (error) {
                // IndexedDB保存失敗時はlocalStorageにフォールバック
                console.error('IndexedDB保存エラー:', error);
                this.saveToLocalStorage();
            }
        }
        
        // キャッシュを無効化
        this.invalidateCache();
        this.updateStats();
        
        // 自動バックアップ
        if (this.transactions.length % CONSTANTS.DEFAULTS.AUTO_BACKUP_INTERVAL === 0) {
            this.createAutoBackup();
        }
        
        this.emit('transactionAdded', transaction);
        this.emit('dataChanged');
        
        return transaction;
    }

    /**
     * トランザクションを更新
     * @param {string} id - トランザクションID
     * @param {object} updates - 更新データ
     * @returns {Promise<object|null>} 更新されたトランザクション
     */
    async updateTransaction(id, updates) {
        const index = this.transactions.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error('トランザクションが見つかりません');
        }

        // データの検証とサニタイズ
        const currentTransaction = this.transactions[index];
        const updatedData = { ...currentTransaction, ...updates };
        const validation = Sanitizer.validateAndSanitizeTransaction(updatedData);
        
        if (!validation.isValid) {
            throw new Error(validation.errors.join('\n'));
        }

        const updatedTransaction = {
            ...validation.sanitizedData,
            id,
            createdAt: currentTransaction.createdAt,
            updatedAt: new Date().toISOString()
        };

        this.transactions[index] = updatedTransaction;
        
        // IndexedDBに保存
        if (this.isInitialized && this.dbManager.db) {
            try {
                await this.dbManager.updateTransaction(updatedTransaction);
            } catch (error) {
                console.error('IndexedDB更新エラー:', error);
                this.saveToLocalStorage();
            }
        }
        
        this.invalidateCache();
        this.updateStats();
        
        this.emit('transactionUpdated', updatedTransaction);
        this.emit('dataChanged');
        
        return updatedTransaction;
    }

    /**
     * トランザクションを削除
     * @param {string} id - トランザクションID
     * @returns {Promise<object|null>} 削除されたトランザクション
     */
    async deleteTransaction(id) {
        const index = this.transactions.findIndex(t => t.id === id);
        if (index === -1) {
            return null;
        }

        const deleted = this.transactions.splice(index, 1)[0];
        
        // IndexedDBから削除
        if (this.isInitialized && this.dbManager.db) {
            try {
                await this.dbManager.deleteTransaction(id);
            } catch (error) {
                console.error('IndexedDB削除エラー:', error);
                this.saveToLocalStorage();
            }
        }
        
        this.invalidateCache();
        this.updateStats();
        
        this.emit('transactionDeleted', deleted);
        this.emit('dataChanged');
        
        return deleted;
    }

    /**
     * 複数のトランザクションを一括追加
     * @param {Array<object>} transactions - トランザクション配列
     * @returns {Promise<Array<object>>} 追加されたトランザクション配列
     */
    async addTransactionsBatch(transactions) {
        const validTransactions = [];
        const errors = [];

        // 各トランザクションを検証
        for (let i = 0; i < transactions.length; i++) {
            try {
                const validation = Sanitizer.validateAndSanitizeTransaction(transactions[i]);
                
                if (validation.isValid) {
                    validTransactions.push({
                        id: this.generateUniqueId(),
                        ...validation.sanitizedData,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    errors.push(`行${i + 1}: ${validation.errors.join(', ')}`);
                }
            } catch (error) {
                errors.push(`行${i + 1}: ${error.message}`);
            }
        }

        if (validTransactions.length === 0) {
            throw new Error('有効なトランザクションがありません\n' + errors.join('\n'));
        }

        // メモリに追加
        this.transactions.push(...validTransactions);
        
        // IndexedDBに一括保存
        if (this.isInitialized && this.dbManager.db) {
            try {
                await this.dbManager.addTransactionsBatch(validTransactions);
            } catch (error) {
                console.error('バッチ保存エラー:', error);
                this.saveToLocalStorage();
            }
        }
        
        this.invalidateCache();
        this.updateStats();
        
        this.emit('transactionsBatchAdded', validTransactions);
        this.emit('dataChanged');
        
        if (errors.length > 0) {
            console.warn('一部のトランザクションでエラーが発生:', errors);
        }
        
        return { added: validTransactions, errors };
    }

    /**
     * フィルターを適用
     * @param {object} filters - フィルター設定
     */
    applyFilters(filters) {
        this.filters = { ...this.filters, ...filters };
        
        this.filteredTransactions = this.transactions.filter(transaction => {
            const typeMatch = !this.filters.type || transaction.type === this.filters.type;
            const categoryMatch = !this.filters.category || transaction.category === this.filters.category;
            const monthMatch = !this.filters.month || transaction.date.startsWith(this.filters.month);
            
            return typeMatch && categoryMatch && monthMatch;
        });

        // フィルター結果をソート（日付の降順）
        this.filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        this.emit('filtersApplied', this.filteredTransactions);
        this.saveSettings();
    }

    /**
     * サマリーを計算（キャッシュ付き）
     * @returns {object} サマリー情報
     */
    calculateSummary() {
        // キャッシュが有効な場合は使用
        if (this.summaryCache && this.lastSummaryUpdate === this.transactions.length) {
            return this.summaryCache;
        }

        const income = this.transactions
            .filter(t => t.type === CONSTANTS.TRANSACTION_TYPES.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);
        
        const expense = this.transactions
            .filter(t => t.type === CONSTANTS.TRANSACTION_TYPES.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);
        
        this.summaryCache = {
            income,
            expense,
            balance: income - expense,
            transactionCount: this.transactions.length,
            avgIncome: this.transactions.filter(t => t.type === CONSTANTS.TRANSACTION_TYPES.INCOME).length > 0 
                ? income / this.transactions.filter(t => t.type === CONSTANTS.TRANSACTION_TYPES.INCOME).length 
                : 0,
            avgExpense: this.transactions.filter(t => t.type === CONSTANTS.TRANSACTION_TYPES.EXPENSE).length > 0 
                ? expense / this.transactions.filter(t => t.type === CONSTANTS.TRANSACTION_TYPES.EXPENSE).length 
                : 0
        };
        
        this.lastSummaryUpdate = this.transactions.length;
        
        return this.summaryCache;
    }

    /**
     * 月別データを取得（キャッシュ付き）
     * @param {number} months - 月数
     * @param {Date} endDate - 終了日
     * @returns {Map} 月別データ
     */
    getMonthlyData(months = 12, endDate = new Date()) {
        const cacheKey = `${months}-${endDate.toISOString().substring(0, 7)}`;
        
        // キャッシュをチェック
        if (this.monthlyDataCache.has(cacheKey)) {
            return this.monthlyDataCache.get(cacheKey);
        }

        const monthlyData = new Map();
        
        // 全期間の場合
        if (months === 'all' || months === Infinity) {
            const sortedTransactions = [...this.transactions].sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
            
            if (sortedTransactions.length > 0) {
                const firstDate = new Date(sortedTransactions[0].date);
                const lastDate = new Date(sortedTransactions[sortedTransactions.length - 1].date);
                
                const totalMonths = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                                   (lastDate.getMonth() - firstDate.getMonth()) + 1;
                
                for (let i = 0; i < totalMonths; i++) {
                    const date = new Date(firstDate.getFullYear(), firstDate.getMonth() + i, 1);
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    monthlyData.set(key, { income: 0, expense: 0 });
                }
            }
        } else {
            // 指定された月数分のデータを初期化
            for (let i = months - 1; i >= 0; i--) {
                const date = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                monthlyData.set(key, { income: 0, expense: 0 });
            }
        }
        
        // トランザクションを集計
        this.transactions.forEach(transaction => {
            const month = transaction.date.substring(0, 7);
            if (monthlyData.has(month)) {
                const data = monthlyData.get(month);
                if (transaction.type === CONSTANTS.TRANSACTION_TYPES.INCOME) {
                    data.income += transaction.amount;
                } else {
                    data.expense += transaction.amount;
                }
            }
        });
        
        // キャッシュに保存
        this.monthlyDataCache.set(cacheKey, monthlyData);
        
        return monthlyData;
    }

    /**
     * カテゴリを削除
     * @param {string} type - トランザクション種別
     * @param {string} categoryName - カテゴリ名
     * @param {string} replacementCategory - 代替カテゴリ（任意）
     * @returns {number} 影響を受けたトランザクション数
     */
    removeCategory(type, categoryName, replacementCategory = null) {
        const relatedTransactions = this.transactions.filter(t => 
            t.type === type && t.category === categoryName
        );

        if (relatedTransactions.length > 0) {
            if (!replacementCategory) {
                throw new Error(`${CONSTANTS.ERROR_MESSAGES.CATEGORY_IN_USE}（${relatedTransactions.length}件）代替カテゴリを指定してください。`);
            }
            
            // 関連するトランザクションのカテゴリを更新
            relatedTransactions.forEach(async (t) => {
                await this.updateTransaction(t.id, { category: replacementCategory });
            });
        }

        // カテゴリを削除
        this.categories[type] = this.categories[type].filter(c => c !== categoryName);
        this.saveSettings();
        this.emit('categoryRemoved', { type, categoryName });
        this.emit('dataChanged');
        
        return relatedTransactions.length;
    }

    /**
     * 保存形式に変換
     * @returns {object} 保存用データ
     */
    toSaveFormat() {
        return {
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            transactions: this.transactions,
            categories: this.categories,
            idCounter: this.idCounter,
            filters: this.filters,
            stats: this.stats
        };
    }

    /**
     * 保存形式から復元
     * @param {object} data - 保存されたデータ
     */
    fromSaveFormat(data) {
        if (data.transactions && Array.isArray(data.transactions)) {
            this.transactions = data.transactions;
        }
        if (data.categories) {
            this.categories = { ...DEFAULT_CATEGORIES, ...data.categories };
        }
        if (data.idCounter) {
            this.idCounter = data.idCounter;
        }
        if (data.filters) {
            this.filters = { ...this.filters, ...data.filters };
        }
        if (data.stats) {
            this.stats = { ...this.stats, ...data.stats };
        }
        
        this.invalidateCache();
        this.updateStats();
        this.emit('dataLoaded');
        this.emit('dataChanged');
    }

    /**
     * 自動バックアップを作成
     * @returns {Promise<void>}
     */
    async createAutoBackup() {
        try {
            const backupData = this.toSaveFormat();
            
            if (this.isInitialized && this.dbManager.db) {
                await this.dbManager.createBackup(backupData);
            } else {
                // フォールバック: localStorageに保存
                localStorage.setItem(CONSTANTS.STORAGE_KEYS.BACKUP_DATA, JSON.stringify({
                    timestamp: new Date().toISOString(),
                    version: '2.0.0',
                    data: backupData
                }));
            }
            
            console.log('自動バックアップを作成しました');
        } catch (error) {
            console.error('自動バックアップの作成に失敗しました:', error);
        }
    }

    /**
     * 最新のバックアップを取得
     * @returns {Promise<object|null>} バックアップデータ
     */
    async getLatestBackup() {
        try {
            if (this.isInitialized && this.dbManager.db) {
                return await this.dbManager.getLatestBackup();
            } else {
                // フォールバック: localStorageから取得
                const backupData = localStorage.getItem(CONSTANTS.STORAGE_KEYS.BACKUP_DATA);
                return backupData ? JSON.parse(backupData) : null;
            }
        } catch (error) {
            console.error('バックアップ取得エラー:', error);
            return null;
        }
    }

    /**
     * 設定を保存
     * @returns {Promise<void>}
     */
    async saveSettings() {
        if (!this.isInitialized) return;
        
        try {
            if (this.dbManager.db) {
                await this.dbManager.saveSettings({
                    categories: this.categories,
                    filters: this.filters,
                    idCounter: this.idCounter,
                    stats: this.stats
                });
            } else {
                // フォールバック: localStorageに保存
                this.saveToLocalStorage();
            }
        } catch (error) {
            console.error('設定の保存に失敗しました:', error);
            this.saveToLocalStorage();
        }
    }

    /**
     * localStorageに保存（フォールバック）
     */
    saveToLocalStorage() {
        try {
            const data = this.toSaveFormat();
            localStorage.setItem(CONSTANTS.STORAGE_KEYS.MAIN_DATA, JSON.stringify(data));
        } catch (error) {
            console.error('localStorage保存エラー:', error);
        }
    }

    /**
     * すべてのデータをクリア
     * @returns {Promise<void>}
     */
    async clearAllData() {
        this.transactions = [];
        this.filteredTransactions = [];
        
        if (this.isInitialized && this.dbManager.db) {
            try {
                await this.dbManager.clearTransactions();
            } catch (error) {
                console.error('IndexedDBクリアエラー:', error);
            }
        }
        
        // localStorageもクリア
        localStorage.removeItem(CONSTANTS.STORAGE_KEYS.MAIN_DATA);
        
        this.invalidateCache();
        this.updateStats();
        this.emit('dataCleared');
        this.emit('dataChanged');
    }

    /**
     * キャッシュを無効化
     */
    invalidateCache() {
        this.summaryCache = null;
        this.lastSummaryUpdate = null;
        this.monthlyDataCache.clear();
    }

    /**
     * 統計情報を更新
     */
    updateStats() {
        this.stats.totalTransactions = this.transactions.length;
        this.stats.lastModified = new Date().toISOString();
        
        if (this.transactions.length > 0) {
            const dates = this.transactions.map(t => new Date(t.date));
            this.stats.oldestTransaction = new Date(Math.min(...dates)).toISOString();
            this.stats.newestTransaction = new Date(Math.max(...dates)).toISOString();
        }
    }

    /**
     * データの整合性チェック
     * @returns {object} チェック結果
     */
    validateDataIntegrity() {
        const issues = [];
        const duplicateIds = new Set();
        const seenIds = new Set();

        // 重複IDチェック
        this.transactions.forEach(t => {
            if (seenIds.has(t.id)) {
                duplicateIds.add(t.id);
                issues.push(`重複ID: ${t.id}`);
            } else {
                seenIds.add(t.id);
            }
        });

        // 必須フィールドチェック
        this.transactions.forEach((t, index) => {
            if (!t.id) issues.push(`行${index + 1}: IDが不正`);
            if (!t.date) issues.push(`行${index + 1}: 日付が不正`);
            if (!t.type || !Object.values(CONSTANTS.TRANSACTION_TYPES).includes(t.type)) {
                issues.push(`行${index + 1}: 種別が不正`);
            }
            if (!t.category) issues.push(`行${index + 1}: カテゴリが不正`);
            if (typeof t.amount !== 'number' || t.amount <= 0) {
                issues.push(`行${index + 1}: 金額が不正`);
            }
        });

        // カテゴリ整合性チェック
        const allCategories = [
            ...this.categories[CONSTANTS.TRANSACTION_TYPES.INCOME],
            ...this.categories[CONSTANTS.TRANSACTION_TYPES.EXPENSE]
        ];

        this.transactions.forEach((t, index) => {
            if (!allCategories.includes(t.category)) {
                issues.push(`行${index + 1}: 存在しないカテゴリ「${t.category}」`);
            }
        });

        return {
            isValid: issues.length === 0,
            issues,
            duplicateIds: Array.from(duplicateIds),
            summary: {
                totalTransactions: this.transactions.length,
                uniqueIds: seenIds.size,
                categories: allCategories.length
            }
        };
    }

    /**
     * データの修復
     * @returns {object} 修復結果
     */
    repairData() {
        const repairs = [];
        const originalCount = this.transactions.length;

        // 重複IDを修復
        const seenIds = new Set();
        this.transactions = this.transactions.filter(t => {
            if (seenIds.has(t.id)) {
                repairs.push(`重複ID ${t.id} を削除`);
                return false;
            }
            seenIds.add(t.id);
            return true;
        });

        // 不正なデータを修復
        this.transactions = this.transactions.filter((t, index) => {
            let isValid = true;

            if (!t.id) {
                t.id = this.generateUniqueId();
                repairs.push(`行${index + 1}: IDを生成`);
            }

            if (!t.date || !DateParser.validateDate(t.date).isValid) {
                isValid = false;
                repairs.push(`行${index + 1}: 不正な日付のため削除`);
            }

            if (!t.type || !Object.values(CONSTANTS.TRANSACTION_TYPES).includes(t.type)) {
                isValid = false;
                repairs.push(`行${index + 1}: 不正な種別のため削除`);
            }

            if (typeof t.amount !== 'number' || t.amount <= 0) {
                isValid = false;
                repairs.push(`行${index + 1}: 不正な金額のため削除`);
            }

            return isValid;
        });

        // 存在しないカテゴリを修復
        const allCategories = [
            ...this.categories[CONSTANTS.TRANSACTION_TYPES.INCOME],
            ...this.categories[CONSTANTS.TRANSACTION_TYPES.EXPENSE]
        ];

        this.transactions.forEach(t => {
            if (!allCategories.includes(t.category)) {
                const defaultCategory = t.type === CONSTANTS.TRANSACTION_TYPES.INCOME 
                    ? 'その他収入' 
                    : 'その他支出';
                
                if (!this.categories[t.type].includes(defaultCategory)) {
                    this.categories[t.type].push(defaultCategory);
                }
                
                t.category = defaultCategory;
                repairs.push(`カテゴリ「${t.category}」を「${defaultCategory}」に修復`);
            }
        });

        this.invalidateCache();
        this.updateStats();

        if (repairs.length > 0) {
            this.emit('dataRepaired', repairs);
            this.emit('dataChanged');
        }

        return {
            repairsCount: repairs.length,
            repairs,
            removedCount: originalCount - this.transactions.length,
            finalCount: this.transactions.length
        };
    }

    /**
     * リソースのクリーンアップ
     */
    destroy() {
        // イベントリスナーを削除
        this.removeAllListeners();
        
        // データベース接続を閉じる
        if (this.dbManager) {
            this.dbManager.close();
        }
        
        // キャッシュをクリア
        this.invalidateCache();
        
        // 参照をクリア
        this.transactions = null;
        this.filteredTransactions = null;
        this.categories = null;
        this.filters = null;
    }
}テゴリを追加
     * @param {string} type - トランザクション種別
     * @param {string} categoryName - カテゴリ名
     * @returns {boolean} 成功フラグ
     */
    addCategory(type, categoryName) {
        const sanitizedName = Sanitizer.sanitizeCategory(categoryName);
        
        if (!sanitizedName) {
            throw new Error('有効なカテゴリ名を入力してください');
        }
        
        if (this.categories[type].includes(sanitizedName)) {
            throw new Error(CONSTANTS.ERROR_MESSAGES.CATEGORY_EXISTS);
        }
        
        this.categories[type].push(sanitizedName);
        this.saveSettings();
        this.emit('categoryAdded', { type, categoryName: sanitizedName });
        
        return true;
    }

    /**
     * カ
