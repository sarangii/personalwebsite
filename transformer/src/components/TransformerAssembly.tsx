import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { clamp01, groups, partById, parts, stageLabel } from "@/game/transformer/parts";
import type { SceneControl } from "@/game/transformer/TransformerScene";

const TransformerScene = lazy(() => import("@/game/transformer/TransformerScene"));

export function TransformerAssembly() {
  const control = useRef<SceneControl>({ explode: 0, auto: true });
  const [label, setLabel] = useState("Assembled");
  const [annotationGroup, setAnnotationGroup] = useState<number | null>(null);
  const [group, setGroup] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

  const setAuto = useCallback((v: boolean) => { control.current.auto = v; }, []);
  const stop = useCallback(() => setAuto(false), [setAuto]);

  const setExplode = useCallback((v: number) => {
    const e = clamp01(v);
    control.current.explode = e;
    setLabel(stageLabel(e));
    setAnnotationGroup(groupForExplode(e));
  }, []);

  useEffect(() => { if (matchMedia("(prefers-reduced-motion: reduce)").matches) setAuto(false); }, [setAuto]);

  // The machine moves with the document. This keeps the browser's ordinary,
  // accessible scroll behaviour while the render remains in view.
  useEffect(() => {
    let raf = 0;
    const syncToScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const range = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        setExplode(scrollY / range);
      });
    };
    syncToScroll();
    addEventListener("scroll", syncToScroll, { passive: true });
    addEventListener("resize", syncToScroll);
    return () => { cancelAnimationFrame(raf); removeEventListener("scroll", syncToScroll); removeEventListener("resize", syncToScroll); };
  }, [setExplode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") { if (e.key === "Escape") (e.target as HTMLElement).blur(); return; }
      if (e.key === "Escape") { setSelected(null); setGroup(null); }
      if (e.key === " ") { e.preventDefault(); window.scrollBy({ top: innerHeight * 0.7, behavior: "smooth" }); }
      if (e.key === "ArrowUp") { e.preventDefault(); window.scrollBy({ top: -120, behavior: "smooth" }); }
      if (e.key === "ArrowDown") { e.preventDefault(); window.scrollBy({ top: 120, behavior: "smooth" }); }
    };
    addEventListener("keydown", onKey);
    return () => { removeEventListener("keydown", onKey); };
  }, []);

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
    <main className="relative h-[520vh] select-none bg-background text-foreground max-[700px]:h-[440vh]">
      <h1 className="sr-only">Transformer Assembly — an interactive 3D mechanical study of a three-phase transformer</h1>

      <div className="sticky top-0 h-svh overflow-hidden">
      <div className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing" aria-label="3D transformer model" role="img">
        <Suspense fallback={<Loading />}>
          <TransformerScene control={control} selected={selected} group={group} onHover={onHover} onSelect={openPart} onInteract={stop} />
        </Suspense>
      </div>

      <ProcessRail activeGroup={annotationGroup} label={label} />

      {hovered && hover && !part && (
        <div className="pointer-events-none fixed z-20 max-w-[min(270px,80vw)] border-l-2 border-accent bg-popover/95 px-3.5 py-2.5 text-xs leading-[1.7] text-popover-foreground"
          style={{ left: hover.x + 16, top: hover.y + 12 }}>
          {hovered.name}
          <small className="block text-[10px] tracking-[0.1em] text-chip-muted">{hovered.meta}</small>
        </div>
      )}

      <header className="ui-wake pointer-events-none fixed inset-x-[34px] top-[76px] flex justify-between text-[10px] uppercase leading-[1.9] tracking-[0.15em] max-[700px]:inset-x-5 max-[700px]:top-[58px]">
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
        <aside aria-live="polite" aria-label="Components revealed by the exploded view" className="technical-callouts ink-in pointer-events-none fixed bottom-[72px] right-[34px] z-10 w-[min(330px,33vw)] text-popover-foreground max-[700px]:bottom-[54px] max-[700px]:right-[18px] max-[700px]:w-[min(260px,65vw)]">
          <div className="technical-kicker"><span>0{annotationGroup + 1}</span> {groups[annotationGroup]!.title}</div>
          <h2 className="mt-2 font-serif text-xl leading-tight">Component annotations</h2>
          <ul className="mt-3 space-y-2.5">
            {annotatedParts.map((item) => (
              <li key={item.id} className="technical-item text-[10px] leading-[1.5]">
                <span className="technical-index">{item.meta.split(" · ")[1]}</span>
                <span><strong>{item.name}</strong><span className="block text-muted-foreground">{item.note}</span></span>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {annotationGroup === null && (
        <div className="ui-wake pointer-events-none fixed bottom-[116px] left-[34px] text-[9px] tracking-[0.1em] text-muted-foreground opacity-70 max-[700px]:hidden">
          Scroll to disassemble · Drag to rotate · Click a part to inspect · Esc to go back
        </div>
      )}
      </div>
    </main>
  );
}

function ProcessRail({ activeGroup, label }: { activeGroup: number | null; label: string }) {
  const steps = ["Terminals", "Tank & cooling", "Active part", "Windings", "Core"];
  const revealed = activeGroup === null ? -1 : 4 - activeGroup;
  return (
    <nav aria-label="Assembly sequence" className="ui-wake process-rail fixed left-[34px] right-[34px] top-[30px] z-10 flex items-center gap-2 text-[9px] uppercase tracking-[0.13em] max-[700px]:left-[18px] max-[700px]:right-[18px] max-[700px]:top-[18px]">
      {steps.map((step, i) => <div key={step} className={`process-step ${i <= revealed ? "is-active" : ""}`}><span>{String(i + 1).padStart(2, "0")}</span><b>{step}</b></div>)}
      <span className="ml-auto hidden text-chip-muted min-[850px]:inline">{label} →</span>
    </nav>
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

