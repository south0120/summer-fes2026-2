-- =============================================================
-- Substack 夏祭り — likes（いいね）テーブル
-- ログイン必須・1人1回（post_id × user_id を主キーにして重複を防ぐ）。
-- 表示のハート数 = そのポスト（posters.id）に対する likes の件数。
-- もう一度押すと自分の行を消す（トグル）。
-- Supabase Dashboard → SQL Editor に貼り付けて実行。冪等・破壊なし。
-- =============================================================

create table if not exists likes (
  post_id uuid references posters(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table likes enable row level security;

-- 件数集計のため誰でも読める
drop policy if exists "likes public read" on likes;
create policy "likes public read" on likes
  for select using (true);

-- 自分の user_id でのみ「いいね」できる
drop policy if exists "likes insert own" on likes;
create policy "likes insert own" on likes
  for insert with check (auth.uid() = user_id);

-- 自分の「いいね」だけ取り消せる
drop policy if exists "likes delete own" on likes;
create policy "likes delete own" on likes
  for delete using (auth.uid() = user_id);

-- 集計クエリの高速化
create index if not exists likes_post_id_idx on likes (post_id);

-- 確認用: select post_id, count(*) from likes group by post_id;
