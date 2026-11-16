# Internal design record: vintage paperback redesign

Date: 16 November 2026  
Project: Aditya Sarangi's personal website  
Status: Implemented locally; not committed or published as part of this redesign

This document records the implemented changes, their rationale, compromises, and verification limits. It is for the owner's internal records. It has no Jekyll front matter, is explicitly excluded in `_config.yml`, and is not referenced by website navigation, templates, or content. The exclusion prevents it from being copied or rendered into the normal Jekyll website output; it does not make the source file private if the Git repository itself is public.

## 1. Brief and starting point

The request was to inspect the book-cover images in `Documents/Cover Images` and redesign the website around their visual language.

The starting point was commit `c4af0f4`, dated 16 November 2026, with the message “changes in the layout.” That version used a newspaper-like composition: an oversized serif nameplate, an editorial article grid, illustrations, an About section, and light/dark themes.

The redesign retained the existing Jekyll site, article content, category structure, contact destinations, and theme-switching behavior. It changed the public journal's visual system across the homepage, category pages, and article pages. It did not migrate hosting, add a framework, change post permalinks, or publish a deployment.

## 2. Reference material and interpretation

All eight PNG screenshots in `Documents/Cover Images` were viewed. The visible covers were:

| Cover | Visual qualities that informed the design |
| --- | --- |
| *Sir Francis Drake* — James A. Williamson | Strong sans-serif hierarchy, warm red lettering, and adjacent blue and pink panels. |
| *The Physics of Television* — Donald G. Fink and David M. Lutyens | A circular series badge, generous paper-colored space, and simple repeated geometry. |
| *Of Love and Lust* — Theodor Reik | Tall condensed capitals, black/red contrast, overlapping circular outlines, and one strong red disc. |
| *The Haunting Melody* — Theodor Reik | Condensed titles, an italic serif subtitle, and repeated flowing black lines. |
| *Quantum Electronics* — John R. Pierce | Mustard ground, compact black typography, blue semicircles, a red center, and circuit-like connections. |
| *Psychoanalysis and Contemporary Thought* — edited by John D. Sutherland | Stacked condensed type, blue/green fields, and irregular black bars. |
| *Opium* — Jean Cocteau | Adjacent blue and green fields, expressive line work, and serif/italic contrast. |
| *Turgenev's Literary Reminiscences* | Large blue fields, restrained serif typography, and dark graphic imagery. |

The chosen direction was a coherent vintage paperback collection rather than a separate imitation of each cover. The strongest recurring elements were cream paper, compressed display lettering, modest publishing-style labels, limited ink colors, and abstract line art.

### Reference-use decision

The screenshots remain references in Documents. They were not copied into the website or used as article thumbnails. Four original SVG assets were created in code. The graphics deliberately echo the references' circles, flowing lines, and circuit vocabulary, but do not reproduce their book titles, publisher marks, or scanned illustrations.

**Tradeoff:** the result carries the visual family of the covers without their actual worn edges, illustrations, or exact historical typography. It is cleaner and more repeatable across screens, but less like a literal scanned paperback.

## 3. Overall design concept

The website is treated as an ongoing personal collection of essays and notes. The homepage acts as a front cover and table of contents; article links look like individual paperbacks; category pages act as shelves; article pages open with a cover-like title panel before the reading text.

The author remains identifiable through the header, introduction, article bylines, and About section. The main homepage headline became “A curious state of mind.” This makes curiosity the organizing theme, while the name sits in a compact publisher-like identity rather than occupying the entire masthead.

**Tradeoff:** the introduction communicates personality more strongly, but the author's name is less visually dominant than in the previous newspaper layout. The large cover treatment also pushes the first article farther down the initial viewport, especially on phones.

## 4. Typography

The previous Inter/Newsreader pairing was replaced with:

- **Oswald, weights 400, 500, and 600:** display titles, article-cover titles, major section headings, and the author identity.
- **Libre Baskerville, regular, bold, and italic:** article body text, introductory prose, descriptions, and italic author notes.
- **Arial/Helvetica/system sans-serif:** navigation, metadata, small labels, and controls.

Oswald supplies the tall, compressed look of the Reik and science-paperback references. Libre Baskerville supplies a quieter book-reading texture and the italic contrast visible on several covers. Small interface text uses a familiar sans-serif for clarity.

Headlines frequently use uppercase; the NVIDIA article retains its written casing in its mustard cover treatment. Reading text stays in normal sentence case. Display sizes scale through `clamp()` and responsive rules.

**Tradeoffs:**

- Condensed type provides strong character and allows large titles within narrow spaces, but extensive uppercase text can be less comfortable to scan. Its use is concentrated in headings and labels.
- Serif body copy reinforces the book analogy, but has a different reading texture from the previous sans-serif interface. Article text is constrained to a readable column rather than spanning the entire page.
- Fonts are requested from Google Fonts with `display=swap`. This keeps initial text visible, but depends on an external service and can introduce a visual shift as fonts load. Local fallbacks are defined; exact font metrics are not guaranteed when Google Fonts is unavailable.
- Some publishing-style labels are intentionally small. They serve supporting metadata rather than the primary reading content; their small scale remains a usability compromise.

## 5. Color, surface, and dark mode

The light palette uses these principal CSS variables:

| Role | Value | Purpose |
| --- | --- | --- |
| Paper | `#eeeade` | Warm page background. |
| Ink | `#25261f` | Soft near-black type and rules. |
| Muted text | `#626259` | Secondary labels. |
| Accent | `#af3926` | Rust-red emphasis and links on hover. |
| Rules | `#b5b3a5` | Thin borders and separators. |
| Wash | `#e5e1d3` | Quiet inset areas and empty states. |
| Pale cover | `#e0e5dc` | Cool paper tone for the flowing-line cover. |
| Mustard | `#d8b65c` | Science-paperback-inspired cover. |

Additional blue, green, pink, and red colors appear in the original SVGs and category panels. These are chosen for the paperback mood rather than sampled as exact matches to the screenshots.

A small SVG turbulence texture adds a restrained grain overlay. It is fixed over the page, low opacity, and `pointer-events: none`, so it does not intercept clicks. Thin vertical lines on the hero and article covers suggest a spine or fold without adding a realistic 3D book effect.

Dark mode uses a deep green-black page (`#222720`), warm light text (`#e9e5d5`), and a softer peach accent (`#f19b7e`). The colored covers remain relatively light, with dark text, and receive slightly muted paper/mustard values. They are treated as printed objects on a dark surrounding surface.

The existing theme preference continues to persist in local storage. Storage access is protected by `try/catch`; if storage is unavailable, the theme can still be switched for the current page. The default remains light when there is no saved dark preference.

**Tradeoffs:**

- The palette is deliberately muted, so it has less brightness than some original blue and red cover inks.
- Keeping colored covers light preserves their identity, but dark mode is not an entirely low-luminance interface.
- A texture overlay adds a print impression at low asset cost, but can increase painting/compositing work. It is decorative, not needed to understand content.
- No comprehensive contrast audit was run. Readability was visually inspected, but this is not an accessibility conformance claim.

## 6. Header and footer

The previous large centered nameplate was replaced by a compact identity at the left: a simple outlined oval containing an “as” monogram, followed by “Aditya Sarangi” and “A personal journal.” The monogram is original, not a copy of a reference publisher logo.

The header retains Writing, Rabbit holes, Music, Collections, and About navigation, plus the theme toggle. Category links retain `aria-current="page"` for the active category. On small screens, navigation moves below the identity; the theme control keeps its icon and accessible label while its visible Light/Dark text is hidden.

The footer retains the name, email, Twitter, LinkedIn, and copyright year. Its new closing line is “End of this page. Beginning of another thought.”

**Tradeoff:** the compact header gives the designed front cover more room, but the overall navigation remains understated. No mobile hamburger menu was added because the five existing destinations fit in a wrapping navigation row.

## 7. Homepage composition

### Front cover

The homepage begins with a bordered cover containing:

- An author identification line.
- The oversized “A curious state of mind.” headline, with “mind.” accented in red.
- A circular “Ideas & other curiosities” badge.
- A short explanation of the journal.
- An “Open the notebook” anchor leading to the writing section.
- An original blue/green/pink strip with overlapping circles and a red disc.
- Small colophon-like labels: “An ongoing collection” and “Read slowly. Stay curious.”

The badge and decorative illustration do not contain essential navigation. Decorative graphics are hidden from assistive technology through empty alternative text or `aria-hidden` as appropriate.

### Selected writing

The article list was rebuilt as two paperback-like covers on desktop, stacked on mobile. Each cover includes a category, a sequence number, title, author, artwork, and a small footer line. The full cover is a link to the article. The publication date and description sit below it.

The label “Selected writing” is editorial wording: the implementation still loops over **all** `site.posts`, in the order supplied by Jekyll. It does not currently filter a curated subset.

**Tradeoffs:**

- Large covers give each essay identity and a generous click target, but show fewer articles at once than a compact list.
- Dates and descriptions sit outside the graphic cover to keep the cover composition clear, but require a second visual step to read.
- Sequence numbers are generated from each loop's position. They are not permanent article IDs, may change when posts are added, and can differ between a category listing and the homepage.
- The two-digit number formatting is suitable for the present small collection; it would need revision for a larger archive where numbers exceed 99.

### Follow a thread

The three categories appear in a continuous strip of blue-gray, dusty pink, and sage panels. Rabbit holes uses overlapping rings, Music uses flowing lines, and Collections uses slanted bars. Each entire panel is clickable and includes a short description.

The panels stack on mobile, with their motifs moving beside the copy. This preserves the motifs without forcing three narrow columns.

### About

The About section now has a three-part desktop layout: large “Always a little curious.” lettering, the existing biographical paragraphs, and the existing portrait. The portrait uses grayscale with a slight sepia effect. An italic name and portrait caption extend the paperback-author-page tone.

The biography and contact email were preserved. On phones, the heading and photograph sit beside one another, with the prose below.

## 8. Article covers and graphics

Four assets were added:

| Asset | Role |
| --- | --- |
| `assets/curiosity.svg` | Homepage color strip, overlapping circles, and red disc. |
| `assets/circuits.svg` | Circuit paths, blue semicircles, red center, and connection nodes for the mustard cover. |
| `assets/melody.svg` | Repeated flowing lines and a red disc for the pale cover and music motif. |
| `assets/paper-grain.svg` | Subtle repeated surface texture. |

The NVIDIA essay receives `cover_art: circuits`; the Mile Sur essay receives `cover_art: melody`. The assignments reflect their technology and music subjects even though both posts remain in the existing Rabbit holes category.

The shared card defaults to `circuits` when a future post has no `cover_art` value. Article headers use the same default and artwork selection.

**Tradeoffs:**

- SVGs are compact, scalable, and editable without image-generation or raster-processing dependencies, but they are visibly cleaner than old printed illustrations.
- Only two article-cover treatments were created. This is sufficient for the current two essays; a larger archive will repeat them unless more variants are added.
- A custom `cover_art` value must have a matching SVG, and a new visual treatment may also need CSS. There is no automatic validation of arbitrary future values.
- The two older `editorial-0.svg` and `editorial-1.svg` assets were retained in the repository. The redesigned pages no longer reference them; they were not deleted as part of this work.

## 9. Category pages

A new `_layouts/category.html` consolidates the repeated category-page markup. The three category files now provide metadata and their introductory paragraph, while the layout provides:

- A chapter label and large title.
- Category-specific geometry and a colored lower border.
- A link back to the reading room.
- An “On the shelf” heading and entry count.
- The same article-card include used by the homepage.
- A designed empty state when the category contains no posts.

The current Music and Collections empty states say that the collection is still taking shape and link to the existing writing. No placeholder articles were invented.

Rabbit holes introductory copy was lightly edited to correct “curiousity” and simplify its phrasing. Article body text was not rewritten.

**Tradeoff:** a shared layout reduces duplication and keeps the three categories consistent, but their layouts are less individually distinct. Differences come from their text, motif, and accent rather than separate bespoke pages.

## 10. Article reading pages

Each post now has a back link to the reading room and a cover-colored title panel with category, title, optional description, author, date, and cropped decorative art. The body follows in a centered column with a maximum width of 680 pixels.

Typography and spacing were updated for paragraphs, subheadings, blockquotes, code blocks, tables, and images. Wide code and table content can scroll within their containers. The footer retains All writing and Reply by email links.

**Tradeoffs:**

- A cover-like introduction makes articles feel part of the same collection, but adds vertical space before the first paragraph.
- The header illustration is cropped into a short strip rather than shown in full. This carries the cover identity without making the reader scroll past an entire book cover.
- The reading layout supports common rich-content elements, but the current articles do not exercise every possible table, code block, or embedded-media case.

## 11. Responsive behavior and interaction

The main wrapper is capped at 1160 pixels, with reduced side margins at narrower widths. There are responsive adjustments at 1000 and 700 pixels:

- Header navigation wraps below the author identity on phones.
- The hero's side note moves under the title.
- Article covers change from two columns to one.
- Category panels stack.
- About content rearranges into a compact heading/photo row and a full-width prose block.
- Category cover graphics move below their text when necessary.
- Article title and body sizes reduce for phone screens.

Hover effects are restrained: covers lift and rotate slightly, and category arrows shift a few pixels. These effects are decorative; links work without hover. `prefers-reduced-motion` disables transitions and smooth scrolling.

A print stylesheet removes navigation and decorative page chrome and simplifies article colors and spacing.

**Tradeoffs:**

- The mobile experience is a long vertical reading sequence rather than a dense overview.
- Hover rotation creates a small physical-book suggestion, but is deliberately absent for reduced-motion preferences.
- A basic print stylesheet exists, but printed page breaks and long-document pagination were not visually tested.

## 12. Accessibility and semantic decisions

The existing skip-to-content link remains. Main sections have headings and accessible names. Every checked rendered page has one H1. Navigation landmarks, visible keyboard focus outlines, active-category state, and theme-button accessible labels remain in place.

Decorative art has empty alternative text; the author photograph retains meaningful alternative text. Article dates use `time` elements in the card list. Cards and category panels are normal links, not JavaScript click handlers.

**Limits:** this was not a full screen-reader, keyboard-navigation, contrast, or touch-target audit. Some supporting labels and navigation links remain small. Automated checks established structural facts and responsive fit, not comprehensive accessibility compliance.

## 13. Implementation and file inventory

| File | Change |
| --- | --- |
| `index.html` | Rebuilt the introduction, article listing, category strip, and About composition. |
| `styles.css` | Replaced the previous editorial styling with the paperback design system, responsive rules, dark palette, and print treatment. |
| `_layouts/default.html` | Changed fonts and author identity; updated header/footer styling hooks and internal URL filters; preserved theme logic and metadata. |
| `_layouts/post.html` | Added the reading-room back link, cover treatment, and selected illustration. |
| `_layouts/category.html` | Added a shared category-page layout and empty states. |
| `_includes/book-card.html` | Added the reusable article-cover card. |
| `rabbit-holes.html` | Switched to category metadata/layout; lightly edited the introductory copy. |
| `music.html` | Switched to category metadata/layout. |
| `collections.html` | Switched to category metadata/layout. |
| `_posts/2026-05-09-sample-post.md` | Added `cover_art: melody`; retained article body and other metadata. |
| `_posts/2026-11-12-the-fault-in-nvidias-cores.md` | Added `cover_art: circuits`; retained article body and other metadata. |
| `assets/curiosity.svg` | Added homepage artwork. |
| `assets/circuits.svg` | Added technology-cover artwork. |
| `assets/melody.svg` | Added flowing-line artwork. |
| `assets/paper-grain.svg` | Added decorative texture. |

No application framework, client-side package dependency, search system, CMS, or new interactive feature was added. Existing Jekyll routing and categories remain in place. Internal HTML links and image references generally use `relative_url`. The CSS texture and music-motif URLs still use root-relative `/assets/...` paths, which match the present root-domain setup but would need attention if the website moved beneath a subpath.

The standalone `bio_data.html` print document, legacy Food content, and other unrelated repository artifacts were not redesigned. The scope was the connected public journal pages and their shared layouts.

### Internal-record-only additions

After the redesign, this file was added at the owner's request. `_config.yml` was updated to exclude `DESIGN_RECORD_2026-11-16.md` from generated output. No page or template links to this record. This configuration change is for keeping the record out of the website, not for changing its design.

## 14. Verification performed

### Source checks

- `git diff --check` passed after the redesign.
- All SVG files parsed successfully as XML.
- Edited template delimiter counts were checked for balance. This is a limited syntax sanity check, not a full Liquid validation.

### Temporary rendered preview

Jekyll was not installed locally. An attempted temporary installation failed while fetching dependencies from RubyGems because the host could not be resolved. A full Jekyll production build was therefore **not completed**.

For visual and interaction checks, LiquidJS and Markdown-It were installed in a temporary directory outside the repository. A temporary renderer processed the homepage, three category pages, and two article pages. Its Jekyll include syntax was adapted only in the temporary rendering setup. The project source continues to use Jekyll's normal include syntax.

This preview is useful evidence for layout and interaction, but is not equivalent to a build with Jekyll's exact Liquid implementation, Markdown configuration, plugins, and deployment settings.

### Browser checks

The six preview pages were checked at widths of **1440, 390, and 320 pixels**, for 18 route/width combinations. Checks passed for:

- No document-level horizontal overflow.
- Exactly one H1 per rendered page.
- No broken images.
- No visible unprocessed Liquid tag opening delimiters in page text.
- The requested display font loading during the checks.

Dark-mode switching updated the document theme and button pressed state. Reloading preserved the selected dark theme.

A separate check validated **79 local links, image references, stylesheet references, and fragment targets** across the six preview pages. This check used the temporary rendered output. External destinations were not checked for availability.

Desktop/mobile homepage screenshots, a dark homepage screenshot, and a mobile article screenshot were visually inspected. No overlapping content or clipping requiring a correction was observed in those inspected captures.

### Preview records

At completion, temporary screenshots were available at:

- `/private/tmp/personalwebsite-preview/home-1440.png`
- `/private/tmp/personalwebsite-preview/home-390.png`
- `/private/tmp/personalwebsite-preview/home-320.png`
- `/private/tmp/personalwebsite-preview/home-dark.png`
- `/private/tmp/personalwebsite-preview/article-390.png`

These are temporary local files, not committed project assets, and may be removed by system cleanup. The temporary server and headless browser were stopped after verification.

## 15. Remaining limitations and future considerations

1. Run the actual Jekyll build before publishing to verify the exact template engine, plugins, generated routes, and output exclusions.
2. The work was inspected in one Chromium-based headless browser. Safari, Firefox, and physical-device behavior were not tested.
3. A larger writing archive may need a compact archive view, pagination, more cover variants, and durable numbering. None was added for the present two-post collection.
4. External font loading remains a dependency. Self-hosting the selected fonts would give more control over availability and caching, at the cost of maintaining font files.
5. The dark palette intentionally retains light cover objects. A uniformly dim alternative would require revisiting the illustrations and their contrast.
6. The display of missing categories and the new include should be confirmed in the real Jekyll build, even though the temporary preview rendered the current empty states successfully.
7. The internal record is excluded from normal Jekyll output, but a public repository or a hosting process that serves raw source files could still expose it. No repository visibility or hosting-policy change was made.

## 16. Completion state

The redesign is implemented as local source changes. It has not been committed, pushed, or published as part of this work. Its core visual direction is a warm, graphic paperback collection: condensed headlines, serif reading text, original abstract artwork, and consistent cover treatments across the homepage, categories, and essays.
