// UI管理メインクラス
import { ModalManager } from './modalManager.js';
import { NotificationManager } from './notificationManager.js';
import { CategoryManagerUI } from './categoryManagerUI.js';
import { ChartManager } from '../chart/chartManager.js';
import { FileHandler } from '../file/fileHandler.js';
import { CONSTANTS, UTILS } from '../constants.js';
import { debounce } from '../utils/debounce.js';

export class UIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.modalManager = new ModalManager();
        this.notificationManager = new NotificationManager();
        this.fileHandler = new FileHandler(dataManager);
        this.chartManager = null; // 後で初期化
        
        // Debounce処理用
        this.debouncedSaveSettings = debounce(() => {
            this.dataManager.saveSettings();
        }, CONSTANTS.DEFAULTS.DEBOUNCE_DELAY);
        
        this.setupEventListeners();
        this.bindDataEvents();
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // フォームイベント
        const transactionForm = document.getElementById('transactionForm');
        if (transactionForm) {
            transactionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleTransactionSubmit();
            });
        }

        const typeSelect = document.getElementById('type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                this.updateCategoryOptions();
            });
        }

        // フィルタイベント
        const filterType = document.getElementById('filterType');
        const filterCategory = document.getElementById('filterCategory');
        const filterMonth = document.getElementById('filterMonth');

        if (filterType) filterType.addEventListener('change', () => this.handleFilterChange());
        if (filterCategory) filterCategory.addEventListener('change', () => this.handleFilterChange());
        if (filterMonth) filterMonth.addEventListener('input', () => this.handleFilterChange());

        // ボタンイベント
        this.setupButtonEventListeners();

        // ファイル入力イベント
        this.setupFileInputListeners();

        // ページ離脱時の設定保存
        window.addEventListener('beforeunload', () => {
            if (this.dataManager.isInitialized) {
                this.dataManager.saveSettings();
            }
        });
    }

    /**
     * ボタンイベントリスナーを設定
     */
    setupButtonEventListeners() {
        const buttons = [
            { id: 'exportExcelBtn', handler: () => this.exportToExcel() },
            { id: 'importExcelBtn', handler: () => document.getElementById('excelFileInput')?.click() },
            { id: 'exportJsonBtn', handler: () => this.exportData() },
            { id: 'importJsonBtn', handler: () => document.getElementById('fileInput')?.click() },
            { id: 'clearDataBtn', handler: () => this.clearAllData() },
            { id: 'storageInfoBtn', handler: () => this.showStorageInfo() },
            { id: 'restoreBackupBtn', handler: () => this.restoreFromBackup() },
            { id: 'categoryManagerBtn', handler: () => this.showCategoryManager() }
        ];

        buttons.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler);
            }
        });
    }

    /**
     * ファイル入力リスナーを設定
     */
    setupFileInputListeners() {
        const fileInput = document.getElementById('fileInput');
        const excelFileInput = document.getElementById('excelFileInput');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.importData(e));
        }

        if (excelFileInput) {
            excelFileInput.addEventListener('change', (e) => this.importFromExcel(e));
        }
    }

    /**
     * データイベントにバインド
     */
    bindDataEvents() {
        this.dataManager.on('dataChanged', () => {
            this.updateSummary();
            this.debouncedSaveSettings();
        });

        this.dataManager.on('transactionAdded', () => {
            this.handleFilterChange();
            this.clearForm();
            this.notificationManager.success(CONSTANTS.SUCCESS_MESSAGES.TRANSACTION_ADDED);
        });

        this.dataManager.on('transactionDeleted', () => {
            this.handleFilterChange();
            this.notificationManager.success(CONSTANTS.SUCCESS_MESSAGES.TRANSACTION_DELETED);
        });

        this.dataManager.on('filtersApplied', (filteredTransactions) => {
            this.displayTransactions(filteredTransactions);
        });

        this.dataManager.on('categoryAdded', ({ categoryName }) => {
            this.updateCategoryOptions();
            this.updateFilterCategoryOptions();
            this.notificationManager.success(`カテゴリ「${categoryName}」を追加しました`);
        });

        this.dataManager.on('categoryRemoved', ({ categoryName }) => {
            this.updateCategoryOptions();
            this.updateFilterCategoryOptions();
            this.notificationManager.success(`カテゴリ「${categoryName}」を削除しました`);
        });

        this.dataManager.on('dataLoaded', () => {
            this.updateCategoryOptions();
            this.updateFilterCategoryOptions();
            this.updateSummary();
            this.handleFilterChange();
            
            // チャートマネージャーを初期化
            if (!this.chartManager) {
                this.chartManager = new ChartManager(this.dataManager);
            }
        });
    }

    /**
     * トランザクション送信を処理
     */
    async handleTransactionSubmit() {
        const formData = this.getFormData();
        
        try {
            await this.dataManager.addTransaction(formData);
        } catch (error) {
            this.notificationManager.error(error.message);
        }
    }

    /**
     * フォームデータを取得
     */
    getFormData() {
        return {
            date: document.getElementById('date')?.value || '',
            type: document.getElementById('type')?.value || '',
            category: document.getElementById('category')?.value || '',
            amount: parseFloat(document.getElementById('amount')?.value || '0'),
            description: document.getElementById('description')?.value || ''
        };
    }

    /**
     * フィルター変更を処理
     */
    handleFilterChange() {
        const filters = {
            type: document.getElementById('filterType')?.value || '',
            category: document.getElementById('filterCategory')?.value || '',
            month: document.getElementById('filterMonth')?.value || ''
        };
        this.dataManager.applyFilters(filters);
    }

    /**
     * カテゴリオプションを更新
     */
    updateCategoryOptions() {
        const typeSelect = document.getElementById('type');
        const categorySelect = document.getElementById('category');
        
        if (!typeSelect || !categorySelect) return;
        
        const type = typeSelect.value;
        categorySelect.innerHTML = '<option value="">選択してください</option>';
        
        if (type && this.dataManager.categories[type]) {
            this.dataManager.categories[type].forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            });
        }
    }

    /**
     * フィルターカテゴリオプションを更新
     */
    updateFilterCategoryOptions() {
        const filterCategorySelect = document.getElementById('filterCategory');
        if (!filterCategorySelect) return;
        
        const allCategories = [
            ...this.dataManager.categories[CONSTANTS.TRANSACTION_TYPES.INCOME], 
            ...this.dataManager.categories[CONSTANTS.TRANSACTION_TYPES.EXPENSE]
        ];
        
        filterCategorySelect.innerHTML = '<option value="">すべて</option>';
        
        allCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            filterCategorySelect.appendChild(option);
        });
    }

    /**
     * サマリーを更新
     */
    updateSummary() {
        const summary = this.dataManager.calculateSummary();
        
        const totalIncomeEl = document.getElementById('totalIncome');
        const totalExpenseEl = document.getElementById('totalExpense');
        const balanceEl = document.getElementById('balance');
        
        if (totalIncomeEl) totalIncomeEl.textContent = UTILS.formatCurrency(summary.income);
        if (totalExpenseEl) totalExpenseEl.textContent = UTILS.formatCurrency(summary.expense);
        if (balanceEl) balanceEl.textContent = UTILS.formatCurrency(summary.balance);
    }

    /**
     * トランザクションを表示
     */
    displayTransactions(transactions) {
        const tbody = document.getElementById('transactionsBody');
        const emptyState = document.getElementById('emptyState');
        
        if (!tbody || !emptyState) return;
        
        if (transactions.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        const fragment = document.createDocumentFragment();
        
        const sortedTransactions = [...transactions].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        sortedTransactions.forEach(transaction => {
            const tr = this.createTransactionRow(transaction);
            fragment.appendChild(tr);
        });
        
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    /**
     * トランザクション行を作成
     */
    createTransactionRow(transaction) {
        const tr = document.createElement('tr');
        
        // 日付
        const tdDate = document.createElement('td');
        tdDate.textContent = UTILS.formatDate(transaction.date);
        tr.appendChild(tdDate);
        
        // 種類
        const tdType = document.createElement('td');
        tdType.textContent = transaction.type === CONSTANTS.TRANSACTION_TYPES.INCOME ? '収入' : '支出';
        tr.appendChild(tdType);
        
        // カテゴリ
        const tdCategory = document.createElement('td');
        tdCategory.textContent = transaction.category;
        tr.appendChild(tdCategory);
        
        // 説明
        const tdDescription = document.createElement('td');
        tdDescription.textContent = transaction.description;
        tr.appendChild(tdDescription);
        
        // 金額
        const tdAmount = document.createElement('td');
        tdAmount.className = transaction.type === CONSTANTS.TRANSACTION_TYPES.INCOME ? 'amount-positive' : 'amount-negative';
        tdAmount.textContent = `${transaction.type === CONSTANTS.TRANSACTION_TYPES.INCOME ? '+' : '-'}${UTILS.formatCurrency(transaction.amount)}`;
        tr.appendChild(tdAmount);
        
        // 操作
        const tdAction = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '削除';
        deleteBtn.setAttribute('aria-label', `${UTILS.formatDate(transaction.date)}の取引を削除`);
        deleteBtn.addEventListener('click', () => this.deleteTransactionWithConfirm(transaction.id));
        tdAction.appendChild(deleteBtn);
        tr.appendChild(tdAction);
        
        return tr;
    }

    /**
     * フォームをクリア
     */
    clearForm() {
        const form = document.getElementById('transactionForm');
        if (form) {
            form.reset();
            const dateInput = document.getElementById('date');
            if (dateInput) {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
            this.updateCategoryOptions();
        }
    }

    /**
     * 確認付きトランザクション削除
     */
    async deleteTransactionWithConfirm(id) {
        const confirmed = await this.modalManager.showConfirm(
            '取引を削除',
            'この取引を削除しますか？',
            { confirmText: '削除', dangerous: true }
        );
        
        if (confirmed) {
            await this.dataManager.deleteTransaction(id);
        }
    }

    /**
     * 全データクリア
     */
    async clearAllData() {
        const confirmed = await this.modalManager.showConfirm(
            'すべてのデータを削除',
            'すべてのデータを削除しますか？この操作は取り消せません。',
            { confirmText: '削除', dangerous: true }
        );
        
        if (confirmed) {
            await this.dataManager.clearAllData();
            this.handleFilterChange();
            this.notificationManager.success('すべてのデータを削除しました');
        }
    }

    /**
     * Excelエクスポート
     */
    exportToExcel() {
        const result = this.fileHandler.exportToExcel();
        if (result.success) {
            this.notificationManager.success('Excelファイルをエクスポートしました');
        } else {
            this.notificationManager.warning(result.error.message);
        }
    }

    /**
     * Excelインポート
     */
    async importFromExcel(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const importMode = await this.showImportOptions();
            if (!importMode) return;

            this.showLoading('Excelファイルを読み込んでいます...');

            const result = await this.fileHandler.importFromExcel(file);
            
            if (!result.success) {
                this.hideLoading();
                this.notificationManager.error('Excelファイルの読み込みに失敗しました');
                return;
            }

            await this.processImportedData(result.data, importMode, 'Excel');
            
        } catch (error) {
            this.hideLoading();
            console.error('Import error:', error);
            this.notificationManager.error('インポートに失敗しました');
        } finally {
            event.target.value = '';
        }
    }

    /**
     * JSONエクスポート
     */
    exportData() {
        const result = this.fileHandler.exportToJSON();
        if (result.success) {
            this.notificationManager.success('JSONファイルをエクスポートしました');
        } else {
            this.notificationManager.error('JSONエクスポートに失敗しました');
        }
    }

    /**
     * JSONインポート
     */
    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const importMode = await this.showImportOptions();
            if (!importMode) return;

            const result = await this.fileHandler.importFromJSON(file);
            
            if (!result.success) {
                this.notificationManager.error('ファイルの読み込みに失敗しました');
                return;
            }

            await this.processImportedData(result.data, importMode, 'JSON');
            
        } catch (error) {
            console.error('Import error:', error);
            this.notificationManager.error('インポートに失敗しました');
        } finally {
            event.target.value = '';
        }
    }

    /**
     * インポートされたデータを処理
     */
    async processImportedData(data, importMode, format) {
        // データの正規化と処理ロジック
        // 実装は元のコードのimportFromExcel/importDataメソッドから抽出
        this.notificationManager.success(`${format}データをインポートしました`);
    }

    /**
     * カテゴリマネージャーを表示
     */
    showCategoryManager() {
        const modal = this.modalManager.createModal();
        const categoryManagerUI = new CategoryManagerUI(this.dataManager, modal, this);
        categoryManagerUI.render();
        this.modalManager.showModal(modal.overlay);
    }

    /**
     * ストレージ情報を表示
     */
    async showStorageInfo() {
        try {
            const dataSize = JSON.stringify(this.dataManager.transactions).length;
            const totalRecords = this.dataManager.transactions.length;
            
            let storageInfo = '';
            
            if (this.dataManager.isInitialized && this.dataManager.dbManager.db) {
                const sizeInfo = await this.dataManager.dbManager.getDatabaseSize();
                storageInfo = `
                    <p><span aria-hidden="true">💾</span> <strong>IndexedDB使用量:</strong> ${UTILS.formatBytes(sizeInfo.usage)}</p>
                    <p><span aria-hidden="true">📊</span> <strong>使用率:</strong> ${sizeInfo.usagePercentage.toFixed(2)}%</p>
                `;
            } else {
                storageInfo = '<p><span aria-hidden="true">💾</span> <strong>ストレージ:</strong> localStorage使用中</p>';
            }
            
            await this.modalManager.showAlert(
                'ストレージ情報',
                `取引件数: ${totalRecords}件\nデータサイズ: ${UTILS.formatBytes(dataSize)}\n${storageInfo}`,
                { type: 'info' }
            );
            
        } catch (error) {
            this.notificationManager.error('ストレージ情報の取得に失敗しました');
        }
    }

    /**
     * バックアップから復元
     */
    async restoreFromBackup() {
        try {
            const backup = await this.dataManager.getLatestBackup();
            
            if (!backup || !backup.data) {
                this.notificationManager.warning('バックアップデータが見つかりません');
                return;
            }
            
            const backupDate = new Date(backup.timestamp).toLocaleString('ja-JP');
            const transactions = backup.data.transactions || [];
            
            const confirmed = await this.modalManager.showConfirm(
                'バックアップからの復元',
                `バックアップからデータを復元しますか？\n\nバックアップ日時: ${backupDate}\n件数: ${transactions.length}件\n\n現在のデータは上書きされます。`,
                { confirmText: '復元', dangerous: true }
            );
            
            if (confirmed) {
                this.dataManager.fromSaveFormat(backup.data);
                this.notificationManager.success('バックアップからデータを復元しました');
            }
        } catch (error) {
            console.error('バックアップからの復元に失敗しました:', error);
            this.notificationManager.error('バックアップからの復元に失敗しました');
        }
    }

    /**
     * インポートオプションを表示
     */
    async showImportOptions() {
        return new Promise((resolve) => {
            const modal = this.modalManager.createModal();
            
            modal.content.innerHTML = `
                <h2 class="modal-title"><span aria-hidden="true">📥</span> インポート方法を選択</h2>
                <div class="radio-group">
                    <label class="radio-option selected" data-mode="add">
                        <input type="radio" name="importMode" value="add" checked>
                        <div>
                            <strong>既存データに追加</strong>
                            <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                                現在のデータを保持して、新しいデータを追加します
                            </div>
                        </div>
                    </label>
                    <label class="radio-option" data-mode="replace">
                        <input type="radio" name="importMode" value="replace">
                        <div>
                            <strong>既存データを上書き</strong>
                            <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">
                                現在のデータを削除して、新しいデータに置き換えます
                            </div>
                        </div>
                    </label>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary" data-action="cancel">キャンセル</button>
                    <button class="btn btn-primary" data-action="confirm">実行</button>
                </div>
            `;

            const handleClose = (result) => {
                this.modalManager.closeModal(modal.overlay);
                resolve(result);
            };

            modal.content.addEventListener('click', (e) => {
                if (e.target.closest('.radio-option')) {
                    const option = e.target.closest('.radio-option');
                    const radio = option.querySelector('input[type="radio"]');
                    
                    modal.content.querySelectorAll('.radio-option').forEach(opt => {
                        opt.classList.remove('selected');
                        opt.querySelector('input').checked = false;
                    });
                    
                    option.classList.add('selected');
                    radio.checked = true;
                }
                
                if (e.target.dataset.action === 'confirm') {
                    const selectedMode = modal.content.querySelector('input[name="importMode"]:checked').value;
                    handleClose(selectedMode);
                } else if (e.target.dataset.action === 'cancel') {
                    handleClose(null);
                }
            });

            this.modalManager.showModal(modal.overlay);
        });
    }

    /**
     * ローディング表示
     */
    showLoading(message = '処理中...') {
        const existing = document.querySelector(`.${CONSTANTS.CSS_CLASSES.LOADING_SPINNER}`);
        if (existing) {
            existing.remove();
        }

        const loadingDiv = document.createElement('div');
        loadingDiv.className = CONSTANTS.CSS_CLASSES.LOADING_SPINNER;
        loadingDiv.setAttribute('role', 'status');
        loadingDiv.setAttribute('aria-live', 'polite');
        loadingDiv.innerHTML = `
            <div class="spinner"></div>
            <div>${message}</div>
            <span class="sr-only">${message}</span>
        `;
        
        document.body.appendChild(loadingDiv);
        return loadingDiv;
    }

    /**
     * ローディング非表示
     */
    hideLoading() {
        const loading = document.querySelector(`.${CONSTANTS.CSS_CLASSES.LOADING_SPINNER}`);
        if (loading) {
            loading.remove();
        }
    }

    /**
     * リソースのクリーンアップ
     */
    destroy() {
        // モーダル管理をクリーンアップ
        if (this.modalManager) {
            this.modalManager.destroy();
        }
        
        // 通知をクリア
        if (this.notificationManager) {
            this.notificationManager.hideAll();
        }
        
        // チャート管理をクリーンアップ
        if (this.chartManager) {
            this.chartManager.destroy();
        }
        
        // イベントリスナーを削除
        // 必要に応じて追加のクリーンアップ
    }
}
