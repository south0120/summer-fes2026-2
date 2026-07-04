# Substack 夏祭り — Supabase セットアップ手順（オーナー向け）

投稿機能（メールログイン + ポスター投稿）を動かすための手順です。上から順番に進めてください。

## 1. Supabase プロジェクトを作成する 【済み】

すでに作成済みの前提です。Dashboard: https://supabase.com/dashboard

## 2. データベーススキーマを流す

1. Dashboard → 対象プロジェクト → **SQL Editor** を開く
2. リポジトリの `supabase/schema.sql` の内容を全部貼り付けて **Run**
3. `posters` テーブルと RLS ポリシー 3 つが作成されます（何度実行しても安全です）

## 3. Storage バケットを作る

1. Dashboard → **Storage** → **New bucket**
2. 名前: `posters` ／ **Public bucket: ON（公開）** で作成
3. `supabase/schema.sql` の末尾コメントにある Storage ポリシー 2 つ
   （`posters authenticated upload own folder` と `posters delete own objects`）の
   SQL のコメント（`-- `）を外して SQL Editor で実行

## 4. API キーを環境変数に設定する

Dashboard → **Settings → API** から値をコピーして、**ローカルの `.env.local`** と **Vercel の環境変数**（Settings → Environment Variables、Production / Preview / Development すべて）の両方に設定します。

| Supabase Dashboard の値 | 設定する変数名 |
|---|---|
| **Project URL**（例: `https://xxxx.supabase.co`） | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon public** キー | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** キー（⚠️ 秘密。クライアントに出さない・共有しない） | `SUPABASE_SERVICE_ROLE_KEY` |

いまの `.env.local` にはダミー値が入っているので、上記の本物に差し替えてください。

## 5. 認証のリダイレクト URL を設定する

Dashboard → **Authentication → URL Configuration** で:

1. **Site URL**: 本番の URL（例: `https://<vercel-domain>`）を設定
2. **Redirect URLs** に以下の 2 つを追加:
   - `http://localhost:3000/auth/callback`
   - `https://<vercel-domain>/auth/callback`

`<vercel-domain>` は実際の Vercel ドメイン（例: `summer-fes2026.vercel.app`）に読み替えてください。カスタムドメインを使う場合はそちらも追加します。

## 6. 【公開前に必須】メール送信を Resend SMTP に切り替える

Supabase 内蔵のメール送信は**レート制限が厳しく**（1 時間あたり数通程度）、一般公開すると確認メールがすぐ届かなくなります。公開前に:

1. Resend（https://resend.com）でアカウント作成 → ドメイン認証 → SMTP 認証情報を取得
2. Supabase Dashboard → **Authentication → Emails → SMTP Settings** で Custom SMTP を有効化し、Resend の SMTP 情報を設定

## 動作確認

```bash
npm install
npm run dev
```

1. `http://localhost:3000` を開く → ヘッダー「ログイン」→ メールアドレスを入力
2. 届いたメールのリンクを開く → `/posters/new` に着地
3. 画像・タイトル・ハンドルネームを入れて投稿 → トップの「みんなのポスター」に即掲載
