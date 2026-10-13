import type { KidId, TaskId } from '../engine/types';

export interface KidProfile {
  readonly name: string;
  readonly grade: string;
  readonly emoji: string;
}

/** Fictional kids. Names are game characters, not anyone's real children. */
export const KIDS: Readonly<Record<KidId, KidProfile>> = {
  elder: { name: '小禾', grade: '小一', emoji: '🧒' },
  younger: { name: '小米', grade: '大班', emoji: '👧' },
};

export interface TaskMeta {
  readonly label: string;
  readonly emoji: string;
}

export const TASKS: Readonly<Record<TaskId, TaskMeta>> = {
  breakfast: { label: '吃早餐', emoji: '🥣' },
  lunch: { label: '吃午餐', emoji: '🍱' },
  homework: { label: '寫功課', emoji: '📚' },
  dinner: { label: '吃晚餐', emoji: '🍚' },
  dishes: { label: '洗碗', emoji: '🍽️' },
  bath: { label: '洗澡', emoji: '🛁' },
  bag: { label: '收書包', emoji: '🎒' },
};
