import type { EventChoice, EventTarget, GameEvent, Lapse, Style, ZoneId } from '../engine/types';

/** Minutes since midnight for `hour:minute`. */
export const at = (hour: number, minute = 0): number => hour * 60 + minute;

export interface ChoiceSpec {
  readonly slug: string;
  readonly style: Style;
  readonly label: string;
  readonly minutes: number;
  /** Base progress on the event's task (ignored for non-task events). */
  readonly progress: number;
  /** patience, mood, discipline, bond, and optionally the parent's energy. */
  readonly fx: readonly [number, number, number, number] | readonly [number, number, number, number, number];
  /** NT$ change; negative is spending. Omitted means free. */
  readonly money?: number;
  /** A loose end for tomorrow, shown on the result screen. */
  readonly tomorrow?: string;
  readonly aftermath: string;
}

export interface EventSpec {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly target: EventTarget;
  readonly from: number;
  readonly to: number;
  /** Fixed room; omitted means the target's room. */
  readonly zone?: ZoneId;
  readonly urgent?: boolean;
  /** True for household mishaps that may happen again and again. */
  readonly repeatable?: boolean;
  /** Minutes the event waits before it lapses. */
  readonly ttl?: number;
  readonly lapse?: Partial<Lapse>;
  readonly choices: readonly [ChoiceSpec, ChoiceSpec, ChoiceSpec];
}

export const DEFAULT_TTL = 50;
export const URGENT_TTL = 30;

export function buildEvent(kind: 'interruption' | 'errand', spec: EventSpec): GameEvent {
  const urgent = spec.urgent ?? false;
  const choices: EventChoice[] = spec.choices.map((c) => ({
    id: `${spec.id}:${c.slug}`,
    label: c.label,
    style: c.style,
    minutes: c.minutes,
    progress: c.progress,
    effects: {
      patience: c.fx[0],
      mood: c.fx[1],
      discipline: c.fx[2],
      bond: c.fx[3],
      energy: c.fx[4] ?? 0,
    },
    money: c.money ?? 0,
    tomorrow: c.tomorrow ?? null,
    aftermath: c.aftermath,
  }));
  return {
    id: spec.id,
    kind,
    title: spec.title,
    body: spec.body,
    target: spec.target,
    zone: spec.zone ?? null,
    urgent,
    repeatable: spec.repeatable ?? false,
    ttl: spec.ttl ?? (urgent ? URGENT_TTL : DEFAULT_TTL),
    lapse: {
      text: spec.lapse?.text ?? `「${spec.title}」沒有人理，孩子自己撐了一陣子。`,
      mood: spec.lapse?.mood ?? (urgent ? 14 : 6),
      patience: spec.lapse?.patience ?? (urgent ? 6 : 2),
      money: spec.lapse?.money ?? 0,
      tomorrow: spec.lapse?.tomorrow ?? null,
    },
    window: { from: spec.from, to: spec.to },
    choices,
  };
}

const SPECS: readonly EventSpec[] = [
  {
    id: 'lost-eraser',
    title: '橡皮擦不見了',
    body: '小禾翻遍鉛筆盒：「我的橡皮擦不見了！」寫到一半的算式停在那裡。',
    target: { kind: 'task', kid: 'elder', task: 'homework' },
    from: at(15, 0),
    to: at(20, 30),
    choices: [
      {
        slug: 'nag',
        style: 'nag',
        label: '「又不見了？你東西到底放哪裡！」',
        minutes: 3,
        progress: 5,
        fx: [-2, -8, -5, -3],
        aftermath: '你的聲音比預想的大。',
      },
      {
        slug: 'ask',
        style: 'offer_choice',
        label: '「你覺得最後一次看到它在哪？先去那裡找找看。」',
        minutes: 5,
        progress: 25,
        fx: [-3, 3, 6, 2],
        aftermath: '小禾去沙發縫裡摸了一下，真的找到了。',
      },
      {
        slug: 'new',
        style: 'do_for',
        label: '遞一個新的橡皮擦給他',
        minutes: 1,
        progress: 15,
        fx: [0, 2, -4, 0],
        aftermath: '問題解決了，只是那塊舊的還在某個地方。',
      },
    ],
  },
  {
    id: 'stomach-ache',
    title: '肚子痛',
    body: '小米捧著肚子：「我肚子痛……」她的表情很認真，但眼睛一直瞄浴室。',
    target: { kind: 'task', kid: 'younger', task: 'bath' },
    from: at(19, 15),
    to: at(20, 45),
    choices: [
      {
        slug: 'together',
        style: 'together',
        label: '蹲下來摸摸肚子，問她哪裡痛、要不要先上廁所',
        minutes: 6,
        progress: 40,
        fx: [-3, 5, 2, 5],
        aftermath: '上完廁所，她說好像好一點了。',
      },
      {
        slug: 'skip',
        style: 'do_for',
        label: '「那今天先不洗了，去躺著。」',
        minutes: 2,
        progress: 100,
        fx: [-1, 3, -8, 0],
        aftermath: '你省下了二十分鐘。你也不確定這是不是一個好交易。',
      },
      {
        slug: 'nag',
        style: 'nag',
        label: '「你剛剛還在跑跑跳跳，不要找藉口！」',
        minutes: 3,
        progress: 10,
        fx: [-2, -12, -5, -8],
        aftermath: '她眼眶紅了。你開始不確定自己是不是說錯話。',
      },
    ],
  },
  {
    id: 'crayon-fight',
    title: '搶蠟筆',
    body: '客廳傳來尖叫：兩個人同時抓住同一支藍色蠟筆。',
    target: { kind: 'family' },
    from: at(9, 0),
    to: at(20, 30),
    choices: [
      {
        slug: 'judge',
        style: 'do_for',
        label: '「給小米，哥哥讓妹妹。」（你直接判決）',
        minutes: 2,
        progress: 0,
        fx: [-1, -6, -5, -2],
        aftermath: '小米贏了。小禾覺得這很不公平。',
      },
      {
        slug: 'solve',
        style: 'offer_choice',
        label: '「你們兩個想一個都可以接受的辦法，我等你們。」',
        minutes: 8,
        progress: 0,
        fx: [-4, 3, 9, 5],
        aftermath: '吵了一分鐘，然後他們決定輪流，用沙漏計時。',
      },
      {
        slug: 'listen',
        style: 'together',
        label: '把兩個人叫到沙發，一人說一遍發生什麼事',
        minutes: 6,
        progress: 0,
        fx: [-3, 2, 4, 7],
        aftermath: '小米先說，小禾插嘴，你舉手示意輪流。',
      },
    ],
  },
  {
    id: 'milk-spill',
    title: '牛奶打翻了',
    body: '「啪——」小米的牛奶倒在餐桌上，慢慢流向桌邊。',
    target: { kind: 'task', kid: 'younger', task: 'dinner' },
    from: at(18, 0),
    to: at(19, 15),
    choices: [
      {
        slug: 'rescue',
        style: 'do_for',
        label: '衝過去搶救：抹布、擦桌、擦地',
        minutes: 3,
        progress: 20,
        fx: [-2, 1, -5, 0],
        aftermath: '桌面恢復乾淨，小米站在原地看你擦。',
      },
      {
        slug: 'cloth',
        style: 'together',
        label: '遞一塊抹布給她：「我們一起擦，你擦桌面，我擦地上。」',
        minutes: 5,
        progress: 40,
        fx: [-3, 5, 5, 5],
        aftermath: '小米擦得很用力，擦完還說：「換我當老闆。」',
      },
      {
        slug: 'pick',
        style: 'offer_choice',
        label: '「抹布在水槽下，你要自己拿還是我遞給你？」',
        minutes: 4,
        progress: 30,
        fx: [-2, 3, 7, 2],
        aftermath: '她自己去拿了，抹布一路拖在地上。',
      },
    ],
  },
  {
    id: 'box-notice',
    title: '明天要帶紙盒',
    body: '翻開聯絡簿，小禾小聲說：「老師說明天要帶一個空紙盒……」',
    target: { kind: 'task', kid: 'elder', task: 'bag' },
    from: at(20, 0),
    to: at(20, 55),
    choices: [
      {
        slug: 'nag',
        style: 'nag',
        label: '「為什麼現在才講！？現在去哪裡生一個盒子！」',
        minutes: 3,
        progress: 5,
        fx: [-3, -10, -6, -5],
        aftermath: '小禾低下頭，聯絡簿上的字糊成一團。',
      },
      {
        slug: 'dig',
        style: 'do_for',
        label: '自己衝去資源回收桶翻',
        minutes: 8,
        progress: 40,
        fx: [-6, 1, -6, 0],
        aftermath: '你在鞋盒、餅乾盒和泡麵箱之間選了一個剛好的。',
      },
      {
        slug: 'search',
        style: 'offer_choice',
        label: '「我們家有哪些盒子？你先去找，找到我們一起看。」',
        minutes: 6,
        progress: 50,
        fx: [-3, 3, 6, 3],
        aftermath: '小禾拖來三個盒子，認真地比較大小。',
      },
    ],
  },
  {
    id: 'grandma-call',
    title: '阿嬤來電',
    body: '手機響了，螢幕上是阿嬤。你能感覺到時鐘在背後走。',
    target: { kind: 'family' },
    from: at(9, 0),
    to: at(20, 10),
    choices: [
      {
        slug: 'hangup',
        style: 'do_for',
        label: '「阿嬤我先掛，晚一點打給你！」',
        minutes: 1,
        progress: 0,
        fx: [-1, -2, 0, -2],
        aftermath: '阿嬤很諒解，你有點心虛。',
      },
      {
        slug: 'speaker',
        style: 'together',
        label: '開擴音，讓兩個孩子輪流跟阿嬤說一句今天的事',
        minutes: 7,
        progress: 0,
        fx: [4, 6, 3, 6],
        aftermath: '兩個孩子搶著說，阿嬤笑得很大聲。你竟然有點放鬆。',
      },
      {
        slug: 'multitask',
        style: 'wait',
        label: '開擴音，一邊聽一邊走去廚房做事',
        minutes: 4,
        progress: 0,
        fx: [-1, 1, 2, 2],
        aftermath: '你一邊聽一邊洗了兩個杯子，孩子們自己玩了一會。',
      },
    ],
  },
  {
    id: 'homework-meltdown',
    title: '「我就是不會！」',
    body: '小禾把鉛筆丟在桌上：「我就是不會！我最討厭數學！」',
    target: { kind: 'task', kid: 'elder', task: 'homework' },
    from: at(15, 15),
    to: at(20, 30),
    choices: [
      {
        slug: 'nag',
        style: 'nag',
        label: '「不會就去想！你不寫完不准休息！」',
        minutes: 3,
        progress: 10,
        fx: [-3, -14, -8, -8],
        aftermath: '小禾趴在桌上，肩膀一抖一抖。',
      },
      {
        slug: 'sit',
        style: 'together',
        label: '坐到他旁邊：「我們先一起看第一題，你說說看題目問什麼。」',
        minutes: 9,
        progress: 45,
        fx: [-5, 5, 5, 7],
        aftermath: '他念了一遍題目，說：「喔，原來是這樣。」',
      },
      {
        slug: 'water',
        style: 'wait',
        label: '「你先去喝水，三分鐘後再回來。」',
        minutes: 6,
        progress: 30,
        fx: [-4, 4, 7, 3],
        aftermath: '他喝了水、抱怨了一下，回來了。',
      },
    ],
  },
  {
    id: 'bubbles',
    title: '泡泡城堡',
    body: '浴室傳來奇怪的安靜。你推開門，整間浴室都是泡泡，小米坐在中間，滿臉得意。',
    target: { kind: 'task', kid: 'younger', task: 'bath' },
    from: at(19, 15),
    to: at(20, 45),
    choices: [
      {
        slug: 'nag',
        style: 'nag',
        label: '「你在幹嘛！！誰讓你倒這麼多！」',
        minutes: 3,
        progress: 10,
        fx: [-3, -10, -5, -6],
        aftermath: '泡泡很安靜，小米也是。',
      },
      {
        slug: 'castle',
        style: 'together',
        label: '「哇，好多泡泡。我們來比誰能堆得最高。」然後順手洗乾淨',
        minutes: 8,
        progress: 60,
        fx: [-4, 7, 3, 7],
        aftermath: '三分鐘後她洗乾淨了，因為她正在「洗泡泡城堡」。',
      },
      {
        slug: 'rinse',
        style: 'do_for',
        label: '直接把她沖乾淨、擦乾',
        minutes: 5,
        progress: 100,
        fx: [-3, -3, -6, -1],
        aftermath: '洗好了。小米看著泡泡城堡的遺跡，沒有說話。',
      },
    ],
  },
  {
    id: 'picky-dinner',
    title: '青菜攻防戰',
    body: '小米看著盤子裡的青菜，嘴巴閉得緊緊的。',
    target: { kind: 'task', kid: 'younger', task: 'dinner' },
    from: at(18, 0),
    to: at(19, 30),
    choices: [
      {
        slug: 'nag',
        style: 'nag',
        label: '「一口！就一口！不吃完不准離開！」',
        minutes: 4,
        progress: 25,
        fx: [-3, -10, -6, -6],
        aftermath: '她含著那一口，三分鐘沒有嚥下去。',
      },
      {
        slug: 'pick',
        style: 'offer_choice',
        label: '「你想先吃哪一種綠色的？花椰菜還是小黃瓜？」',
        minutes: 5,
        progress: 45,
        fx: [-3, 3, 6, 3],
        aftermath: '她選了花椰菜，說它像小樹。',
      },
      {
        slug: 'bite',
        style: 'together',
        label: '你也夾一口青菜：「我們一起吃，數一二三。」',
        minutes: 5,
        progress: 50,
        fx: [-3, 5, 4, 6],
        aftermath: '你們同時咬下去，她皺眉，然後吞了。',
      },
    ],
  },
  {
    id: 'helpful-elder',
    title: '小禾主動幫忙',
    body: '小禾突然說：「我來幫妹妹收書包。」他自己都有點驚訝。',
    target: { kind: 'kid', kid: 'elder' },
    from: at(19, 30),
    to: at(21, 0),
    choices: [
      {
        slug: 'thanks',
        style: 'together',
        label: '「謝謝你。你幫了我一個很大的忙。」',
        minutes: 1,
        progress: 0,
        fx: [5, 6, 5, 7],
        aftermath: '他假裝不在意，但耳朵紅了。',
      },
      {
        slug: 'decline',
        style: 'do_for',
        label: '「不用啦，我來比較快。」',
        minutes: 2,
        progress: 0,
        fx: [0, -3, -5, -2],
        aftermath: '他點點頭，默默走開了。',
      },
      {
        slug: 'assign',
        style: 'offer_choice',
        label: '「好啊！你負責水壺和聯絡簿，剩下的我來。」',
        minutes: 2,
        progress: 0,
        fx: [3, 4, 6, 5],
        aftermath: '他認真地清點水壺和聯絡簿，像在執行任務。',
      },
    ],
  },
  {
    id: 'sleepy-younger',
    title: '才八點就想睡',
    body: '才八點多，小米開始揉眼睛，哈欠一個接一個。',
    target: { kind: 'kid', kid: 'younger' },
    from: at(20, 0),
    to: at(21, 0),
    choices: [
      {
        slug: 'cuddle',
        style: 'together',
        label: '抱起來坐一下，輕輕數三件今天開心的事',
        minutes: 5,
        progress: 0,
        fx: [3, 5, 2, 6],
        aftermath: '數到第二件，她差點睡著。',
      },
      {
        slug: 'hurry',
        style: 'do_for',
        label: '「好，我們快一點，讓你早點睡。」你加快所有動作',
        minutes: 2,
        progress: 0,
        fx: [-2, 2, -3, 1],
        aftermath: '你把動作加快了，她有點被拖著走。',
      },
      {
        slug: 'nag',
        style: 'nag',
        label: '「現在不能睡！還沒洗澡！」',
        minutes: 2,
        progress: 0,
        fx: [-2, -8, -4, -5],
        aftermath: '她發出一聲長長的、疲憊的抗議。',
      },
    ],
  },
  {
    id: 'five-minutes',
    title: '再玩五分鐘',
    body: '小米抱著娃娃出現：「我可以先玩五分鐘再洗碗嗎？」',
    target: { kind: 'kid', kid: 'younger' },
    from: at(10, 0),
    to: at(20, 0),
    choices: [
      {
        slug: 'timer',
        style: 'offer_choice',
        label: '「好，五分鐘。你要用哪個計時器？」',
        minutes: 7,
        progress: 0,
        fx: [-3, 4, 7, 3],
        aftermath: '她挑了沙漏。五分鐘後，她真的來了。',
      },
      {
        slug: 'nag',
        style: 'nag',
        label: '「不行！現在！碗！」',
        minutes: 2,
        progress: 0,
        fx: [-2, -9, -5, -4],
        aftermath: '娃娃被抱得更緊了。',
      },
      {
        slug: 'wait',
        style: 'wait',
        label: '「好，你玩，我等。」',
        minutes: 5,
        progress: 0,
        fx: [-5, 3, 6, 2],
        aftermath: '你看著時鐘，五分鐘有點長。',
      },
    ],
  },
  {
    id: 'dish-crash',
    title: '碗滑了一下',
    body: '小禾端碗時手一滑，碗掉在水槽邊，沒破，但發出很大的一聲。',
    target: { kind: 'task', kid: 'elder', task: 'dishes' },
    from: at(18, 45),
    to: at(20, 30),
    choices: [
      {
        slug: 'nag',
        style: 'nag',
        label: '「小心一點！我就說會掉！」',
        minutes: 3,
        progress: 10,
        fx: [-2, -8, -4, -5],
        aftermath: '小禾的手僵在半空。',
      },
      {
        slug: 'hold',
        style: 'together',
        label: '「沒事，碗沒破。要不要我扶著一邊，你洗？」',
        minutes: 5,
        progress: 45,
        fx: [-3, 4, 4, 5],
        aftermath: '兩個人的手一起泡在水裡，這次碗穩穩地放上架子。',
      },
      {
        slug: 'takeover',
        style: 'do_for',
        label: '「算了，我來洗。」',
        minutes: 4,
        progress: 100,
        fx: [-2, 0, -6, -1],
        aftermath: '你三兩下洗完。小禾站在旁邊，不知道該做什麼。',
      },
    ],
  },
];

export const INTERRUPTION_EVENTS: readonly GameEvent[] = SPECS.map((spec) =>
  buildEvent('interruption', spec),
);
