import cron, { ScheduledTask } from 'node-cron';
import db from '../../db/client';
import { generatePdf, buildReportHtml, PdfOptions } from '../report-engine/pdf';
import { generateExcel } from '../report-engine/excel';
import { getMssqlPool } from '../sql-connector';
import sql from 'mssql';
import { sendReport } from '../email';

// ── Types ──

interface ScheduleRow {
  id: number;
  report_id: number;
  cron_expression: string;
  export_format: string; // 'pdf' | 'excel' | 'both'
  active: number;
  distribution_list_id: number | null;
}

interface ReportRow {
  id: number;
  name: string;
  description: string | null;
  layout: string;
  settings: string;
}

interface QueryRow {
  id: number;
  connection_id: number;
  sql_text: string;
}

interface DistributionRow {
  id: number;
  schedule_id: number;
  provider: string;
  config: string;
  recipients: string;
  subject_template: string | null;
  body_template: string | null;
}

// In-memory task registry
const activeTasks = new Map<number, ScheduledTask>();

// ── Widget data fetcher (shared with exports) ──

async function fetchWidgetData(
  layout: any[]
): Promise<Record<string, { columns: string[]; rows: any[] }>> {
  const result: Record<string, { columns: string[]; rows: any[] }> = {};

  for (const widget of layout) {
    const queryId = widget.config?.queryId;
    if (!queryId) {
      result[widget.i] = { columns: [], rows: [] };
      continue;
    }

    const queryRow = db.prepare('SELECT * FROM queries WHERE id = ?').get(queryId) as QueryRow | undefined;
    if (!queryRow) {
      result[widget.i] = { columns: [], rows: [] };
      continue;
    }

    let pool: sql.ConnectionPool | undefined;
    try {
      pool = await getMssqlPool(queryRow.connection_id);
      const queryResult = await pool.request().query(queryRow.sql_text);
      const rows = queryResult.recordset || [];
      const columns = queryResult.recordset?.columns
        ? Object.keys(queryResult.recordset.columns)
        : Object.keys(rows[0] || {});

      result[widget.i] = { columns, rows };
    } catch {
      result[widget.i] = { columns: [], rows: [] };
    } finally {
      if (pool) {
        try { await pool.close(); } catch { /* ignore */ }
      }
    }
  }

  return result;
}

// ── Template variable substitution ──

function applyTemplateVars(template: string | null | undefined, vars: Record<string, string>): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}

// ── Execute a schedule ──

export async function executeSchedule(scheduleId: number): Promise<void> {
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as ScheduleRow | undefined;
  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  const reportRow = db.prepare('SELECT * FROM reports WHERE id = ?').get(schedule.report_id) as ReportRow | undefined;
  if (!reportRow) throw new Error(`Report ${schedule.report_id} not found`);

  const report = {
    ...reportRow,
    layout: JSON.parse(reportRow.layout),
    settings: JSON.parse(reportRow.settings),
  };

  const startTime = Date.now();
  const historyId = db.prepare(`
    INSERT INTO execution_history (report_id, schedule_id, trigger_type, status, started_at)
    VALUES (?, ?, 'scheduled', 'running', datetime('now'))
  `).run(schedule.report_id, scheduleId).lastInsertRowid;

  try {
    const widgetData = await fetchWidgetData(report.layout);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = report.name.replace(/[^a-zA-Z0-9-_ ]/g, '');
    const filePaths: string[] = [];

    // Generate PDF
    if (schedule.export_format === 'pdf' || schedule.export_format === 'both') {
      const html = buildReportHtml(report, widgetData);
      const filename = `${safeName}-${timestamp}.pdf`;
      const pdfOptions: PdfOptions = {
        format: report.settings.pageFormat || 'A4',
        landscape: report.settings.landscape ?? false,
      };
      const outputPath = await generatePdf(html, filename, pdfOptions);
      filePaths.push(outputPath);
    }

    // Generate Excel
    if (schedule.export_format === 'excel' || schedule.export_format === 'both') {
      const filename = `${safeName}-${timestamp}.xlsx`;
      const outputPath = await generateExcel(report, widgetData, filename);
      filePaths.push(outputPath);
    }

    const duration = Date.now() - startTime;
    const outputPath = filePaths.join(',');

    // ── Email distribution ──
    let emailStatus = 'none';
    const distRow = db.prepare('SELECT * FROM distribution_lists WHERE schedule_id = ?').get(scheduleId) as DistributionRow | undefined;

    if (distRow) {
      const templateVars = {
        reportName: report.name,
        date: new Date().toLocaleDateString(),
      };

      try {
        await sendReport({
          provider: distRow.provider as any,
          config: JSON.parse(distRow.config),
          recipients: JSON.parse(distRow.recipients),
          subject: applyTemplateVars(distRow.subject_template, templateVars) || `Report: ${report.name}`,
          body: applyTemplateVars(distRow.body_template, templateVars) || `Attached is the latest report: ${report.name}`,
          attachments: filePaths,
        });
        emailStatus = 'sent';
      } catch (err: any) {
        emailStatus = `failed: ${err.message}`;
      }
    }

    db.prepare(`
      UPDATE execution_history
      SET status = 'success', finished_at = datetime('now'), duration_ms = ?, output_path = ?, email_status = ?
      WHERE id = ?
    `).run(duration, outputPath, emailStatus, historyId);

    console.log(`Schedule ${scheduleId} executed successfully in ${duration}ms`);
  } catch (err: any) {
    const duration = Date.now() - startTime;
    db.prepare(`
      UPDATE execution_history
      SET status = 'failed', finished_at = datetime('now'), duration_ms = ?, error_message = ?
      WHERE id = ?
    `).run(duration, err.message, historyId);

    console.error(`Schedule ${scheduleId} failed:`, err.message);
    throw err;
  }
}

// ── Register a single schedule ──

function registerSchedule(schedule: ScheduleRow): void {
  // Remove existing task if present
  unregisterSchedule(schedule.id);

  if (!schedule.active) return;

  if (!cron.validate(schedule.cron_expression)) {
    console.warn(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cron_expression}`);
    return;
  }

  const task = cron.schedule(schedule.cron_expression, async () => {
    console.log(`Cron triggered for schedule ${schedule.id}`);
    try {
      await executeSchedule(schedule.id);
    } catch (err: any) {
      console.error(`Schedule ${schedule.id} execution error:`, err.message);
    }
  });

  activeTasks.set(schedule.id, task);
  console.log(`Registered schedule ${schedule.id}: ${schedule.cron_expression}`);
}

// ── Unregister a schedule ──

function unregisterSchedule(scheduleId: number): void {
  const existing = activeTasks.get(scheduleId);
  if (existing) {
    existing.stop();
    activeTasks.delete(scheduleId);
  }
}

// ── Public API ──

/** Load all active schedules from DB and register cron jobs */
export function initScheduler(): void {
  const schedules = db.prepare('SELECT * FROM schedules WHERE active = 1').all() as ScheduleRow[];
  console.log(`Loading ${schedules.length} active schedule(s)...`);
  for (const s of schedules) {
    registerSchedule(s);
  }
}

/** Register or re-register a schedule after create/update */
export function syncSchedule(scheduleId: number): void {
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as ScheduleRow | undefined;
  if (!schedule) {
    unregisterSchedule(scheduleId);
    return;
  }
  registerSchedule(schedule);
}

/** Remove a schedule's cron job */
export function removeSchedule(scheduleId: number): void {
  unregisterSchedule(scheduleId);
}

/** Get the next scheduled run time (approximate) for display */
export function getNextRunTime(cronExpression: string): string | null {
  if (!cron.validate(cronExpression)) return null;
  // node-cron doesn't expose next run; return human-readable description
  return describeCron(cronExpression);
}

/** Convert a cron expression to a human-readable description */
export function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (minute === '*' && hour === '*') return 'Every minute';
  if (minute === '0' && hour === '*') return 'Every hour';
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  if (dayOfWeek === '1' && dayOfMonth === '*') return `Weekly on Monday at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  if (dayOfMonth === '1' && dayOfWeek === '*') return `Monthly on the 1st at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

  return expr;
}
