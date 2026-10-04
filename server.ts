import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { MongoClient, Db } from 'mongodb';
import fs from 'fs';
import os from 'os';
import { initialData } from './src/data';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// For local fallback store (when MongoDB is not reachable inside sandboxed preview)
const FALLBACK_FILE = path.join(process.cwd(), 'local_db.json');

function readFallbackDB() {
  try {
    if (fs.existsSync(FALLBACK_FILE)) {
      const content = fs.readFileSync(FALLBACK_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.turnos) parsed.turnos = [];
      if (!parsed.profesionales) parsed.profesionales = [];
      if (!parsed.guardias) parsed.guardias = [];
      if (!parsed.fecha_agenda) parsed.fecha_agenda = [];
      if (!parsed.agendas) parsed.agendas = [];
      return parsed;
    }
  } catch (err) {
    console.error('Error reading fallback DB:', err);
  }
  return { turnos: initialData, profesionales: [], guardias: [], agendas: [], fecha_agenda: [] };
}

function writeFallbackDB(data: any) {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing fallback DB:', err);
  }
}

// Ensure database setup & lazy MongoDB connection
let mongoClient: MongoClient | null = null;
let db: Db | null = null;
let isDbConnected = false;
let dbConnectionError: string | null = null;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/atenciones_zona_1';

async function connectToMongo() {
  if (isDbConnected && db) return { db, connected: true };
  try {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}...`);
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 2000, // short timeout so it doesn't freeze or lag if local PC is offline
    });
    await mongoClient.connect();
    db = mongoClient.db();
    isDbConnected = true;
    dbConnectionError = null;
    console.log('Successfully connected to MongoDB!');
    return { db, connected: true };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    isDbConnected = false;
    dbConnectionError = errMsg;
    console.warn(`Could not connect to MongoDB: ${errMsg}. Running in Fallback mode with local_db.json.`);
    return { db: null, connected: false };
  }
}

// Initial connection attempt
connectToMongo();

// API: Check MongoDB Connection Status
app.get('/api/test-connection', async (req, res) => {
  const { connected } = await connectToMongo();
  res.json({
    connected,
    mode: connected ? 'MongoDB' : 'Fallback (local_db.json)',
    uri: MONGODB_URI,
    error: dbConnectionError,
  });
});

// API: Fetch turnos
app.get('/api/turnos', async (req, res) => {
  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      const turnos = await db.collection('turnos').find({}).toArray();
      const formatted = turnos.map((t) => {
        const { _id, ...rest } = t;
        return { id: t.id || String(_id), ...rest };
      });
      res.json(formatted);
    } catch (error) {
      console.error('Error getting turnos from MongoDB:', error);
      res.status(500).json({ error: 'Database read error' });
    }
  } else {
    const { turnos } = readFallbackDB();
    res.json(turnos);
  }
});

// API: Save turnos (bulk write upserts)
app.post('/api/turnos/bulk', async (req, res) => {
  const { turnos: newTurnos } = req.body;
  if (!Array.isArray(newTurnos)) {
    return res.status(400).json({ error: 'Missing turnos array' });
  }

  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      const collection = db.collection('turnos');
      const bulkOps = newTurnos.map((t) => ({
        updateOne: {
          filter: { id: t.id },
          update: { $set: t },
          upsert: true,
        },
      }));
      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps);
      }
      res.json({ success: true, count: newTurnos.length });
    } catch (error) {
      console.error('Error saving turnos bulk to MongoDB:', error);
      res.status(500).json({ error: 'Database save error' });
    }
  } else {
    const store = readFallbackDB();
    newTurnos.forEach((t) => {
      const idx = store.turnos.findIndex((existing: any) => existing.id === t.id);
      if (idx >= 0) {
        store.turnos[idx] = t;
      } else {
        store.turnos.push(t);
      }
    });
    writeFallbackDB(store);
    res.json({ success: true, count: newTurnos.length, fallback: true });
  }
});

// API: Replace turnos (delete all and insert new)
app.post('/api/turnos/replace', async (req, res) => {
  const { turnos: newTurnos } = req.body;
  if (!Array.isArray(newTurnos)) {
    return res.status(400).json({ error: 'Missing turnos array' });
  }

  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      await db.collection('turnos').deleteMany({});
      if (newTurnos.length > 0) {
        const dataToInsert = newTurnos.map((t: any) => ({ ...t, _id: t.id || t._id }));
        dataToInsert.forEach((d: any) => { if (!d._id) delete d._id; if (!d.id) delete d.id; });
        await db.collection('turnos').insertMany(dataToInsert);
      }
      res.json({ success: true, count: newTurnos.length });
    } catch (error) {
      console.error('Error replacing turnos in MongoDB:', error);
      res.status(500).json({ error: 'Database save error' });
    }
  } else {
    const store = readFallbackDB();
    store.turnos = newTurnos;
    writeFallbackDB(store);
    res.json({ success: true, count: newTurnos.length, fallback: true });
  }
});

// API: Clear/Delete specific turnos
app.post('/api/turnos/clear', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'Missing ids' });
  }

  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      await db.collection('turnos').deleteMany({ id: { $in: ids } });
      res.json({ success: true });
    } catch (error) {
      console.error('Error clearing turnos from MongoDB:', error);
      res.status(500).json({ error: 'Database delete error' });
    }
  } else {
    const store = readFallbackDB();
    store.turnos = store.turnos.filter((t: any) => !ids.includes(t.id));
    writeFallbackDB(store);
    res.json({ success: true, fallback: true });
  }
});

// API: Fetch guardias
app.get('/api/guardias', async (req, res) => {
  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      const guardias = await db.collection('guardias').find({}).toArray();
      const formatted = guardias.map((g) => {
        const { _id, ...rest } = g;
        return { id: g.id || String(_id), ...rest };
      });
      res.json(formatted);
    } catch (error) {
      console.error('Error getting guardias from MongoDB:', error);
      res.status(500).json({ error: 'Database read error' });
    }
  } else {
    const { guardias } = readFallbackDB();
    res.json(guardias || []);
  }
});

// API: Save guardias (bulk write upserts)
app.post('/api/guardias/bulk', async (req, res) => {
  const { guardias: newGuardias } = req.body;
  if (!Array.isArray(newGuardias)) {
    return res.status(400).json({ error: 'Missing guardias array' });
  }

  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      const collection = db.collection('guardias');
      const bulkOps = newGuardias.map((g) => ({
        updateOne: {
          filter: { id: g.id },
          update: { $set: g },
          upsert: true,
        },
      }));
      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps);
      }
      res.json({ success: true, count: newGuardias.length });
    } catch (error) {
      console.error('Error saving guardias bulk to MongoDB:', error);
      res.status(500).json({ error: 'Database save error' });
    }
  } else {
    const store = readFallbackDB();
    if (!store.guardias) store.guardias = [];
    newGuardias.forEach((g) => {
      const idx = store.guardias.findIndex((existing: any) => existing.id === g.id);
      if (idx >= 0) {
        store.guardias[idx] = g;
      } else {
        store.guardias.push(g);
      }
    });
    writeFallbackDB(store);
    res.json({ success: true, count: newGuardias.length, fallback: true });
  }
});

// API: Replace guardias (delete all and insert new)
app.post('/api/guardias/replace', async (req, res) => {
  const { guardias: newGuardias } = req.body;
  if (!Array.isArray(newGuardias)) {
    return res.status(400).json({ error: 'Missing guardias array' });
  }

  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      await db.collection('guardias').deleteMany({});
      if (newGuardias.length > 0) {
        const dataToInsert = newGuardias.map((g: any) => ({ ...g, _id: g.id || g._id }));
        dataToInsert.forEach((d: any) => { if (!d._id) delete d._id; if (!d.id) delete d.id; });
        await db.collection('guardias').insertMany(dataToInsert);
      }
      res.json({ success: true, count: newGuardias.length });
    } catch (error) {
      console.error('Error replacing guardias in MongoDB:', error);
      res.status(500).json({ error: 'Database save error' });
    }
  } else {
    const store = readFallbackDB();
    store.guardias = newGuardias;
    writeFallbackDB(store);
    res.json({ success: true, count: newGuardias.length, fallback: true });
  }
});

// API: Clear/Delete specific guardias
app.post('/api/guardias/clear', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'Missing ids' });
  }

  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      await db.collection('guardias').deleteMany({ id: { $in: ids } });
      res.json({ success: true });
    } catch (error) {
      console.error('Error clearing guardias from MongoDB:', error);
      res.status(500).json({ error: 'Database delete error' });
    }
  } else {
    const store = readFallbackDB();
    if (!store.guardias) store.guardias = [];
    store.guardias = store.guardias.filter((g: any) => !ids.includes(g.id));
    writeFallbackDB(store);
    res.json({ success: true, fallback: true });
  }
});

// API: Fetch profesionales
app.get('/api/profesionales', async (req, res) => {
  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      const profs = await db.collection('profesionales').find({}).toArray();
      const formatted = profs.map((p) => {
        const { _id, ...rest } = p;
        return { id: p.id || String(_id), ...rest };
      });
      res.json(formatted);
    } catch (error) {
      console.error('Error getting profesionales from MongoDB:', error);
      res.status(500).json({ error: 'Database read error' });
    }
  } else {
    const { profesionales } = readFallbackDB();
    res.json(profesionales);
  }
});

// API: Save profesionales (bulk write upserts)
app.post('/api/profesionales/bulk', async (req, res) => {
  const { profesionales: newProfs } = req.body;
  if (!Array.isArray(newProfs)) {
    return res.status(400).json({ error: 'Missing profesionales array' });
  }

  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      const collection = db.collection('profesionales');
      const bulkOps = newProfs.map((p) => ({
        updateOne: {
          filter: { id: p.id },
          update: { $set: p },
          upsert: true,
        },
      }));
      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps);
      }
      res.json({ success: true, count: newProfs.length });
    } catch (error) {
      console.error('Error saving profesionales bulk to MongoDB:', error);
      res.status(500).json({ error: 'Database save error' });
    }
  } else {
    const store = readFallbackDB();
    newProfs.forEach((p) => {
      const idx = store.profesionales.findIndex((existing: any) => existing.id === p.id);
      if (idx >= 0) {
        store.profesionales[idx] = p;
      } else {
        store.profesionales.push(p);
      }
    });
    writeFallbackDB(store);
    res.json({ success: true, count: newProfs.length, fallback: true });
  }
});

// API: Replace profesionales (delete all and insert new)
app.post('/api/profesionales/replace', async (req, res) => {
  const { profesionales: newProfs } = req.body;
  if (!Array.isArray(newProfs)) {
    return res.status(400).json({ error: 'Missing profesionales array' });
  }

  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      await db.collection('profesionales').deleteMany({});
      if (newProfs.length > 0) {
        const dataToInsert = newProfs.map((p: any) => ({ ...p, _id: p.id || p._id }));
        dataToInsert.forEach((d: any) => { if (!d._id) delete d._id; if (!d.id) delete d.id; });
        await db.collection('profesionales').insertMany(dataToInsert);
      }
      res.json({ success: true, count: newProfs.length });
    } catch (error) {
      console.error('Error replacing profesionales in MongoDB:', error);
      res.status(500).json({ error: 'Database save error' });
    }
  } else {
    const store = readFallbackDB();
    store.profesionales = newProfs;
    writeFallbackDB(store);
    res.json({ success: true, count: newProfs.length, fallback: true });
  }
});

// API: Clear/Delete specific profesionales
app.post('/api/profesionales/clear', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'Missing ids' });
  }

  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      await db.collection('profesionales').deleteMany({ id: { $in: ids } });
      res.json({ success: true });
    } catch (error) {
      console.error('Error clearing profesionales from MongoDB:', error);
      res.status(500).json({ error: 'Database delete error' });
    }
  } else {
    const store = readFallbackDB();
    store.profesionales = store.profesionales.filter((p: any) => !ids.includes(p.id));
    writeFallbackDB(store);
    res.json({ success: true, fallback: true });
  }
});

// API: Fetch agendas
app.get('/api/agendas', async (req, res) => {
  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      const data = await db.collection('agendas').find({}).toArray();
      const formatted = data.map((d) => {
        const { _id, ...rest } = d;
        return { id: d.id || String(_id), ...rest };
      });
      res.json(formatted);
    } catch (error) {
      console.error('Error getting agendas from MongoDB:', error);
      res.status(500).json({ error: 'Database read error' });
    }
  } else {
    const { agendas } = readFallbackDB();
    res.json(agendas || []);
  }
});

// API: Replace agendas (delete all and insert new)
app.post('/api/agendas/replace', async (req, res) => {
  const { data } = req.body;
  if (!Array.isArray(data)) return res.status(400).json({ error: 'Missing data array' });

  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      await db.collection('agendas').deleteMany({});
      if (data.length > 0) {
        const dataToInsert = data.map(d => ({ ...d, _id: d.id || d._id }));
        dataToInsert.forEach(d => { if (!d._id) delete d._id; if (!d.id) delete d.id; });
        await db.collection('agendas').insertMany(dataToInsert);
      }
      res.json({ success: true, count: data.length });
    } catch (error) {
      console.error('Error replacing agendas in MongoDB:', error);
      res.status(500).json({ error: 'Database save error' });
    }
  } else {
    const store = readFallbackDB();
    store.agendas = data;
    writeFallbackDB(store);
    res.json({ success: true, count: data.length, fallback: true });
  }
});

// API: Fetch fecha-agenda
app.get('/api/fecha-agenda', async (req, res) => {
  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      const doc = await db.collection('fecha_agenda').findOne({});
      if (doc) {
        const { _id, ...rest } = doc;
        res.json({ id: doc.id || String(_id), ...rest });
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error('Error getting fecha_agenda from MongoDB:', error);
      res.status(500).json({ error: 'Database read error' });
    }
  } else {
    const { fecha_agenda } = readFallbackDB();
    if (Array.isArray(fecha_agenda) && fecha_agenda.length > 0) {
      res.json(fecha_agenda[0]);
    } else if (fecha_agenda && !Array.isArray(fecha_agenda)) {
      res.json(fecha_agenda);
    } else {
      res.json(null);
    }
  }
});

// API: Replace/Save single fecha-agenda
app.post('/api/fecha-agenda/replace', async (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'Missing data object' });

  const { db, connected } = await connectToMongo();
  if (connected && db) {
    try {
      await db.collection('fecha_agenda').deleteMany({});
      const docToInsert = { ...data, _id: data.id || 'single' };
      await db.collection('fecha_agenda').insertOne(docToInsert);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error replacing fecha_agenda in MongoDB:', error);
      res.status(500).json({ error: 'Database save error' });
    }
  } else {
    const store = readFallbackDB();
    store.fecha_agenda = [data];
    writeFallbackDB(store);
    res.json({ success: true, data, fallback: true });
  }
});


// Vite middleware & Static SPARouter configuration
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
