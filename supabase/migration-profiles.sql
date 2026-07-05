-- =============================================================
-- Substack 夏祭り — profiles（ユーザーネームの正本）テーブル
-- ユーザーネームを1か所で管理し、ヘッダー・マイページ・ランキング等で参照する。
-- 変更すれば表示側は全部それを引くので自動反映される（スナップショットしない）。
-- Supabase Dashboard → SQL Editor に貼り付けて実行。冪等・破壊なし。
-- =============================================================

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- 表示名は公開情報（ランキング・ヘッダー等で誰でも読む）
drop policy if exists "profiles public read" on profiles;
create policy "profiles public read" on profiles
  for select using (true);

-- 自分の行だけ作成できる
drop policy if exists "profiles insert own" on profiles;
create policy "profiles insert own" on profiles
  for insert with check (auth.uid() = user_id);

-- 自分の行だけ更新できる
drop policy if exists "profiles update own" on profiles;
create policy "profiles update own" on profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 確認用: select * from profiles;
