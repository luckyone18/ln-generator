import { NextResponse } from "next/server";
import { wlaFilterApi } from "../../lib/wla.js";

export async function POST(req) {
  try {
    const body = await req.json();
    const data = await wlaFilterApi(body);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: err.status || 500 }
    );
  }
}
