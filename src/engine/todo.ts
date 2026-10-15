import { eventById } from '../data/deck';
import { KIDS, TASKS } from '../data/meta';
import { BLADDER_DISTRACTED, HUNGRY_BELOW, TASK_DUE_AFTER, TASK_RELEASE } from './constants';
import { activeTask, openViews } from './game';
import { KID_IDS, type GameState, type ZoneId } from './types';
import { TASK_ZONE, ZONES } from './world';

/** One line of the always-visible list of things that need the parent. */
export interface TodoItem {
  readonly key: string;
  readonly kind: 'event' | 'task' | 'body';
  readonly urgent: boolean;
  readonly zone: ZoneId;
  readonly title: string;
  /** Where, and a few words of why. */
  readonly detail: string;
  /** Game minutes until it lapses or falls due; negative once overdue. Null when there is no deadline. */
  readonly left: number | null;
  /** The full length of the countdown, so the bar knows how full it is. */
  readonly span: number | null;
  /** 0-100 progress for kids' tasks. */
  readonly progress: number | null;
}

/** Everything asking for the parent right now, most pressing first. */
export function todoList(state: GameState): readonly TodoItem[] {
  if (state.finished) return [];
  const events: TodoItem[] = openViews(state).map((view) => ({
    key: `event:${view.event.id}`,
    kind: 'event',
    urgent: view.urgent,
    zone: view.zone,
    title: view.event.title,
    detail: ZONES[view.zone].label,
    left: view.minutesLeft,
    span: eventById(view.event.id).ttl,
    progress: null,
  }));

  const tasks: TodoItem[] = KID_IDS.flatMap((id) => {
    const kid = state.kids[id];
    const task = activeTask(kid, state.clock);
    if (task === null) return [];
    const due = TASK_RELEASE[task] + TASK_DUE_AFTER[task];
    return [
      {
        key: `task:${id}:${task}`,
        kind: 'task' as const,
        urgent: false,
        zone: TASK_ZONE[task],
        title: `${KIDS[id].name}：${TASKS[task].label}`,
        detail: ZONES[TASK_ZONE[task]].label,
        left: due - state.clock,
        span: TASK_DUE_AFTER[task],
        progress: Math.round(kid.progress[task]),
      },
    ];
  });

  const body: TodoItem[] = [];
  if (state.bladder >= BLADDER_DISTRACTED) {
    body.push({ key: 'body:toilet', kind: 'body', urgent: false, zone: 'tub', title: '你快憋不住了', detail: ZONES.tub.label, left: null, span: null, progress: null });
  }
  if (state.fullness < HUNGRY_BELOW) {
    body.push({ key: 'body:eat', kind: 'body', urgent: false, zone: 'table', title: '你一整天沒好好吃東西', detail: ZONES.table.label, left: null, span: null, progress: null });
  }
  if (state.energy < 25) {
    body.push({ key: 'body:rest', kind: 'body', urgent: false, zone: 'sofa', title: '你快撐不住了', detail: ZONES.sofa.label, left: null, span: null, progress: null });
  }

  const byLeft = (a: TodoItem, b: TodoItem): number => (a.left ?? Infinity) - (b.left ?? Infinity);
  return [
    ...events.filter((item) => item.urgent).sort(byLeft),
    ...events.filter((item) => !item.urgent).sort(byLeft),
    ...tasks.sort(byLeft),
    ...body,
  ];
}
