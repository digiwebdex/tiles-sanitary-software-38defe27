/**
 * /api/smtp-settings — per-dealer SMTP configuration.
 *
 * GET    /api/smtp-settings        → fetch (password masked)
 * PUT    /api/smtp-settings        → upsert
 * DELETE /api/smtp-settings        → remove (fall back to global env SMTP)
 * POST   /api/smtp-settings/test   → send a test email to a recipient
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth';
import { tenantGuard, requireDealer } from '../middleware/tenant';
import { requireRole } from '../middleware/roles';
import { invalidateDealerSmtpCache } from '../services/notificationService';

const router = Router();
router.use(authenticate, tenantGuard);

const PASSWORD_MASK = '••••••••';

const upsertSchema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.coerce.boolean().default(false),
  username: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(500),
  from_name: z.string().trim().max(255).optional().nullable(),
  from_email: z.string().trim().email().max(255),
  enabled: z.coerce.boolean().default(true),
});

function maskRow(row: any) {
  if (!row) return null;
  return { ...row, password: PASSWORD_MASK };
}

router.get(
  '/',
  requireDealer,
  requireRole('dealer_admin'),
  async (req: Request, res: Response) => {
    try {
      const row = await db('dealer_smtp_settings')
        .where({ dealer_id: req.dealerId! })
        .first();
      res.json(maskRow(row));
    } catch (err: any) {
      console.error('[smtp/get]', err.message);
      res.status(500).json({ error: 'Failed to fetch SMTP settings' });
    }
  },
);

router.put(
  '/',
  requireDealer,
  requireRole('dealer_admin'),
  async (req: Request, res: Response) => {
    try {
      const dealerId = req.dealerId!;
      const parsed = upsertSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid payload', issues: parsed.error.flatten() });
        return;
      }
      const data = parsed.data;

      // If password is the mask, keep the existing one.
      let password = data.password;
      if (password === PASSWORD_MASK) {
        const existing = await db('dealer_smtp_settings').where({ dealer_id: dealerId }).first();
        if (!existing) {
          res.status(400).json({ error: 'Password is required' });
          return;
        }
        password = existing.password;
      }

      const payload = {
        dealer_id: dealerId,
        host: data.host,
        port: data.port,
        secure: data.secure,
        username: data.username,
        password,
        from_name: data.from_name ?? null,
        from_email: data.from_email,
        enabled: data.enabled,
        updated_at: new Date(),
      };

      await db('dealer_smtp_settings')
        .insert(payload)
        .onConflict('dealer_id')
        .merge();

      invalidateDealerSmtpCache(dealerId);

      const row = await db('dealer_smtp_settings').where({ dealer_id: dealerId }).first();
      res.json(maskRow(row));
    } catch (err: any) {
      console.error('[smtp/put]', err.message);
      res.status(500).json({ error: 'Failed to save SMTP settings' });
    }
  },
);

router.delete(
  '/',
  requireDealer,
  requireRole('dealer_admin'),
  async (req: Request, res: Response) => {
    try {
      await db('dealer_smtp_settings').where({ dealer_id: req.dealerId! }).delete();
      invalidateDealerSmtpCache(req.dealerId!);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[smtp/delete]', err.message);
      res.status(500).json({ error: 'Failed to remove SMTP settings' });
    }
  },
);

const testSchema = z.object({
  to: z.string().trim().email(),
});

router.post(
  '/test',
  requireDealer,
  requireRole('dealer_admin'),
  async (req: Request, res: Response) => {
    const parsed = testSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', issues: parsed.error.flatten() });
      return;
    }
    try {
      const row = await db('dealer_smtp_settings').where({ dealer_id: req.dealerId! }).first();
      if (!row) {
        res.status(400).json({ ok: false, error: 'SMTP not configured' });
        return;
      }
      const transport = nodemailer.createTransport({
        host: row.host,
        port: row.port ?? 587,
        secure: !!row.secure,
        auth: { user: row.username, pass: row.password },
      });
      const from = row.from_name ? `"${row.from_name}" <${row.from_email}>` : row.from_email;
      await transport.sendMail({
        from,
        to: parsed.data.to,
        subject: 'TilesERP — SMTP Test Email',
        text: 'This is a test email from your TilesERP account. If you received this, your SMTP configuration is working correctly.',
      });
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[smtp/test]', err.message);
      res.status(400).json({ ok: false, error: err.message || 'Test email failed' });
    }
  },
);

export default router;
