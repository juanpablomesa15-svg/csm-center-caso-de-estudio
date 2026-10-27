# Cómo se arma el video

1. `python voz.py` — genera la narración frase por frase con edge-tts (voz `es-CO-GonzaloNeural`) y escribe `linea_tiempo.json` con el segundo exacto de cada frase.
2. `node render.cjs` — abre `escenas.html` con Playwright, dibuja cada cuadro a 30 fps con `render(t)`, lo codifica con ffmpeg y le pone la voz.
   - `node render.cjs --cuadros 10,55` saca cuadros sueltos en `revision/` para revisar el diseño.
   - Requiere `npm i playwright` y ffmpeg (variables `PLAYWRIGHT` y `FFMPEG` si no están en el PATH).

Las escenas se sincronizan con la voz: cada elemento declara en qué frase aparece (`data-s`) y con qué retraso (`data-d`).
Todos los datos que aparecen son ficticios.
