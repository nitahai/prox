// Vercel Serverless Function — proxy API play MovieBox
// Alternatif kalau Cloudflare Worker kena 429: IP egress Vercel (AWS)
// beda dengan IP Cloudflare, jadi kemungkinan tidak dibatasi upstream.
// Deploy: buat repo GitHub berisi folder ini (api/play.js + vercel.json),
// import di vercel.com → Deploy. URL: https://<nama>.vercel.app/api/play?...
// Lalu di website nonton, Pengaturan > URL Proxy > tempel URL itu
// (tanpa /api/play, cukup https://<nama>.vercel.app) — website akan
// memanggil {proxy}/api/play?... sama seperti Worker.
//
// Query: ?subjectId=...&detailPath=...&type=movie|tv&se=0&ep=0
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  const { subjectId = "", detailPath = "", type = "movie", se, ep } = req.query;
  if (!subjectId || !detailPath) {
    return res.status(400).json({ code: 400, message: "subjectId dan detailPath wajib diisi" });
  }
  const isTv = String(type).toLowerCase() === "tv";
  const season = se ?? (isTv ? "1" : "0");
  const episode = ep ?? (isTv ? "1" : "0");
  const host = isTv ? "themoviebox.org" : "mzfi.me";
  const referer =
    `https://mzfi.me/spa/videoPlayPage/movies/${detailPath}` +
    `?id=${subjectId}&type=/movie/detail&detailSe=&detailEp=&lang=id`;
  const upstream =
    `https://${host}/wefeed-h5api-bff/subject/play` +
    `?subjectId=${encodeURIComponent(subjectId)}` +
    `&se=${encodeURIComponent(season)}&ep=${encodeURIComponent(episode)}` +
    `&detailPath=${encodeURIComponent(detailPath)}`;

  const upstreamRes = await fetch(upstream, {
    headers: {
      Referer: referer,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  const text = await upstreamRes.text();
  res.setHeader("Content-Type", "application/json");
  return res.status(upstreamRes.status).send(text);
}
