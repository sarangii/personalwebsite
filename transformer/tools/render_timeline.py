import math, os, sys, json, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/assets/timeline'
OUT.mkdir(parents=True, exist_ok=True)

def smooth(t):
    t = max(0.0, min(1.0, float(t)))
    return t * t * (3.0 - 2.0 * t)

# Material definitions: (name, base_color_rgb, metallic, roughness)
MATERIALS = {
    'steel':     ('Grain-oriented electrical steel', (0.21, 0.25, 0.27), 0.80, 0.31),
    'edge':      ('Lamination edges',                (0.37, 0.41, 0.42), 0.65, 0.30),
    'copper':    ('Copper conductor',                (0.59, 0.205, 0.075), 0.76, 0.27),
    'foil':      ('Inner winding copper',            (0.66, 0.29, 0.115), 0.72, 0.30),
    'paper':     ('Cellulose paper and pressboard',  (0.65, 0.49, 0.28), 0.00, 0.60),
    'tank':      ('Painted structural steel',        (0.43, 0.51, 0.49), 0.38, 0.32),
    'tankDark':  ('Frame and fittings',              (0.18, 0.25, 0.24), 0.50, 0.36),
    'porcelain': ('Porcelain bushing insulator',     (0.86, 0.90, 0.85), 0.04, 0.23),
    'black':     ('Terminals and gaskets',           (0.075, 0.095, 0.09), 0.20, 0.40),
    'amber':     ('Insulating liquid and sight glass', (0.68, 0.43, 0.12), 0.35, 0.22),
    'teal':      ('Diagnostic test leads',           (0.10, 0.48, 0.44), 0.45, 0.28),
}

def build_blender_scene():
    import bpy
    from mathutils import Vector

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 8
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'
    scene.world.color = (0.8, 0.8, 0.8)
    world = scene.world
    world.use_nodes = True
    world.node_tree.nodes.get('Background').inputs[0].default_value = (0.78, 0.84, 0.88, 1)
    world.node_tree.nodes.get('Background').inputs[1].default_value = 0.65

    mats = {}
    for key, (name, color, metal, rough) in MATERIALS.items():
        m = bpy.data.materials.new(name)
        m.diffuse_color = (*color, 1)
        m.use_nodes = True
        p = m.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value = (*color, 1)
        p.inputs['Metallic'].default_value = metal
        p.inputs['Roughness'].default_value = rough
        mats[key] = m

    def cube(name, loc, dim, mat_key, bevel=0.025):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o = bpy.context.object
        o.name = name
        o.dimensions = dim
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            mod = o.modifiers.new('Soft machined edge', 'BEVEL')
            mod.width = bevel
            mod.segments = 2
        o.data.materials.append(mats[mat_key])
        return o

    def cyl(name, loc, r, depth, mat_key, vertices=48):
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=r, depth=depth, location=loc)
        o = bpy.context.object
        o.name = name
        o.data.materials.append(mats[mat_key])
        bevel = o.modifiers.new('Edge relief', 'BEVEL')
        bevel.width = 0.015
        bevel.segments = 2
        for p in o.data.polygons:
            p.use_smooth = True
        return o

    def tube(name, loc, outer, inner, height, mat_key, n=64):
        vs, fs = [], []
        for z in [-height / 2, height / 2]:
            for r in [outer, inner]:
                for i in range(n):
                    a = i * math.tau / n
                    vs.append((r * math.cos(a), r * math.sin(a), z))
        for i in range(n):
            j = (i + 1) % n
            fs.extend([
                (i, j, 2 * n + j, 2 * n + i),
                (n + j, n + i, 3 * n + i, 3 * n + j),
                (j, i, n + i, n + j),
                (2 * n + i, 2 * n + j, 3 * n + j, 3 * n + i),
            ])
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vs, [], fs)
        mesh.update()
        o = bpy.data.objects.new(name, mesh)
        scene.collection.objects.link(o)
        o.location = loc
        o.data.materials.append(mats[mat_key])
        for p in mesh.polygons:
            p.use_smooth = True
        return o

    def torus(name, loc, major, minor, mat_key):
        bpy.ops.mesh.primitive_torus_add(
            major_segments=48, minor_segments=8, location=loc,
            major_radius=major, minor_radius=minor
        )
        o = bpy.context.object
        o.name = name
        o.data.materials.append(mats[mat_key])
        for p in o.data.polygons:
            p.use_smooth = True
        return o

    def group(name, children):
        e = bpy.data.objects.new(name, None)
        scene.collection.objects.link(e)
        for o in children:
            o.parent = e
        return e

    # 1. Incoming CRGO electrical steel master coil
    roll_parts = []
    r = tube('CRGO steel strip coil', (0, 0, 2.0), 1.7, 0.58, 1.6, 'edge')
    r.rotation_euler[0] = math.pi / 2
    roll_parts.append(r)
    for i in range(16):
        o = torus('Rolled strip edges', (0, -0.81, 2.0), 0.6 + i * 0.07, 0.009, 'steel')
        o.rotation_euler[0] = math.pi / 2
        roll_parts.append(o)
    for x in [-1.1, 1.1]:
        roll_parts.append(cube('Material cradle', (x, 0, 0.35), (0.25, 2.1, 0.25), 'tankDark'))
    roll = group('Incoming steel', roll_parts)

    # 2. Slit & 45-degree miter-cut stepped core lamination packets
    strip_parts = []
    for i in range(14):
        w = 4.6 - (i % 5) * 0.16
        strip_parts.append(cube('Slit and mitre-cut steel', (-0.35 + i * 0.05, 0, 0.22 + i * 0.048), (w, 0.78, 0.024), 'edge', 0.003))
    strips = group('Prepared laminations', strip_parts)

    # 3. Paper-insulated copper CTC conductor supply reel (offset clear of core supports)
    cond_parts = []
    for j in range(14):
        o = torus('Paper-covered conductor reel', (3.85, -1.05, 0.72 + j * 0.048), 0.62, 0.058, 'foil')
        cond_parts.append(o)
    conductor = group('Conductor supply', cond_parts)

    # 4. Stepped Cruciform 3-Limb CRGO Core + 45-degree Mitered Step-Lap Yokes + Lower Clamping Frame
    # Five cruciform steps fit cleanly inside LV inner radius 0.55 (max corner radius = 0.495 < 0.52)
    CRUCIFORM_STEPS = [
        (0.92, 0.22),
        (0.82, 0.46),
        (0.70, 0.68),
        (0.54, 0.82),
        (0.34, 0.92),
    ]
    core_parts, upper_parts = [], []
    for step_idx, (wx, wy) in enumerate(CRUCIFORM_STEPS):
        for x in [-2.25, 0.0, 2.25]:
            core_parts.append(cube(f'Core limb step {step_idx}', (x, 0.0, 2.75), (wx, wy, 4.25), 'steel', 0.008))
            # 45-degree mitered step-lap joint lines at top and bottom of limbs
            core_parts.append(cube(f'Lower miter joint {step_idx}', (x, 0.0, 0.62), (wx + 0.01, wy + 0.01, 0.03), 'edge', 0.003))
        core_parts.append(cube(f'Lower yoke step {step_idx}', (0.0, 0.0, 0.55), (5.42 - step_idx * 0.08, wy, 0.82), 'steel', 0.008))
        upper_parts.append(cube(f'Upper yoke step {step_idx}', (0.0, 0.0, 5.00), (5.42 - step_idx * 0.08, wy, 0.82), 'steel', 0.008))
    for x in [-2.25, 2.25]:
        core_parts.append(cube('Core foot support', (x, 0.0, 0.08), (1.18, 1.95, 0.18), 'tankDark'))
    for y in [-0.58, 0.58]:
        core_parts.append(cube('Lower clamping channel', (0.0, y, 0.42), (5.85, 0.18, 0.32), 'tankDark'))
    core = group('Laminated core', core_parts)
    upper = group('Upper yoke', upper_parts)

    # 5. Concentric LV (18 heavy helical turns) & HV (48 fine multi-disc turns) Windings + Pressboard Insulation
    lv_parts, hv_parts, ins_parts = [], [], []
    for x in [-2.25, 0.0, 2.25]:
        # Core-to-LV pressboard cylinder
        ins_parts.append(tube('Core-to-LV pressboard barrier', (x, 0.0, 2.75), 0.535, 0.505, 3.45, 'paper'))
        # LV heavy winding cylinder + 18 heavy flat helical turns
        lv_parts.append(tube('LV copper winding', (x, 0.0, 2.75), 0.68, 0.55, 3.22, 'foil'))
        for j in range(18):
            lv_parts.append(torus('LV high-current helical turn', (x, 0.0, 1.22 + j * 0.18), 0.686, 0.034, 'copper'))
        # Main LV-to-HV pressboard barrier & axial key spacers
        ins_parts.append(tube('Interwinding pressboard cylinder', (x, 0.0, 2.75), 0.775, 0.72, 3.50, 'paper'))
        # HV outer disc winding cylinder + 48 fine disc turns split into 6 disc banks with oil ducts
        hv_parts.append(tube('HV copper winding', (x, 0.0, 2.75), 0.99, 0.81, 3.22, 'copper'))
        for j in range(48):
            bank_gap = (j // 8) * 0.045
            z_turn = 1.18 + j * 0.061 + bank_gap
            hv_parts.append(torus('HV disc winding turn', (x, 0.0, z_turn), 0.998, 0.015, 'foil'))
        for z in [0.99, 4.49]:
            ins_parts.append(tube('Pressboard end ring', (x, 0.0, z), 1.07, 0.53, 0.16, 'paper'))
        for k in range(8):
            a = k * math.tau / 8
            ins_parts.append(cube('Axial oil-duct key spacer', (x + 1.015 * math.cos(a), 1.015 * math.sin(a), 2.75), (0.065, 0.065, 3.40), 'paper', 0.01))
    lv = group('LV windings', lv_parts)
    hv = group('HV windings', hv_parts)
    ins = group('Solid insulation', ins_parts)

    # 6. Upper Clamping Channels & Exterior Tie Rods (shifted to x=+-2.80 outside yokes)
    clamp_parts = []
    for y in [-0.58, 0.58]:
        clamp_parts.append(cube('Upper clamping channel', (0.0, y, 5.18), (5.88, 0.19, 0.35), 'tankDark'))
    for x in [-2.80, -1.12, 1.12, 2.80]:
        for y in [-0.62, 0.62]:
            clamp_parts.append(cyl('External tie rod', (x, y, 2.78), 0.042, 4.95, 'edge', 16))
    clamps = group('Core clamps', clamp_parts)

    # 7. Internal Leads & Tap-Changer Risers (terminated at z=5.42 below z=5.55 tank cover, aligned with bushings)
    lead_parts = []
    for x in [-2.25, -0.75, 0.75, 2.25]:
        # 4 LV risers (phases a, b, c + neutral n at y=-0.72)
        lead_parts.append(cyl('LV insulated riser', (x, -0.72, 4.92), 0.055, 0.95, 'paper', 20))
    for x in [-2.25, 0.0, 2.25]:
        # 3 HV risers (phases A, B, C at y=+0.78)
        lead_parts.append(cyl('HV insulated riser', (x, 0.78, 4.95), 0.065, 0.98, 'paper', 20))
    lead_parts.append(cube('LV neutral busbar', (0.0, -0.72, 4.55), (4.65, 0.09, 0.09), 'paper', 0.01))
    lead_parts.append(cube('On-load tap lead harness', (2.92, 0.25, 3.15), (0.24, 0.24, 2.75), 'paper', 0.015))
    leads = group('Leads and tap connections', lead_parts)

    # 8. Structural Steel Tank Shell & Independent Front Wall + Stiffeners
    shell_parts = []
    shell_parts.append(cube('Tank bottom plate', (0.0, 0.0, 0.05), (7.2, 3.8, 0.25), 'tank'))
    for x in [-3.5, 3.5]:
        shell_parts.append(cube('Tank end wall', (x, 0.0, 2.75), (0.18, 3.8, 5.4), 'tank'))
    shell_parts.append(cube('Tank rear wall', (0.0, 1.8, 2.75), (7.2, 0.18, 5.4), 'tank'))
    for x in [-2.8, -1.4, 0.0, 1.4, 2.8]:
        shell_parts.append(cube('Rear tank stiffener', (x, 1.95, 2.75), (0.12, 0.22, 5.2), 'tank'))
    for x in [-2.4, 2.4]:
        shell_parts.append(cube('Transport skid', (x, 0.0, -0.20), (0.45, 4.2, 0.35), 'tankDark'))
    shell = group('Tank casing', shell_parts)

    # Front wall & front stiffeners grouped together so stiffeners never float in mid-air during Month 17-18
    front_parts = [cube('Tank front wall', (0.0, -1.8, 2.75), (7.2, 0.18, 5.4), 'tank')]
    for x in [-2.8, -1.4, 0.0, 1.4, 2.8]:
        front_parts.append(cube('Front tank stiffener', (x, -1.95, 2.75), (0.12, 0.22, 5.2), 'tank'))
    front = group('Tank front assembly', front_parts)

    # 9. Bolted Tank Cover
    cover_parts = [cube('Bolted tank cover', (0.0, 0.0, 5.55), (7.5, 4.05, 0.22), 'tankDark')]
    for x in [-3.4, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.4]:
        for y in [-1.85, 1.85]:
            cover_parts.append(cyl('Cover bolt', (x, y, 5.70), 0.055, 0.11, 'edge', 6))
    cover = group('Tank cover', cover_parts)

    # 10. Bushings: 4 LV Bushings (3 phases + Neutral at y=-0.72) & 3 HV Bushings (at y=+0.78)
    bush_parts = []
    z_cover = 5.72
    # 4-bushing LV bank (height=1.42, r=0.155, 5 sheds)
    for x in [-2.25, -0.75, 0.75, 2.25]:
        y, height, r = -0.72, 1.42, 0.155
        bush_parts.append(cyl('LV bushing flange', (x, y, z_cover), r * 1.8, 0.12, 'edge'))
        bush_parts.append(cyl('LV porcelain body', (x, y, z_cover + height / 2), r, height, 'porcelain'))
        for j in range(6):
            zz = z_cover + 0.18 + j * (height - 0.30) / 6
            bush_parts.append(cyl('LV porcelain shed', (x, y, zz), r * 1.48, 0.058, 'porcelain'))
        bush_parts.append(cube('LV palm terminal', (x, y, z_cover + height + 0.12), (0.14, 0.06, 0.24), 'copper', 0.008))
    # 3-bushing HV bank (height=2.18, r=0.21, 9 sheds)
    for x in [-2.25, 0.0, 2.25]:
        y, height, r = 0.78, 2.18, 0.21
        bush_parts.append(cyl('HV bushing turret', (x, y, z_cover), r * 1.9, 0.15, 'tankDark'))
        bush_parts.append(cyl('HV porcelain body', (x, y, z_cover + height / 2), r, height, 'porcelain'))
        for j in range(9):
            zz = z_cover + 0.22 + j * (height - 0.36) / 9
            bush_parts.append(cyl('HV porcelain shed', (x, y, zz), r * 1.52, 0.062, 'porcelain'))
        bush_parts.append(cyl('HV corona terminal', (x, y, z_cover + height + 0.13), r * 0.52, 0.26, 'copper', 24))
    bush = group('Bushings', bush_parts)

    # 11. Detachable Finned Radiator Banks with Butterfly Isolation Valves
    rad_parts = []
    for side in [-1, 1]:
        for y in [-1.0, 1.0]:
            for j in range(15):
                rad_parts.append(cube('Radiator fin', (side * 4.02, y + (j - 7) * 0.085, 2.5), (0.85, 0.035, 3.9), 'tank', 0.015))
            for z in [0.65, 4.35]:
                o = cyl('Radiator header', (side * 3.85, y, z), 0.12, 1.7, 'tankDark')
                o.rotation_euler[0] = math.pi / 2
                rad_parts.append(o)
                rad_parts.append(cube('Isolation butterfly valve', (side * 3.55, y, z), (0.22, 0.24, 0.24), 'edge', 0.01))
    radiators = group('Cooling radiators', rad_parts)

    # 12. Offset Cantilever Conservator (y=2.08, z=7.48) + Buchholz Relay + Silica Gel Breather (Zero collision with HV bushings)
    cons_parts = []
    o = cyl('Conservator expansion vessel', (0.0, 2.08, 7.48), 0.55, 4.6, 'tank', 64)
    o.rotation_euler[1] = math.pi / 2
    cons_parts.append(o)
    for x in [-1.75, 1.75]:
        cons_parts.append(cube('Cantilever support upright', (x, 2.08, 6.42), (0.16, 0.16, 1.55), 'tankDark'))
        cons_parts.append(cube('Cantilever base arm', (x, 1.72, 5.72), (0.16, 0.88, 0.16), 'tankDark'))
    for x in [-2.30, 2.30]:
        o = cyl('Conservator end cap', (x, 2.08, 7.48), 0.57, 0.07, 'tankDark')
        o.rotation_euler[1] = math.pi / 2
        cons_parts.append(o)
    # Oil level sight glass on front face of conservator
    cons_parts.append(cube('Oil level sight glass', (-1.85, 1.52, 7.48), (0.14, 0.05, 0.62), 'amber', 0.008))
    # Expansion pipe + Buchholz gas-actuated relay housing
    cons_parts.append(cyl('Expansion riser pipe', (1.45, 1.55, 6.32), 0.06, 1.25, 'tankDark', 20))
    cons_parts.append(cube('Buchholz relay housing', (1.45, 1.65, 6.52), (0.34, 0.32, 0.36), 'edge', 0.015))
    # Dehydrating silica-gel breather column on left flank
    cons_parts.append(cyl('Breather pipe', (-2.48, 2.08, 5.65), 0.038, 3.65, 'tankDark', 16))
    cons_parts.append(cyl('Silica gel breather cylinder', (-2.48, 2.08, 3.65), 0.13, 0.55, 'amber', 24))
    conservator = group('Conservator', cons_parts)

    # 13. Marshalling & Tap-Changer Control Cabinet + HV Test Bus Rig (for Month 22-23 visual progression)
    ctrl_parts = [
        cube('Marshalling cabinet', (2.35, -2.03, 2.1), (1.05, 0.40, 1.75), 'tankDark'),
        cube('Cabinet door', (2.35, -2.26, 2.1), (0.92, 0.035, 1.60), 'tank'),
        cube('Cabinet latch', (2.64, -2.31, 2.1), (0.035, 0.045, 0.20), 'edge'),
    ]
    controls = group('Control cabinet', ctrl_parts)

    # 14. Rating & Diagram Nameplate
    plate_parts = [cube('Rating plate', (-1.3, -1.94, 3.1), (0.90, 0.025, 0.55), 'edge', 0.015)]
    for k in range(4):
        plate_parts.append(cube('Rating plate engraving', (-1.3, -1.957, 3.25 - k * 0.10), (0.65, 0.005, 0.014), 'tankDark', 0))
    plate = group('Rating plate', plate_parts)

    return scene, dict(
        roll=roll, strips=strips, conductor=conductor, core=core, upper=upper,
        lv=lv, hv=hv, ins=ins, clamps=clamps, leads=leads,
        shell=shell, front=front, cover=cover, bush=bush,
        radiators=radiators, conservator=conservator, controls=controls, plate=plate
    )


# ---------------------------------------------------------------------------
# Pure-Python + C++ Supersampled Orthographic Mesh Generator & Renderer
# Matches exact camera (11, -17, 11) -> target (0, 0, 3.2), ortho_scale=13.5
# Ensures zero frozen multi-month plateaus across all 93 timeline positions
# ---------------------------------------------------------------------------
def generate_all_frames_native():
    import ctypes
    import subprocess
    import numpy as np
    from PIL import Image

    cpp_src = r'''
    #include <cmath>
    #include <cstdint>
    #include <cstring>
    #include <algorithm>

    extern "C" {
    void render_triangles(
        const float* tris,     // N * 12 floats: x0,y0,z0, x1,y1,z1, x2,y2,z2, r,g,b
        const float* alphas,   // N floats: opacity 0..1
        int num_tris,
        int W, int H,
        float* zbuf,
        uint8_t* img           // H * W * 4 (RGBA)
    ) {
        for (int i = 0; i < W * H; ++i) {
            zbuf[i] = -1e9f;
            img[i*4+0] = 0;
            img[i*4+1] = 0;
            img[i*4+2] = 0;
            img[i*4+3] = 0;
        }
        for (int pass = 0; pass < 2; ++pass) {
            for (int t = 0; t < num_tris; ++t) {
                float alpha = alphas[t];
                if (alpha <= 0.001f) continue;
                bool is_opaque = (alpha >= 0.995f);
                if (pass == 0 && !is_opaque) continue;
                if (pass == 1 && is_opaque) continue;

                const float* p = tris + t * 12;
                float x0 = p[0], y0 = p[1], z0 = p[2];
                float x1 = p[3], y1 = p[4], z1 = p[5];
                float x2 = p[6], y2 = p[7], z2 = p[8];
                uint8_t cr = (uint8_t)std::clamp(p[9] * 255.0f, 0.0f, 255.0f);
                uint8_t cg = (uint8_t)std::clamp(p[10] * 255.0f, 0.0f, 255.0f);
                uint8_t cb = (uint8_t)std::clamp(p[11] * 255.0f, 0.0f, 255.0f);

                int minX = std::max(0, (int)std::floor(std::min({x0, x1, x2})));
                int maxX = std::min(W - 1, (int)std::ceil(std::max({x0, x1, x2})));
                int minY = std::max(0, (int)std::floor(std::min({y0, y1, y2})));
                int maxY = std::min(H - 1, (int)std::ceil(std::max({y0, y1, y2})));
                if (minX > maxX || minY > maxY) continue;

                float area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
                if (std::abs(area) < 1e-5f) continue;
                float inv_area = 1.0f / area;

                for (int py = minY; py <= maxY; ++py) {
                    float fy = py + 0.5f;
                    for (int px = minX; px <= maxX; ++px) {
                        float fx = px + 0.5f;
                        float w0 = ((x1 - fx) * (y2 - fy) - (x2 - fx) * (y1 - fy)) * inv_area;
                        float w1 = ((x2 - fx) * (y0 - fy) - (x0 - fx) * (y2 - fy)) * inv_area;
                        float w2 = 1.0f - w0 - w1;
                        if (w0 >= -1e-4f && w1 >= -1e-4f && w2 >= -1e-4f) {
                            float z = w0 * z0 + w1 * z1 + w2 * z2;
                            int idx = py * W + px;
                            if (is_opaque) {
                                if (z > zbuf[idx]) {
                                    zbuf[idx] = z;
                                    img[idx*4+0] = cr;
                                    img[idx*4+1] = cg;
                                    img[idx*4+2] = cb;
                                    img[idx*4+3] = 255;
                                }
                            } else {
                                if (z > zbuf[idx]) {
                                    uint8_t dst_r = img[idx*4+0];
                                    uint8_t dst_g = img[idx*4+1];
                                    uint8_t dst_b = img[idx*4+2];
                                    uint8_t dst_a = img[idx*4+3];
                                    float a = alpha;
                                    img[idx*4+0] = (uint8_t)(cr * a + dst_r * (1.0f - a));
                                    img[idx*4+1] = (uint8_t)(cg * a + dst_g * (1.0f - a));
                                    img[idx*4+2] = (uint8_t)(cb * a + dst_b * (1.0f - a));
                                    img[idx*4+3] = (uint8_t)std::min(255.0f, dst_a + a * 255.0f);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    }
    '''
    so_path = ROOT / 'tools/_raster.so'
    cpp_path = Path('/tmp/_raster.cpp')
    cpp_path.write_text(cpp_src)
    subprocess.check_call(['g++', '-O3', '-shared', '-fPIC', str(cpp_path), '-o', str(so_path)])
    lib = ctypes.CDLL(str(so_path))
    lib.render_triangles.argtypes = [
        ctypes.POINTER(ctypes.c_float),
        ctypes.POINTER(ctypes.c_float),
        ctypes.c_int, ctypes.c_int, ctypes.c_int,
        ctypes.POINTER(ctypes.c_float),
        ctypes.POINTER(ctypes.c_uint8)
    ]

    # Exact orthographic camera basis matching timeline.js project(point)
    target = np.array([0.0, 0.0, 3.2], dtype=np.float32)
    forward = np.array([-11.0, 17.0, -7.8], dtype=np.float32)
    f = forward / np.linalg.norm(forward)
    right = np.cross(f, np.array([0.0, 0.0, 1.0], dtype=np.float32))
    right = right / np.linalg.norm(right)
    up = np.cross(right, f)
    view_dir = -f

    # Studio 3-point lighting matching Workbench paint.sl & Cycles studio rig
    L_key = np.array([-0.42, -0.68, 0.60], dtype=np.float32); L_key /= np.linalg.norm(L_key)
    L_fill = np.array([0.72, -0.25, 0.65], dtype=np.float32); L_fill /= np.linalg.norm(L_fill)
    L_rim = np.array([0.15, 0.75, 0.64], dtype=np.float32); L_rim /= np.linalg.norm(L_rim)

    def make_box(center, dim, mat_key, rot_z=0.0):
        cx, cy, cz = center
        dx, dy, dz = dim[0] / 2.0, dim[1] / 2.0, dim[2] / 2.0
        # Beveled box corners for clean edge highlights
        b = min(0.022, dx * 0.18, dy * 0.18, dz * 0.18)
        verts = np.array([
            [-dx, -dy, -dz], [dx, -dy, -dz], [dx, dy, -dz], [-dx, dy, -dz],
            [-dx, -dy,  dz], [dx, -dy,  dz], [dx, dy,  dz], [-dx, dy,  dz],
        ], dtype=np.float32)
        if rot_z != 0.0:
            c, s = math.cos(rot_z), math.sin(rot_z)
            R = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=np.float32)
            verts = verts @ R.T
        verts += np.array([cx, cy, cz], dtype=np.float32)
        quads = [
            (0, 3, 2, 1), (4, 5, 6, 7),
            (0, 1, 5, 4), (2, 3, 7, 6),
            (1, 2, 6, 5), (3, 0, 4, 7)
        ]
        tris = []
        for q0, q1, q2, q3 in quads:
            tris.append((verts[q0], verts[q1], verts[q2], mat_key))
            tris.append((verts[q0], verts[q2], verts[q3], mat_key))
        return tris

    def make_cyl(center, radius, depth, mat_key, n=32, axis='Z'):
        cx, cy, cz = center
        h = depth / 2.0
        angles = np.linspace(0, 2 * np.pi, n, endpoint=False)
        tris = []
        for i in range(n):
            a0, a1 = angles[i], angles[(i + 1) % n]
            c0, s0 = radius * math.cos(a0), radius * math.sin(a0)
            c1, s1 = radius * math.cos(a1), radius * math.sin(a1)
            if axis == 'Z':
                p00 = np.array([cx + c0, cy + s0, cz - h], dtype=np.float32)
                p10 = np.array([cx + c1, cy + s1, cz - h], dtype=np.float32)
                p11 = np.array([cx + c1, cy + s1, cz + h], dtype=np.float32)
                p01 = np.array([cx + c0, cy + s0, cz + h], dtype=np.float32)
                top_c = np.array([cx, cy, cz + h], dtype=np.float32)
                bot_c = np.array([cx, cy, cz - h], dtype=np.float32)
            elif axis == 'Y':
                p00 = np.array([cx + c0, cy - h, cz + s0], dtype=np.float32)
                p10 = np.array([cx + c1, cy - h, cz + s1], dtype=np.float32)
                p11 = np.array([cx + c1, cy + h, cz + s1], dtype=np.float32)
                p01 = np.array([cx + c0, cy + h, cz + s0], dtype=np.float32)
                top_c = np.array([cx, cy + h, cz], dtype=np.float32)
                bot_c = np.array([cx, cy - h, cz], dtype=np.float32)
            else:  # 'X'
                p00 = np.array([cx - h, cy + c0, cz + s0], dtype=np.float32)
                p10 = np.array([cx - h, cy + c1, cz + s1], dtype=np.float32)
                p11 = np.array([cx + h, cy + c1, cz + s1], dtype=np.float32)
                p01 = np.array([cx + h, cy + c0, cz + s0], dtype=np.float32)
                top_c = np.array([cx + h, cy, cz], dtype=np.float32)
                bot_c = np.array([cx - h, cy, cz], dtype=np.float32)
            tris.append((p00, p10, p11, mat_key))
            tris.append((p00, p11, p01, mat_key))
            tris.append((top_c, p01, p11, mat_key))
            tris.append((bot_c, p10, p00, mat_key))
        return tris

    def make_tube(center, outer, inner, height, mat_key, n=40, axis='Z', rot_angle=0.0):
        cx, cy, cz = center
        h = height / 2.0
        angles = np.linspace(0, 2 * np.pi, n, endpoint=False) + rot_angle
        tris = []
        for i in range(n):
            a0, a1 = angles[i], angles[(i + 1) % n]
            co0, so0 = outer * math.cos(a0), outer * math.sin(a0)
            co1, so1 = outer * math.cos(a1), outer * math.sin(a1)
            ci0, si0 = inner * math.cos(a0), inner * math.sin(a0)
            ci1, si1 = inner * math.cos(a1), inner * math.sin(a1)
            if axis == 'Z':
                po00 = np.array([cx + co0, cy + so0, cz - h], dtype=np.float32)
                po10 = np.array([cx + co1, cy + so1, cz - h], dtype=np.float32)
                po11 = np.array([cx + co1, cy + so1, cz + h], dtype=np.float32)
                po01 = np.array([cx + co0, cy + so0, cz + h], dtype=np.float32)
                pi00 = np.array([cx + ci0, cy + si0, cz - h], dtype=np.float32)
                pi10 = np.array([cx + ci1, cy + si1, cz - h], dtype=np.float32)
                pi11 = np.array([cx + ci1, cy + si1, cz + h], dtype=np.float32)
                pi01 = np.array([cx + ci0, cy + si0, cz + h], dtype=np.float32)
            else:  # 'Y'
                po00 = np.array([cx + co0, cy - h, cz + so0], dtype=np.float32)
                po10 = np.array([cx + co1, cy - h, cz + so1], dtype=np.float32)
                po11 = np.array([cx + co1, cy + h, cz + so1], dtype=np.float32)
                po01 = np.array([cx + co0, cy + h, cz + so0], dtype=np.float32)
                pi00 = np.array([cx + ci0, cy - h, cz + si0], dtype=np.float32)
                pi10 = np.array([cx + ci1, cy - h, cz + si1], dtype=np.float32)
                pi11 = np.array([cx + ci1, cy + h, cz + si1], dtype=np.float32)
                pi01 = np.array([cx + ci0, cy + h, cz + si0], dtype=np.float32)
            # Outer wall
            tris.append((po00, po10, po11, mat_key))
            tris.append((po00, po11, po01, mat_key))
            # Inner wall
            tris.append((pi10, pi00, pi01, mat_key))
            tris.append((pi10, pi01, pi11, mat_key))
            # Top ring
            tris.append((po01, po11, pi11, mat_key))
            tris.append((po01, pi11, pi01, mat_key))
            # Bottom ring
            tris.append((po10, po00, pi00, mat_key))
            tris.append((po10, pi00, pi10, mat_key))
        return tris

    def make_torus(center, major, minor, mat_key, n_maj=36, n_min=8, axis='Z'):
        cx, cy, cz = center
        u = np.linspace(0, 2 * np.pi, n_maj, endpoint=False)
        v = np.linspace(0, 2 * np.pi, n_min, endpoint=False)
        pts = np.zeros((n_maj, n_min, 3), dtype=np.float32)
        for i, a in enumerate(u):
            ca, sa = math.cos(a), math.sin(a)
            for j, b in enumerate(v):
                r = major + minor * math.cos(b)
                z = minor * math.sin(b)
                if axis == 'Z':
                    pts[i, j] = [cx + r * ca, cy + r * sa, cz + z]
                else:  # 'Y'
                    pts[i, j] = [cx + r * ca, cy + z, cz + r * sa]
        tris = []
        for i in range(n_maj):
            i1 = (i + 1) % n_maj
            for j in range(n_min):
                j1 = (j + 1) % n_min
                p00, p10, p11, p01 = pts[i, j], pts[i1, j], pts[i1, j1], pts[i, j1]
                tris.append((p00, p10, p11, mat_key))
                tris.append((p00, p11, p01, mat_key))
        return tris

    # Pre-build static mesh templates
    print("Building corrected 3D transformer mesh assemblies...")
    CRUCIFORM_STEPS = [
        (0.92, 0.22),
        (0.82, 0.46),
        (0.70, 0.68),
        (0.54, 0.82),
        (0.34, 0.92),
    ]
    mesh_core, mesh_upper = [], []
    for step_idx, (wx, wy) in enumerate(CRUCIFORM_STEPS):
        for x in [-2.25, 0.0, 2.25]:
            mesh_core.extend(make_box((x, 0.0, 2.75), (wx, wy, 4.25), 'steel'))
            mesh_core.extend(make_box((x, 0.0, 0.62), (wx + 0.015, wy + 0.015, 0.035), 'edge'))
            mesh_core.extend(make_box((x, 0.0, 4.86), (wx + 0.015, wy + 0.015, 0.035), 'edge'))
        mesh_core.extend(make_box((0.0, 0.0, 0.55), (5.42 - step_idx * 0.08, wy, 0.82), 'steel'))
        mesh_upper.extend(make_box((0.0, 0.0, 5.00), (5.42 - step_idx * 0.08, wy, 0.82), 'steel'))
    for x in [-2.25, 2.25]:
        mesh_core.extend(make_box((x, 0.0, 0.08), (1.18, 1.95, 0.18), 'tankDark'))
    for y in [-0.58, 0.58]:
        mesh_core.extend(make_box((0.0, y, 0.42), (5.85, 0.18, 0.32), 'tankDark'))

    mesh_lv, mesh_hv, mesh_ins = [], [], []
    for x in [-2.25, 0.0, 2.25]:
        mesh_ins.extend(make_tube((x, 0.0, 2.75), 0.535, 0.505, 3.45, 'paper', 32))
        mesh_lv.extend(make_tube((x, 0.0, 2.75), 0.68, 0.55, 3.22, 'foil', 36))
        for j in range(18):
            mesh_lv.extend(make_torus((x, 0.0, 1.22 + j * 0.18), 0.686, 0.034, 'copper', 32, 8))
        mesh_ins.extend(make_tube((x, 0.0, 2.75), 0.775, 0.72, 3.50, 'paper', 36))
        mesh_hv.extend(make_tube((x, 0.0, 2.75), 0.99, 0.81, 3.22, 'copper', 36))
        for j in range(36):
            bank_gap = (j // 6) * 0.055
            z_turn = 1.18 + j * 0.078 + bank_gap
            mesh_hv.extend(make_torus((x, 0.0, z_turn), 0.998, 0.017, 'foil', 32, 7))
        for z in [0.99, 4.49]:
            mesh_ins.extend(make_tube((x, 0.0, z), 1.07, 0.53, 0.16, 'paper', 36))
        for k in range(8):
            a = k * math.tau / 8
            mesh_ins.extend(make_box((x + 1.015 * math.cos(a), 1.015 * math.sin(a), 2.75), (0.065, 0.065, 3.40), 'paper'))

    mesh_clamps = []
    for y in [-0.58, 0.58]:
        mesh_clamps.extend(make_box((0.0, y, 5.18), (5.88, 0.19, 0.35), 'tankDark'))
    for x in [-2.80, -1.12, 1.12, 2.80]:
        for y in [-0.62, 0.62]:
            mesh_clamps.extend(make_cyl((x, y, 2.78), 0.042, 4.95, 'edge', 14))

    mesh_leads = []
    for x in [-2.25, -0.75, 0.75, 2.25]:
        mesh_leads.extend(make_cyl((x, -0.72, 4.92), 0.055, 0.95, 'paper', 16))
    for x in [-2.25, 0.0, 2.25]:
        mesh_leads.extend(make_cyl((x, 0.78, 4.95), 0.065, 0.98, 'paper', 16))
    mesh_leads.extend(make_box((0.0, -0.72, 4.55), (4.65, 0.09, 0.09), 'paper'))
    mesh_leads.extend(make_box((2.92, 0.25, 3.15), (0.24, 0.24, 2.75), 'paper'))

    mesh_shell = []
    mesh_shell.extend(make_box((0.0, 0.0, 0.05), (7.2, 3.8, 0.25), 'tank'))
    for x in [-3.5, 3.5]:
        mesh_shell.extend(make_box((x, 0.0, 2.75), (0.18, 3.8, 5.4), 'tank'))
    mesh_shell.extend(make_box((0.0, 1.8, 2.75), (7.2, 0.18, 5.4), 'tank'))
    for x in [-2.8, -1.4, 0.0, 1.4, 2.8]:
        mesh_shell.extend(make_box((x, 1.95, 2.75), (0.12, 0.22, 5.2), 'tank'))
    for x in [-2.4, 2.4]:
        mesh_shell.extend(make_box((x, 0.0, -0.20), (0.45, 4.2, 0.35), 'tankDark'))

    mesh_front = [make_box((0.0, -1.8, 2.75), (7.2, 0.18, 5.4), 'tank')]
    mesh_front = [t for sub in mesh_front for t in sub]
    for x in [-2.8, -1.4, 0.0, 1.4, 2.8]:
        mesh_front.extend(make_box((x, -1.95, 2.75), (0.12, 0.22, 5.2), 'tank'))

    mesh_cover = []
    mesh_cover.extend(make_box((0.0, 0.0, 5.55), (7.5, 4.05, 0.22), 'tankDark'))
    for x in [-3.4, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.4]:
        for y in [-1.85, 1.85]:
            mesh_cover.extend(make_cyl((x, y, 5.70), 0.055, 0.11, 'edge', 8))

    mesh_bush = []
    z_cover = 5.72
    for x in [-2.25, -0.75, 0.75, 2.25]:
        y, height, r = -0.72, 1.42, 0.155
        mesh_bush.extend(make_cyl((x, y, z_cover), r * 1.8, 0.12, 'edge', 20))
        mesh_bush.extend(make_cyl((x, y, z_cover + height / 2), r, height, 'porcelain', 24))
        for j in range(6):
            zz = z_cover + 0.18 + j * (height - 0.30) / 6
            mesh_bush.extend(make_cyl((x, y, zz), r * 1.48, 0.058, 'porcelain', 24))
        mesh_bush.extend(make_box((x, y, z_cover + height + 0.12), (0.14, 0.06, 0.24), 'copper'))
    for x in [-2.25, 0.0, 2.25]:
        y, height, r = 0.78, 2.18, 0.21
        mesh_bush.extend(make_cyl((x, y, z_cover), r * 1.9, 0.15, 'tankDark', 20))
        mesh_bush.extend(make_cyl((x, y, z_cover + height / 2), r, height, 'porcelain', 24))
        for j in range(9):
            zz = z_cover + 0.22 + j * (height - 0.36) / 9
            mesh_bush.extend(make_cyl((x, y, zz), r * 1.52, 0.062, 'porcelain', 24))
        mesh_bush.extend(make_cyl((x, y, z_cover + height + 0.13), r * 0.52, 0.26, 'copper', 20))

    mesh_rads = []
    for side in [-1, 1]:
        for y in [-1.0, 1.0]:
            for j in range(15):
                mesh_rads.extend(make_box((side * 4.02, y + (j - 7) * 0.085, 2.5), (0.85, 0.035, 3.9), 'tank'))
            for z in [0.65, 4.35]:
                mesh_rads.extend(make_cyl((side * 3.85, y, z), 0.12, 1.7, 'tankDark', 16, axis='Y'))
                mesh_rads.extend(make_box((side * 3.55, y, z), (0.22, 0.24, 0.24), 'edge'))

    mesh_cons = []
    mesh_cons.extend(make_cyl((0.0, 2.08, 7.48), 0.55, 4.6, 'tank', 36, axis='X'))
    for x in [-1.75, 1.75]:
        mesh_cons.extend(make_box((x, 2.08, 6.42), (0.16, 0.16, 1.55), 'tankDark'))
        mesh_cons.extend(make_box((x, 1.72, 5.72), (0.16, 0.88, 0.16), 'tankDark'))
    for x in [-2.30, 2.30]:
        mesh_cons.extend(make_cyl((x, 2.08, 7.48), 0.57, 0.07, 'tankDark', 28, axis='X'))
    mesh_cons.extend(make_box((-1.85, 1.52, 7.48), (0.14, 0.05, 0.62), 'amber'))
    mesh_cons.extend(make_cyl((1.45, 1.55, 6.32), 0.06, 1.25, 'tankDark', 16))
    mesh_cons.extend(make_box((1.45, 1.65, 6.52), (0.34, 0.32, 0.36), 'edge'))
    mesh_cons.extend(make_cyl((-2.48, 2.08, 5.65), 0.038, 3.65, 'tankDark', 14))
    mesh_cons.extend(make_cyl((-2.48, 2.08, 3.65), 0.13, 0.55, 'amber', 20))

    mesh_controls = []
    mesh_controls.extend(make_box((2.35, -2.03, 2.1), (1.05, 0.40, 1.75), 'tankDark'))
    mesh_controls.extend(make_box((2.35, -2.26, 2.1), (0.92, 0.035, 1.60), 'tank'))
    mesh_controls.extend(make_box((2.64, -2.31, 2.1), (0.035, 0.045, 0.20), 'edge'))

    mesh_plate = []
    mesh_plate.extend(make_box((-1.3, -1.94, 3.1), (0.90, 0.025, 0.55), 'edge'))
    for k in range(4):
        mesh_plate.extend(make_box((-1.3, -1.957, 3.25 - k * 0.10), (0.65, 0.005, 0.014), 'tankDark'))

    # High-voltage test overhead busbar & probe leads for Month 22-23
    mesh_test_rig = []
    for x in [-2.25, 0.0, 2.25]:
        mesh_test_rig.extend(make_cyl((x, 0.78, 8.55), 0.045, 1.10, 'teal', 16))
        mesh_test_rig.extend(make_torus((x, 0.78, 8.05), 0.24, 0.035, 'copper', 24, 8))
    mesh_test_rig.extend(make_cyl((0.0, 0.78, 9.10), 0.05, 5.2, 'teal', 16, axis='X'))

    def transform_mesh(tris, offset=(0.0, 0.0, 0.0), scale=(1.0, 1.0, 1.0), pivot=(0.0, 0.0, 0.0), alpha=1.0):
        ox, oy, oz = offset
        sx, sy, sz = scale
        px, py, pz = pivot
        out = []
        for p0, p1, p2, mkey in tris:
            q0 = np.array([(p0[0] - px) * sx + px + ox, (p0[1] - py) * sy + py + oy, (p0[2] - pz) * sz + pz + oz], dtype=np.float32)
            q1 = np.array([(p1[0] - px) * sx + px + ox, (p1[1] - py) * sy + py + oy, (p1[2] - pz) * sz + pz + oz], dtype=np.float32)
            q2 = np.array([(p2[0] - px) * sx + px + ox, (p2[1] - py) * sy + py + oy, (p2[2] - pz) * sz + pz + oz], dtype=np.float32)
            out.append((q0, q1, q2, mkey, alpha))
        return out

    W_SS, H_SS = 1600, 1600
    zbuf = np.zeros(W_SS * H_SS, dtype=np.float32)
    img_buf = np.zeros(W_SS * H_SS * 4, dtype=np.uint8)

    def render_state_image(m):
        scene_tris = []

        # 1. Incoming CRGO roll (Months 1.0 - 3.75): rotates & uncoils pay-off tongue so M1..M3 has continuous motion
        if m < 3.75:
            rot_angle = (m - 1.0) * 0.65
            roll_shift_x = -1.6 * smooth((m - 3.0) / 0.75) if m > 3.0 else 0.0
            roll_dyn = make_tube((roll_shift_x, 0.0, 2.0), 1.7, 0.58, 1.6, 'edge', 44, axis='Y', rot_angle=rot_angle)
            for i in range(16):
                roll_dyn.extend(make_torus((roll_shift_x, -0.81, 2.0), 0.6 + i * 0.07, 0.009, 'steel', 36, 6, axis='Y'))
            for x in [-1.1, 1.1]:
                roll_dyn.extend(make_box((roll_shift_x + x, 0.0, 0.35), (0.25, 2.1, 0.25), 'tankDark'))
            # Uncoiling pay-off strip extending during M1.25 - 3.5
            tongue_len = 0.4 + 2.4 * smooth((m - 1.0) / 2.2)
            roll_dyn.extend(make_box((roll_shift_x + 0.9 + tongue_len / 2, 0.0, 0.48), (tongue_len, 1.55, 0.03), 'steel'))
            scene_tris.extend(transform_mesh(roll_dyn))

        # 2. Slit & 45-degree mitered laminations (Months 3.25 - 5.5): fan out cleanly without colliding with roll or core
        if 3.25 <= m < 5.5:
            prog = smooth((m - 3.25) / 1.75)
            n_sheets = max(2, int(round(3 + 11 * prog)))
            for i in range(n_sheets):
                w = 4.6 - (i % 5) * 0.16
                spread = 0.035 + 0.035 * prog
                scene_tris.extend(transform_mesh(
                    make_box((-0.3 + i * spread, 0.0, 0.22 + i * 0.048), (w, 0.78, 0.024), 'edge')
                ))

        # 3. Core foundation (Months 5.25+): grows vertically with stepped cruciform profile
        if m >= 5.25:
            c_scale = max(0.05, smooth((m - 5.25) / 0.85))
            scene_tris.extend(transform_mesh(mesh_core, scale=(1.0, 1.0, c_scale), pivot=(0.0, 0.0, 0.15)))

        # 4. Paper-insulated copper CTC supply reel (Months 6.5 - 8.25): placed at x=3.85 clear of core support
        if 6.5 <= m < 8.25:
            n_turns = max(2, int(round(14 * smooth((m - 6.5) / 1.0))))
            for j in range(n_turns):
                scene_tris.extend(transform_mesh(
                    make_torus((3.85, -1.05, 0.72 + j * 0.048), 0.62, 0.058, 'foil', 28, 7)
                ))

        # 5. Concentric LV, HV, and Pressboard Insulation (Months 7.25+)
        # Continuous axial compression during M9.5 - 11.0 eliminates the 7-frame frozen zone
        coil_drop = 4.35 * (1.0 - smooth((m - 11.0) / 1.05)) if m < 12.1 else 0.0
        press_squeeze = 1.08 - 0.08 * smooth((m - 10.0) / 1.0) if 10.0 <= m < 11.1 else 1.0

        if m >= 7.25:
            lv_grow = max(0.05, smooth((m - 7.25) / 0.85)) if m < 8.15 else press_squeeze
            scene_tris.extend(transform_mesh(mesh_lv, offset=(0.0, 0.0, coil_drop), scale=(1.0, 1.0, lv_grow), pivot=(0.0, 0.0, 2.75)))

        if m >= 8.25:
            hv_grow = max(0.05, smooth((m - 8.25) / 0.85)) if m < 9.15 else press_squeeze
            scene_tris.extend(transform_mesh(mesh_hv, offset=(0.0, 0.0, coil_drop), scale=(1.0, 1.0, hv_grow), pivot=(0.0, 0.0, 2.75)))

        if m >= 9.25:
            ins_grow = max(0.08, smooth((m - 9.25) / 0.85)) if m < 10.15 else press_squeeze
            scene_tris.extend(transform_mesh(mesh_ins, offset=(0.0, 0.0, coil_drop), scale=(1.0, 1.0, ins_grow), pivot=(0.0, 0.0, 2.75)))

        # Hydraulic pre-compression press plates shown during Month 10.25 - 11.0
        if 10.25 <= m <= 11.0:
            p_alpha = 0.88
            z_press = 4.65 + coil_drop + 0.35 * (1.0 - smooth((m - 10.25) / 0.75))
            for x in [-2.25, 0.0, 2.25]:
                scene_tris.extend(transform_mesh(make_cyl((x, 0.0, z_press), 1.08, 0.14, 'tankDark', 24), alpha=p_alpha))

        # 6. Upper yoke closing (Months 12.25+)
        if m >= 12.25:
            uy_off = 3.6 * (1.0 - smooth((m - 12.25) / 0.8))
            scene_tris.extend(transform_mesh(mesh_upper, offset=(0.0, 0.0, uy_off)))

        # 7. Core clamps & external tie rods (Months 13.0+)
        if m >= 13.0:
            cl_off = 1.6 * (1.0 - smooth((m - 13.0) / 0.65))
            scene_tris.extend(transform_mesh(mesh_clamps, offset=(0.0, 0.0, cl_off)))

        # 8. Internal leads & tap harness (Months 13.75+)
        if m >= 13.75:
            ld_off = 1.4 * (1.0 - smooth((m - 13.75) / 0.65))
            scene_tris.extend(transform_mesh(mesh_leads, offset=(0.0, 0.0, ld_off)))

        # 9. Parallel Tank Fabrication & Vapour-Phase Drying Reveal (Months 14.75 - 17.0)
        # Eliminates the 11-frame frozen zone by revealing the parallel structural tank shell & autoclave BELL
        if 14.75 <= m < 17.1:
            if m < 16.25:
                # Parallel structural tank shell rises in ghostly semi-transparent form around the active part
                prog_tank = smooth((m - 14.75) / 1.25)
                t_off = -3.2 * (1.0 - prog_tank)
                t_alpha = 0.22 + 0.26 * prog_tank
                scene_tris.extend(transform_mesh(mesh_shell, offset=(0.0, 0.0, t_off), alpha=t_alpha))
            else:
                # Month 16.25 - 17.0: Warm amber vapour-phase vacuum drying autoclave shroud descends
                prog_dry = smooth((m - 16.25) / 0.75)
                bell_z = 2.85 + 1.8 * (1.0 - prog_dry)
                bell_mesh = make_tube((0.0, 0.0, bell_z), 3.65, 3.52, 5.3, 'amber', 40)
                scene_tris.extend(transform_mesh(bell_mesh, alpha=0.28 + 0.14 * prog_dry))

        # 10. Final Tanking (Months 17.1+): opaque tank shell rises, followed by front wall + attached front stiffeners at M18.0
        if m >= 17.1:
            sh_off = -5.8 * (1.0 - smooth((m - 17.1) / 0.9))
            scene_tris.extend(transform_mesh(mesh_shell, offset=(0.0, 0.0, sh_off)))

        if m >= 18.0:
            fr_off = -5.8 * (1.0 - smooth((m - 18.0) / 0.75))
            # During M21.0 - 21.75 (Vacuum Oil Impregnation), make the front wall translucent so rising amber oil is visible
            if 21.0 <= m <= 21.75:
                oil_prog = smooth((m - 21.0) / 0.75)
                oil_h = 0.4 + 4.8 * oil_prog
                oil_box = make_box((0.0, -0.1, 0.2 + oil_h / 2.0), (6.9, 3.3, oil_h), 'amber')
                scene_tris.extend(transform_mesh(oil_box, alpha=0.58))
                scene_tris.extend(transform_mesh(mesh_front, offset=(0.0, 0.0, fr_off), alpha=0.44))
            else:
                scene_tris.extend(transform_mesh(mesh_front, offset=(0.0, 0.0, fr_off)))

        # 11. Bolted Tank Cover (Months 18.7+)
        if m >= 18.7:
            cv_off = 2.8 * (1.0 - smooth((m - 18.7) / 0.6))
            scene_tris.extend(transform_mesh(mesh_cover, offset=(0.0, 0.0, cv_off)))

        # 12. 4 LV + 3 HV Porcelain Bushings (Months 19.1+)
        if m >= 19.1:
            bu_off = 2.5 * (1.0 - smooth((m - 19.1) / 0.7))
            scene_tris.extend(transform_mesh(mesh_bush, offset=(0.0, 0.0, bu_off)))

        # 13. Detachable Finned Radiator Banks (Months 19.6+)
        if m >= 19.6:
            rd_off = -4.7 * (1.0 - smooth((m - 19.6) / 0.8))
            scene_tris.extend(transform_mesh(mesh_rads, offset=(0.0, 0.0, rd_off)))

        # 14. Cantilever Conservator + Buchholz + Breather (Months 20.0+)
        if m >= 20.0:
            cs_off = 2.1 * (1.0 - smooth((m - 20.0) / 0.75))
            scene_tris.extend(transform_mesh(mesh_cons, offset=(0.0, 0.0, cs_off)))

        # 15. Marshalling Control Cabinet (Months 20.6+)
        if m >= 20.6:
            ct_off = -1.8 * (1.0 - smooth((m - 20.6) / 0.4))
            scene_tris.extend(transform_mesh(mesh_controls, offset=(0.0, ct_off, 0.0)))

        # 16. High-Voltage Factory Acceptance Testing Overhead Bus Rig (Months 22.0 - 23.0)
        if 22.0 <= m <= 23.0:
            rig_prog = smooth((m - 22.0) / 0.5) if m <= 22.5 else smooth((23.15 - m) / 0.5)
            rig_off = 1.4 * (1.0 - rig_prog)
            scene_tris.extend(transform_mesh(mesh_test_rig, offset=(0.0, 0.0, rig_off), alpha=0.85 * rig_prog))

        # 17. Final Engraved Rating Plate (Months 23.25+)
        if m >= 23.25:
            pl_off = -0.8 * (1.0 - smooth((m - 23.25) / 0.6))
            scene_tris.extend(transform_mesh(mesh_plate, offset=(0.0, pl_off, 0.0)))

        # Project and shade triangles
        n_tris = len(scene_tris)
        tri_arr = np.zeros((n_tris, 12), dtype=np.float32)
        alpha_arr = np.zeros(n_tris, dtype=np.float32)

        for idx, (p0, p1, p2, mkey, alpha) in enumerate(scene_tris):
            e1 = p1 - p0
            e2 = p2 - p0
            normal = np.cross(e1, e2)
            norm_len = np.linalg.norm(normal)
            if norm_len > 1e-7:
                normal /= norm_len
            else:
                normal = np.array([0.0, 0.0, 1.0], dtype=np.float32)
            if np.dot(normal, view_dir) < 0:
                normal = -normal

            _, base_rgb, metal, rough = MATERIALS[mkey]
            d_key = max(0.0, float(np.dot(normal, L_key)))
            d_fill = max(0.0, float(np.dot(normal, L_fill)))
            d_rim = max(0.0, float(np.dot(normal, L_rim)))
            up_hemi = 0.5 + 0.5 * float(normal[2])

            # Blinn-Phong specular highlight tuned to Workbench paint.sl
            h_vec = L_key + view_dir
            h_vec /= np.linalg.norm(h_vec)
            spec_pow = 18.0 + (1.0 - rough) * 42.0
            spec = (max(0.0, float(np.dot(normal, h_vec))) ** spec_pow) * (0.22 + 0.35 * metal)

            diffuse = 0.36 + 0.44 * d_key + 0.22 * d_fill + 0.16 * d_rim + 0.10 * up_hemi
            # Subtle AgX-like filmic tone mapping
            r = min(0.96, (base_rgb[0] * diffuse + spec) ** 0.90)
            g = min(0.96, (base_rgb[1] * diffuse + spec) ** 0.90)
            b = min(0.96, (base_rgb[2] * diffuse + spec) ** 0.90)

            for k_pt, pt in enumerate((p0, p1, p2)):
                v = pt - target
                u_coord = 0.5 + float(np.dot(v, right)) / 13.5
                v_coord = 0.5 - float(np.dot(v, up)) / 13.5
                z_depth = float(np.dot(v, view_dir))
                tri_arr[idx, k_pt * 3 + 0] = u_coord * W_SS
                tri_arr[idx, k_pt * 3 + 1] = v_coord * H_SS
                tri_arr[idx, k_pt * 3 + 2] = z_depth

            tri_arr[idx, 9] = r
            tri_arr[idx, 10] = g
            tri_arr[idx, 11] = b
            alpha_arr[idx] = alpha

        lib.render_triangles(
            tri_arr.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            alpha_arr.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            n_tris, W_SS, H_SS,
            zbuf.ctypes.data_as(ctypes.POINTER(ctypes.c_float)),
            img_buf.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8))
        )
        rgba = img_buf.reshape((H_SS, W_SS, 4))
        pil_img = Image.fromarray(rgba, mode='RGBA').resize((1000, 1000), Image.Resampling.LANCZOS)
        return pil_img

    # Clean old webp renders
    for old_f in OUT.glob('build-*.webp'):
        old_f.unlink()

    values = [1.0 + i * 0.25 for i in range(93)]  # 93 geometry states mapped to Months 1.0..12.0 in manifest.json
    manifest_data = []
    t_start = time.time()
    for index, m in enumerate(values):
        target_webp = OUT / f'build-{index:03d}.webp'
        asset_rel = f'assets/timeline/{target_webp.name}'
        img = render_state_image(m)
        img.save(target_webp, format='WEBP', quality=86, method=4)
        manifest_data.append({'month': round(1.0 + index * (11.0 / 92.0), 4), 'src': asset_rel})
        if index % 15 == 0 or index == 92:
            print(f"Rendered frame {index:02d}/92 (month {m:.2f}) -> {target_webp.name}")

    (OUT / 'manifest.json').write_text(json.dumps(manifest_data, separators=(',', ':')))
    so_path.unlink(missing_ok=True)
    cpp_path.unlink(missing_ok=True)
    print(f"Completed 93 unique frames in {time.time() - t_start:.2f}s")


if __name__ == '__main__':
    try:
        import bpy
        HAS_BLENDER = True
    except ImportError:
        HAS_BLENDER = False

    if HAS_BLENDER:
        scene, groups = build_blender_scene()
        print("Blender scene constructed with corrected 45-degree mitered stepped core and offset conservator.")
    else:
        generate_all_frames_native()
