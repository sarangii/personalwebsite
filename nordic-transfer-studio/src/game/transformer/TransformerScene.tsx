import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createMaterials, type Materials } from "./materials";
import { partById, partProgress, type Vec3 } from "./parts";

export type SceneControl = { explode: number; auto: boolean };
export type SceneProps = {
  control: React.RefObject<SceneControl>;
  selected: string | null;
  group: number | null;
  onHover: (id: string | null, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onInteract: () => void;
};

type Ctx = {
  shown: React.RefObject<number>;
  view: React.RefObject<{ selected: string | null; group: number | null; hovered: string | null }>;
  m: Materials;
  onHover: SceneProps["onHover"];
  onSelect: SceneProps["onSelect"];
};
const SceneCtx = createContext<Ctx | null>(null);
const useScene = () => useContext(SceneCtx)!;

// ---- layout constants (metres-ish) -------------------------------------
const LIMB_X = [-0.95, 0, 0.95];
const YOKE_H = 0.32;
const LOWER_Y = 0.1 + YOKE_H / 2;
const LIMB_BOT = 0.1 + YOKE_H;
const LIMB_TOP = 1.72;
const UPPER_Y = LIMB_TOP + YOKE_H / 2;
const LIMB_MID = (LIMB_BOT + LIMB_TOP) / 2;
const STEPS: [number, number][] = [[0.36, 0.18], [0.3, 0.28], [0.2, 0.36]];
const TARGET: Vec3 = [0, 0.15, 0];
const DIST_ASSEMBLED = 11.5, DIST_EXPLODED = 17;
const TANK_X = 1.52, TANK_Z = 0.66, TANK_H = 2.3;

export default function TransformerScene(props: SceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [7.6, 5.2, 10.2], fov: 30, near: 0.1, far: 100 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.95;
        requestAnimationFrame(() => requestAnimationFrame(() => gl.domElement.parentElement?.parentElement?.setAttribute("data-scene-ready", "true")));
      }}
    >
      <World {...props} />
    </Canvas>
  );
}

function World({ control, selected, group, onHover, onSelect, onInteract }: SceneProps) {
  const m = useMemo(createMaterials, []);
  const shown = useRef(control.current?.explode ?? 0);
  const view = useRef({ selected, group, hovered: null as string | null });
  view.current.selected = selected;
  view.current.group = group;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = control.current?.explode ?? 0;
    shown.current += (target - shown.current) * (1 - Math.exp(-9 * dt));
  });

  const ctx = useMemo<Ctx>(() => ({
    shown, view, m,
    onHover: (id, x, y) => { view.current.hovered = id; onHover(id, x, y); },
    onSelect,
  }), [m, onHover, onSelect]);

  return (
    <SceneCtx.Provider value={ctx}>
      <ResponsiveCamera />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 9, 6]} intensity={1.6} />
      <directionalLight position={[-6, 4, -4]} intensity={0.5} color="#dfe9f0" />
      <Environment resolution={256} environmentIntensity={0.95}>
        <color attach="background" args={["#dfe6ec"]} />
        <Lightformer intensity={3.2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
        <Lightformer intensity={1.6} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[14, 2, 1]} />
        <Lightformer intensity={1.2} color="#e6f2f4" position={[6, 3, -3]} rotation-y={-Math.PI / 2} scale={[12, 3, 1]} />
        <Lightformer intensity={0.8} position={[0, 1, 8]} scale={[16, 1, 1]} />
      </Environment>

      <group position={[0, -1.25, 0]}>
        <Core />
        <Windings />
        <ActivePart />
        <Tank />
        <Terminals />
        <ContactShadows position={[0, -0.075, 0]} scale={16} blur={2.6} opacity={0.42} far={7} resolution={1024} color="#0B2545" />
      </group>

      <OrbitControls
        makeDefault
        enableZoom={false}
        enablePan={false}
        enableDamping
        target={TARGET}
        minPolarAngle={0.3}
        maxPolarAngle={1.42}
        autoRotate={control.current?.auto ?? false}
        autoRotateSpeed={0.55}
        onStart={onInteract}
      />
      <CameraRig control={control} shown={shown} />
    </SceneCtx.Provider>
  );
}

/** Keeps autorotate in sync and dollies the camera out as the machine explodes. */
function CameraRig({ control, shown }: { control: SceneProps["control"]; shown: React.RefObject<number> }) {
  const controls = useThree((s) => s.controls) as unknown as { autoRotate: boolean; target: THREE.Vector3 } | null;
  const camera = useThree((s) => s.camera);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!controls) return;
    controls.autoRotate = !!control.current?.auto;
    const e = shown.current ?? 0;
    const want = DIST_ASSEMBLED + (DIST_EXPLODED - DIST_ASSEMBLED) * e;
    const ty = TARGET[1] + 0.75 * e;
    controls.target.y += (ty - controls.target.y) * 0.15;
    dir.copy(camera.position).sub(controls.target);
    const d = dir.length();
    dir.multiplyScalar((d + (want - d) * 0.15) / d);
    camera.position.copy(controls.target).add(dir);
  });
  return null;
}

function ResponsiveCamera() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    let fov = aspect < 1.25 ? 30 * (1.25 / aspect) ** 0.85 : 30;
    if (size.height < 640) fov *= (640 / size.height) ** 0.55; // short windows: room for the control bar
    cam.fov = Math.min(55, fov);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

// ---- part wrapper: explode motion, ghosting, hover, click ---------------
const accent = new THREE.Color("#00A896");
const black = new THREE.Color(0, 0, 0);

function Part({ id, dir, children }: { id: string; dir?: Vec3; children: ReactNode }) {
  const meta = partById[id]!;
  const { shown, view, onHover, onSelect } = useScene();
  const ref = useRef<THREE.Group>(null);
  const mats = useRef<{ mat: THREE.MeshStandardMaterial; base: number }[]>([]);
  const op = useRef(1);
  const glow = useRef(0);

  useLayoutEffect(() => {
    const list: { mat: THREE.MeshStandardMaterial; base: number }[] = [];
    ref.current!.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mesh.material = mat;
      list.push({ mat, base: mat.opacity });
    });
    mats.current = list;
    return () => list.forEach((l) => l.mat.dispose());
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = partProgress(meta.start, shown.current ?? 0);
    const o = dir ?? meta.offset;
    ref.current!.position.set(o[0] * t, o[1] * t, o[2] * t);

    const v = view.current!;
    let target = 1;
    if (v.selected) target = v.selected === id ? 1 : 0.12;
    else if (v.group !== null) target = v.group === meta.group ? 1 : 0.12;
    if (id === "oil") target *= 1 - 0.75 * partProgress(0.2, shown.current ?? 0);
    const g = v.selected === id ? 0.35 : v.hovered === id ? 0.22 : 0;
    const k = 1 - Math.exp(-10 * dt);
    op.current += (target - op.current) * k;
    glow.current += (g - glow.current) * k;
    for (const { mat, base } of mats.current) {
      const a = base * op.current;
      mat.opacity = a;
      const transparent = a < 0.995;
      if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
      mat.depthWrite = id === "oil" ? false : a > 0.5;
      mat.emissive.copy(black).lerp(accent, glow.current);
    }
  });

  const hit = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (op.current < 0.4) return;
    onHover(id, e.nativeEvent.clientX, e.nativeEvent.clientY);
  };
  return (
    <group
      ref={ref}
      onPointerOver={hit}
      onPointerMove={hit}
      onPointerOut={(e) => { e.stopPropagation(); onHover(null, 0, 0); }}
      onClick={(e) => { e.stopPropagation(); if (e.delta > 5 || op.current < 0.4) return; onSelect(id); }}
    >
      {children}
    </group>
  );
}

// ---- geometry helpers ---------------------------------------------------
function SteppedLimb({ x, mat }: { x: number; mat: THREE.Material }) {
  const h = LIMB_TOP - LIMB_BOT;
  return (
    <group position={[x, LIMB_MID, 0]}>
      {STEPS.map(([w, d], i) => (
        <mesh key={i} material={mat}><boxGeometry args={[w, h, d]} /></mesh>
      ))}
    </group>
  );
}

function SteppedYoke({ y, mat }: { y: number; mat: THREE.Material }) {
  const len = LIMB_X[2]! * 2 + STEPS[0]![0];
  return (
    <group position={[0, y, 0]}>
      {STEPS.map(([w, d], i) => (
        <mesh key={i} material={mat}><boxGeometry args={[len - (2 - i) * 0.03, w * (YOKE_H / 0.36), d]} /></mesh>
      ))}
    </group>
  );
}

function hollowCylinder(rin: number, rout: number, h: number) {
  const pts = [
    new THREE.Vector2(rin, -h / 2), new THREE.Vector2(rout, -h / 2),
    new THREE.Vector2(rout, h / 2), new THREE.Vector2(rin, h / 2), new THREE.Vector2(rin, -h / 2),
  ];
  return new THREE.LatheGeometry(pts, 64);
}

// ---- assemblies ---------------------------------------------------------
function Core() {
  const { m } = useScene();
  return (
    <>
      <Part id="limbs">{LIMB_X.map((x) => <SteppedLimb key={x} x={x} mat={m.steelV} />)}</Part>
      <Part id="lowerYoke"><SteppedYoke y={LOWER_Y} mat={m.steelH} /></Part>
      <Part id="feet">
        {[-1.05, 1.05].map((x) => (
          <mesh key={x} position={[x, 0.05, 0]} material={m.clamp}><boxGeometry args={[0.34, 0.1, 0.62]} /></mesh>
        ))}
      </Part>
    </>
  );
}

function Windings() {
  const { m } = useScene();
  const lv = useMemo(() => hollowCylinder(0.215, 0.3, 1.16), []);
  const hv = useMemo(() => hollowCylinder(0.33, 0.43, 1.1), []);
  const ring = useMemo(() => hollowCylinder(0.2, 0.45, 0.035), []);
  const sticks = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const g = new THREE.BoxGeometry(0.028, 1.12, 0.03);
      g.rotateY(-a);
      g.translate(Math.cos(a) * 0.315, 0, Math.sin(a) * 0.315);
      geos.push(g);
    }
    return mergeGeometries(geos)!;
  }, []);
  return (
    <>
      <Part id="lv">{LIMB_X.map((x) => <mesh key={x} geometry={lv} material={m.copper} position={[x, LIMB_MID, 0]} />)}</Part>
      <Part id="spacers">
        {LIMB_X.map((x) => (
          <group key={x} position={[x, LIMB_MID, 0]}>
            <mesh geometry={sticks} material={m.pressboard} />
            <mesh geometry={ring} material={m.pressboard} position={[0, 0.6, 0]} />
            <mesh geometry={ring} material={m.pressboard} position={[0, -0.6, 0]} />
          </group>
        ))}
      </Part>
      <Part id="hv">{LIMB_X.map((x) => <mesh key={x} geometry={hv} material={m.copper} position={[x, LIMB_MID, 0]} />)}</Part>
    </>
  );
}

function Channel({ y, z, mat }: { y: number; z: number; mat: THREE.Material }) {
  const s = Math.sign(z);
  return (
    <group position={[0, y, z]}>
      <mesh material={mat}><boxGeometry args={[2.62, 0.3, 0.025]} /></mesh>
      <mesh material={mat} position={[0, 0.14, s * 0.04]}><boxGeometry args={[2.62, 0.025, 0.08]} /></mesh>
      <mesh material={mat} position={[0, -0.14, s * 0.04]}><boxGeometry args={[2.62, 0.025, 0.08]} /></mesh>
    </group>
  );
}

function ActivePart() {
  const { m } = useScene();
  const z = STEPS[2]![1] / 2 + 0.015;
  return (
    <>
      <Part id="upperYoke"><SteppedYoke y={UPPER_Y} mat={m.steelH} /></Part>
      <Part id="clamps" dir={[0, 1.15, 0.85]}><Channel y={UPPER_Y} z={z} mat={m.clamp} /></Part>
      <Part id="clamps" dir={[0, 1.15, -0.85]}><Channel y={UPPER_Y} z={-z} mat={m.clamp} /></Part>
      <Part id="clamps" dir={[0, 0, 0.85]}><Channel y={LOWER_Y} z={z} mat={m.clamp} /></Part>
      <Part id="clamps" dir={[0, 0, -0.85]}><Channel y={LOWER_Y} z={-z} mat={m.clamp} /></Part>
      <Part id="lugs">
        {[-1.2, 1.2].map((x) => (
          <group key={x} position={[x, UPPER_Y + 0.27, 0]}>
            <mesh material={m.clamp}><boxGeometry args={[0.04, 0.22, 0.36]} /></mesh>
            <mesh material={m.clamp} position={[0, 0.12, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.07, 0.025, 12, 28]} /></mesh>
          </group>
        ))}
      </Part>
    </>
  );
}

function Wall({ size, pos, ribs, mat, rim }: { size: Vec3; pos: Vec3; ribs: "x" | "z"; mat: THREE.Material; rim: THREE.Material }) {
  const n = ribs === "x" ? 6 : 2;
  const span = ribs === "x" ? size[0] : size[2];
  return (
    <group position={pos}>
      <mesh material={mat}><boxGeometry args={size} /></mesh>
      <mesh material={rim} position={[0, size[1] / 2 - 0.03, 0]}>
        <boxGeometry args={[size[0] + (ribs === "z" ? 0.1 : 0.12), 0.06, size[2] + (ribs === "x" ? 0.1 : 0.12)]} />
      </mesh>
      {Array.from({ length: n }, (_, i) => {
        const p = -span / 2 + (span / (n + 1)) * (i + 1);
        const out = (ribs === "x" ? Math.sign(pos[2]) : Math.sign(pos[0])) * 0.04;
        return (
          <mesh key={i} material={rim} position={ribs === "x" ? [p, -0.05, out] : [out, -0.05, p]}>
            <boxGeometry args={ribs === "x" ? [0.05, size[1] - 0.2, 0.05] : [0.05, size[1] - 0.2, 0.05]} />
          </mesh>
        );
      })}
    </group>
  );
}

function RadiatorBank({ x, side, m }: { x: number; side: 1 | -1; m: Materials }) {
  const fins = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 12; i++) {
      const g = new THREE.BoxGeometry(0.022, 1.55, 0.42);
      g.translate(-0.3 + i * 0.055, 0, 0);
      geos.push(g);
    }
    return mergeGeometries(geos)!;
  }, []);
  const zc = side * (TANK_Z + 0.36);
  return (
    <group position={[x, 1.1, zc]}>
      <mesh geometry={fins} material={m.paint} />
      {[0.86, -0.86].map((y) => (
        <group key={y}>
          <mesh material={m.paintDark} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.72, 16]} /></mesh>
          <mesh material={m.paintDark} position={[0, y, -side * 0.24]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 0.12, 16]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Tank() {
  const { m } = useScene();
  const t = 0.04;
  return (
    <>
      <Part id="tank" dir={[0, 0, 0]}>
        <mesh material={m.paint} position={[0, -0.04, 0]}><boxGeometry args={[TANK_X * 2 + t, 0.07, TANK_Z * 2 + t]} /></mesh>
        {[-1.05, 1.05].map((x) => (
          <mesh key={x} material={m.clamp} position={[x, -0.06, 0]}><boxGeometry args={[0.12, 0.04, TANK_Z * 2 + 0.2]} /></mesh>
        ))}
      </Part>
      <Part id="tank" dir={[0, 0, 1.2]}><Wall size={[TANK_X * 2 + t, TANK_H, t]} pos={[0, TANK_H / 2, TANK_Z]} ribs="x" mat={m.paint} rim={m.paintDark} /></Part>
      <Part id="tank" dir={[0, 0, -1.2]}><Wall size={[TANK_X * 2 + t, TANK_H, t]} pos={[0, TANK_H / 2, -TANK_Z]} ribs="x" mat={m.paint} rim={m.paintDark} /></Part>
      <Part id="tank" dir={[1.0, 0, 0]}><Wall size={[t, TANK_H, TANK_Z * 2]} pos={[TANK_X, TANK_H / 2, 0]} ribs="z" mat={m.paint} rim={m.paintDark} /></Part>
      <Part id="tank" dir={[-1.0, 0, 0]}><Wall size={[t, TANK_H, TANK_Z * 2]} pos={[-TANK_X, TANK_H / 2, 0]} ribs="z" mat={m.paint} rim={m.paintDark} /></Part>
      <Part id="radiators" dir={[0, 0, 1.9]}>{LIMB_X.map((x) => <RadiatorBank key={x} x={x} side={1} m={m} />)}</Part>
      <Part id="radiators" dir={[0, 0, -1.9]}>{LIMB_X.map((x) => <RadiatorBank key={x} x={x} side={-1} m={m} />)}</Part>
      <Part id="oil"><mesh material={m.oil} position={[0, 1.02, 0]}><boxGeometry args={[TANK_X * 2 - 0.04, 2.04, TANK_Z * 2 - 0.04]} /></mesh></Part>
    </>
  );
}

function Bushing({ x, z, h, sheds, m }: { x: number; z: number; h: number; sheds: number; m: Materials }) {
  const body = useMemo(() => {
    const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0), new THREE.Vector2(0.075, 0)];
    const step = h / sheds;
    for (let i = 0; i < sheds; i++) {
      const y = i * step;
      pts.push(new THREE.Vector2(0.07, y + step * 0.15));
      pts.push(new THREE.Vector2(0.125, y + step * 0.35));
      pts.push(new THREE.Vector2(0.118, y + step * 0.5));
      pts.push(new THREE.Vector2(0.068, y + step * 0.62));
    }
    pts.push(new THREE.Vector2(0.06, h), new THREE.Vector2(0, h));
    return new THREE.LatheGeometry(pts, 48);
  }, [h, sheds]);
  return (
    <group position={[x, TANK_H + 0.06, z]}>
      <mesh material={m.brass} position={[0, 0.03, 0]}><cylinderGeometry args={[0.13, 0.14, 0.06, 32]} /></mesh>
      <mesh geometry={body} material={m.porcelain} position={[0, 0.06, 0]} />
      <mesh material={m.brass} position={[0, h + 0.11, 0]}><cylinderGeometry args={[0.065, 0.07, 0.1, 24]} /></mesh>
      <mesh material={m.brass} position={[0, h + 0.2, 0]}><cylinderGeometry args={[0.022, 0.022, 0.1, 12]} /></mesh>
    </group>
  );
}

function Terminals() {
  const { m } = useScene();
  const bolts = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    const W = TANK_X + 0.04, D = TANK_Z + 0.04;
    const put = (x: number, z: number) => { const g = new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8); g.translate(x, 0, z); geos.push(g); };
    for (let i = 0; i <= 20; i++) { const x = -W + (2 * W * i) / 20; put(x, D); put(x, -D); }
    for (let i = 1; i < 8; i++) { const z = -D + (2 * D * i) / 8; put(W, z); put(-W, z); }
    return mergeGeometries(geos)!;
  }, []);
  return (
    <>
      <Part id="cover">
        <mesh material={m.paint} position={[0, TANK_H + 0.03, 0]}><boxGeometry args={[TANK_X * 2 + 0.2, 0.06, TANK_Z * 2 + 0.2]} /></mesh>
        <mesh material={m.rubber} position={[0, TANK_H - 0.005, 0]}><boxGeometry args={[TANK_X * 2 + 0.16, 0.012, TANK_Z * 2 + 0.16]} /></mesh>
        <mesh geometry={bolts} material={m.paintDark} position={[0, TANK_H + 0.075, 0]} />
        <mesh material={m.paintDark} position={[1.25, TANK_H + 0.09, 0.34]}><boxGeometry args={[0.2, 0.06, 0.14]} /></mesh>
      </Part>
      <Part id="hvBushings">{LIMB_X.map((x) => <Bushing key={x} x={x} z={-0.26} h={0.78} sheds={9} m={m} />)}</Part>
      <Part id="lvBushings">{LIMB_X.map((x) => <Bushing key={x} x={x + 0.18} z={0.32} h={0.34} sheds={4} m={m} />)}</Part>
    </>
  );
}
