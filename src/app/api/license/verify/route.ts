import { NextResponse } from "next/server";
import { resolveLicense } from "@/lib/passes";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { key?: string };
    const key = body.key?.trim() || "";
    if (!key) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }
    const status = await resolveLicense(key);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
