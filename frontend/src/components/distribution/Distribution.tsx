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
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Divider,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import {
  getDistributionConfigs,
  createDistributionConfig,
  updateDistributionConfig,
  deleteDistributionConfig,
  testSmtpConnection,
  getSchedules,
} from '../../services/api';
import type { DistributionConfig, Schedule } from '../../services/api';

type EmailProvider = 'smtp' | 'outlook_smtp' | 'gmail_smtp';

interface FormData {
  schedule_id: number | '';
  provider: EmailProvider;
  config: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    from: string;
    replyTo: string;
  };
  recipients: string; // comma-separated
  subject_template: string;
  body_template: string;
}

const defaultForm: FormData = {
  schedule_id: '',
  provider: 'smtp',
  config: { host: '', port: 587, secure: false, username: '', password: '', from: '', replyTo: '' },
  recipients: '',
  subject_template: 'Report: {{reportName}} — {{date}}',
  body_template: 'Hi,\n\nPlease find the latest report "{{reportName}}" attached.\n\nGenerated on {{date}}.',
};

const PROVIDER_PRESETS: Record<EmailProvider, { label: string; host: string; port: number; secure: boolean }> = {
  smtp: { label: 'Generic SMTP', host: '', port: 587, secure: false },
  outlook_smtp: { label: 'Outlook / Office 365 SMTP', host: 'smtp.office365.com', port: 587, secure: false },
  gmail_smtp: { label: 'Gmail SMTP', host: 'smtp.gmail.com', port: 465, secure: true },
};

export default function Distribution() {
  const [configs, setConfigs] = useState<DistributionConfig[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpResult, setSmtpResult] = useState<{ success: boolean; error?: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configData, scheduleData] = await Promise.all([getDistributionConfigs(), getSchedules()]);
      setConfigs(configData);
      setSchedules(scheduleData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setSmtpResult(null);
    setDialogOpen(true);
  };

  const openEdit = (cfg: DistributionConfig) => {
    setEditingId(cfg.id);
    setForm({
      schedule_id: cfg.schedule_id,
      provider: cfg.provider as EmailProvider,
      config: {
        host: cfg.config.host || '',
        port: cfg.config.port || 587,
        secure: cfg.config.secure || false,
        username: cfg.config.username || '',
        password: cfg.config.password || '',
        from: cfg.config.from || '',
        replyTo: cfg.config.replyTo || '',
      },
      recipients: (cfg.recipients || []).join(', '),
      subject_template: cfg.subject_template || '',
      body_template: cfg.body_template || '',
    });
    setSmtpResult(null);
    setDialogOpen(true);
  };

  const handleProviderChange = (provider: EmailProvider) => {
    const preset = PROVIDER_PRESETS[provider];
    setForm((f) => ({
      ...f,
      provider,
      config: {
        ...f.config,
        host: preset.host || f.config.host,
        port: preset.port,
        secure: preset.secure,
      },
    }));
  };

  const handleSave = async () => {
    if (!form.schedule_id || !form.recipients.trim()) return;

    const recipientList = form.recipients.split(',').map((r) => r.trim()).filter(Boolean);

    try {
      const payload = {
        schedule_id: form.schedule_id as number,
        provider: form.provider,
        config: form.config,
        recipients: recipientList,
        subject_template: form.subject_template,
        body_template: form.body_template,
      };

      if (editingId) {
        await updateDistributionConfig(editingId, payload);
        setMessage({ type: 'success', text: 'Distribution config updated' });
      } else {
        await createDistributionConfig(payload);
        setMessage({ type: 'success', text: 'Distribution config created' });
      }
      setDialogOpen(false);
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this distribution config?')) return;
    await deleteDistributionConfig(id);
    setMessage({ type: 'success', text: 'Distribution config deleted' });
    await loadData();
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpResult(null);
    try {
      const result = await testSmtpConnection(form.provider, form.config);
      setSmtpResult(result);
    } catch (err: any) {
      setSmtpResult({ success: false, error: err.response?.data?.error || err.message });
    } finally {
      setTestingSmtp(false);
    }
  };

  const updateConfig = (field: string, value: any) => {
    setForm((f) => ({ ...f, config: { ...f.config, [field]: value } }));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Email Distribution</Typography>
          <Typography variant="body2" color="text.secondary">Configure report delivery via email</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} size="large">
          New Config
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
              <TableCell>Schedule / Report</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>Recipients</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {configs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>
                    {loading ? 'Loading...' : 'No distribution configs yet. Create a schedule first, then add email distribution.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {configs.map((cfg) => (
              <TableRow key={cfg.id}>
                <TableCell>{cfg.report_name || `Schedule #${cfg.schedule_id}`}</TableCell>
                <TableCell>
                  <Chip label={PROVIDER_PRESETS[cfg.provider as EmailProvider]?.label || cfg.provider} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {(cfg.recipients || []).slice(0, 3).map((r: string, i: number) => (
                      <Chip key={i} label={r} size="small" />
                    ))}
                    {(cfg.recipients || []).length > 3 && (
                      <Chip label={`+${cfg.recipients.length - 3}`} size="small" variant="outlined" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                    {cfg.subject_template || '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(cfg)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDelete(cfg.id)}>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit Distribution Config' : 'New Distribution Config'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl fullWidth>
            <InputLabel>Schedule</InputLabel>
            <Select
              value={form.schedule_id}
              label="Schedule"
              onChange={(e) => setForm((f) => ({ ...f, schedule_id: e.target.value as number }))}
            >
              {schedules.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.report_name || `Report #${s.report_id}`} — {s.cron_description || s.cron_expression}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />
          <Typography variant="subtitle2" fontWeight="bold">Email Provider</Typography>

          <FormControl fullWidth>
            <InputLabel>Provider</InputLabel>
            <Select
              value={form.provider}
              label="Provider"
              onChange={(e) => handleProviderChange(e.target.value as EmailProvider)}
            >
              <MenuItem value="smtp">Generic SMTP</MenuItem>
              <MenuItem value="outlook_smtp">Outlook / Office 365 SMTP</MenuItem>
              <MenuItem value="gmail_smtp">Gmail SMTP</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="SMTP Host"
              value={form.config.host}
              onChange={(e) => updateConfig('host', e.target.value)}
              fullWidth
            />
            <TextField
              label="Port"
              type="number"
              value={form.config.port}
              onChange={(e) => updateConfig('port', parseInt(e.target.value))}
              sx={{ width: 120 }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Username / Email"
              value={form.config.username}
              onChange={(e) => updateConfig('username', e.target.value)}
              fullWidth
            />
            <TextField
              label="Password / App Password"
              type="password"
              value={form.config.password}
              onChange={(e) => updateConfig('password', e.target.value)}
              fullWidth
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="From Address"
              value={form.config.from}
              onChange={(e) => updateConfig('from', e.target.value)}
              fullWidth
              placeholder="sender@example.com"
            />
            <TextField
              label="Reply-To (optional)"
              value={form.config.replyTo}
              onChange={(e) => updateConfig('replyTo', e.target.value)}
              fullWidth
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleTestSmtp}
              disabled={testingSmtp || !form.config.host}
              startIcon={testingSmtp ? <CircularProgress size={16} /> : undefined}
            >
              Test Connection
            </Button>
            {smtpResult && (
              <Chip
                icon={smtpResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
                label={smtpResult.success ? 'Connection OK' : smtpResult.error || 'Failed'}
                color={smtpResult.success ? 'success' : 'error'}
                size="small"
              />
            )}
          </Box>

          <Divider />
          <Typography variant="subtitle2" fontWeight="bold">Recipients & Templates</Typography>

          <TextField
            label="Recipients"
            value={form.recipients}
            onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))}
            fullWidth
            helperText="Comma-separated email addresses"
            placeholder="user1@example.com, user2@example.com"
          />

          <TextField
            label="Subject Template"
            value={form.subject_template}
            onChange={(e) => setForm((f) => ({ ...f, subject_template: e.target.value }))}
            fullWidth
            helperText="Supports {{reportName}} and {{date}} variables"
          />

          <TextField
            label="Body Template"
            value={form.body_template}
            onChange={(e) => setForm((f) => ({ ...f, body_template: e.target.value }))}
            fullWidth
            multiline
            rows={4}
            helperText="Supports {{reportName}} and {{date}} variables"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.schedule_id || !form.recipients.trim()}
          >
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
