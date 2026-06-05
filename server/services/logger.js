// Centralized error logging to a file.
//
// - logError(context, err): record an error explicitly.
// - installLogging(): tee console.error to the file (so existing console.error
//   calls throughout the app are captured automatically) and catch
//   uncaughtException / unhandledRejection.
// - getRecentLogs(limit): read the most recent lines (for the admin viewer).
//
// NOTE: on hosts with an ephemeral filesystem (e.g. Railway) the file is reset
// on each restart/redeploy — console output is still captured by the platform.
// On a persistent server (VPS) the file survives. Set LOG_DIR to override.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'error.log');
const MAX_BYTES = 5 * 1024 * 1024; // rotate once the log passes ~5 MB

try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ignore */ }

const ts = () => new Date().toISOString();

function safeStringify(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

function rotateIfNeeded() {
  try {
    const { size } = fs.statSync(LOG_FILE);
    if (size > MAX_BYTES) fs.renameSync(LOG_FILE, LOG_FILE + '.1'); // keep one previous file
  } catch { /* file may not exist yet */ }
}

function writeLine(line) {
  try {
    rotateIfNeeded();
    fs.appendFile(LOG_FILE, line + '\n', () => {});
  } catch { /* never let logging crash the app */ }
}

export function logError(context, err) {
  writeLine(`[${ts()}] [ERROR] ${context} :: ${safeStringify(err)}`);
}

export function installLogging() {
  const origError = console.error.bind(console);
  console.error = (...args) => {
    origError(...args);
    writeLine(`[${ts()}] [ERROR] ${args.map(safeStringify).join(' ')}`);
  };
  process.on('uncaughtException', (e) => {
    writeLine(`[${ts()}] [FATAL] uncaughtException :: ${safeStringify(e)}`);
    origError('uncaughtException:', e);
  });
  process.on('unhandledRejection', (e) => {
    writeLine(`[${ts()}] [FATAL] unhandledRejection :: ${safeStringify(e)}`);
    origError('unhandledRejection:', e);
  });
}

// Return the last `limit` log lines (most recent last). Empty if no log yet.
export function getRecentLogs(limit = 200) {
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-limit);
  } catch {
    return [];
  }
}
