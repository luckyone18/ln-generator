import assert from "node:assert/strict";
import { wlaScannerApi } from "../app/lib/wla.js";

const originalFetch = globalThis.fetch;
const calls = [];
const payload = {
  market: "sgp",
  fCol: "ai",
  limit: 1,
  patahMax: 0,
  targetDMax: 0,
  maxTime: 1,
  maxResults: 1,
  daysFilter: ["Senin"],
  is_first: true,
};

globalThis.fetch = async (url, options = {}) => {
  const href = String(url);
  calls.push({ href, options });

  if (href.endsWith("/rumus-otomatis/")) {
    return {
      ok: true,
      status: 200,
      url: "https://angkanet38.com/rumus-otomatis/",
      text: async () => "<html><body>Halaman baru tanpa nonce WordPress</body></html>",
    };
  }

  if (href === "https://angkanet38.com/api/scanner") {
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    const sent = JSON.parse(options.body);
    assert.deepEqual(sent, payload);
    assert.equal("nonce" in sent, false);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", configs: [] }),
    };
  }

  throw new Error(`Unexpected fetch: ${href}`);
};

try {
  const result = await wlaScannerApi(payload);
  assert.equal(result.status, "success");
  assert.ok(calls.some((call) => call.href === "https://angkanet38.com/api/scanner"));
  console.log("PASS: scanner memakai API JSON publik tanpa nonce WordPress lama.");
} finally {
  globalThis.fetch = originalFetch;
}
