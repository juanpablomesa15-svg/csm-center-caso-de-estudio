// Renderiza el video cuadro a cuadro: escenas.html + linea_tiempo.json -> video.mp4 (con la voz)
// Uso: node render.cjs                -> video completo
//      node render.cjs --cuadros 5,40  -> solo PNG sueltos en revision/ (segundos)
const path = require("path"), fs = require("fs");
const { spawn, execFileSync } = require("child_process");
const { pathToFileURL } = require("url");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright"); // npm i playwright
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FPS = 30, AQUI = __dirname;
const LT = JSON.parse(fs.readFileSync(path.join(AQUI, "linea_tiempo.json"), "utf8"));

(async () => {
  const arg = process.argv.indexOf("--cuadros");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(AQUI, "escenas.html")).href);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((lt) => window.cargar(lt), LT);
  if (arg > 0) {
    fs.mkdirSync(path.join(AQUI, "revision"), { recursive: true });
    for (const s of process.argv[arg + 1].split(",").map(Number)) {
      await page.evaluate((t) => window.render(t), s);
      if (process.env.SIN_SUB) await page.evaluate(() => (document.getElementById("sub").style.opacity = 0));
      await page.screenshot({ path: path.join(AQUI, "revision", `t${String(s).padStart(5, "0")}.png`) });
    }
    await browser.close(); return;
  }
  const n = Math.ceil(LT.total * FPS);
  const sinAudio = path.join(AQUI, "_video_sin_audio.mp4");
  const ff = spawn(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", sinAudio]);
  let err = ""; ff.stderr.on("data", (d) => (err += d));
  const fin = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg " + c + " " + err)))));
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    const buf = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 300 === 0) console.log(`cuadro ${i}/${n} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await fin; await browser.close();
  // pista de voz: cada frase en su segundo
  const frases = LT.escenas.flatMap((e) => e.frases);
  const ins = frases.flatMap((f) => ["-i", path.join(AQUI, f.archivo)]);
  const filt = frases.map((f, i) => `[${i}:a]adelay=${Math.round(f.ini * 1000)}|${Math.round(f.ini * 1000)}[a${i}]`).join(";")
    + ";" + frases.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${frases.length}:normalize=0,apad=whole_dur=${LT.total}[voz]`;
  const voz = path.join(AQUI, "_voz.m4a");
  execFileSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...ins, "-filter_complex", filt, "-map", "[voz]", "-t", String(LT.total), "-c:a", "aac", "-b:a", "192k", voz]);
  const final = path.join(AQUI, "csm-center-por-dentro.mp4");
  execFileSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", sinAudio, "-i", voz, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy",
    "-shortest", "-movflags", "+faststart", final]);
  console.log("listo:", final, ((Date.now() - t0) / 1000).toFixed(0) + "s");
})().catch((e) => { console.error(e); process.exit(1); });
