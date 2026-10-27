# Genera la narracion frase por frase con edge-tts y mide cada duracion -> linea_tiempo.json
import asyncio, json, os, re, subprocess, sys
import edge_tts
sys.stdout.reconfigure(encoding="utf-8")
AQUI = os.path.dirname(os.path.abspath(__file__))
try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG = "ffmpeg"
G = json.load(open(os.path.join(AQUI, "guion.json"), encoding="utf-8"))
PAUSA_FRASE, PAUSA_ESCENA, INICIO, FINAL = 0.25, 0.6, 0.45, 1.1

def duracion(f):
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", f], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))

async def main():
    t, escenas = INICIO, []
    for ei, e in enumerate(G["escenas"]):
        ini, frases = t, []
        for fi, texto in enumerate(e["frases"]):
            f = os.path.join(AQUI, "voz", "%02d_%02d.mp3" % (ei, fi))
            for intento in range(8):
                if os.path.exists(f) and os.path.getsize(f) > 0:
                    break
                try:
                    await edge_tts.Communicate(texto, G["voz"], rate=G["rate"]).save(f)
                    await asyncio.sleep(1.5)
                except Exception as err:
                    if os.path.exists(f): os.remove(f)
                    print("  reintento", intento + 1, os.path.basename(f), type(err).__name__)
                    await asyncio.sleep(3 + 3 * intento)
            d = duracion(f)
            frases.append(dict(texto=texto, archivo=os.path.relpath(f, AQUI).replace(os.sep, "/"), ini=round(t, 3), fin=round(t + d, 3)))
            t += d + PAUSA_FRASE
        t += PAUSA_ESCENA - PAUSA_FRASE
        escenas.append(dict(id=e["id"], ini=round(ini - (INICIO if ei == 0 else 0), 3), fin=round(t, 3), frases=frases))
    escenas[-1]["fin"] = round(t + FINAL, 3)
    json.dump(dict(total=escenas[-1]["fin"], escenas=escenas), open(os.path.join(AQUI, "linea_tiempo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for e in escenas:
        print("%-12s %6.1f -> %6.1f  (%4.1fs)" % (e["id"], e["ini"], e["fin"], e["fin"] - e["ini"]))
    print("TOTAL %.1f s" % escenas[-1]["fin"])

asyncio.run(main())
