# Supabase メールテンプレ（日本語）

Supabase Dashboard → Authentication → Emails → Templates で
各テンプレの Subject / Message body を下記に差し替える。

> ⚠️ **重要（バグ修正）**: リンクは `{{ .ConfirmationURL }}` ではなく、必ず下記の
> `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` 形式にすること。
>
> `{{ .ConfirmationURL }}`（PKCE フロー）は「リンクを送信したブラウザ」と
> 「リンクを開いたブラウザ」が同じでないと
> `PKCE code verifier not found in storage` エラーでログインに失敗する
> （スマホのメールアプリ内ブラウザで開いた場合などに頻発）。
> `token_hash` 方式はブラウザのストレージに依存しないため、どの端末・ブラウザで
> リンクを開いてもログインできる。アプリ側（`/auth/callback`）は両方式に対応済み。

---

## Magic Link（既存ユーザーのログインリンク）

**Subject:**
```
「Substack 夏祭り」ログインリンク 🏮
```

**Message body (HTML):**
```html
<h2>夏祭りにログイン 🏮</h2>
<p>アプリ内で使う場合は、下の6桁コードを入力してください：</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:8px 0;">{{ .Token }}</p>
<p style="font-size:13px;color:#666;">パソコンなど同じブラウザで使う場合は、下のボタンからログインを完了してください。</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">ログインする</a></p>
<p style="color:#666;font-size:13px;">このリンクは一度きり有効で、まもなく期限切れになります。心当たりがない場合はこのメールを無視してください。</p>
<p style="color:#666;font-size:13px;">— Substack 夏祭り 実行委員会</p>
```

---

## Confirm signup（初回登録の確認メール）

**Subject:**
```
「Substack 夏祭り」メールアドレスの確認 🎆
```

**Message body (HTML):**
```html
<h2>ようこそ、Substack 夏祭りへ 🎆</h2>
<p>アプリ内で使う場合は、下の6桁コードを入力してください：</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:8px 0;">{{ .Token }}</p>
<p style="font-size:13px;color:#666;">パソコンなど同じブラウザで使う場合は、下のボタンでメールアドレスを確認して、登録を完了してください。</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">メールアドレスを確認する</a></p>
<p style="color:#666;font-size:13px;">このリンクは一度きり有効で、まもなく期限切れになります。心当たりがない場合はこのメールを無視してください。</p>
<p style="color:#666;font-size:13px;">— Substack 夏祭り 実行委員会</p>
```

---

## メモ
- `{{ .RedirectTo }}` はアプリが送る `https://<ドメイン>/auth/callback?next=...` に展開される
  （アプリ側で常に `?next=` を付けているので、後ろに `&token_hash=...` を連結してよい）。
- `{{ .TokenHash }}` / `type=email` はサーバー側の `verifyOtp` で検証される。
- `{{ .Token }}` はアプリ内で入力する6桁コード。PWA / モバイルではリンクで外部ブラウザへ移動せず、
  アプリ内に留まったままログインできる。
- リンクボタンはデスクトップや同じブラウザで開ける環境向け。6桁コードとリンクは同じメールに載せる。
- 送信元(Sender): `noreply@south-create.com`（要ドメイン認証済み）/ 表示名「Substack 夏祭り」
- ⚠️ click tracking は Resend 側でOFF（マジックリンクがスキャナ先読みで消費される事故防止）
- SMTP設定値: host=`smtp.resend.com` / port=`465` / user=`resend` / password=ResendのAPIキー(サウス入力)
