import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  List,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableViewIcon from '@mui/icons-material/TableView';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import SpeedIcon from '@mui/icons-material/Speed';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ImageIcon from '@mui/icons-material/Image';
import GridOnIcon from '@mui/icons-material/GridOn';
import DownloadIcon from '@mui/icons-material/Download';
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useAppStore } from '../../store';
import {
  createReport,
  updateReport,
  deleteReport,
  exportPdf,
  exportExcel,
  runQuery,
} from '../../services/api';
import type {
  WidgetLayout,
  WidgetConfig,
  ReportSettings,
  Report,
  QueryResult,
} from '../../services/api';
import WidgetRenderer from './WidgetRenderer';
import WidgetConfigPanel from './WidgetConfigPanel';



const WIDGET_TYPES: { type: WidgetLayout['type']; label: string; icon: React.ReactNode; minW: number; minH: number; defaultW: number; defaultH: number }[] = [
  { type: 'table', label: 'Table', icon: <GridOnIcon />, minW: 3, minH: 3, defaultW: 6, defaultH: 4 },
  { type: 'bar', label: 'Bar Chart', icon: <BarChartIcon />, minW: 3, minH: 3, defaultW: 6, defaultH: 4 },
  { type: 'line', label: 'Line Chart', icon: <ShowChartIcon />, minW: 3, minH: 3, defaultW: 6, defaultH: 4 },
  { type: 'pie', label: 'Pie Chart', icon: <PieChartIcon />, minW: 3, minH: 3, defaultW: 4, defaultH: 4 },
  { type: 'kpi', label: 'KPI Tile', icon: <SpeedIcon />, minW: 2, minH: 2, defaultW: 3, defaultH: 2 },
  { type: 'text', label: 'Text Block', icon: <TextFieldsIcon />, minW: 2, minH: 2, defaultW: 4, defaultH: 2 },
  { type: 'image', label: 'Image', icon: <ImageIcon />, minW: 2, minH: 2, defaultW: 3, defaultH: 3 },
];

export default function Reports() {
  const reports = useAppStore((s) => s.reports);
  const queries = useAppStore((s) => s.queries);
  const fetchReports = useAppStore((s) => s.fetchReports);
  const fetchQueries = useAppStore((s) => s.fetchQueries);

  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [widgets, setWidgets] = useState<WidgetLayout[]>([]);
  const [settings, setSettings] = useState<ReportSettings>({});
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [widgetData, setWidgetData] = useState<Record<string, QueryResult>>({});
  const [widgetColumns, setWidgetColumns] = useState<string[]>([]);

  // Grid container width
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(gridContainerRef);

  // Dialogs
  const [newReportOpen, setNewReportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newReportName, setNewReportName] = useState('');

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Chart instance refs for capturing screenshots
  const chartRefs = useRef<Record<string, any>>({});

  useEffect(() => {
    fetchReports();
    fetchQueries();
  }, [fetchReports, fetchQueries]);

  // Load data for widgets when they change
  useEffect(() => {
    const loadWidgetData = async () => {
      const results: Record<string, QueryResult> = {};
      for (const w of widgets) {
        const queryId = w.config?.queryId;
        if (queryId) {
          const q = queries.find((qq) => qq.id === queryId);
          if (q) {
            try {
              results[w.i] = await runQuery(q.connection_id, q.sql_text);
            } catch {
              results[w.i] = { columns: [], rows: [], totalRows: 0, truncated: false };
            }
          }
        }
      }
      setWidgetData(results);
    };

    const debounceTimer = setTimeout(loadWidgetData, 500);
    return () => clearTimeout(debounceTimer);
  }, [widgets, queries]);

  // Update columns when selected widget changes
  useEffect(() => {
    if (!selectedWidgetId) {
      setWidgetColumns([]);
      return;
    }
    const data = widgetData[selectedWidgetId];
    if (data?.columns) {
      setWidgetColumns(data.columns.map((c) => c.name));
    } else {
      setWidgetColumns([]);
    }
  }, [selectedWidgetId, widgetData]);

  const selectedWidget = widgets.find((w) => w.i === selectedWidgetId) || null;

  // ── Layout handlers ──
  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    setWidgets((prev) =>
      prev.map((w) => {
        const l = newLayout.find((n) => n.i === w.i);
        return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w;
      })
    );
  }, []);

  const addWidget = (type: WidgetLayout['type']) => {
    const spec = WIDGET_TYPES.find((t) => t.type === type)!;
    const id = `widget-${Date.now()}`;
    setWidgets((prev) => [
      ...prev,
      {
        i: id,
        x: 0,
        y: Infinity, // Place at bottom
        w: spec.defaultW,
        h: spec.defaultH,
        type,
        config: {},
      },
    ]);
  };

  const updateWidgetConfig = useCallback((widgetId: string, configUpdate: Partial<WidgetConfig>) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.i === widgetId ? { ...w, config: { ...w.config, ...configUpdate } } : w
      )
    );
  }, []);

  const deleteWidget = useCallback((widgetId: string) => {
    setWidgets((prev) => prev.filter((w) => w.i !== widgetId));
    setSelectedWidgetId(null);
  }, []);

  // ── Report CRUD ──
  const handleNewReport = async () => {
    if (!newReportName.trim()) return;
    try {
      const report = await createReport({ name: newReportName });
      setCurrentReport(report);
      setWidgets([]);
      setSettings({});
      setNewReportOpen(false);
      setNewReportName('');
      await fetchReports();
    } catch {
      setMessage({ type: 'error', text: 'Failed to create report' });
    }
  };

  const handleLoadReport = (report: Report) => {
    setCurrentReport(report);
    setWidgets(report.layout || []);
    setSettings(report.settings || {});
    setSelectedWidgetId(null);
  };

  const handleSave = async () => {
    if (!currentReport) return;
    setSaving(true);
    try {
      const updated = await updateReport(currentReport.id, { layout: widgets, settings });
      setCurrentReport(updated);
      setMessage({ type: 'success', text: 'Report saved' });
      await fetchReports();
    } catch {
      setMessage({ type: 'error', text: 'Failed to save report' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReport = async (id: number) => {
    if (!confirm('Delete this report?')) return;
    await deleteReport(id);
    if (currentReport?.id === id) {
      setCurrentReport(null);
      setWidgets([]);
      setSettings({});
    }
    await fetchReports();
  };

  // ── Export ──
  const captureChartImages = (): Record<string, string> => {
    const images: Record<string, string> = {};
    for (const [widgetId, instance] of Object.entries(chartRefs.current)) {
      if (instance?.getDataURL) {
        try {
          images[widgetId] = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
        } catch { /* skip */ }
      }
    }
    return images;
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!currentReport) return;

    // Save first
    await handleSave();

    setExporting(format);
    try {
      const chartImages = captureChartImages();
      const result = format === 'pdf'
        ? await exportPdf(currentReport.id, chartImages)
        : await exportExcel(currentReport.id, chartImages);

      // Trigger download
      const downloadUrl = `http://localhost:3000/api/reports/download/${result.filename}`;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setMessage({ type: 'success', text: `${format.toUpperCase()} exported: ${result.filename}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: `Export failed: ${err.response?.data?.error || err.message}` });
    } finally {
      setExporting(null);
    }
  };

  const handleChartRef = useCallback((widgetId: string, instance: any) => {
    chartRefs.current[widgetId] = instance;
  }, []);

  // Build grid layout items
  const gridLayout: Layout[] = widgets.map((w) => {
    const spec = WIDGET_TYPES.find((t) => t.type === w.type);
    return {
      i: w.i,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      minW: spec?.minW || 2,
      minH: spec?.minH || 2,
    };
  });

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 120px)' }}>
      {/* Left Panel: Report list + Widget palette */}
      <Paper sx={{ width: 230, flexShrink: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">Reports</Typography>
            <IconButton size="small" onClick={() => setNewReportOpen(true)}><AddIcon fontSize="small" /></IconButton>
          </Box>
          <List dense sx={{ mb: 1 }}>
            {reports.map((r) => (
              <ListItemButton
                key={r.id}
                selected={currentReport?.id === r.id}
                onClick={() => handleLoadReport(r)}
                sx={{ borderRadius: 1, mb: 0.5 }}
              >
                <ListItemText primary={r.name} secondary={r.description || undefined} />
                <ListItemSecondaryAction>
                  <IconButton edge="end" size="small" onClick={() => handleDeleteReport(r.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Divider />

        {currentReport && (
          <Box sx={{ p: 1.5 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Add Widgets</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {WIDGET_TYPES.map((wt) => (
                <Chip
                  key={wt.type}
                  icon={wt.icon as React.ReactElement}
                  label={wt.label}
                  onClick={() => addWidget(wt.type)}
                  variant="outlined"
                  sx={{ justifyContent: 'flex-start', cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Main Canvas */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar */}
        {currentReport && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ flex: 1 }}>{currentReport.name}</Typography>

            <Tooltip title="Report Settings">
              <IconButton onClick={() => setSettingsOpen(true)}><SettingsIcon /></IconButton>
            </Tooltip>

            <Button
              variant="outlined"
              size="small"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              Save
            </Button>

            <Button
              variant="contained"
              size="small"
              startIcon={exporting === 'pdf' ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
              onClick={() => handleExport('pdf')}
              disabled={!!exporting}
            >
              PDF
            </Button>

            <Button
              variant="contained"
              size="small"
              color="success"
              startIcon={exporting === 'excel' ? <CircularProgress size={16} /> : <DownloadIcon />}
              onClick={() => handleExport('excel')}
              disabled={!!exporting}
            >
              Excel
            </Button>
          </Box>
        )}

        {message && (
          <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 1 }}>
            {message.text}
          </Alert>
        )}

        {!currentReport ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography color="text.secondary">
              Select a report from the left panel or create a new one.
            </Typography>
          </Box>
        ) : widgets.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', border: '2px dashed #ccc', borderRadius: 2 }}>
            <Typography color="text.secondary">
              Add widgets from the palette to start building your report.
            </Typography>
          </Box>
        ) : (
          <Paper
            ref={gridContainerRef}
            variant="outlined"
            sx={{ flex: 1, overflow: 'auto', minHeight: 0, p: 1, bgcolor: '#fafafa' }}
          >
            <GridLayout
              layout={gridLayout}
              cols={12}
              rowHeight={60}
              width={containerWidth || 900}
              onLayoutChange={handleLayoutChange}
              preventCollision
              compactType="vertical"
              draggableHandle=".widget-drag-handle"
              useCSSTransforms
            >
              {widgets.map((widget) => (
                <div
                  key={widget.i}
                  style={{ overflow: 'hidden' }}
                >
                  <Paper
                    elevation={selectedWidgetId === widget.i ? 4 : 1}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      border: selectedWidgetId === widget.i ? '2px solid #1976d2' : '1px solid #e0e0e0',
                      borderRadius: 1,
                      bgcolor: widget.config?.backgroundColor || '#fff',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                    onClick={() => setSelectedWidgetId(widget.i)}
                  >
                    {/* Drag handle */}
                    <Box
                      className="widget-drag-handle"
                      sx={{
                        height: 24,
                        bgcolor: '#f5f5f5',
                        borderBottom: '1px solid #eee',
                        display: 'flex',
                        alignItems: 'center',
                        px: 1,
                        cursor: 'grab',
                        flexShrink: 0,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                        {widget.config?.title || widget.type}
                      </Typography>
                      <Chip size="small" label={widget.type} sx={{ height: 16, fontSize: 10 }} />
                    </Box>

                    {/* Widget content */}
                    <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                      <WidgetRenderer
                        widget={widget}
                        data={widgetData[widget.i] || null}
                        onChartRef={handleChartRef}
                      />
                    </Box>
                  </Paper>
                </div>
              ))}
            </GridLayout>
          </Paper>
        )}
      </Box>

      {/* Widget Config Drawer */}
      <WidgetConfigPanel
        widget={selectedWidget}
        queries={queries}
        columns={widgetColumns}
        onUpdate={updateWidgetConfig}
        onDelete={deleteWidget}
        onClose={() => setSelectedWidgetId(null)}
      />

      {/* New Report Dialog */}
      <Dialog open={newReportOpen} onClose={() => setNewReportOpen(false)}>
        <DialogTitle>New Report</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Report Name"
            fullWidth
            value={newReportName}
            onChange={(e) => setNewReportName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewReportOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleNewReport} disabled={!newReportName.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Report Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Report Settings</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Header Text"
            value={settings.headerText || ''}
            onChange={(e) => setSettings((s) => ({ ...s, headerText: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Footer Text"
            value={settings.footerText || ''}
            onChange={(e) => setSettings((s) => ({ ...s, footerText: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Logo URL"
            value={settings.logoUrl || ''}
            onChange={(e) => setSettings((s) => ({ ...s, logoUrl: e.target.value }))}
            fullWidth
            placeholder="https://example.com/logo.png"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
