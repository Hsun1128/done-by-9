import type { NarrationCard } from '../../data/intro';
import { h } from '../dom';

export interface IntroProps {
  readonly cards: readonly NarrationCard[];
  readonly onDone: () => void;
  /** Characters revealed per tick; 0 shows each card at once (reduced motion, tests). */
  readonly typewriter: boolean;
}

export interface IntroView {
  readonly element: HTMLElement;
  /** Next card, or finish if it was the last. Finishing the typing comes first. */
  advance(): void;
  dispose(): void;
}

/** Narration cards before the day starts. Tap or press Enter/Space to move on. */
export function renderIntro({ cards, onDone, typewriter }: IntroProps): IntroView {
  let index = 0;
  let shown = 0;
  let timer = 0;

  const speaker = h('p', { className: 'intro__speaker' });
  const text = h('p', { className: 'intro__text', attrs: { 'aria-live': 'polite' } });
  const progress = h('p', { className: 'intro__progress' });
  const next = h('button', { className: 'primary' }, '繼續');

  const card = (): NarrationCard => {
    const current = cards[index];
    if (current === undefined) throw new RangeError(`No intro card at ${index}`);
    return current;
  };

  const paint = (): void => {
    const current = card();
    speaker.textContent = current.speaker ?? '';
    speaker.hidden = current.speaker === null;
    text.textContent = current.text.slice(0, shown);
    progress.textContent = `${index + 1} / ${cards.length}`;
    next.textContent = index === cards.length - 1 && shown >= current.text.length ? '開始這一天' : '繼續';
  };

  const stopTyping = (): void => {
    window.clearInterval(timer);
    timer = 0;
  };

  const show = (): void => {
    stopTyping();
    const current = card();
    shown = typewriter ? 0 : current.text.length;
    paint();
    if (!typewriter) return;
    timer = window.setInterval(() => {
      shown += 1;
      paint();
      if (shown >= current.text.length) stopTyping();
    }, 35);
  };

  const advance = (): void => {
    const current = card();
    if (shown < current.text.length) {
      stopTyping();
      shown = current.text.length;
      paint();
      return;
    }
    if (index >= cards.length - 1) {
      onDone();
      return;
    }
    index += 1;
    show();
  };

  next.addEventListener('click', advance);
  const element = h(
    'main',
    { className: 'screen screen--intro' },
    h('div', { className: 'intro__card card' }, speaker, text),
    progress,
    next,
    h('button', { className: 'ghost', onClick: onDone }, '跳過'),
  );
  element.addEventListener('click', (event) => {
    if (event.target === element) advance();
  });
  show();

  return { element, advance, dispose: stopTyping };
}
