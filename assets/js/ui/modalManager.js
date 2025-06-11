// モーダル管理クラス
import { EventEmitter } from '../data/eventEmitter.js';
import { CONSTANTS } from '../constants.js';

export class ModalManager extends EventEmitter {
    constructor() {
        super();
        this.modalStack = [];
        this.focusedElementBeforeModal = null;
        this.setupKeyboardHandlers();
    }

    /**
     * キーボードハンドラーを設定
     */
    setupKeyboardHandlers() {
        // ESCキーでモーダルを閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalStack.length > 0) {
                const topModal = this.modalStack[this.modalStack.length - 1];
                this.closeModal(topModal);
            }
        });
    }

    /**
     * モーダルを作成
     * @param {object} options - モーダルオプション
     * @returns {object} モーダル要素
     */
    createModal(options = {}) {
        const {
            className = '',
            ariaLabel = 'モーダルダイアログ',
            closeOnOverlayClick = true,
            closeOnEscape = true
        } = options;

        // オーバーレイを作成
        const overlay = document.createElement('div');
        overlay.className = `${CONSTANTS.CSS_CLASSES.MODAL_OVERLAY} ${className}`;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', ariaLabel);
        
        // コンテンツコンテナを作成
        const content = document.createElement('div');
        content.className = CONSTANTS.CSS_CLASSES.MODAL_CONTENT;
        
        overlay.appendChild(content);
        
        // モーダル固有の設定を保存
        overlay._modalOptions = {
            closeOnOverlayClick,
            closeOnEscape
        };
        
        // オーバーレイクリックでモーダルを閉じる
        if (closeOnOverlayClick) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeModal(overlay);
                }
            });
        }
        
        return { overlay, content };
    }

    /**
     * モーダルを表示
     * @param {HTMLElement} modal - モーダル要素
     * @param {object} options - 表示オプション
     */
    showModal(modal, options = {}) {
        const { restoreFocus = true } = options;
        
        // 現在フォーカスされている要素を記録
        if (restoreFocus && this.modalStack.length === 0) {
            this.focusedElementBeforeModal = document.activeElement;
        }
        
        // モーダルをDOMに追加
        document.body.appendChild(modal);
        
        // メインコンテンツにaria-hiddenを設定
        const container = document.querySelector('.container');
        if (container && this.modalStack.length === 0) {
            container.setAttribute('aria-hidden', 'true');
        }
        
        // モーダルスタックに追加
        this.modalStack.push(modal);
        
        // アニメーション用のクラスを追加
        requestAnimationFrame(() => {
            modal.classList.add(CONSTANTS.CSS_CLASSES.SHOW);
        });
        
        // フォーカストラップを設定
        this.setupFocusTrap(modal);
        
        // イベントを発火
        this.emit('modalOpened', modal);
    }

    /**
     * モーダルを閉じる
     * @param {HTMLElement} modal - モーダル要素
     * @param {object} options - 閉じるオプション
     */
    closeModal(modal, options = {}) {
        const { restoreFocus = true, force = false } = options;
        
        if (!modal || !this.modalStack.includes(modal)) {
            return;
        }
        
        // ESCキーによる閉じる操作がオプションで無効化されている場合
        if (!force && modal._modalOptions && !modal._modalOptions.closeOnEscape) {
            return;
        }
        
        // アニメーションクラスを削除
        modal.classList.remove(CONSTANTS.CSS_CLASSES.SHOW);
        
        // フォーカストラップを削除
        this.removeFocusTrap(modal);
        
        // モーダルスタックから削除
        const index = this.modalStack.indexOf(modal);
        if (index > -1) {
            this.modalStack.splice(index, 1);
        }
        
        // メインコンテンツのaria-hiddenを解除
        if (this.modalStack.length === 0) {
            const container = document.querySelector('.container');
            if (container) {
                container.removeAttribute('aria-hidden');
            }
            
            // フォーカスを復元
            if (restoreFocus && this.focusedElementBeforeModal) {
                this.focusedElementBeforeModal.focus();
                this.focusedElementBeforeModal = null;
            }
        }
        
        // アニメーション完了後にDOMから削除
        setTimeout(() => {
            if (modal.parentNode) {
                document.body.removeChild(modal);
            }
        }, 300);
        
        // イベントを発火
        this.emit('modalClosed', modal);
    }

    /**
     * フォーカストラップを設定
     * @param {HTMLElement} modal - モーダル要素
     */
    setupFocusTrap(modal) {
        const focusableElements = this.getFocusableElements(modal);
        
        if (focusableElements.length === 0) {
            // フォーカス可能な要素がない場合はモーダル自体にフォーカス
            modal.setAttribute('tabindex', '-1');
            modal.focus();
            return;
        }
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        // 最初の要素にフォーカス
        firstFocusable.focus();
        
        // Tabキーナビゲーションを制御
        const handleTabKey = (e) => {
            if (e.key !== 'Tab') return;
            
            if (e.shiftKey) {
                // Shift+Tab
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        };
        
        modal._focusTrapHandler = handleTabKey;
        document.addEventListener('keydown', handleTabKey);
    }

    /**
     * フォーカストラップを削除
     * @param {HTMLElement} modal - モーダル要素
     */
    removeFocusTrap(modal) {
        if (modal._focusTrapHandler) {
            document.removeEventListener('keydown', modal._focusTrapHandler);
            delete modal._focusTrapHandler;
        }
    }

    /**
     * フォーカス可能な要素を取得
     * @param {HTMLElement} container - コンテナ要素
     * @returns {Array<HTMLElement>} フォーカス可能な要素配列
     */
    getFocusableElements(container) {
        const focusableSelectors = [
            'button:not([disabled])',
            '[href]',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"]):not([disabled])',
            '[contenteditable]:not([contenteditable="false"])'
        ].join(', ');
        
        return Array.from(container.querySelectorAll(focusableSelectors))
            .filter(element => {
                // 非表示要素を除外
                const style = window.getComputedStyle(element);
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       element.offsetParent !== null;
            });
    }

    /**
     * 確認ダイアログを表示
     * @param {string} title - タイトル
     * @param {string} message - メッセージ
     * @param {object} options - オプション
     * @returns {Promise<boolean>} 確認結果
     */
    async showConfirm(title, message, options = {}) {
        const {
            confirmText = 'OK',
            cancelText = 'キャンセル',
            confirmButtonClass = 'btn-primary',
            cancelButtonClass = 'btn-secondary',
            dangerous = false
        } = options;

        return new Promise((resolve) => {
            const modal = this.createModal({
                ariaLabel: title,
                closeOnOverlayClick: false // 誤操作防止
            });
            
            modal.content.innerHTML = `
                <h2 class="modal-title">${this.escapeHtml(title)}</h2>
                <div class="modal-text">${this.escapeHtml(message).replace(/\n/g, '<br>')}</div>
                <div class="modal-buttons">
                    <button class="btn ${cancelButtonClass}" data-action="cancel">
                        ${this.escapeHtml(cancelText)}
                    </button>
                    <button class="btn ${dangerous ? 'btn-warning' : confirmButtonClass}" data-action="confirm">
                        ${this.escapeHtml(confirmText)}
                    </button>
                </div>
            `;

            const handleClose = (result) => {
                this.closeModal(modal.overlay);
                resolve(result);
            };

            modal.content.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'confirm') {
                    handleClose(true);
                } else if (action === 'cancel') {
                    handleClose(false);
                }
            });

            this.showModal(modal.overlay);
        });
    }

    /**
     * アラートダイアログを表示
     * @param {string} title - タイトル
     * @param {string} message - メッセージ
     * @param {object} options - オプション
     * @returns {Promise<void>}
     */
    async showAlert(title, message, options = {}) {
        const {
            buttonText = 'OK',
            buttonClass = 'btn-primary',
            type = 'info' // 'info', 'warning', 'error', 'success'
        } = options;

        return new Promise((resolve) => {
            const modal = this.createModal({
                ariaLabel: title
            });
            
            const icon = this.getIconForType(type);
            
            modal.content.innerHTML = `
                <h2 class="modal-title">${icon} ${this.escapeHtml(title)}</h2>
                <div class="modal-text">${this.escapeHtml(message).replace(/\n/g, '<br>')}</div>
                <div class="modal-buttons">
                    <button class="btn ${buttonClass}" data-action="ok">
                        ${this.escapeHtml(buttonText)}
                    </button>
                </div>
            `;

            modal.content.addEventListener('click', (e) => {
                if (e.target.dataset.action === 'ok') {
                    this.closeModal(modal.overlay);
                    resolve();
                }
            });

            this.showModal(modal.overlay);
        });
    }

    /**
     * プロンプトダイアログを表示
     * @param {string} title - タイトル
     * @param {string} message - メッセージ
     * @param {object} options - オプション
     * @returns {Promise<string|null>} 入力値（キャンセル時はnull）
     */
    async showPrompt(title, message, options = {}) {
        const {
            defaultValue = '',
            placeholder = '',
            inputType = 'text',
            required = false,
            maxLength = 200
        } = options;

        return new Promise((resolve) => {
            const modal = this.createModal({
                ariaLabel: title
            });
            
            modal.content.innerHTML = `
                <h2 class="modal-title">${this.escapeHtml(title)}</h2>
                <div class="modal-text">${this.escapeHtml(message)}</div>
                <div style="margin: 20px 0;">
                    <input 
                        type="${inputType}" 
                        id="promptInput" 
                        class="form-control" 
                        value="${this.escapeHtml(defaultValue)}"
                        placeholder="${this.escapeHtml(placeholder)}"
                        maxlength="${maxLength}"
                        ${required ? 'required' : ''}
                        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"
                    >
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-secondary" data-action="cancel">キャンセル</button>
                    <button class="btn btn-primary" data-action="ok">OK</button>
                </div>
            `;

            const input = modal.content.querySelector('#promptInput');
            const okButton = modal.content.querySelector('[data-action="ok"]');

            const handleClose = (result) => {
                this.closeModal(modal.overlay);
                resolve(result);
            };

            const validateInput = () => {
                const value = input.value.trim();
                const isValid = !required || value.length > 0;
                okButton.disabled = !isValid;
                return isValid;
            };

            input.addEventListener('input', validateInput);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && validateInput()) {
                    handleClose(input.value.trim());
                }
            });

            modal.content.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'ok' && validateInput()) {
                    handleClose(input.value.trim());
                } else if (action === 'cancel') {
                    handleClose(null);
                }
            });

            this.showModal(modal.overlay);
            
            // 初期バリデーション
            validateInput();
        });
    }

    /**
     * すべてのモーダルを閉じる
     */
    closeAllModals() {
        const modals = [...this.modalStack];
        modals.forEach(modal => {
            this.closeModal(modal, { force: true });
        });
    }

    /**
     * HTMLエスケープ
     * @param {string} text - エスケープするテキスト
     * @returns {string} エスケープされたテキスト
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * タイプに応じたアイコンを取得
     * @param {string} type - タイプ
     * @returns {string} アイコン
     */
    getIconForType(type) {
        const icons = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
        };
        return icons[type] || icons.info;
    }

    /**
     * リソースのクリーンアップ
     */
    destroy() {
        this.closeAllModals();
        this.removeAllListeners();
    }
}
