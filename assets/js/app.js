// アプリケーション初期化とメイン制御
import { HouseholdBudgetData } from './data/dataManager.js';
import { UIManager } from './ui/uiManager.js';
import { CONSTANTS, ENVIRONMENT } from './constants.js';

class App {
    constructor() {
        this.dataManager = new HouseholdBudgetData();
        this.uiManager = new UIManager(this.dataManager);
        this.isInitialized = false;
        
        // エラーハンドリングを設定
        this.setupErrorHandling();
    }

    /**
     * アプリケーションを初期化
     */
    async init() {
        try {
            // ローディング表示
            this.uiManager.showLoading('データを読み込んでいます...');
            
            // データマネージャーを初期化
            await this.dataManager.init();
            
            // UIを初期化
            this.initializeUI();
            
            // 初期化完了
            this.isInitialized = true;
            
            // ローディング非表示
            this.uiManager.hideLoading();
            
            // 起動完了メッセージ
            this.showStartupMessage();
            
            // 開発モードの場合はデバッグ情報を表示
            if (ENVIRONMENT.DEBUG_MODE) {
                this.showDebugInfo();
            }
            
        } catch (error) {
            console.error('初期化エラー:', error);
            this.uiManager.hideLoading();
            this.uiManager.notificationManager.error(
                'アプリケーションの初期化に失敗しました。ページを再読み込みしてください。'
            );
        }
    }

    /**
     * UIを初期化
     */
    initializeUI() {
        // 今日の日付を設定
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('date');
        if (dateInput) {
            dateInput.value = today;
        }
        
        // フィルタの復元
        setTimeout(() => {
            const filterType = document.getElementById('filterType');
            const filterCategory = document.getElementById('filterCategory');
            const filterMonth = document.getElementById('filterMonth');
            
            if (filterType) filterType.value = this.dataManager.filters.type || '';
            if (filterCategory) filterCategory.value = this.dataManager.filters.category || '';
            if (filterMonth) filterMonth.value = this.dataManager.filters.month || '';
            
            this.uiManager.handleFilterChange();
        }, 100);
    }

    /**
     * 起動完了メッセージを表示
     */
    showStartupMessage() {
        const transactionCount = this.dataManager.transactions.length;
        
        if (transactionCount > 0) {
            console.log(`${transactionCount}件の取引データを読み込みました`);
            this.uiManager.notificationManager.info(
                `${transactionCount}件のデータを読み込みました`,
                2000
            );
        } else {
            this.uiManager.notificationManager.info(
                '家計簿アプリへようこそ！最初の取引を追加してください。',
                3000
            );
        }
        
        // IndexedDB利用状況
        if (this.dataManager.isInitialized && this.dataManager.dbManager.db) {
            console.log('IndexedDBを使用してデータを管理しています');
        } else {
            console.log('localStorageを使用してデータを管理しています');
        }
    }

    /**
     * デバッグ情報を表示
     */
    showDebugInfo() {
        console.group('🐛 デバッグ情報');
        console.log('データマネージャー:', this.dataManager);
        console.log('UIマネージャー:', this.uiManager);
        console.log('取引数:', this.dataManager.transactions.length);
        console.log('カテゴリ:', this.dataManager.categories);
        console.log('環境設定:', ENVIRONMENT);
        console.groupEnd();
        
        // グローバルオブジェクトとして公開（開発用）
        window.__APP_DEBUG__ = {
            app: this,
            dataManager: this.dataManager,
            uiManager: this.uiManager,
            constants: CONSTANTS
        };
    }

    /**
     * エラーハンドリングを設定
     */
    setupErrorHandling() {
        // 未処理のPromise拒否
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未処理のPromise拒否:', event.reason);
            
            if (this.uiManager) {
                this.uiManager.notificationManager.error(
                    '予期しないエラーが発生しました。操作を再試行してください。'
                );
            }
            
            // 開発環境では詳細表示
            if (ENVIRONMENT.IS_DEVELOPMENT) {
                console.error('詳細:', event);
            }
        });

        // 未処理のJavaScriptエラー
        window.addEventListener('error', (event) => {
            console.error('JavaScriptエラー:', event.error);
            
            if (this.uiManager) {
                this.uiManager.notificationManager.error(
                    'アプリケーションエラーが発生しました。'
                );
            }
            
            // 開発環境では詳細表示
            if (ENVIRONMENT.IS_DEVELOPMENT) {
                console.error('ファイル:', event.filename);
                console.error('行:', event.lineno);
                console.error('列:', event.colno);
            }
        });

        // ページ離脱時の処理
        window.addEventListener('beforeunload', (event) => {
            if (this.dataManager && this.dataManager.isInitialized) {
                // 設定を保存
                this.dataManager.saveSettings();
                
                // 未保存の変更がある場合は警告
                if (this.hasUnsavedChanges()) {
                    event.preventDefault();
                    event.returnValue = '未保存の変更があります。本当にページを離れますか？';
                    return event.returnValue;
                }
            }
        });

        // ページ非表示時の処理
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.dataManager) {
                // バックアップを作成
                this.dataManager.createAutoBackup();
            }
        });
    }

    /**
     * 未保存の変更があるかチェック
     * @returns {boolean} 未保存の変更があるかどうか
     */
    hasUnsavedChanges() {
        // 現在は即座に保存されるため、常にfalse
        // 将来的にオフライン対応やバッチ保存を実装する場合に使用
        return false;
    }

    /**
     * アプリケーションを再起動
     */
    async restart() {
        try {
            // リソースをクリーンアップ
            if (this.dataManager) {
                this.dataManager.destroy();
            }
            if (this.uiManager) {
                this.uiManager.destroy();
            }
            
            // 新しいインスタンスを作成
            this.dataManager = new HouseholdBudgetData();
            this.uiManager = new UIManager(this.dataManager);
            
            // 再初期化
            await this.init();
            
            this.uiManager.notificationManager.success('アプリケーションを再起動しました');
            
        } catch (error) {
            console.error('再起動エラー:', error);
            this.uiManager.notificationManager.error('再起動に失敗しました');
        }
    }

    /**
     * アプリケーションの統計情報を取得
     * @returns {object} 統計情報
     */
    getStats() {
        if (!this.dataManager) return null;
        
        const summary = this.dataManager.calculateSummary();
        
        return {
            version: CONSTANTS.APP_CONFIG?.VERSION || '2.0.0',
            transactions: summary.transactionCount,
            totalIncome: summary.income,
            totalExpense: summary.expense,
            balance: summary.balance,
            categories: Object.values(this.dataManager.categories).flat().length,
            isIndexedDBSupported: this.dataManager.isInitialized && !!this.dataManager.dbManager.db,
            lastModified: this.dataManager.stats.lastModified,
            createdAt: this.dataManager.stats.createdAt
        };
    }
}

// DOM読み込み完了後にアプリケーションを起動
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
    
    // グローバルアクセス用（デバッグ・テスト用途）
    if (ENVIRONMENT.IS_DEVELOPMENT) {
        window.__HOUSEHOLD_BUDGET_APP__ = app;
    }
});

// ServiceWorker登録（将来的なPWA対応用）
if ('serviceWorker' in navigator && ENVIRONMENT.IS_PRODUCTION) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker登録成功:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker登録失敗:', error);
            });
    });
}