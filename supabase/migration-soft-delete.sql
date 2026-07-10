-- =============================================================
-- Substack 夏祭り — posters に論理削除（ソフトデリート）を追加
-- ユーザーがマイページで「削除」しても物理削除せず、非表示にするだけにする。
-- 管理画面から deleted_at を null に戻せば復活できる。
-- Supabase Dashboard → SQL Editor に貼り付けて実行する。冪等・破壊なし（追加のみ）。
-- =============================================================

-- 非表示にした日時。null = 表示中 / 値あり = 非表示（論理削除済み）。
alter table posters
  add column if not exists deleted_at timestamptz;

-- 表示中（deleted_at is null）だけを新着順で引く一覧クエリの高速化。
create index if not exists posters_deleted_at_idx
  on posters (deleted_at);

-- 確認用: select count(*) filter (where deleted_at is null) as active,
--                count(*) filter (where deleted_at is not null) as hidden
--         from posters;
