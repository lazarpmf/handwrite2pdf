import { NextResponse } from "next/server";
import { parseBmcEvent } from "@/lib/bmc";
import { sendPassEmail } from "@/lib/mail";
import { issuePass, minPaymentAmount, revokePass, verifyBmcSignature } from "@/lib/passes";

export async function POST(request: Request) {
  const secret = process.env.BMC_WEBHOOK_SECRET || "";
  const raw = await request.text();
  const signature = request.headers.get("x-signature-sha256") || "";

  if (!secret || !verifyBmcSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "Neispravan potpis." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Neispravan JSON." }, { status: 400 });
  }

  const event = parseBmcEvent(payload);

  if (event.type === "donation.refunded") {
    const revoked = event.paymentId ? await revokePass(event.paymentId) : false;
    return NextResponse.json({ ok: true, revoked });
  }

  if (event.type !== "donation.created") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  if (!event.paymentId) {
    return NextResponse.json({ ok: true, skipped: "nema id uplate" });
  }

  if (event.amount < minPaymentAmount()) {
    return NextResponse.json({
      ok: true,
      skipped: "iznos je ispod cijene Pro sedmice",
    });
  }

  if (!event.email) {
    return NextResponse.json({ ok: true, skipped: "nema email kupca" });
  }

  const pass = await issuePass({
    email: event.email,
    paymentId: event.paymentId,
    amount: event.amount,
    currency: event.currency,
  });

  try {
    const emailed = await sendPassEmail({
      to: pass.email,
      code: pass.code,
      expiresAt: pass.expiresAt,
    });
    return NextResponse.json({
      ok: true,
      code: pass.code,
      expiresAt: pass.expiresAt,
      emailed,
    });
  } catch (error) {
    console.error("bmc mail", error);
    return NextResponse.json(
      { ok: false, error: "Kod je sačuvan, mejl nije poslat." },
      { status: 500 },
    );
  }
}
