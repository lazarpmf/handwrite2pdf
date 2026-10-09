export type ParsedBmcEvent = {
  type: string;
  paymentId: string;
  email: string;
  amount: number;
  currency: string;
  liveMode: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function amountOf(value: unknown): number {
  const parsed = Number(text(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickEmail(data: Record<string, unknown>): string {
  for (const key of ["supporter_email", "support_email", "payer_email", "email"]) {
    const email = text(data[key]);
    if (email.includes("@")) return email;
  }
  return "";
}

function pickAmount(data: Record<string, unknown>): number {
  for (const key of ["total_amount", "amount", "support_amount"]) {
    const amount = amountOf(data[key]);
    if (amount > 0) return amount;
  }
  const count = amountOf(
    data.coffee_count ?? data.support_coffees ?? data.number_of_coffees ?? 1,
  );
  const price = amountOf(data.coffee_price ?? data.support_coffee_price);
  if (price > 0) return price * (count || 1);
  return 0;
}

export function parseBmcEvent(payload: unknown): ParsedBmcEvent {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root.response ?? root);
  const type = text(root.type) || "donation.created";
  const paymentId =
    text(data.transaction_id) ||
    text(data.support_id) ||
    text(data.id) ||
    text(root.event_id);

  return {
    type,
    paymentId,
    email: pickEmail(data),
    amount: pickAmount(data),
    currency: (text(data.currency) || text(data.support_currency) || "USD").toUpperCase(),
    liveMode: root.live_mode !== false,
  };
}
