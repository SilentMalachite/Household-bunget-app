// アプリケーション定数定義
export const CONSTANTS = {
    // トランザクション種別
    TRANSACTION_TYPES: {
        INCOME: 'income',
        EXPENSE: 'expense'
    },

    // 通知タイプ
    NOTIFICATION_TYPES: {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info'
    },

    // ストレージキー
    STORAGE_KEYS: {
        MAIN_DATA: 'householdBudgetData',
        BACKUP_DATA: 'householdBudgetBackup'
    },

    // CSSクラス
    CSS_CLASSES: {
        LOADING_SPINNER: 'loading-spinner',
        MODAL_OVERLAY: 'modal-overlay',
        MODAL_CONTENT: 'modal-content',
        SHOW: 'show',
        HIDDEN: 'hidden'
    },

    // デフォルト値
    DEFAULTS: {
        NOTIFICATION_DURATION: 3000,
        DEBOUNCE_DELAY: 500,
        AUTO_BACKUP_INTERVAL: 100,
        MAX_CHART_AMOUNT: 200000, // チャートの最大金額（20万円）
        CHART_STEP_SIZE: 5000 // チャートの刻み幅（5,000円）
    },

    // IndexedDB設定
    INDEXEDDB: {
        DB_NAME: 'HouseholdBudgetDB',
        VERSION: 1,
        STORES: {
            TRANSACTIONS: 'transactions',
            SETTINGS: 'settings',
            BACKUPS: 'backups'
        }
    },

    // チャート色設定
    CHART: {
        COLORS: {
            INCOME: 'rgba(40, 167, 69, 0.8)',
            EXPENSE: 'rgba(220, 53, 69, 0.8)',
            INCOME_BORDER: 'rgba(40, 167, 69, 1)',
            EXPENSE_BORDER: 'rgba(220, 53, 69, 1)'
        }
    },

    // バリデーション設定
    VALIDATION: {
        MIN_AMOUNT: 1,
        MAX_AMOUNT: 99999999,
        MAX_DESCRIPTION_LENGTH: 200,
        MIN_YEAR: 1900,
        MAX_YEAR: 2100
    },

    // セキュリティ設定
    SECURITY: {
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_FILE_TYPES: ['.json', '.xlsx', '.xls'],
        SANITIZE_HTML: true
    },

    // エラーメッセージ
    ERROR_MESSAGES: {
        REQUIRED_FIELDS: 'すべての必須項目を入力してください',
        INVALID_AMOUNT: '金額は1円以上で入力してください',
        INVALID_DATE: '有効な日付を入力してください',
        FILE_TOO_LARGE: 'ファイルサイズが大きすぎます（10MB以下にしてください）',
        INVALID_FILE_TYPE: '対応していないファイル形式です',
        NETWORK_ERROR: 'ネットワークエラーが発生しました',
        STORAGE_ERROR: 'データの保存に失敗しました',
        IMPORT_ERROR: 'ファイルの読み込みに失敗しました',
        CATEGORY_EXISTS: 'このカテゴリは既に存在します',
        CATEGORY_IN_USE: 'このカテゴリは取引で使用されています'
    },

    // 成功メッセージ
    SUCCESS_MESSAGES: {
        TRANSACTION_ADDED: '取引を追加しました',
        TRANSACTION_DELETED: '取引を削除しました',
        DATA_EXPORTED: 'データをエクスポートしました',
        DATA_IMPORTED: 'データをインポートしました',
        BACKUP_CREATED: 'バックアップを作成しました',
        BACKUP_RESTORED: 'バックアップからデータを復元しました',
        CATEGORY_ADDED: 'カテゴリを追加しました',
        CATEGORY_REMOVED: 'カテゴリを削除しました'
    }
};

// デフォルトカテゴリ設定
export const DEFAULT_CATEGORIES = {
    [CONSTANTS.TRANSACTION_TYPES.INCOME]: [
        '給与', 'ボーナス', '副業', '投資', 'その他収入'
    ],
    [CONSTANTS.TRANSACTION_TYPES.EXPENSE]: [
        '食費', '交通費', '光熱費', '通信費', '娯楽', 
        '医療費', '衣服', '日用品', 'その他支出'
    ]
};

// アプリケーション設定
export const APP_CONFIG = {
    VERSION: '2.0.0',
    AUTHOR: 'Household Budget Team',
    DESCRIPTION: 'シンプルで使いやすい家計簿アプリ',
    GITHUB_URL: 'https://github.com/your-repo/household-budget',
    SUPPORT_EMAIL: 'support@household-budget.com'
};

// 環境設定
export const ENVIRONMENT = {
    IS_DEVELOPMENT: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
    IS_PRODUCTION: location.protocol === 'https:',
    DEBUG_MODE: false // 本番環境では false に設定
};

// ユーティリティ関数
export const UTILS = {
    // 金額フォーマット
    formatCurrency: (amount) => '¥' + amount.toLocaleString('ja-JP'),
    
    // 日付フォーマット
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP');
    },
    
    // バイトサイズフォーマット
    formatBytes: (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },
    
    // ランダムID生成
    generateId: () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};