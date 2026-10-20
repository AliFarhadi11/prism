"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Sound } from "@/game/audio";
import { Game } from "@/game/engine";
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

  const [mode, setMode] = useState<Mode>(start === null ? "title" : "play");
  const [index, setIndex] = useState(start ?? 0);
  const [solved, setSolved] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [announce, setAnnounce] = useState("");
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
    }));
    if (solve) game.solve();

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      // A tall screen turns the room a quarter turn, so it fills the phone.
      const rotate = w < h * 0.9;
      const [rw, rh] = rotate ? [ROOM.h, ROOM.w] : [ROOM.w, ROOM.h];
      // On a phone, keep the room clear of the header above and the puzzle numbers below.
      const [top, bottom] = rotate ? [128, 104] : [0, 0];
      const scale = Math.min(w / rw, (h - top - bottom) / rh) * 0.96;
      viewRef.current = { dpr, scale, ox: (w - rw * scale) / 2, oy: top + (h - top - bottom - rh * scale) / 2, reducedMotion: motion.matches, rotate };
      game.grabRadius = GRAB_PX / scale;
      game.touch = coarse.matches;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    motion.addEventListener("change", resize);
    coarse.addEventListener("change", resize);

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
        className="absolute inset-0 size-full touch-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-8 focus-visible:outline-paper/40"
      />

      {!playingNow && (
        <section
          aria-labelledby="title"
          className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-[linear-gradient(to_top,rgb(7_8_12/0.88)_0%,rgb(7_8_12/0.6)_45%,transparent_70%)] p-6 sm:bg-none sm:p-10 lg:p-14"
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
          <header className="pointer-events-none absolute top-5 left-5 sm:top-7 sm:left-8">
            <button
              type="button"
              onClick={backToTitle}
              aria-label="Prism, back to the title"
              className="pointer-events-auto font-serif text-[34px] leading-none tracking-[0.02em] focus-visible:outline-2 focus-visible:outline-paper/60 sm:text-[44px]"
            >
              Prism
            </button>
            <p className="mt-2.5 text-xs tracking-[0.14em] text-muted uppercase">
              {ROMAN[index]} · {level.title}
            </p>
            <p className={`mt-3 max-w-[30ch] text-xs leading-relaxed text-muted sm:hidden ${solved ? "hidden" : ""}`}>{level.lesson}</p>
            {/* Solved: said where you read, never over the room. */}
            <div aria-hidden={!solved} className={`mt-5 transition-opacity duration-[1400ms] ${solved ? "opacity-100" : "opacity-0"}`}>
              <p className="font-serif text-[clamp(34px,4vw,52px)] leading-none italic [text-shadow:0_0_32px_rgb(255_255_255/0.22)]">Light, sorted.</p>
              {index < levels.length - 1 ? (
                <button
                  type="button"
                  tabIndex={solved ? 0 : -1}
                  onClick={() => goTo(index + 1)}
                  className="pointer-events-auto mt-3 text-xs tracking-[0.16em] text-muted uppercase underline-offset-4 hover:text-paper hover:underline focus-visible:outline-2 focus-visible:outline-paper/60"
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
            className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-0.5 sm:top-8 sm:right-8 sm:bottom-auto sm:left-auto sm:translate-x-0 sm:gap-1.5"
          >
            {levels.map((l, i) => (
              <button
                key={l.id}
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === index ? "step" : undefined}
                aria-label={`Puzzle ${i + 1}: ${l.title}${done.includes(i) ? ", solved" : ""}`}
                className="relative grid size-8 place-items-center rounded-full text-[11px] text-muted transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-paper/60 aria-[current=step]:text-paper sm:size-7"
              >
                {ROMAN[i]}
                {done.includes(i) && <span aria-hidden="true" className="absolute bottom-0.5 size-1 rounded-full bg-paper/70" />}
              </button>
            ))}
          </nav>

          <p className={`pointer-events-none absolute bottom-7 left-8 hidden max-w-[38ch] text-xs leading-relaxed text-muted transition-opacity duration-700 sm:block ${solved ? "opacity-0" : ""}`}>
            {level.lesson}
            <br />
            Drag a piece to move it, drag its ends to turn it. A dot marks a piece that only turns.
          </p>
        </>
      )}

      <button
        type="button"
        onClick={() => setSoundOn(soundRef.current?.toggle() ?? true)}
        aria-pressed={soundOn}
        className="absolute right-5 bottom-5 rounded-full border border-line px-3.5 py-2 text-xs tracking-[0.12em] uppercase hover:border-paper/40 focus-visible:outline-2 focus-visible:outline-paper/60 sm:right-7 sm:bottom-6"
      >
        {soundOn ? "Sound on" : "Sound off"}
      </button>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </main>
  );
}
