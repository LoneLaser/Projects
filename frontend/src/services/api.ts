import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── Connections ──

export interface Connection {
  id: number;
  name: string;
  server: string;
  database_name: string;
  username: string;
  port: number;
  encrypt: number;
  created_at: string;
  updated_at: string;
}

export interface ConnectionInput {
  name: string;
  server: string;
  database_name: string;
  username: string;
  password: string;
  port?: number;
  encrypt?: boolean;
}

export const getConnections = () => api.get<Connection[]>('/connections').then(r => r.data);
export const createConnection = (data: ConnectionInput) => api.post<Connection>('/connections', data).then(r => r.data);
export const deleteConnection = (id: number) => api.delete(`/connections/${id}`).then(r => r.data);
export const testConnection = (id: number) => api.post<{ success: boolean; message: string }>(`/connections/${id}/test`).then(r => r.data);

// ── Queries ──

export interface SavedQuery {
  id: number;
  connection_id: number;
  connection_name?: string;
  name: string;
  sql_text: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueryResult {
  columns: { name: string; type: string }[];
  rows: Record<string, any>[];
  totalRows: number;
  truncated: boolean;
}

export interface TableMeta {
  schema: string;
  name: string;
  type: string;
  columns: { name: string; type: string; nullable: boolean; default: string | null }[];
}

export const getQueries = () => api.get<SavedQuery[]>('/queries').then(r => r.data);
export const saveQuery = (data: { connection_id: number; name: string; sql_text: string; description?: string }) =>
  api.post<SavedQuery>('/queries', data).then(r => r.data);
export const updateQuery = (id: number, data: Partial<{ name: string; sql_text: string; description: string; connection_id: number }>) =>
  api.put<SavedQuery>(`/queries/${id}`, data).then(r => r.data);
export const deleteQuery = (id: number) => api.delete(`/queries/${id}`).then(r => r.data);
export const runQuery = (connection_id: number, sql_text: string) =>
  api.post<QueryResult>('/queries/run', { connection_id, sql_text }).then(r => r.data);
export const getTablesForConnection = (connectionId: number) =>
  api.get<TableMeta[]>(`/queries/tables/${connectionId}`).then(r => r.data);

// ── Reports ──

export interface WidgetConfig {
  title?: string;
  queryId?: number;
  xAxis?: string;
  yAxis?: string;
  categoryField?: string;
  valueField?: string;
  valueColumn?: string;
  label?: string;
  content?: string;
  src?: string;
  chartImage?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'table' | 'bar' | 'line' | 'pie' | 'kpi' | 'text' | 'image';
  config: WidgetConfig;
}

export interface ReportSettings {
  headerText?: string;
  footerText?: string;
  logoUrl?: string;
  pageFormat?: 'A4' | 'Letter';
  landscape?: boolean;
}

export interface Report {
  id: number;
  name: string;
  description: string | null;
  layout: WidgetLayout[];
  settings: ReportSettings;
  created_at: string;
  updated_at: string;
}

export const getReports = () => api.get<Report[]>('/reports').then(r => r.data);
export const getReport = (id: number) => api.get<Report>(`/reports/${id}`).then(r => r.data);
export const createReport = (data: { name: string; description?: string; layout?: WidgetLayout[]; settings?: ReportSettings }) =>
  api.post<Report>('/reports', data).then(r => r.data);
export const updateReport = (id: number, data: Partial<{ name: string; description: string; layout: WidgetLayout[]; settings: ReportSettings }>) =>
  api.put<Report>(`/reports/${id}`, data).then(r => r.data);
export const deleteReport = (id: number) => api.delete(`/reports/${id}`).then(r => r.data);

// ── Exports ──

export interface ExportResult {
  success: boolean;
  filename: string;
  path: string;
}

export const exportPdf = (reportId: number, chartImages?: Record<string, string>) =>
  api.post<ExportResult>(`/reports/${reportId}/export/pdf`, { chartImages }).then(r => r.data);
export const exportExcel = (reportId: number, chartImages?: Record<string, string>) =>
  api.post<ExportResult>(`/reports/${reportId}/export/excel`, { chartImages }).then(r => r.data);
export const downloadExport = (filename: string) =>
  api.get(`/reports/download/${filename}`, { responseType: 'blob' }).then(r => r.data);

// ── Schedules ──

export interface Schedule {
  id: number;
  report_id: number;
  report_name?: string;
  cron_expression: string;
  cron_description?: string;
  export_format: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const getSchedules = () => api.get<Schedule[]>('/schedules').then(r => r.data);
export const createSchedule = (data: { report_id: number; cron_expression: string; export_format?: string; active?: boolean }) =>
  api.post<Schedule>('/schedules', data).then(r => r.data);
export const updateSchedule = (id: number, data: Partial<{ report_id: number; cron_expression: string; export_format: string; active: boolean }>) =>
  api.put<Schedule>(`/schedules/${id}`, data).then(r => r.data);
export const deleteSchedule = (id: number) => api.delete(`/schedules/${id}`).then(r => r.data);
export const runScheduleNow = (id: number) => api.post<{ success: boolean; message: string }>(`/schedules/${id}/run-now`).then(r => r.data);

// ── Distribution ──

export interface DistributionConfig {
  id: number;
  schedule_id: number;
  report_name?: string;
  provider: string;
  config: Record<string, any>;
  recipients: string[];
  subject_template: string | null;
  body_template: string | null;
  created_at: string;
  updated_at: string;
}

export const getDistributionConfigs = () => api.get<DistributionConfig[]>('/distribution').then(r => r.data);
export const createDistributionConfig = (data: {
  schedule_id: number;
  provider: string;
  config: Record<string, any>;
  recipients: string[];
  subject_template?: string;
  body_template?: string;
}) => api.post<DistributionConfig>('/distribution', data).then(r => r.data);
export const updateDistributionConfig = (id: number, data: Partial<{
  schedule_id: number;
  provider: string;
  config: Record<string, any>;
  recipients: string[];
  subject_template: string;
  body_template: string;
}>) => api.put<DistributionConfig>(`/distribution/${id}`, data).then(r => r.data);
export const deleteDistributionConfig = (id: number) => api.delete(`/distribution/${id}`).then(r => r.data);
export const testSmtpConnection = (provider: string, config: Record<string, any>) =>
  api.post<{ success: boolean; error?: string }>('/distribution/test-smtp', { provider, config }).then(r => r.data);

// ── Execution History ──

export interface ExecutionHistory {
  id: number;
  report_id: number;
  report_name?: string;
  schedule_id: number | null;
  trigger_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  output_path: string | null;
  email_status: string | null;
  error_message: string | null;
}

export const getExecutionHistory = (params?: { status?: string; report_id?: number; limit?: number; offset?: number }) =>
  api.get<{ rows: ExecutionHistory[]; total: number; limit: number; offset: number }>('/history', { params }).then(r => r.data);
export const retryExecution = (id: number) =>
  api.post<{ success: boolean; message: string }>(`/history/${id}/retry`).then(r => r.data);
export const deleteExecution = (id: number) => api.delete(`/history/${id}`).then(r => r.data);
export const clearExecutionHistory = () => api.delete('/history').then(r => r.data);

// ── AI Dashboard Generator ──

export interface SuggestedWidget {
  type: 'bar' | 'line' | 'pie' | 'kpi' | 'table';
  title: string;
  xAxis: string | null;
  yAxis: string | null;
  groupBy: string | null;
}

export interface AiConfig {
  provider: string;
  configured: boolean;
  model: string;
  ollamaUrl?: string;
}

export const getAiConfig = () => api.get<AiConfig>('/ai/config').then(r => r.data);
export const suggestDashboard = (queryId: number) =>
  api.post<{ widgets: SuggestedWidget[]; columns: { name: string; type: string }[]; sampleRowCount: number }>('/ai/suggest', { queryId }).then(r => r.data);

export default api;
