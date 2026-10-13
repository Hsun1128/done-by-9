import type { Style } from '../engine/types';

export interface TechniqueCard {
  readonly name: string;
  readonly summary: string;
  readonly emoji: string;
}

/**
 * Plain-language cards unlocked by styles you used. They simplify on purpose:
 * this is a game, not professional parenting advice.
 */
export const TECHNIQUES: Readonly<Record<Style, TechniqueCard>> = {
  nag: {
    name: '催促',
    summary: '短期很有效、長期遞減：孩子學到的是「等大人喊到第三次再動」。',
    emoji: '📣',
  },
  do_for: {
    name: '代勞',
    summary: '累了、生病、趕時間時是對的選擇。變成習慣，孩子就少了一次練習的機會。',
    emoji: '🤲',
  },
  offer_choice: {
    name: '二選一',
    summary: '把「要不要」換成「A 還是 B」：孩子保有決定權，你保有方向。',
    emoji: '🔀',
  },
  wait: {
    name: '留白',
    summary: '說一次就停，給孩子幾分鐘自己啟動。你的安靜也是一種提醒。',
    emoji: '⏳',
  },
  together: {
    name: '並肩',
    summary: '你在旁邊做自己的事，孩子比較容易進入狀態，也更願意開口說卡在哪裡。',
    emoji: '🪑',
  },
};
