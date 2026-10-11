import Link from "next/link";

export default function PricingPage() {
  const paymentLink = process.env.NEXT_PUBLIC_BMC_URL || process.env.NEXT_PUBLIC_PAYMENT_LINK || "";

  return (
    <main className="pricing-page">
      <header className="pricing-hero">
        <p className="brand">InkTeX</p>
        <h1>Besplatno za tebe. Pro za kupce.</h1>
        <p className="lede">
          Prepoznavanje radi na serveru. Kupac ne pravi nalog ni API ključ.
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
            <li>Čitanje rukopisa na serveru</li>
            <li>Do 3 stranice po konverziji</li>
            <li>LaTeX + PDF + Overleaf eksport</li>
            <li>Mali watermark na PDF-u</li>
          </ul>
        </article>

        <article className="plan plan-pro">
          <h2>Sedmica</h2>
          <p className="price">3 $</p>
          <ul>
            <li>Neograničen broj stranica</li>
            <li>Bez watermarka</li>
            <li>Kod stiže na mejl</li>
            <li>Važi 7 dana</li>
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

        <article className="plan plan-pro">
          <h2>Mjesec</h2>
          <p className="price">8 $</p>
          <ul>
            <li>Isto kao sedmica</li>
            <li>Važi 30 dana</li>
            <li>Membership se produžava kad se naplati</li>
            <li>Jedan kod, novi rok</li>
          </ul>
          {paymentLink ? (
            <a className="secondary-btn" href={paymentLink} target="_blank" rel="noreferrer">
              Kupi mjesec
            </a>
          ) : null}
        </article>
      </section>

      <section className="seller-guide">
        <h2>Kako da unovčiš</h2>
        <ol>
          <li>Sedmica: extra ili kafa od 3 $. Mjesec: extra od 8 $, ili membership.</li>
          <li>
            Webhook: <code>https://tvoj-domen/api/webhooks/buymeacoffee</code>. Eventi:{" "}
            <code>donation.created</code>, <code>extra_purchase.created</code>,{" "}
            <code>membership.started</code>.
          </li>
          <li>
            Signing secret u <code>BMC_WEBHOOK_SECRET</code>. Mejl preko Resend ili SMTP.
          </li>
          <li>
            Poklon kod koji sam izmisliš: <code>npm run gift -- DRAGANA-TAJNA</code>. Nema roka.
          </li>
        </ol>
      </section>
    </main>
  );
}
