import { randomUUID } from 'node:crypto';
import { getAccountPool } from './idk-account-server.js';

const MAX_CONTENT = 15 * 1024 * 1024;
const memoryCatalog = new Map();

const clean = (value, fallback, max) => String(value || fallback).trim().slice(0, max);
const publicRow = row => ({
  id: row.program_id || row.id,
  name: row.name,
  category: row.category || 'Other',
  icon: row.icon || '🧩',
  author: row.author || 'IDK creator',
  version: row.version || '1.0.0',
  screenshot: row.screenshot || '',
  rating: Number(row.avg_rating || row.rating || 0),
  ratingCount: Number(row.rating_count || row.ratingCount || (Array.isArray(row.ratings) ? row.ratings.length : 0)),
  publishedAt: row.published_at || row.publishedAt,
  contentUrl: `/api/store/programs/${encodeURIComponent(row.program_id || row.id)}/content`
});

async function listPrograms(pool) {
  if (pool) {
    const { rows } = await pool.query(`SELECT p.program_id,p.name,p.category,p.icon,p.author,p.version,p.screenshot,p.published_at,COALESCE(AVG(r.rating),0) AS avg_rating,COUNT(r.rating)::int AS rating_count
      FROM idk_public_programs p LEFT JOIN idk_public_program_ratings r ON r.program_id=p.program_id
      GROUP BY p.program_id ORDER BY p.published_at DESC LIMIT 200`);
    return rows.map(publicRow);
  }
  return [...memoryCatalog.values()].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).map(publicRow);
}

export function publicStoreRoutes(app) {
  app.get('/api/store/programs', async (req, res) => {
    try { res.json({ ok: true, programs: await listPrograms(getAccountPool()) }); }
    catch (error) { console.error('Public catalog read failed:', error); res.status(500).json({ ok: false, error: 'Could not load the public catalog.' }); }
  });

  app.post('/api/store/programs', async (req, res) => {
    const name = clean(req.body?.name, '', 100);
    const category = clean(req.body?.category, 'Other', 32);
    const icon = clean(req.body?.icon, '🧩', 8);
    const author = clean(req.body?.author, 'IDK creator', 64);
    const version = clean(req.body?.version, '1.0.0', 24);
    const screenshot = clean(req.body?.screenshot, '', 500);
    const content = String(req.body?.content || '');
    if (!name || !content) return res.status(400).json({ ok: false, error: 'A name and HTML file are required.' });
    if (!/<html[\s>]/i.test(content)) return res.status(400).json({ ok: false, error: 'Publish a complete HTML document.' });
    if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT) return res.status(413).json({ ok: false, error: 'HTML programs must be smaller than 15 MB.' });
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'idk-program'}-${randomUUID().slice(0, 8)}`;
    const publishedAt = new Date().toISOString();
    const pool = getAccountPool();
    try {
      if (pool) {
        await pool.query('INSERT INTO idk_public_programs(program_id,name,category,icon,author,version,screenshot,content,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, name, category, icon, author, version, screenshot, content, publishedAt]);
      } else {
        memoryCatalog.set(id, { program_id: id, name, category, icon, author, version, screenshot, content, publishedAt, ratings: [] });
      }
      res.status(201).json({ ok: true, program: publicRow({ program_id: id, name, category, icon, author, version, screenshot, publishedAt }) });
    } catch (error) {
      console.error('Public program publish failed:', error);
      res.status(500).json({ ok: false, error: 'Could not publish the program.' });
    }
  });

  app.post('/api/store/programs/:programId/rating', async (req, res) => {
    const id = String(req.params.programId || '');
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ ok: false, error: 'Choose a rating from 1 to 5.' });
    try {
      const pool = getAccountPool();
      if (pool) await pool.query('INSERT INTO idk_public_program_ratings(id,program_id,rating) VALUES($1,$2,$3)', [randomUUID(), id, rating]);
      else if (memoryCatalog.has(id)) memoryCatalog.get(id).ratings.push(rating);
      else return res.sendStatus(404);
      res.json({ ok: true });
    } catch (error) { console.error('Public program rating failed:', error); res.status(500).json({ ok: false, error: 'Could not save the rating.' }); }
  });

  app.post('/api/store/programs/:programId/report', async (req, res) => {
    const id = String(req.params.programId || '');
    const reason = clean(req.body?.reason, 'Other', 200);
    try {
      const pool = getAccountPool();
      if (pool) await pool.query('INSERT INTO idk_public_program_reports(id,program_id,reason) VALUES($1,$2,$3)', [randomUUID(), id, reason]);
      else if (memoryCatalog.has(id)) memoryCatalog.get(id).reports = (memoryCatalog.get(id).reports || 0) + 1;
      else return res.sendStatus(404);
      res.json({ ok: true });
    } catch (error) { console.error('Public program report failed:', error); res.status(500).json({ ok: false, error: 'Could not send the report.' }); }
  });

  app.get('/api/store/programs/:programId/content', async (req, res) => {
    const id = String(req.params.programId || '');
    let content = memoryCatalog.get(id)?.content;
    try {
      const pool = getAccountPool();
      if (pool) {
        const { rows } = await pool.query('SELECT content FROM idk_public_programs WHERE program_id=$1', [id]);
        content = rows[0]?.content;
      }
      if (!content) return res.sendStatus(404);
      res.type('html').set({
        'Content-Security-Policy': "sandbox allow-scripts allow-forms allow-modals; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'",
        'X-Content-Type-Options': 'nosniff'
      }).send(content);
    } catch (error) {
      console.error('Public program read failed:', error);
      res.status(500).send('Could not load the public program.');
    }
  });
}
