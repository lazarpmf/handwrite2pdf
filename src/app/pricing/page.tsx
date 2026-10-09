import Link from "next/link";

export default function PricingPage() {
  const paymentLink = process.env.NEXT_PUBLIC_BMC_URL || process.env.NEXT_PUBLIC_PAYMENT_LINK || "";

  return (
    <main className="pricing-page">
      <header className="pricing-hero">
        <p className="brand">InkTeX</p>
        <h1>Besplatno za tebe. Pro za kupce.</h1>
        <p className="lede">
          Prepoznavanje radi lokalno preko Pix2Text-a — nema API računa.
          Drugima prodaješ Pro licencu (više stranica, bez watermarka).
        </p>
        <Link className="primary-btn" href="/">
          Nazad u app
        </Link>
      </header>

      <section className="pricing-grid">
        <article className="plan">
          <h2>Free</h2>
          <p className="price">0 €</p>
          <ul>
            <li>Lokalni Pix2Text, bez API ključa</li>
            <li>Do 3 stranice po konverziji</li>
            <li>LaTeX + PDF + Overleaf eksport</li>
            <li>Mali watermark na PDF-u</li>
          </ul>
        </article>

        <article className="plan plan-pro">
          <h2>Pro</h2>
          <p className="price">3 $ / 7 dana</p>
          <ul>
            <li>Neograničen broj stranica</li>
            <li>Bez watermarka</li>
            <li>Jedinstveni kod na mejl poslije uplate</li>
            <li>Kod sam prestane da važi poslije sedam dana</li>
          </ul>
          {paymentLink ? (
            <a className="primary-btn" href={paymentLink} target="_blank" rel="noreferrer">
              Kupi sedmicu
            </a>
          ) : (
            <p className="hint">
              Postavi <code>NEXT_PUBLIC_BMC_URL</code> na svoj Buy Me a Coffee profil.
            </p>
          )}
        </article>
      </section>

      <section className="seller-guide">
        <h2>Kako da unovčiš</h2>
        <ol>
          <li>Na Buy Me a Coffee stavi cijenu kafe na 3 $.</li>
          <li>
            Integrations → New webhook. URL:{" "}
            <code>https://tvoj-domen/api/webhooks/buymeacoffee</code>. Event:{" "}
            <code>donation.created</code>.
          </li>
          <li>
            Signing secret stavi u <code>BMC_WEBHOOK_SECRET</code>. Mejl ide preko
            Resend ili SMTP (<code>MAIL_FROM</code>).
          </li>
          <li>
            Kupac dobije jedinstveni kod i unese ga u{" "}
            <strong>Postavke → Pro licenca</strong>. Kod važi 7 dana.
          </li>
        </ol>
      </section>
    </main>
  );
}
