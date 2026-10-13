import { ENDINGS } from '../../data/endings';
import type { SaveData } from '../../storage';
import { h } from '../dom';

export interface HomeProps {
  readonly save: SaveData;
  /** The shared 3D stage element, shown as a hero above the title. */
  readonly stage: HTMLElement;
  readonly onStart: () => void;
}

export function renderHome({ save, stage, onStart }: HomeProps): HTMLElement {
  const best = save.bestEnding === null ? null : ENDINGS[save.bestEnding];
  return h(
    'main',
    { className: 'screen screen--home' },
    stage,
    h('p', { className: 'eyebrow' }, '07:00 → 21:00'),
    h('h1', { className: 'title' }, '21:00 前，全部搞定'),
    h('p', { className: 'lead' }, '一個帶孩子的一整天。兩個孩子，一個你，十四個小時，撐到另一半下班回家。'),
    h(
      'ul',
      { className: 'bullets' },
      h('li', {}, '在 3D 的家裡自己走動：早餐、午餐、功課、晚餐、洗碗、洗澡、收書包，每個孩子都要做完。'),
      h('li', {}, '時間、錢、精力、肚子、內急——你走的每一步都在花資源，連上廁所都要擠時間。'),
      h('li', {}, '催促最快，但孩子會越來越不想動。慢慢來，時鐘又不等人；用錢買時間，帳戶又不夠。'),
      h('li', {}, '兩個孩子不一樣：同一招，對一個有效，對另一個未必。'),
    ),
    h('button', { className: 'primary', onClick: onStart }, '開始這一天'),
    best !== null &&
      h(
        'p',
        { className: 'muted' },
        `已玩 ${save.plays} 天・最佳結局：${best.emoji} ${best.title}`,
      ),
    h(
      'p',
      { className: 'footnote' },
      '角色與情節皆為虛構；遊戲為了好玩做了簡化，不是專業的親職建議。不會收集任何孩子的資料。',
    ),
  );
}
