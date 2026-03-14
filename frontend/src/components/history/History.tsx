import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Alert,
  Tooltip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  getExecutionHistory,
  retryExecution,
  deleteExecution,
  clearExecutionHistory,
} from '../../services/api';
import type { ExecutionHistory } from '../../services/api';

export default function History() {
  const [rows, setRows] = useState<ExecutionHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [errorDialogRow, setErrorDialogRow] = useState<ExecutionHistory | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getExecutionHistory({ status: statusFilter || undefined, limit: 500 });
      setRows(data.rows);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, [statusFilter]);

  const handleRetry = async (id: number) => {
    setRetryingId(id);
    try {
      await retryExecution(id);
      setMessage({ type: 'success', text: 'Execution retried successfully' });
      await loadHistory();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Retry failed' });
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this history entry?')) return;
    await deleteExecution(id);
    await loadHistory();
  };

  const handleClearAll = async () => {
    if (!confirm('Delete ALL execution history? This cannot be undone.')) return;
    await clearExecutionHistory();
    setMessage({ type: 'success', text: 'History cleared' });
    await loadHistory();
  };

  const handleDownload = (row: ExecutionHistory) => {
    if (!row.output_path) return;
    window.open(`http://localhost:3000/api/history/${row.id}/download`, '_blank');
  };

  const StatusCellRenderer = (params: ICellRendererParams) => {
    const status = params.value as string;
    const colorMap: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
      success: 'success',
      failed: 'error',
      partial: 'warning',
      running: 'info',
      pending: 'default',
    };
    return <Chip label={status} size="small" color={colorMap[status] || 'default'} />;
  };

  const ActionsCellRenderer = (params: ICellRendererParams) => {
    const row = params.data as ExecutionHistory;
    return (
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {row.output_path && (
          <Tooltip title="Download">
            <IconButton size="small" color="primary" onClick={() => handleDownload(row)}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {row.status === 'failed' && row.schedule_id && (
          <Tooltip title="Retry">
            <IconButton
              size="small"
              color="warning"
              onClick={() => handleRetry(row.id)}
              disabled={retryingId === row.id}
            >
              {retryingId === row.id ? <CircularProgress size={16} /> : <ReplayIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        {row.error_message && (
          <Tooltip title="View Error">
            <IconButton size="small" color="error" onClick={() => setErrorDialogRow(row)}>
              <ErrorOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Delete">
          <IconButton size="small" onClick={() => handleDelete(row.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  const columnDefs = useMemo<ColDef[]>(() => [
    { field: 'report_name', headerName: 'Report', flex: 1, minWidth: 140, filter: true, sortable: true },
    { field: 'trigger_type', headerName: 'Trigger', width: 110, filter: true, sortable: true },
    { field: 'status', headerName: 'Status', width: 120, cellRenderer: StatusCellRenderer, filter: true, sortable: true },
    {
      field: 'started_at', headerName: 'Started', width: 170, sortable: true,
      valueFormatter: (p) => p.value ? new Date(p.value + 'Z').toLocaleString() : '',
    },
    {
      field: 'duration_ms', headerName: 'Duration', width: 110, sortable: true,
      valueFormatter: (p) => {
        if (p.value == null) return '—';
        if (p.value < 1000) return `${p.value}ms`;
        return `${(p.value / 1000).toFixed(1)}s`;
      },
    },
    {
      field: 'output_path', headerName: 'Output', width: 130,
      valueFormatter: (p) => {
        if (!p.value) return '—';
        const files = (p.value as string).split(',');
        return files.map((f: string) => {
          const basename = f.trim().split('/').pop() || f;
          return basename.split('.').pop()?.toUpperCase();
        }).join(', ');
      },
    },
    {
      field: 'email_status', headerName: 'Email', width: 100,
      valueFormatter: (p) => p.value || '—',
    },
    {
      headerName: 'Actions', width: 180, sortable: false, filter: false,
      cellRenderer: ActionsCellRenderer,
    },
  ], [retryingId]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>
            Execution History
            {total > 0 && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
                ({total} entries)
              </Typography>
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">Track report generation runs and download outputs</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="success">Success</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="running">Running</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title="Refresh">
            <IconButton onClick={loadHistory} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>

          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteSweepIcon />}
            onClick={handleClearAll}
            disabled={rows.length === 0}
          >
            Clear All
          </Button>
        </Box>
      </Box>

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 1 }}>
          {message.text}
        </Alert>
      )}

      <Box className="ag-theme-alpine" sx={{ flex: 1, width: '100%' }}>
        <AgGridReact
          rowData={rows}
          columnDefs={columnDefs}
          pagination
          paginationPageSize={25}
          paginationPageSizeSelector={[25, 50, 100]}
          domLayout="normal"
          getRowId={(params) => String(params.data.id)}
          animateRows
          suppressCellFocus
        />
      </Box>

      {/* Error Detail Dialog */}
      <Dialog open={!!errorDialogRow} onClose={() => setErrorDialogRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Error Details</DialogTitle>
        <DialogContent>
          {errorDialogRow && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Report: {errorDialogRow.report_name} — {new Date(errorDialogRow.started_at + 'Z').toLocaleString()}
              </Typography>
              <Box
                sx={{
                  bgcolor: '#fef2f2',
                  border: '1px solid #fca5a5',
                  borderRadius: 1,
                  p: 2,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {errorDialogRow.error_message}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErrorDialogRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
