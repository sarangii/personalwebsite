# Transformer Website - Complete Source

The complete 12-month transformer manufacturing website, including the code, all rendered assets, monthly content, research references, the editable Blender model and asset-generation scripts.

## Open the website locally

1. Extract this ZIP.
2. Open Terminal in the extracted `Transformer_Website` folder.
3. Run:

```sh
python3 serve.py
```

4. Open **http://127.0.0.1:8000/** in your browser.

On Windows, use `py serve.py` if `python3` is not available. Use `python3 serve.py --port 8080` if port 8000 is occupied.

Use a local HTTP server rather than opening index.html by double-clicking: the website loads its monthly content and frame manifest with fetch.

No npm installation or build step is required. Python 3 is only used for the local preview server. Any static web server can serve the `dist` folder.

## Files

- `dist/index.html`: the complete page structure, monthly milestone table and source links.
- `dist/timeline.css`: desktop, mobile, reduced-motion and print styling.
- `dist/timeline.js`: scrolling, month selection, playback, loading, annotations and research dialogs.
- `dist/assets/timeline/months.json`: 12 milestones and primary-source references.
- `dist/assets/timeline/manifest.json`: 93 timeline positions referencing 50 distinct rendered images.
- `dist/assets/timeline/*.webp`: all visual assets needed to run the site.
- `RESEARCH.md`: process research, schedule assumptions and references.
- `tools/transformer-timeline.blend`: editable Blender source model.
- `tools/render_timeline.py`: model and rendered-sequence generator.
- `tools/write_timeline_content.py`: monthly content and table-fragment generator.
- `serve.py`: local preview server.

## Edit the website

Change layout and static wording in `dist/index.html`, styling in `dist/timeline.css`, and interaction behaviour in `dist/timeline.js`.

To change the dynamic monthly wording, edit `dist/assets/timeline/months.json`. Keep the matching fallback table in `dist/index.html` in sync. The optional content generator in `tools` writes the JSON and `tools/months-table.html`; it does not rewrite the assembled page automatically.

The current brand is **FORM Power Systems**, an illustrative identity. Replace the wordmark and site title with your company identity as needed.

## Regenerate the model images (optional)

Existing rendered images are included, so Blender is not required to run or edit the website.

The source was generated using Blender 4.3.2. Asset regeneration requires Blender with Python and Pillow available to its Python environment. From this folder:

```sh
blender -b -t 8 --python tools/render_timeline.py -- render workbench
```

The script skips image files that already exist. To regenerate changed geometry, first move the old `build-*.webp` renders out of `dist/assets/timeline`; keep a backup if desired. The renderer then writes a new manifest and source model.

```sh
python3 tools/write_timeline_content.py
```

The website uses pre-rendered images and does not require WebGL. It requests an optional Google Fonts stylesheet; system-font fallbacks are provided.

## Publish

Upload the **contents of `dist`** to a static website host. `index.html` must be at the public root, with the relative CSS, JavaScript and `assets` paths preserved. No original hosting account, credentials or project identity are required.

## Content basis

The physical manufacturing order is source-based. Assigning events to months 1-12 is an illustrative editorial project programme, not a promised supplier lead time or a claim that each operation takes one month. Tank manufacture, sourcing and engineering overlap.

The model is an educational three-phase oil-immersed transformer reconstruction. Dimensions, lamination count, conductor turns and some accessories are simplified. No real customer, capacity, certification or measured product-performance claims are included.
