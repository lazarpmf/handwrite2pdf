import Link from "next/link";

export default function PricingPage() {
  const paymentLink = process.env.NEXT_PUBLIC_PAYMENT_LINK || "";

  return (
    <main className="pricing-page">
      <header className="pricing-hero">
        <p className="brand">InkTeX</p>
        <h1>Besplatno za tebe. Pro za kupce.</h1>
        <p className="lede">
          Ti koristiš svoj Gemini ključ — API te ništa ne košta izvan Google
          free tier-a. Drugima prodaješ Pro licencu (više stranica, bez
          watermarka).
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
            <li>Vlastiti Gemini API ključ (BYOK)</li>
            <li>Do 3 stranice po konverziji</li>
            <li>LaTeX + PDF + Overleaf eksport</li>
            <li>Mali watermark na PDF-u</li>
          </ul>
        </article>

        <article className="plan plan-pro">
          <h2>Pro</h2>
          <p className="price">Tvoja cijena</p>
          <ul>
            <li>Neograničen broj stranica</li>
            <li>Bez watermarka</li>
            <li>I dalje BYOK — tvoj trošak API-ja = 0</li>
            <li>Licencni ključ koji ti generišeš</li>
          </ul>
          {paymentLink ? (
            <a className="primary-btn" href={paymentLink} target="_blank" rel="noreferrer">
              Kupi Pro
            </a>
          ) : (
            <p className="hint">
              Postavi <code>NEXT_PUBLIC_PAYMENT_LINK</code> (Stripe Payment Link)
              kad budeš spreman da naplaćuješ.
            </p>
          )}
        </article>
      </section>

      <section className="seller-guide">
        <h2>Kako da unovčiš</h2>
        <ol>
          <li>
            Postavi tajni seed: <code>PRO_LICENSE_SEED=neki-dugi-secret</code>
          </li>
          <li>
            Generiši ključ:{" "}
            <code>PRO_LICENSE_SEED=... node scripts/gen-license.mjs</code>
          </li>
          <li>
            Napravi Stripe Payment Link / PayPal i pošalji kupcu ključ nakon
            uplate (ručno ili automatski).
          </li>
          <li>
            Kupac unese ključ u <strong>Postavke → Pro licenca</strong>.
          </li>
        </ol>
      </section>
    </main>
  );
}
