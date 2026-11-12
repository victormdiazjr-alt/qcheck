#!/usr/bin/env node
// Smoke de solo lectura: abre cada ruta como un usuario (GET), sin clics ni formularios.
// Uso: BASE_URL=http://127.0.0.1:8452 PATHS=/index.html,/despacho.html node smoke.mjs
// Opcional: EVIDENCE_DIR, CHROME_PATH (Chrome del sistema), PLAYWRIGHT_MODULE (ruta a playwright/index.mjs).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const base = process.env.BASE_URL;
if (!base) { console.error('Falta BASE_URL'); process.exit(2); }
const paths = (process.env.PATHS || '/').split(',').map(s => s.trim()).filter(Boolean);
const repo = process.env.VERIFY_REPO || 'app';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = process.env.EVIDENCE_DIR || join(homedir(), 'verify-evidence', repo, stamp);
mkdirSync(out, { recursive: true });

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const results = [];
for (const p of paths) {
  const url = new URL(p.replace(/^\//, ''), base.endsWith('/') ? base : base + '/').toString();
  const pageErrors = [];
  const consoleErrors = [];
  const onErr = e => pageErrors.push(String(e));
  const onConsole = m => { if (m.type() === 'error') consoleErrors.push(m.text()); };
  page.on('pageerror', onErr);
  page.on('console', onConsole);
  let status = 0, title = '', error = null;
  try {
    const res = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    status = res ? res.status() : 0;
    await page.waitForTimeout(1000);
    title = await page.title();
  } catch (e) { error = String(e); }
  const shot = join(out, `${p.replace(/[^a-z0-9]+/gi, '_') || 'root'}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  page.off('pageerror', onErr);
  page.off('console', onConsole);
  const ok = !error && status > 0 && status < 400 && pageErrors.length === 0;
  results.push({ url, finalUrl: page.url(), status, title, ok, error, pageErrors, consoleErrors, screenshot: shot });
  console.log(`${ok ? 'OK ' : 'MAL'} ${status} ${url} ${title ? `«${title}»` : ''}${pageErrors.length ? ` errores JS: ${pageErrors.length}` : ''}`);
}
await browser.close();
writeFileSync(join(out, 'report.json'), JSON.stringify({ base, when: new Date().toISOString(), results }, null, 2));
console.log(`Evidencia: ${out}`);
process.exit(results.every(r => r.ok) ? 0 : 1);
