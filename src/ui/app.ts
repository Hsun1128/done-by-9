import { INTRO_CARDS } from '../data/intro';
import type { AppConfig } from '../config';
import { dayProgress } from '../engine/clock';
import { InvalidActionError, act, careAt, careStatus, createGame, interactionAt, nextUp, openViews } from '../engine/game';
import { summarize } from '../engine/summary';
import type { CareId, GameState, PlayerAction, Summary, ZoneId } from '../engine/types';
import { deriveScene, reactionFor, type Reaction } from '../scene/model';
import type { Stage, StageEvents } from '../scene/stage';
import { buildShareText } from '../share';
import {
  loadSave,
  recordCtaClick,
  recordGame,
  writeSave,
  type SaveData,
  type StorageLike,
} from '../storage';
import type { Tracker } from '../telemetry/analytics';
import { renderHome } from './screens/home';
import { renderIntro, type IntroView } from './screens/intro';
import { createPlayView, type Outcome, type PlayView } from './screens/play';
import { renderResult, type ResultView } from './screens/result';
import { renderShareCard } from './shareCard';
import type { Sound } from './sound';

export interface AppDeps {
  readonly root: HTMLElement;
  readonly config: AppConfig;
  readonly storage: StorageLike;
  readonly tracker: Tracker;
  /** Builds the 3D room. The app owns it: it feeds it state and receives walking and proximity. */
  readonly createStage: (events: StageEvents) => Stage;
  readonly sound: Sound;
  /** Called once per new day. */
  readonly nextSeed: () => number;
  /** True when the player asked their system for less motion: narration then appears at once. */
  readonly reducedMotion: () => boolean;
}

type Screen =
  | { readonly tag: 'home' }
  | { readonly tag: 'intro' }
  | { readonly tag: 'play' }
  | { readonly tag: 'result'; readonly summary: Summary };

type Phase = 'morning' | 'day' | 'dusk' | 'night';

function phaseFor(screen: Screen, game: GameState | null): Phase {
  if (screen.tag === 'home' || screen.tag === 'intro') return 'morning';
  if (screen.tag === 'result' || game === null) return 'night';
  const progress = dayProgress(game.clock);
  if (progress < 0.2) return 'morning';
  if (progress < 0.6) return 'day';
  return progress < 0.82 ? 'dusk' : 'night';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '發生了未知的錯誤';
}

/** Log styles that interrupt play with a message: the world acted, not the player. */
const WORLD_STYLES: ReadonlySet<string> = new Set(['lapse', 'doze', 'forced']);

/** Mounts the game into `deps.root`. Returns a function that removes its listeners and stops the stage. */
export function mountApp(deps: AppDeps): () => void {
  const { root, config, storage, tracker, sound } = deps;
  const homeGame = createGame(1);
  let screen: Screen = { tag: 'home' };
  let save: SaveData = loadSave(storage);
  let ctaAcknowledged = false;
  let resultView: ResultView | null = null;
  let introView: IntroView | null = null;
  let playView: PlayView | null = null;
  let muted = false;

  // The day in progress; null outside the play screen.
  let game: GameState | null = null;
  let outcome: Outcome | null = null;
  let reaction: Reaction | null = null;
  /** The room the guide ring is drawn in. */
  let guide: ZoneId | null = null;

  const stage: Stage = deps.createStage({
    onWalk: (units) => {
      step({ kind: 'walk', units });
    },
    onNear: (zone) => {
      if (guide !== null && zone === guide) guide = null;
      step({ kind: 'arrive', zone });
    },
  });

  const persist = (next: SaveData): void => {
    save = next;
    writeSave(storage, next);
  };

  const go = (next: Screen): void => {
    const previousTag = screen.tag;
    screen = next;
    render();
    if (previousTag !== next.tag) window.scrollTo({ top: 0 });
  };

  // --- Playing -----------------------------------------------------------------

  /** Applies a player action. Actions that do not fit the moment (a stray key) are ignored. */
  function step(action: PlayerAction): GameState | null {
    if (game === null || screen.tag !== 'play') return null;
    if (outcome !== null || game.finished) return null;
    const before = game;
    let next: GameState;
    try {
      next = act(before, action);
    } catch (error) {
      if (error instanceof InvalidActionError) return null;
      throw error;
    }
    game = next;
    announce(before, next);
    refresh();
    return next;
  }

  /** Sounds, and the message card for things that happened to the parent rather than by them. */
  function announce(before: GameState, after: GameState): void {
    const appeared = openViews(after).filter(
      (view) => !before.open.some((open) => open.eventId === view.event.id),
    );
    if (appeared.length > 0) sound.play(appeared.some((view) => view.urgent) ? 'urgent' : 'event');

    const world = after.log.slice(before.log.length).filter((entry) => WORLD_STYLES.has(entry.style));
    if (world.length > 0) {
      sound.play('bad');
      outcome = {
        text: world.map((entry) => entry.text).join('\n'),
        money: world.reduce((sum, entry) => sum + entry.money, 0),
      };
    } else if (after.finished) {
      outcome = {
        text: after.clock >= 21 * 60 ? '玄關傳來鑰匙轉動的聲音。另一半回家了。' : '今天的事，到這裡了。',
        money: 0,
      };
      sound.play('end');
    }
  }

  const lastEntry = (state: GameState): { readonly text: string; readonly money: number } => {
    const entry = state.log.at(-1);
    return { text: entry?.text ?? '', money: entry?.money ?? 0 };
  };

  const startDay = (): void => {
    ctaAcknowledged = false;
    tracker.track({ name: 'game_start' });
    game = createGame(deps.nextSeed());
    outcome = null;
    reaction = null;
    guide = null;
    stage.reset();
    playView = createPlayView(stage.element, {
      onInteract: interact,
      onChoose: choose,
      onLeave: leave,
      onCare: care,
      onBreathe: breathe,
      onGuide: showGuide,
      onContinue: proceed,
      onFinish: finishDay,
      onStick: (x, z) => {
        stage.setStick(x, z);
      },
      onToggleMute: () => {
        muted = !muted;
        sound.setMuted(muted);
        refresh();
      },
    });
    go({ tag: 'play' });
  };

  function interact(): void {
    if (game === null || outcome !== null) return;
    if (interactionAt(game).kind !== 'event' && interactionAt(game).kind !== 'checkin') return;
    if (step({ kind: 'interact' }) !== null) sound.play('choose');
  }

  function choose(choiceId: string): void {
    if (game === null || game.pending === null || outcome !== null) return;
    const event = game.pending.event;
    const next = step({ kind: 'choose', choiceId });
    if (next === null) return;
    reaction = reactionFor(event, choiceId);
    const result = lastEntry(next);
    // The world may already have a card up (the day ended while talking); keep that one.
    outcome ??= result;
    sound.play(result.money !== 0 ? 'coin' : 'good');
    refresh();
  }

  function leave(): void {
    if (game === null || game.pending === null) return;
    step({ kind: 'leave' });
  }

  function care(id: CareId): void {
    if (game === null || outcome !== null) return;
    if (!careAt(game).includes(id) || careStatus(game, id) !== 'ok') return;
    const next = step({ kind: 'care', care: id });
    if (next === null) return;
    outcome ??= lastEntry(next);
    sound.play('care');
    refresh();
  }

  function breathe(): void {
    if (game === null || outcome !== null || game.pending !== null) return;
    const next = step({ kind: 'breathe' });
    if (next === null) return;
    outcome ??= lastEntry(next);
    sound.play('good');
    refresh();
  }

  function showGuide(): void {
    if (game === null || outcome !== null || game.pending !== null) return;
    const target = nextUp(game);
    if (target === null) return;
    guide = target.zone;
    stage.walkTo(target.zone);
    refresh();
  }

  function proceed(): void {
    if (game === null) return;
    if (game.finished) {
      finishDay();
      return;
    }
    outcome = null;
    reaction = null;
    refresh();
  }

  function finishDay(): void {
    if (game === null) return;
    const summary = summarize(game);
    persist(recordGame(save, summary));
    tracker.track({
      name: 'game_end',
      ending: summary.ending,
      allDone: summary.allDone,
      finishClock: summary.finishClock,
      money: summary.money,
      collapses: summary.collapses,
    });
    game = null;
    go({ tag: 'result', summary });
  }

  /** Keeps the 3D room and the play screen in step with the game. */
  function refresh(): void {
    if (screen.tag !== 'play' || game === null || playView === null) return;
    const frozen = game.pending !== null || outcome !== null || game.finished;
    stage.setFrozen(frozen);
    stage.update(deriveScene(game, reaction, guide));
    root.dataset['phase'] = phaseFor(screen, game);
    playView.update({ game, outcome, guide: nextUp(game), muted });
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (screen.tag === 'intro' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      introView?.advance();
      return;
    }
    if (screen.tag !== 'play' || game === null || event.ctrlKey || event.metaKey || event.altKey) return;
    sound.unlock();
    const key = event.key.toLowerCase();
    if (outcome !== null) {
      if (key === 'e' || key === 'enter' || key === ' ') {
        event.preventDefault();
        proceed();
      }
      return;
    }
    if (game.pending !== null) {
      if (key === 'escape') {
        leave();
        return;
      }
      const index = Number(key) - 1;
      const choice = game.pending.event.choices[index];
      if (Number.isInteger(index) && choice !== undefined) choose(choice.id);
      return;
    }
    switch (key) {
      case 'e':
      case 'enter':
        interact();
        break;
      case 'g':
        showGuide();
        break;
      case 'b':
        breathe();
        break;
      case 'r': {
        const first = careAt(game).find((id) => careStatus(game ?? homeGame, id) === 'ok');
        if (first !== undefined) care(first);
        break;
      }
      default:
        break;
    }
  };
  const onPointerDown = (): void => {
    sound.unlock();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pointerdown', onPointerDown);

  const resultActions = (summary: Summary) => {
    const text = buildShareText(summary, config.siteUrl);
    const say = (message: string): void => {
      resultView?.setStatus(message);
    };

    const copy = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(text);
        tracker.track({ name: 'share', method: 'copy' });
        say('已複製，可以直接貼上。');
      } catch (error) {
        say(`複製失敗：${errorMessage(error)}`);
      }
    };

    const saveImage = async (): Promise<void> => {
      try {
        const blob = await renderShareCard(summary, config.siteUrl);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'done-by-nine.png';
        link.click();
        URL.revokeObjectURL(url);
        tracker.track({ name: 'share', method: 'image' });
        say('已產生圖片。');
      } catch (error) {
        say(`產生圖片失敗：${errorMessage(error)}`);
      }
    };

    const share = async (): Promise<void> => {
      if (typeof navigator.share !== 'function') {
        await copy();
        return;
      }
      try {
        await navigator.share({ text });
        tracker.track({ name: 'share', method: 'native' });
      } catch (error) {
        // Dismissing the share sheet is not a failure.
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          say(`分享失敗：${errorMessage(error)}`);
        }
      }
    };

    const cta = (): void => {
      tracker.track({ name: 'cta_click' });
      persist(recordCtaClick(save));
      if (config.ctaUrl !== undefined) {
        window.open(config.ctaUrl, '_blank', 'noopener');
        return;
      }
      ctaAcknowledged = true;
      render();
    };

    return {
      onSaveImage: () => void saveImage(),
      onShare: () => void share(),
      onCopy: () => void copy(),
      onCta: cta,
      onReplay: startDay,
    };
  };


  // --- Screens -----------------------------------------------------------------

  function render(): void {
    introView?.dispose();
    introView = null;
    resultView = null;
    root.dataset['phase'] = phaseFor(screen, game);
    switch (screen.tag) {
      case 'home':
        stage.setFrozen(true);
        stage.update(deriveScene(homeGame, null, null));
        stage.start();
        root.replaceChildren(renderHome({ save, stage: stage.element, onStart: startIntro }));
        break;
      case 'intro':
        stage.setFrozen(true);
        root.replaceChildren(
          (introView = renderIntro({
            cards: INTRO_CARDS,
            typewriter: !deps.reducedMotion(),
            onDone: startDay,
          })).element,
        );
        break;
      case 'play':
        if (playView === null) throw new Error('The play screen was shown before a day was started');
        root.replaceChildren(playView.element);
        stage.start();
        refresh();
        break;
      case 'result':
        stage.stop();
        playView = null;
        resultView = renderResult({
          summary: screen.summary,
          actions: resultActions(screen.summary),
          ctaAcknowledged,
        });
        root.replaceChildren(resultView.element);
        break;
    }
  }

  function startIntro(): void {
    sound.unlock();
    go({ tag: 'intro' });
  }

  render();

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pointerdown', onPointerDown);
    introView?.dispose();
    stage.stop();
  };
}
