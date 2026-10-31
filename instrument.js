// Sentry: monitoreo de errores (parte 1 del laboratorio).
// Se activa solo si existe SENTRY_DSN, que se define en las variables de
// entorno de Render. En local (partes 2 y 3) queda apagado y no interfiere
// con OpenTelemetry/Grafana. Este archivo debe cargarse antes que express.
var Sentry = null;

if (process.env.SENTRY_DSN) {
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    release: process.env.RENDER_GIT_COMMIT,
    sendDefaultPii: false
  });
}

module.exports = Sentry;
