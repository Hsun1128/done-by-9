import { TASKS, KIDS } from '../data/meta';
import { activeTask } from '../engine/game';
import { TASK_ORDER, type KidId, type KidState } from '../engine/types';
import { h } from './dom';

export type MeterTone = 'patience' | 'mood' | 'bond' | 'energy' | 'food' | 'bladder';

export function meter(label: string, value: number, tone: MeterTone, alarm = false): HTMLElement {
  const fill = h('div', { className: `meter__fill meter__fill--${tone}${alarm ? ' meter__fill--alarm' : ''}` });
  fill.style.width = `${Math.round(value)}%`;
  return h(
    'div',
    {
      className: alarm ? 'meter meter--alarm' : 'meter',
      attrs: {
        role: 'meter',
        'aria-label': label,
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(Math.round(value)),
      },
    },
    h('span', { className: 'meter__label' }, label),
    h('div', { className: 'meter__track' }, fill),
  );
}

export function moodEmoji(mood: number): string {
  if (mood >= 75) return '😄';
  if (mood >= 55) return '🙂';
  if (mood >= 35) return '😕';
  if (mood >= 15) return '😢';
  return '😭';
}

function taskChip(kid: KidState, task: (typeof TASK_ORDER)[number], clock: number): HTMLElement {
  const meta = TASKS[task];
  const progress = kid.progress[task];
  const isDone = progress >= 100;
  const isActive = activeTask(kid, clock) === task;
  const state = isDone ? 'done' : isActive ? 'active' : 'pending';
  const label = `${meta.label}：${isDone ? '完成' : isActive ? `進行中 ${Math.round(progress)}%` : '還沒開始'}`;
  const chip = h(
    'li',
    { className: `chip chip--${state}`, attrs: { 'aria-label': label, title: label } },
    h('span', { className: 'chip__icon' }, isDone ? '✅' : meta.emoji),
  );
  if (isActive) {
    const bar = h('span', { className: 'chip__bar' });
    bar.style.width = `${Math.round(progress)}%`;
    chip.append(bar);
  }
  return chip;
}

export function kidCard(kidId: KidId, kid: KidState, clock: number): HTMLElement {
  const profile = KIDS[kidId];
  return h(
    'section',
    { className: 'kid', attrs: { 'aria-label': `${profile.name}（${profile.grade}）` } },
    h(
      'div',
      { className: 'kid__head' },
      h('span', { className: 'kid__avatar', attrs: { 'aria-hidden': 'true' } }, profile.emoji),
      h(
        'div',
        { className: 'kid__name' },
        h('strong', {}, profile.name),
        h('small', {}, profile.grade),
      ),
      h(
        'span',
        { className: 'kid__mood', attrs: { 'aria-label': `心情 ${Math.round(kid.mood)}` } },
        moodEmoji(kid.mood),
      ),
    ),
    h('ul', { className: 'chips' }, ...TASK_ORDER.map((task) => taskChip(kid, task, clock))),
  );
}
