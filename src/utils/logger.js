const LEVEL_RANK = { error: 0, warn: 1, info: 2, debug: 3 };
const MAX_LOG_JSON_LENGTH = 2048;

const SENSITIVE_KEY_PATTERN =
  /password|passwd|contrase(?:n|ñ)a|token|secret|authorization|api[_-]?key|refresh[_-]?token|access[_-]?token|credential/i;

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

const LEVEL_COLOR = {
  error: ANSI.red,
  warn: ANSI.yellow,
  info: ANSI.cyan,
  debug: ANSI.magenta,
};

function currentLogLevel() {
  const raw = String(process.env.LOG_LEVEL || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(LEVEL_RANK, raw)) return raw;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level) {
  return LEVEL_RANK[level] <= LEVEL_RANK[currentLogLevel()];
}

function useColor() {
  if (process.env.NO_COLOR !== undefined) return false;
  return Boolean(process.stdout.isTTY);
}

function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function sanitizeForLog(value, depth = 0) {
  if (depth > 8) return "[max depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…[truncated]` : value;
  }
  if (typeof value !== "object") return value;
  if (Buffer.isBuffer(value)) return "[buffer]";
  if (value instanceof Error) {
    return sanitizeForLog(
      { name: value.name, message: value.message, stack: value.stack },
      depth + 1
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1));
  }

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveKey(key)) result[key] = "***";
    else result[key] = sanitizeForLog(entry, depth + 1);
  }
  return result;
}

function formatPayload(value) {
  try {
    const serialized = JSON.stringify(sanitizeForLog(value));
    if (serialized == null) return String(value);
    if (serialized.length <= MAX_LOG_JSON_LENGTH) return serialized;
    return `${serialized.slice(0, MAX_LOG_JSON_LENGTH)}…[truncated]`;
  } catch {
    return "[unserializable]";
  }
}

function statusColor(status) {
  if (status >= 500) return ANSI.red;
  if (status >= 400) return ANSI.yellow;
  if (status >= 300) return ANSI.cyan;
  return ANSI.green;
}

function paintStatus(status) {
  const text = String(status);
  if (!useColor()) return text;
  return `${statusColor(status)}${text}${ANSI.reset}`;
}

class Logger {
  constructor(context = "App") {
    this.context = context;
  }

  _format(level, message, meta) {
    const timestamp = new Date().toISOString();
    const levelLabel = level.toUpperCase();
    let prefix = `${timestamp} ${levelLabel} [${this.context}] ${message}`;
    if (useColor()) {
      const color = LEVEL_COLOR[level] || ANSI.reset;
      prefix = `${ANSI.dim}${timestamp}${ANSI.reset} ${color}${levelLabel}${ANSI.reset} [${this.context}] ${message}`;
    }

    if (meta == null) return prefix;
    if (typeof meta === "object" && !Array.isArray(meta) && Object.keys(meta).length === 0) {
      return prefix;
    }
    return `${prefix} ${formatPayload(meta)}`;
  }

  _write(level, message, meta) {
    if (!shouldLog(level)) return;
    const line = this._format(level, message, meta);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  error(message, meta) {
    this._write("error", message, meta);
  }

  warn(message, meta) {
    this._write("warn", message, meta);
  }

  info(message, meta) {
    this._write("info", message, meta);
  }

  debug(message, meta) {
    this._write("debug", message, meta);
  }
}

module.exports = {
  Logger,
  sanitizeForLog,
  formatPayload,
  paintStatus,
  shouldLog,
};
