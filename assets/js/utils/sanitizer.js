// 入力値サニタイゼーション機能
import { CONSTANTS } from '../constants.js';

export class Sanitizer {
    /**
     * HTMLタグを除去してXSS攻撃を防ぐ
     * @param {string} input - サニタイズする文字列
     * @returns {string} - サニタイズされた文字列
     */
    static sanitizeHTML(input) {
        if (typeof input !== 'string') {
            return '';
        }

        // 基本的なHTMLタグとスクリプトを除去
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
            .replace(/<link\b[^>]*>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/<[^>]*>/g, '');
    }

    /**
     * 取引の説明文をサニタイズ
     * @param {string} description - 説明文
     * @returns {string} - サニタイズされた説明文
     */
    static sanitizeDescription(description) {
        if (!description) return '';
        
        let sanitized = this.sanitizeHTML(description);
        
        // 長さ制限
        if (sanitized.length > CONSTANTS.VALIDATION.MAX_DESCRIPTION_LENGTH) {
            sanitized = sanitized.substring(0, CONSTANTS.VALIDATION.MAX_DESCRIPTION_LENGTH);
        }
        
        // 前後の空白を除去
        return sanitized.trim();
    }

    /**
     * カテゴリ名をサニタイズ
     * @param {string} category - カテゴリ名
     * @returns {string} - サニタイズされたカテゴリ名
     */
    static sanitizeCategory(category) {
        if (!category) return '';
        
        let sanitized = this.sanitizeHTML(category);
        
        // 特殊文字を除去（日本語、英数字、ハイフン、アンダースコアのみ許可）
        sanitized = sanitized.replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\-_\s]/g, '');
        
        // 長さ制限（50文字）
        if (sanitized.length > 50) {
            sanitized = sanitized.substring(0, 50);
        }
        
        return sanitized.trim();
    }

    /**
     * ファイル名をサニタイズ
     * @param {string} filename - ファイル名
     * @returns {string} - サニタイズされたファイル名
     */
    static sanitizeFilename(filename) {
        if (!filename) return '';
        
        // 危険な文字を除去
        let sanitized = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
        
        // 長さ制限（100文字）
        if (sanitized.length > 100) {
            const extension = sanitized.split('.').pop();
            const name = sanitized.substring(0, 100 - extension.length - 1);
            sanitized = name + '.' + extension;
        }
        
        return sanitized;
    }

    /**
     * 数値をサニタイズ（金額用）
     * @param {string|number} amount - 金額
     * @returns {number} - サニタイズされた金額
     */
    static sanitizeAmount(amount) {
        // 文字列の場合は数値に変換
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        
        // NaNチェック
        if (isNaN(numAmount)) {
            return 0;
        }
        
        // 範囲チェック
        if (numAmount < CONSTANTS.VALIDATION.MIN_AMOUNT) {
            return CONSTANTS.VALIDATION.MIN_AMOUNT;
        }
        
        if (numAmount > CONSTANTS.VALIDATION.MAX_AMOUNT) {
            return CONSTANTS.VALIDATION.MAX_AMOUNT;
        }
        
        // 小数点以下を四捨五入（円単位）
        return Math.round(numAmount);
    }

    /**
     * 日付文字列をサニタイズ
     * @param {string} dateString - 日付文字列
     * @returns {string} - サニタイズされた日付文字列（YYYY-MM-DD形式）
     */
    static sanitizeDate(dateString) {
        if (!dateString) return '';
        
        // HTMLタグを除去
        const sanitized = this.sanitizeHTML(dateString);
        
        // 日付形式の検証
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(sanitized)) {
            return '';
        }
        
        // 実際の日付として有効かチェック
        const date = new Date(sanitized);
        if (isNaN(date.getTime())) {
            return '';
        }
        
        // 年の範囲チェック
        const year = date.getFullYear();
        if (year < CONSTANTS.VALIDATION.MIN_YEAR || year > CONSTANTS.VALIDATION.MAX_YEAR) {
            return '';
        }
        
        return sanitized;
    }

    /**
     * JSONデータをサニタイズ
     * @param {object} data - JSONデータ
     * @returns {object} - サニタイズされたJSONデータ
     */
    static sanitizeJSON(data) {
        if (!data || typeof data !== 'object') {
            return {};
        }
        
        const sanitized = {};
        
        // 再帰的にオブジェクトをサニタイズ
        const sanitizeValue = (value) => {
            if (typeof value === 'string') {
                return this.sanitizeHTML(value);
            } else if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    return value.map(sanitizeValue);
                } else {
                    const sanitizedObj = {};
                    Object.keys(value).forEach(key => {
                        const sanitizedKey = this.sanitizeHTML(key);
                        if (sanitizedKey) {
                            sanitizedObj[sanitizedKey] = sanitizeValue(value[key]);
                        }
                    });
                    return sanitizedObj;
                }
            }
            return value;
        };
        
        return sanitizeValue(data);
    }

    /**
     * バリデーション結果を含む包括的なサニタイズ
     * @param {object} transactionData - 取引データ
     * @returns {object} - {isValid: boolean, sanitizedData: object, errors: array}
     */
    static validateAndSanitizeTransaction(transactionData) {
        const errors = [];
        const sanitizedData = {};
        
        // 日付のバリデーションとサニタイズ
        const sanitizedDate = this.sanitizeDate(transactionData.date);
        if (!sanitizedDate) {
            errors.push('有効な日付を入力してください');
        } else {
            sanitizedData.date = sanitizedDate;
        }
        
        // 種類のバリデーション
        const type = transactionData.type;
        if (!type || !Object.values(CONSTANTS.TRANSACTION_TYPES).includes(type)) {
            errors.push('取引種類を選択してください');
        } else {
            sanitizedData.type = type;
        }
        
        // カテゴリのサニタイズ
        const sanitizedCategory = this.sanitizeCategory(transactionData.category);
        if (!sanitizedCategory) {
            errors.push('カテゴリを入力してください');
        } else {
            sanitizedData.category = sanitizedCategory;
        }
        
        // 金額のサニタイズとバリデーション
        const sanitizedAmount = this.sanitizeAmount(transactionData.amount);
        if (sanitizedAmount < CONSTANTS.VALIDATION.MIN_AMOUNT) {
            errors.push(`金額は${CONSTANTS.VALIDATION.MIN_AMOUNT}円以上で入力してください`);
        } else {
            sanitizedData.amount = sanitizedAmount;
        }
        
        // 説明のサニタイズ（任意項目）
        sanitizedData.description = this.sanitizeDescription(transactionData.description || '');
        
        return {
            isValid: errors.length === 0,
            sanitizedData,
            errors
        };
    }

    /**
     * CSVインポート用のセルデータサニタイズ
     * @param {string} cellValue - セルの値
     * @returns {string} - サニタイズされた値
     */
    static sanitizeCSVCell(cellValue) {
        if (typeof cellValue !== 'string') {
            return String(cellValue || '');
        }
        
        // CSVインジェクション対策
        let sanitized = cellValue;
        
        // 先頭の危険な文字を除去
        if (/^[@=+\-]/.test(sanitized)) {
            sanitized = sanitized.substring(1);
        }
        
        // HTMLタグを除去
        sanitized = this.sanitizeHTML(sanitized);
        
        return sanitized.trim();
    }
}