// 通知管理クラス
import { CONSTANTS } from '../constants.js';

export class NotificationManager {
    constructor() {
        this.defaultDuration = CONSTANTS.DEFAULTS.NOTIFICATION_DURATION;
        this.maxNotifications = 5;
        this.notifications = new Map();
        this.queue = [];
        this.isProcessingQueue = false;
    }

    /**
     * 通知を表示
     * @param {string} message - メッセージ
     * @param {string} type - 通知タイプ
     * @param {number} duration - 表示時間（ミリ秒）
     * @param {object} options - オプション
     */
    show(message, type = CONSTANTS.NOTIFICATION_TYPES.INFO, duration = this.defaultDuration, options = {}) {
        const {
            id = null,
            persistent = false,
            actions = [],
            position = 'top-right'
        } = options;

        // 同じIDの通知が既に存在する場合は更新
        if (id && this.notifications.has(id)) {
            this.updateNotification(id, message, type);
            return id;
        }

        // 最大通知数チェック
        if (this.notifications.size >= this.maxNotifications) {
            this.queue.push({ message, type, duration, options });
            this.processQueue();
            return null;
        }

        const notificationId = id || this.generateId();
        const notification = this.createNotificationElement(notificationId, message, type, actions, position);
        
        this.notifications.set(notificationId, {
            element: notification,
            type,
            persistent,
            timeoutId: null
        });

        document.body.appendChild(notification);
        
        // アニメーション開始
        requestAnimationFrame(() => {
            notification.classList.add(CONSTANTS.CSS_CLASSES.SHOW);
        });

        // 自動削除タイマー設定（永続的でない場合）
        if (!persistent && duration > 0) {
            const timeoutId = setTimeout(() => {
                this.hide(notificationId);
            }, duration);
            
            this.notifications.get(notificationId).timeoutId = timeoutId;
        }

        return notificationId;
    }

    /**
     * 通知要素を作成
     * @param {string} id - 通知ID
     * @param {string} message - メッセージ
     * @param {string} type - 通知タイプ
     * @param {Array} actions - アクションボタン
     * @param {string} position - 表示位置
     * @returns {HTMLElement} 通知要素
     */
    createNotificationElement(id, message, type, actions, position) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');
        notification.setAttribute('data-notification-id', id);
        notification.style.position = 'fixed';
        notification.style.zIndex = '2000';
        
        // 位置を設定
        this.setNotificationPosition(notification, position);
        
        // メッセージ内容
        const messageDiv = document.createElement('div');
        messageDiv.className = 'notification-message';
        
        if (message.includes('\n')) {
            messageDiv.style.whiteSpace = 'pre-line';
        }
        
        messageDiv.textContent = message;
        notification.appendChild(messageDiv);

        // アクションボタン
        if (actions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'notification-actions';
            actionsDiv.style.marginTop = '10px';
            
            actions.forEach(action => {
                const button = document.createElement('button');
                button.textContent = action.text;
                button.className = `btn btn-sm ${action.className || 'btn-secondary'}`;
                button.style.marginRight = '5px';
                button.addEventListener('click', () => {
                    if (action.handler) {
                        action.handler();
                    }
                    if (action.closeOnClick !== false) {
                        this.hide(id);
                    }
                });
                actionsDiv.appendChild(button);
            });
            
            notification.appendChild(actionsDiv);
        }

        // 閉じるボタン（永続的な通知の場合）
        const notificationData = this.notifications.get(id);
        if (notificationData && notificationData.persistent) {
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '×';
            closeButton.className = 'notification-close';
            closeButton.style.cssText = `
                position: absolute;
                top: 5px;
                right: 10px;
                background: none;
                border: none;
                color: inherit;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            `;
            closeButton.addEventListener('click', () => this.hide(id));
            notification.appendChild(closeButton);
        }

        // クリックで閉じる（オプション）
        if (!actions.length) {
            notification.style.cursor = 'pointer';
            notification.addEventListener('click', () => this.hide(id));
        }

        return notification;
    }

    /**
     * 通知の位置を設定
     * @param {HTMLElement} notification - 通知要素
     * @param {string} position - 位置
     */
    setNotificationPosition(notification, position) {
        const positions = {
            'top-right': { top: '20px', right: '20px' },
            'top-left': { top: '20px', left: '20px' },
            'bottom-right': { bottom: '20px', right: '20px' },
            'bottom-left': { bottom: '20px', left: '20px' },
            'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' },
            'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)' }
        };

        const pos = positions[position] || positions['top-right'];
        Object.assign(notification.style, pos);
    }

    /**
     * 通知を更新
     * @param {string} id - 通知ID
     * @param {string} message - 新しいメッセージ
     * @param {string} type - 新しいタイプ
     */
    updateNotification(id, message, type) {
        const notificationData = this.notifications.get(id);
        if (!notificationData) return;

        const { element } = notificationData;
        const messageDiv = element.querySelector('.notification-message');
        
        if (messageDiv) {
            messageDiv.textContent = message;
        }

        // タイプが変更された場合はクラスを更新
        if (type !== notificationData.type) {
            element.classList.remove(notificationData.type);
            element.classList.add(type);
            notificationData.type = type;
        }
    }

    /**
     * 通知を非表示
     * @param {string} id - 通知ID
     */
    hide(id) {
        const notificationData = this.notifications.get(id);
        if (!notificationData) return;

        const { element, timeoutId } = notificationData;

        // タイマーをクリア
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // アニメーション開始
        element.classList.remove(CONSTANTS.CSS_CLASSES.SHOW);

        // アニメーション完了後に削除
        setTimeout(() => {
            if (element.parentNode) {
                document.body.removeChild(element);
            }
            this.notifications.delete(id);
            this.processQueue();
        }, 300);
    }

    /**
     * 特定タイプの通知をすべて非表示
     * @param {string} type - 通知タイプ
     */
    hideByType(type) {
        this.notifications.forEach((data, id) => {
            if (data.type === type) {
                this.hide(id);
            }
        });
    }

    /**
     * すべての通知を非表示
     */
    hideAll() {
        const ids = Array.from(this.notifications.keys());
        ids.forEach(id => this.hide(id));
        this.queue = [];
    }

    /**
     * キューを処理
     */
    processQueue() {
        if (this.isProcessingQueue || this.queue.length === 0) return;
        if (this.notifications.size >= this.maxNotifications) return;

        this.isProcessingQueue = true;
        
        setTimeout(() => {
            if (this.queue.length > 0 && this.notifications.size < this.maxNotifications) {
                const { message, type, duration, options } = this.queue.shift();
                this.show(message, type, duration, options);
            }
            this.isProcessingQueue = false;
            
            // 更にキューがある場合は続行
            if (this.queue.length > 0) {
                this.processQueue();
            }
        }, 100);
    }

    /**
     * 成功通知のショートカット
     * @param {string} message - メッセージ
     * @param {number} duration - 表示時間
     */
    success(message, duration) {
        return this.show(message, CONSTANTS.NOTIFICATION_TYPES.SUCCESS, duration);
    }

    /**
     * エラー通知のショートカット
     * @param {string} message - メッセージ
     * @param {number} duration - 表示時間
     */
    error(message, duration = 5000) {
        return this.show(message, CONSTANTS.NOTIFICATION_TYPES.ERROR, duration);
    }

    /**
     * 警告通知のショートカット
     * @param {string} message - メッセージ
     * @param {number} duration - 表示時間
     */
    warning(message, duration = 4000) {
        return this.show(message, CONSTANTS.NOTIFICATION_TYPES.WARNING, duration);
    }

    /**
     * 情報通知のショートカット
     * @param {string} message - メッセージ
     * @param {number} duration - 表示時間
     */
    info(message, duration) {
        return this.show(message, CONSTANTS.NOTIFICATION_TYPES.INFO, duration);
    }

    /**
     * プログレス通知を表示
     * @param {string} message - メッセージ
     * @param {number} progress - 進捗（0-100）
     * @param {string} id - 通知ID
     */
    showProgress(message, progress = 0, id = 'progress') {
        const existingData = this.notifications.get(id);
        
        if (existingData) {
            // 既存の進捗を更新
            const progressBar = existingData.element.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
            }
            
            const messageDiv = existingData.element.querySelector('.notification-message');
            if (messageDiv) {
                messageDiv.textContent = message;
            }
            
            return id;
        } else {
            // 新しい進捗通知を作成
            const notification = this.createProgressNotification(id, message, progress);
            
            this.notifications.set(id, {
                element: notification,
                type: CONSTANTS.NOTIFICATION_TYPES.INFO,
                persistent: true,
                timeoutId: null
            });

            document.body.appendChild(notification);
            
            requestAnimationFrame(() => {
                notification.classList.add(CONSTANTS.CSS_CLASSES.SHOW);
            });
            
            return id;
        }
    }

    /**
     * プログレス通知要素を作成
     * @param {string} id - 通知ID
     * @param {string} message - メッセージ
     * @param {number} progress - 進捗
     * @returns {HTMLElement} 通知要素
     */
    createProgressNotification(id, message, progress) {
        const notification = document.createElement('div');
        notification.className = `notification ${CONSTANTS.NOTIFICATION_TYPES.INFO}`;
        notification.setAttribute('role', 'status');
        notification.setAttribute('aria-live', 'polite');
        notification.setAttribute('data-notification-id', id);
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 2000;
            min-width: 300px;
        `;

        notification.innerHTML = `
            <div class="notification-message">${message}</div>
            <div style="margin-top: 10px; background: rgba(255,255,255,0.3); border-radius: 10px; height: 8px; overflow: hidden;">
                <div class="progress-bar" style="height: 100%; background: rgba(255,255,255,0.8); width: ${progress}%; transition: width 0.3s ease; border-radius: 10px;"></div>
            </div>
            <div style="margin-top: 5px; font-size: 12px; text-align: right;">${Math.round(progress)}%</div>
        `;

        return notification;
    }

    /**
     * 一意のIDを生成
     * @returns {string} ID
     */
    generateId() {
        return 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 通知数を取得
     * @returns {number} 通知数
     */
    getNotificationCount() {
        return this.notifications.size;
    }

    /**
     * 特定タイプの通知数を取得
     * @param {string} type - 通知タイプ
     * @returns {number} 通知数
     */
    getNotificationCountByType(type) {
        return Array.from(this.notifications.values())
            .filter(data => data.type === type).length;
    }
}