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

function loggedUrl(url) {
  return String(url).replace(/([?&]token=)[^&\s]*/gi, "$1[redacted]");
}

function loggedQuery(query) {
  if (!query || typeof query !== "object" || !Object.prototype.hasOwnProperty.call(query, "token")) {
    return query;
  }
  return { ...query, token: "[redacted]" };
}

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    let message = `${req.method} ${loggedUrl(req.originalUrl)} ${paintStatus(status)} ${durationMs}ms`;

    if (shouldLog("debug")) {
      const query = loggedQuery(req.query);
      if (hasQueryParams(query)) message += ` query=${formatPayload(query)}`;
      if (isMultipart(req)) message += " body=[multipart]";
      else if (hasBody(req.body)) message += ` body=${formatPayload(req.body)}`;
    }

    httpLog[level](message);
  });

  next();
}

module.exports = requestLogger;
