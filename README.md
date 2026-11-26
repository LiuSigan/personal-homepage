# siganliu.com

Black and white photographs by Liu Sigan. A static site: no build step.

## Adding a series

1. Make a folder in `photos/`, named in lowercase with hyphens, e.g. `photos/tokyo-2027/`. The folder name becomes
   the series' address: `siganliu.com/#tokyo-2027`.
2. Put the photographs in it (`01.jpg`, `02.jpg`, …), about 2000 px on the long side.
3. Add an entry to `photos.js` with the folder, the series name, and one line per photograph
   (`src`, `w`, `h`, `title`, `place`, optional `year`). The first entry is the series the site opens on.

Everything else follows from that list: the strip on the home page, the switch between series, the index,
the whole-sheet view and the full-screen viewer.

## Scans of prints

`tools/veil.py` removes the uneven grey veil that glare leaves on a copied print:

    python3 tools/veil.py in.jpg out.jpg 1          # remove the veil
    python3 tools/veil.py in.jpg out.jpg 1 fine     # also clear hard-edged glare in night skies
    python3 tools/veil.py in.jpg out.jpg 0.68       # and brighten (values below 1 brighten)

## Files

- `index.html`, `style.css` — page and styles
- `photos.js` — the list of series and photographs
- `script.js` — strip, index, sheet view, viewer
- `sketch.js` — the line drawings (cameras, darkroom sequence)
