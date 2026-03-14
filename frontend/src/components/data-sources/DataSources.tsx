import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  Switch,
  FormControlLabel,
  Paper,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import StorageIcon from '@mui/icons-material/Storage';
import { useAppStore } from '../../store';
import {
  createConnection,
  deleteConnection,
  testConnection,
} from '../../services/api';
import type { ConnectionInput } from '../../services/api';

const initialForm: ConnectionInput = {
  name: '',
  server: '',
  database_name: '',
  username: '',
  password: '',
  port: 1433,
  encrypt: false,
};

export default function DataSources() {
  const connections = useAppStore((s) => s.connections);
  const fetchConnections = useAppStore((s) => s.fetchConnections);
  const loading = useAppStore((s) => s.connectionsLoading);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ConnectionInput>(initialForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Record<number, boolean>>({});
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({});

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleChange = (field: keyof ConnectionInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await createConnection({ ...form, port: Number(form.port) || 1433 });
      setDialogOpen(false);
      setForm(initialForm);
      await fetchConnections();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save connection');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this connection?')) return;
    await deleteConnection(id);
    await fetchConnections();
  };

  const handleTest = async (id: number) => {
    setTesting((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await testConnection(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message: 'Request failed' } }));
    } finally {
      setTesting((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Data Sources</Typography>
          <Typography variant="body2" color="text.secondary">Manage your SQL Server connections</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} size="large">
          Add Connection
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : connections.length === 0 ? (
        <Paper
          sx={{
            textAlign: 'center',
            py: 8,
            px: 4,
            borderRadius: 4,
            border: '2px dashed',
            borderColor: 'divider',
            bgcolor: 'transparent',
          }}
        >
          <StorageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No connections yet</Typography>
          <Typography variant="body2" color="text.secondary">Click "Add Connection" to get started</Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {connections.map((conn) => (
            <Grid key={conn.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card className="hover-card">
                <CardContent>
                  <Typography variant="h6" gutterBottom>{conn.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {conn.server}:{conn.port}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Database: {conn.database_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    User: {conn.username}
                  </Typography>
                  <Chip
                    size="small"
                    label={conn.encrypt ? 'Encrypted' : 'Unencrypted'}
                    color={conn.encrypt ? 'success' : 'default'}
                    sx={{ mt: 1 }}
                  />
                  {testResults[conn.id] && (
                    <Alert severity={testResults[conn.id].success ? 'success' : 'error'} sx={{ mt: 1 }}>
                      {testResults[conn.id].message}
                    </Alert>
                  )}
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={testing[conn.id] ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                    onClick={() => handleTest(conn.id)}
                    disabled={testing[conn.id]}
                  >
                    Test
                  </Button>
                  <IconButton size="small" color="error" onClick={() => handleDelete(conn.id)}>
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Connection Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New SQL Server Connection</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Connection Name" value={form.name} onChange={handleChange('name')} fullWidth required />
          <TextField label="Server (FQDN or IP)" value={form.server} onChange={handleChange('server')} fullWidth required />
          <TextField label="Database Name" value={form.database_name} onChange={handleChange('database_name')} fullWidth required />
          <TextField label="Username" value={form.username} onChange={handleChange('username')} fullWidth required />
          <TextField label="Password" type="password" value={form.password} onChange={handleChange('password')} fullWidth required />
          <TextField label="Port" type="number" value={form.port} onChange={handleChange('port')} fullWidth />
          <FormControlLabel
            control={<Switch checked={form.encrypt || false} onChange={(e) => setForm((prev) => ({ ...prev, encrypt: e.target.checked }))} />}
            label="Use encrypted connection (TLS)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || !form.server || !form.database_name || !form.username || !form.password}>
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
