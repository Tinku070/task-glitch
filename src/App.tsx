import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useMemo, useState } from 'react';

import MetricsBar from '@/components/MetricsBar';
import TaskTable from '@/components/TaskTable';
import UndoSnackbar from '@/components/UndoSnackbar';
import ChartsDashboard from '@/components/ChartsDashboard';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import ActivityLog, { ActivityItem } from '@/components/ActivityLog';

import { UserProvider, useUser } from '@/context/UserContext';
import { TasksProvider, useTasksContext } from '@/context/TasksContext';

import { downloadCSV, toCSV } from '@/utils/csv';
import type { Task } from '@/types';
import {
  computeAverageROI,
  computePerformanceGrade,
  computeRevenuePerHour,
  computeTimeEfficiency,
  computeTotalRevenue,
} from '@/utils/logic';

function AppContent() {
  const {
    loading,
    error,
    derivedSorted,
    addTask,
    updateTask,
    deleteTask,
    undoDelete,
    clearLastDeleted, // ✅ BUG 2 FIX
    lastDeleted,
  } = useTasksContext();

  const { user } = useUser();

  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('All');
  const [fPriority, setFPriority] = useState('All');
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const createActivity = useCallback(
    (type: ActivityItem['type'], summary: string): ActivityItem => ({
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ts: Date.now(),
      type,
      summary,
    }),
    []
  );

  const filtered = useMemo(() => {
    return derivedSorted.filter(t => {
      if (q && !t.title.toLowerCase().includes(q.toLowerCase()))
        return false;
      if (fStatus !== 'All' && t.status !== fStatus)
        return false;
      if (fPriority !== 'All' && t.priority !== fPriority)
        return false;
      return true;
    });
  }, [derivedSorted, q, fStatus, fPriority]);

  const handleAdd = useCallback(
    (payload: Omit<Task, 'id'>) => {
      addTask(payload);
      setActivity(p => [
        createActivity('add', `Added: ${payload.title}`),
        ...p,
      ]);
    },
    [addTask, createActivity]
  );

  const handleUpdate = useCallback(
    (id: string, patch: Partial<Task>) => {
      updateTask(id, patch);
      setActivity(p => [
        createActivity('update', 'Updated task'),
        ...p,
      ]);
    },
    [updateTask, createActivity]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteTask(id);
      setActivity(p => [
        createActivity('delete', 'Deleted task'),
        ...p,
      ]);
    },
    [deleteTask, createActivity]
  );

  const handleUndo = useCallback(() => {
    undoDelete();
    setActivity(p => [
      createActivity('undo', 'Undo delete'),
      ...p,
    ]);
  }, [undoDelete, createActivity]);

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h3" fontWeight={700}>
                TaskGlitch
              </Typography>
              <Typography color="text.secondary">
                Welcome back, {user.name.split(' ')[0]}
              </Typography>
            </Box>

            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="outlined"
                onClick={() =>
                  downloadCSV('tasks.csv', toCSV(filtered))
                }
              >
                Export CSV
              </Button>
              <Avatar>{user.name.charAt(0)}</Avatar>
            </Stack>
          </Stack>

          {loading && (
            <Stack alignItems="center" py={6}>
              <CircularProgress />
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!loading && !error && (
            <MetricsBar
              metricsOverride={{
                totalRevenue: computeTotalRevenue(filtered),
                totalTimeTaken: filtered.reduce(
                  (s, t) => s + t.timeTaken,
                  0
                ),
                timeEfficiencyPct:
                  computeTimeEfficiency(filtered),
                revenuePerHour:
                  computeRevenuePerHour(filtered),
                averageROI:
                  computeAverageROI(filtered),
                performanceGrade:
                  computePerformanceGrade(
                    computeAverageROI(filtered)
                  ),
              }}
            />
          )}

          {!loading && !error && (
            <Stack direction="row" spacing={2}>
              <TextField
                placeholder="Search"
                value={q}
                onChange={e => setQ(e.target.value)}
                fullWidth
              />

              <Select
                value={fStatus}
                onChange={e => setFStatus(e.target.value)}
              >
                <MenuItem value="All">All Status</MenuItem>
                <MenuItem value="Todo">Todo</MenuItem>
                <MenuItem value="In Progress">
                  In Progress
                </MenuItem>
                <MenuItem value="Done">Done</MenuItem>
              </Select>

              <Select
                value={fPriority}
                onChange={e => setFPriority(e.target.value)}
              >
                <MenuItem value="All">All Priority</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Medium">
                  Medium
                </MenuItem>
                <MenuItem value="Low">Low</MenuItem>
              </Select>
            </Stack>
          )}

          {!loading && !error && (
            <TaskTable
              tasks={filtered}
              onAdd={handleAdd}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          )}

          {!loading && !error && (
            <ChartsDashboard tasks={filtered} />
          )}
          {!loading && !error && (
            <AnalyticsDashboard tasks={filtered} />
          )}
          {!loading && !error && (
            <ActivityLog items={activity} />
          )}

          {/* ✅ BUG 2 FIX */}
          <UndoSnackbar
            open={!!lastDeleted}
            onClose={clearLastDeleted}
            onUndo={handleUndo}
          />
        </Stack>
      </Container>
    </Box>
  );
}

export default function App() {
  return (
    <UserProvider>
      <TasksProvider>
        <AppContent />
      </TasksProvider>
    </UserProvider>
  );
}
