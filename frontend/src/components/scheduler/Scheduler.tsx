import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useAppStore } from '../../store';
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  runScheduleNow,
} from '../../services/api';
import type { Schedule } from '../../services/api';

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at 6:00 AM', value: '0 6 * * *' },
  { label: 'Daily at 8:00 AM', value: '0 8 * * *' },
  { label: 'Daily at 6:00 PM', value: '0 18 * * *' },
  { label: 'Monday at 8:00 AM', value: '0 8 * * 1' },
  { label: 'Weekdays at 7:00 AM', value: '0 7 * * 1-5' },
  { label: '1st of month at 8:00 AM', value: '0 8 1 * *' },
  { label: 'Custom', value: '' },
];

interface ScheduleFormData {
  report_id: number | '';
  cron_expression: string;
  export_format: string;
  active: boolean;
}

const defaultForm: ScheduleFormData = {
  report_id: '',
  cron_expression: '0 8 * * *',
  export_format: 'pdf',
  active: true,
};

export default function Scheduler() {
  const reports = useAppStore((s) => s.reports);
  const fetchReports = useAppStore((s) => s.fetchReports);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ScheduleFormData>(defaultForm);
  const [cronPreset, setCronPreset] = useState('0 8 * * *');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const data = await getSchedules();
      setSchedules(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
    fetchReports();
  }, [fetchReports]);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setCronPreset('0 8 * * *');
    setDialogOpen(true);
  };

  const openEdit = (schedule: Schedule) => {
    setEditingId(schedule.id);
    setForm({
      report_id: schedule.report_id,
      cron_expression: schedule.cron_expression,
      export_format: schedule.export_format,
      active: schedule.active,
    });
    const preset = CRON_PRESETS.find((p) => p.value === schedule.cron_expression);
    setCronPreset(preset ? preset.value : '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.report_id || !form.cron_expression) return;

    try {
      if (editingId) {
        await updateSchedule(editingId, {
          report_id: form.report_id as number,
          cron_expression: form.cron_expression,
          export_format: form.export_format,
          active: form.active,
        });
        setMessage({ type: 'success', text: 'Schedule updated' });
      } else {
        await createSchedule({
          report_id: form.report_id as number,
          cron_expression: form.cron_expression,
          export_format: form.export_format,
          active: form.active,
        });
        setMessage({ type: 'success', text: 'Schedule created' });
      }
      setDialogOpen(false);
      await loadSchedules();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save schedule' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this schedule?')) return;
    await deleteSchedule(id);
    setMessage({ type: 'success', text: 'Schedule deleted' });
    await loadSchedules();
  };

  const handleRunNow = async (id: number) => {
    setRunningId(id);
    try {
      await runScheduleNow(id);
      setMessage({ type: 'success', text: 'Schedule executed successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Execution failed' });
    } finally {
      setRunningId(null);
    }
  };

  const handlePresetChange = (value: string) => {
    setCronPreset(value);
    if (value) {
      setForm((f) => ({ ...f, cron_expression: value }));
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Scheduler</Typography>
          <Typography variant="body2" color="text.secondary">Automate report generation with cron schedules</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} size="large">
          New Schedule
        </Button>
      </Box>

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Report</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Format</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schedules.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>
                    {loading ? 'Loading...' : 'No schedules yet. Click "New Schedule" to create one.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {schedules.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.report_name || `Report #${s.report_id}`}</TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2">{s.cron_description || s.cron_expression}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.cron_expression}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={s.export_format.toUpperCase()}
                    size="small"
                    color={s.export_format === 'pdf' ? 'error' : s.export_format === 'excel' ? 'success' : 'primary'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={s.active ? 'Active' : 'Inactive'}
                    size="small"
                    color={s.active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Run Now">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleRunNow(s.id)}
                      disabled={runningId === s.id}
                    >
                      {runningId === s.id ? <CircularProgress size={18} /> : <PlayArrowIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(s)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDelete(s.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Schedule' : 'New Schedule'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl fullWidth>
            <InputLabel>Report</InputLabel>
            <Select
              value={form.report_id}
              label="Report"
              onChange={(e) => setForm((f) => ({ ...f, report_id: e.target.value as number }))}
            >
              {reports.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Frequency</InputLabel>
            <Select
              value={cronPreset}
              label="Frequency"
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              {CRON_PRESETS.map((p) => (
                <MenuItem key={p.label} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Cron Expression"
            value={form.cron_expression}
            onChange={(e) => setForm((f) => ({ ...f, cron_expression: e.target.value }))}
            fullWidth
            helperText="Format: minute hour day-of-month month day-of-week"
          />

          <FormControl fullWidth>
            <InputLabel>Export Format</InputLabel>
            <Select
              value={form.export_format}
              label="Export Format"
              onChange={(e) => setForm((f) => ({ ...f, export_format: e.target.value }))}
            >
              <MenuItem value="pdf">PDF</MenuItem>
              <MenuItem value="excel">Excel</MenuItem>
              <MenuItem value="both">Both (PDF + Excel)</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.report_id || !form.cron_expression}
          >
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
