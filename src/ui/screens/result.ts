import { ENDINGS } from '../../data/endings';
import { TECHNIQUES } from '../../data/techniques';
import { formatClock } from '../../engine/clock';
import type { Summary } from '../../engine/types';
import { h } from '../dom';

export interface ResultActions {
  readonly onSaveImage: () => void;
  readonly onShare: () => void;
  readonly onCopy: () => void;
  readonly onCta: () => void;
  readonly onReplay: () => void;
}

export interface ResultProps {
  readonly summary: Summary;
  readonly actions: ResultActions;
  /** True once the CTA was clicked and there is no external link to open. */
  readonly ctaAcknowledged: boolean;
}

export interface ResultView {
  readonly element: HTMLElement;
  /** Updates the small status line under the share buttons without re-rendering. */
  readonly setStatus: (text: string) => void;
}

const money = (n: number): string => `NT$ ${n.toLocaleString('en-US')}`;

function stat(label: string, value: string): HTMLElement {
  return h(
    'div',
    { className: 'stat' },
    h('span', { className: 'stat__value' }, value),
    h('span', { className: 'stat__label' }, label),
  );
}

export function renderResult({ summary, actions, ctaAcknowledged }: ResultProps): ResultView {
  const ending = ENDINGS[summary.ending];
  const status = h('p', { className: 'status', attrs: { 'aria-live': 'polite' } });

  const cards = summary.techniques.map((style) => {
    const card = TECHNIQUES[style];
    return h(
      'li',
      { className: 'technique' },
      h('span', { className: 'technique__icon', attrs: { 'aria-hidden': 'true' } }, card.emoji),
      h('div', {}, h('strong', {}, card.name), h('p', {}, card.summary)),
    );
  });

  const element = h(
    'main',
    { className: 'screen screen--result' },
    h('div', { className: 'hero', attrs: { 'aria-hidden': 'true' } }, ending.emoji),
    h('h1', { className: 'title' }, ending.title),
    h('p', { className: 'lead' }, ending.subtitle),
    h(
      'p',
      { className: 'finish' },
      summary.allDone
        ? `全部完成：${formatClock(summary.finishClock)}`
        : summary.ending === 'collapsed'
          ? '你的身體先喊停了'
          : '21:00 到了，還有事沒做完',
    ),
    h(
      'div',
      { className: 'stats' },
      stat('孩子自己動手', String(summary.avgDiscipline)),
      stat('平均心情', String(summary.avgMood)),
      stat('親子連結', String(summary.bond)),
      stat('深呼吸', String(summary.breaths)),
      stat('今天花了', money(summary.spent)),
      stat('預算剩', money(summary.money)),
    ),
    h('p', { className: 'card__body' }, ending.body),
    summary.tomorrow.length > 0 && h('h2', { className: 'section' }, '明天的待辦'),
    summary.tomorrow.length > 0 &&
      h('ul', { className: 'tomorrow' }, ...summary.tomorrow.map((note) => h('li', {}, note))),
    summary.missed > 0 &&
      h('p', { className: 'muted' }, `有 ${summary.missed} 件事來不及處理，自己過期了。`),
    cards.length > 0 && h('h2', { className: 'section' }, '今天用到的招式'),
    cards.length > 0 && h('ul', { className: 'techniques' }, ...cards),
    h(
      'div',
      { className: 'share' },
      h('button', { className: 'secondary', onClick: actions.onSaveImage }, '存成圖片'),
      h('button', { className: 'secondary', onClick: actions.onShare }, '分享'),
      h('button', { className: 'secondary', onClick: actions.onCopy }, '複製結算'),
    ),
    status,
    h(
      'section',
      { className: 'card cta' },
      h('h2', { className: 'card__title' }, '把這一天變成家裡的例行表'),
      h(
        'p',
        { className: 'card__body' },
        '我們正在做一份可列印的「21:00 前」一日例行表，讓孩子自己看圖就知道下一步。有興趣就點一下。',
      ),
      h(
        'button',
        { className: 'primary', onClick: actions.onCta, disabled: ctaAcknowledged },
        ctaAcknowledged ? '謝謝！已記下你的興趣' : '我想要這份例行表',
      ),
    ),
    h('button', { className: 'primary', onClick: actions.onReplay }, '再過一天'),
  );

  return {
    element,
    setStatus: (text) => {
      status.textContent = text;
    },
  };
}
