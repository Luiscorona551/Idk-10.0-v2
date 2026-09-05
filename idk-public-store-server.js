import { createHash, randomUUID } from 'node:crypto';
import { accountUserId, getAccountPool } from './idk-account-server.js';

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
  description: row.description || '',
  manifest: row.manifest && typeof row.manifest === 'object' ? row.manifest : {},
  contentHash: row.content_hash || row.contentHash || '',
  verified: Boolean(row.verified),
  screenshot: row.screenshot || '',
  rating: Number(row.avg_rating || row.rating || 0),
  ratingCount: Number(row.rating_count || row.ratingCount || (Array.isArray(row.ratings) ? row.ratings.length : 0)),
  publishedAt: row.published_at || row.publishedAt,
  contentUrl: `/api/store/programs/${encodeURIComponent(row.program_id || row.id)}/content`
});

async function listPrograms(pool, filters = {}) {
  if (pool) {
    const values = [];
    const where = [];
    if (filters.query) { values.push(`%${String(filters.query).slice(0, 80)}%`); where.push(`(p.name ILIKE $${values.length} OR p.author ILIKE $${values.length} OR p.category ILIKE $${values.length})`); }
    if (filters.category && filters.category !== 'all') { values.push(String(filters.category).slice(0, 32)); where.push(`p.category=$${values.length}`); }
    const order = filters.sort === 'rating' ? 'avg_rating DESC, rating_count DESC' : filters.sort === 'newest' ? 'p.published_at DESC' : 'p.verified DESC, avg_rating DESC, rating_count DESC, p.published_at DESC';
    const { rows } = await pool.query(`SELECT p.program_id,p.name,p.category,p.icon,p.author,p.version,p.description,p.manifest,p.content_hash,p.verified,p.screenshot,p.published_at,COALESCE(AVG(r.rating),0) AS avg_rating,COUNT(r.rating)::int AS rating_count
      FROM idk_public_programs p LEFT JOIN idk_public_program_ratings r ON r.program_id=p.program_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY p.program_id ORDER BY ${order} LIMIT 200`, values);
    return rows.map(publicRow);
  }
  let rows = [...memoryCatalog.values()];
  if (filters.query) rows = rows.filter(row => `${row.name} ${row.author} ${row.category}`.toLowerCase().includes(String(filters.query).toLowerCase()));
  if (filters.category && filters.category !== 'all') rows = rows.filter(row => row.category === filters.category);
  return rows.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).map(publicRow);
}

export function publicStoreRoutes(app) {
  app.get('/api/store/programs', async (req, res) => {
    try { res.json({ ok: true, programs: await listPrograms(getAccountPool(), req.query || {}) }); }
    catch (error) { console.error('Public catalog read failed:', error); res.status(500).json({ ok: false, error: 'Could not load the public catalog.' }); }
  });

  app.post('/api/store/programs', async (req, res) => {
    const name = clean(req.body?.name, '', 100);
    const category = clean(req.body?.category, 'Other', 32);
    const icon = clean(req.body?.icon, '🧩', 8);
    const author = clean(req.body?.author, 'IDK creator', 64);
    const version = clean(req.body?.version, '1.0.0', 24);
    const description = clean(req.body?.description, '', 500);
    const screenshot = clean(req.body?.screenshot, '', 500);
    const content = String(req.body?.content || '');
    let manifest = {};
    try { manifest = typeof req.body?.manifest === 'string' ? JSON.parse(req.body.manifest || '{}') : (req.body?.manifest || {}); } catch { return res.status(400).json({ ok: false, error: 'The app manifest must be valid JSON.' }); }
    if (!name || !content) return res.status(400).json({ ok: false, error: 'A name and HTML file are required.' });
    if (!/<html[\s>]/i.test(content)) return res.status(400).json({ ok: false, error: 'Publish a complete HTML document.' });
    if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT) return res.status(413).json({ ok: false, error: 'HTML programs must be smaller than 15 MB.' });
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'idk-program'}-${randomUUID().slice(0, 8)}`;
    const publishedAt = new Date().toISOString();
    const contentHash = createHash('sha256').update(content).digest('hex');
    const publisherId = accountUserId(req);
    const verified = Boolean(publisherId);
    const pool = getAccountPool();
    try {
      if (pool) {
        await pool.query('INSERT INTO idk_public_programs(program_id,name,category,icon,author,version,description,manifest,content_hash,verified,publisher_id,screenshot,content,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14)', [id, name, category, icon, author, version, description, JSON.stringify(manifest), contentHash, verified, publisherId, screenshot, content, publishedAt]);
        await pool.query('INSERT INTO idk_public_program_versions(program_id,version,description,manifest,content_hash,content,publisher_id,published_at) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8)', [id, version, description, JSON.stringify(manifest), contentHash, content, publisherId, publishedAt]);
      } else {
        memoryCatalog.set(id, { program_id: id, name, category, icon, author, version, description, manifest, contentHash, verified, screenshot, content, publishedAt, ratings: [], versions: [{ version, description, manifest, contentHash, content, publishedAt }] });
      }
      res.status(201).json({ ok: true, program: publicRow({ program_id: id, name, category, icon, author, version, description, manifest, contentHash, verified, screenshot, publishedAt }) });
    } catch (error) {
      console.error('Public program publish failed:', error);
      res.status(500).json({ ok: false, error: 'Could not publish the program.' });
    }
  });

  app.get('/api/store/creators/me', async (req, res) => {
    const owner = accountUserId(req);
    const pool = getAccountPool();
    if (!owner || !pool) return res.status(401).json({ ok: false, error: 'Sign in to manage published apps.' });
    try { const { rows } = await pool.query(`SELECT p.program_id,p.name,p.category,p.icon,p.author,p.version,p.description,p.manifest,p.content_hash,p.verified,p.screenshot,p.published_at,COALESCE(AVG(r.rating),0) AS avg_rating,COUNT(r.rating)::int AS rating_count FROM idk_public_programs p LEFT JOIN idk_public_program_ratings r ON r.program_id=p.program_id WHERE p.publisher_id=$1 GROUP BY p.program_id ORDER BY p.published_at DESC`, [owner]); res.json({ ok: true, programs: rows.map(publicRow) }); } catch (error) { console.error('Creator catalog read failed:', error); res.status(500).json({ ok: false, error: 'Could not load your published apps.' }); }
  });

  app.get('/api/store/programs/:programId/versions', async (req, res) => {
    const id = String(req.params.programId || '');
    try { const pool = getAccountPool(); if (pool) { const { rows } = await pool.query('SELECT version,description,manifest,content_hash AS "contentHash",published_at AS "publishedAt" FROM idk_public_program_versions WHERE program_id=$1 ORDER BY published_at DESC', [id]); return res.json({ ok: true, versions: rows }); } const versions = memoryCatalog.get(id)?.versions || []; res.json({ ok: true, versions: versions.map(({ content, ...version }) => version) }); } catch (error) { console.error('Public versions read failed:', error); res.status(500).json({ ok: false, error: 'Could not load app versions.' }); }
  });

  app.put('/api/store/programs/:programId', async (req, res) => {
    const id = String(req.params.programId || '');
    const owner = accountUserId(req);
    const pool = getAccountPool();
    if (!owner || !pool) return res.status(401).json({ ok: false, error: 'Sign in as the publisher to update this app.' });
    const content = String(req.body?.content || '');
    const version = clean(req.body?.version, '', 24);
    if (!content || !version) return res.status(400).json({ ok: false, error: 'A version and complete HTML file are required.' });
    if (!/<html[\s>]/i.test(content)) return res.status(400).json({ ok: false, error: 'Publish a complete HTML document.' });
    let manifest = {};
    try { manifest = typeof req.body?.manifest === 'string' ? JSON.parse(req.body.manifest || '{}') : (req.body?.manifest || {}); } catch { return res.status(400).json({ ok: false, error: 'The app manifest must be valid JSON.' }); }
    const hash = createHash('sha256').update(content).digest('hex');
    try { const ownerCheck = await pool.query('SELECT program_id FROM idk_public_programs WHERE program_id=$1 AND publisher_id=$2', [id, owner]); if (!ownerCheck.rows[0]) return res.status(404).json({ ok: false, error: 'Published app not found.' }); const now = new Date().toISOString(); await pool.query('UPDATE idk_public_programs SET version=$2,description=$3,manifest=$4::jsonb,content_hash=$5,content=$6,published_at=$7 WHERE program_id=$1', [id, version, clean(req.body?.description, '', 500), JSON.stringify(manifest), hash, content, now]); await pool.query('INSERT INTO idk_public_program_versions(program_id,version,description,manifest,content_hash,content,publisher_id,published_at) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8) ON CONFLICT(program_id,version) DO UPDATE SET description=EXCLUDED.description,manifest=EXCLUDED.manifest,content_hash=EXCLUDED.content_hash,content=EXCLUDED.content,published_at=EXCLUDED.published_at', [id, version, clean(req.body?.description, '', 500), JSON.stringify(manifest), hash, content, owner, now]); res.json({ ok: true, version, contentHash: hash }); } catch (error) { console.error('Public program update failed:', error); res.status(500).json({ ok: false, error: 'Could not update the public program.' }); }
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
