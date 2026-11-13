# Logic Puzzles

[![Deploy](https://github.com/acroca/pwagames/actions/workflows/deploy.yml/badge.svg)](https://github.com/acroca/pwagames/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[▶ Play at acroca.com/pwagames](https://acroca.com/pwagames/)**

A free, open-source Progressive Web App with twelve logic puzzle games, designed for phones.
No ads, no accounts, works offline.

Every puzzle is generated on the fly, has exactly one solution, and can be solved by logic
alone — no guessing needed.

<p align="center">
  <img src="docs/menu.png" width="260" alt="Game menu" />
</p>

## Install

Open the link above on your phone and tap **Install app**, or:

- **iPhone / iPad**: in Safari, **Share → Add to Home Screen**.
- **Android**: in the browser menu (⋮), **Install app** or **Add to Home screen**.

It then runs full-screen and works offline.

## Games

<table>
  <tr>
    <td align="center" width="25%"><img src="docs/nonogram.png" width="180" alt="Nonogram" /><br /><b>Nonogram</b><br /><sub>10×10</sub></td>
    <td align="center" width="25%"><img src="docs/binairo.png" width="180" alt="Binairo (Takuzu)" /><br /><b>Binairo (Takuzu)</b><br /><sub>6×6, 8×8, 10×10</sub></td>
    <td align="center" width="25%"><img src="docs/queens.png" width="180" alt="Queens (Star Battle)" /><br /><b>Queens (Star Battle)</b><br /><sub>7×7 – 10×10</sub></td>
    <td align="center" width="25%"><img src="docs/sudoku.png" width="180" alt="Sudoku" /><br /><b>Sudoku</b><br /><sub>4×4, 6×6, 9×9 (easy, medium, hard)</sub></td>
  </tr>
  <tr>
    <td align="center" width="25%"><img src="docs/killer.png" width="180" alt="Killer Sudoku" /><br /><b>Killer Sudoku</b><br /><sub>Easy, medium, hard</sub></td>
    <td align="center" width="25%"><img src="docs/kenken.png" width="180" alt="KenKen" /><br /><b>KenKen</b><br /><sub>4×4, 5×5, 6×6</sub></td>
    <td align="center" width="25%"><img src="docs/futoshiki.png" width="180" alt="Futoshiki" /><br /><b>Futoshiki</b><br /><sub>5×5, 6×6</sub></td>
    <td align="center" width="25%"><img src="docs/kakuro.png" width="180" alt="Kakuro" /><br /><b>Kakuro</b><br /><sub>6×6, 8×8 (including clue cells)</sub></td>
  </tr>
  <tr>
    <td align="center" width="25%"><img src="docs/hitori.png" width="180" alt="Hitori" /><br /><b>Hitori</b><br /><sub>6×6, 7×7, 8×8</sub></td>
    <td align="center" width="25%"><img src="docs/nurikabe.png" width="180" alt="Nurikabe" /><br /><b>Nurikabe</b><br /><sub>7×7 – 10×10</sub></td>
    <td align="center" width="25%"><img src="docs/slitherlink.png" width="180" alt="Slitherlink" /><br /><b>Slitherlink</b><br /><sub>5×5, 6×6, 7×7</sub></td>
    <td align="center" width="25%"><img src="docs/minesweeper.png" width="180" alt="Minesweeper (no guessing)" /><br /><b>Minesweeper (no guessing)</b><br /><sub>9×9, 9×16</sub></td>
  </tr>
</table>

## Shared features

Every game has the same app bar and behaviour:

- **Menu cards** list the games, with the in-progress puzzle or your best time.
- **Undo** steps back through your moves; **Check** flags entries that contradict the
  solution. (Minesweeper has neither: opening a mine ends the game, with an option to retry
  the same board.)
- A **timer** runs while the game is on screen and stops when it's solved; best times are kept
  per game and size.
- Progress is **saved automatically** (per game), so you can switch games and come back.
- **English and Spanish**: the language follows the phone's language by default; switch it with
  the EN / ES selector on the menu. Translations live in `src/core/es.ts` and `src/core/guides.ts`.
- **Rules**: the menu's Rules button (and *How to play* in each game's sheet) explains every game
  with examples.
- **New** opens a sheet to pick a size or difficulty, start a new puzzle, restart the current
  one, change game settings, and read the rules.

## Puzzle generation

Generators live next to each game in `src/games/<game>/logic.ts` and are pure functions of a
size/difficulty and a seed. They run in a Web Worker (`src/core/worker.ts`) with a loading
indicator, so the UI never freezes.

Each generator pairs a *logic solver* (constraint propagation using human techniques only)
with a *counting solver* (propagation + backtracking that stops after finding two solutions).
A puzzle is only accepted if the logic solver solves it completely, which proves its solution
is unique and reachable without guessing. Tests check every generated puzzle with the counting
solver and an independent rule checker.

- **Nonogram**: random pictures are kept only if a line solver fully solves them.
- **Binairo**: givens are removed from a random valid grid while a line solver (no triples,
  balance, unique lines) can still solve it, down to about 30% of the cells.
- **Queens**: regions are grown around a random queen placement, then reshaped by hill-climbing
  until a solver using singles, region/line confinement and one-step lookahead solves it;
  puzzles that need only singles are rejected as too easy.
- **Sudoku**: clues are removed from a random grid while the solution stays unique and a human-
  style solver still finishes it at the chosen level: singles (easy); locked candidates and
  pairs (medium, singles alone must fail); triples, X-Wing, Swordfish and XY-Wing (hard,
  medium techniques must fail).
- **Killer Sudoku**: cages are grown over a random grid, then split (or, on easy, given a
  digit) wherever the solver gets stuck. Levels add cage combinations, the rule of 45 over
  houses and groups of houses, and innie/outie differences; medium and hard have no givens.
- **KenKen**: random cages over a random Latin square, with operations re-picked (then cages
  redrawn) until a solver using cage enumeration, cage-confined digits and naked/hidden
  subsets solves it; puzzles that fall to cage arithmetic plus singles are rejected.
- **Futoshiki**: signs and a few givens are drawn from a random Latin square and thinned while
  a solver using inequality chains, singles and subsets still solves it.
- **Kakuro**: a symmetric layout of runs is filled with random digits; runs the solver can't
  crack are refilled with low/high digits (fewer combinations) until per-run combination
  logic solves the whole grid.
- **Hitori**: a random connected, non-touching shading is laid over a random Latin square and
  each shaded cell copies a number from its row or column; layouts are re-rolled until a solver
  using sandwich/pair patterns, shade/unshade propagation and connectivity (cut cells) solves it.
- **Nurikabe**: islands are grown on an all-sea grid (no 2×2 pools, connected sea), then a
  local search flips cells or moves numbers near whatever the solver can't decide, until a solver
  using reachability, sea/island bottlenecks, pool rules and per-island completions solves it.
- **Slitherlink**: the loop is the outline of a random hole-free region; clues are removed in
  random order while a solver using cell counts, dot degrees, no premature loops, inside/outside
  colouring and 2×2 block enumeration still solves it.
- **Minesweeper**: mines are placed after your first tap, outside its 3×3 area; while a
  simulated player using single/pair rules, frontier enumeration and the mine count gets stuck,
  a mine is moved off the stuck frontier (or the layout is redrawn).

## Project layout

```
src/main.ts              menu + routing
src/core/                shell (app bar, timer, undo, check, autosave), worker, input helpers,
                         number pad shared by the number games
src/games/registry.ts    games in menu order
src/games/generators.ts  generator table used by the worker
src/games/<game>/        logic.ts (generator + solvers), index.ts (UI), tests
```

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests (Vitest)
npm run build    # type-check + production build into dist/
npm run icons    # regenerate PWA icons in public/
```

## Deployment

`.github/workflows/deploy.yml` tests, builds, and publishes to GitHub Pages on every push to
`main`. The repository's Pages source must be set to **GitHub Actions**
(Settings → Pages → Build and deployment).

## Privacy

No accounts, no cookies, no ads. Progress and best times stay in your browser's local storage.
Anonymous usage counts (page views, which game was opened, new puzzles started) are collected
with [GoatCounter](https://www.goatcounter.com/), which stores no personal data.

## Contributing

Bug reports, ideas and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Albert Callarisa
