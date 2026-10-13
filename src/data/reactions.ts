import type { KidId, Style } from '../engine/types';

/** Short kid reactions appended to the aftermath of an action. */
export const REACTIONS: Readonly<Record<KidId, Readonly<Record<Style, readonly string[]>>>> = {
  elder: {
    nag: ['小禾翻了個白眼：「我知道啦！」', '小禾的肩膀縮了一下，動作反而變慢了。'],
    do_for: ['小禾鬆了一口氣，轉身去拿積木。', '小禾說：「好喔～」然後沒有再看一眼。'],
    offer_choice: [
      '小禾想了想：「那我先……這個。」他自己拉開了椅子。',
      '小禾挑了一個，還補了一句：「我十分鐘就好。」',
    ],
    wait: ['小禾偷瞄了你兩次，最後自己動手了。', '安靜了一分鐘。小禾嘆了口氣，開始了。'],
    together: [
      '小禾說：「你不要一直看我啦。」但沒有走開。',
      '小禾邊做邊問你一個和這件事完全無關的問題。',
    ],
  },
  younger: {
    nag: ['小米的嘴巴扁了起來，眼眶開始發亮。', '小米大喊：「我在做了啦！」然後原地不動。'],
    do_for: ['小米開心地拍手，馬上跑去找她的娃娃。', '小米靠過來：「你最好了！」'],
    offer_choice: [
      '小米認真地比了比兩邊，指著其中一個：「這個！」',
      '小米說：「我要選第三個。」……沒有第三個。',
    ],
    wait: ['小米已經在跟娃娃講別的事了。', '小米等了你三秒，發現你沒動，轉頭去玩別的。'],
    together: ['小米拿著東西跟你比賽：「誰先好？」', '小米把你的手也拉過去：「你也要一起做。」'],
  },
};
