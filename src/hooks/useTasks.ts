import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DerivedTask, Metrics, Task } from '@/types';
import {
  computeAverageROI,
  computePerformanceGrade,
  computeRevenuePerHour,
  computeTimeEfficiency,
  computeTotalRevenue,
  withDerived,
  sortTasks,
} from '@/utils/logic';
import { generateSalesTasks } from '@/utils/seed';

const EMPTY_METRICS: Metrics = {
  totalRevenue: 0,
  totalTimeTaken: 0,
  timeEfficiencyPct: 0,
  revenuePerHour: 0,
  averageROI: 0,
  performanceGrade: 'Needs Improvement',
};

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDeleted, setLastDeleted] = useState<Task | null>(null);
  const loadedRef = useRef(false);

  // BUG 1 FIX: single fetch
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    fetch('/tasks.json')
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        setTasks(data.length ? data : generateSalesTasks(30));
      })
      .finally(() => setLoading(false));
  }, []);

  const derivedSorted = useMemo<DerivedTask[]>(() => {
    return sortTasks(tasks.map(withDerived));
  }, [tasks]);

  const metrics = useMemo<Metrics>(() => {
    if (!tasks.length) return EMPTY_METRICS;

    const avgROI = computeAverageROI(tasks);

    return {
      totalRevenue: computeTotalRevenue(tasks),
      totalTimeTaken: tasks.reduce((s, t) => s + t.timeTaken, 0),
      timeEfficiencyPct: computeTimeEfficiency(tasks),
      revenuePerHour: computeRevenuePerHour(tasks),
      averageROI: avgROI,
      performanceGrade: computePerformanceGrade(avgROI),
    };
  }, [tasks]);

  const addTask = useCallback((task: Omit<Task, 'id'>) => {
    setTasks(prev => [
      ...prev,
      {
        ...task,
        id: crypto.randomUUID(),
        createdAt: task.createdAt ?? new Date().toISOString(),
      },
    ]);
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === id) ?? null;
      setLastDeleted(target);
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const undoDelete = useCallback(() => {
    if (!lastDeleted) return;
    setTasks(prev => [...prev, lastDeleted]);
    setLastDeleted(null);
  }, [lastDeleted]);

  const clearLastDeleted = useCallback(() => {
    setLastDeleted(null);
  }, []);

  return {
    tasks,
    loading,
    error: null, // ✅ REQUIRED BY CONTEXT
    derivedSorted,
    metrics,
    lastDeleted,
    addTask,
    updateTask,
    deleteTask,
    undoDelete,
    clearLastDeleted,
  };
}
