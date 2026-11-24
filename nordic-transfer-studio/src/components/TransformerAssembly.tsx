import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { autoplayStep, clamp01, groups, partById, parts, stageLabel } from "@/game/transformer/parts";
import type { SceneControl } from "@/game/transformer/TransformerScene";
import { videoUrl } from "./assembly-data";

const TransformerScene = lazy(() => import("@/game/transformer/TransformerScene"));

export function TransformerAssembly() {
  const control = useRef<SceneControl>({ explode: 0, auto: true });
  const sliderRef = useRef<HTMLInputElement>(null);
  const percentRef = useRef<HTMLOutputElement>(null);
  const [auto, setAutoState] = useState(true);
  const [label, setLabel] = useState("Assembled");
  const [group, setGroup] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [query, setQuery] = useState("");
  const [video, setVideo] = useState(false);

  const setAuto = useCallback((v: boolean) => { control.current.auto = v; setAutoState(v); }, []);
  const stop = useCallback(() => setAuto(false), [setAuto]);

  const setExplode = useCallback((v: number) => {
    const e = clamp01(v);
    control.current.explode = e;
    if (sliderRef.current) sliderRef.current.value = String(e * 100);
    if (percentRef.current) percentRef.current.textContent = `${Math.round(e * 100)}%`;
    setLabel(stageLabel(e));
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
      if (video) return;
      if ((e.target as HTMLElement)?.closest?.("[data-ui]")) return;
      e.preventDefault(); stop();
      setExplode(control.current.explode + e.deltaY / 1600);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") { if (e.key === "Escape") (e.target as HTMLElement).blur(); return; }
      if (e.key === "Escape") { setSelected(null); setGroup(null); setVideo(false); }
      if (e.key === " ") { e.preventDefault(); setAuto(!control.current.auto); }
      if (e.key === "ArrowUp") { stop(); setExplode(control.current.explode + 0.02); }
      if (e.key === "ArrowDown") { stop(); setExplode(control.current.explode - 0.02); }
    };
    addEventListener("wheel", onWheel, { passive: false });
    addEventListener("keydown", onKey);
    return () => { removeEventListener("wheel", onWheel); removeEventListener("keydown", onKey); };
  }, [setExplode, setAuto, stop, video]);

  const openPart = useCallback((id: string) => {
    const p = partById[id]!;
    stop(); setSelected(id); setGroup(p.group);
    setExplode(Math.max(control.current.explode, groups[p.group]!.focus));
  }, [setExplode, stop]);
  const step = (d: number) => {
    const i = parts.findIndex((p) => p.id === selected);
    openPart(parts[(i + d + parts.length) % parts.length]!.id);
  };
  const chooseGroup = (g: number | null) => {
    stop(); setSelected(null); setGroup(g);
    if (g !== null) setExplode(groups[g]!.focus);
  };
  const home = () => { stop(); setSelected(null); setGroup(null); setExplode(0); };

  const onHover = useCallback((id: string | null, x: number, y: number) => {
    setHover(id ? { id, x, y } : null);
    document.body.style.cursor = id ? "pointer" : "";
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return parts.filter((p) => (p.name + " " + p.meta).toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  const part = selected ? partById[selected]! : null;
  const hovered = hover ? partById[hover.id]! : null;

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

      <div className="ui-wake pointer-events-none fixed bottom-[116px] left-[34px] text-[9px] tracking-[0.1em] text-muted-foreground opacity-70 max-[700px]:hidden">
        Scroll to explode · Drag to rotate · Click a part to inspect · Esc to go back
      </div>

      <div data-ui className="ui-wake fixed bottom-[18px] left-1/2 z-10 w-[min(820px,94vw)] -translate-x-1/2 rounded-3xl border border-border bg-card/95 px-3.5 pb-3 pt-2.5 text-[10px] tracking-[0.04em] shadow-bar max-[700px]:bottom-2.5 max-[700px]:px-2.5 max-[700px]:pb-2 max-[700px]:pt-1.5">
        {matches.length > 0 && (
          <ul className="absolute bottom-full right-3 mb-2 w-56 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-bar">
            {matches.map((p) => (
              <li key={p.id}>
                <button onClick={() => { openPart(p.id); setQuery(""); }} className="flex w-full justify-between px-3.5 py-2 text-left hover:bg-chip-hover">
                  <span className="text-card-foreground">{p.name}</span><span className="text-[9px] text-chip-muted">{groups[p.group]!.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex min-h-8 items-center gap-2">
          <Pill on={auto} onClick={() => setAuto(!auto)} aria-pressed={auto}>{auto ? "Ⅱ Pause" : "▶ Play"}</Pill>
          <Pill onClick={home} title="Back to full machine">Machine</Pill>
          <input ref={sliderRef} type="range" min={0} max={100} step={0.1} defaultValue={0} aria-label="Exploded-view progress"
            onChange={(e) => { stop(); setExplode(+e.target.value / 100); }}
            className="h-6 min-w-[50px] flex-1 cursor-ew-resize" />
          <output ref={percentRef} className="w-8 tabular-nums text-chip-muted">0%</output>
          {videoUrl && <Pill onClick={() => { stop(); setVideo(true); }} className="max-[700px]:hidden">Film</Pill>}
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parts…" aria-label="Search parts"
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { openPart(matches[0].id); setQuery(""); } }}
            className="min-h-8 w-[124px] rounded-full border border-input bg-secondary px-[11px] py-1.5 text-secondary-foreground outline-none placeholder:text-chip-muted focus:border-accent focus:bg-card max-[700px]:w-[76px]" />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2 max-[700px]:gap-0.5">
          <Chip on={group === null} onClick={() => chooseGroup(null)}>All</Chip>
          {groups.map((g, i) => <Chip key={g.title} on={group === i} onClick={() => chooseGroup(i)}>{g.title}</Chip>)}
        </div>
      </div>

      {video && videoUrl && (
        <div role="dialog" aria-modal aria-label="Assembly film" onClick={() => setVideo(false)} className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-6 backdrop-blur-sm">
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <video src={videoUrl} controls autoPlay playsInline className="w-full rounded-3xl bg-stone shadow-bar" />
            <button onClick={() => setVideo(false)} className="mt-3 text-[11px] tracking-[0.1em] text-primary">← Back to the machine</button>
          </div>
        </div>
      )}
    </main>
  );
}

function Loading() {
  return <div className="grid h-full place-items-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Loading machine…</div>;
}

function Pill({ on, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button {...props}
      className={`min-h-8 whitespace-nowrap rounded-full px-3 py-1.5 transition-[background,color,transform] duration-200 active:scale-[0.97] ${on ? "bg-chip text-chip-foreground" : "text-foreground hover:bg-chip-hover hover:text-chip-foreground"} ${className}`} />
  );
}

function Chip({ on, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button aria-pressed={on} {...props}
      className={`min-h-7 whitespace-nowrap rounded-full px-2.5 py-1 transition-colors duration-200 max-[700px]:text-[9px] ${on ? "bg-chip text-chip-foreground" : "text-chip-muted hover:bg-chip-hover hover:text-chip-foreground"}`} />
  );
}
