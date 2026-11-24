# Transformer Assembly — Nordic engineering-notebook redesign

## What's in the upload
- A working scroll-driven site: 195 pre-rendered frames (33 WebP sheets), 5 chapter stills (core, windings, active part, tank, complete), a 9 s MP4, plus HTML/CSS/JS.
- Blender/FFmpeg scripts that made the renders (these can't run here, so the existing renders stay as the 3D source).

## Direction: "Nordic engineer's notebook"
- **Paper, not studio grey:** warm off-white page (bone/linen), a faint 8 mm dot-grid like a drafting notebook, generous whitespace.
- **Ink + one accent:** deep graphite-blue ink, muted birch/stone greys, copper kept as the single accent (matches the windings).
- **Type:** a clean Scandinavian grotesk (e.g. "Inter Tight"-free choice: *Manrope* or *Space Grotesk* for headings) + *JetBrains Mono* for annotations, frame counter and spec values.
- **Drawing language:** thin hairline frames, corner registration marks, a title block in the lower right (like a technical drawing sheet: "Sheet 02/05 · Windings · Scale 1:20 · Rev 4").
- **Realism boost on the render:** renders blended into the paper with soft multiply + vignette mask, a subtle contact shadow under the machine, gentle grain overlay so the photo-real steel sits naturally on paper.
- **Callout annotations:** per chapter, 2–3 leader lines pointing at parts (e.g. "Laminated CRGO core", "HV bushing", "Radiator fins") with mono labels, fading in as each chapter arrives.

## Page structure
1. **Header strip:** wordmark + small line symbol, "Three-phase · Oil-filled" metadata, Overview link.
2. **Pinned assembly stage (scroll):** frame canvas centered; left column chapter number (01–05), heading, short notes; chapter index with copper ticks; bottom-right title block with frame slider.
3. **Spec sheet section:** notebook-style table (rating, voltage, cooling, mass — illustrative values) and a 5-step exploded parts list with thumbnails from the stills.
4. **Overview:** finished transformer image, "Back to the core" and "Play the video" (opens MP4 in a dialog).
5. Reduced-motion and mobile layouts kept from the original spec.

## Technical details
- Port to TanStack route `/` (React): canvas frame-sheet drawing, scroll → frame mapping, chapter thresholds (0/12/37/54/85%), slider + arrow keys, preloading, all from `assembly.js`.
- Upload all media via lovable-assets (pointer JSONs in `src/assets/`), no binaries in the repo.
- Design tokens in `src/styles.css` (oklch), fonts via `<link>` in root head, proper page head metadata.
- Verify with Playwright screenshots at several scroll positions, desktop + mobile.
