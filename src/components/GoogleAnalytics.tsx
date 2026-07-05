import Script from "next/script";

/**
 * GA4 計測タグ（gtag.js）。全ページ共通で読み込む。
 *
 * 測定 ID は環境変数 `NEXT_PUBLIC_GA_MEASUREMENT_ID` から読む。
 * → 本番（Vercel Production）にだけ ID を設定することで、
 *   ローカル開発・プレビューデプロイでは計測が走らず、GA のデータを汚さない。
 * ID 未設定なら何もレンダリングしない。
 *
 * ページビューは GA4 の「拡張計測機能」（デフォルト ON）が
 * ブラウザ履歴イベントを拾って SPA 遷移も自動計測するため、
 * 追加のルート監視コードは不要。
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function GoogleAnalytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
