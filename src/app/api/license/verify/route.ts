import { NextResponse } from "next/server";
import { validateLicense } from "@/lib/license";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { key?: string };
    const key = body.key?.trim() || "";
    if (!key) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }
    const valid = await validateLicense(key);
    return NextResponse.json({ valid });
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
