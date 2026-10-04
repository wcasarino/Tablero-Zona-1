import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import os from 'os';
import { initialData } from './src/data';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

const STORE_FILE = path.join(process.cwd(), 'local_db.json');

interface AppStore {
  sheetUrl?: string;
  turnos: any[];
  profesionales: any[];
  guardias: any[];
  agendas: any[];
  fecha_agenda: any[];
}

function readStore(): AppStore {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.turnos) parsed.turnos = [];
      if (!parsed.profesionales) parsed.profesionales = [];
      if (!parsed.guardias) parsed.guardias = [];
      if (!parsed.fecha_agenda) parsed.fecha_agenda = [];
      if (!parsed.agendas) parsed.agendas = [];
      return parsed;
    }
  } catch (err) {
    console.error('Error reading store file:', err);
  }
  return { 
    sheetUrl: process.env.GOOGLE_SHEET_URL || '',
    turnos: initialData, 
    profesionales: [], 
    guardias: [], 
    agendas: [], 
    fecha_agenda: [] 
  };
}

function writeStore(data: Partial<AppStore>) {
  try {
    const current = readStore();
    const updated = { ...current, ...data };
    fs.writeFileSync(STORE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing store file:', err);
  }
}

// API: Health / Connection Status
app.get('/api/test-connection', (req, res) => {
  const store = readStore();
  res.json({
    connected: true,
    mode: 'Google Sheets / Sincronizado',
    hasSheetUrl: Boolean(store.sheetUrl || process.env.GOOGLE_SHEET_URL),
    sheetUrl: store.sheetUrl || process.env.GOOGLE_SHEET_URL || '',
  });
});

// API: Google Sheets URL config
app.get('/api/sheets/config', (req, res) => {
  const store = readStore();
  res.json({
    sheetUrl: store.sheetUrl || process.env.GOOGLE_SHEET_URL || '',
  });
});

app.post('/api/sheets/config', (req, res) => {
  const { sheetUrl } = req.body;
  writeStore({ sheetUrl: String(sheetUrl || '').trim() });
  res.json({ success: true, sheetUrl: String(sheetUrl || '').trim() });
});

// API: Fetch Google Sheet binary XLSX through backend proxy (bypassing CORS)
app.post('/api/sheets/fetch', async (req, res) => {
  try {
    const store = readStore();
    const rawUrl = (req.body && req.body.url) ? req.body.url : (store.sheetUrl || process.env.GOOGLE_SHEET_URL);

    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return res.status(400).json({ 
        error: 'No se ha proporcionado ni configurado la URL de la planilla de Google Sheets.' 
      });
    }

    let exportUrl = rawUrl.trim();
    if (!exportUrl.includes('/') && exportUrl.length >= 15) {
      exportUrl = `https://docs.google.com/spreadsheets/d/${exportUrl}/export?format=xlsx`;
    } else {
      const match = exportUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
      }
    }

    console.log(`[Google Sheets] Descargando desde: ${exportUrl}`);
    const fetchResponse = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      redirect: 'follow',
    });

    if (!fetchResponse.ok) {
      return res.status(fetchResponse.status).json({
        error: `Error al descargar Google Sheet (${fetchResponse.status}: ${fetchResponse.statusText}). Verifique que la planilla esté configurada como "Cualquier persona con el vínculo puede ver".`
      });
    }

    const contentType = fetchResponse.headers.get('content-type') || '';
    const arrayBuffer = await fetchResponse.arrayBuffer();

    // Check if Google returned an HTML login page instead of an XLSX file
    if (contentType.includes('text/html') || arrayBuffer.byteLength < 500) {
      const preview = Buffer.from(arrayBuffer).toString('utf-8', 0, 500);
      if (preview.includes('<html') || preview.includes('<!DOCTYPE') || preview.includes('ServiceLogin')) {
        return res.status(403).json({
          error: 'Acceso denegado a Google Sheets: La planilla no tiene permisos públicos de lectura. En Google Sheets, haga clic en "Compartir" -> en "Acceso general" elija "Cualquier persona que tenga el vínculo" -> Rol "Lector".'
        });
      }
    }

    // Persist sheetUrl in store if provided
    if (req.body && req.body.url) {
      writeStore({ sheetUrl: rawUrl.trim() });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="DATOS.xlsx"');
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Error fetching Google Sheet:', err);
    res.status(500).json({ error: err.message || 'Error al conectar con Google Sheets' });
  }
});

// API: Fetch turnos
app.get('/api/turnos', (req, res) => {
  const { turnos } = readStore();
  res.json(turnos || []);
});

// API: Save turnos (bulk write upserts)
app.post('/api/turnos/bulk', (req, res) => {
  const { turnos: newTurnos } = req.body;
  if (!Array.isArray(newTurnos)) {
    return res.status(400).json({ error: 'Missing turnos array' });
  }

  const store = readStore();
  newTurnos.forEach((t) => {
    const idx = store.turnos.findIndex((existing: any) => existing.id === t.id);
    if (idx >= 0) {
      store.turnos[idx] = t;
    } else {
      store.turnos.push(t);
    }
  });
  writeStore({ turnos: store.turnos });
  res.json({ success: true, count: newTurnos.length });
});

// API: Replace turnos (delete all and insert new)
app.post('/api/turnos/replace', (req, res) => {
  const { turnos: newTurnos } = req.body;
  if (!Array.isArray(newTurnos)) {
    return res.status(400).json({ error: 'Missing turnos array' });
  }

  writeStore({ turnos: newTurnos });
  res.json({ success: true, count: newTurnos.length });
});

// API: Clear/Delete specific turnos
app.post('/api/turnos/clear', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'Missing ids' });
  }

  const store = readStore();
  const updated = store.turnos.filter((t: any) => !ids.includes(t.id));
  writeStore({ turnos: updated });
  res.json({ success: true });
});

// API: Fetch guardias
app.get('/api/guardias', (req, res) => {
  const { guardias } = readStore();
  res.json(guardias || []);
});

// API: Save guardias (bulk write upserts)
app.post('/api/guardias/bulk', (req, res) => {
  const { guardias: newGuardias } = req.body;
  if (!Array.isArray(newGuardias)) {
    return res.status(400).json({ error: 'Missing guardias array' });
  }

  const store = readStore();
  if (!store.guardias) store.guardias = [];
  newGuardias.forEach((g) => {
    const idx = store.guardias.findIndex((existing: any) => existing.id === g.id);
    if (idx >= 0) {
      store.guardias[idx] = g;
    } else {
      store.guardias.push(g);
    }
  });
  writeStore({ guardias: store.guardias });
  res.json({ success: true, count: newGuardias.length });
});

// API: Replace guardias (delete all and insert new)
app.post('/api/guardias/replace', (req, res) => {
  const { guardias: newGuardias } = req.body;
  if (!Array.isArray(newGuardias)) {
    return res.status(400).json({ error: 'Missing guardias array' });
  }

  writeStore({ guardias: newGuardias });
  res.json({ success: true, count: newGuardias.length });
});

// API: Clear/Delete specific guardias
app.post('/api/guardias/clear', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'Missing ids' });
  }

  const store = readStore();
  const updated = (store.guardias || []).filter((g: any) => !ids.includes(g.id));
  writeStore({ guardias: updated });
  res.json({ success: true });
});

// API: Fetch profesionales
app.get('/api/profesionales', (req, res) => {
  const { profesionales } = readStore();
  res.json(profesionales || []);
});

// API: Save profesionales (bulk write upserts)
app.post('/api/profesionales/bulk', (req, res) => {
  const { profesionales: newProfs } = req.body;
  if (!Array.isArray(newProfs)) {
    return res.status(400).json({ error: 'Missing profesionales array' });
  }

  const store = readStore();
  if (!store.profesionales) store.profesionales = [];
  newProfs.forEach((p) => {
    const idx = store.profesionales.findIndex((existing: any) => existing.id === p.id);
    if (idx >= 0) {
      store.profesionales[idx] = p;
    } else {
      store.profesionales.push(p);
    }
  });
  writeStore({ profesionales: store.profesionales });
  res.json({ success: true, count: newProfs.length });
});

// API: Replace profesionales (delete all and insert new)
app.post('/api/profesionales/replace', (req, res) => {
  const { profesionales: newProfs } = req.body;
  if (!Array.isArray(newProfs)) {
    return res.status(400).json({ error: 'Missing profesionales array' });
  }

  writeStore({ profesionales: newProfs });
  res.json({ success: true, count: newProfs.length });
});

// API: Clear/Delete specific profesionales
app.post('/api/profesionales/clear', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'Missing ids' });
  }

  const store = readStore();
  const updated = (store.profesionales || []).filter((p: any) => !ids.includes(p.id));
  writeStore({ profesionales: updated });
  res.json({ success: true });
});

// API: Fetch agendas
app.get('/api/agendas', (req, res) => {
  const { agendas } = readStore();
  res.json(agendas || []);
});

// API: Replace agendas (delete all and insert new)
app.post('/api/agendas/replace', (req, res) => {
  const { data } = req.body;
  if (!Array.isArray(data)) return res.status(400).json({ error: 'Missing data array' });

  writeStore({ agendas: data });
  res.json({ success: true, count: data.length });
});

// API: Fetch fecha-agenda
app.get('/api/fecha-agenda', (req, res) => {
  const { fecha_agenda } = readStore();
  if (Array.isArray(fecha_agenda) && fecha_agenda.length > 0) {
    res.json(fecha_agenda[0]);
  } else if (fecha_agenda && !Array.isArray(fecha_agenda)) {
    res.json(fecha_agenda);
  } else {
    res.json(null);
  }
});

// API: Replace/Save single fecha-agenda
app.post('/api/fecha-agenda/replace', (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'Missing data object' });

  writeStore({ fecha_agenda: [data] });
  res.json({ success: true, data });
});

// Vite middleware & Static SPA configuration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    const nets = os.networkInterfaces();
    let networkAddress = null;
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          networkAddress = net.address;
          console.log(`Network Access: http://${networkAddress}:${PORT}`);
        }
      }
    }
  });
}

startServer();
