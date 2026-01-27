import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Ensure data directories exist
const FONTS_DIR = path.join(DATA_DIR, 'fonts');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.ensureDirSync(FONTS_DIR);
if (!fs.existsSync(DB_FILE)) {
    fs.writeJsonSync(DB_FILE, { presets: [] });
}

app.use(cors());
app.use(express.json());

// Serve Static Frontend (Production Build)
app.use(express.static(path.join(__dirname, '../dist')));

// --- API Endpoints ---

// 1. Presets Management
app.get('/api/presets', async (req, res) => {
    try {
        const db = await fs.readJson(DB_FILE);
        res.json(db.presets || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/presets', async (req, res) => {
    try {
        const db = await fs.readJson(DB_FILE);
        const newPreset = req.body;

        // Check for duplicate name update
        const idx = db.presets.findIndex(p => p.id === newPreset.id);
        if (idx >= 0) {
            db.presets[idx] = newPreset;
        } else {
            db.presets.push(newPreset);
        }

        await fs.writeJson(DB_FILE, db);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/presets/:id', async (req, res) => {
    try {
        const db = await fs.readJson(DB_FILE);
        db.presets = db.presets.filter(p => p.id !== req.params.id);
        await fs.writeJson(DB_FILE, db);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Fonts Management
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, FONTS_DIR);
    },
    filename: function (req, file, cb) {
        // Sanitize filename
        const safeName = file.originalname.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5.]/g, '_');
        cb(null, safeName);
    }
});
const upload = multer({ storage: storage });

app.get('/api/fonts', async (req, res) => {
    try {
        const files = await fs.readdir(FONTS_DIR);
        // Only return font files
        const fontFiles = files.filter(f => /\.(ttf|otf|woff|woff2)$/i.test(f));
        const fontList = fontFiles.map(f => ({
            name: f.split('.')[0], // Simple name
            fileName: f,
            url: `/api/fonts/${f}`
        }));
        res.json(fontList);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Serve font files directly
app.use('/api/fonts', express.static(FONTS_DIR));

app.post('/api/fonts', upload.single('fontFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
        success: true,
        font: {
            name: req.file.filename.split('.')[0],
            fileName: req.file.filename,
            url: `/api/fonts/${req.file.filename}`
        }
    });
});

app.delete('/api/fonts/:fileName', async (req, res) => {
    try {
        const filePath = path.join(FONTS_DIR, req.params.fileName);
        if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Fallback to index.html for SPA routing
// Using app.use() as a catch-all handler to avoid path-to-regexp version issues
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
