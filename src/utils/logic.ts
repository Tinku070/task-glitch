import { DerivedTask, Task } from '@/types';

/* =====================================================
   ROI & DERIVED  (BUG 5 FIXED)
   ===================================================== */

export function computeROI(
  revenue: number,
  timeTaken: number
): number | null {
  if (
    !Number.isFinite(revenue) ||
    !Number.isFinite(timeTaken) ||
    timeTaken <= 0
  ) {
    return null;
  }
  return revenue / timeTaken;
}

export function computePriorityWeight(
  priority: Task['priority']
): 3 | 2 | 1 {
  if (priority === 'High') return 3;
  if (priority === 'Medium') return 2;
  return 1;
}

export function withDerived(task: Task): DerivedTask {
  return {
    ...task,
    roi: computeROI(task.revenue, task.timeTaken),
    priorityWeight: computePriorityWeight(task.priority),
  };
}

/* =====================================================
   SORTING  (BUG 3 FIXED – STABLE SORT)
   ===================================================== */

export function sortTasks(
  tasks: ReadonlyArray<DerivedTask>
): DerivedTask[] {
  return [...tasks].sort((a, b) => {
    const aROI = a.roi ?? -Infinity;
    const bROI = b.roi ?? -Infinity;

    if (bROI !== aROI) return bROI - aROI;
    if (b.priorityWeight !== a.priorityWeight) {
      return b.priorityWeight - a.priorityWeight;
    }

    // deterministic tie-breaker
    return a.title.localeCompare(b.title);
  });
}

/* =====================================================
   CORE METRICS
   ===================================================== */

export function computeTotalRevenue(
  tasks: ReadonlyArray<Task>
): number {
  return tasks
    .filter(t => t.status === 'Done')
    .reduce((sum, t) => sum + t.revenue, 0);
}

export function computeTotalTimeTaken(
  tasks: ReadonlyArray<Task>
): number {
  return tasks.reduce((sum, t) => sum + t.timeTaken, 0);
}

export function computeTimeEfficiency(
  tasks: ReadonlyArray<Task>
): number {
  if (!tasks.length) return 0;
  return (tasks.filter(t => t.status === 'Done').length / tasks.length) * 100;
}

export function computeRevenuePerHour(
  tasks: ReadonlyArray<Task>
): number {
  const time = computeTotalTimeTaken(tasks);
  return time > 0 ? computeTotalRevenue(tasks) / time : 0;
}

export function computeAverageROI(
  tasks: ReadonlyArray<Task>
): number {
  const values = tasks
    .map(t => computeROI(t.revenue, t.timeTaken))
    .filter((v): v is number => typeof v === 'number');

  return values.length
    ? values.reduce((s, v) => s + v, 0) / values.length
    : 0;
}

export function computePerformanceGrade(
  avgROI: number
): 'Excellent' | 'Good' | 'Needs Improvement' {
  if (avgROI > 500) return 'Excellent';
  if (avgROI >= 200) return 'Good';
  return 'Needs Improvement';
}

/* =====================================================
   ANALYTICS (USED BY DASHBOARDS)
   ===================================================== */

export function computeFunnel(tasks: ReadonlyArray<Task>) {
  const todo = tasks.filter(t => t.status === 'Todo').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const done = tasks.filter(t => t.status === 'Done').length;

  const total = todo + inProgress + done;

  return {
    todo,
    inProgress,
    done,
    conversionTodoToInProgress: total ? (inProgress + done) / total : 0,
    conversionInProgressToDone: inProgress ? done / inProgress : 0,
  };
}

export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.max(0, Math.round((b - a) / (24 * 3600 * 1000)));
}

export function computeVelocityByPriority(
  tasks: ReadonlyArray<Task>
): Record<Task['priority'], { avgDays: number; medianDays: number }> {
  const groups: Record<Task['priority'], number[]> = {
    High: [],
    Medium: [],
    Low: [],
  };

  tasks.forEach(t => {
    if (!t.completedAt) return;
    groups[t.priority].push(
      daysBetween(t.createdAt, t.completedAt)
    );
  });

  const result = {
    High: { avgDays: 0, medianDays: 0 },
    Medium: { avgDays: 0, medianDays: 0 },
    Low: { avgDays: 0, medianDays: 0 },
  };

  (Object.keys(groups) as Task['priority'][]).forEach(p => {
    const arr = groups[p].sort((a, b) => a - b);
    if (!arr.length) return;

    result[p] = {
      avgDays: arr.reduce((s, v) => s + v, 0) / arr.length,
      medianDays: arr[Math.floor(arr.length / 2)],
    };
  });

  return result;
}

export function computeWeightedPipeline(
  tasks: ReadonlyArray<Task>
): number {
  const weights: Record<Task['status'], number> = {
    'Todo': 0.1,
    'In Progress': 0.5,
    'Done': 1,
  };

  return tasks.reduce(
    (sum, t) => sum + t.revenue * (weights[t.status] ?? 0),
    0
  );
}

export function computeThroughputByWeek(
  tasks: ReadonlyArray<Task>
) {
  const map = new Map<string, { count: number; revenue: number }>();

  tasks.forEach(t => {
    if (!t.completedAt) return;
    const d = new Date(t.completedAt);
    const key = `${d.getUTCFullYear()}-W${getWeekNumber(d)}`;
    const v = map.get(key) ?? { count: 0, revenue: 0 };
    v.count++;
    v.revenue += t.revenue;
    map.set(key, v);
  });

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, v]) => ({ week, ...v }));
}

export function computeForecast(
  weekly: Array<{ week: string; revenue: number }>,
  horizonWeeks = 4
) {
  if (weekly.length < 2) return [];

  const y = weekly.map(w => w.revenue);
  const x = weekly.map((_, i) => i);

  const n = x.length;
  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = y.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
  const sumXX = x.reduce((s, v) => s + v * v, 0);

  const slope =
    (n * sumXY - sumX * sumY) /
    (n * sumXX - sumX * sumX || 1);

  const intercept = (sumY - slope * sumX) / n;

  return Array.from({ length: horizonWeeks }, (_, i) => ({
    week: `+${i + 1}`,
    revenue: Math.max(0, slope * (x.length + i) + intercept),
  }));
}

export function computeCohortRevenue(
  tasks: ReadonlyArray<Task>
) {
  const map = new Map<string, number>();

  tasks.forEach(t => {
    const d = new Date(t.createdAt);
    const key = `${d.getUTCFullYear()}-W${getWeekNumber(d)}|${t.priority}`;
    map.set(key, (map.get(key) ?? 0) + t.revenue);
  });

  return [...map.entries()].map(([key, revenue]) => {
    const [week, priority] = key.split('|') as [
      string,
      Task['priority']
    ];
    return { week, priority, revenue };
  });
}

/* =====================================================
   INTERNAL UTIL
   ===================================================== */

function getWeekNumber(d: Date): number {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t.getTime() - y.getTime()) / 86400000) + 1) / 7);
}
