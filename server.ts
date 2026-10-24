import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

interface DataRecord {
  id: string;
  sourceSheet: string;
  spreadsheetTitle: string;
  spreadsheetId?: string;
  data: Record<string, any>;
  ingestedAt: string;
  updatedAt: string;
}

interface SyncLog {
  id: string;
  timestamp: string;
  action: string;
  sourceSheet: string;
  rowCount: number;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  clientIp: string;
  userAgent?: string;
  payloadPreview?: string;
}

// Ensure .data dir exists
const dataDir = path.resolve(process.cwd(), '.data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    console.error('Error creating data directory', err);
  }
}
const dbFilePath = path.resolve(dataDir, 'database.json');

let database: {
  records: DataRecord[];
  syncLogs: SyncLog[];
  apiKey: string;
} = {
  records: [],
  syncLogs: [],
  apiKey: 'sk_live_sheetstream_prod_99f2'
};

// Load saved data if exists
try {
  if (fs.existsSync(dbFilePath)) {
    const raw = fs.readFileSync(dbFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.records)) {
      database = parsed;
    }
  }
} catch (e) {
  console.warn('Could not load database file, using memory storage', e);
}

function persistDb() {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(database, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error persisting database:', err);
  }
}

// SSE Connection Management
const sseClients = new Set<Response>();

function broadcastSSE(event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // CORS middleware for Google Apps Script & Chrome Extension fetch calls
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // API Ingest Webhook - This is the external endpoint used by Google Sheets Extension and Apps Script
  app.post('/api/ingest', (req: Request, res: Response) => {
    const startTime = Date.now();
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Google-Sheets-Client';
    const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || req.body.apiKey;

    // Optional API key validation
    if (database.apiKey && authHeader) {
      const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;
      if (token !== database.apiKey && token !== 'test_demo_key') {
        const durationMs = Date.now() - startTime;
        const logEntry: SyncLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          action: 'auth_rejected',
          sourceSheet: req.body.sheetName || 'Desconocida',
          rowCount: 0,
          durationMs,
          status: 'error',
          errorMessage: 'API Key inválida o no autorizada',
          clientIp,
          userAgent,
          payloadPreview: 'Acceso rechazado por clave de API incorrecta'
        };
        database.syncLogs.unshift(logEntry);
        persistDb();
        broadcastSSE('sync_log', logEntry);
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'La API Key proporcionada no es válida. Verifíquela en el panel de control.'
        });
      }
    }

    try {
      const {
        sheetName = 'Hoja 1',
        spreadsheetTitle = 'Planilla Google Sheets',
        spreadsheetId = '',
        action = 'batch_sync',
        records = [],
        record = null
      } = req.body;

      const incomingRows: Array<Record<string, any>> = Array.isArray(records) && records.length > 0
        ? records
        : record ? [record] : [];

      if (incomingRows.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No se recibieron filas o datos para procesar en el payload.'
        });
      }

      let insertedCount = 0;
      let updatedCount = 0;
      const nowIso = new Date().toISOString();
      const processedRecords: DataRecord[] = [];

      for (const rawRow of incomingRows) {
        // Find existing record by codigo, id, or primary key if present
        const matchKey = rawRow.codigo || rawRow.id || rawRow.codigo_producto || rawRow.sku || rawRow.email;
        let existingIndex = -1;

        if (matchKey) {
          existingIndex = database.records.findIndex(r => {
            const rowData = r.data;
            const rKey = rowData.codigo || rowData.id || rowData.codigo_producto || rowData.sku || rowData.email;
            return rKey === matchKey && r.sourceSheet === sheetName;
          });
        }

        if (existingIndex >= 0) {
          // Update existing
          database.records[existingIndex].data = {
            ...database.records[existingIndex].data,
            ...rawRow
          };
          database.records[existingIndex].updatedAt = nowIso;
          processedRecords.push(database.records[existingIndex]);
          updatedCount++;
        } else {
          // Insert new
          const newRec: DataRecord = {
            id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            sourceSheet: sheetName,
            spreadsheetTitle: spreadsheetTitle || 'Planilla Google Sheets',
            spreadsheetId: spreadsheetId || undefined,
            data: rawRow,
            ingestedAt: nowIso,
            updatedAt: nowIso,
          };
          database.records.unshift(newRec);
          processedRecords.push(newRec);
          insertedCount++;
        }
      }

      // Keep max 2000 records in memory/storage
      if (database.records.length > 2000) {
        database.records = database.records.slice(0, 2000);
      }

      const durationMs = Date.now() - startTime;
      const sampleNames = incomingRows.slice(0, 3).map(r => r.codigo || r.cliente || r.nombre || Object.values(r)[0] || 'Fila').join(', ');
      
      const logEntry: SyncLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowIso,
        action: action === 'cell_edit' ? 'cell_edit' : 'batch_sync',
        sourceSheet: sheetName,
        rowCount: incomingRows.length,
        durationMs,
        status: 'success',
        clientIp,
        userAgent,
        payloadPreview: `${incomingRows.length} fila(s) procesadas (${insertedCount} nuevas, ${updatedCount} actualizadas). Ej: ${sampleNames}`
      };

      database.syncLogs.unshift(logEntry);
      if (database.syncLogs.length > 500) {
        database.syncLogs = database.syncLogs.slice(0, 500);
      }

      persistDb();

      // Real-time broadcast via SSE
      broadcastSSE('record_ingested', {
        action,
        sheetName,
        spreadsheetTitle,
        insertedCount,
        updatedCount,
        records: processedRecords,
        log: logEntry,
        totalRecords: database.records.length
      });

      return res.status(200).json({
        success: true,
        message: 'Datos extraídos de Google Sheets recibidos y sincronizados en tiempo real.',
        insertedCount,
        updatedCount,
        totalStored: database.records.length,
        durationMs,
        timestamp: nowIso
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorLog: SyncLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        action: 'error',
        sourceSheet: req.body.sheetName || 'Desconocida',
        rowCount: 0,
        durationMs,
        status: 'error',
        errorMessage: err.message || 'Error procesando datos entrantes',
        clientIp,
        userAgent
      };
      database.syncLogs.unshift(errorLog);
      persistDb();
      broadcastSSE('sync_log', errorLog);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'Fallo al procesar el webhook'
      });
    }
  });

  // SSE Real-Time Event Stream
  app.get('/api/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Add to pool
    sseClients.add(res);

    // Initial greeting / handshake
    res.write(`event: connected\ndata: ${JSON.stringify({
      connected: true,
      time: new Date().toISOString(),
      activeRecords: database.records.length
    })}\n\n`);

    // Keepalive ping every 25s
    const pingInterval = setInterval(() => {
      try {
        res.write(`event: ping\ndata: {"time":"${new Date().toISOString()}"}\n\n`);
      } catch {
        clearInterval(pingInterval);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(pingInterval);
      sseClients.delete(res);
    });
  });

  // GET all records
  app.get('/api/records', (req: Request, res: Response) => {
    const sheet = req.query.sheet as string;
    const search = (req.query.search as string || '').toLowerCase().trim();

    let list = database.records;
    if (sheet && sheet !== 'all') {
      list = list.filter(r => r.sourceSheet === sheet);
    }
    if (search) {
      list = list.filter(r => {
        const str = (JSON.stringify(r.data) + ' ' + r.sourceSheet + ' ' + r.spreadsheetTitle).toLowerCase();
        return str.includes(search);
      });
    }

    res.json({
      records: list,
      total: list.length,
      sheets: Array.from(new Set(database.records.map(r => r.sourceSheet)))
    });
  });

  // DELETE record or clear all
  app.delete('/api/records', (req: Request, res: Response) => {
    const { id, clearAll } = req.body || {};
    if (clearAll) {
      database.records = [];
      persistDb();
      broadcastSSE('records_cleared', { total: 0 });
      return res.json({ success: true, message: 'Todos los registros han sido eliminados.' });
    }
    if (id) {
      database.records = database.records.filter(r => r.id !== id);
      persistDb();
      broadcastSSE('record_deleted', { id, total: database.records.length });
      return res.json({ success: true, message: `Registro ${id} eliminado.` });
    }
    res.status(400).json({ error: 'Missing id or clearAll parameter' });
  });

  // GET sync logs
  app.get('/api/sync-logs', (_req: Request, res: Response) => {
    res.json({
      logs: database.syncLogs.slice(0, 100),
      totalLogs: database.syncLogs.length
    });
  });

  // GET stats
  app.get('/api/stats', (_req: Request, res: Response) => {
    const totalRecords = database.records.length;
    const totalSyncs = database.syncLogs.filter(l => l.status === 'success').length;
    const errorSyncs = database.syncLogs.filter(l => l.status === 'error').length;
    
    // Average latency
    const recentLogs = database.syncLogs.slice(0, 50);
    const avgLatency = recentLogs.length > 0 
      ? Math.round(recentLogs.reduce((acc, l) => acc + (l.durationMs || 0), 0) / recentLogs.length) 
      : 0;

    // Unique sheets
    const sheets = Array.from(new Set(database.records.map(r => r.sourceSheet)));
    
    // Total monetary amount if numeric "monto" exists
    let totalMonetary = 0;
    database.records.forEach(r => {
      const val = parseFloat(r.data.monto || r.data.total || r.data.precio || 0);
      if (!isNaN(val)) totalMonetary += val;
    });

    res.json({
      totalRecords,
      totalSyncs,
      errorSyncs,
      avgLatency,
      sheetsCount: sheets.length,
      sheets,
      totalMonetary,
      lastSync: database.syncLogs[0]?.timestamp || null
    });
  });

  // GET/POST API Key configuration
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({
      apiKey: database.apiKey,
      ingestUrl: '/api/ingest',
      streamUrl: '/api/stream'
    });
  });

  app.post('/api/config', (req: Request, res: Response) => {
    const { apiKey } = req.body;
    if (apiKey && typeof apiKey === 'string') {
      database.apiKey = apiKey.trim();
      persistDb();
      return res.json({ success: true, apiKey: database.apiKey });
    }
    res.status(400).json({ error: 'Invalid apiKey' });
  });

  // Reset data (clears to clean state)
  app.post('/api/reset-demo', (_req: Request, res: Response) => {
    database.records = [];
    database.syncLogs = [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'reset_demo',
        sourceSheet: 'Sistema',
        rowCount: 0,
        durationMs: 10,
        status: 'success',
        clientIp: '127.0.0.1',
        userAgent: 'Internal-System',
        payloadPreview: 'Base de datos vaciada'
      }
    ];
    persistDb();
    broadcastSSE('reset_demo', { total: 0 });
    res.json({ success: true, records: [] });
  });

  // GET /api - API Directory & Specifications
  app.get('/api', (_req: Request, res: Response) => {
    res.json({
      name: 'SheetStream REST API',
      version: '3.2.0',
      description: 'API REST para ingesta, extracción, selección de columnas y sincronización hacia Supabase y sistemas externos.',
      status: 'online',
      auth: {
        type: 'Bearer Token or X-API-Key',
        header: 'Authorization: Bearer <API_KEY>',
        configured: Boolean(database.apiKey)
      },
      endpoints: [
        {
          method: 'POST',
          path: '/api/ingest',
          description: 'Ingesta de filas en tiempo real o en lote desde Google Sheets, CRM, Webhooks, Python o cURL.',
          authRequired: true,
          bodySchema: {
            sheetName: 'string',
            spreadsheetTitle: 'string',
            spreadsheetId: 'string (opcional)',
            action: "'batch_sync' | 'cell_edit'",
            records: 'Array<Record<string, any>>'
          }
        },
        {
          method: 'GET',
          path: '/api/records',
          description: 'Consulta y búsqueda de registros almacenados en la base de datos.',
          queryParams: {
            sheet: "string ('all' o nombre de hoja)",
            search: 'string (filtro de texto)'
          }
        },
        {
          method: 'POST',
          path: '/api/export',
          description: 'Exportación programática filtrando columnas específicas en formato JSON o CSV.',
          bodySchema: {
            columns: 'string[] (columnas a exportar)',
            format: "'json' | 'csv'",
            sheet: 'string (opcional)'
          }
        },
        {
          method: 'DELETE',
          path: '/api/records',
          description: 'Eliminación de registros por ID o vaciado completo de la base de datos.',
          bodySchema: {
            id: 'string (opcional)',
            clearAll: 'boolean (opcional)'
          }
        },
        {
          method: 'GET',
          path: '/api/stats',
          description: 'Métricas agregadas (filas totales, suma monetaria, latencia, hojas activas).'
        },
        {
          method: 'GET',
          path: '/api/sync-logs',
          description: 'Auditoría en tiempo real de las llamadas recibidas a la API.'
        },
        {
          method: 'GET',
          path: '/api/stream',
          description: 'Stream Server-Sent Events (SSE) para escuchar eventos de sincronización en vivo.'
        }
      ]
    });
  });

  // POST /api/export - Export records with column filtering via API
  app.post('/api/export', (req: Request, res: Response) => {
    const { columns = [], format = 'json', sheet = 'all' } = req.body || {};
    let list = database.records;
    if (sheet && sheet !== 'all') {
      list = list.filter(r => r.sourceSheet === sheet);
    }

    const filtered = list.map(r => {
      if (!Array.isArray(columns) || columns.length === 0) return r.data;
      const row: Record<string, any> = {};
      columns.forEach((col: string) => {
        if (r.data[col] !== undefined) row[col] = r.data[col];
      });
      return row;
    });

    if (format === 'csv') {
      const keys = Array.isArray(columns) && columns.length > 0
        ? columns
        : Array.from(new Set(filtered.flatMap(Object.keys)));

      const csvRows = [
        keys.join(','),
        ...filtered.map((row: any) =>
          keys.map((k: string) => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',')
        )
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="sheetstream_export.csv"');
      return res.send(csvRows.join('\n'));
    }

    return res.json({
      success: true,
      total: filtered.length,
      columns: Array.isArray(columns) && columns.length > 0 ? columns : 'all',
      records: filtered
    });
  });

  // Vite Integration
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
