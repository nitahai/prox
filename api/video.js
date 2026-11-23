// Vercel Serverless Function — proxy video MP4 MovieBox
// Dipakai kalau <video> di browser tidak mau memutar URL MP4 langsung
// (CDN bcdnxw.hakunaymatata.com membalas 429/426 dari IP/browser tertentu,
// atau Referer halaman website ditolak).
// Cara pakai: {proxy}/api/video?url=<encodeURIComponent(url MP4)>
// Website memanggil endpoint ini sebagai src <video>, jadi request ke CDN
// dikirim dari server Vercel (bukan dari browser), dengan Referer filmboom.top
// seperti di aplikasi Android (loadDataWithBaseURL "https://filmboom.top/").
//
// Catatan: streaming video lewat serverless Vercel memakan bandwidth dan
// durasi function. Pakai hanya sebagai fallback kalau direct + iframe
// tidak jalan. Jangan dipakai untuk trailer (trailer dari macdn jalan direct).
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
    Referer: "https://filmboom.top/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
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
