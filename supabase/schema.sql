-- =============================================================
-- Substack 夏祭り — posters スキーマ
-- Supabase Dashboard → SQL Editor にそのまま貼り付けて実行する。
-- 何度実行しても安全（冪等）。
-- =============================================================

create table if not exists posters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  handle text not null,
  description text,
  link text,
  image_path text not null,
  likes int not null default 0,
  created_at timestamptz not null default now()
);

alter table posters enable row level security;

-- 再実行できるよう drop → create（create policy は if not exists 非対応のため）
drop policy if exists "posters public read" on posters;
create policy "posters public read" on posters
  for select using (true);

drop policy if exists "posters insert own" on posters;
create policy "posters insert own" on posters
  for insert with check (auth.uid() = user_id);

drop policy if exists "posters delete own" on posters;
create policy "posters delete own" on posters
  for delete using (auth.uid() = user_id);

-- =============================================================
-- Storage 設定（手順）
--
-- 1) Dashboard → Storage → New bucket で
--    名前: posters / Public bucket: ON（公開） で作成する。
--    （公開バケットなので閲覧はそのまま公開 URL で可能）
--
-- 2) storage.objects にポリシーを追加する。
--    下の SQL をコメントを外して SQL Editor で実行する
--    （アプリは `<user_id>/<uuid>.<ext>` というパスでアップロードするため、
--     「自分の user_id フォルダにのみ」書き込み/削除できるようにしている）:
--
-- drop policy if exists "posters authenticated upload own folder" on storage.objects;
-- create policy "posters authenticated upload own folder" on storage.objects
--   for insert to authenticated
--   with check (
--     bucket_id = 'posters'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- drop policy if exists "posters delete own objects" on storage.objects;
-- create policy "posters delete own objects" on storage.objects
--   for delete to authenticated
--   using (
--     bucket_id = 'posters'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
-- =============================================================
