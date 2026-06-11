# デプロイ手順（完全無料：Render + Neon）

## 必要なもの（すべて無料）
- [Anthropic APIキー](https://console.anthropic.com/) （Claude用）
- [Google AI APIキー](https://aistudio.google.com/app/apikey) （Gemini用）
- [GitHubアカウント](https://github.com/)
- [Neonアカウント](https://neon.tech/) — PostgreSQLデータベース（無料）
- [Renderアカウント](https://render.com/) — ホスティング（無料）

---

## 手順

### ① GitHubにコードをアップロード

1. [github.com/new](https://github.com/new) でリポジトリを新規作成
   - 名前例: `ad-compliance-checker`
   - Public / Private どちらでも可
2. 「uploading an existing file」→ このフォルダの中身を全選択してドラッグ
3. 「Commit changes」をクリック

### ② Neon でデータベースを作成

1. [neon.tech](https://neon.tech/) にアクセス → GitHubでログイン
2. 「New Project」→ プロジェクト名を入力（例: `ad-checker`）→ Create
3. 作成後に表示される **Connection string** をコピーして保管
   - 形式: `postgresql://user:password@host/dbname?sslmode=require`

### ③ Render でホスティング設定

1. [render.com](https://render.com/) にアクセス → GitHubでログイン
2. 「New +」→「Web Service」
3. GitHubリポジトリを選択 → Connect
4. 設定画面で確認：
   - **Build Command**: `pnpm install && pnpm build && pnpm db:push`
   - **Start Command**: `pnpm start`
   - **Instance Type**: `Free`（無料を選択）
5. 「Environment Variables」に以下を追加：

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-xxxxx...` |
| `GOOGLE_AI_API_KEY` | `AIzaxxxxx...` |
| `DATABASE_URL` | Neonでコピーした接続文字列 |
| `JWT_SECRET` | 任意の文字列（例: `my-secret-2024`）|
| `NODE_ENV` | `production` |

6. 「Create Web Service」をクリック → 数分でデプロイ完了

### ④ URLにアクセス

Renderのダッシュボードに `https://ad-compliance-checker-xxxx.onrender.com` 形式のURLが表示されます。

---

## 注意点

- **無料プランはスリープあり**: 15分間アクセスがないと次のアクセス時に起動に50秒かかります
- APIキーの利用料は別途かかります（Claude/Geminiとも従量課金）

---

## ローカルで試す場合

```bash
# .env.example をコピー
cp .env.example .env
# .env を開いてAPIキーとDATABASE_URLを入力

pnpm install
pnpm db:push   # DBテーブル作成
pnpm dev       # 起動
```

ブラウザで http://localhost:3000 を開く
