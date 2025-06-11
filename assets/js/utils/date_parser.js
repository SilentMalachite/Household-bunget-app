// 日付解析ユーティリティ
import { CONSTANTS } from '../constants.js';

export class DateParser {
    /**
     * サポートされている日付フォーマット
     */
    static SUPPORTED_FORMATS = [
        { pattern: /^\d{4}-\d{2}-\d{2}$/, name: 'YYYY-MM-DD', example: '2025-01-15' },
        { pattern: /^\d{4}\/\d{1,2}\/\d{1,2}$/, name: 'YYYY/MM/DD', example: '2025/1/15' },
        { pattern: /^\d{2}\/\d{1,2}\/\d{1,2}$/, name: 'YY/MM/DD', example: '25/1/15' },
        { pattern: /^\d{4}年\d{1,2}月\d{1,2}日$/, name: 'YYYY年MM月DD日', example: '2025年1月15日' },
        { pattern: /^\d{1,2}-\d{1,2}-\d{4}$/, name: 'DD-MM-YYYY', example: '15-01-2025' },
        { pattern: /^\d{1,2}\/\d{1,2}\/\d{4}$/, name: 'DD/MM/YYYY', example: '15/01/2025' }
    ];

    /**
     * 日付をHTML input[type="date"]形式に変換
     * @param {string|number|Date} dateValue - 変換する日付値
     * @returns {string} - YYYY-MM-DD形式の文字列
     */
    static formatDateForInput(dateValue) {
        if (!dateValue) return '';
        
        try {
            let date;
            
            // Excel シリアル値の処理
            if (typeof dateValue === 'number' && dateValue > 1 && dateValue < 100000) {
                date = this.parseExcelSerialDate(dateValue);
            } 
            // 文字列の場合
            else if (typeof dateValue === 'string') {
                date = this.parseStringDate(dateValue.trim());
            } 
            // Dateオブジェクトの場合
            else if (dateValue instanceof Date) {
                date = new Date(dateValue);
            } 
            // その他の場合
            else {
                console.warn('サポートされていない日付形式:', dateValue);
                return '';
            }

            // 日付の有効性チェック
            if (!this.isValidDate(date)) {
                console.warn('無効な日付:', dateValue);
                return '';
            }

            // 年の範囲チェック
            if (!this.isValidYear(date.getFullYear())) {
                console.warn('日付が範囲外:', date.getFullYear() + '年');
                return '';
            }

            return this.formatToISO(date);
            
        } catch (error) {
            console.error('日付変換エラー:', error, dateValue);
            return '';
        }
    }

    /**
     * Excelシリアル日付を解析
     * @param {number} serialDate - Excelシリアル日付
     * @returns {Date} - Dateオブジェクト
     */
    static parseExcelSerialDate(serialDate) {
        // Excelの基準日は1900年1月1日（ただし1900年の閏年バグがある）
        const excelEpoch = new Date(1899, 11, 30);
        
        // 1900年2月28日以前は1日ずれるExcelのバグに対応
        const daysOffset = serialDate > 59 ? serialDate : serialDate - 1;
        
        return new Date(excelEpoch.getTime() + daysOffset * 86400 * 1000);
    }

    /**
     * 文字列日付を解析
     * @param {string} dateStr - 日付文字列
     * @returns {Date} - Dateオブジェクト
     */
    static parseStringDate(dateStr) {
        // YYYY-MM-DD形式
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        
        // YYYY/MM/DD形式
        if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('/').map(Number);
            return new Date(year, month - 1, day);
        }
        
        // YY/MM/DD形式
        if (/^\d{2}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('/').map(Number);
            const fullYear = year + (year < 50 ? 2000 : 1900);
            return new Date(fullYear, month - 1, day);
        }
        
        // DD/MM/YYYY形式
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/').map(Number);
            return new Date(year, month - 1, day);
        }
        
        // DD-MM-YYYY形式
        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        
        // YYYY年MM月DD日形式
        if (/^\d{4}年\d{1,2}月\d{1,2}日$/.test(dateStr)) {
            const matches = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
            if (matches) {
                const [, year, month, day] = matches.map(Number);
                return new Date(year, month - 1, day);
            }
        }
        
        // ISO 8601形式
        if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
            return new Date(dateStr);
        }
        
        // 最後の手段としてDateコンストラクタに任せる
        const fallbackDate = new Date(dateStr);
        if (!isNaN(fallbackDate.getTime())) {
            return fallbackDate;
        }
        
        throw new Error(`解析できない日付形式: ${dateStr}`);
    }

    /**
     * 日付の有効性をチェック
     * @param {Date} date - チェックする日付
     * @returns {boolean} - 有効かどうか
     */
    static isValidDate(date) {
        return date instanceof Date && !isNaN(date.getTime());
    }

    /**
     * 年の有効性をチェック
     * @param {number} year - チェックする年
     * @returns {boolean} - 有効かどうか
     */
    static isValidYear(year) {
        return year >= CONSTANTS.VALIDATION.MIN_YEAR && 
               year <= CONSTANTS.VALIDATION.MAX_YEAR;
    }

    /**
     * DateオブジェクトをISO形式（YYYY-MM-DD）に変換
     * @param {Date} date - 変換する日付
     * @returns {string} - YYYY-MM-DD形式の文字列
     */
    static formatToISO(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 日付を日本語形式でフォーマット
     * @param {string|Date} date - フォーマットする日付
     * @returns {string} - 日本語形式の日付文字列
     */
    static formatToJapanese(date) {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        
        if (!this.isValidDate(dateObj)) {
            return '';
        }
        
        return dateObj.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * 相対日付を計算（何日前、何日後など）
     * @param {string|Date} date - 基準日付
     * @returns {string} - 相対日付文字列
     */
    static getRelativeDate(date) {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const now = new Date();
        
        if (!this.isValidDate(dateObj)) {
            return '';
        }
        
        const diffTime = now.getTime() - dateObj.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return '今日';
        } else if (diffDays === 1) {
            return '昨日';
        } else if (diffDays === -1) {
            return '明日';
        } else if (diffDays > 0) {
            return `${diffDays}日前`;
        } else {
            return `${Math.abs(diffDays)}日後`;
        }
    }

    /**
     * 月の範囲を取得（フィルタリング用）
     * @param {number} monthsBack - 何ヶ月前まで
     * @param {Date} endDate - 終了日（デフォルトは今日）
     * @returns {Array} - 月の配列
     */
    static getMonthRange(monthsBack = 12, endDate = new Date()) {
        const months = [];
        
        for (let i = monthsBack - 1; i >= 0; i--) {
            const date = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
            const yearMonth = this.formatToISO(date).substring(0, 7);
            const label = date.toLocaleDateString('ja-JP', { 
                year: 'numeric', 
                month: 'long' 
            });
            
            months.push({ value: yearMonth, label });
        }
        
        return months;
    }

    /**
     * サポートされている日付フォーマットの説明を取得
     * @returns {string} - フォーマット説明
     */
    static getSupportedFormatsDescription() {
        return this.SUPPORTED_FORMATS
            .map(f => `${f.name} (例: ${f.example})`)
            .join('、');
    }

    /**
     * 日付文字列が特定のフォーマットに一致するかチェック
     * @param {string} dateStr - チェックする日付文字列
     * @param {string} formatName - フォーマット名
     * @returns {boolean} - 一致するかどうか
     */
    static matchesFormat(dateStr, formatName) {
        const format = this.SUPPORTED_FORMATS.find(f => f.name === formatName);
        return format ? format.pattern.test(dateStr) : false;
    }

    /**
     * 日付の妥当性を詳細にチェック
     * @param {string|Date} date - チェックする日付
     * @returns {object} - {isValid: boolean, errors: array, sanitizedDate: string}
     */
    static validateDate(date) {
        const errors = [];
        let sanitizedDate = '';
        
        try {
            if (!date) {
                errors.push('日付が入力されていません');
                return { isValid: false, errors, sanitizedDate };
            }
            
            sanitizedDate = this.formatDateForInput(date);
            
            if (!sanitizedDate) {
                errors.push('日付の形式が正しくありません');
                return { isValid: false, errors, sanitizedDate };
            }
            
            const dateObj = new Date(sanitizedDate);
            
            // 未来の日付チェック（必要に応じて）
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (dateObj > today) {
                // 未来の日付は警告として扱う（エラーではない）
                console.warn('未来の日付が入力されました:', sanitizedDate);
            }
            
        } catch (error) {
            errors.push('日付の解析中にエラーが発生しました');
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            sanitizedDate
        };
    }
}