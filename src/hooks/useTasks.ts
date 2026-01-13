import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DerivedTask, Metrics, Task } from '@/types';
import {
  computeAverageROI,
  computePerformanceGrade,
  computeRevenuePerHour,
  computeTimeEfficiency,
  computeTotalRevenue,
  withDerived,
  sortTasks as sortDerived,
} from '@/utils/logic';
import { generateSalesTasks } from '@/utils/seed';

interface UseTasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  derivedSorted: DerivedTask[];
  metrics: Metrics;
  lastDeleted: Task | null;
  addTask: (task: Omit<Task, 'id'> & { id?: string }) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  undoDelete: () => void;
}

const INITIAL_METRICS: Metrics = {
  totalRevenue: 0,
  totalTimeTaken: 0,
  timeEfficiencyPct: 0,
  revenuePerHour: 0,
  averageROI: 0,
  performanceGrade: 'Needs Improvement',
};

export function useTasks(): UseTasksState {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<Task | null>(null);
  const initializedRef = useRef(false);

  //  Normalize & validate tasks safely
  function normalizeTasks(input: any[]): Task[] {
    return (Array.isArray(input) ? input : [])
      .filter(t => t && t.title && t.revenue != null && t.timeTaken > 0)
      .map(t => ({
        id: t.id ?? crypto.randomUUID(),
        title: String(t.title),
        revenue: Number(t.revenue) || 0,
        timeTaken: Number(t.timeTaken) > 0 ? Number(t.timeTaken) : 1,
        priority: t.priority,
        status: t.status,
        notes: t.notes,
        createdAt: t.createdAt ?? new Date().toISOString(),
        completedAt: t.completedAt,
      }));
  }

  //  FIX BUG 1: Load tasks ONLY ONCE
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    async function loadTasks() {
      try {
        const res = await fetch('/tasks.json');
        let data: any[] = [];
        if (res.ok) data = await res.json();
        const normalized = normalizeTasks(data);
        setTasks(normalized.length ? normalized : generateSalesTasks(50));
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load tasks');
        setTasks(generateSalesTasks(50));
      } finally {
        setLoading(false);
      }
    }

    loadTasks();
  }, []);

  // Stable derived + sorting
  const derivedSorted = useMemo<DerivedTask[]>(() => {
    return sortDerived(tasks.map(withDerived));
  }, [tasks]);

  const metrics = useMemo<Metrics>(() => {
    if (!tasks.length) return INITIAL_METRICS;
    const totalRevenue = computeTotalRevenue(tasks);
    const totalTimeTaken = tasks.reduce((s, t) => s + t.timeTaken, 0);
    const timeEfficiencyPct = computeTimeEfficiency(tasks);
    const revenuePerHour = computeRevenuePerHour(tasks);
    const averageROI = computeAverageROI(tasks);
    const performanceGrade = computePerformanceGrade(averageROI);
    return { totalRevenue, totalTimeTaken, timeEfficiencyPct, revenuePerHour, averageROI, performanceGrade };
  }, [tasks]);

  const addTask = useCallback((task: Omit<Task, 'id'> & { id?: string }) => {
    setTasks(prev => [
      ...prev,
      {
        ...task,
        id: task.id ?? crypto.randomUUID(),
        timeTaken: task.timeTaken > 0 ? task.timeTaken : 1,
        createdAt: new Date().toISOString(),
        completedAt: task.status === 'Done' ? new Date().toISOString() : undefined,
      },
    ]);
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              ...patch,
              timeTaken: patch.timeTaken && patch.timeTaken > 0 ? patch.timeTaken : t.timeTaken,
              completedAt:
                t.status !== 'Done' && patch.status === 'Done'
                  ? new Date().toISOString()
                  : t.completedAt,
            }
          : t
      )
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === id) || null;
      setLastDeleted(target);
      return prev.filter(t => t.id !== id);
    });
  }, []);

  // FIX 
  const undoDelete = useCallback(() => {
    if (!lastDeleted) return;
    setTasks(prev => [...prev, lastDeleted]);
    setLastDeleted(null);
  }, [lastDeleted]);

  return { tasks, loading, error, derivedSorted, metrics, lastDeleted, addTask, updateTask, deleteTask, undoDelete };
}
