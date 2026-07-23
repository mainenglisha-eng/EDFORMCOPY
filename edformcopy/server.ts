import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large JSON payloads (worksheets containing base64 images of pages)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Ensure data directory and databases exist
  const DATA_DIR = path.join(process.cwd(), 'data');
  const WORKSHEETS_FILE = path.join(DATA_DIR, 'worksheets.json');
  const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(WORKSHEETS_FILE)) {
    fs.writeFileSync(WORKSHEETS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2));
  }

  // Helpers for DB access
  const getWorksheets = () => {
    try {
      return JSON.parse(fs.readFileSync(WORKSHEETS_FILE, 'utf-8'));
    } catch (e) {
      return [];
    }
  };

  const saveWorksheets = (data: any) => {
    fs.writeFileSync(WORKSHEETS_FILE, JSON.stringify(data, null, 2));
  };

  const getSubmissions = () => {
    try {
      return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf-8'));
    } catch (e) {
      return [];
    }
  };

  const saveSubmissions = (data: any) => {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2));
  };

  // --- API Routes ---

  // Get all worksheets
  app.get('/api/worksheets', (req, res) => {
    const worksheets = getWorksheets();
    // Return worksheets (we can map to remove heavy backgrounds in the list, but for our app, simple is better)
    res.json(worksheets);
  });

  // Get single worksheet
  app.get('/api/worksheets/:id', (req, res) => {
    const worksheets = getWorksheets();
    const worksheet = worksheets.find((w: any) => w.id === req.params.id);
    if (!worksheet) {
      res.status(404).json({ error: 'Ficha no encontrada' });
      return;
    }
    res.json(worksheet);
  });

  // Create or Update worksheet
  app.post('/api/worksheets', (req, res) => {
    const { id, title, backgrounds, fields } = req.body;
    if (!title) {
      res.status(400).json({ error: 'El título es requerido' });
      return;
    }

    const worksheets = getWorksheets();
    const existingIndex = worksheets.findIndex((w: any) => w.id === id);

    const worksheetData = {
      id: id || `ws_${Date.now()}`,
      title,
      backgrounds: backgrounds || [],
      fields: fields || [],
      createdAt: existingIndex >= 0 ? worksheets[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      worksheets[existingIndex] = worksheetData;
    } else {
      worksheets.push(worksheetData);
    }

    saveWorksheets(worksheets);
    res.json(worksheetData);
  });

  // Delete worksheet
  app.delete('/api/worksheets/:id', (req, res) => {
    const worksheets = getWorksheets();
    const filtered = worksheets.filter((w: any) => w.id !== req.params.id);
    saveWorksheets(filtered);

    // Also clean up submissions for this worksheet
    const submissions = getSubmissions();
    const filteredSubmissions = submissions.filter((s: any) => s.worksheetId !== req.params.id);
    saveSubmissions(filteredSubmissions);

    res.json({ success: true });
  });

  // Get all submissions (Teacher Dashboard)
  app.get('/api/submissions', (req, res) => {
    res.json(getSubmissions());
  });

  // Submit student answers
  app.post('/api/submissions', (req, res) => {
    const { worksheetId, studentName, answers, score, maxScore } = req.body;
    if (!worksheetId || !studentName) {
      res.status(400).json({ error: 'Falta ID de ficha o nombre de estudiante' });
      return;
    }

    const worksheets = getWorksheets();
    const worksheet = worksheets.find((w: any) => w.id === worksheetId);
    if (!worksheet) {
      res.status(404).json({ error: 'Ficha asociada no encontrada' });
      return;
    }

    const submissions = getSubmissions();
    const newSubmission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      worksheetId,
      worksheetTitle: worksheet.title,
      studentName,
      answers: answers || {},
      score: score || 0,
      maxScore: maxScore || 0,
      submittedAt: new Date().toISOString()
    };

    submissions.push(newSubmission);
    saveSubmissions(submissions);

    res.json(newSubmission);
  });

  // --- Vite Middleware or Static Production Serving ---
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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
