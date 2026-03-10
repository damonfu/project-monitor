# Project Monitor API

Cloudflare Workers API for Project Monitor Platform.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api` | GET | API info |
| `/api/projects` | GET | Get all projects |
| `/api/projects/:name` | GET | Get project by name |
| `/api/snapshots` | GET | Get available snapshot dates |
| `/api/snapshots/:date` | GET | Get snapshot for date (YYYY-MM-DD) |
| `/api/reports` | GET | Get list of reports |
| `/api/reports/:date` | GET | Get report content (markdown) |
| `/api/reports/:date/json` | GET | Get report as JSON |
| `/api/scan` | POST | Trigger scan (requires token) |

## Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Generate TypeScript types
npm run cf-typegen
```

## Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## Configuration

Set environment variables in `wrangler.toml` or via Cloudflare dashboard:

- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `DATA_URL` - External URL to fetch data files (optional)
- `SCAN_TOKEN` - Token for scan endpoint authorization

## CORS

CORS is configured to allow requests from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:4173` (Vite preview)
- `http://localhost:8787` (Wrangler dev)
- Or custom origins via `ALLOWED_ORIGINS` env var

## Data Source

Data can be provided via:
1. Embedded data (default) - Data is compiled into the worker
2. External URL - Set `DATA_URL` env var to fetch from remote source
3. KV/R2 - Future enhancement

## Architecture

```
src/
├── index.ts           # Main entry point
├── types.ts           # TypeScript type definitions
├── routes/
│   ├── projects.ts    # Projects API routes
│   ├── snapshots.ts   # Snapshots API routes
│   └── reports.ts     # Reports API routes
├── middleware/
│   └── cors.ts        # CORS configuration
└── utils/
    └── data.ts        # Data loading utilities

data/
├── projects-index.json
├── snapshots/
│   └── YYYY-MM-DD.json
└── reports/
    └── YYYY-MM-DD.md
```
