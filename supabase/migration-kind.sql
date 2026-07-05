-- =============================================================
-- Substack 夏祭り — posters に投稿区分 kind を追加するマイグレーション
-- ポスター投稿（poster）と屋台投稿（stall）を1テーブルで区別する。
-- Supabase Dashboard → SQL Editor にそのまま貼り付けて実行する。
-- 何度実行しても安全（冪等）。既存データはすべて 'poster' 扱いになる（破壊なし）。
-- =============================================================

-- 1) kind カラムを追加（未追加のときだけ）。既存行は default で 'poster' になる。
alter table posters
  add column if not exists kind text not null default 'poster';

-- 2) 許可値を poster / stall のみに制限（再実行できるよう drop → add）。
alter table posters
  drop constraint if exists posters_kind_check;
alter table posters
  add constraint posters_kind_check check (kind in ('poster', 'stall'));

-- 3) 一覧を kind で絞り込むためのインデックス（新着順表示の高速化）。
create index if not exists posters_kind_created_at_idx
  on posters (kind, created_at desc);

-- 確認用: 実行後の内訳を見る場合は下を実行
-- select kind, count(*) from posters group by kind;
