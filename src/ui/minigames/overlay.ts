import type { MinigameId } from '../../engine/types';
import { h } from '../dom';
import {
  COOK_PERFECT_HALF_WIDTH,
  COOK_ROUND_SECONDS,
  COOK_SWEET_CENTER,
  PACK_ITEMS,
  QUIZ_QUESTIONS,
  SCRUB_SECONDS,
  SCRUB_TARGET_TAPS,
  cookScore,
  makeQuiz,
  markerAt,
  packScore,
  quizScore,
  scrubScore,
  type Random,
} from './logic';

export interface MinigameOptions {
  readonly game: MinigameId;
  readonly title: string;
  readonly hint: string;
  readonly reducedMotion: boolean;
  readonly random: Random;
  /** Called once, with a score from 0 to 1. */
  readonly onDone: (score: number) => void;
  /** The player gave up. Costs nothing. */
  readonly onCancel: () => void;
}

export interface MinigameHandle {
  readonly element: HTMLElement;
  /** Offer a key press. Returns true when the game used it. */
  handleKey(key: string): boolean;
  /** Stop timers and animation. Safe to call twice. */
  dispose(): void;
}

/** Pause after the last action so the player can see how it went. */
const RESULT_PAUSE_MS = 900;

interface Part {
  readonly body: HTMLElement;
  handleKey(key: string): boolean;
  dispose(): void;
}

function cook(options: MinigameOptions, finish: (score: number) => void): Part {
  const slow = options.reducedMotion ? 1.6 : 1;
  const sweet = h('div', { className: 'mg-cook__sweet' });
  sweet.style.left = `${(COOK_SWEET_CENTER - COOK_PERFECT_HALF_WIDTH) * 100}%`;
  sweet.style.width = `${COOK_PERFECT_HALF_WIDTH * 2 * 100}%`;
  const marker = h('div', { className: 'mg-cook__marker' });
  const bar = h('div', { className: 'mg-cook__bar' }, sweet, marker);
  const status = h('p', { className: 'mg-status', attrs: { 'aria-live': 'polite' } }, '第 1 次：看準時機按下去');
  const press = h('button', { className: 'primary mg-big', onClick: () => {
        hit();
      } }, '下鍋（空白鍵）');

  const scores: number[] = [];
  let round = 0;
  let started = performance.now();
  let phase = options.random() * 2;
  let holding = false;
  let frame = 0;
  let timer = 0;

  function tick(now: number): void {
    const cross = (COOK_ROUND_SECONDS[round] ?? 1) * slow;
    marker.style.left = `${markerAt((now - started) / 1000, cross, phase) * 100}%`;
    frame = requestAnimationFrame(tick);
  }

  function hit(): void {
    if (holding) return;
    const cross = (COOK_ROUND_SECONDS[round] ?? 1) * slow;
    const score = cookScore(markerAt((performance.now() - started) / 1000, cross, phase));
    scores.push(score);
    holding = true;
    status.textContent = score >= 0.85 ? '剛剛好！' : score >= 0.4 ? '還可以' : '火候不對…';
    timer = window.setTimeout(() => {
      round += 1;
      if (round >= COOK_ROUND_SECONDS.length) {
        finish(scores.reduce((sum, value) => sum + value, 0) / scores.length);
        return;
      }
      holding = false;
      started = performance.now();
      phase = options.random() * 2;
      status.textContent = `第 ${round + 1} 次：更快了`;
    }, RESULT_PAUSE_MS);
  }

  frame = requestAnimationFrame(tick);
  return {
    body: h('div', { className: 'mg-cook' }, bar, status, press),
    handleKey(key) {
      if (key !== ' ' && key !== 'enter') return false;
      hit();
      return true;
    },
    dispose() {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    },
  };
}

function scrub(finish: (score: number) => void): Part {
  const fill = h('div', { className: 'mg-fill' });
  const timeFill = h('div', { className: 'mg-fill mg-fill--time' });
  const status = h('p', { className: 'mg-status', attrs: { 'aria-live': 'polite' } }, '連續點擊！');
  const bubbles = h('div', { className: 'mg-bubbles', attrs: { 'aria-hidden': 'true' } });
  const button = h('button', { className: 'primary mg-big', onClick: () => {
        tap();
      } }, '刷刷刷！（空白鍵）');

  let taps = 0;
  let startedAt = 0;
  let done = false;
  let frame = 0;
  let timer = 0;

  function end(): void {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    const score = scrubScore(taps);
    status.textContent = score >= 0.75 ? '乾乾淨淨！' : score >= 0.4 ? '大致乾淨了' : '還有點髒…';
    timer = window.setTimeout(() => {
      finish(score);
    }, RESULT_PAUSE_MS);
  }

  function tick(now: number): void {
    const elapsed = (now - startedAt) / 1000;
    timeFill.style.width = `${Math.max(0, 1 - elapsed / SCRUB_SECONDS) * 100}%`;
    if (elapsed >= SCRUB_SECONDS) end();
    else frame = requestAnimationFrame(tick);
  }

  function tap(): void {
    if (done) return;
    if (taps === 0) {
      startedAt = performance.now();
      frame = requestAnimationFrame(tick);
    }
    taps += 1;
    fill.style.width = `${scrubScore(taps) * 100}%`;
    if (taps % 3 === 0) bubbles.append(h('span', {}, '🫧'));
    if (taps >= SCRUB_TARGET_TAPS) end();
  }

  return {
    body: h(
      'div',
      { className: 'mg-scrub' },
      h('div', { className: 'mg-track' }, fill),
      h('div', { className: 'mg-track mg-track--thin' }, timeFill),
      bubbles,
      status,
      button,
    ),
    handleKey(key) {
      if (key !== ' ' && key !== 'enter') return false;
      tap();
      return true;
    },
    dispose() {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    },
  };
}

function quiz(options: MinigameOptions, finish: (score: number) => void): Part {
  const questions = makeQuiz(options.random);
  const prompt = h('p', { className: 'mg-prompt' });
  const choices = h('div', { className: 'mg-choices' });
  const status = h('p', { className: 'mg-status', attrs: { 'aria-live': 'polite' } });
  let index = 0;
  let correct = 0;
  let locked = false;
  let timer = 0;

  function show(): void {
    const question = questions[index];
    if (question === undefined) return;
    prompt.textContent = `第 ${index + 1}/${QUIZ_QUESTIONS} 題：${question.prompt}`;
    status.textContent = '';
    choices.replaceChildren(
      ...question.options.map((option, i) =>
        h(
          'button',
          {
            className: 'secondary mg-choice',
            onClick: () => {
              answer(i);
            },
          },
          `${i + 1}. ${option}`,
        ),
      ),
    );
    locked = false;
  }

  function answer(i: number): void {
    const question = questions[index];
    if (locked || question === undefined) return;
    locked = true;
    const right = i === question.answer;
    if (right) correct += 1;
    status.textContent = right ? '答對了！小禾很得意。' : `不是喔，答案是 ${question.options[question.answer] ?? ''}。`;
    timer = window.setTimeout(() => {
      index += 1;
      if (index >= questions.length) finish(quizScore(correct));
      else show();
    }, RESULT_PAUSE_MS);
  }

  show();
  return {
    body: h('div', { className: 'mg-quiz' }, prompt, choices, status),
    handleKey(key) {
      const i = Number(key) - 1;
      if (!Number.isInteger(i) || i < 0 || i > 2) return false;
      answer(i);
      return true;
    },
    dispose() {
      window.clearTimeout(timer);
    },
  };
}

function pack(finish: (score: number) => void): Part {
  const chosen = new Set<string>();
  const needed = PACK_ITEMS.filter((item) => item.needed)
    .map((item) => `${item.emoji}${item.label}`)
    .join(' ');
  const buttons = PACK_ITEMS.map((item, i) => {
    const button = h(
      'button',
      {
        className: 'secondary mg-item',
        attrs: { 'aria-pressed': 'false' },
        onClick: () => {
          toggle(item.id, button);
        },
      },
      h('span', { className: 'mg-item__emoji' }, item.emoji),
      h('span', {}, `${i + 1} ${item.label}`),
    );
    return button;
  });
  const status = h('p', { className: 'mg-status', attrs: { 'aria-live': 'polite' } });
  let done = false;
  let timer = 0;

  function toggle(id: string, button: HTMLElement): void {
    if (done) return;
    if (chosen.has(id)) chosen.delete(id);
    else chosen.add(id);
    button.setAttribute('aria-pressed', String(chosen.has(id)));
  }

  function submit(): void {
    if (done) return;
    done = true;
    const score = packScore(chosen);
    status.textContent = score >= 0.99 ? '一樣不少！' : score >= 0.4 ? '好像少了什麼…' : '這個書包有點危險。';
    timer = window.setTimeout(() => {
      finish(score);
    }, RESULT_PAUSE_MS);
  }

  return {
    body: h(
      'div',
      { className: 'mg-pack' },
      h('p', { className: 'mg-note' }, `明天要帶：${needed}`),
      h('div', { className: 'mg-grid' }, ...buttons),
      status,
      h('button', { className: 'primary mg-big', onClick: submit }, '收好了（Enter）'),
    ),
    handleKey(key) {
      if (key === 'enter') {
        submit();
        return true;
      }
      const i = Number(key) - 1;
      const item = PACK_ITEMS[i];
      const button = buttons[i];
      if (!Number.isInteger(i) || item === undefined || button === undefined) return false;
      toggle(item.id, button);
      return true;
    },
    dispose() {
      window.clearTimeout(timer);
    },
  };
}

const BUILDERS: Readonly<Record<MinigameId, (o: MinigameOptions, finish: (score: number) => void) => Part>> = {
  cook,
  scrub: (_options, finish) => scrub(finish),
  quiz,
  pack: (_options, finish) => pack(finish),
};

/** Builds the little game as a modal card. The caller adds `element` to the page and removes it on `onDone`/`onCancel`. */
export function startMinigame(options: MinigameOptions): MinigameHandle {
  let finished = false;
  const part = BUILDERS[options.game](options, (score) => {
    if (finished) return;
    finished = true;
    options.onDone(score);
  });
  const element = h(
    'div',
    { className: 'minigame', attrs: { role: 'dialog', 'aria-label': options.title } },
    h(
      'div',
      { className: 'card minigame__card' },
      h('h2', { className: 'card__title' }, options.title),
      h('p', { className: 'card__body' }, options.hint),
      part.body,
      h('button', { className: 'ghost', onClick: options.onCancel }, '先不做 (Esc)'),
    ),
  );
  return {
    element,
    handleKey(key) {
      if (key === 'escape') {
        options.onCancel();
        return true;
      }
      return part.handleKey(key);
    },
    dispose() {
      part.dispose();
    },
  };
}
