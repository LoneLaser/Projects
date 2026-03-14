# Data Report Generator — Build Plan

## Overview

A self-hosted, single-user SQL reporting application with drag-and-drop dashboards, automated scheduling, multi-provider email distribution, and AI-assisted layout generation.

**Stack:** React + TypeScript (frontend) · Node.js + Express + TypeScript (backend) · SQLite (app database) · Docker (deployment)

---

## Project Structure

```
data-report-generator/
├── frontend/                  # React + TypeScript (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/        # AppShell, Sidebar, TabNav
│   │   │   ├── data-sources/  # Connection form, connection list
│   │   │   ├── query-builder/ # SQL editor, visual builder, results preview
│   │   │   ├── report-designer/ # Canvas, widget palette, grid layout
│   │   │   ├── scheduler/     # Schedule form, cron config
│   │   │   ├── distribution/  # Email config, recipient lists
│   │   │   ├── history/       # Execution log table, retry/download
│   │   │   └── ai-assistant/  # Dataset selector, suggestion panel
│   │   ├── hooks/
│   │   ├── services/          # Axios API client
│   │   ├── store/             # State (Zustand or Context)
│   │   └── types/
│   └── package.json
│
├── backend/                   # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── api/               # Express routers
│   │   ├── db/                # SQLite schema + migrations
│   │   ├── services/
│   │   │   ├── sql-connector/ # mssql connection manager
│   │   │   ├── report-engine/ # HTML → PDF (Puppeteer), Excel (ExcelJS)
│   │   │   ├── scheduler/     # node-cron job manager
│   │   │   ├── email/         # nodemailer, Graph API, Gmail API
│   │   │   └── ai/            # OpenAI / local LLM integration
│   │   └── workers/           # BullMQ job processors
│   └── package.json
│
├── database/                  # SQLite file (runtime)
├── reports/
│   ├── generated/
│   └── templates/
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml
└── package.json               # Root workspace config
```

---

## Phase 0 — Workspace Bootstrap

**Goal:** Monorepo scaffold, tooling, git initialization.

### Steps

1. Initialize root workspace
   ```bash
   npm init -y
   git init
   echo "node_modules\n.env\n*.db\nreports/generated" > .gitignore
   ```

2. Scaffold backend
   ```bash
   cd backend && npm init -y
   npm install express mssql node-cron exceljs puppeteer nodemailer bullmq better-sqlite3 openai
   npm install -D typescript @types/node @types/express ts-node nodemon
   npx tsc --init
   ```

3. Scaffold frontend (Vite)
   ```bash
   cd ../frontend
   npm create vite@latest . -- --template react-ts
   npm install @mui/material @emotion/react @emotion/styled
   npm install react-grid-layout ag-grid-react echarts echarts-for-react
   npm install axios zustand react-router-dom
   npm install -D @types/react-grid-layout
   ```

4. Configure root `package.json` with workspaces and a `dev` script that runs both services concurrently.

### Deliverable
Running `npm run dev` from root starts both backend (port 3000) and frontend dev server (port 5173).

---

## Phase 1 — Local Database & Schema

**Goal:** SQLite schema covering all persistent application data.

### Tables

| Table | Purpose |
|---|---|
| `connections` | SQL Server connection profiles |
| `queries` | Saved queries with connection reference |
| `reports` | Report metadata + layout JSON |
| `schedules` | Cron strings tied to reports |
| `distribution_lists` | Email config per schedule |
| `execution_history` | Run log: status, duration, output path, error |

### Steps

1. Create `backend/src/db/schema.sql` with `CREATE TABLE IF NOT EXISTS` for all tables.
2. Create `backend/src/db/client.ts` initializing `better-sqlite3` and running schema on startup.
3. Expose a `GET /api/health` endpoint that confirms DB is reachable.

### Deliverable
Backend starts, SQLite file is created, `/api/health` returns `200 OK`.

---

## Phase 2 — SQL Connection Manager

**Goal:** Users can add, test, and save SQL Server connections.

### Backend

- `POST /api/connections` — save connection (encrypt password at rest using Node `crypto` AES-256-GCM)
- `GET /api/connections` — list saved connections
- `DELETE /api/connections/:id` — remove connection
- `POST /api/connections/:id/test` — open mssql pool, run `SELECT 1`, return success/error

### Frontend — Data Sources Tab

- Connection form: Name, Server, Database, Username, Password, Port
- "Test Connection" button with inline success/failure feedback
- Saved connections list with delete and re-test actions

### Security Note
Passwords stored encrypted (AES-256-GCM) in SQLite. Encryption key loaded from `.env` — never hardcoded.

### Deliverable
User can save and test a SQL Server connection from the UI.

---

## Phase 3 — Query Builder

**Goal:** Write or visually build SQL, preview results, save queries.

### Backend

- `POST /api/queries/run` — execute ad-hoc SQL against a saved connection, return paginated results (max 1000 rows for preview)
- `POST /api/queries` — save query
- `GET /api/queries` — list saved queries
- `GET /api/connections/:id/tables` — return table list and column metadata for visual builder

### Frontend — Queries Tab

**Mode 1: SQL Editor**
- Monaco Editor (or CodeMirror) with SQL syntax highlighting
- "Run" button → results rendered in AG Grid preview
- "Save Query" with name prompt

**Mode 2: Visual Builder**
- Table selector (populated from `/api/connections/:id/tables`)
- Column checkboxes
- Filter row builder
- Aggregation picker
- Auto-generates SQL string shown in read-only editor panel

### Deliverable
User can write SQL, run it, see results in a table, and save the query.

---

## Phase 4 — Report Designer (Drag-and-Drop Canvas)

**Goal:** Visual drag-and-drop report layout builder. This is the highest-complexity module.

### Widget Types

| Widget | Component | Data Binding |
|---|---|---|
| Table | AG Grid | query → rows |
| Bar Chart | ECharts | query → x/y axes |
| Line Chart | ECharts | query → x/y axes |
| Pie Chart | ECharts | query → category/value |
| KPI Tile | Custom MUI card | query → single value |
| Text Block | Rich text | static |
| Image | `<img>` | upload or URL |

### Layout System

- `react-grid-layout` with a 12-column grid
- Widgets drag from palette sidebar onto canvas
- Snapping enforced, no overlaps allowed
- Minimum/maximum resize bounds per widget type
- Layout serializes to JSON stored in `reports.layout`

### Styling Panel

Per-widget configuration drawer:
- Font family / size
- Colors (background, text, border)
- Padding / spacing
- Report-level: header, footer, logo upload

### Backend

- `POST /api/reports` — save report (layout JSON + metadata)
- `GET /api/reports` — list reports
- `GET /api/reports/:id` — load report
- `PUT /api/reports/:id` — update layout

### Deliverable
User can build a multi-widget dashboard, bind data sources, style components, and save the layout.

---

## Phase 5 — Export Engine

**Goal:** Generate professional PDF and Excel exports from saved reports.

### PDF (Puppeteer)

1. Backend renders report layout as a React component to HTML string (or serves a headless route `/render/:id`)
2. Puppeteer opens the render route, waits for charts to load, screenshots as PDF
3. PDF saved to `reports/generated/{reportId}-{timestamp}.pdf`
4. Configurable: A4/Letter, landscape/portrait, margins

### Excel (ExcelJS)

1. Each query result becomes a worksheet
2. Chart images (captured via ECharts `getDataURL`) embedded as images
3. KPI values written to a summary sheet
4. Full formatting: column widths, header styles, alternating row colors

### Backend Routes

- `POST /api/reports/:id/export/pdf` — triggers PDF generation, returns file path
- `POST /api/reports/:id/export/excel` — triggers Excel generation, returns file path
- `GET /api/reports/download/:filename` — streams file to browser

### Deliverable
User can click "Export PDF" or "Export Excel" and receive a professional-quality file.

---

## Phase 6 — Scheduler

**Goal:** Automated, time-based report generation and delivery.

### Backend

- Cron jobs managed by `node-cron`
- On startup, load all active schedules from SQLite and register jobs
- Job execution queued through BullMQ for reliability and retry logic

### Schedule Config

| Field | Options |
|---|---|
| Frequency | Hourly, Daily, Weekly, Monthly, Custom cron |
| Report | Select from saved reports |
| Export format | PDF, Excel, or both |
| Distribution list | Link to email config |
| Active toggle | Enable/disable without deleting |

### API Routes

- `POST /api/schedules` — create schedule
- `GET /api/schedules` — list schedules
- `PUT /api/schedules/:id` — update
- `DELETE /api/schedules/:id` — delete (deregisters cron job)
- `POST /api/schedules/:id/run-now` — trigger immediately for testing

### Frontend — Scheduler Tab

- Schedule list with next-run time
- Create/edit form with cron preview (human-readable cron description)
- "Run Now" test button per schedule

### Deliverable
Schedules persist across restarts and trigger at the correct time, generating and storing output files.

---

## Phase 7 — Email Distribution

**Goal:** Send generated reports via multiple email providers.

### Supported Providers

| Provider | Method |
|---|---|
| Microsoft 365 | Microsoft Graph API (OAuth 2.0) |
| Outlook SMTP | SMTP via nodemailer |
| Google Gmail | Gmail API (OAuth 2.0) |
| Generic SMTP | nodemailer |

### Email Config Fields

- Provider type
- Sender address
- OAuth credentials (for Graph/Gmail) OR SMTP host/port/credentials
- Reply-to, CC, BCC
- Subject template (supports `{{reportName}}` and `{{date}}` variables)
- Body template
- Signature
- Attachment(s): PDF, Excel, or both

### Backend — Email Service

- Unified `sendReport(config, attachments[])` interface
- Provider-specific adapters behind the interface
- OAuth token refresh handled automatically
- `POST /api/distribution` — save distribution config
- `GET /api/distribution` — list configs

### Deliverable
Reports are emailed automatically after scheduled generation using the configured provider.

---

## Phase 8 — Execution History

**Goal:** Full audit trail of every report run.

### Stored Per Execution

- Report name + ID
- Trigger type (scheduled / manual)
- Start time, end time, duration
- Status: `success` | `failed` | `partial`
- Output file path(s)
- Email delivery status
- Error message (if any)

### Frontend — History Tab

- Sortable, filterable AG Grid table
- "Download" button per row (only if output file exists)
- "Retry" button for failed runs
- Error message expandable inline

### Deliverable
Users can review every past run, download its output, and retry failures.

---

## Phase 9 — AI Dashboard Generator

**Goal:** Analyze a dataset and suggest an optimal dashboard layout.

### Flow

1. User selects a saved query or uploads a sample CSV
2. Backend fetches column names, data types, and up to 50 sample rows
3. Sends structured prompt to OpenAI API (or local LLM endpoint)
4. AI returns a JSON widget config array
5. Frontend auto-populates the report designer canvas with the suggested layout
6. User can accept, modify, or discard suggestions

### Prompt Structure

```
You are a data visualization expert. Analyze the following dataset metadata and return a JSON array of dashboard widget configurations. Each object must have: type (bar|line|pie|kpi|table), title, xAxis (column name), yAxis (column name or null), groupBy (column name or null).

Dataset:
Columns: {{columns}}
Sample rows: {{sampleRows}}

Return only valid JSON. No explanation.
```

### Backend Route

- `POST /api/ai/suggest` — accepts `{ queryId }`, returns `{ widgets: [...] }`
- Provider configurable via `.env`: `AI_PROVIDER=openai|ollama`
- Ollama support for fully offline/local inference

### Frontend — AI Assistant Tab

- Query selector
- "Generate Dashboard" button
- Suggestion preview showing proposed widget types
- "Apply to Canvas" button

### Deliverable
Clicking "Generate Dashboard" produces a working draft layout in the report designer.

---

## Phase 10 — Dockerization

**Goal:** Full application runs via `docker-compose up -d`.

### Services

| Service | Port | Notes |
|---|---|---|
| `backend` | 3000 | Node.js API |
| `frontend` | 5173 | Vite preview build (or nginx static) |
| `redis` | 6379 | BullMQ job queue |

### Files

- `docker/Dockerfile.backend` — multi-stage: build → runtime
- `docker/Dockerfile.frontend` — Vite build → nginx static serve
- `docker/docker-compose.yml` — orchestrates all three services

### Volume Mounts

- `./reports:/app/reports` — generated files persist on host
- `./database:/app/database` — SQLite file persists on host

### Environment Variables (`.env`)

```
DB_ENCRYPTION_KEY=
OPENAI_API_KEY=
AI_PROVIDER=openai
REDIS_URL=redis://redis:6379
REPORT_OUTPUT_DIR=/app/reports/generated
```

### Deliverable
`docker-compose up -d` starts the full stack. Navigating to `http://localhost:5173` shows the complete working application.

---

## Build Order Summary

| Phase | Module | Risk | Dependency |
|---|---|---|---|
| 0 | Workspace bootstrap | Low | — |
| 1 | SQLite schema | Low | Phase 0 |
| 2 | SQL Connection Manager | Low | Phase 1 |
| 3 | Query Builder | Medium | Phase 2 |
| 4 | Report Designer | **High** | Phase 3 |
| 5 | Export Engine | High | Phase 4 |
| 6 | Scheduler | Medium | Phase 5 |
| 7 | Email Distribution | Medium | Phase 6 |
| 8 | Execution History | Low | Phase 6 |
| 9 | AI Assistant | Medium | Phase 3 |
| 10 | Docker | Low | All phases |

---

## Key Risk Mitigations

| Risk | Mitigation |
|---|---|
| Drag-and-drop overlap/breakage | Enforce `preventCollision` and bounds in react-grid-layout config from day one |
| PDF chart rendering | Use ECharts `getDataURL` to embed charts as base64 before Puppeteer render |
| OAuth token expiry | Wrap Graph/Gmail calls in auto-refresh middleware |
| AI hallucinating invalid column names | Validate returned JSON widget config against actual dataset columns before applying |
| SQLite corruption | Journal mode WAL, periodic backup to timestamped copy |
