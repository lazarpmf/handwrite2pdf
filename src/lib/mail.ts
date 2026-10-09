import nodemailer from "nodemailer";

export async function sendPassEmail(input: {
  to: string;
  code: string;
  expiresAt: string | null;
  days: number;
}): Promise<boolean> {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "";
  const expires = input.expiresAt
    ? new Date(input.expiresAt).toLocaleString("sr-Latn", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "";
  const text = [
    "Hvala na kafi.",
    "",
    `Tvoj InkTeX Pro kod: ${input.code}`,
    expires ? `Važi ${input.days} dana, do: ${expires}` : "Važi bez roka.",
    "",
    "U aplikaciji otvori Postavke i nalijepi kod.",
    "Dok kod važi možeš neograničeno stranica, bez watermarka.",
  ].join("\n");

  if (process.env.RESEND_API_KEY && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: "Tvoj InkTeX Pro kod",
        text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend ${res.status}: ${await res.text()}`);
    }
    return true;
  }

  if (process.env.SMTP_HOST && from) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "1",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
        : undefined,
    });
    await transport.sendMail({
      from,
      to: input.to,
      subject: "Tvoj InkTeX Pro kod",
      text,
    });
    return true;
  }

  return false;
}
