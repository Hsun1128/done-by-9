# 21:00 前，全部搞定 (done-by-nine)

A free 3D browser game about one day of taking care of two kids. 07:00 breakfast, your partner
leaves for work, and you hold the house together until they walk back in at 21:00. You walk
around a whole flat (living room, kids' room, bathroom, balcony) and out into the neighbourhood
(supermarket, pharmacy, park, school gate) with WASD / arrows / tap the floor / an on-screen stick.
Everything costs something: **time, NT$, energy, patience, a full stomach and a bladder that never stops rising.**

Free, no login, mobile-first, Traditional Chinese, 3D (three.js; WebGL required, no 2D fallback).
Characters and events are fictional.

## Quickstart

Requires Node 22+.

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + tests (about 40 s; balance tests simulate whole days)
npm run build      # production bundle in dist/
```

Replay a specific day: `http://localhost:5173/?seed=42` (each replay uses seed+1).

Optional configuration (all typed and validated at startup in `src/config.ts`):

```sh
cp .env.example .env   # VITE_SITE_URL, VITE_ANALYTICS_URL, VITE_CTA_URL
```

## How it plays

| Input                     | Does                                                     |
| ------------------------- | -------------------------------------------------------- |
| WASD / arrows / stick     | Walk. The clock never stops while you walk or stand.     |
| Tap the floor             | Walk there, around the furniture.                        |
| `G` or 帶我去              | Auto-walk to what matters next (red `!` first).          |
| `E`                       | Talk to the kid / handle the event in this room.         |
| `1`–`4`, `Esc`            | Pick a spoken line; leave without choosing (free).       |
| `R`                       | Look after yourself here: eat, rest, coffee, toilet.     |
| `F`                       | Do the chore by hand: a little game (cook, scrub, quiz, pack). |
| `B`                       | Deep breath (patience back, 3 minutes).                  |

* **The clock runs in real time** (about 1.1 game minutes per second; a day is roughly 10-12 minutes of
  play). It stops only while you read a conversation, a result card or play a chore game; every choice and
  chore then jumps it forward, so answering one thing lets the others run out.
* **A live to-do list** sits beside the room: every open event with a shrinking bar, every kid's current
  task with its due time and progress, and your own body when it is about to give out. Tap a row to be
  walked there. Past its due time a task sours the kid every minute (`OVERDUE_MOOD_LOSS_PER_MIN`).
* **You are always interrupted.** Household mishaps (spilled milk, a smashed bowl, sibling fights, a fall,
  "I can't sleep", water over the bathroom floor, a burning pot, the class group chat) arrive at random
  all day and can repeat. A rest or a meal is cut short about half the time and gives only half its benefit;
  a chore game gets a "媽——!" halfway: drop it for half the progress, or ignore it and pay patience and mood.
  Only one red alarm exists at a time; at most three mishaps wait at once on their own.
* Each kid works through **breakfast → lunch → homework → dinner → dishes → bath → school bag**,
  and each task only opens at its own time (`TASK_RELEASE`); in between they play on the sofa.
* **The world is big on purpose.** Walls and doorways are real (you route round them), the camera
  follows you, and the shops, pharmacy, park and school are 8-25 metres from the front door: every
  errand outside is minutes the kids spend without you.
* **Chores are little games.** Cooking is timing, washing up and bathing are button-mashing, homework
  is a few first-grade sums, packing the school bag is picking what tomorrow needs. A better score moves
  every waiting kid further and leaves them happier; a botched one costs patience.
* `!` markers: amber = someone or something wants you, blue = a kid has waited too long,
  **red = urgent** (fever, a bumped head): nothing else can be handled until it is.
* Errands trade NT$ against minutes and energy (buy the shoes now, or lose an hour on the
  weekend). The weekly flexible budget starts at NT$1,500 and can go negative on the card.
* Body: energy 0 means dozing for 20 minutes; the second time ends the day. A full bladder
  forces an 8-minute break, whether or not you had time for it.
* Unanswered events lapse on their own and become **明天的待辦** on the result screen.
* Sound is synthesised with WebAudio (no audio files) and phones vibrate on bad news.

## Design

**Types first.** `src/engine/types.ts` is the specification: event targets are a discriminated
union (`task` | `kid` | `family`), actions are a closed `PlayerAction` union, and the screen
state machine cannot represent "a conversation with nobody".

**Pure engine, stage owns the body.** `src/engine/game.ts` is a reducer, `act(state, action)`,
over a serializable `GameState` that includes the PRNG state, so a whole day replays from
`seed` + actions. The 3D stage owns where the parent stands and reports (a) distance walked
and (b) which room is in reach; the engine turns those into minutes. Nothing in the engine
touches the DOM or three.js.

**Balance is tested, not guessed.** `src/engine/balance.test.ts` plays 40 seeded days per bot
policy and asserts the intent: nagging or doing everything yourself never earns the quiet
ending; waiting never finishes; no single gentle style wins; a mixed, thoughtful policy beats
the best single style (and `realtime.test.ts` pins the clock, the mishap deck, interruptions and the to-do order); skilled hands at the chores beat clumsy ones and perfect chores alone still
fail often; buying time costs far more than saving pennies; a parent who never eats,
rests or goes to the toilet collapses and one who does not.

All tunable numbers live in `src/engine/constants.ts` (documented) and `src/data/styles.ts`.

## Layout

```
src/
  engine/       types, constants, world geometry (rooms, walls, shops), pathing (routes round walls),
                game reducer, to-do list (todo.ts), summary, bots (simulate.ts)
  data/         content: check-ins, interruptions, household mishaps (mess.ts), errands, daytime and
                neighbourhood events,
                chores, endings, intro
  scene/        3D: model.ts (pure state → view), movement.ts (collision, input),
                room.ts (the flat and the street), character.ts, stage.ts (three.js; the only
                file that touches WebGL; the camera follows the parent)
  ui/           vanilla-TS screens (home, intro, play, result), app controller, sound, share card,
                minigames/ (logic.ts is the rules, overlay.ts draws them)
  telemetry/    anonymous, best-effort event tracker
  config.ts     typed, validated environment (zod)
  storage.ts    validated localStorage progress (save v2) with in-memory fallback
  share.ts      share-text builder
```

Tests are co-located (`*.test.ts`). UI tests use a fake stage, so they run without WebGL.

## Scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Vite dev server with hot reload               |
| `npm run build`     | Typecheck, then production build to `dist/`   |
| `npm run preview`   | Serve the production build locally            |
| `npm test`          | Run all tests once (`test:watch` to iterate)  |
| `npm run lint`      | ESLint, strict type-checked rules             |
| `npm run typecheck` | `tsc --noEmit`                                |
| `npm run check`     | typecheck + lint + test                       |
| `npm run clean`     | Remove build output and caches                |

## Privacy

No accounts, no cookies, nothing about children. Optional analytics (`VITE_ANALYTICS_URL`)
sends only anonymous funnel events: start, end (ending, money left, collapses), share, CTA click.
