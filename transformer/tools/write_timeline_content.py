from pathlib import Path
import json, html, re

root = Path(__file__).resolve().parents[1]
sources = {
    'steel': {
        'label': 'thyssenkrupp · Grain-oriented electrical steel',
        'url': 'https://www.thyssenkrupp-steel.com/en/products/electrical-steel/electrical-steel-grain-oriented/electrical-steel-grain-oriented.html',
        'note': 'Core material, lamination losses and insulating coatings.'
    },
    'mill': {
        'label': 'thyssenkrupp · Electrical-steel product declaration',
        'url': 'https://www.thyssenkrupp-steel.com/media/content_1/publikationen/epd/thyssenkrupp_epd_grain_oriented_electrical_steel_en_steel.pdf',
        'note': 'Steel-mill rolling, annealing, coating and slitting; these supplier operations precede transformer assembly.'
    },
    'core': {
        'label': 'Hitachi Energy · Core-type transformers',
        'url': 'https://www.hitachienergy.com/in/en/products-and-solutions/transformers/power-transformers/generator-step-up-transformers-gsu/core-type-transformers',
        'note': 'Grain-oriented steel core and cylindrical copper windings.'
    },
    'process': {
        'label': 'Siemens Energy · Manufacturing step by step',
        'url': 'https://arpa-e.energy.gov/sites/default/files/2026-02/Eugen%20Starschich%20and%20Eduardo%20GH%20-%20cleared%20for%20posting.pdf',
        'note': 'Page 7: winding and core streams, active-part drying, final assembly, oil filling and factory acceptance testing.'
    },
    'factory': {
        'label': 'ATS Trafo · Production processes',
        'url': 'https://atstrafo.com/en/production-processes/',
        'note': 'Conductors, solid insulation, tank fabrication, vacuum drying and oil filling.'
    },
    'doe': {
        'label': 'US DOE · Large power transformer study',
        'url': 'https://www.energy.gov/sites/prod/files/Large%20Power%20Transformer%20Study%20-%20June%202012_0.pdf',
        'note': 'Pages 8–10: dependencies, parallel tank production, drying and assembly. Historical process reference; its old lead-time figures are not used as current estimates.'
    },
    'schedule': {
        'label': 'US DOE · Transformer resilience report, 2024',
        'url': 'https://www.energy.gov/sites/default/files/2024-10/EXEC-2022-001242%20-%20Large%20Power%20Transformer%20Resilience%20Report%20signed%20by%20Secretary%20Granholm%20on%207-10-24.pdf',
        'note': 'Customisation and supply constraints affect project lead time; a fixed 12 months is an illustrative project programme, not an industry-wide rule.'
    },
    'india': {
        'label': 'SEBI-hosted manufacturer filing · Production flow',
        'url': 'https://www.sebi.gov.in/sebi_data/attachdocs/jan-2025/1736148610420_633.pdf',
        'note': 'Printed pages 210–212: core/winding assembly, drying, parallel tank fabrication, tanking, testing and inspection.'
    }
}

# Dates are an editorial 12-month project scenario, not published manufacturer durations.
rows = [
    ('THE STEEL', 'Start with Goss-textured steel.',
     'Cold-rolled 3.2% silicon steel is box-annealed into a directional Goss crystal lattice (0.23 mm), coated with a 2–5 µm phosphate glass film, and certified for core-loss grade.',
     'Certified CRGO master coil', '3.2% Si Goss-textured strip',
     'Electromagnetic design freeze and long-lead procurement.', ['steel', 'mill', 'core']),
    ('THE CORE', 'Slit and shear 45° mitered plates.',
     'Rotary cutters slit the master coil into stepped widths before CNC lines shear 45-degree mitered laminations so corner flux stays aligned with the low-loss grain.',
     '45° mitered laminations', 'Graduated widths & step-lap joints',
     'Winding tooling and tank plate drawings are released.', ['mill', 'doe', 'process']),
    ('THE CORE', 'Stack the three-limb foundation.',
     'Laminations are interleaved onto the lower clamping frame to raise three stepped cruciform phase limbs, leaving the top open to receive prefabricated windings.',
     'Stepped three-limb core', 'Lower yoke, clamps & open legs',
     'Tank bottom pan and side walls enter welding in parallel.', ['core', 'process']),
    ('THE WINDINGS', 'Wind the inner low-voltage coils.',
     'Electrolytic copper and continuously transposed conductors (CTC) are wrapped in multi-ply kraft paper and wound on mandrels into heavy inner low-voltage cylinders.',
     'LV helical cylinders', 'Paper-wrapped CTC inner coils',
     'High-voltage mandrels and pressboard barriers are prepared.', ['core', 'factory', 'india']),
    ('THE WINDINGS', 'Build concentric high-voltage coils.',
     'With more turns of finer conductor to step up voltage, the high-voltage disc windings are formed as outer cylinders engineered to nest around each LV coil.',
     'HV multi-disc windings', 'Concentric outer phase cylinders',
     'Tank stiffener welding and radiator headers continue.', ['core', 'factory']),
    ('THE INSULATION', 'Fit barriers and press the coils.',
     'Pressboard cylinders, axial oil-duct spacers, and end rings lock between the LV and HV coils, then undergo thermal shrinking and hydraulic pressing against fault forces.',
     'Pressed coil assemblies', 'Pressboard ducts & axial stabilization',
     'The welded structural tank approaches leak testing.', ['factory', 'india', 'process']),
    ('THE ACTIVE PART', 'Lower coils, close yoke, braze leads.',
     'Cranes slip the phase windings over the three core limbs; technicians hand-lace the upper yoke, torque the external tie rods, and braze the phase risers and tap leads.',
     'Completed active assembly', 'Closed yoke, clamps & brazed risers',
     'Porcelain bushings, radiators and conservator are staged.', ['core', 'process', 'doe', 'india']),
    ('THE CASING', 'Weld, test, and coat the main tank.',
     'Heavy structural steel plates and vacuum stiffeners are welded, pass pressure-leak inspection, and receive an oil-resistant interior enamel plus a ≥105 µm exterior coat.',
     'Coated vacuum-rated tank', 'Leak-tested structural enclosure',
     'Autoclave drying schedule and tanking bay are aligned.', ['factory', 'india', 'doe']),
    ('FINAL PROCESSING', 'Vapour-phase dry and tank the core.',
     'Hot kerosene vapour and deep vacuum extract bound moisture inside the autoclave; cranes immediately seal the bone-dry active part inside the waiting tank.',
     'Dried & tanked assembly', 'Autoclave dehydration & enclosure',
     'Gasketed cover, 4 LV and 3 HV bushings are readied.', ['process', 'factory', 'doe', 'india']),
    ('FINAL ASSEMBLY', 'Fit cover, bushings, and cooling.',
     'The cover is bolted down, leads thread through the four LV and three HV porcelain bushings, radiator banks bolt to flank valves, and the offset Buchholz conservator mounts.',
     'Bushings & cooling loop', '7 bushings, radiators & conservator',
     'Marshalling cabinet and vacuum oil manifold are wired.', ['factory', 'doe', 'process']),
    ('FINAL ASSEMBLY', 'Vacuum oil-fill and run HV tests.',
     'Heated, degassed insulating oil saturates the evacuated tank under deep vacuum before the unit undergoes turns-ratio, heat-run, and lightning-impulse factory testing.',
     'Oil-filled unit under FAT', 'Vacuum saturation & HV impulse tests',
     'Pre- and post-test dissolved-gas oil samples are audited.', ['factory', 'india', 'process', 'doe']),
    ('THE COMPLETE TRANSFORMER', 'Sign off FAT and stamp rating plate.',
     'After dissolved-gas and partial-discharge records earn customer witness sign-off, the engraved rating plate is riveted to the tank wall for substation dispatch.',
     'Completed power transformer', 'Factory-accepted unit ready for grid',
     'Heavy-haul transport and site foundation works proceed.', ['process', 'india'])
]

data = []
for i, row in enumerate(rows, 1):
    phase, title, body, added, detail, parallel, refs = row
    data.append(dict(
        month=i, phase=phase, title=title, body=body,
        added=added, detail=detail, parallel=parallel, sources=refs
    ))

(root / 'dist/assets/timeline/months.json').write_text(
    json.dumps({'months': data, 'sources': sources}, ensure_ascii=False, separators=(',', ':'))
)

# Remap the 93 rendered frames across Months 1.0 to 12.0 (step = 11 / 92)
manifest_path = root / 'dist/assets/timeline/manifest.json'
manifest_data = [
    {'month': round(1.0 + i * (11.0 / 92.0), 4), 'src': f'assets/timeline/build-{i:03d}.webp'}
    for i in range(93)
]
manifest_path.write_text(json.dumps(manifest_data, separators=(',', ':')))

# Versioned research documentation
md = [
    '# Transformer manufacturing timeline: research and schedule basis', '',
    'The physical order is grounded in the sources below. Assigning those events to months 1–12 is an illustrative editorial programme requested for this website, not a published supplier schedule. Activities overlap; a monthly checkpoint does not imply that an operation takes a month. Drying, tanking and oil processing must be coordinated promptly. The final view represents factory completion, not an energised installation.', '',
    '## Monthly milestones', ''
]
for m in data:
    md += [
        f"### Month {m['month']} — {m['title']}",
        m['body'], '',
        f"Parallel work: {m['parallel']}", '',
        f"Sources: {', '.join(m['sources'])}", ''
    ]
md += ['## References', '']
for key, s in sources.items():
    md += [f"- {key}: [{s['label']}]({s['url']}). {s['note']}"]
(root / 'RESEARCH.md').write_text('\n'.join(md) + '\n')

# Pre-rendered table fragment + automatic sync directly into dist/index.html
table_html = ''.join(
    '<tr><th scope="row">' + str(m['month']).zfill(2) + '</th><td><strong>' +
    html.escape(m['title']) + '</strong><p>' + html.escape(m['body']) +
    '</p></td><td>' + html.escape(m['added']) + '</td></tr>'
    for m in data
)
(root / 'tools/months-table.html').write_text(table_html)

index_path = root / 'dist/index.html'
if index_path.exists():
    idx_text = index_path.read_text()
    idx_updated, count = re.subn(
        r'(<table class="milestone-table">.*?<tbody>).*?(</tbody></table>)',
        lambda m_re: m_re.group(1) + table_html + m_re.group(2),
        idx_text,
        flags=re.S
    )
    if count:
        index_path.write_text(idx_updated)

print('Written 12 concise researched milestones, 93-frame 12-month manifest, synced dist/index.html fallback table, and updated RESEARCH.md.')
