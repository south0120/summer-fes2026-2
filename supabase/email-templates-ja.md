# Supabase メールテンプレ（日本語）— SMTP有効化後に貼る

Resend(SMTP)有効化後、Supabase Dashboard → Authentication → Emails → Templates で
各テンプレの Subject / Message body を下記に差し替える。
`{{ .ConfirmationURL }}` はSupabaseが差し込むログイン/確認リンク（そのまま残す）。

---

## Magic Link（既存ユーザーのログインリンク）

**Subject:**
```
「Substack 夏祭り」ログインリンク 🏮
```

**Message body (HTML):**
```html
<h2>夏祭りにログイン 🏮</h2>
<p>下のボタンからログインを完了してください。</p>
<p><a href="{{ .ConfirmationURL }}">ログインする</a></p>
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
<p>下のボタンでメールアドレスを確認して、登録を完了してください。</p>
<p><a href="{{ .ConfirmationURL }}">メールアドレスを確認する</a></p>
<p style="color:#666;font-size:13px;">このリンクは一度きり有効で、まもなく期限切れになります。心当たりがない場合はこのメールを無視してください。</p>
<p style="color:#666;font-size:13px;">— Substack 夏祭り 実行委員会</p>
```

---

## メモ
- 送信元(Sender): `noreply@south-create.com`（要ドメイン認証済み）/ 表示名「Substack 夏祭り」
- ⚠️ click tracking は Resend 側でOFF（マジックリンクがスキャナ先読みで消費される事故防止）
- SMTP設定値: host=`smtp.resend.com` / port=`465` / user=`resend` / password=ResendのAPIキー(サウス入力)
