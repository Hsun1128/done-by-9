export interface NarrationCard {
  /** Who is speaking, or null for the narrator. */
  readonly speaker: string | null;
  readonly text: string;
}

/** Opening cards shown once at the start of the day. */
export const INTRO_CARDS: readonly NarrationCard[] = [
  {
    speaker: null,
    text: '07:00。今天放假在家：小禾（小一）和小米（大班）都賴在餐桌旁，另一半正在玄關穿鞋，要出門上班。',
  },
  {
    speaker: null,
    text: '冰箱裡只剩半鍋昨天的菜。手機的銀行 App 說，這週剩下的彈性預算是 NT$1,500。',
  },
  {
    speaker: null,
    text: '撐到晚上九點，另一半回家。這之前，兩個孩子要吃完三餐、寫完功課、洗好碗和澡、收好書包。你呢？你連早餐都還沒吃。',
  },
  {
    speaker: '提示',
    text: '頭上有「!」的人需要你，紅色的「!」要先處理。用 WASD、方向鍵或點地板走過去，靠近後按 E。你走的每一步都會花時間，也都會花錢，或花心力。',
  },
];
