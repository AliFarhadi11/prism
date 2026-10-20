"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sound } from "@/game/audio";
import { Game } from "@/game/engine";
import { ROOM } from "@/game/levels/helpers";
import { levels } from "@/game/levels";
import { draw, type View } from "@/game/render";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const SAVE = "prism.solved";

function readSolved(): number[] {
  try {
    return JSON.parse(localStorage.getItem(SAVE) ?? "[]");
  } catch {
    return [];
  }
}

/** The game: one canvas for the room, a few quiet lines of type around it. */
export function PrismGame({ start = 0, solve = false }: { start?: number; solve?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const soundRef = useRef<Sound | null>(null);
  const viewRef = useRef<View>({ scale: 1, ox: 0, oy: 0, dpr: 1, reducedMotion: false });

  const [index, setIndex] = useState(start);
  const [solved, setSolved] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [announce, setAnnounce] = useState("");
  const level = levels[index];

  // The game loop lives for the page; levels are swapped into the same Game.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const sound = (soundRef.current = new Sound());
    const game = (gameRef.current = new Game(levels[start], {
      onTarget: (i, lit) => {
        if (lit) sound.pluck(game.level.notes[i] * 2, 0, 0.08);
        const t = game.level.scene.targets[i];
        setAnnounce(`${t.colors.join(" and ")} target ${lit ? "lit" : "dark"}`);
      },
      onSolved: (s) => {
        setSolved(s);
        if (s) {
          sound.chord(game.level.notes);
          setAnnounce("Solved.");
          const done = new Set(readSolved());
          done.add(levels.indexOf(game.level));
          try {
            localStorage.setItem(SAVE, JSON.stringify([...done]));
          } catch {}
        }
      },
      onSay: setAnnounce,
    }));

    if (solve) game.solve();

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      const scale = Math.min(canvas.clientWidth / ROOM.w, canvas.clientHeight / ROOM.h) * 0.96;
      viewRef.current = {
        dpr,
        scale,
        ox: (canvas.clientWidth - ROOM.w * scale) / 2,
        oy: (canvas.clientHeight - ROOM.h * scale) / 2,
        reducedMotion: motion.matches,
      };
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    motion.addEventListener("change", resize);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      game.update(dt);
      sound.setLevels(game.targets);
      draw(ctx, game, viewRef.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const toRoom = (e: PointerEvent | WheelEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      const v = viewRef.current;
      return [(e.clientX - r.left - v.ox) / v.scale, (e.clientY - r.top - v.oy) / v.scale];
    };
    const wake = () => {
      const first = !soundStarted;
      sound.start();
      if (first) {
        soundStarted = true;
        sound.setNotes(game.level.notes);
      }
    };
    let soundStarted = false;
    const onDown = (e: PointerEvent) => {
      wake();
      if (game.pointerDown(toRoom(e))) canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      game.pointerMove(toRoom(e));
      canvas.style.cursor = game.drag ? "grabbing" : game.hover ? (game.hover.mode === "turn" ? "alias" : "grab") : "default";
    };
    const onUp = () => game.pointerUp();
    const onWheel = (e: WheelEvent) => {
      if (game.wheel(toRoom(e), e.deltaY)) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      wake();
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
    game.load(levels[i]);
    soundRef.current?.setNotes(levels[i].notes);
    setIndex(i);
    setSolved(false);
    canvasRef.current?.focus();
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-night text-paper">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label={`Prism, puzzle ${index + 1}: ${level.title}. Number keys or [ and ] pick a piece, arrow keys move it, Q and E turn it.`}
        className="absolute inset-0 size-full touch-none outline-none focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-paper/40"
      />

      <header className="pointer-events-none absolute top-7 left-8">
        <h1 className="font-serif text-[44px] leading-none tracking-[0.02em]">Prism</h1>
        <p className="mt-2.5 text-xs tracking-[0.14em] text-muted uppercase">
          {ROMAN[index]} · {level.title}
        </p>
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

      <nav aria-label="Puzzles" className="absolute top-8 right-8 flex gap-1.5">
        {levels.map((l, i) => (
          <button
            key={l.id}
            type="button"
            onClick={() => goTo(i)}
            aria-current={i === index ? "step" : undefined}
            aria-label={`Puzzle ${i + 1}: ${l.title}`}
            className="grid size-7 place-items-center rounded-full text-[11px] text-muted transition-colors hover:text-paper aria-[current=step]:text-paper focus-visible:outline-2 focus-visible:outline-paper/60"
          >
            {ROMAN[i]}
          </button>
        ))}
      </nav>

      <p className={`pointer-events-none absolute bottom-7 left-8 max-w-[38ch] text-xs leading-relaxed text-muted transition-opacity duration-700 ${solved ? "opacity-0" : ""}`}>
        {level.lesson}
        <br />
        Drag a piece to move it, drag its ends to turn it. A dot marks a piece that only turns.
      </p>

      <button
        type="button"
        onClick={() => setSoundOn(soundRef.current?.toggle() ?? true)}
        aria-pressed={soundOn}
        className="absolute right-7 bottom-6 rounded-full border border-line px-3.5 py-2 text-xs tracking-[0.12em] uppercase hover:border-paper/40 focus-visible:outline-2 focus-visible:outline-paper/60"
      >
        {soundOn ? "Sound on" : "Sound off"}
      </button>


      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </main>
  );
}
