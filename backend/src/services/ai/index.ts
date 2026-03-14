import db from '../../db/client';
import { getMssqlPool } from '../sql-connector';
import sql from 'mssql';

// ── Types ──

export interface SuggestedWidget {
  type: 'bar' | 'line' | 'pie' | 'kpi' | 'table';
  title: string;
  xAxis: string | null;
  yAxis: string | null;
  groupBy: string | null;
}

interface QueryRow {
  id: number;
  connection_id: number;
  sql_text: string;
  name: string;
}

interface ColumnMeta {
  name: string;
  type: string;
  sample: any;
}

// ── Dataset sampling ──

async function fetchDatasetSample(queryId: number): Promise<{ columns: ColumnMeta[]; sampleRows: Record<string, any>[] }> {
  const queryRow = db.prepare('SELECT * FROM queries WHERE id = ?').get(queryId) as QueryRow | undefined;
  if (!queryRow) throw new Error('Query not found');

  let pool: sql.ConnectionPool | undefined;
  try {
    pool = await getMssqlPool(queryRow.connection_id);
    const result = await pool.request().query(queryRow.sql_text);
    const allRows = result.recordset || [];
    const sampleRows = allRows.slice(0, 50);

    const columns: ColumnMeta[] = [];
    if (result.recordset?.columns) {
      for (const [name, meta] of Object.entries(result.recordset.columns) as [string, any][]) {
        columns.push({
          name,
          type: meta.type?.declaration || typeof (sampleRows[0]?.[name]),
          sample: sampleRows[0]?.[name] ?? null,
        });
      }
    } else if (sampleRows.length > 0) {
      for (const name of Object.keys(sampleRows[0])) {
        const val = sampleRows[0][name];
        columns.push({ name, type: typeof val, sample: val });
      }
    }

    return { columns, sampleRows };
  } finally {
    if (pool) {
      try { await pool.close(); } catch { /* ignore */ }
    }
  }
}

// ── Prompt builder ──

function buildPrompt(columns: ColumnMeta[], sampleRows: Record<string, any>[]): string {
  const colDesc = columns.map((c) => `${c.name} (${c.type})`).join(', ');
  const rowsJson = JSON.stringify(sampleRows.slice(0, 10), null, 2);

  return `You are a data visualization expert. Analyze the following dataset metadata and return a JSON array of dashboard widget configurations. Each object must have: type (bar|line|pie|kpi|table), title, xAxis (column name or null), yAxis (column name or null), groupBy (column name or null).

Choose the most appropriate visualization for each interesting aspect of the data. Include at least one KPI if there are numeric aggregate-friendly columns. Include a table widget showing all data. Limit to 4-6 widgets total.

Dataset:
Columns: ${colDesc}
Sample rows:
${rowsJson}

Return only valid JSON. No explanation.`;
}

// ── Provider: OpenAI ──

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set in .env');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

// ── Provider: Ollama (local) ──

async function callOllama(prompt: string): Promise<string> {
  const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3';

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.3 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error (${response.status}): ${err}`);
  }

  const data = await response.json() as any;
  return data.response || '';
}

// ── Parse AI response ──

function parseWidgets(raw: string): SuggestedWidget[] {
  // Extract JSON array from the response (may be wrapped in markdown code blocks)
  let cleaned = raw.trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array found in AI response');

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) throw new Error('AI response is not an array');

  // Validate and normalize
  const validTypes = new Set(['bar', 'line', 'pie', 'kpi', 'table']);
  return parsed
    .filter((w: any) => w.type && validTypes.has(w.type) && w.title)
    .map((w: any) => ({
      type: w.type,
      title: String(w.title),
      xAxis: w.xAxis || null,
      yAxis: w.yAxis || null,
      groupBy: w.groupBy || null,
    }));
}

// ── Public API ──

export async function suggestDashboard(queryId: number): Promise<{
  widgets: SuggestedWidget[];
  columns: ColumnMeta[];
  sampleRowCount: number;
}> {
  const { columns, sampleRows } = await fetchDatasetSample(queryId);
  const prompt = buildPrompt(columns, sampleRows);

  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  let rawResponse: string;

  switch (provider) {
    case 'ollama':
      rawResponse = await callOllama(prompt);
      break;
    case 'openai':
    default:
      rawResponse = await callOpenAI(prompt);
      break;
  }

  const widgets = parseWidgets(rawResponse);

  return { widgets, columns, sampleRowCount: sampleRows.length };
}
