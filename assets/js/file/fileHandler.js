// ファイル処理クラス
import { CONSTANTS } from '../constants.js';
import { DateParser } from '../utils/dateParser.js';
import { Sanitizer } from '../utils/sanitizer.js';

export class FileHandler {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.maxFileSize = CONSTANTS.SECURITY.MAX_FILE_SIZE;
        this.allowedTypes = CONSTANTS.SECURITY.ALLOWED_FILE_TYPES;
    }

    /**
     * ファイルサイズと形式を検証
     */
    validateFile(file, allowedExtensions = null) {
        const errors = [];
        
        // ファイルサイズチェック
        if (file.size > this.maxFileSize) {
            errors.push(`ファイルサイズが大きすぎます（${this.formatFileSize(this.maxFileSize)}以下にしてください）`);
        }
        
        // ファイル形式チェック
        const extension = this.getFileExtension(file.name);
        const validTypes = allowedExtensions || this.allowedTypes;
        
        if (!validTypes.includes(extension)) {
            errors.push(`対応していないファイル形式です（対応形式: ${validTypes.join(', ')}）`);
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * ファイル拡張子を取得
     */
    getFileExtension(filename) {
        return '.' + filename.split('.').pop().toLowerCase();
    }

    /**
     * ファイルサイズをフォーマット
     */
    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)}${units[unitIndex]}`;
    }

    /**
     * JSONエクスポート
     */
    exportToJSON() {
        try {
            const data = this.dataManager.toSaveFormat();
            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const filename = this.generateFilename('家計簿データ', 'json');
            this.downloadFile(dataBlob, filename);
            
            return { success: true };
        } catch (error) {
            console.error('JSON export error:', error);
            return { success: false, error };
        }
    }

    /**
     * JSONインポート
     */
    async importFromJSON(file) {
        // ファイル検証
        const validation = this.validateFile(file, ['.json']);
        if (!validation.isValid) {
            return { success: false, error: new Error(validation.errors.join('\n')) };
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    // データ形式の検証
                    const validationResult = this.validateJSONData(importedData);
                    if (!validationResult.isValid) {
                        resolve({ success: false, error: new Error(validationResult.errors.join('\n')) });
                        return;
                    }
                    
                    resolve({ success: true, data: importedData });
                } catch (error) {
                    console.error('JSON parse error:', error);
                    resolve({ success: false, error: new Error('JSONファイルの形式が正しくありません') });
                }
            };
            
            reader.onerror = () => {
                resolve({ success: false, error: new Error('ファイルの読み込みに失敗しました') });
            };
            
            reader.readAsText(file, 'UTF-8');
        });
    }

    /**
     * JSONデータの形式を検証
     */
    validateJSONData(data) {
        const errors = [];
        
        // 基本構造チェック
        if (!data || typeof data !== 'object') {
            errors.push('データ形式が正しくありません');
            return { isValid: false, errors };
        }
        
        // トランザクションデータのチェック
        if (Array.isArray(data)) {
            // 旧形式（配列）の場合
            data.forEach((item, index) => {
                const itemErrors = this.validateTransaction(item, index);
                errors.push(...itemErrors);
            });
        } else if (data.transactions) {
            // 新形式（オブジェクト）の場合
            if (!Array.isArray(data.transactions)) {
                errors.push('トランザクションデータが配列ではありません');
            } else {
                data.transactions.forEach((item, index) => {
                    const itemErrors = this.validateTransaction(item, index);
                    errors.push(...itemErrors);
                });
            }
        } else {
            errors.push('トランザクションデータが見つかりません');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors.slice(0, 10) // 最初の10個のエラーのみ表示
        };
    }

    /**
     * 個別トランザクションを検証
     */
    validateTransaction(transaction, index) {
        const errors = [];
        const prefix = `行${index + 1}: `;
        
        if (!transaction.id) {
            errors.push(`${prefix}IDが不正です`);
        }
        
        if (!transaction.date || !DateParser.validateDate(transaction.date).isValid) {
            errors.push(`${prefix}日付が不正です`);
        }
        
        if (!Object.values(CONSTANTS.TRANSACTION_TYPES).includes(transaction.type)) {
            errors.push(`${prefix}種類が不正です`);
        }
        
        if (!transaction.category || typeof transaction.category !== 'string') {
            errors.push(`${prefix}カテゴリが不正です`);
        }
        
        if (typeof transaction.amount !== 'number' || transaction.amount <= 0) {
            errors.push(`${prefix}金額が不正です`);
        }
        
        return errors;
    }

    /**
     * Excelエクスポート
     */
    exportToExcel() {
        if (!window.XLSX) {
            return { success: false, error: new Error('SheetJSライブラリが読み込まれていません') };
        }

        if (this.dataManager.transactions.length === 0) {
            return { success: false, error: new Error('エクスポートするデータがありません') };
        }

        try {
            const workbook = this.createExcelWorkbook();
            const filename = this.generateFilename('家計簿データ', 'xlsx');
            
            XLSX.writeFile(workbook, filename);
            return { success: true };
        } catch (error) {
            console.error('Excel export error:', error);
            return { success: false, error };
        }
    }

    /**
     * Excelワークブックを作成
     */
    createExcelWorkbook() {
        const wb = XLSX.utils.book_new();
        
        // メインデータシート
        const mainSheet = this.createMainDataSheet();
        XLSX.utils.book_append_sheet(wb, mainSheet, '取引データ');
        
        // サマリーシート
        const summarySheet = this.createSummarySheet();
        XLSX.utils.book_append_sheet(wb, summarySheet, 'サマリー');
        
        // 月別データシート
        const monthlySheet = this.createMonthlySheet();
        XLSX.utils.book_append_sheet(wb, monthlySheet, '月別集計');
        
        return wb;
    }

    /**
     * メインデータシートを作成
     */
    createMainDataSheet() {
        const excelData = this.dataManager.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(transaction => ({
                '日付': transaction.date,
                '種類': transaction.type === CONSTANTS.TRANSACTION_TYPES.INCOME ? '収入' : '支出',
                'カテゴリ': transaction.category,
                '説明': transaction.description || '',
                '金額': transaction.amount
            }));

        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // 列幅を設定
        ws['!cols'] = [
            { width: 12 }, // 日付
            { width: 8 },  // 種類
            { width: 15 }, // カテゴリ
            { width: 30 }, // 説明
            { width: 12 }  // 金額
        ];
        
        // 金額列の書式設定
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let row = 1; row <= range.e.r; row++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: 4 }); // 金額列
            if (ws[cellAddress]) {
                ws[cellAddress].z = '#,##0';
            }
        }
        
        return ws;
    }

    /**
     * サマリーシートを作成
     */
    createSummarySheet() {
        const summary = this.dataManager.calculateSummary();
        
        const summaryData = [
            ['項目', '金額'],
            ['総収入', summary.income],
            ['総支出', summary.expense],
            ['残高', summary.balance],
            ['取引件数', summary.transactionCount],
            ['平均収入', Math.round(summary.avgIncome)],
            ['平均支出', Math.round(summary.avgExpense)],
            [],
            ['エクスポート日時', new Date().toLocaleString('ja-JP')],
            ['データ件数', this.dataManager.transactions.length]
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        
        // 列幅を設定
        ws['!cols'] = [
            { width: 15 },
            { width: 15 }
        ];
        
        return ws;
    }

    /**
     * 月別集計シートを作成
     */
    createMonthlySheet() {
        const monthlyData = this.dataManager.getMonthlyData(24); // 過去24ヶ月
        const monthlyArray = [];
        
        monthlyData.forEach((data, month) => {
            const [year, monthNum] = month.split('-');
            monthlyArray.push({
                '年月': `${year}年${parseInt(monthNum)}月`,
                '収入': data.income,
                '支出': data.expense,
                '差額': data.income - data.expense
            });
        });
        
        const ws = XLSX.utils.json_to_sheet(monthlyArray);
        
        // 列幅を設定
        ws['!cols'] = [
            { width: 12 },
            { width: 12 },
            { width: 12 },
            { width: 12 }
        ];
        
        return ws;
    }

    /**
     * Excelインポート
     */
    async importFromExcel(file) {
        if (!window.XLSX) {
            return { success: false, error: new Error('SheetJSライブラリが読み込まれていません') };
        }

        // ファイル検証
        const validation = this.validateFile(file, ['.xlsx', '.xls']);
        if (!validation.isValid) {
            return { success: false, error: new Error(validation.errors.join('\n')) };
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // 最初のシートを読み込み
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // JSONに変換
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                        raw: false,
                        dateNF: 'yyyy-mm-dd'
                    });
                    
                    // データの検証と変換
                    const result = this.processExcelData(jsonData);
                    resolve(result);
                    
                } catch (error) {
                    console.error('Excel import error:', error);
                    resolve({ success: false, error: new Error('Excelファイルの読み込みに失敗しました') });
                }
            };
            
            reader.onerror = () => {
                resolve({ success: false, error: new Error('ファイルの読み込みに失敗しました') });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Excelデータを処理
     */
    processExcelData(jsonData) {
        if (!jsonData || jsonData.length === 0) {
            return { success: false, error: new Error('Excelファイルにデータが含まれていません') };
        }

        const requiredColumns = ['日付', '種類', 'カテゴリ', '金額'];
        const firstRow = jsonData[0];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));
        
        if (missingColumns.length > 0) {
            return {
                success: false,
                error: new Error(`必要な列が見つかりません: ${missingColumns.join(', ')}`)
            };
        }

        const processedData = [];
        const errors = [];
        
        jsonData.forEach((row, index) => {
            try {
                // サマリー行や空行をスキップ
                if (!row['日付'] || row['日付'] === 'サマリー' || !row['種類'] || !row['金額']) {
                    return;
                }

                const transaction = this.convertExcelRowToTransaction(row, index);
                if (transaction) {
                    processedData.push(transaction);
                }
            } catch (error) {
                errors.push(`行${index + 2}: ${error.message}`);
            }
        });

        if (processedData.length === 0) {
            return {
                success: false,
                error: new Error('インポート可能なデータが見つかりませんでした\n' + errors.slice(0, 5).join('\n'))
            };
        }

        return {
            success: true,
            data: processedData,
            errors: errors.slice(0, 10) // 最初の10個のエラーのみ
        };
    }

    /**
     * Excel行をトランザクションに変換
     */
    convertExcelRowToTransaction(row, index) {
        // 日付の変換
        const date = DateParser.formatDateForInput(row['日付']);
        if (!date) {
            throw new Error('日付形式が正しくありません');
        }

        // 種類の変換
        let type;
        if (row['種類'] === '収入') {
            type = CONSTANTS.TRANSACTION_TYPES.INCOME;
        } else if (row['種類'] === '支出') {
            type = CONSTANTS.TRANSACTION_TYPES.EXPENSE;
        } else {
            throw new Error('種類は「収入」または「支出」である必要があります');
        }

        // 金額の変換
        const amount = Sanitizer.sanitizeAmount(row['金額']);
        if (amount < CONSTANTS.VALIDATION.MIN_AMOUNT) {
            throw new Error(`金額は${CONSTANTS.VALIDATION.MIN_AMOUNT}円以上である必要があります`);
        }

        // カテゴリのサニタイズ
        const category = Sanitizer.sanitizeCategory(row['カテゴリ'] || '');
        if (!category) {
            throw new Error('カテゴリを入力してください');
        }

        // 説明のサニタイズ
        const description = Sanitizer.sanitizeDescription(row['説明'] || '');

        return {
            date,
            type,
            category,
            amount,
            description
        };
    }

    /**
     * ファイル名を生成
     */
    generateFilename(baseName, extension) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
        
        return `${baseName}_${dateStr}_${timeStr}.${extension}`;
    }

    /**
     * ファイルをダウンロード
     */
    downloadFile(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = Sanitizer.sanitizeFilename(filename);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // メモリリークを防ぐためURLを解放
        setTimeout(() => URL.revokeObjectURL(link.href), 100);
    }

    /**
     * CSVエクスポート（オプション機能）
     */
    exportToCSV() {
        try {
            const csvData = this.dataManager.transactions
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map(transaction => [
                    transaction.date,
                    transaction.type === CONSTANTS.TRANSACTION_TYPES.INCOME ? '収入' : '支出',
                    transaction.category,
                    transaction.description || '',
                    transaction.amount
                ]);

            // ヘッダーを追加
            csvData.unshift(['日付', '種類', 'カテゴリ', '説明', '金額']);

            // CSV文字列を作成
            const csvString = csvData
                .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
                .join('\n');

            // BOMを追加してExcelで文字化けを防ぐ
            const bom = '\ufeff';
            const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
            
            const filename = this.generateFilename('家計簿データ', 'csv');
            this.downloadFile(blob, filename);
            
            return { success: true };
        } catch (error) {
            console.error('CSV export error:', error);
            return { success: false, error };
        }
    }

    /**
     * バックアップファイルを作成
     */
    createBackup() {
        try {
            const backupData = {
                version: '2.0.0',
                timestamp: new Date().toISOString(),
                data: this.dataManager.toSaveFormat(),
                metadata: {
                    transactionCount: this.dataManager.transactions.length,
                    categories: Object.values(this.dataManager.categories).flat().length,
                    dateRange: this.getDateRange()
                }
            };

            const dataStr = JSON.stringify(backupData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const filename = this.generateFilename('家計簿バックアップ', 'json');
            this.downloadFile(dataBlob, filename);
            
            return { success: true };
        } catch (error) {
            console.error('Backup creation error:', error);
            return { success: false, error };
        }
    }

    /**
     * データの日付範囲を取得
     */
    getDateRange() {
        if (this.dataManager.transactions.length === 0) {
            return { start: null, end: null };
        }

        const dates = this.dataManager.transactions.map(t => new Date(t.date));
        return {
            start: new Date(Math.min(...dates)).toISOString().split('T')[0],
            end: new Date(Math.max(...dates)).toISOString().split('T')[0]
        };
    }

    /**
     * ファイルハンドラーの統計情報を取得
     */
    getStats() {
        return {
            supportedFormats: this.allowedTypes,
            maxFileSize: this.maxFileSize,
            maxFileSizeFormatted: this.formatFileSize(this.maxFileSize),
            exportFormats: ['JSON', 'Excel', 'CSV'],
            importFormats: ['JSON', 'Excel']
        };
    }
}
