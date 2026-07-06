# 夏祭りミニゲーム拡充プロジェクト

サウス依頼(2026-07-06 ch1522027055112388759): 「Fableをフル活用して夏祭りミニゲームをたくさん作って。ヨーヨーすくいや綿あめ作成などお祭りっぽい候補を出して作っていって」

## 目的
既存4ゲーム（射的 / 射的3D / 輪投げ / 金魚すくい）に、お祭りらしいミニゲームを継続的に追加していく。実装の手は Fable5、設計・共有配線・レビューは alex(Opus)。

## 候補メニュー（サウス提示済）
スコア競争型（30秒×共有ランキング＝既存と同じ土俵）:
1. ヨーヨーすくい `yoyo`
2. 綿あめづくり `cotton-candy`
3. たぬき叩き（もぐらたたき）`whack`
4. 型抜き（かたぬき）`kata` — 候補
5. 盆踊り太鼓（リズム）`taiko` — 候補
6. 打ち上げ花火（タイミング）`hanabi` — 候補
7. かき氷づくり `kakigori` — 候補
運・体験型:
8. 福引き／ガラガラくじ `fukubiki` — 候補

## 第1弾（着手中）
`yoyo` / `cotton-candy` / `whack` の3本。Fable5に1本ずつ並列委譲。

## アーキテクチャ契約（新ゲーム1本 = 触るファイル）
### alex が担当する共有ファイル（Fable5には触らせない＝衝突防止）
- `src/lib/scores.ts` — `GameKey` union / `GAME_LABELS` / `isGameKey` に slug 追加【✅第1弾3slug追加済】
- `src/components/sections/GamesSection.tsx` — `GAMES` 配列にカード追加（title/desc/icon/href）
- `src/app/rankings/page.tsx` — `GAMES: GameKey[]` に slug 追加＋グリッド列調整（4→7でlg:grid-cols-4のまま折返し許容 or 調整）
- `public/art/` — カード用アイコンPNG（各ゲーム）
- DB `scores.game` の CHECK制約確認（repo未管理・ブラウザSQLで作成された。⚠️e2e/デプロイ前に「新slug insert可否」を要確認。制約あれば緩める＝サウス承認でSupabase実行）

### Fable5 が新規作成するファイル（1ゲームにつき2つ）
- `src/app/<slug>/page.tsx` — server component。`<Game/>` + `<RankingPanel game="<slug>"/>`
- `src/components/<slug>/<Name>Game.tsx` — `"use client"` 本体（canvas 2D・phase machine・GameShell/ScoreSubmit/Leaderboard組込）

### 雛形（倣う既存ゲーム）
- `src/components/goldfish/GoldfishGame.tsx` / `src/app/goldfish/page.tsx`
- 論理解像度 W=480 / H=640（3:4）。phase = ready/playing/result。simRef + rAF。pushUi差分。pointer→論理座標。
- 共有: `@/components/game/GameShell` `Leaderboard` `ScoreSubmit` `RankingPanel` / `palette` の `P` / `paper`（paperRect/Circle/Poly, drawNightSky, drawLantern）/ `audio`（ensureAudio, sfx）。
- リザルトoverlayに `ScoreSubmit game score` + `Leaderboard game`、ページ下に `RankingPanel game`。

## 実装ステータス（2026-07-06 更新）
- ✅ scores.ts に yoyo/cotton-candy/whack の3slug追加済（未commit）。
- ⚠️ 前セッションのFable5実装は**リフレッシュで消失**（ゲームファイル未生成）。7/6再起動後に**再launch**した：yoyo=a41907d8a72134199 / cotton-candy=af1bebced687f2700 / whack=ace290513b54f5cd5（全てbackground・2ファイルのみ作成・build/lint走らせない指示）。
- 次: 3本着地→alexレビュー+共有配線(GamesSection/rankings/icon)+全体build/lint+headless検証→サウス報告→デプロイGO。

## 進め方
1. alex: scores.ts に slug 追加（型を通す）→ Fable5 が game="<slug>" を使える
2. Fable5: 各ゲーム実装 + `npm run build`/`lint` 検証 → alex にファイル報告
3. alex: コードレビュー + 共有配線（GamesSection/rankings/icon）+ 全体build/lint + ローカルheadless検証(スクショ)
4. サウス報告 → 直し反映 → デプロイはサウス直接GO
5. 第1弾OKなら第2弾（型抜き/太鼓/花火 等）へ

## 完了条件（1ゲーム）
- /<slug> ルートで遊べる（ready→playing→result）
- リザルトでスコア登録→共有ランキング反映（要ログイン）
- トップGamesSectionにカード / /rankings に枠
- build/lint クリーン・レイアウト崩れなし
