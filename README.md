# 家計簿アプリ v2.0

## 📊 概要

シンプルで使いやすい家計簿アプリです。収入と支出を記録し、月別の収支グラフで家計の状況を可視化できます。

### ✨ 主な機能

- 📝 **取引記録**: 収入・支出の登録と管理
- 📊 **グラフ表示**: 月別収支の可視化
- 🗂️ **カテゴリ管理**: 自由にカスタマイズ可能
- 💾 **データ保存**: IndexedDB + localStorage対応
- 📤 **インポート/エクスポート**: JSON・Excel形式対応
- 🔍 **フィルタリング**: 日付・種類・カテゴリ別検索
- 📱 **レスポンシブ**: スマートフォン・タブレット対応
- 🛡️ **セキュリティ**: XSS対策・入力値サニタイゼーション

## 🚀 インストールと使用方法

### 基本セットアップ

1. **ファイル配置**
   ```
   household-budget-app/
   ├── index.html
   ├── assets/
   │   ├── css/
   │   ├── js/
   │   └── icons/
   └── README.md
   ```

2. **Webサーバーで起動**
   ```bash
   # 簡単なHTTPサーバー例
   python -m http.server 8000
   # または
   npx serve .
   ```

3. **ブラウザでアクセス**
   ```
   http://localhost:8000
   ```

### 対応ブラウザ

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## 📁 プロジェクト構成

### ディレクトリ構造

```
household-budget-app/
├── index.html                    # メインHTMLファイル
├── assets/
│   ├── css/
│   │   ├── main.css             # メインスタイル
│   │   ├── components.css       # コンポーネントスタイル
│   │   └── responsive.css       # レスポンシブ対応
│   ├── js/
│   │   ├── app.js              # アプリケーション初期化
│   │   ├── constants.js        # 定数・設定
│   │   ├── utils/              # ユーティリティ
│   │   │   ├── dateParser.js   # 日付解析
│   │   │   ├── sanitizer.js    # 入力値サニタイゼーション
│   │   │   └── debounce.js     # パフォーマンス最適化
│   │   ├── data/               # データ管理
│   │   │   ├── dataManager.js  # メインデータ管理
│   │   │   ├── indexedDBManager.js # IndexedDB操作
│   │   │   └── eventEmitter.js # イベント管理
│   │   ├── ui/                 # UI管理
│   │   │   ├── uiManager.js    # メインUI制御
│   │   │   ├── modalManager.js # モーダル管理
│   │   │   ├── notificationManager.js # 通知管理
│   │   │   └── categoryManagerUI.js   # カテゴリ管理UI
│   │   ├── chart/              # チャート機能
│   │   │   └── chartManager.js # Chart.js管理
│   │   └── file/               # ファイル処理
│   │       └── fileHandler.js  # インポート/エクスポート
│   └── icons/
│       └── favicon.ico
└── README.md
```

### 主要コンポーネント

#### 📊 データ管理 (data/)
- **HouseholdBudgetData**: 取引データの管理、計算、永続化
- **IndexedDBManager**: ブラウザ内データベース操作
- **EventEmitter**: 非同期イベント処理

#### 🎨 UI管理 (ui/)
- **UIManager**: 画面制御とユーザーインタラクション
- **ModalManager**: ダイアログ・確認画面の管理
- **NotificationManager**: 通知・アラート表示

#### 🛠️ ユーティリティ (utils/)
- **DateParser**: 多様な日付フォーマット対応
- **Sanitizer**: XSS対策・入力値検証
- **Debounce**: パフォーマンス最適化

## 🔧 カスタマイズ

### 設定変更

`assets/js/constants.js` で主要設定を変更できます：

```javascript
export const CONSTANTS = {
    DEFAULTS: {
        NOTIFICATION_DURATION: 3000,    // 通知表示時間
        AUTO_BACKUP_INTERVAL: 100,      // 自動バックアップ間隔
        MAX_CHART_AMOUNT: 200000        // チャート最大金額
    },
    VALIDATION: {
        MAX_DESCRIPTION_LENGTH: 200,    // 説明文最大長
        MIN_AMOUNT: 1,                  // 最小金額
        MAX_AMOUNT: 99999999           // 最大金額
    }
};
```

### カテゴリのカスタマイズ

デフォルトカテゴリは `constants.js` で定義：

```javascript
export const DEFAULT_CATEGORIES = {
    income: ['給与', 'ボーナス', '副業', '投資', 'その他収入'],
    expense: ['食費', '交通費', '光熱費', '通信費', '娯楽', '医療費']
};
```

### スタイルのカスタマイズ

- **メインカラー**: `assets/css/main.css` の CSS変数
- **レスポンシブ**: `assets/css/responsive.css`
- **コンポーネント**: `assets/css/components.css`

## 📊 データ形式

### 取引データ構造

```javascript
{
    id: "uuid-string",              // 一意ID
    date: "2025-01-15",            // 日付 (YYYY-MM-DD)
    type: "income" | "expense",     // 種類
    category: "食費",               // カテゴリ
    amount: 1500,                   // 金額 (整数)
    description: "昼食代",          // 説明 (任意)
    createdAt: "2025-01-15T10:30:00.000Z",  // 作成日時
    updatedAt: "2025-01-15T10:30:00.000Z"   // 更新日時
}
```

### エクスポート形式

**JSON形式**:
```javascript
{
    version: "2.0.0",
    timestamp: "2025-01-15T10:30:00.000Z",
    transactions: [...],           // 取引データ配列
    categories: {...},             // カテゴリ設定
    stats: {...}                   // 統計情報
}
```

**Excel形式**:
| 日付 | 種類 | カテゴリ | 説明 | 金額 |
|------|------|----------|------|------|
| 2025-01-15 | 支出 | 食費 | 昼食代 | 1500 |

## 🔒 セキュリティ機能

### XSS対策
- 全ての入力値をサニタイズ
- HTMLタグ・スクリプトの除去
- CSP (Content Security Policy) 対応

### データ保護
- ブラウザ内データベース使用
- 自動バックアップ機能
- データ整合性チェック

### 入力値検証
```javascript
// 金額検証例
const amount = Sanitizer.sanitizeAmount(userInput);
if (amount < 1 || amount > 99999999) {
    throw new Error('金額が範囲外です');
}
```

## 🛠️ 開発者向け情報

### API使用例

```javascript
// データマネージャーを取得
const dataManager = window.__HOUSEHOLD_BUDGET_APP__.dataManager;

// 取引を追加
await dataManager.addTransaction({
    date: '2025-01-15',
    type: 'expense',
    category: '食費',
    amount: 1500,
    description: '昼食代'
});

// サマリーを取得
const summary = dataManager.calculateSummary();
console.log(`収入: ${summary.income}, 支出: ${summary.expense}`);
```

### イベント監視

```javascript
// データ変更イベントを監視
dataManager.on('dataChanged', () => {
    console.log('データが更新されました');
});

// 取引追加イベントを監視
dataManager.on('transactionAdded', (transaction) => {
    console.log('新しい取引:', transaction);
});
```

### カスタムプラグイン作成

```javascript
class CustomPlugin {
    constructor(app) {
        this.app = app;
        this.init();
    }
    
    init() {
        // アプリのイベントを監視
        this.app.dataManager.on('dataChanged', this.onDataChanged.bind(this));
    }
    
    onDataChanged() {
        // カスタム処理
    }
}

// プラグインを登録
const plugin = new CustomPlugin(window.__HOUSEHOLD_BUDGET_APP__);
```

## 📚 トラブルシューティング

### よくある問題

**Q: データが保存されない**
A: ブラウザの設定でIndexedDBが無効になっている可能性があります。localStorageフォールバックが動作するはずです。

**Q: インポートが失敗する**
A: ファイル形式と文字エンコーディング（UTF-8）を確認してください。

**Q: グラフが表示されない**
A: Chart.jsライブラリの読み込みを確認してください。ネットワーク接続も確認が必要です。

### デバッグ方法

```javascript
// デバッグモードを有効化
localStorage.setItem('debug', 'true');
location.reload();

// コンソールでアプリ状態を確認
console.log(window.__APP_DEBUG__);
```

### パフォーマンス改善

1. **大量データ処理**: バッチ処理機能を使用
2. **メモリ使用量**: 定期的にキャッシュクリア
3. **読み込み速度**: CDNライブラリのローカルキャッシュ

## 🔄 アップデート履歴

### v2.0.0 (2025-01-15)
- ✨ モジュール化によるコード分割
- 🔒 セキュリティ機能強化
- 📊 IndexedDB対応
- 🎨 UI/UX改善
- 📱 レスポンシブデザイン強化

### v1.0.0
- 基本的な家計簿機能
- JSON/Excelインポート・エクスポート
- 月別グラフ表示

## 🤝 コントリビューション

### 開発環境セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/your-repo/household-budget-app.git
cd household-budget-app

# 開発サーバー起動
npx serve .
```

### コードスタイル

- ES6+ モジュール形式
- JSDoc コメント必須
- Prettier + ESLint 推奨

### プルリクエスト

1. フィーチャーブランチを作成
2. 変更を実装・テスト
3. ドキュメント更新
4. プルリクエスト作成

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 🆘 サポート

- **GitHub Issues**: バグ報告・機能要望

## 🙏 謝辞

- [Chart.js](https://www.chartjs.org/) - グラフ描画ライブラリ
- [SheetJS](https://sheetjs.com/) - Excel処理ライブラリ
- アイコン提供: 各種オープンソースプロジェクト

---

**📞 お困りの際は**

このアプリがお役に立てば幸いです。問題や提案がございましたら、GitHubのIssuesまでお気軽にお知らせください。
