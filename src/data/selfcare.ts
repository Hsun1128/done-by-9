import type { CareId } from '../engine/types';

export interface CareText {
  /** Button label. */
  readonly label: string;
  readonly emoji: string;
  /** Shown in the log after doing it. */
  readonly outcome: string;
  /** Shown when it is available but you hardly need it. */
  readonly hint: string;
}

/** Text for the things a parent can do for themselves. Numbers live in `engine/constants.ts`. */
export const CARE_TEXT: Readonly<Record<CareId, CareText>> = {
  eat: {
    label: '自己扒幾口飯',
    emoji: '🍚',
    outcome: '你站在餐桌邊，三口扒完剩下的飯。這是你今天第一頓像樣的東西。',
    hint: '你的肚子不餓。',
  },
  rest: {
    label: '在沙發坐一下',
    emoji: '🛋️',
    outcome: '你陷進沙發十分鐘，什麼都沒想。時鐘的聲音變得很大。',
    hint: '你還撐得住。',
  },
  toilet: {
    label: '終於去上廁所',
    emoji: '🚻',
    outcome: '你在浴室關上門，只有四分鐘。外面有人敲門：「你好了沒？」好了，今天第一次。',
    hint: '還不急。',
  },
  coffee: {
    label: '沖一杯咖啡',
    emoji: '☕',
    outcome: '熱水沖下去，香味升起來。你喝了一口，肩膀鬆下來一點。',
    hint: '今天的咖啡已經夠多了。',
  },
};

/** The sentence shown when the parent's body gives out. */
export const DOZE_TEXT =
  '你在沙發上坐下來想喘口氣，眼皮就蓋了下來。二十分鐘後，小米拉著你的袖子：「你睡著了。」';
