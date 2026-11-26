import assert from "node:assert/strict";
import { POST } from "../app/api/settings/domains/route.js";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
process.env.UPDATE_SECRET_KEY = "test-secret";
process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

globalThis.fetch = async (url, options = {}) => {
  const href = String(url);

  if (href === "https://supabase.test/rest/v1/ln_kv?on_conflict=key") {
    return { ok: true, status: 201, text: async () => "" };
  }

  if (href === "https://angkanet38.com/rumus-otomatis/") {
    return {
      ok: true,
      status: 200,
      url: href,
      text: async () => "<html><body>Halaman baru tanpa nonce WordPress</body></html>",
    };
  }

  if (href === "https://angkanet38.com/api/scanner") {
    const body = JSON.parse(options.body);
    assert.equal(body.market, "sgp");
    assert.equal(body.maxTime, 1);
    assert.equal(body.maxResults, 1);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success", configs: [] }),
    };
  }

  throw new Error(`Unexpected fetch: ${href}`);
};

try {
  const request = new Request("http://localhost/api/settings/domains", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-update-secret": "test-secret" },
    body: JSON.stringify({ seeds: ["https://angkanet38.com"] }),
  });
  const response = await POST(request);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.deepEqual(result.seeds, ["https://angkanet38.com"]);
  assert.equal(result.probe?.ok, true, result.probe?.error || "probe seharusnya berhasil");
  console.log("PASS: pengaturan menyimpan domain dan probe memakai scanner API publik.");
} finally {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
}
