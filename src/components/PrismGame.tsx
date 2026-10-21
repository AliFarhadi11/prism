"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Sound } from "@/game/audio";
import { Game, TURN_STEP } from "@/game/engine";
import { ROOM } from "@/game/levels/helpers";
import { levels } from "@/game/levels";
import { TITLE_PRISM, title } from "@/game/levels/title";
import { markSolved, progressStore, solvedFrom } from "@/game/progress";
import { draw, type View } from "@/game/render";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
/** Finger-sized reach for grabbing a piece, in CSS pixels. */
const GRAB_PX = 30;

type Mode = "title" | "play";

/**
 * The game: one canvas for the room, a few quiet lines of type around it. Starts on the title
 * screen unless a puzzle is linked (`start`).
 */
export function PrismGame({ start = null, solve = false }: { start?: number | null; solve?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const soundRef = useRef<Sound | null>(null);
  const viewRef = useRef<View>({ scale: 1, ox: 0, oy: 0, dpr: 1, reducedMotion: false, rotate: false });
  const modeRef = useRef<Mode>(start === null ? "title" : "play");
  const insetRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>(start === null ? "title" : "play");
  const [index, setIndex] = useState(start ?? 0);
  const [solved, setSolved] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [announce, setAnnounce] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const done = solvedFrom(useSyncExternalStore(progressStore.subscribe, progressStore.getSnapshot, progressStore.getServerSnapshot));
  const level = levels[index];
  const next = levels.findIndex((_, i) => !done.includes(i));

  // The game loop lives for the page; levels are swapped into the same Game.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const sound = (soundRef.current = new Sound());
    const game = (gameRef.current = new Game(start === null ? title : levels[start], {
      onTarget: (i, lit) => {
        if (modeRef.current !== "play") return;
        if (lit) sound.pluck(game.level.notes[i] * 2, 0, 0.08);
        const t = game.level.scene.targets[i];
        setAnnounce(`${t.colors.join(" and ")} target ${lit ? "lit" : "dark"}`);
      },
      onSolved: (s) => {
        if (modeRef.current !== "play") return;
        setSolved(s);
        if (s) {
          sound.chord(game.level.notes);
          setAnnounce("Solved.");
          markSolved(levels.indexOf(game.level));
        }
      },
      onSay: setAnnounce,
      onSelect: setPicked,
    }));
    if (solve) game.solve();

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    // Matches the `short` variant in globals.css.
    const short = window.matchMedia("(min-width: 40rem) and (max-height: 32.5rem)");
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      // A tall screen turns the room a quarter turn, so it fills the phone.
      const rotate = w < h * 0.9;
      const [rw, rh] = rotate ? [ROOM.h, ROOM.w] : [ROOM.w, ROOM.h];
      // On a phone, keep the room clear of the header above and the controls below (the turn
      // buttons too, on touch), and of the notch and home bar.
      const inset = getComputedStyle(insetRef.current!);
      const insetTop = Math.max(0, parseFloat(inset.paddingTop) - 20);
      const insetBottom = Math.max(0, parseFloat(inset.paddingBottom) - 12);
      // Above: the name, then up to three lines of lesson, the same for every puzzle so the room never jumps.
      // On its side, a phone has one row above (name, puzzles) and one below (lesson, buttons).
      const above = rotate ? 122 : short.matches ? 48 : 0;
      const below = rotate ? (coarse.matches ? 108 : 60) : short.matches ? 60 : coarse.matches ? 80 : 0;
      const [top, bottom] = [above && above + insetTop, below && below + insetBottom];
      const scale = Math.min(w / rw, (h - top - bottom) / rh) * (top || bottom ? 0.99 : 0.96);
      viewRef.current = { dpr, scale, ox: (w - rw * scale) / 2, oy: top + (h - top - bottom - rh * scale) / 2, reducedMotion: motion.matches, rotate };
      game.grabRadius = GRAB_PX / scale;
      game.touch = coarse.matches;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    motion.addEventListener("change", resize);
    coarse.addEventListener("change", resize);
    short.addEventListener("change", resize);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (modeRef.current === "title" && !viewRef.current.reducedMotion) {
        game.setGoal("prism", { a: TITLE_PRISM.a + Math.sin(game.time * 0.13) * 0.42 });
      }
      game.update(dt);
      if (modeRef.current === "play") sound.setLevels(game.targets);
      draw(ctx, game, viewRef.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const toRoom = (e: PointerEvent | WheelEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      const v = viewRef.current;
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      return v.rotate ? [(py - v.oy) / v.scale, ROOM.h - (px - v.ox) / v.scale] : [(px - v.ox) / v.scale, (py - v.oy) / v.scale];
    };
    const playing = () => modeRef.current === "play";
    const onDown = (e: PointerEvent) => {
      if (!playing()) return;
      sound.start();
      if (game.pointerDown(toRoom(e))) canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!playing()) return;
      game.pointerMove(toRoom(e));
      canvas.style.cursor = game.drag ? "grabbing" : game.hover ? (game.hover.mode === "turn" ? "alias" : "grab") : "default";
    };
    const onUp = () => game.pointerUp();
    const onWheel = (e: WheelEvent) => {
      if (playing() && game.wheel(toRoom(e), e.deltaY)) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!playing()) return;
      sound.start();
      if (game.key(e.key, e.shiftKey)) e.preventDefault();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      motion.removeEventListener("change", resize);
      coarse.removeEventListener("change", resize);
      short.removeEventListener("change", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKey);
      sound.setNotes([]);
    };
    // Mounted once: `start` and `solve` only set where the game begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback((i: number) => {
    const game = gameRef.current;
    if (!game || !levels[i]) return;
    modeRef.current = "play";
    setMode("play");
    game.load(levels[i]);
    const sound = soundRef.current;
    sound?.start();
    sound?.setNotes(levels[i].notes);
    setIndex(i);
    setSolved(false);
    canvasRef.current?.focus();
  }, []);

  const backToTitle = useCallback(() => {
    modeRef.current = "title";
    setMode("title");
    gameRef.current?.load(title);
    soundRef.current?.setNotes([]);
    setSolved(false);
  }, []);

  const turn = useCallback((da: number) => {
    soundRef.current?.start();
    gameRef.current?.turn(da);
  }, []);

  const playingNow = mode === "play";

  return (
    <main className="fixed inset-0 overflow-hidden bg-night text-paper">
      <canvas
        ref={canvasRef}
        tabIndex={playingNow ? 0 : -1}
        aria-label={
          playingNow
            ? `Prism, puzzle ${index + 1}: ${level.title}. Number keys or [ and ] pick a piece, arrow keys move it, Q and E turn it.`
            : "A prism slowly turning in a beam of light, spreading a rainbow across a dark room."
        }
        className="absolute inset-0 size-full touch-none outline-none select-none [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:-outline-offset-8 focus-visible:outline-paper/40"
      />

      {!playingNow && (
        <section
          aria-labelledby="title"
          className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-[linear-gradient(to_top,rgb(7_8_12/0.88)_0%,rgb(7_8_12/0.6)_45%,transparent_70%)] p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] sm:bg-none sm:p-10 sm:pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:pl-[max(2.5rem,env(safe-area-inset-left))] lg:p-14"
        >
          <div />
          <div className="max-w-[30rem]">
            <h1 id="title" className="font-serif text-[clamp(72px,12vw,148px)] leading-[0.85] tracking-[0.01em] [text-shadow:0_0_60px_rgb(255_255_255/0.18)]">
              Prism
            </h1>
            <p className="mt-6 max-w-[36ch] text-sm leading-relaxed text-muted">
              A light puzzle in nine rooms. Bend white light with mirrors and glass, split it into colour, and send each colour home.
            </p>
            <div className="pointer-events-auto mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => goTo(next === -1 ? 0 : next)}
                className="rounded-full border border-paper/60 px-6 py-3 text-xs tracking-[0.18em] uppercase transition-colors hover:bg-paper hover:text-night focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper/60"
              >
                {done.length === 0 ? "Begin" : next === -1 ? "Play again" : `Continue · ${ROMAN[next]}`}
              </button>
              <span className="text-xs tracking-[0.12em] text-muted uppercase">Sound recommended</span>
            </div>
          </div>
          <p className="text-[11px] tracking-[0.14em] text-muted uppercase">
            {done.length > 0 ? `${done.length} of ${levels.length} solved · ` : ""}By Ali Farhadi
          </p>
        </section>
      )}

      {playingNow && (
        <>
          <header className="pointer-events-none absolute top-[max(1.25rem,env(safe-area-inset-top))] left-[max(1.25rem,env(safe-area-inset-left))] sm:top-[max(1.75rem,env(safe-area-inset-top))] sm:left-[max(2rem,env(safe-area-inset-left))] short:top-[max(0.75rem,env(safe-area-inset-top))]">
            {/* On a phone the name and the puzzle share a line, to leave the room more height. */}
            <div className="flex items-baseline gap-3 sm:block short:flex">
              <button
                type="button"
                onClick={backToTitle}
                aria-label="Prism, back to the title"
                className="pointer-events-auto font-serif text-[30px] leading-none tracking-[0.02em] focus-visible:outline-2 focus-visible:outline-paper/60 sm:text-[44px] short:text-[30px]"
              >
                Prism
              </button>
              <p className="text-xs tracking-[0.14em] text-muted uppercase sm:mt-2.5 short:mt-0">
                {ROMAN[index]} · {level.title}
              </p>
            </div>
            <p className={`mt-2.5 max-w-[52ch] text-xs leading-relaxed text-muted sm:hidden ${solved ? "hidden" : ""}`}>{level.lesson}</p>
            {/* Solved: said where you read, never over the room. */}
            <div aria-hidden={!solved} className={`mt-5 transition-opacity duration-[1400ms] ${solved ? "opacity-100" : "opacity-0"}`}>
              <p className="font-serif text-[clamp(34px,4vw,52px)] leading-none italic [text-shadow:0_0_32px_rgb(255_255_255/0.22)]">Light, sorted.</p>
              {index < levels.length - 1 ? (
                <button
                  type="button"
                  tabIndex={solved ? 0 : -1}
                  onClick={() => goTo(index + 1)}
                  className="pointer-events-auto mt-1 py-2 text-xs tracking-[0.16em] text-muted uppercase underline-offset-4 hover:text-paper hover:underline focus-visible:outline-2 focus-visible:outline-paper/60"
                >
                  Next puzzle →
                </button>
              ) : (
                <p className="mt-3 text-xs tracking-[0.16em] text-muted uppercase">The last one. Thank you for playing.</p>
              )}
            </div>
          </header>

          <nav
            aria-label="Puzzles"
            className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 gap-0.5 sm:top-[max(2rem,env(safe-area-inset-top))] sm:right-[max(2rem,env(safe-area-inset-right))] short:top-[max(0.5rem,env(safe-area-inset-top))] sm:bottom-auto sm:left-auto sm:translate-x-0 sm:gap-1.5"
          >
            {levels.map((l, i) => (
              <button
                key={l.id}
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === index ? "step" : undefined}
                aria-label={`Puzzle ${i + 1}: ${l.title}${done.includes(i) ? ", solved" : ""}`}
                className="relative grid size-9 place-items-center rounded-full text-[11px] text-muted transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-paper/60 aria-[current=step]:text-paper sm:size-7"
              >
                {ROMAN[i]}
                {done.includes(i) && <span aria-hidden="true" className="absolute bottom-0.5 size-1 rounded-full bg-paper/70" />}
              </button>
            ))}
          </nav>

          {/* Touch: tap a piece, then turn it a degree at a time. Fingers are too broad to set an angle by its tips alone. */}
          <div className="absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+2.5rem)] left-1/2 hidden -translate-x-1/2 items-center gap-2 pointer-coarse:flex sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] short:bottom-[max(0.5rem,env(safe-area-inset-bottom))]">
            <TurnButton dir={-1} disabled={!picked} onTurn={turn} />
            <p aria-hidden="true" className="w-32 text-center text-[11px] tracking-[0.14em] text-muted uppercase">
              {picked ?? "Tap a piece"}
            </p>
            <TurnButton dir={1} disabled={!picked} onTurn={turn} />
          </div>

          <p className={`pointer-events-none absolute bottom-[max(1.75rem,env(safe-area-inset-bottom))] left-[max(2rem,env(safe-area-inset-left))] hidden max-w-[38ch] text-xs leading-relaxed text-muted transition-opacity duration-700 sm:block short:bottom-[max(0.75rem,env(safe-area-inset-bottom))] short:max-w-[34ch] ${solved ? "opacity-0" : ""}`}>
            {level.lesson}
            <span className="short:hidden">
              <br />
              Drag a piece to move it, drag its ends to turn it. A dot marks a piece that only turns.
            </span>
          </p>
        </>
      )}

      <button
        type="button"
        onClick={() => setSoundOn(soundRef.current?.toggle() ?? true)}
        aria-pressed={soundOn}
        aria-label="Sound"
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] grid size-10 place-items-center rounded-full border border-line text-xs sm:size-auto sm:px-3.5 sm:py-2 short:size-10 short:p-0 tracking-[0.12em] uppercase hover:border-paper/40 focus-visible:outline-2 focus-visible:outline-paper/60 active:bg-paper/10 sm:top-auto sm:right-[max(1.75rem,env(safe-area-inset-right))] sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] short:bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <span className="hidden sm:inline short:hidden">{soundOn ? "Sound on" : "Sound off"}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5 sm:hidden short:block" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9.5h3l4.5-4v13L7 14.5H4z" />
          {soundOn ? <path d="M15 9a4.2 4.2 0 0 1 0 6M17.6 6.5a7.8 7.8 0 0 1 0 11" /> : <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />}
        </svg>
      </button>

      {/* Measures the safe-area insets for the canvas layout. */}
      <div ref={insetRef} aria-hidden="true" className="pointer-events-none invisible fixed pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" />

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </main>
  );
}

/** Press to turn the selected piece a degree; hold to keep turning, faster after a moment. */
function TurnButton({ dir, disabled, onTurn }: { dir: -1 | 1; disabled: boolean; onTurn: (da: number) => void }) {
  const timer = useRef(0);
  // Set by a press, so the click that follows it doesn't turn a second time.
  const pressed = useRef(false);
  const stop = () => window.clearTimeout(timer.current);
  useEffect(() => stop, []);

  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    pressed.current = true;
    const from = performance.now();
    onTurn(dir * TURN_STEP);
    const repeat = (delay: number) => {
      timer.current = window.setTimeout(() => {
        onTurn(dir * TURN_STEP * (performance.now() - from > 1500 ? 3 : 1));
        repeat(70);
      }, delay);
    };
    stop();
    repeat(350);
    // Keep the press while a finger slides a little off the button; if capture fails, leaving stops it.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={dir < 0 ? "Turn anticlockwise" : "Turn clockwise"}
      onPointerDown={press}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onLostPointerCapture={stop}
      onClick={() => {
        // Keyboard and screen readers click without pressing.
        if (!pressed.current) onTurn(dir * TURN_STEP);
        pressed.current = false;
      }}
      className="grid size-11 place-items-center rounded-full border border-line transition-[transform,background-color,opacity] duration-100 ease-out focus-visible:outline-2 focus-visible:outline-paper/60 active:scale-95 active:bg-paper/10 disabled:opacity-30"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-5 ${dir > 0 ? "-scale-x-100" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
        <path d="M4.5 3.5v3.7h3.7" />
      </svg>
    </button>
  );
}
