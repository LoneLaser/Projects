import React, { useCallback, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import { Box, Typography, Paper } from '@mui/material';
import type { WidgetLayout, QueryResult } from '../../services/api';

ModuleRegistry.registerModules([AllCommunityModule]);

interface WidgetRendererProps {
  widget: WidgetLayout;
  data: QueryResult | null;
  onChartRef?: (widgetId: string, instance: any) => void;
}

export default function WidgetRenderer({ widget, data, onChartRef }: WidgetRendererProps) {
  const config = widget.config || {};

  const handleChartReady = useCallback(
    (instance: any) => {
      if (onChartRef) onChartRef(widget.i, instance);
    },
    [widget.i, onChartRef]
  );

  switch (widget.type) {
    case 'table':
      return <TableWidget data={data} config={config} />;
    case 'bar':
    case 'line':
      return <BarLineWidget type={widget.type} data={data} config={config} onReady={handleChartReady} />;
    case 'pie':
      return <PieWidget data={data} config={config} onReady={handleChartReady} />;
    case 'kpi':
      return <KpiWidget data={data} config={config} />;
    case 'text':
      return <TextWidget config={config} />;
    case 'image':
      return <ImageWidget config={config} />;
    default:
      return <Typography color="text.secondary">Unknown widget type</Typography>;
  }
}

// ── Table Widget ──
function TableWidget({ data, config }: { data: QueryResult | null; config: any }) {
  const columnDefs: ColDef[] = useMemo(() => {
    if (!data?.columns) return [];
    return data.columns.map((col) => ({
      field: col.name,
      headerName: col.name,
      sortable: true,
      filter: true,
      resizable: true,
    }));
  }, [data]);

  if (!data || data.rows.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">{config.title || 'Table'} — No data</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {config.title && (
        <Typography variant="subtitle2" sx={{ px: 1, pt: 0.5, pb: 0.5 }}>{config.title}</Typography>
      )}
      <Box className="ag-theme-alpine" sx={{ flex: 1, minHeight: 0 }}>
        <AgGridReact
          rowData={data.rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          pagination
          paginationPageSize={20}
          domLayout="autoHeight"
        />
      </Box>
    </Box>
  );
}

// ── Bar / Line Chart Widget ──
function BarLineWidget({ type, data, config, onReady }: { type: 'bar' | 'line'; data: QueryResult | null; config: any; onReady: (inst: any) => void }) {
  const option = useMemo(() => {
    if (!data || data.rows.length === 0) return null;
    const xField = config.xAxis || data.columns[0]?.name;
    const yField = config.yAxis || (data.columns.length > 1 ? data.columns[1]?.name : data.columns[0]?.name);

    return {
      title: config.title ? { text: config.title, left: 'center', textStyle: { fontSize: 13 } } : undefined,
      tooltip: { trigger: 'axis' },
      grid: { left: 60, right: 20, top: config.title ? 40 : 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.rows.map((r) => String(r[xField] ?? '')),
        axisLabel: { rotate: data.rows.length > 10 ? 30 : 0 },
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: yField,
          type: type,
          data: data.rows.map((r) => r[yField]),
          itemStyle: { color: '#1976d2' },
        },
      ],
    };
  }, [data, config, type]);

  if (!option) {
    return <EmptyPlaceholder label={config.title || `${type} chart`} />;
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: '100%', width: '100%' }}
      onChartReady={onReady}
    />
  );
}

// ── Pie Chart Widget ──
function PieWidget({ data, config, onReady }: { data: QueryResult | null; config: any; onReady: (inst: any) => void }) {
  const option = useMemo(() => {
    if (!data || data.rows.length === 0) return null;
    const catField = config.categoryField || config.xAxis || data.columns[0]?.name;
    const valField = config.valueField || config.yAxis || (data.columns.length > 1 ? data.columns[1]?.name : data.columns[0]?.name);

    return {
      title: config.title ? { text: config.title, left: 'center', textStyle: { fontSize: 13 } } : undefined,
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['30%', '65%'],
          data: data.rows.map((r) => ({
            name: String(r[catField] ?? ''),
            value: r[valField],
          })),
          emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } },
        },
      ],
    };
  }, [data, config]);

  if (!option) {
    return <EmptyPlaceholder label={config.title || 'Pie chart'} />;
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: '100%', width: '100%' }}
      onChartReady={onReady}
    />
  );
}

// ── KPI Widget ──
function KpiWidget({ data, config }: { data: QueryResult | null; config: any }) {
  const valueCol = config.valueColumn || data?.columns[0]?.name || '';
  const value = data?.rows[0]?.[valueCol] ?? '—';
  const label = config.label || config.title || valueCol || 'KPI';

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: config.backgroundColor || '#f0f7ff',
        borderRadius: 2,
        p: 2,
      }}
    >
      <Typography variant="h3" fontWeight={700} color="primary">
        {typeof value === 'number' ? value.toLocaleString() : String(value)}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {label}
      </Typography>
    </Paper>
  );
}

// ── Text Widget ──
function TextWidget({ config }: { config: any }) {
  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto', fontSize: config.fontSize || 14 }}>
      <div dangerouslySetInnerHTML={{ __html: config.content || '<p>Enter text...</p>' }} />
    </Box>
  );
}

// ── Image Widget ──
function ImageWidget({ config }: { config: any }) {
  if (!config.src) {
    return <EmptyPlaceholder label="Image — no source set" />;
  }
  return (
    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1 }}>
      <img src={config.src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </Box>
  );
}

// ── Placeholder ──
function EmptyPlaceholder({ label }: { label: string }) {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#fafafa',
        border: '1px dashed #ccc',
        borderRadius: 1,
      }}
    >
      <Typography color="text.secondary">{label} — No data</Typography>
    </Box>
  );
}
