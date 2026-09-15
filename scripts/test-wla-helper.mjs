// Test helper wla.js langsung — verifikasi discovery + filter_api + scanner_api
import { wlaFilterApi, wlaScannerApi } from "../app/lib/wla.js";

const assert = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} | ${name}${extra ? " | " + extra : ""}`);
  if (!cond) process.exitCode = 1;
};

// 1. filter_api (paito — dipakai refresh rumus ♻️ / manual add / rumus-otomatis page)
try {
  const d1 = await wlaFilterApi({
    market: "sgp", limit: 15, days: [], patah: 0, fCol: "ai",
    k1: 1, m1: 1, s1: "off", op1: "+",
    k2: -1, m2: 1, s2: "off", op2: "+",
    k3: -1, m3: 1, s3: "off", sf: "off",
    hideEmpty: true, targetD: 0, showRef: 0, manualHidden: [], isFrozen: true,
  });
  assert("filter_api rows", Array.isArray(d1.rows) && d1.rows.length >= 2, `rows=${d1.rows?.length}, res[0]=${d1.rows?.[0]?.res}`);
} catch (e) {
  assert("filter_api rows", false, e.message);
}

// 2. scanner_api (dipakai halaman scanner utama)
try {
  const d2 = await wlaScannerApi({ market: "sgp", fCol: "ai", limit: 15 });
  assert("scanner_api configs", d2 && d2.status === "success" && Array.isArray(d2.configs), `configs=${d2.configs?.length}, key0=${d2.configs?.[0]?.state?.rumus_key}`);
} catch (e) {
  assert("scanner_api configs", false, e.message);
}

// 3. days array handling (days[] per elemen) — "scanning" adalah respons valid
//    (scanner asli async; client poll sampai success — lihat page.js loop)
try {
  const d3 = await wlaScannerApi({ market: "sgp", fCol: "ai", limit: 15, days: ["1", "3"] });
  const okScan = (d3 && (d3.status === "success" || d3.status === "scanning")) && !d3.error;
  assert("scanner_api days[]", okScan, `status=${d3.status}`);
} catch (e) {
  assert("scanner_api days[]", false, e.message);
}
