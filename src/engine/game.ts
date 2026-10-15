import { OPENING_EVENT_ID } from '../data/daytime';
import { checkinFor, eventById, MESS_EVENTS, SPAWNABLE_EVENTS } from '../data/deck';
import { CUT_SHORT_LINES } from '../data/mess';
import { choreText } from '../data/chores';
import { KIDS, TASKS } from '../data/meta';
import { REACTIONS } from '../data/reactions';
import { CARE_TEXT, DOZE_TEXT } from '../data/selfcare';
import { TEMPERAMENT } from '../data/styles';
import {
  ATTENTION_AFTER_MIN,
  CARE_INTERRUPT_CHANCE,
  IGNORED_CALL_MOOD,
  IGNORED_CALL_PATIENCE,
  INTERRUPTED_SHARE,
  MAX_OPEN_MESS,
  MESS_CHANCE_PER_MIN,
  MESS_COOLDOWN,
  OVERDUE_MOOD_LOSS_PER_MIN,
  TASK_DUE_AFTER,
  TASK_RELEASE,
  BLADDER_DISTRACTED,
  BLADDER_RISE_PER_MIN,
  BLADDER_START,
  BOND_START,
  BREATH_MINUTES,
  BREATH_PATIENCE_GAIN,
  CARE,
  CHORES,
  CHORE_MOOD_SWING,
  CHORE_PATIENCE_SWING,
  CHECKIN_CHOICE_COUNT,
  COLLAPSE_ENERGY_GAIN,
  COLLAPSE_MINUTES,
  COLLAPSE_MOOD_COST,
  DAY_END_MIN,
  DAY_START_MIN,
  IDLE_BLOCK_MIN,
  DISCIPLINE_START,
  ENERGY_DECAY_PER_MIN,
  ENERGY_START,
  FORCED_BREAK_MINUTES,
  FORCED_BREAK_PATIENCE_COST,
  FORCED_BREAK_RESET,
  FRAZZLED_ENERGY,
  FULLNESS_DECAY_PER_MIN,
  FULLNESS_START,
  HUNGRY_BELOW,
  HUNGRY_ENERGY_DRAIN_PER_MIN,
  LOW_MOOD_PENALTY,
  LOW_PATIENCE_PENALTY,
  MAX_COFFEES,
  MAX_COLLAPSES,
  MAX_OPEN_EVENTS,
  MONEY_DEBT_PATIENCE_COST,
  MONEY_START,
  MONEY_STRESS_BELOW,
  MONEY_STRESS_PATIENCE_COST,
  MOOD_LOW,
  MOOD_START,
  PASSIVE_LOW_MOOD_FACTOR,
  PASSIVE_PROGRESS_PER_MIN,
  PATIENCE_LOW,
  PATIENCE_START,
  SPAWN_CHANCE_PER_MIN,
  TOILET_USEFUL_ABOVE,
  UNATTENDED_MOOD_LOSS_PER_MIN,
  WALK_UNITS_PER_MINUTE,
} from './constants';
import { nextRandom, pickIndex, shuffle } from './rng';
import {
  CARE_IDS,
  KID_IDS,
  TASK_ORDER,
  type CareId,
  type ChoreInterrupt,
  type ChoreOffer,
  type EventChoice,
  type GameEvent,
  type GameState,
  type Interaction,
  type KidId,
  type KidState,
  type LogEntry,
  type NextUp,
  type OpenEvent,
  type PlayerAction,
  type Style,
  type TaskId,
  type ZoneId,
} from './types';
import { PLAY_ZONES, TASK_ZONE, ZONES } from './world';

/** Thrown when the UI sends an action the current state cannot accept. */
export class InvalidActionError extends Error {
  override name = 'InvalidActionError';
}

/** A deeply mutable view of an immutable type, used only inside this module to build the next state. */
type Writable<T> = T extends readonly (infer U)[]
  ? Writable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Writable<T[K]> }
    : T;

type Draft = Writable<GameState>;

const clamp = (value: number): number => Math.min(100, Math.max(0, value));

/** Copies a state into a mutable draft. Actions edit the draft, then return it as a `GameState`. */
function draftOf(state: GameState): Draft {
  return structuredClone(state) as Draft;
}

// --- Queries -----------------------------------------------------------------

/** The first incomplete task for a kid, or null when they are finished. */
export function nextTask(kid: KidState): TaskId | null {
  return TASK_ORDER.find((task) => kid.progress[task] < 100) ?? null;
}

/** The task a kid is waiting on the parent for right now: the next one, once its time has come. */
export function activeTask(kid: KidState, clock: number): TaskId | null {
  const task = nextTask(kid);
  return task !== null && clock >= TASK_RELEASE[task] ? task : null;
}

export function allDone(state: Pick<GameState, 'kids' | 'clock'>): boolean {
  return KID_IDS.every((id) => nextTask(state.kids[id]) === null);
}

/** Where a kid with nothing to do is playing: they drift between the sofa and the toy corner. */
export function idleZone(id: KidId, clock: number): ZoneId {
  const block = Math.floor(Math.max(0, clock - DAY_START_MIN) / IDLE_BLOCK_MIN);
  const pick = id === 'elder' ? block : block + (block >> 1);
  return PLAY_ZONES[pick % PLAY_ZONES.length] ?? 'sofa';
}

/** The room a kid is in: where their active task happens, or where they play while waiting or finished. */
export function kidZone(kid: KidState, clock: number, id: KidId): ZoneId {
  const task = activeTask(kid, clock);
  return task === null ? idleZone(id, clock) : TASK_ZONE[task];
}

/** The room an event is in: its fixed room, else the room of whoever it is about. */
export function zoneOfEvent(event: GameEvent, state: Pick<GameState, 'kids' | 'clock'>): ZoneId {
  if (event.zone !== null) return event.zone;
  switch (event.target.kind) {
    case 'task':
      return TASK_ZONE[event.target.task];
    case 'kid':
      return kidZone(state.kids[event.target.kid], state.clock, event.target.kid);
    case 'family':
      return 'sofa';
  }
}

/** True once a kid has waited long enough for a "!" to show above them. */
export function needsAttention(state: GameState, kid: KidId): boolean {
  const kidState = state.kids[kid];
  return activeTask(kidState, state.clock) !== null && state.clock - kidState.lastAttended >= ATTENTION_AFTER_MIN;
}

export interface OpenView {
  readonly event: GameEvent;
  readonly zone: ZoneId;
  readonly urgent: boolean;
  /** Game minutes before it lapses. */
  readonly minutesLeft: number;
}

/** Open events with their rooms resolved, urgent first, then soonest to lapse. */
export function openViews(state: GameState): readonly OpenView[] {
  return state.open
    .map((open) => {
      const event = eventById(open.eventId);
      return {
        event,
        zone: zoneOfEvent(event, state),
        urgent: event.urgent,
        minutesLeft: Math.max(0, open.expires - state.clock),
      };
    })
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.minutesLeft - b.minutesLeft);
}

const totalProgress = (kid: KidState): number =>
  TASK_ORDER.reduce((sum, task) => sum + kid.progress[task], 0);

/** Which kid a routine check in `zone` would be about, or null if no kid is working there. */
export function checkinKidAt(state: GameState, zone: ZoneId): KidId | null {
  const here = KID_IDS.filter((id) => {
    const task = activeTask(state.kids[id], state.clock);
    return task !== null && TASK_ZONE[task] === zone;
  });
  if (here.length === 0) return null;
  const waiting = here.filter((id) => needsAttention(state, id));
  const pool = waiting.length > 0 ? waiting : here;
  return [...pool].sort((a, b) => totalProgress(state.kids[a]) - totalProgress(state.kids[b]))[0] ?? null;
}

/** What the main button would do right now. */
export function interactionAt(state: GameState): Interaction {
  const zone = state.at;
  if (state.finished || state.pending !== null || zone === null) return { kind: 'none' };
  const views = openViews(state);
  const urgent = views.find((view) => view.urgent);
  if (urgent !== undefined && urgent.zone !== zone) {
    return { kind: 'blocked', zone: urgent.zone, eventId: urgent.event.id };
  }
  const here = views.find((view) => view.zone === zone);
  if (here !== undefined) return { kind: 'event', eventId: here.event.id, urgent: here.urgent };
  const kid = checkinKidAt(state, zone);
  return kid === null ? { kind: 'none' } : { kind: 'checkin', kid };
}

/** The chore the parent could do by hand here, or null. Every kid waiting on that same task here gets the progress. */
export function choreAt(state: GameState): ChoreOffer | null {
  const zone = state.at;
  if (state.finished || state.pending !== null || zone === null) return null;
  const urgent = openViews(state).find((view) => view.urgent);
  if (urgent !== undefined && urgent.zone !== zone) return null;
  const here = KID_IDS.flatMap((id) => {
    const task = activeTask(state.kids[id], state.clock);
    return task !== null && TASK_ZONE[task] === zone ? [{ id, task }] : [];
  });
  const first = here[0];
  if (first === undefined) return null;
  // Both kids can be at the table at once, on different tasks; do the one that is behind.
  const task = [...here].sort((a, b) => totalProgress(state.kids[a.id]) - totalProgress(state.kids[b.id]))[0]?.task ?? first.task;
  return { task, game: CHORES[task].game, kids: here.filter((h) => h.task === task).map((h) => h.id) };
}

export type CareStatus = 'ok' | 'not_needed' | 'used_up';

/** Whether a self-care action would help right now (the room is checked separately). */
export function careStatus(state: GameState, care: CareId): CareStatus {
  switch (care) {
    case 'eat':
      return state.fullness < 80 ? 'ok' : 'not_needed';
    case 'rest':
      return state.energy < 85 || state.patience < 85 ? 'ok' : 'not_needed';
    case 'coffee':
      if (state.coffees >= MAX_COFFEES) return 'used_up';
      return state.energy < 90 ? 'ok' : 'not_needed';
    case 'toilet':
      return state.bladder > TOILET_USEFUL_ABOVE ? 'ok' : 'not_needed';
  }
}

/** Self-care actions available in the room the parent is standing in. */
export function careAt(state: GameState): readonly CareId[] {
  if (state.at === null) return [];
  return CARE_IDS.filter((id) => CARE[id].zone === state.at);
}

/** Where to go next and why. Null when nothing needs doing. */
export function nextUp(state: GameState): NextUp | null {
  if (state.finished) return null;
  const views = openViews(state);
  const urgent = views.find((view) => view.urgent);
  if (urgent !== undefined) {
    return { zone: urgent.zone, reason: 'urgent', text: `緊急：${urgent.event.title}` };
  }
  if (state.energy < 20) {
    return { zone: 'sofa', reason: 'body', text: '你快撐不住了，去沙發坐一下' };
  }
  if (state.bladder >= 90) {
    return { zone: 'tub', reason: 'body', text: '你憋很久了，快去浴室' };
  }
  if (state.fullness < HUNGRY_BELOW) {
    return { zone: 'table', reason: 'body', text: '你的肚子在叫，去餐桌扒幾口飯' };
  }
  const event = views[0];
  if (event !== undefined) {
    return {
      zone: event.zone,
      reason: 'event',
      text: `${event.event.title}（${ZONES[event.zone].label}）`,
    };
  }
  const waiting = KID_IDS.filter((id) => needsAttention(state, id));
  const pool = waiting.length > 0 ? waiting : KID_IDS.filter((id) => activeTask(state.kids[id], state.clock) !== null);
  const kid = [...pool].sort((a, b) => totalProgress(state.kids[a]) - totalProgress(state.kids[b]))[0];
  if (kid === undefined) return null;
  const task = activeTask(state.kids[kid], state.clock);
  if (task === null) return null;
  return {
    zone: TASK_ZONE[task],
    reason: 'kid',
    text: `${KIDS[kid].name}在${ZONES[TASK_ZONE[task]].label}（${TASKS[task].label}）`,
  };
}

// --- Construction ------------------------------------------------------------

function newKid(): KidState {
  return {
    mood: MOOD_START,
    discipline: DISCIPLINE_START,
    progress: { breakfast: 0, lunch: 0, homework: 0, dinner: 0, dishes: 0, bath: 0, bag: 0 },
    lastAttended: DAY_START_MIN,
  };
}

export function createGame(seed: number): GameState {
  return {
    seed,
    rng: seed >>> 0,
    clock: DAY_START_MIN,
    patience: PATIENCE_START,
    energy: ENERGY_START,
    fullness: FULLNESS_START,
    bladder: BLADDER_START,
    bond: BOND_START,
    money: MONEY_START,
    spent: 0,
    kids: { elder: newKid(), younger: newKid() },
    at: null,
    walkRemainder: 0,
    choreScores: [],
    open: [{ eventId: OPENING_EVENT_ID, appeared: DAY_START_MIN, expires: DAY_START_MIN + 45 }],
    seenEvents: [OPENING_EVENT_ID],
    styleCounts: { nag: 0, do_for: 0, offer_choice: 0, wait: 0, together: 0 },
    breaths: 0,
    coffees: 0,
    collapses: 0,
    forcedBreaks: 0,
    missed: 0,
    tomorrow: [],
    pending: null,
    log: [],
    finished: false,
  };
}

// --- Time --------------------------------------------------------------------

function affectedKids(event: GameEvent): readonly KidId[] {
  return event.target.kind === 'family' ? KID_IDS : [event.target.kid];
}

/** A scripted event is moot once the thing it was about has finished by itself. */
function stillRelevant(state: Pick<GameState, 'kids' | 'clock'>, event: GameEvent): boolean {
  if (event.repeatable) return true;
  switch (event.target.kind) {
    case 'task':
      return activeTask(state.kids[event.target.kid], state.clock) === event.target.task;
    case 'kid':
      return activeTask(state.kids[event.target.kid], state.clock) !== null;
    case 'family':
      return true;
  }
}

function canSpawn(state: Draft, event: GameEvent): boolean {
  if (state.seenEvents.includes(event.id)) return false;
  if (state.clock < event.window.from || state.clock >= event.window.to) return false;
  if (event.urgent && state.open.some((open) => eventById(open.eventId).urgent)) return false;
  return stillRelevant(state, event);
}

function log(state: Draft, entry: Omit<LogEntry, 'clock'>): void {
  state.log.push({ clock: state.clock, ...entry });
}

/** Applies NT$ to the budget and the patience cost of money worries. */
function applyMoney(state: Draft, delta: number): void {
  if (delta === 0) return;
  state.money += delta;
  if (delta < 0) {
    state.spent += -delta;
    if (state.money < 0) state.patience = clamp(state.patience - MONEY_DEBT_PATIENCE_COST);
    else if (state.money < MONEY_STRESS_BELOW) {
      state.patience = clamp(state.patience - MONEY_STRESS_PATIENCE_COST);
    }
  }
}

function addTomorrow(state: Draft, note: string | null): void {
  if (note !== null && !state.tomorrow.includes(note)) state.tomorrow.push(note);
}

function lapseOpenEvents(state: Draft): void {
  const due = state.open.filter((open) => state.clock >= open.expires);
  if (due.length === 0) return;
  state.open = state.open.filter((open) => state.clock < open.expires);
  for (const open of due) {
    const event = eventById(open.eventId);
    // If the thing sorted itself out in the meantime, there is nothing to answer for.
    if (!stillRelevant(state, event)) continue;
    for (const id of affectedKids(event)) {
      const kid = state.kids[id];
      kid.mood = clamp(kid.mood - event.lapse.mood);
    }
    state.patience = clamp(state.patience - event.lapse.patience);
    applyMoney(state, event.lapse.money);
    addTomorrow(state, event.lapse.tomorrow);
    state.missed += 1;
    log(state, {
      eventId: event.id,
      actionId: 'lapse',
      style: 'lapse',
      text: event.lapse.text,
      money: event.lapse.money,
    });
  }
}

function spawnEvent(state: Draft): void {
  if (state.open.length >= MAX_OPEN_EVENTS) return;
  const roll = nextRandom(state.rng);
  state.rng = roll.state;
  if (roll.value >= SPAWN_CHANCE_PER_MIN) return;
  const candidates = SPAWNABLE_EVENTS.filter((event) => canSpawn(state, event));
  if (candidates.length === 0) return;
  const pick = pickIndex(state.rng, candidates.length);
  state.rng = pick.state;
  const chosen = candidates[pick.index];
  if (chosen === undefined) return;
  const open: OpenEvent = {
    eventId: chosen.id,
    appeared: state.clock,
    expires: state.clock + chosen.ttl,
  };
  state.open.push(open);
  state.seenEvents.push(chosen.id);
}

/** Opens one household mishap: random, unless `force` is set it respects the cap on open mess. */
function spawnMess(state: Draft, force: boolean): boolean {
  const openMess = state.open.filter((open) => eventById(open.eventId).repeatable).length;
  if (!force && openMess >= MAX_OPEN_MESS) return false;
  const recent = state.seenEvents.slice(-MESS_COOLDOWN);
  const candidates = MESS_EVENTS.filter(
    (event) =>
      !state.open.some((open) => open.eventId === event.id) &&
      !recent.includes(event.id) &&
      !(event.urgent && state.open.some((open) => eventById(open.eventId).urgent)),
  );
  if (candidates.length === 0) return false;
  const pick = pickIndex(state.rng, candidates.length);
  state.rng = pick.state;
  const chosen = candidates[pick.index];
  if (chosen === undefined) return false;
  state.open.push({ eventId: chosen.id, appeared: state.clock, expires: state.clock + chosen.ttl });
  state.seenEvents.push(chosen.id);
  return true;
}

function maybeSpawnMess(state: Draft): void {
  const roll = nextRandom(state.rng);
  state.rng = roll.state;
  if (roll.value < MESS_CHANCE_PER_MIN) spawnMess(state, false);
}

/** The kids cut a break, a meal or a chore short. Returns the line to append to what happened. */
function interruptWith(state: Draft): string {
  const line = pickIndex(state.rng, CUT_SHORT_LINES.length);
  state.rng = line.state;
  spawnMess(state, true);
  return CUT_SHORT_LINES[line.index] ?? '';
}

function settle(state: Draft): void {
  if (state.finished) return;
  if (allDone(state) || state.clock >= DAY_END_MIN || state.collapses >= MAX_COLLAPSES) {
    state.finished = true;
    state.pending = null;
  }
}

function doze(state: Draft): void {
  state.collapses += 1;
  log(state, { eventId: 'doze', actionId: 'doze', style: 'doze', text: DOZE_TEXT, money: 0 });
  if (state.collapses >= MAX_COLLAPSES) {
    state.finished = true;
    state.pending = null;
    return;
  }
  state.clock += COLLAPSE_MINUTES;
  state.energy = COLLAPSE_ENERGY_GAIN;
  state.fullness = Math.max(0, state.fullness - 5);
  for (const id of KID_IDS) {
    const kid = state.kids[id];
    kid.mood = clamp(kid.mood - COLLAPSE_MOOD_COST);
  }
}

/** The body forces a bathroom break: minutes away from the kids and a hit to patience. */
function forceBreak(state: Draft): void {
  state.forcedBreaks += 1;
  log(state, {
    eventId: 'forced-break',
    actionId: 'forced',
    style: 'forced',
    text: '你憋不住了，被迫衝進浴室。孩子們在外面喊你的名字，你只能說：「等一下！」',
    money: 0,
  });
  state.clock += FORCED_BREAK_MINUTES;
  state.bladder = FORCED_BREAK_RESET;
  state.patience = clamp(state.patience - FORCED_BREAK_PATIENCE_COST);
}

function tick(state: Draft): void {
  state.clock += 1;
  const hungryDrain = state.fullness < HUNGRY_BELOW ? HUNGRY_ENERGY_DRAIN_PER_MIN : 0;
  state.energy = Math.max(0, state.energy - ENERGY_DECAY_PER_MIN - hungryDrain);
  state.fullness = Math.max(0, state.fullness - FULLNESS_DECAY_PER_MIN);
  state.bladder = Math.min(100, state.bladder + BLADDER_RISE_PER_MIN);

  for (const id of KID_IDS) {
    const kid = state.kids[id];
    const task = activeTask(kid, state.clock);
    if (task === null) continue;
    const moodFactor = kid.mood < MOOD_LOW ? PASSIVE_LOW_MOOD_FACTOR : 1;
    kid.progress[task] = Math.min(
      100,
      kid.progress[task] + PASSIVE_PROGRESS_PER_MIN * (kid.discipline / 50) * moodFactor,
    );
    if (state.clock - kid.lastAttended > ATTENTION_AFTER_MIN) {
      kid.mood = Math.max(0, kid.mood - UNATTENDED_MOOD_LOSS_PER_MIN);
    }
    if (state.clock > TASK_RELEASE[task] + TASK_DUE_AFTER[task]) {
      kid.mood = Math.max(0, kid.mood - OVERDUE_MOOD_LOSS_PER_MIN);
    }
  }
  lapseOpenEvents(state);
  spawnEvent(state);
  maybeSpawnMess(state);
}

/** Lets `minutes` game minutes pass: bodies tire, kids drift, events appear and lapse. */
function advance(state: Draft, minutes: number): void {
  for (let i = 0; i < minutes && !state.finished; i += 1) {
    tick(state);
    if (state.energy <= 0) doze(state);
    else if (state.bladder >= 100) forceBreak(state);
    settle(state);
  }
}

// --- Actions -----------------------------------------------------------------

function requireNoEncounter(state: GameState, what: string): void {
  if (state.finished) throw new InvalidActionError(`The evening is over; cannot ${what}`);
  if (state.pending !== null) {
    throw new InvalidActionError(`Finish the conversation before you ${what}`);
  }
}

function walk(state: GameState, units: number): GameState {
  requireNoEncounter(state, 'walk');
  if (!Number.isFinite(units) || units < 0) {
    throw new InvalidActionError(`Cannot walk ${units} units`);
  }
  const total = state.walkRemainder + units / WALK_UNITS_PER_MINUTE;
  const minutes = Math.floor(total);
  const s = draftOf(state);
  s.walkRemainder = total - minutes;
  advance(s, minutes);
  return s;
}

function tickMinutes(state: GameState, minutes: number): GameState {
  requireNoEncounter(state, 'let time pass');
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new InvalidActionError(`Cannot let ${minutes} minutes pass`);
  }
  const s = draftOf(state);
  advance(s, minutes);
  return s;
}

function arrive(state: GameState, zone: ZoneId | null): GameState {
  if (state.at === zone) return state;
  return { ...state, at: zone };
}

function interact(state: GameState): GameState {
  requireNoEncounter(state, 'start a conversation');
  const interaction = interactionAt(state);
  const s = draftOf(state);
  let event: GameEvent;
  let openEventId: string | null = null;
  switch (interaction.kind) {
    case 'none':
      throw new InvalidActionError('There is nothing to do here');
    case 'blocked':
      throw new InvalidActionError('Something urgent needs you first');
    case 'event':
      event = eventById(interaction.eventId);
      openEventId = event.id;
      break;
    case 'checkin': {
      const task = activeTask(state.kids[interaction.kid], state.clock);
      if (task === null) throw new InvalidActionError('That kid has nothing left to do');
      event = checkinFor(interaction.kid, task);
      break;
    }
  }
  const zone = state.at;
  if (zone === null) throw new InvalidActionError('Walk up to someone first');
  const shuffled = shuffle(s.rng, event.choices);
  s.rng = shuffled.state;
  const choices =
    event.kind === 'checkin' ? shuffled.items.slice(0, CHECKIN_CHOICE_COUNT) : shuffled.items;
  s.pending = { event: { ...event, choices: [...choices] }, zone, openEventId };
  return s;
}

function applyToKid(
  kid: Writable<KidState>,
  kidId: KidId,
  event: GameEvent,
  choice: EventChoice,
  frazzled: boolean,
): void {
  const temperament = TEMPERAMENT[kidId][choice.style];
  if (event.target.kind === 'task' && event.target.kid === kidId) {
    const gentle = choice.style !== 'nag' && choice.style !== 'do_for';
    const frazzle = gentle && frazzled ? LOW_PATIENCE_PENALTY : 1;
    const moodPenalty = choice.style !== 'do_for' && kid.mood < MOOD_LOW ? LOW_MOOD_PENALTY : 1;
    const gain = Math.round(choice.progress * temperament.progress * frazzle * moodPenalty);
    const task = event.target.task;
    kid.progress[task] = clamp(kid.progress[task] + gain);
  }
  kid.mood = clamp(kid.mood + Math.round(choice.effects.mood * temperament.mood));
  kid.discipline = clamp(kid.discipline + choice.effects.discipline);
}

function choose(state: GameState, choiceId: string): GameState {
  const encounter = state.pending;
  if (state.finished || encounter === null) {
    throw new InvalidActionError('There is no conversation to answer');
  }
  const { event } = encounter;
  const choice = event.choices.find((c) => c.id === choiceId);
  if (choice === undefined) {
    throw new InvalidActionError(`Choice "${choiceId}" is not offered by event "${event.id}"`);
  }

  const s = draftOf(state);
  const frazzled =
    state.patience < PATIENCE_LOW ||
    state.energy < FRAZZLED_ENERGY ||
    state.bladder >= BLADDER_DISTRACTED;
  const involved = affectedKids(event);
  for (const kidId of involved) {
    applyToKid(s.kids[kidId], kidId, event, choice, frazzled);
    s.kids[kidId].lastAttended = s.clock;
  }

  // Pick the kid whose reaction is shown, then one of that kid's lines.
  let reactionKid: KidId;
  if (event.target.kind === 'family') {
    const pick = pickIndex(s.rng, KID_IDS.length);
    s.rng = pick.state;
    reactionKid = KID_IDS[pick.index] ?? 'elder';
  } else {
    reactionKid = event.target.kid;
  }
  const lines = REACTIONS[reactionKid][choice.style];
  const linePick = pickIndex(s.rng, lines.length);
  s.rng = linePick.state;

  s.patience = clamp(s.patience + choice.effects.patience);
  s.energy = clamp(s.energy + choice.effects.energy);
  s.bond = clamp(s.bond + choice.effects.bond);
  applyMoney(s, choice.money);
  addTomorrow(s, choice.tomorrow);
  s.styleCounts[choice.style] += 1;
  if (encounter.openEventId !== null) {
    s.open = s.open.filter((open) => open.eventId !== encounter.openEventId);
  }
  log(s, {
    eventId: event.id,
    actionId: choice.id,
    style: choice.style,
    text: `${choice.aftermath}${lines[linePick.index] ?? ''}`,
    money: choice.money,
  });
  s.pending = null;
  advance(s, choice.minutes);
  return s;
}

function care(state: GameState, careId: CareId): GameState {
  requireNoEncounter(state, 'take care of yourself');
  const spec = CARE[careId];
  if (state.at !== spec.zone) {
    throw new InvalidActionError(`"${careId}" can only be done at the ${spec.zone}`);
  }
  if (careStatus(state, careId) !== 'ok') {
    throw new InvalidActionError(`"${careId}" would not help right now`);
  }
  const s = draftOf(state);
  const cutRoll = nextRandom(s.rng);
  s.rng = cutRoll.state;
  const cutShort = cutRoll.value < CARE_INTERRUPT_CHANCE[careId];
  const share = cutShort ? INTERRUPTED_SHARE : 1;
  s.energy = clamp(s.energy + spec.energy * share);
  s.patience = clamp(s.patience + spec.patience * share);
  s.fullness = clamp(s.fullness + spec.fullness * share);
  s.bladder = clamp(s.bladder + (spec.bladder < 0 ? spec.bladder * share : spec.bladder));
  if (careId === 'coffee') s.coffees += 1;
  if (careId === 'rest' && spec.bond > 0 && KID_IDS.some((id) => kidZone(s.kids[id], s.clock, id) === 'sofa')) {
    s.bond = clamp(s.bond + spec.bond);
  }
  const outcome = CARE_TEXT[careId].outcome;
  log(s, {
    eventId: `care:${careId}`,
    actionId: careId,
    style: 'care',
    text: cutShort ? `${outcome}\n${interruptWith(s)}` : outcome,
    money: 0,
  });
  advance(s, cutShort ? Math.max(1, Math.ceil(spec.minutes * share)) : spec.minutes);
  return s;
}

function breathe(state: GameState): GameState {
  requireNoEncounter(state, 'breathe');
  const s = draftOf(state);
  s.patience = clamp(s.patience + BREATH_PATIENCE_GAIN);
  s.breaths += 1;
  log(s, {
    eventId: 'breathe',
    actionId: 'breathe',
    style: 'breathe',
    text: '你停下來，吸了一口氣，慢慢吐出來。孩子們還在原地等你。',
    money: 0,
  });
  advance(s, BREATH_MINUTES);
  return s;
}

function chore(state: GameState, score: number, interrupt: ChoreInterrupt): GameState {
  requireNoEncounter(state, 'do a chore');
  const offer = choreAt(state);
  if (offer === null) throw new InvalidActionError('There is no chore to do here');
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new InvalidActionError(`A chore score is between 0 and 1, not ${score}`);
  }
  const spec = CHORES[offer.task];
  const s = draftOf(state);
  const share = interrupt === 'answered' ? INTERRUPTED_SHARE : 1;
  const gain = Math.round((spec.base + spec.bonus * score) * share);
  for (const id of offer.kids) {
    const kid = s.kids[id];
    kid.progress[offer.task] = clamp(kid.progress[offer.task] + gain);
    kid.mood = clamp(kid.mood + Math.round(CHORE_MOOD_SWING * (score - 0.4)));
    kid.discipline = clamp(kid.discipline + spec.discipline);
    kid.lastAttended = s.clock;
  }
  s.energy = clamp(s.energy + spec.energy * share);
  s.patience = clamp(s.patience + Math.round(CHORE_PATIENCE_SWING * (score - 0.5) * 2));
  let aside = '';
  if (interrupt !== 'none') {
    aside = `\n${interruptWith(s)}`;
    if (interrupt === 'ignored') {
      s.patience = clamp(s.patience - IGNORED_CALL_PATIENCE);
      for (const id of KID_IDS) s.kids[id].mood = clamp(s.kids[id].mood - IGNORED_CALL_MOOD);
      aside += '\n你假裝沒聽見，手上的事繼續做完。';
    }
  }
  s.bond = clamp(s.bond + (spec.discipline > 0 ? 1 : 0));
  s.choreScores.push(score);
  log(s, {
    eventId: `chore:${offer.task}`,
    actionId: 'chore',
    style: spec.discipline > 0 ? 'together' : 'do_for',
    text: `${choreText(offer.task, score)}${aside}`,
    money: 0,
  });
  advance(s, Math.max(1, Math.ceil(spec.minutes * share)));
  return s;
}

/** Applies a player action. Throws `InvalidActionError` when the state cannot accept it. */
export function act(state: GameState, action: PlayerAction): GameState {
  switch (action.kind) {
    case 'walk':
      return walk(state, action.units);
    case 'arrive':
      return arrive(state, action.zone);
    case 'interact':
      return interact(state);
    case 'choose':
      return choose(state, action.choiceId);
    case 'care':
      return care(state, action.care);
    case 'breathe':
      return breathe(state);
    case 'chore':
      return chore(state, action.score, action.interrupt ?? 'none');
    case 'tick':
      return tickMinutes(state, action.minutes);
    case 'leave':
      return state.pending === null ? state : { ...state, pending: null };
  }
}

/** The style used in a logged action, for callers that only have the log. */
export function styleOfLog(entry: LogEntry): Style | null {
  switch (entry.style) {
    case 'breathe':
    case 'care':
    case 'lapse':
    case 'doze':
    case 'forced':
      return null;
    default:
      return entry.style;
  }
}
