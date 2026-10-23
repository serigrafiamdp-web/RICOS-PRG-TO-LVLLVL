# RICOS PRG TO LVLLVL — OIL'S WELL TEST01

Exportador de mapas de **Oil's Well (C64)** a un JSON con **8 frames** y tileset original, más **8 PRG estáticos**, mapas RAW y previsualización. Disponible como web sin backend (`index.html` y `app.js`) y herramienta CLI (`exporter.py`).

## Usar

1. Abrí `index.html` localmente o en GitHub Pages.
2. Seleccioná el `oils well.prg` COPY SOFT (original o derivado TEST03).
3. Navegá por los niveles 1–8, visualizá el mapa y el tileset y descargá el ZIP completo.
4. Extraé `LVLLVL/OILS_WELL_8_NIVELES.json`, con `tileSet`, `colorPalette` y `tileMap` de ocho frames en la estructura que usa **Export JSON nativo** en [jaammees/lvllvl](https://github.com/jaammees/lvllvl).

Alternativa CLI: `python exporter.py "oils well.prg" --output OILS_WELL_LVLLVL.zip`.

### Origen y estructura

- Cargador COPY SOFT: copia `$0900–$59FF` a `$8000–$D0FF`.
- Charset: `$9A00–$9DFF`, 128 tiles de 8×8 (exportación 256 con segunda mitad vacía).
- Mapas: `$A000–$BFFF`, 8 bloques consecutivos de 1024 B (40×25 = primeros 1000 B).
- Los índices de caracteres del juego **no se reordenan**.
- Cada JSON guarda los tiles pixel a pixel y el mapa editable. Un JSON combinado representa los ocho niveles en frames distintos.

### Limitaciones de TEST01

- Oil's Well alterna **bitmap hires** (`$D011=$3B`, `$D016=$08`) y **multicolor de caracteres** (`$D011=$1B`, `$D016=$18`) con raster. Un solo layer convencional de LVLLVL no puede reproducir ambos modos simultáneamente. El JSON conserva la parte de mapa de caracteres, no el fotograma completo rasterizado.
- **Color RAM real no extraída.** Se utiliza blanco temporal en el editor y en los PRG visualizadores; no afirmar equivalencia cromática.
- Los PRG son visores estáticos nuevos y **no** son el juego completo; no incorporan sprites, enemigos o el raster original.
- El layout JSON se ha contrastado con código fuente del exportador de jaammees/lvllvl, pero aún falta probar la importación en la interfaz real del editor y la ejecución de los visores en VICE.
- Esta versión analiza **Oil's Well COPY SOFT**, no cualquier PRG C64.

No se sube el juego ni sus datos propietarios al repositorio: solo el código del exportador. El usuario proporciona su PRG localmente.

## TEST03 - Colores originales por nivel (2026-10-23)

Los colores ya NO son grises provisionales: se extraen del PRG original, desde tablas ASM:

- `$963D + 4*nivel` -> `$D020`, `$D021`, `$D022`, `$D023`, paleta de cada nivel.
- `$965D + 4*nivel` -> colores de sprite y bandas de Color RAM (primeras 7 filas / últimas 18 filas).
- `$967D + 4*nivel` -> excepciones de color RAM para elementos decorativos.

El `JSON` utiliza un frame por nivel, cada uno con su propia paleta, y conserva el mismo charset y los mismos índices de mapa del TEST02.

Los `BIN/*_COLOR_RAM_ORIGINAL_ESTATICO.bin` tienen 1000 bytes por nivel. No incluyen las modificaciones dinámicas de Color RAM durante el juego. Las imágenes PRG estáticas anteriores no implementan el raster split real entre bitmap hires y mapa multicolor. No se pretende reconstruirlo dentro de una capa LVLLVL.

Para comprobar la corrección visual en el editor, usar `LVLLVL/OILS_WELL_8_NIVELES.json` y elegir `c64multicolor`.


## TEST04 — Conversor genérico experimental (2026-10-23)

Nueva página independiente: [generic.html](./generic.html). El conversor especializado para Oil's Well en index.html permanece sin modificaciones funcionales.

- PRG C64 estándar: respeta sus dos bytes de dirección de carga y **no ejecuta código**.
- RAM completa de 65536 bytes (BIN): explora el espacio $0000–$FFFF.
- BIN parcial: requiere especificar una dirección de carga.
- BIN externos opcionales: charset de 1024/2048 bytes, mapa de 1000/1024 bytes, Color RAM de 1000/1024 bytes.
- Búsqueda heurística de charsets de 2048 bytes alineados en $0800 y mapas de 1000 bytes alineados en $0400.
- Preview real de bytes elegidos (C64 hires y multicolor carácter), selección manual de direcciones; pantalla 40×25, tileset 256 glifos.
- Acumula pantallas en frames separados, manteniendo un **charset compartido** para el proyecto; exporta JSON nativo LVLLVL y ZIP con datos RAW.
- Los colores VIC ($D020–$D023) se configuran por frame. Sin Color RAM BIN, los colores del frame son **provisionales**.

### Importante

Un PRG genérico puede ser solo un cargador, estar comprimido, usar sprites, bitmap, niveles generados o almacenar datos en direcciones no alineadas. TEST04 **no** reconstruye automáticamente esos casos ni sabe qué candidatos pertenecen al juego. Para muchos títulos será necesario obtener un dump de memoria **durante la partida**, aportar BIN separados o construir un extractor específico. El JSON no reconstruye código, físicas ni colisiones. Tampoco se generan visores PRG genéricos: crear uno requiere conocer el modo VIC, bancos y ubicación válida de cada recurso en memoria.

### Pruebas iniciales

Probado con PRG sintético que contiene una pantalla a $2000 y un charset a $2800, verificando selección, exportación de un frame, indices 0–255 y multicolor de celdas fc=9. Pendiente de validar visualmente con títulos reales en LVLLVL.
