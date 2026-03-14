import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import CodeIcon from '@mui/icons-material/Code';
import TableChartIcon from '@mui/icons-material/TableChart';
import Editor from '@monaco-editor/react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import { useAppStore } from '../../store';
import {
  runQuery,
  saveQuery,
  deleteQuery,
  getTablesForConnection,
} from '../../services/api';
import type { QueryResult, TableMeta } from '../../services/api';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function QueryBuilder() {
  const connections = useAppStore((s) => s.connections);
  const queries = useAppStore((s) => s.queries);
  const fetchConnections = useAppStore((s) => s.fetchConnections);
  const fetchQueries = useAppStore((s) => s.fetchQueries);

  const [selectedConnectionId, setSelectedConnectionId] = useState<number | ''>('');
  const [sqlText, setSqlText] = useState('SELECT TOP 100 *\nFROM ');
  const [mode, setMode] = useState<'sql' | 'visual'>('sql');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Visual builder state
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  // Save dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [queryName, setQueryName] = useState('');

  useEffect(() => {
    fetchConnections();
    fetchQueries();
  }, [fetchConnections, fetchQueries]);

  // Load table metadata when connection changes
  useEffect(() => {
    if (selectedConnectionId && mode === 'visual') {
      setTablesLoading(true);
      getTablesForConnection(selectedConnectionId as number)
        .then(setTables)
        .catch(() => setTables([]))
        .finally(() => setTablesLoading(false));
    }
  }, [selectedConnectionId, mode]);

  // Generate SQL from visual builder selections
  useEffect(() => {
    if (mode === 'visual' && selectedTable) {
      const cols = selectedColumns.length > 0 ? selectedColumns.join(', ') : '*';
      setSqlText(`SELECT TOP 100 ${cols}\nFROM ${selectedTable}`);
    }
  }, [mode, selectedTable, selectedColumns]);

  const handleRun = useCallback(async () => {
    if (!selectedConnectionId || !sqlText.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await runQuery(selectedConnectionId as number, sqlText);
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Query failed');
    } finally {
      setRunning(false);
    }
  }, [selectedConnectionId, sqlText]);

  const handleSave = async () => {
    if (!selectedConnectionId || !queryName.trim() || !sqlText.trim()) return;
    try {
      await saveQuery({
        connection_id: selectedConnectionId as number,
        name: queryName,
        sql_text: sqlText,
      });
      setSaveDialogOpen(false);
      setQueryName('');
      await fetchQueries();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save query');
    }
  };

  const handleDeleteQuery = async (id: number) => {
    if (!confirm('Delete this query?')) return;
    await deleteQuery(id);
    await fetchQueries();
  };

  const handleLoadQuery = (q: { connection_id: number; sql_text: string }) => {
    setSelectedConnectionId(q.connection_id);
    setSqlText(q.sql_text);
    setMode('sql');
  };

  // AG Grid column definitions from result
  const columnDefs: ColDef[] = result
    ? result.columns.map((col) => ({
        field: col.name,
        headerName: col.name,
        sortable: true,
        filter: true,
        resizable: true,
      }))
    : [];

  const currentTableMeta = tables.find((t) => `${t.schema}.${t.name}` === selectedTable);

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 120px)' }}>
      {/* Left panel: saved queries */}
      <Paper sx={{ width: 250, p: 2, overflow: 'auto', flexShrink: 0 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Saved Queries
        </Typography>
        <Divider sx={{ mb: 1 }} />
        {queries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No saved queries</Typography>
        ) : (
          queries.map((q) => (
            <Box
              key={q.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 0.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                borderRadius: 1,
                px: 1,
              }}
              onClick={() => handleLoadQuery(q)}
            >
              <Box sx={{ overflow: 'hidden' }}>
                <Typography variant="body2" noWrap>{q.name}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {q.connection_name || `Conn #${q.connection_id}`}
                </Typography>
              </Box>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteQuery(q.id); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))
        )}
      </Paper>

      {/* Main area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar row */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Connection</InputLabel>
            <Select
              value={selectedConnectionId}
              onChange={(e) => setSelectedConnectionId(e.target.value as number)}
              label="Connection"
            >
              {connections.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, val) => val && setMode(val)}
            size="small"
          >
            <ToggleButton value="sql"><CodeIcon sx={{ mr: 0.5 }} /> SQL Editor</ToggleButton>
            <ToggleButton value="visual"><TableChartIcon sx={{ mr: 0.5 }} /> Visual Builder</ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="contained"
            startIcon={running ? <CircularProgress size={16} /> : <PlayArrowIcon />}
            onClick={handleRun}
            disabled={running || !selectedConnectionId || !sqlText.trim()}
          >
            Run
          </Button>

          <Tooltip title="Save this query">
            <span>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={() => setSaveDialogOpen(true)}
                disabled={!selectedConnectionId || !sqlText.trim()}
              >
                Save
              </Button>
            </span>
          </Tooltip>
        </Box>

        {/* Editor / Visual Builder */}
        <Paper sx={{ flex: mode === 'sql' ? '1 1 40%' : '0 0 auto', mb: 2, overflow: 'hidden', minHeight: 200 }}>
          {mode === 'sql' ? (
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={sqlText}
              onChange={(val) => setSqlText(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          ) : (
            <Box sx={{ p: 2 }}>
              {tablesLoading ? (
                <CircularProgress size={24} />
              ) : !selectedConnectionId ? (
                <Typography color="text.secondary">Select a connection first</Typography>
              ) : (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 250 }}>
                    <InputLabel>Table</InputLabel>
                    <Select
                      value={selectedTable}
                      onChange={(e) => { setSelectedTable(e.target.value); setSelectedColumns([]); }}
                      label="Table"
                    >
                      {tables.map((t) => (
                        <MenuItem key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`}>
                          {t.schema}.{t.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {currentTableMeta && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ mr: 1 }}>Columns:</Typography>
                      {currentTableMeta.columns.map((col) => (
                        <Chip
                          key={col.name}
                          label={`${col.name} (${col.type})`}
                          size="small"
                          variant={selectedColumns.includes(col.name) ? 'filled' : 'outlined'}
                          color={selectedColumns.includes(col.name) ? 'primary' : 'default'}
                          onClick={() => {
                            setSelectedColumns((prev) =>
                              prev.includes(col.name)
                                ? prev.filter((c) => c !== col.name)
                                : [...prev, col.name]
                            );
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {/* Show generated SQL */}
              {selectedTable && (
                <Paper variant="outlined" sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50' }}>
                  <Typography variant="caption" color="text.secondary">Generated SQL:</Typography>
                  <Typography variant="body2" fontFamily="monospace" whiteSpace="pre-wrap">
                    {sqlText}
                  </Typography>
                </Paper>
              )}
            </Box>
          )}
        </Paper>

        {/* Error */}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Results grid */}
        {result && (
          <Box sx={{ flex: '1 1 50%', minHeight: 200 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">
                Results: {result.totalRows} rows{result.truncated ? ' (truncated to 1000)' : ''}
              </Typography>
            </Box>
            <Box className="ag-theme-alpine" sx={{ height: '100%', width: '100%' }}>
              <AgGridReact
                rowData={result.rows}
                columnDefs={columnDefs}
                defaultColDef={{ sortable: true, filter: true, resizable: true }}
                pagination
                paginationPageSize={50}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogTitle>Save Query</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Query Name"
            fullWidth
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!queryName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
