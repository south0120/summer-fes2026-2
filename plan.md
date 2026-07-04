# summer-fes2026-2 — メールログイン + ポスター投稿 実装計画

Last Updated: 2026-07-04 JST / 担当: alex（実装はCodex委譲）

## 目的
静的な夏祭りポータルに、**ユーザーが自分のポスターを投稿できる**機能を足す。
投稿にはメールログイン（magic link）を必須にする。

## 依頼者の決定事項（サウス 7/4 確定）
1. ログイン方式 = **magic link（パスワード無し）**
2. 投稿権限 = **ログインすれば誰でも投稿可**（不適切投稿は運営が手動削除）
3. 公開フロー = **即公開**（承認待ちなし）
4. 投稿フィールド = 画像 + タイトル + ハンドル + 説明文(任意) + リンク(任意・**Substack URLのみ許可**)

## 技術スタック（合意: Supabase 一本化）
- **Auth**: Supabase Auth（Email magic link）
- **DB**: Supabase Postgres
- **画像ストレージ**: Supabase Storage（bucket: `posters`）
- **メール送信**: MVP=Supabase内蔵 → 公開前にResend(SMTP)差し替え（コード不変）
- フレームワーク: 既存 Next.js 14 App Router / TS / Tailwind

## スコープ
### やる
- Magic link ログイン（メール入力→リンク送信→コールバックでセッション確立）
- ログイン状態でヘッダーの「ログイン」ボタンをアカウント表示に切替、ログアウト
- ポスター投稿フォーム（要ログイン）: 画像アップロード + タイトル + ハンドル + 説明文 + Substackリンク
- 投稿バリデーション: 画像必須・タイトル必須・リンクはSubstack URLのみ（それ以外は拒否）
- 画像を Supabase Storage にアップロード、メタを `posters` テーブルに保存
- `PostersSection` をハードコードから **DB取得（新しい順）** に差し替え
- 即公開（承認フラグなし）

### やらない（今回スコープ外）
- いいねの押下・永続化（表示のみ維持、count=0デフォルト）
- 承認・モデレーションUI（削除はSupabaseダッシュボード or 後日の管理画面）
- ハンドルのプロフィール永続（投稿ごとに入力。将来 profiles テーブルに寄せる余地）

## DBスキーマ（案）
```sql
create table posters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  handle text not null,
  description text,
  link text,                 -- Substack URL のみ（アプリ側+CHECKで担保）
  image_path text not null,  -- Storage 内パス
  likes int not null default 0,
  created_at timestamptz not null default now()
);
alter table posters enable row level security;
-- 誰でも閲覧可
create policy "posters are public" on posters for select using (true);
-- ログインユーザーは自分名義で投稿可
create policy "insert own" on posters for insert with check (auth.uid() = user_id);
-- 自分の投稿のみ削除可（運営削除はservice roleで）
create policy "delete own" on posters for delete using (auth.uid() = user_id);
```
Storage bucket `posters`: public read / authenticated insert。

## 環境変数（サウスが用意 → `.env.local` + Vercel）
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`（サーバー側のみ・秘匿）

## 作業分担
- alex/Codex: コード実装全部（auth/フォーム/アップロード/スキーマSQL/RLS/一覧DB連携）
- サウス: Supabaseプロジェクト作成 → 上記envを`.env.local`とVercelに設定（鍵はDiscordに貼らない）

## マイルストーン
1. [ ] サウス最終👍（フィールド解釈 / メール2段方針）← **現在ここ**
2. [ ] Codexに実装prompt投げる → 生成 → alexレビュー
3. [ ] サウスがSupabase作成 + env設定（手順はalex提供）
4. [ ] ローカルでmagic link + 投稿 e2e動作確認
5. [ ] 公開前: Resend SMTP接続
6. [ ] 本番デプロイ（**サウス本人GO必須**）

## 完了条件
未ログインで投稿導線を踏む → magic linkでログイン → 画像付きポスターを投稿 → トップの「みんなのポスター」に即反映される、が本番で通ること。
