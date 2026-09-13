import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const nonce = "d2adc86ada";
    const targetUrl = `https://angkanet26.com/wp-admin/admin-ajax.php?action=wla_app_api&hub_action=filter_api&_wpnonce=${nonce}&ajax=1`;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://angkanet26.com",
        "Referer": "https://angkanet26.com/rumus-otomatis/",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `WLA Server returned HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
