import { ENDINGS } from './data/endings';
import { formatClock } from './engine/clock';
import type { Summary } from './engine/types';

/** Plain-text recap for the clipboard or the native share sheet. */
export function buildShareText(summary: Summary, siteUrl: string): string {
  const ending = ENDINGS[summary.ending];
  const headline = summary.allDone
    ? `我在 ${formatClock(summary.finishClock)} 把兩個孩子的一整天全部搞定了`
    : '今天的待辦沒有全部做完，但我撐到了另一半回家的 21:00';
  return [
    `🌙 21:00 前，全部搞定`,
    headline,
    `結局：${ending.emoji} ${ending.title}`,
    `孩子自己動手 ${summary.avgDiscipline}・平均心情 ${summary.avgMood}・今天花了 NT$${summary.spent.toLocaleString('en-US')}`,
    siteUrl,
  ].join('\n');
}
