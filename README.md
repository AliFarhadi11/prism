# Prism

A light puzzle for the browser. Bend white light with mirrors and glass, split it into colours, and send each colour to its target.

Each of the nine puzzles adds one idea: mirrors, walls, a prism, filters, half-silvered mirrors, mixing colours, and finally the whole spectrum. Light is traced as 32 separate wavelengths. Glass bends each one by a slightly different amount (Cauchy's equation), so the rainbow comes out of the physics and isn't drawn on afterwards.

## Playing

- **Mouse or touch:** drag a piece's body to move it, or drag its ends or corners to turn it. The scroll wheel also turns it.
- **Keyboard:** number keys or `[` and `]` pick a piece, arrow keys move it, `Q` and `E` turn it. Hold `Shift` for bigger steps.
- Some pieces only turn and some don't move at all.
- Progress is saved in the browser. `?p=3` links straight to puzzle three.

## Running it

You need Node 22.18 or newer and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

In development, `?p=3&solve` opens puzzle three with its pieces already in the solved position.

```bash
pnpm test       # optics, engine, and a solvability check for every puzzle
pnpm typecheck
pnpm lint
pnpm build
```

## How it's put together

Built with Next.js, React and Tailwind. The game runs on a single canvas.

| Path | What's there |
| --- | --- |
| `src/game/light.ts` | Wavelengths, refractive index, and how wavelengths map to colour |
| `src/game/optics.ts` | Pieces (mirrors, prisms, filters, half mirrors, walls) and the ray tracer |
| `src/game/engine.ts` | Game state, dragging and keyboard input, target checks |
| `src/game/puzzle.ts` | When a target counts as lit and when a puzzle is solved |
| `src/game/render.ts` | Canvas drawing |
| `src/game/audio.ts` | Web Audio sounds |
| `src/game/levels/` | One file per puzzle, each with its solution |
| `src/components/PrismGame.tsx` | The page: title screen, puzzle list, input wiring |

## License

[MIT](LICENSE)
