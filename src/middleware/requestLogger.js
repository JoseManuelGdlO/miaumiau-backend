const { Logger, formatPayload, paintStatus, shouldLog } = require("../utils/logger");

const httpLog = new Logger("HTTP");

function isMultipart(req) {
  const contentType = req.get("content-type") || "";
  return contentType.includes("multipart/form-data");
}

function hasQueryParams(query) {
  return Boolean(query) && typeof query === "object" && Object.keys(query).length > 0;
}

function hasBody(body) {
  if (body === null || body === undefined) return false;
  if (typeof body !== "object") return true;
  if (Array.isArray(body)) return body.length > 0;
  return Object.keys(body).length > 0;
}

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    let message = `${req.method} ${req.originalUrl} ${paintStatus(status)} ${durationMs}ms`;

    if (shouldLog("debug")) {
      if (hasQueryParams(req.query)) message += ` query=${formatPayload(req.query)}`;
      if (isMultipart(req)) message += " body=[multipart]";
      else if (hasBody(req.body)) message += ` body=${formatPayload(req.body)}`;
    }

    httpLog[level](message);
  });

  next();
}

module.exports = requestLogger;
