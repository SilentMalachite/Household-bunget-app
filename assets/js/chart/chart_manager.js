// Chart.js管理クラス
import { CONSTANTS } from '../constants.js';

export class ChartManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.chart = null;
        this.currentEndDate = new Date();
        this.currentRange = 12;
        this.isInitialized = false;
        
        this.init();
    }

    /**
     * チャートマネージャーを初期化
     */
    async init() {
        try {
            // Chart.jsの読み込み確認
            if (typeof Chart === 'undefined') {
                console.warn('Chart.jsが読み込まれていません');
                return;
            }

            this.setupChart();
            this.bindEvents();
            this.isInitialized = true;
            
        } catch (error) {
            console.error('チャート初期化エラー:', error);
        }
    }

    /**
     * チャートを設定
     */
    setupChart() {
        const canvas = document.getElementById('monthlyChart');
        if (!canvas) {
            console.warn('monthlyChart canvas要素が見つかりません');
            return;
        }

        const ctx = canvas.getContext('2d');
        
        // 既存のチャートがあれば破棄
        if (this.chart) {
            this.chart.destroy();
        }
        
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '収入',
                        data: [],
                        backgroundColor: CONSTANTS.CHART.COLORS.INCOME,
                        borderColor: CONSTANTS.CHART.COLORS.INCOME_BORDER,
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false
                    },
                    {
                        label: '支出',
                        data: [],
                        backgroundColor: CONSTANTS.CHART.COLORS.EXPENSE,
                        borderColor: CONSTANTS.CHART.COLORS.EXPENSE_BORDER,
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: true,
                        text: '月別収支',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        color: '#495057'
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 6,
                        displayColors: true,
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y || 0;
                                return `${label}: ¥${value.toLocaleString()}`;
                            },
                            footer: (tooltipItems) => {
                                if (tooltipItems.length >= 2) {
                                    const income = tooltipItems.find(item => item.datasetIndex === 0)?.parsed.y || 0;
                                    const expense = tooltipItems.find(item => item.datasetIndex === 1)?.parsed.y || 0;
                                    const balance = income - expense;
                                    const balanceText = balance >= 0 ? `+¥${balance.toLocaleString()}` : `-¥${Math.abs(balance).toLocaleString()}`;
                                    return `差額: ${balanceText}`;
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: CONSTANTS.DEFAULTS.MAX_CHART_AMOUNT,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            stepSize: CONSTANTS.DEFAULTS.CHART_STEP_SIZE,
                            font: {
                                size: 11
                            },
                            callback: (value) => {
                                return this.formatYAxisLabel(value);
                            }
                        }
                    }
                },
                elements: {
                    bar: {
                        borderWidth: 1
                    }
                },
                onHover: (event, activeElements) => {
                    event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                },
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const element = activeElements[0];
                        const datasetIndex = element.datasetIndex;
                        const index = element.index;
                        this.handleChartClick(datasetIndex, index);
                    }
                }
            }
        });
    }

    /**
     * Y軸ラベルをフォーマット
     */
    formatYAxisLabel(value) {
        if (value === 0) {
            return '0';
        } else if (value >= 10000) {
            // 1万円以上は万円単位で表示
            return (value / 10000) + '万円';
        } else {
            // 1万円未満は千円単位で表示
            return (value / 1000) + '千円';
        }
    }

    /**
     * チャートクリック時の処理
     */
    handleChartClick(datasetIndex, index) {
        const dataset = this.chart.data.datasets[datasetIndex];
        const label = this.chart.data.labels[index];
        const value = dataset.data[index];
        const type = datasetIndex === 0 ? '収入' : '支出';
        
        console.log(`${label}の${type}: ¥${value.toLocaleString()}`);
        
        // 該当月のデータでフィルタリング
        const yearMonth = this.extractYearMonth(label);
        if (yearMonth) {
            const filterMonth = document.getElementById('filterMonth');
            if (filterMonth) {
                filterMonth.value = yearMonth;
                // UIManagerのhandleFilterChangeを呼び出す
                if (window.__HOUSEHOLD_BUDGET_APP__?.uiManager) {
                    window.__HOUSEHOLD_BUDGET_APP__.uiManager.handleFilterChange();
                }
            }
        }
    }

    /**
     * ラベルから年月を抽出
     */
    extractYearMonth(label) {
        // "2025年1月" -> "2025-01"
        const match = label.match(/(\d{4})年(\d{1,2})月/);
        if (match) {
            const year = match[1];
            const month = match[2].padStart(2, '0');
            return `${year}-${month}`;
        }
        return null;
    }

    /**
     * イベントをバインド
     */
    bindEvents() {
        // ナビゲーションボタン
        const prevBtn = document.getElementById('chartPrevBtn');
        const nextBtn = document.getElementById('chartNextBtn');
        const currentBtn = document.getElementById('chartCurrentBtn');
        const rangeSelect = document.getElementById('chartRange');

        if (prevBtn) prevBtn.addEventListener('click', () => this.navigateChart(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.navigateChart(1));
        if (currentBtn) currentBtn.addEventListener('click', () => this.showCurrentMonth());
        if (rangeSelect) rangeSelect.addEventListener('change', (e) => this.changeRange(e.target.value));
        
        // データ変更イベント
        this.dataManager.on('dataChanged', () => this.updateChart());
        this.dataManager.on('dataLoaded', () => this.updateChart());
        this.dataManager.on('filtersApplied', () => this.updateChartTitle());
    }

    /**
     * チャートナビゲーション
     */
    navigateChart(direction) {
        const months = this.currentRange === 'all' ? 12 : parseInt(this.currentRange);
        this.currentEndDate = new Date(
            this.currentEndDate.getFullYear(),
            this.currentEndDate.getMonth() + (direction * months),
            1
        );
        this.updateChart();
    }

    /**
     * 今月を表示
     */
    showCurrentMonth() {
        this.currentEndDate = new Date();
        this.updateChart();
    }

    /**
     * 表示範囲を変更
     */
    changeRange(range) {
        this.currentRange = range;
        this.updateChart();
    }

    /**
     * チャートを更新
     */
    updateChart() {
        if (!this.chart) return;

        try {
            const { monthlyData, labels } = this.getChartData();
            
            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = monthlyData.income;
            this.chart.data.datasets[1].data = monthlyData.expense;
            
            // Y軸の最大値を動的に調整
            this.adjustYAxisMax(monthlyData);
            
            this.chart.update('active');
            
        } catch (error) {
            console.error('チャート更新エラー:', error);
        }
    }

    /**
     * チャート用データを取得
     */
    getChartData() {
        let monthlyDataMap;
        let months;
        
        if (this.currentRange === 'all') {
            // 全期間の場合
            const sortedTransactions = [...this.dataManager.transactions].sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
            
            if (sortedTransactions.length > 0) {
                const firstDate = new Date(sortedTransactions[0].date);
                const lastDate = new Date(sortedTransactions[sortedTransactions.length - 1].date);
                
                months = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                        (lastDate.getMonth() - firstDate.getMonth()) + 1;
                
                monthlyDataMap = this.dataManager.getMonthlyData(months, lastDate);
            } else {
                months = 12;
                monthlyDataMap = this.dataManager.getMonthlyData(months, this.currentEndDate);
            }
        } else {
            months = parseInt(this.currentRange);
            monthlyDataMap = this.dataManager.getMonthlyData(months, this.currentEndDate);
        }
        
        const labels = [];
        const incomeData = [];
        const expenseData = [];
        
        monthlyDataMap.forEach((data, month) => {
            const [year, monthNum] = month.split('-');
            labels.push(`${year}年${parseInt(monthNum)}月`);
            incomeData.push(data.income);
            expenseData.push(data.expense);
        });
        
        return {
            monthlyData: {
                income: incomeData,
                expense: expenseData
            },
            labels
        };
    }

    /**
     * Y軸の最大値を動的に調整
     */
    adjustYAxisMax(monthlyData) {
        const allValues = [...monthlyData.income, ...monthlyData.expense];
        const maxValue = Math.max(...allValues, 0);
        
        if (maxValue === 0) {
            this.chart.options.scales.y.max = CONSTANTS.DEFAULTS.MAX_CHART_AMOUNT;
        } else {
            // 最大値の1.2倍を上限とし、5000円単位で切り上げ
            const adjustedMax = Math.ceil((maxValue * 1.2) / 5000) * 5000;
            this.chart.options.scales.y.max = Math.max(adjustedMax, 50000); // 最低5万円
        }
        
        // ステップサイズも動的に調整
        const maxDisplayValue = this.chart.options.scales.y.max;
        if (maxDisplayValue <= 100000) {
            this.chart.options.scales.y.ticks.stepSize = 5000;
        } else if (maxDisplayValue <= 500000) {
            this.chart.options.scales.y.ticks.stepSize = 25000;
        } else {
            this.chart.options.scales.y.ticks.stepSize = 50000;
        }
    }

    /**
     * チャートタイトルを更新
     */
    updateChartTitle() {
        if (!this.chart) return;
        
        let title = '月別収支';
        
        // フィルタが適用されている場合はタイトルに反映
        const filters = this.dataManager.filters;
        const titleParts = [];
        
        if (filters.type) {
            titleParts.push(filters.type === CONSTANTS.TRANSACTION_TYPES.INCOME ? '収入' : '支出');
        }
        
        if (filters.category) {
            titleParts.push(`カテゴリ: ${filters.category}`);
        }
        
        if (filters.month) {
            const [year, month] = filters.month.split('-');
            titleParts.push(`${year}年${parseInt(month)}月`);
        }
        
        if (titleParts.length > 0) {
            title += ` (${titleParts.join(', ')})`;
        }
        
        this.chart.options.plugins.title.text = title;
        this.chart.update('none');
    }

    /**
     * チャートの統計情報を取得
     */
    getChartStats() {
        if (!this.chart) return null;
        
        const incomeData = this.chart.data.datasets[0].data;
        const expenseData = this.chart.data.datasets[1].data;
        
        const totalIncome = incomeData.reduce((sum, value) => sum + (value || 0), 0);
        const totalExpense = expenseData.reduce((sum, value) => sum + (value || 0), 0);
        const avgIncome = incomeData.length > 0 ? totalIncome / incomeData.length : 0;
        const avgExpense = expenseData.length > 0 ? totalExpense / expenseData.length : 0;
        
        const maxIncome = Math.max(...incomeData.filter(v => v > 0));
        const maxExpense = Math.max(...expenseData.filter(v => v > 0));
        
        return {
            period: `${this.currentRange === 'all' ? '全期間' : this.currentRange + 'ヶ月'}`,
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            avgIncome,
            avgExpense,
            maxIncome: isFinite(maxIncome) ? maxIncome : 0,
            maxExpense: isFinite(maxExpense) ? maxExpense : 0,
            dataPoints: this.chart.data.labels.length
        };
    }

    /**
     * チャートデータをエクスポート
     */
    exportChartData() {
        if (!this.chart) return null;
        
        const chartData = [];
        const labels = this.chart.data.labels;
        const incomeData = this.chart.data.datasets[0].data;
        const expenseData = this.chart.data.datasets[1].data;
        
        for (let i = 0; i < labels.length; i++) {
            chartData.push({
                month: labels[i],
                income: incomeData[i] || 0,
                expense: expenseData[i] || 0,
                balance: (incomeData[i] || 0) - (expenseData[i] || 0)
            });
        }
        
        return {
            period: this.currentRange === 'all' ? '全期間' : `過去${this.currentRange}ヶ月`,
            data: chartData,
            stats: this.getChartStats()
        };
    }

    /**
     * チャートを画像として保存
     */
    saveChartAsImage(filename = 'chart.png') {
        if (!this.chart) return;
        
        try {
            const url = this.chart.toBase64Image('image/png', 1.0);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
        } catch (error) {
            console.error('チャート画像保存エラー:', error);
        }
    }

    /**
     * チャートをリサイズ
     */
    resize() {
        if (this.chart) {
            this.chart.resize();
        }
    }

    /**
     * チャートのアニメーションを制御
     */
    setAnimation(enabled) {
        if (!this.chart) return;
        
        this.chart.options.animation = enabled ? {
            duration: 750,
            easing: 'easeInOutQuart'
        } : false;
        
        this.chart.update();
    }

    /**
     * チャートの色テーマを変更
     */
    setColorTheme(theme = 'default') {
        if (!this.chart) return;
        
        const themes = {
            default: {
                income: CONSTANTS.CHART.COLORS.INCOME,
                expense: CONSTANTS.CHART.COLORS.EXPENSE,
                incomeBorder: CONSTANTS.CHART.COLORS.INCOME_BORDER,
                expenseBorder: CONSTANTS.CHART.COLORS.EXPENSE_BORDER
            },
            dark: {
                income: 'rgba(76, 175, 80, 0.8)',
                expense: 'rgba(244, 67, 54, 0.8)',
                incomeBorder: 'rgba(76, 175, 80, 1)',
                expenseBorder: 'rgba(244, 67, 54, 1)'
            },
            pastel: {
                income: 'rgba(129, 199, 132, 0.8)',
                expense: 'rgba(240, 98, 146, 0.8)',
                incomeBorder: 'rgba(129, 199, 132, 1)',
                expenseBorder: 'rgba(240, 98, 146, 1)'
            }
        };
        
        const colors = themes[theme] || themes.default;
        
        this.chart.data.datasets[0].backgroundColor = colors.income;
        this.chart.data.datasets[0].borderColor = colors.incomeBorder;
        this.chart.data.datasets[1].backgroundColor = colors.expense;
        this.chart.data.datasets[1].borderColor = colors.expenseBorder;
        
        this.chart.update();
    }

    /**
     * フィルター適用状態の表示
     */
    showFilterIndicator() {
        const filters = this.dataManager.filters;
        const hasFilters = filters.type || filters.category || filters.month;
        
        if (hasFilters) {
            // フィルター表示用の要素を作成
            const chartContainer = document.querySelector('.chart-container');
            if (chartContainer) {
                let indicator = chartContainer.querySelector('.filter-indicator');
                
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.className = 'filter-indicator';
                    indicator.style.cssText = `
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        background: rgba(102, 126, 234, 0.9);
                        color: white;
                        padding: 5px 10px;
                        border-radius: 15px;
                        font-size: 12px;
                        z-index: 10;
                    `;
                    chartContainer.appendChild(indicator);
                }
                
                indicator.textContent = 'フィルター適用中';
                indicator.title = this.getFilterDescription();
            }
        } else {
            // フィルターインジケーターを削除
            const indicator = document.querySelector('.filter-indicator');
            if (indicator) {
                indicator.remove();
            }
        }
    }

    /**
     * フィルター説明を取得
     */
    getFilterDescription() {
        const filters = this.dataManager.filters;
        const descriptions = [];
        
        if (filters.type) {
            descriptions.push(`種類: ${filters.type === CONSTANTS.TRANSACTION_TYPES.INCOME ? '収入' : '支出'}`);
        }
        
        if (filters.category) {
            descriptions.push(`カテゴリ: ${filters.category}`);
        }
        
        if (filters.month) {
            const [year, month] = filters.month.split('-');
            descriptions.push(`月: ${year}年${parseInt(month)}月`);
        }
        
        return descriptions.join('\n');
    }

    /**
     * チャートのレスポンシブ対応
     */
    handleResize() {
        if (this.chart) {
            // 画面サイズに応じてチャートオプションを調整
            const screenWidth = window.innerWidth;
            
            if (screenWidth < 768) {
                // モバイル用設定
                this.chart.options.scales.x.ticks.maxRotation = 90;
                this.chart.options.scales.x.ticks.font.size = 10;
                this.chart.options.scales.y.ticks.font.size = 10;
                this.chart.options.plugins.legend.labels.font.size = 11;
            } else {
                // デスクトップ用設定
                this.chart.options.scales.x.ticks.maxRotation = 45;
                this.chart.options.scales.x.ticks.font.size = 11;
                this.chart.options.scales.y.ticks.font.size = 11;
                this.chart.options.plugins.legend.labels.font.size = 12;
            }
            
            this.chart.update('none');
        }
    }

    /**
     * エラー状態の表示
     */
    showError(message) {
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6c757d;">
                    <div style="text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                        <div style="font-size: 16px; margin-bottom: 8px;">チャートを表示できません</div>
                        <div style="font-size: 14px;">${message}</div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * リソースのクリーンアップ
     */
    destroy() {
        // チャートを破棄
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        // イベントリスナーを削除
        this.dataManager.off('dataChanged', this.updateChart);
        this.dataManager.off('dataLoaded', this.updateChart);
        this.dataManager.off('filtersApplied', this.updateChartTitle);
        
        // リサイズイベントを削除
        window.removeEventListener('resize', this.handleResize);
        
        this.isInitialized = false;
    }
}

// リサイズイベントのセットアップ（グローバル）
if (typeof window !== 'undefined') {
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // グローバルなチャートマネージャーインスタンスがあればリサイズ
            if (window.__HOUSEHOLD_BUDGET_APP__?.uiManager?.chartManager) {
                window.__HOUSEHOLD_BUDGET_APP__.uiManager.chartManager.handleResize();
            }
        }, 250);
    });
}
        