import type { MinigameId, TaskId } from '../engine/types';

/** What the button says and what the little game asks of the player. */
export interface ChoreMeta {
  /** The button, e.g. "動手煮早餐". */
  readonly button: string;
  readonly game: MinigameId;
  /** One line of instruction shown over the game. */
  readonly hint: string;
  /** What happens, from a botched job to a perfect one. */
  readonly outcome: readonly [poor: string, ok: string, great: string];
}

export const CHORE_META: Readonly<Record<TaskId, ChoreMeta>> = {
  breakfast: {
    button: '動手煮早餐',
    game: 'cook',
    hint: '在火候剛好的那一格按下去，連煎三次',
    outcome: [
      '蛋煎焦了一邊，小禾皺著眉把焦的部分挑出來。',
      '荷包蛋煎得還行，吐司也沒烤黑。大家開動。',
      '荷包蛋邊緣酥脆、蛋黃還會流。兩個孩子同時說：「好香！」',
    ],
  },
  lunch: {
    button: '動手煮午餐',
    game: 'cook',
    hint: '在火候剛好的那一格按下去，連煮三道',
    outcome: [
      '炒青菜鹹了，你偷偷多給兩杯水。',
      '一盤炒飯、一碗湯，沒有驚喜，但都吃得下去。',
      '飯香飄到客廳，小米自己拖了椅子過來。',
    ],
  },
  dinner: {
    button: '動手煮晚餐',
    game: 'cook',
    hint: '在火候剛好的那一格按下去，連煮三道',
    outcome: [
      '煮得太急，湯有點淡。孩子們還是把碗端了過來。',
      '三菜一湯端上桌。你終於坐下，肩膀垮了一寸。',
      '紅燒豆腐收汁收得漂亮。連小米都說：「再一碗。」',
    ],
  },
  homework: {
    button: '陪寫功課',
    game: 'quiz',
    hint: '小禾卡住了，幫他選出正確答案',
    outcome: [
      '你說錯了一題，小禾拿橡皮擦擦了三次，紙都破了。',
      '你們一題一題對過去，有對有錯，最後算是寫完了。',
      '你一提示，小禾自己「啊」了一聲，寫得又快又工整。',
    ],
  },
  dishes: {
    button: '動手洗碗',
    game: 'scrub',
    hint: '連續點擊（或按空白鍵）把油污刷乾淨',
    outcome: [
      '碗只洗到一半，水槽邊滿是泡泡。你決定晚點再來。',
      '碗洗好了，只是地板濕了一塊。',
      '碗盤晶亮，瀝水架排得整整齊齊。',
    ],
  },
  bath: {
    button: '幫忙洗澡',
    game: 'scrub',
    hint: '連續點擊（或按空白鍵）把小泡泡搓出來',
    outcome: [
      '水花濺得到處都是，兩個人都沒洗乾淨。',
      '洗好了，頭髮也吹乾了大半。',
      '洗得香噴噴，孩子還唱了一首洗澡歌。',
    ],
  },
  bag: {
    button: '幫忙收書包',
    game: 'pack',
    hint: '點出明天要帶的東西，不要多拿',
    outcome: [
      '少帶了一本聯絡簿，明天早上又是一場混亂。',
      '書包收好了，水壺應該有帶。',
      '聯絡簿、水壺、美勞材料，一樣不少。你甚至塞了一顆小糖果。',
    ],
  },
};

/** The line shown after a chore, picked by how well the little game went. */
export function choreText(task: TaskId, score: number): string {
  const lines = CHORE_META[task].outcome;
  return score >= 0.75 ? lines[2] : score >= 0.4 ? lines[1] : lines[0];
}
