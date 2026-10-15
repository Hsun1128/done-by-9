import { DAY_START_MIN } from '../engine/constants';
import {
  KID_IDS,
  STYLE_IDS,
  TASK_ORDER,
  type EventChoice,
  type GameEvent,
  type KidId,
  type Style,
  type TaskId,
} from '../engine/types';
import { KIDS, TASKS } from './meta';
import { STYLE_BASE } from './styles';

const BODIES: Readonly<Record<KidId, Readonly<Record<TaskId, string>>>> = {
  elder: {
    breakfast: '小禾趴在餐桌上，吐司咬了一小口，眼睛還沒完全睜開。',
    lunch: '小禾把午餐的飯粒一顆一顆撥到碗邊，電視聲音開得比他還大。',
    dinner: '小禾坐在餐桌前，筷子在碗裡畫圈圈，眼睛看著窗外。',
    homework: '小禾盯著國語習作，鉛筆在指間轉了三圈，一個字都還沒寫。',
    dishes: '小禾的碗還在桌上，旁邊是已經空掉的杯子。',
    bath: '浴室的水放好了，小禾正在客廳地板上排積木。',
    bag: '明天的書包還癱在玄關，拉鍊開著，水壺不知去向。',
  },
  younger: {
    breakfast: '小米把牛奶倒進麥片裡，又倒了一點在桌上，認真地用手指畫畫。',
    lunch: '小米抱著娃娃坐在餐桌前：「小熊說它想吃布丁，不想吃飯。」',
    dinner: '小米把青菜一根一根挑到碗邊，排成一排。',
    homework: '小米的描圖卡才描了兩筆，她已經開始幫圖上的兔子取名字。',
    dishes: '小米端著自己的小碗站在水槽前，高度剛好到邊緣。',
    bath: '小米抱著娃娃說：「小熊還不想洗澡。」',
    bag: '小米的小背包裡塞了三顆石頭和一張貼紙。',
  },
};

const LABELS: Readonly<Record<TaskId, Readonly<Record<Style, string>>>> = {
  breakfast: {
    nag: '「快吃！再不吃要遲到了！」',
    do_for: '把麥片和吐司擺好，邊催邊餵幾口',
    offer_choice: '「吐司還是麥片？你決定。」',
    wait: '遞上杯子，安靜等他自己吃完',
    together: '你也端著咖啡坐下，陪他一起吃',
  },
  lunch: {
    nag: '「再不吃，飯要涼了！」',
    do_for: '把飯菜夾好，一口一口餵到碗見底',
    offer_choice: '「先吃肉還是先吃菜？你決定。」',
    wait: '把碗放好，坐在旁邊等他自己動筷',
    together: '你拿起自己的碗，一起吃第一口',
  },
  dinner: {
    nag: '「吃快一點！菜都涼了！」',
    do_for: '把飯菜夾好，一口一口催著吃',
    offer_choice: '「先吃青菜還是先吃肉？你決定。」',
    wait: '安靜坐著，等他自己吃完',
    together: '你也坐下來，一起吃第一口',
  },
  homework: {
    nag: '「功課！寫了沒？現在！」',
    do_for: '拿起筆，幫他把剩下的寫完',
    offer_choice: '「要先寫國語還是數學？你選。」',
    wait: '把書桌的燈打開，然後走開',
    together: '坐在旁邊，各做各的（你看書）',
  },
  dishes: {
    nag: '「碗拿去洗！講幾次了！」',
    do_for: '自己把碗洗掉，算了',
    offer_choice: '「你要洗碗還是擦桌子？」',
    wait: '把水槽留著，等他自己來',
    together: '兩個人一起洗，你負責泡泡',
  },
  bath: {
    nag: '「洗澡！洗澡！我數到三！」',
    do_for: '直接抱去浴室，幫他洗好',
    offer_choice: '「要先洗頭還是先玩水？」',
    wait: '把水和毛巾都準備好，然後等',
    together: '一起唱洗澡歌，邊唱邊洗',
  },
  bag: {
    nag: '「書包！明天的東西收了沒？」',
    do_for: '你幫他把書包整理好',
    offer_choice: '「聯絡簿先收還是水壺先收？」',
    wait: '把清單貼在門邊，讓他自己對',
    together: '對著清單一樣一樣念，他來放',
  },
};

const AFTERMATH: Readonly<Record<Style, string>> = {
  nag: '你提高了音量。',
  do_for: '你動手把事情做完了。',
  offer_choice: '你把選擇權遞了過去。',
  wait: '你閉上嘴巴，看著牆上時鐘的秒針。',
  together: '你拉了張椅子坐到旁邊。',
};

function buildChoice(kid: KidId, task: TaskId, style: Style): EventChoice {
  const base = STYLE_BASE[style];
  return {
    id: `checkin:${kid}:${task}:${style}`,
    label: LABELS[task][style],
    style,
    minutes: base.minutes,
    progress: base.progress,
    effects: base.effects,
    money: 0,
    tomorrow: null,
    aftermath: AFTERMATH[style],
  };
}

function buildCheckin(kid: KidId, task: TaskId): GameEvent {
  return {
    id: `checkin:${kid}:${task}`,
    kind: 'checkin',
    title: `${KIDS[kid].name}・${TASKS[task].label}`,
    body: BODIES[kid][task],
    target: { kind: 'task', kid, task },
    zone: null,
    urgent: false,
    repeatable: false,
    ttl: 0,
    lapse: { text: '', mood: 0, patience: 0, money: 0, tomorrow: null },
    window: { from: DAY_START_MIN, to: 24 * 60 },
    choices: STYLE_IDS.map((style) => buildChoice(kid, task, style)),
  };
}

export const CHECKIN_EVENTS: readonly GameEvent[] = KID_IDS.flatMap((kid) =>
  TASK_ORDER.map((task) => buildCheckin(kid, task)),
);

const CHECKIN_INDEX: ReadonlyMap<string, GameEvent> = new Map(
  CHECKIN_EVENTS.map((event) => [event.id, event]),
);

/** The routine check-in for a kid's task. Every (kid, task) pair has one. */
export function checkinFor(kid: KidId, task: TaskId): GameEvent {
  const event = CHECKIN_INDEX.get(`checkin:${kid}:${task}`);
  if (event === undefined) {
    throw new RangeError(`Missing check-in for ${kid}/${task}`);
  }
  return event;
}
