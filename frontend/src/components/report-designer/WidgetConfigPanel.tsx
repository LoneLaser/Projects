import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Divider,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import type { WidgetLayout, WidgetConfig, SavedQuery } from '../../services/api';

interface WidgetConfigPanelProps {
  widget: WidgetLayout | null;
  queries: SavedQuery[];
  columns: string[];
  onUpdate: (widgetId: string, config: Partial<WidgetConfig>) => void;
  onDelete: (widgetId: string) => void;
  onClose: () => void;
}

export default function WidgetConfigPanel({
  widget,
  queries,
  columns,
  onUpdate,
  onDelete,
  onClose,
}: WidgetConfigPanelProps) {
  if (!widget) return null;

  const config = widget.config || {};
  const handleChange = (field: keyof WidgetConfig, value: any) => {
    onUpdate(widget.i, { [field]: value });
  };

  const showDataFields = ['table', 'bar', 'line', 'pie', 'kpi'].includes(widget.type);
  const showAxisFields = ['bar', 'line'].includes(widget.type);
  const showPieFields = widget.type === 'pie';
  const showKpiFields = widget.type === 'kpi';
  const showTextFields = widget.type === 'text';
  const showImageFields = widget.type === 'image';

  return (
    <Drawer
      anchor="right"
      open={!!widget}
      onClose={onClose}
      variant="temporary"
      sx={{ '& .MuiDrawer-paper': { width: 340, p: 2 } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {widget.type.charAt(0).toUpperCase() + widget.type.slice(1)} Config
        </Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </Box>

      <TextField
        label="Title"
        value={config.title || ''}
        onChange={(e) => handleChange('title', e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      {showDataFields && (
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Data Source (Query)</InputLabel>
          <Select
            value={config.queryId || ''}
            onChange={(e) => handleChange('queryId', e.target.value)}
            label="Data Source (Query)"
          >
            <MenuItem value="">None</MenuItem>
            {queries.map((q) => (
              <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {showAxisFields && columns.length > 0 && (
        <>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>X Axis</InputLabel>
            <Select
              value={config.xAxis || ''}
              onChange={(e) => handleChange('xAxis', e.target.value)}
              label="X Axis"
            >
              {columns.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Y Axis</InputLabel>
            <Select
              value={config.yAxis || ''}
              onChange={(e) => handleChange('yAxis', e.target.value)}
              label="Y Axis"
            >
              {columns.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      )}

      {showPieFields && columns.length > 0 && (
        <>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Category Field</InputLabel>
            <Select
              value={config.categoryField || ''}
              onChange={(e) => handleChange('categoryField', e.target.value)}
              label="Category Field"
            >
              {columns.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Value Field</InputLabel>
            <Select
              value={config.valueField || ''}
              onChange={(e) => handleChange('valueField', e.target.value)}
              label="Value Field"
            >
              {columns.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      )}

      {showKpiFields && columns.length > 0 && (
        <>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Value Column</InputLabel>
            <Select
              value={config.valueColumn || ''}
              onChange={(e) => handleChange('valueColumn', e.target.value)}
              label="Value Column"
            >
              {columns.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Label"
            value={config.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          />
        </>
      )}

      {showTextFields && (
        <TextField
          label="Content (HTML)"
          value={config.content || ''}
          onChange={(e) => handleChange('content', e.target.value)}
          fullWidth
          multiline
          rows={6}
          size="small"
          sx={{ mb: 2 }}
        />
      )}

      {showImageFields && (
        <TextField
          label="Image URL"
          value={config.src || ''}
          onChange={(e) => handleChange('src', e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        />
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" gutterBottom>Styling</Typography>

      <TextField
        label="Background Color"
        value={config.backgroundColor || ''}
        onChange={(e) => handleChange('backgroundColor', e.target.value)}
        fullWidth
        size="small"
        placeholder="#ffffff"
        sx={{ mb: 2 }}
      />

      <TextField
        label="Text Color"
        value={config.textColor || ''}
        onChange={(e) => handleChange('textColor', e.target.value)}
        fullWidth
        size="small"
        placeholder="#333333"
        sx={{ mb: 2 }}
      />

      <TextField
        label="Font Size (px)"
        type="number"
        value={config.fontSize || ''}
        onChange={(e) => handleChange('fontSize', Number(e.target.value) || undefined)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <Divider sx={{ my: 2 }} />

      <Button
        variant="outlined"
        color="error"
        startIcon={<DeleteIcon />}
        fullWidth
        onClick={() => onDelete(widget.i)}
      >
        Remove Widget
      </Button>
    </Drawer>
  );
}
