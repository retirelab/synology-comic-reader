const prefix = 'comic-reader:';
export function read(key, fallback) { try { return JSON.parse(localStorage.getItem(prefix + key)) ?? fallback; } catch { return fallback; } }
export function write(key, value) { try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch { /* Reading works without storage. */ } }
export function clampPage(value, count) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(count - 1, Math.trunc(n))) : 0; }
