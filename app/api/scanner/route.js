import { NextResponse } from "next/server";
import { wlaScannerApi } from "../../lib/wla.js";

export async function POST(req) {
  try {
    const body = await req.json();
    const { hub_action, ...fields } = body;

    const data = await wlaScannerApi(fields);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: err.status || 500 }
    );
  }
}
