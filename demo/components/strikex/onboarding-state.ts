import type { GuideLesson, GuideRole } from './onboarding-content';

export const GUIDE_STORAGE_KEY = 'strikex-guide-v1';
export type GuideState = { role: GuideRole; lessonId: string; completed: string[]; started: boolean; dismissed: boolean };

export function lessonsFor(role: GuideRole, lessons: GuideLesson[]) {
  return lessons.filter(lesson => lesson.roles.includes(role));
}

/** The guide stores reading progress only; it cannot grant account or unit permissions. */
export function restoreGuide(raw: string | null, lessons: GuideLesson[]): GuideState {
  let value: Partial<GuideState> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) value = parsed as Partial<GuideState>;
  } catch { /* A damaged local preference must never block entry to the app. */ }
  const role: GuideRole = value.role === 'coach' || value.role === 'manager' ? value.role : 'athlete';
  const visible = lessonsFor(role, lessons);
  const ids = new Set(lessons.map(lesson => lesson.id));
  return {
    role,
    lessonId: visible.find(lesson => lesson.id === value.lessonId)?.id || visible[0]?.id || '',
    completed: Array.isArray(value.completed) ? [...new Set(value.completed.filter((id): id is string => typeof id === 'string' && ids.has(id)))] : [],
    started: value.started === true,
    dismissed: value.dismissed === true,
  };
}

export function markLessonRead(state: GuideState, lessons: GuideLesson[]): { state: GuideState; finished: boolean } {
  const visible = lessonsFor(state.role, lessons);
  const index = visible.findIndex(lesson => lesson.id === state.lessonId);
  if (index < 0) return { state, finished: false };
  const completed = [...new Set([...state.completed, state.lessonId])];
  const unread = visible.find(lesson => !completed.includes(lesson.id));
  const next = visible[index + 1] || unread;
  return { state: { ...state, completed, lessonId: next?.id || state.lessonId }, finished: !unread };
}
