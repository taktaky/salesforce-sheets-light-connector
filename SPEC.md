# Salesforce Sheets Light Connector 仕様書（Draft v1.0）

## 1. 概要

### 1.1 目的

Google Spreadsheet + Apps Script を利用し、  
Salesforce データを ReadOnly で Spreadsheet に同期する軽量コネクタを提供する。

Google Salesforce Connector の代替として、以下を重視する。

- シンプル
- 軽量
- ReadOnly
- User Context
- Backend 不要
- OAuth Secret 最小化
- 監査説明容易
- 運用負荷低減

---

## 2. 基本方針

### 2.1 スコープ

本アプリは「参照同期」に限定する。

対象:

- SOQL 実行
- Spreadsheet 同期
- 定期同期
- 差分同期

対象外:

- Insert
- Update
- Delete
- 双方向同期
- CDC 完全対応
- ETL/DWH
- リアルタイム同期
- Salesforce Metadata 管理

---

## 3. システム構成

```text
Google Spreadsheet
 ├ README
 ├ Config
 ├ AdminConfig
 ├ Logs
 ├ Data Sheets
 └ Apps Script
      ├ OAuth(PKCE)
      ├ Validation
      ├ Sync
      ├ Upsert
      ├ Trigger
      └ Dry Run

```

---

## 4. 提供モデル

### 4.1 配布者（tack）

提供物:

- Spreadsheet Template
- Apps Script
- README
- GitHub Repository

保持しない情報:

- Salesforce Password
- Access Token
- Refresh Token
- Client Secret
- 顧客データ

---

### 4.2 Salesforce 管理者

役割:

- OAuth Client 管理
- Salesforce App 管理
- ポリシー管理

実施内容:

1. External Client App または Connected App 作成
2. OAuth Scope 設定
3. Callback URL 設定
4. Client ID 発行
5. Apps Script Property 設定

推奨 OAuth:

- OAuth 2.0 PKCE

Callback URL:

```text
https://script.google.com/macros/d/{SCRIPT_ID}/usercallback

```

OAuth Scope:

```text
api
refresh_token

```

---

### 4.3 Salesforce ユーザー

実施内容:

1. Salesforce OAuth Login
2. Config シート設定
3. Sync 実行
4. 必要に応じて再認証

---

## 5. Config シート仕様


| column     | required | description        |
| ---------- | -------- | ------------------ |
| enabled    | ○        | 実行有効フラグ            |
| sheet_name | ○        | 出力先シート名            |
| soql       | ○        | 実行 SOQL            |
| interval   | ○        | 実行間隔               |
| mode       | ○        | full / incremental |
| memo       |          | メモ                 |


### 5.1 interval


| value  | description |
| ------ | ----------- |
| manual | 手動実行のみ      |
| hourly | 毎時          |
| daily  | 毎日          |
| weekly | 毎週          |


### 5.2 mode


| value       | description |
| ----------- | ----------- |
| full        | 毎回全件同期      |
| incremental | 差分同期        |


---

## 6. AdminConfig シート仕様


| key                | description          | sample |
| ------------------ | -------------------- | ------ |
| MAX_LIMIT          | 最大 LIMIT             | 5000   |
| MAX_TIMEOUT_SEC    | Query Timeout        | 30     |
| MAX_ROWS_PER_SYNC  | 1同期最大件数              | 10000  |
| VALIDATION_LEVEL   | Validation Level     | STRICT |
| ENABLE_INCREMENTAL | 差分同期有効               | TRUE   |
| ENABLE_DRY_RUN     | Dry Run有効            | TRUE   |
| TOKEN_EXPIRE_DAYS  | 再認証期限                | 30     |
| ALLOW_ORDER_BY     | ORDER BY許可           | FALSE  |
| ALLOW_RELATIONSHIP | Relationship Query許可 | FALSE  |


---

## 7. Validation 仕様

### 7.1 許可

- SELECT のみ

### 7.2 禁止

- UPDATE
- DELETE
- INSERT
- UPSERT
- MERGE
- OFFSET
- 複数文

### 7.3 LIMIT 必須

例:

```sql
SELECT Id, Name FROM Account LIMIT 1000

```

### 7.4 LIMIT 上限

AdminConfig の MAX_LIMIT を超える場合エラー。

### 7.5 Timeout

MAX_TIMEOUT_SEC 超過時は失敗扱い。

### 7.6 Relationship Query

デフォルト禁止。

例:

```sql
SELECT Id, Account.Name FROM Contact

```

---

## 8. OAuth 仕様

### 8.1 認証方式

OAuth 2.0 Authorization Code + PKCE

### 8.2 Token 保存

保存先:

```javascript
PropertiesService.getUserProperties()

```

保存対象:

- access_token
- refresh_token
- expires_at
- last_login_at

### 8.3 再認証

デフォルト:

- 30日

期限切れ時:

- Trigger停止
- UI Warning表示
- 再ログイン要求

---

## 9. Sync 仕様

### 9.1 基本フロー

```text
Config取得
 ↓
Validation
 ↓
SOQL実行
 ↓
Pagination
 ↓
Spreadsheet Upsert
 ↓
Log出力

```

---

### 9.2 Pagination

Salesforce REST API の nextRecordsUrl に対応。

自動取得を行う。

---

### 9.3 差分同期

mode=incremental の場合:

```sql
WHERE LastModifiedDate > lastSync

```

を自動付与。

lastSync 保存先:

```javascript
PropertiesService.getDocumentProperties()

```

key:

```text
lastSync_{sheet_name}

```

---

### 9.4 Delete 同期

v1 では未対応。

理由:

- queryAll 制約
- Recycle Bin 権限制約
- User Context 優先
- 運用簡素化

---

## 10. Spreadsheet 更新仕様

### 10.1 主キー

Salesforce Id を主キーとする。

### 10.2 Upsert


| 状態   | 動作     |
| ---- | ------ |
| Idなし | append |
| Idあり | update |


### 10.3 更新方式

禁止:

```javascript
appendRow()

```

推奨:

```javascript
setValues()

```

### 10.4 Data Sheet

Data Sheet はシステム管理領域とする。

ユーザーによる:

- 並び替え
- 列削除
- 列移動

は禁止。

---

## 11. Dry Run 仕様

### 11.1 目的

- Query検証
- 負荷確認
- Validation確認

### 11.2 実施内容

- Validation
- Query実行テスト
- 件数確認
- 実行時間確認

### 11.3 出力


| item           | description |
| -------------- | ----------- |
| Query Valid    | Query有効性    |
| LIMIT          | LIMIT値      |
| Estimated Rows | 想定件数        |
| Execution Time | 実行時間        |
| Fields         | フィールド数      |
| Errors         | エラー内容       |


### 11.4 Warning


| 条件                       | Warning          |
| ------------------------ | ---------------- |
| rows > MAX_ROWS_PER_SYNC | Too many rows    |
| timeout near limit       | Slow query       |
| no LIMIT                 | Validation Error |


---

## 12. Trigger 仕様

### 12.1 Trigger

Apps Script Trigger は1個のみ利用。

### 12.2 実行方式

内部で interval 判定。

例:

```javascript
if (interval === 'hourly') {
  runSync();
}

```

---

## 13. Logs 仕様

### 13.1 Logs シート


| column  | description     |
| ------- | --------------- |
| time    | 実行時刻            |
| sheet   | 対象シート           |
| status  | SUCCESS / ERROR |
| rows    | 同期件数            |
| message | 詳細              |


---

## 14. Row 制限

### 14.1 推奨


| rows          | recommendation |
| ------------- | -------------- |
| ～10,000       | 推奨             |
| 10,000～50,000 | 注意             |
| 50,000以上      | 非推奨            |


### 14.2 Warning

MAX_ROWS_PER_SYNC 超過時 Warning 表示。

---

## 15. エラー処理

### 15.1 Retry

429 / timeout に対して exponential backoff を行う。

### 15.2 Trigger Error

認証期限切れ時:

- Trigger停止
- Logs出力
- 再認証要求

---

## 16. GitHub / Version 管理

### 16.1 開発方式

clasp + GitHub を利用。

### 16.2 Versioning

Semantic Versioning:

```text
v1.0.0

```

### 16.3 配布方式

- Template Copy
- GitHub Release
- Migration Guide

### 16.4 自動更新

未対応。

利用者側で任意更新。

---

## 17. 非機能要件


| 項目              | 内容         |
| --------------- | ---------- |
| Security        | ReadOnly   |
| Authentication  | OAuth PKCE |
| Backend         | 不要         |
| Secret Storage  | 最小         |
| Scalability     | 小～中規模      |
| Maintainability | GitHub管理   |
| Transparency    | ソース公開可能    |


---

## 18. 将来拡張候補

v1 対象外。

候補:

- Delete Sync
- Bulk API
- Connected Sheets
- BigQuery Export
- Relationship Query
- Query Builder UI
- Slack Notification
- CSV Export
- Archive Sheet
- Row Retention

---

## 19. 想定ユースケース

- Salesforce レポート代替
- Spreadsheet 分析
- 軽量 BI
- データ確認
- 運用監視
- 日次差分確認
- CSV エクスポート前処理

---

## 20. 運用方針

本アプリは:

- Lightweight
- ReadOnly
- Self-hosted
- No Backend

を基本思想とする。

ユーザーごとの Spreadsheet 環境で独立運用する。