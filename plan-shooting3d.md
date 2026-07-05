# plan — 3D射的を summer-fes2026-2 に統合（併設・共有ランキング）

## 目的
Fable5 が旧リポ `david/work/summer-fes2026`(ブランチ`feat/shooting-3d`) に実装した3D射的を、本番リポ `summer-fes2026-2` に**4つ目のゲームとして併設**し、2D射的と同じ**共有ランキング(/rankings)**に登録できるようにする。

## サウス確定要件（7/5）
- 2D射的(/shooting)は残す。3D射的を **/shooting-3d** として追加（B: 併設）
- ハイスコアは 2D と同じ**共有ランキング登録**（/rankings に「射的(3D)」枠）
- リロード制限・タップ位置と照準の固定ズレも 2D に合わせる

## 移植元コンポーネント（feat/shooting-3d・描画フリーズ済）
`src/components/shooting3d/`: ShootingGame3D / Scene / Stall / Target / Targets / Effects / GunViewmodel / Crosshair / sound.ts / textures.ts / types.ts
`src/app/shooting-3d/page.tsx`（dynamic ssr:false の薄いラッパー）

## 依存（⚠️バージョン固定必須・Davidより）
- `three@0.170.0`（**固定**。0.185 は drei 9.x と非互換でクラッシュ）
- `@react-three/fiber@^8.18.0`（React18対応。v9はReact19必須）
- `@react-three/drei@^9.122.0`
- `@types/three@^0.170.0`（dev）

## -2側のランキング配線パターン（既存2Dゲームと同じ）
- `src/lib/scores.ts`: `GameKey` union / `GAME_LABELS` / `isGameKey` / `submitScore` / `fetchTopScores` / pending stash
- ゲームページ: `<Game/>` + `<RankingPanel game=... />`、リザルト画面内に `<ScoreSubmit game=... score=.../>` + `<Leaderboard game=.../>`
- 2D射的の例: `ShootingGame.tsx:1370` `<ScoreSubmit game="shooting" score={score} />` / `RankingPanel game="shooting"`
- /rankings: `GAMES: GameKey[]` を map して `<Leaderboard game=g/>`

## 実装タスク（-2内）
1. **依存追加**: package.json に three/fiber/drei/@types 追加 → `npm i three@0.170.0`（固定）＋残りをインストール。lockfile 確認。
2. **shooting3d 移植**: `src/components/shooting3d/*` を -2 にコピー。import パス（@/components/game/GameShell 等）を -2 の構成に合わせて解決。
3. **scores.ts 拡張**: `GameKey` に `"shooting-3d"` 追加 / `GAME_LABELS["shooting-3d"]="射的(3D)"` / `isGameKey` に追加。
4. **ハイスコア置換**: `ShootingGame3D.tsx` の localStorage(`shooting3d_highscore`) を撤去し、リザルト画面に `<ScoreSubmit game="shooting-3d" score={score}/>` + `<Leaderboard game="shooting-3d"/>` を配置。ゲームページに `<RankingPanel game="shooting-3d"/>`（page.tsx側 or ラッパー）。未ログイン時の pending stash は ScoreSubmit が担当。
5. **MAX_AMMO 5→6**: `types.ts` の定数変更。残弾UI(●×6)も追随。
6. **照準固定オフセット追加**: 画面座標で上方向オフセット `AIM_OFFSET_PX`(≈70) を導入し、
   - クロスヘア表示位置（Crosshair の translate）を `tapY - OFFSET` に
   - raycast 用 NDC も同じ `tapY - OFFSET` から算出（ShootingGame3D の GameStage）
   - 既存 `aimDrift`（手ブレ ±0.06/±0.04）はそのまま加算
   → 見た目の狙点と実際の当たりを一致させ、「指で的が隠れない」を成立させる。
7. **/shooting-3d ルート**: page.tsx を -2 に配置（dynamic ssr:false ラッパー + RankingPanel）。
8. **GamesSection**: 4つ目カード「射的(3D)」/ href `/shooting-3d` を GAMES 配列に追加。横スクロール(sm:overflow-x-auto)は既存対応済なので4個で自然に流れる。
9. **/rankings**: `GAMES` 配列に `"shooting-3d"` 追加（4枠に。grid は lg:grid-cols-3 → 4個目は次行 or grid調整）。

## 検証
- `npm run build` + `npm run lint` クリーン
- ⚠️ headless chrome / MCP ブラウザは rAF 停止で3D描画が止まる → 3D挙動は David の `shooting3d_verify.mjs`(Playwright)を流用
- ルート200: /shooting-3d, /rankings（4枠表示）
- スコア登録e2e（ログイン→3Dプレイ→登録→/rankings反映）は構造確認＋サウス希望でテスト投稿→掃除

## デプロイ
- サウスGO必須（外向き）。`git commit`→push→`vercel --prod --yes`（南認証済CLI）

## 役割分担
- alex: -2への統合・配線・オフセット/6発・レビュー（実装は Codex に委譲）
- David/Fable5: 3D描画の追加調整が必要になった時のみ
