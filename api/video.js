// Vercel Serverless Function — proxy video MP4 MovieBox
// Dipakai kalau <video> di browser tidak mau memutar URL MP4 langsung.
// HASIL INSPECT USER 2026-11-24 (dari HP-nya, Brave Android, berhasil 206):
// request video yang JALAN mengirim Referer + Origin https://themoviebox.xyz/
// (BUKAN filmboom.top, BUKAN mzfi.me, BUKAN tanpa Referer), sec-fetch-mode
// cors, sec-fetch-dest video, sec-fetch-site cross-site, Range bytes=0-,
// dan CDN membalas 206 Partial Content + access-control-allow-origin: *.
// Tes dari server (IP datacenter) dengan Referer yang sama ke URL yang
// sign-nya diterbitkan untuk IP HP user tetap dibalas 426 — jadi sign di URL
// terikat IP yang meminta play. Karena itu proxy ini HARUS dipakai berpasangan
// dengan /api/play dari Vercel yang sama: sign diterbitkan untuk IP Vercel,
// lalu video diambil dari IP Vercel yang sama, dengan Referer themoviebox.xyz.
// Cara pakai: {proxy}/api/video?url=<encodeURIComponent(url MP4)>
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    return res.status(204).end();
  }

  const raw = req.query.url || "";
  if (!raw || !/^https:\/\/bcdnxw\.hakunaymatata\.com\//.test(raw)) {
    return res.status(400).json({ code: 400, message: "url harus MP4 bcdnxw.hakunaymatata.com" });
  }

  const headers = {
    // Referer + Origin persis seperti request yang jalan di HP user (inspect 2026-11-24)
    Referer: "https://themoviebox.xyz/",
    Origin: "https://themoviebox.xyz",
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36",
    Accept: "*/*",
    "Accept-Encoding": "identity",
    "Accept-Language": "id-ID,id;q=0.5",
    "Sec-Fetch-Dest": "video",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
  };
  // Teruskan Range supaya seek di video tetap jalan
  if (req.headers.range) headers.Range = req.headers.range;

  const upstream = await fetch(raw, { headers });
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Accept-Ranges", "bytes");
  const ct = upstream.headers.get("content-type");
  if (ct) res.setHeader("Content-Type", ct);
  const cl = upstream.headers.get("content-length");
  if (cl) res.setHeader("Content-Length", cl);
  const cr = upstream.headers.get("content-range");
  if (cr) res.setHeader("Content-Range", cr);
  res.status(upstream.status);
  if (!upstream.body) return res.end();
  // Node 18+ di Vercel: upstream.body adalah web ReadableStream
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return res.end();
}
