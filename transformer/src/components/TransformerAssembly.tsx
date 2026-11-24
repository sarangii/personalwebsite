import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { autoplayStep, clamp01, groups, partById, parts, stageLabel } from "@/game/transformer/parts";
import type { SceneControl } from "@/game/transformer/TransformerScene";

const TransformerScene = lazy(() => import("@/game/transformer/TransformerScene"));

export function TransformerAssembly() {
  const control = useRef<SceneControl>({ explode: 0, auto: true });
  const [auto, setAutoState] = useState(true);
  const [label, setLabel] = useState("Assembled");
  const [annotationGroup, setAnnotationGroup] = useState<number | null>(null);
  const [group, setGroup] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

  const setAuto = useCallback((v: boolean) => { control.current.auto = v; setAutoState(v); }, []);
  const stop = useCallback(() => setAuto(false), [setAuto]);

  const setExplode = useCallback((v: number) => {
    const e = clamp01(v);
    control.current.explode = e;
    setLabel(stageLabel(e));
    setAnnotationGroup(groupForExplode(e));
  }, []);

  useEffect(() => { if (matchMedia("(prefers-reduced-motion: reduce)").matches) setAuto(false); }, [setAuto]);

  // autoplay: explode → hold → assemble → hold …
  useEffect(() => {
    if (!auto) return;
    let raf = 0, last = performance.now(), dir: 1 | -1 = control.current.explode >= 1 ? -1 : 1, hold = 1;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (hold > 0) hold -= dt;
      else {
        const s = autoplayStep(control.current.explode, dir, dt);
        dir = s.dir; if (s.turned) hold = 1.6;
        setExplode(s.explode);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto, setExplode]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement)?.closest?.("[data-ui]")) return;
      e.preventDefault(); stop();
      setExplode(control.current.explode + e.deltaY / 1600);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") { if (e.key === "Escape") (e.target as HTMLElement).blur(); return; }
      if (e.key === "Escape") { setSelected(null); setGroup(null); }
      if (e.key === " ") { e.preventDefault(); setAuto(!control.current.auto); }
      if (e.key === "ArrowUp") { stop(); setExplode(control.current.explode + 0.02); }
      if (e.key === "ArrowDown") { stop(); setExplode(control.current.explode - 0.02); }
    };
    addEventListener("wheel", onWheel, { passive: false });
    addEventListener("keydown", onKey);
    return () => { removeEventListener("wheel", onWheel); removeEventListener("keydown", onKey); };
  }, [setExplode, setAuto, stop]);

  const openPart = useCallback((id: string) => {
    const p = partById[id]!;
    stop(); setSelected(id); setGroup(p.group);
    setExplode(Math.max(control.current.explode, groups[p.group]!.focus));
  }, [setExplode, stop]);
  const step = (d: number) => {
    const i = parts.findIndex((p) => p.id === selected);
    openPart(parts[(i + d + parts.length) % parts.length]!.id);
  };
  const onHover = useCallback((id: string | null, x: number, y: number) => {
    setHover(id ? { id, x, y } : null);
    document.body.style.cursor = id ? "pointer" : "";
  }, []);

  const part = selected ? partById[selected]! : null;
  const hovered = hover ? partById[hover.id]! : null;
  const annotatedParts = annotationGroup === null ? [] : parts.filter((p) => p.group === annotationGroup);

  return (
    <main className="fixed inset-0 select-none overflow-hidden bg-background text-foreground">
      <h1 className="sr-only">Transformer Assembly — an interactive 3D mechanical study of a three-phase transformer</h1>

      <div className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" aria-label="3D transformer model" role="img">
        <Suspense fallback={<Loading />}>
          <TransformerScene control={control} selected={selected} group={group} onHover={onHover} onSelect={openPart} onInteract={stop} />
        </Suspense>
      </div>

      {hovered && hover && !part && (
        <div className="pointer-events-none fixed z-20 max-w-[min(270px,80vw)] border-l-2 border-accent bg-popover/95 px-3.5 py-2.5 text-xs leading-[1.7] text-popover-foreground"
          style={{ left: hover.x + 16, top: hover.y + 12 }}>
          {hovered.name}
          <small className="block text-[10px] tracking-[0.1em] text-chip-muted">{hovered.meta}</small>
        </div>
      )}

      <header className="ui-wake pointer-events-none fixed inset-x-[34px] top-[30px] flex justify-between text-[10px] uppercase leading-[1.9] tracking-[0.15em] max-[700px]:inset-x-5 max-[700px]:top-5">
        <div>
          <span>Transformer / Mechanical Studies</span>
          <div className="text-xs tracking-[0.24em] text-title">A flux, a current.</div>
          <div className="mt-1 text-[9px] normal-case tracking-[0.15em] text-muted-foreground">Let the power find its path.</div>
        </div>
        <div className="text-right max-[700px]:hidden">
          3 phases. 6 bushings.
          <div className="mt-1 text-[9px] text-muted-foreground">{label}</div>
          <div className="mt-1 text-[9px] text-muted-foreground">{parts.length} parts / Electrical study</div>
        </div>
      </header>

      {part && (
        <aside data-ui aria-label="Part close-up" className="ink-in fixed right-[30px] top-[112px] z-10 max-w-[250px] border-l border-inspector-rule bg-popover/95 px-[15px] py-3 text-[11px] leading-[1.7] text-popover-foreground max-[700px]:right-[18px] max-[700px]:top-[85px] max-[700px]:max-w-[205px]">
          <button onClick={() => { setSelected(null); setGroup(null); }} className="min-h-8 pb-2 text-[11px] text-primary">← Back to overview</button>
          <div className="text-[9px] tracking-[0.12em] text-chip-muted">{part.meta}</div>
          <div className="mt-0.5 font-serif text-[17px] leading-normal max-[700px]:text-sm">{part.name}</div>
          <p className="mt-2 text-[10px] leading-[1.8] text-muted-foreground max-[700px]:hidden">{part.note}</p>
          <div className="mt-3 flex justify-between text-[10px]">
            <button onClick={() => step(-1)} aria-label="Previous part" className="min-h-[30px] hover:text-chip-foreground">← Prev</button>
            <button onClick={() => step(1)} aria-label="Next part" className="min-h-[30px] hover:text-chip-foreground">Next →</button>
          </div>
        </aside>
      )}

      {!part && annotationGroup !== null && (
        <aside aria-live="polite" aria-label="Components revealed by the exploded view" className="ink-in pointer-events-none fixed bottom-[88px] left-[34px] z-10 max-w-[260px] border-l-2 border-accent bg-popover/95 px-3.5 py-3 text-popover-foreground max-[700px]:bottom-[72px] max-[700px]:left-[18px] max-[700px]:max-w-[205px]">
          <div className="text-[9px] tracking-[0.14em] text-chip-muted">NOW REVEALING</div>
          <h2 className="mt-0.5 font-serif text-lg leading-tight">{groups[annotationGroup]!.title}</h2>
          <ul className="mt-2 space-y-2">
            {annotatedParts.map((item) => (
              <li key={item.id} className="text-[10px] leading-[1.55]">
                <span className="font-medium text-primary">{item.name}</span>
                <span className="block text-muted-foreground">{item.note}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {annotationGroup === null && (
        <div className="ui-wake pointer-events-none fixed bottom-[116px] left-[34px] text-[9px] tracking-[0.1em] text-muted-foreground opacity-70 max-[700px]:hidden">
          Scroll to explode · Drag to rotate · Click a part to inspect · Esc to go back
        </div>
      )}

    </main>
  );
}

/** Which assembly is being separated at a given point in the scroll-driven view. */
function groupForExplode(explode: number): number | null {
  if (explode <= 0.005) return null;
  if (explode < 0.12) return 4;
  if (explode < 0.35) return 3;
  if (explode < 0.5) return 2;
  if (explode < 0.8) return 1;
  return 0;
}

function Loading() {
  return <div className="grid h-full place-items-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Loading machine…</div>;
}

