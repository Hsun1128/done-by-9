import type { EndingId } from '../engine/types';

export interface EndingContent {
  readonly title: string;
  readonly subtitle: string;
  readonly body: string;
  readonly emoji: string;
}

export const ENDINGS: Readonly<Record<EndingId, EndingContent>> = {
  quiet: {
    title: '安靜的 21:00，另一半回到家',
    subtitle: '孩子自己完成了大部分，家裡安靜得有點不真實。',
    body: '沒有人被吼，也沒有人被代勞，帳上也還有餘額。鑰匙轉動的聲音響起，你終於可以說：「今天，我撐過來了。」',
    emoji: '🌙',
  },
  rushed: {
    title: '趕完了',
    subtitle: '全部都做完了，只是有人的心情被你一路推著跑。',
    body: '事情做完了。明天可以試試「二選一」或「並肩」，看看會不會少喊幾次。',
    emoji: '🏃',
  },
  tight: {
    title: '撐住了，荷包見底',
    subtitle: '全部做完了，只是這週的預算被你用光，還刷了一點。',
    body: '今晚你拿錢換了時間，這不是錯。明天看看哪幾筆可以不花，或哪幾件事可以請人幫忙。',
    emoji: '💳',
  },
  late: {
    title: '九點到了，但沒有爆炸',
    subtitle: '沒有全部做完，不過大家的心情還撐得住。',
    body: '有些事明天早上做也不遲。重要的是，睡前那句晚安是溫柔的。',
    emoji: '🕘',
  },
  chaos: {
    title: '混亂的晚上',
    subtitle: '沒做完，心情也沒顧好。這種晚上每個家都有。',
    body: '今天先到這裡。明天再來一次，你已經知道哪些做法最耗電。',
    emoji: '🌪️',
  },
  collapsed: {
    title: '你在沙發上睡著了',
    subtitle: '身體替你按了暫停鍵，這一天提早結束。',
    body: '顧孩子的人也需要被照顧。下次先吃一口飯、坐一下，再去顧別人。',
    emoji: '😴',
  },
};
