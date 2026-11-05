// 共享类型定义（与后端 schema 对应）

export interface Subject {
  id: number;
  name: string;
  color: string;
  current_progress: string | null;
  created_at: string;
}

export interface Event {
  id: number;
  subject_id: number | null;
  title: string;
  type: 'test' | 'homework' | 'activity' | 'recite' | string;
  start_at: string;
  remind_before_min: number;
  notes: string | null;
  done: boolean;
  created_at: string;
}

export interface PlanTask {
  id: number;
  event_id: number;
  plan_date: string;
  task: string;
  minutes: number;
  is_fallback: boolean;
  done: boolean;
  created_at: string;
}

export interface MaterialContent {
  concepts?: { title: string; desc: string }[];
  questions?: { level: '易' | '中' | '难'; content: string }[];
  answers?: { index: number; answer: string; reason: string }[];
  pitfall?: string;
}

export interface Material {
  id: number;
  subject_id: number;
  week_no: number;
  topic: string;
  type: string;
  title: string;
  content: MaterialContent;
  source: string | null;
  ai_generated: boolean;
  created_at: string;
}

export interface DailyCard {
  id: number;
  card_date: string;
  headline: string;
  must_do: string;
  fallback: string;
}

export const EVENT_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'test', label: '考试/小测', icon: 'clipboard-check' },
  { value: 'homework', label: '作业', icon: 'file-pen' },
  { value: 'recite', label: '背诵', icon: 'book' },
  { value: 'activity', label: '活动', icon: 'calendar-day' },
];

export function typeLabel(t: string): string {
  return EVENT_TYPES.find((x) => x.value === t)?.label || '待办';
}

// 简单的绝对时间表述
export function formatAbs(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((t.getTime() - dayStart.getTime()) / 86400000);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  let day = '';
  if (diff === 0) day = '今天';
  else if (diff === 1) day = '明天';
  else if (diff === -1) day = '昨天';
  else {
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    day = week[d.getDay()];
  }
  return `${day} ${hm}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}