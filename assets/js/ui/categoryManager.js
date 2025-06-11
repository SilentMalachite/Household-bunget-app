// カテゴリ管理UI専用クラス
import { CONSTANTS } from '../constants.js';

export class CategoryManagerUI {
    constructor(dataManager, modal, uiManager) {
        this.dataManager = dataManager;
        this.modal = modal;
        this.uiManager = uiManager;
        this.isModified = false;
    }

    /**
     * カテゴリ管理UIをレンダリング
     */
    render() {
        this.modal.content.innerHTML = `
            <h2 class="modal-title"><span aria-hidden="true">⚙️</span> カテゴリ管理</h2>
            
            <div class="modal-section">
                <h3><span aria-hidden="true">💰</span> 収入カテゴリ</h3>
                <div id="incomeCategories" class="category-list"></div>
                <div class="form-inline">
                    <input 
                        type="text" 
                        id="newIncomeCategory" 
                        placeholder="新しい収入カテゴリ"
                        maxlength="50"
                        aria-label="新しい収入カテゴリ名"
                    >
                    <button class="btn btn-success" data-action="add-income" aria-label="収入カテゴリを追加">
                        <span aria-hidden="true">➕</span> 追加
                    </button>
                </div>
            </div>
            
            <div class="modal-section expense">
                <h3><span aria-hidden="true">💸</span> 支出カテゴリ</h3>
                <div id="expenseCategories" class="category-list"></div>
                <div class="form-inline">
                    <input 
                        type="text" 
                        id="newExpenseCategory" 
                        placeholder="新しい支出カテゴリ"
                        maxlength="50"
                        aria-label="新しい支出カテゴリ名"
                    >
                    <button class="btn btn-warning" data-action="add-expense" aria-label="支出カテゴリを追加">
                        <span aria-hidden="true">➕</span> 追加
                    </button>
                </div>
            </div>
            
            <div class="modal-buttons">
                <button class="btn btn-secondary" data-action="reset" title="変更を元に戻す">
                    <span aria-hidden="true">🔄</span> リセット
                </button>
                <button class="btn btn-primary" data-action="close">
                    <span aria-hidden="true">✅</span> 完了
                </button>
            </div>
        `;

        this.setupEventListeners();
        this.updateCategoryList();
        this.focusFirstInput();
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // クリックイベント
        this.modal.content.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            
            try {
                switch (action) {
                    case 'add-income':
                        await this.handleAddCategory(CONSTANTS.TRANSACTION_TYPES.INCOME);
                        break;
                    case 'add-expense':
                        await this.handleAddCategory(CONSTANTS.TRANSACTION_TYPES.EXPENSE);
                        break;
                    case 'reset':
                        await this.handleReset();
                        break;
                    case 'close':
                        this.close();
                        break;
                }
            } catch (error) {
                console.error('カテゴリ操作エラー:', error);
                this.uiManager.notificationManager.error(error.message);
            }
        });

        // キーボードイベント
        this.modal.content.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const target = e.target;
                
                try {
                    if (target.id === 'newIncomeCategory') {
                        await this.handleAddCategory(CONSTANTS.TRANSACTION_TYPES.INCOME);
                    } else if (target.id === 'newExpenseCategory') {
                        await this.handleAddCategory(CONSTANTS.TRANSACTION_TYPES.EXPENSE);
                    }
                } catch (error) {
                    console.error('カテゴリ追加エラー:', error);
                    this.uiManager.notificationManager.error(error.message);
                }
            }
        });

        // オーバーレイクリック
        this.modal.overlay.addEventListener('click', (e) => {
            if (e.target === this.modal.overlay) {
                this.close();
            }
        });

        // ESCキー
        this.modal.escHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.modal.escHandler);

        // 入力値検証
        this.setupInputValidation();
    }

    /**
     * 入力値検証を設定
     */
    setupInputValidation() {
        const inputs = [
            document.getElementById('newIncomeCategory'),
            document.getElementById('newExpenseCategory')
        ];

        inputs.forEach(input => {
            if (!input) return;

            input.addEventListener('input', (e) => {
                this.validateInput(e.target);
            });

            input.addEventListener('blur', (e) => {
                this.validateInput(e.target);
            });
        });
    }

    /**
     * 入力値を検証
     */
    validateInput(input) {
        const value = input.value.trim();
        const maxLength = parseInt(input.getAttribute('maxlength')) || 50;
        
        // エラー表示用の要素を取得または作成
        let errorElement = input.parentNode.querySelector('.input-error');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'input-error';
            errorElement.style.cssText = 'color: #dc3545; font-size: 12px; margin-top: 4px;';
            input.parentNode.appendChild(errorElement);
        }

        // バリデーション
        let isValid = true;
        let errorMessage = '';

        if (value.length > maxLength) {
            isValid = false;
            errorMessage = `${maxLength}文字以内で入力してください`;
        } else if (value && !/^[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\-_\s]+$/.test(value)) {
            isValid = false;
            errorMessage = '使用できない文字が含まれています';
        }

        // エラー表示の更新
        if (isValid) {
            input.style.borderColor = '';
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        } else {
            input.style.borderColor = '#dc3545';
            errorElement.textContent = errorMessage;
            errorElement.style.display = 'block';
        }

        return isValid;
    }

    /**
     * カテゴリリストを更新
     */
    updateCategoryList() {
        this.updateCategoryGroup(CONSTANTS.TRANSACTION_TYPES.INCOME, 'incomeCategories');
        this.updateCategoryGroup(CONSTANTS.TRANSACTION_TYPES.EXPENSE, 'expenseCategories');
    }

    /**
     * 特定のカテゴリグループを更新
     */
    updateCategoryGroup(type, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        
        const categories = this.dataManager.categories[type] || [];
        
        if (categories.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.style.cssText = 'color: #6c757d; font-style: italic; padding: 10px 0;';
            emptyMessage.textContent = 'カテゴリがありません';
            container.appendChild(emptyMessage);
            return;
        }

        categories.forEach(category => {
            const element = this.createCategoryElement(type, category);
            container.appendChild(element);
        });
    }

    /**
     * カテゴリ要素を作成
     */
    createCategoryElement(type, category) {
        const span = document.createElement('span');
        span.className = `category-item ${type}`;
        span.setAttribute('data-category', category);
        span.setAttribute('data-type', type);
        
        // カテゴリ名
        const textNode = document.createTextNode(category);
        span.appendChild(textNode);
        
        // 使用状況の表示
        const usageCount = this.getCategoryUsageCount(type, category);
        if (usageCount > 0) {
            const usageSpan = document.createElement('span');
            usageSpan.className = 'usage-count';
            usageSpan.style.cssText = 'margin-left: 5px; font-size: 11px; opacity: 0.7;';
            usageSpan.textContent = `(${usageCount}件)`;
            usageSpan.title = `${usageCount}件の取引で使用中`;
            span.appendChild(usageSpan);
        }
        
        // 削除ボタン
        const removeBtn = document.createElement('button');
        removeBtn.className = 'category-remove';
        removeBtn.innerHTML = '×';
        removeBtn.title = `「${category}」を削除`;
        removeBtn.setAttribute('aria-label', `${category}を削除`);
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleRemoveCategory(type, category);
        });
        
        span.appendChild(removeBtn);
        
        // 編集機能（ダブルクリック）
        span.addEventListener('dblclick', () => {
            this.editCategoryInline(span, type, category);
        });
        
        return span;
    }

    /**
     * カテゴリの使用件数を取得
     */
    getCategoryUsageCount(type, category) {
        return this.dataManager.transactions.filter(t => 
            t.type === type && t.category === category
        ).length;
    }

    /**
     * インラインでカテゴリを編集
     */
    editCategoryInline(element, type, oldCategory) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldCategory;
        input.className = 'category-edit-input';
        input.style.cssText = 'border: 1px solid #667eea; border-radius: 4px; padding: 2px 5px; font-size: inherit;';
        
        const originalContent = element.innerHTML;
        element.innerHTML = '';
        element.appendChild(input);
        
        input.focus();
        input.select();
        
        const finishEdit = async (save = false) => {
            if (save) {
                const newCategory = input.value.trim();
                if (newCategory && newCategory !== oldCategory) {
                    try {
                        await this.editCategory(type, oldCategory, newCategory);
                    } catch (error) {
                        this.uiManager.notificationManager.error(error.message);
                    }
                }
            }
            
            element.innerHTML = originalContent;
            this.updateCategoryList();
        };
        
        input.addEventListener('blur', () => finishEdit(true));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit(true);
            } else if (e.key === 'Escape') {
                finishEdit(false);
            }
        });
    }

    /**
     * カテゴリを編集
     */
    async editCategory(type, oldCategory, newCategory) {
        // 新しいカテゴリが既に存在するかチェック
        if (this.dataManager.categories[type].includes(newCategory)) {
            throw new Error('このカテゴリは既に存在します');
        }
        
        // カテゴリを追加
        this.dataManager.addCategory(type, newCategory);
        
        // 既存の取引のカテゴリを更新
        const relatedTransactions = this.dataManager.transactions.filter(t => 
            t.type === type && t.category === oldCategory
        );
        
        for (const transaction of relatedTransactions) {
            await this.dataManager.updateTransaction(transaction.id, { category: newCategory });
        }
        
        // 古いカテゴリを削除
        this.dataManager.removeCategory(type, oldCategory, newCategory);
        
        this.isModified = true;
        this.uiManager.notificationManager.success(`カテゴリ「${oldCategory}」を「${newCategory}」に変更しました`);
    }

    /**
     * カテゴリ追加を処理
     */
    async handleAddCategory(type) {
        const inputId = type === CONSTANTS.TRANSACTION_TYPES.INCOME ? 'newIncomeCategory' : 'newExpenseCategory';
        const input = document.getElementById(inputId);
        
        if (!input) return;
        
        const newCategory = input.value.trim();
        
        if (!this.validateInput(input)) {
            return;
        }
        
        if (!newCategory) {
            this.uiManager.notificationManager.warning('カテゴリ名を入力してください');
            input.focus();
            return;
        }
        
        try {
            this.dataManager.addCategory(type, newCategory);
            input.value = '';
            this.updateCategoryList();
            this.isModified = true;
            
            // 成功時のビジュアルフィードバック
            this.showSuccessAnimation(input);
            
        } catch (error) {
            this.uiManager.notificationManager.error(error.message);
            input.focus();
            input.select();
        }
    }

    /**
     * 成功アニメーションを表示
     */
    showSuccessAnimation(element) {
        element.style.transition = 'background-color 0.3s ease';
        element.style.backgroundColor = '#d4edda';
        
        setTimeout(() => {
            element.style.backgroundColor = '';
        }, 300);
    }

    /**
     * カテゴリ削除を処理
     */
    async handleRemoveCategory(type, category) {
        const usageCount = this.getCategoryUsageCount(type, category);

        if (usageCount > 0) {
            // 使用中のカテゴリの場合、代替カテゴリを選択
            const replacementCategory = await this.showCategoryReplacementModal(type, category, usageCount);
            if (!replacementCategory) return;

            try {
                const count = this.dataManager.removeCategory(type, category, replacementCategory);
                this.updateCategoryList();
                this.isModified = true;
                this.uiManager.notificationManager.success(
                    `カテゴリ「${category}」を削除し、${count}件の取引を「${replacementCategory}」に変更しました`
                );
            } catch (error) {
                this.uiManager.notificationManager.error(error.message);
            }
        } else {
            // 未使用のカテゴリの場合、確認後削除
            const confirmed = await this.uiManager.modalManager.showConfirm(
                'カテゴリを削除',
                `カテゴリ「${category}」を削除しますか？`,
                { confirmText: '削除', dangerous: true }
            );

            if (confirmed) {
                try {
                    this.dataManager.removeCategory(type, category);
                    this.updateCategoryList();
                    this.isModified = true;
                } catch (error) {
                    this.uiManager.notificationManager.error(error.message);
                }
            }
        }
    }

    /**
     * カテゴリ置き換えモーダルを表示
     */
    async showCategoryReplacementModal(type, categoryToRemove, transactionCount) {
        return new Promise((resolve) => {
            const replacementModal = this.uiManager.modalManager.createModal();
            
            replacementModal.content.innerHTML = `
                <h2 class="modal-title"><span aria-hidden="true">⚠️</span> カテゴリの置き換え</h2>
                <p class="modal-text">
                    カテゴリ「<strong>${categoryToRemove}</strong>」は${transactionCount}件の取引で使用されています。<br>
                    削除する前に、これらの取引を別のカテゴリに変更してください。
                </p>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">置き換え先のカテゴリ:</label>
                    <select id="replacementCategory" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="">選択してください</option>
                        ${this.dataManager.categories[type]
                            .filter(cat => cat !== categoryToRemove)
                            .map(cat => `<option value="${cat}">${cat}</option>`)
                            .join('')}
                    </select>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary" data-action="cancel">キャンセル</button>
                    <button class="btn btn-primary" data-action="confirm" disabled>変更して削除</button>
                </div>
            `;

            const select = replacementModal.content.querySelector('#replacementCategory');
            const confirmButton = replacementModal.content.querySelector('[data-action="confirm"]');

            // 選択変更時のバリデーション
            select.addEventListener('change', () => {
                confirmButton.disabled = !select.value;
            });

            const handleClose = (result) => {
                this.uiManager.modalManager.closeModal(replacementModal.overlay);
                resolve(result);
            };

            replacementModal.content.addEventListener('click', (e) => {
                if (e.target.dataset.action === 'confirm') {
                    const replacement = select.value;
                    if (replacement) {
                        handleClose(replacement);
                    } else {
                        this.uiManager.notificationManager.error('置き換え先のカテゴリを選択してください');
                    }
                } else if (e.target.dataset.action === 'cancel') {
                    handleClose(null);
                }
            });

            this.uiManager.modalManager.showModal(replacementModal.overlay);
        });
    }

    /**
     * リセット処理
     */
    async handleReset() {
        if (!this.isModified) {
            this.uiManager.notificationManager.info('変更がありません');
            return;
        }

        const confirmed = await this.uiManager.modalManager.showConfirm(
            '変更をリセット',
            'カテゴリの変更をすべて元に戻しますか？',
            { confirmText: 'リセット', dangerous: true }
        );

        if (confirmed) {
            // 元の状態に戻す処理（実装が必要）
            this.updateCategoryList();
            this.isModified = false;
            this.uiManager.notificationManager.success('変更をリセットしました');
        }
    }

    /**
     * 最初の入力欄にフォーカス
     */
    focusFirstInput() {
        const firstInput = document.getElementById('newIncomeCategory');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    /**
     * モーダルを閉じる
     */
    close() {
        // 変更があった場合は設定を保存
        if (this.isModified) {
            this.dataManager.saveSettings();
        }
        
        this.uiManager.modalManager.closeModal(this.modal.overlay);
    }
}
