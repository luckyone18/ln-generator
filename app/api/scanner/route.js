import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { hub_action } = body;

    const nonce = "d2adc86ada";
    const targetUrl = `https://angkanet26.com/wp-admin/admin-ajax.php`;

    const formData = new URLSearchParams();
    formData.append("action", "wla_app_api");
    formData.append("hub_action", hub_action || "scanner_api");
    formData.append("ajax", "1");
    formData.append("nonce", nonce);

    if (body.market) formData.append("market", body.market);
    if (body.fCol) formData.append("fCol", body.fCol);
    if (body.limit) formData.append("limit", String(body.limit));
    if (body.patah !== undefined) formData.append("patah", String(body.patah));
    if (body.targetD !== undefined) formData.append("targetD", String(body.targetD));
    if (body.days && body.days.length > 0) {
      body.days.forEach((d) => formData.append("days[]", d));
    }
    if (body.is_first !== undefined) formData.append("is_first", String(body.is_first));
    if (body.code) formData.append("code", body.code);

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://angkanet26.com",
        "Referer": "https://angkanet26.com/scanner-angkanet-pro/",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `WLA Server returned HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ error: "Invalid JSON from WLA server" }, { status: 502 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
