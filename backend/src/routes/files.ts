/**
 * /api/files — generic file manager (documents, contracts, photos).
 *
 * Endpoints:
 *   GET    /                  list (optional ?folder=)
 *   POST   /                  multipart upload (field "file" + folder, description)
 *   PATCH  /:id               update folder/description
 *   DELETE /:id               remove DB row + on-disk file
 *
 * Files saved to ./uploads/files/<dealer_id>/<uuid><ext>.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth';
import { tenantGuard, requireDealer } from '../middleware/tenant';
import { requireRole } from '../middleware/roles';

const router = Router();
const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
ensureDir(UPLOADS_ROOT);

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'application/zip',
]);

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const dealerId = (req as any).dealerId;
    if (!dealerId) { cb(new Error('No dealer scope'), ''); return; }
    const dir = path.join(UPLOADS_ROOT, 'files', dealerId);
    ensureDir(dir);
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 12) || '';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error('Unsupported file type'));
      return;
    }
    cb(null, true);
  },
});
const handleUpload = upload.single('file') as unknown as (
  req: Request, res: Response, cb: (err?: any) => void,
) => void;

router.use(authenticate, tenantGuard);

router.get('/', requireDealer, async (req: Request, res: Response) => {
  const dealerId = req.dealerId!;
  const folder = typeof req.query.folder === 'string' ? req.query.folder : undefined;
  const q = db('dealer_files').where({ dealer_id: dealerId }).orderBy('created_at', 'desc');
  if (folder) q.andWhere({ folder });
  const rows = await q;
  res.json({ files: rows });
});

router.post('/', requireDealer, requireRole('dealer_admin'), (req: Request, res: Response) => {
  handleUpload(req, res, async (err: any) => {
    if (err) { res.status(400).json({ error: err.message || 'Upload failed' }); return; }
    if (!req.file) { res.status(400).json({ error: 'No file received' }); return; }
    const dealerId = req.dealerId!;
    const folder = (req.body?.folder as string)?.trim() || 'general';
    const description = (req.body?.description as string)?.trim() || null;
    const url = `/uploads/files/${dealerId}/${req.file.filename}`;
    const [row] = await db('dealer_files')
      .insert({
        dealer_id: dealerId,
        folder,
        name: req.file.filename,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size_bytes: req.file.size,
        url,
        description,
        uploaded_by: (req as any).user?.id ?? null,
      })
      .returning('*');
    res.status(201).json({ file: row });
  });
});

router.patch('/:id', requireDealer, requireRole('dealer_admin'), async (req: Request, res: Response) => {
  const dealerId = req.dealerId!;
  const patch: Record<string, any> = {};
  if (typeof req.body?.folder === 'string') patch.folder = req.body.folder.trim() || 'general';
  if (typeof req.body?.description === 'string') patch.description = req.body.description.trim();
  if (!Object.keys(patch).length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  const [row] = await db('dealer_files')
    .where({ id: req.params.id, dealer_id: dealerId })
    .update(patch)
    .returning('*');
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ file: row });
});

router.delete('/:id', requireDealer, requireRole('dealer_admin'), async (req: Request, res: Response) => {
  const dealerId = req.dealerId!;
  const row = await db('dealer_files').where({ id: req.params.id, dealer_id: dealerId }).first();
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  try {
    const abs = path.join(UPLOADS_ROOT, 'files', dealerId, row.name);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) { /* ignore disk errors */ }
  await db('dealer_files').where({ id: req.params.id, dealer_id: dealerId }).del();
  res.json({ ok: true });
});

export default router;
