// OpenTelemetry -> Grafana Cloud (partes 2 y 3 del laboratorio).
// Envia trazas, metricas y logs directo al gateway OTLP de Grafana Cloud.
// Solo se activa si OTEL_EXPORTER_OTLP_ENDPOINT tiene valor. Ese valor vive
// en el archivo .env local (ignorado por git), asi que Render no envia nada.
// Debe cargarse antes que express, http y socket.io.
var path = require('path');

// cargar .env si existe (Node >= 20.12). No reemplaza variables ya definidas.
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch (e) {
  // sin .env: la telemetria queda apagada
}

var endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '').trim();

// entorno de origen: OTEL_RESOURCE_ATTRIBUTES manda; si no, "local"
function entornoDeDespliegue() {
  var attrs = process.env.OTEL_RESOURCE_ATTRIBUTES || '';
  var match = attrs.split(',').map(function (p) { return p.trim().split('='); })
    .find(function (kv) { return kv[0] === 'deployment.environment'; });
  return (match && match[1]) || 'local';
}

var activo = false;

if (endpoint) {
  var NodeSDK = require('@opentelemetry/sdk-node').NodeSDK;
  var autoInstr = require('@opentelemetry/auto-instrumentations-node');
  var OTLPTraceExporter = require('@opentelemetry/exporter-trace-otlp-proto').OTLPTraceExporter;
  var OTLPMetricExporter = require('@opentelemetry/exporter-metrics-otlp-proto').OTLPMetricExporter;
  var OTLPLogExporter = require('@opentelemetry/exporter-logs-otlp-proto').OTLPLogExporter;
  var PeriodicExportingMetricReader = require('@opentelemetry/sdk-metrics').PeriodicExportingMetricReader;
  var BatchLogRecordProcessor = require('@opentelemetry/sdk-logs').BatchLogRecordProcessor;
  var resourceFromAttributes = require('@opentelemetry/resources').resourceFromAttributes;

  var collectorHost = new URL(endpoint).hostname;

  var sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME || 'una-chat-api',
      'deployment.environment': entornoDeDespliegue()
    }),
    // los exportadores leen endpoint, headers y protocolo del entorno
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 15000
    }),
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
    instrumentations: [
      autoInstr.getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          // no trazar el propio envio de telemetria (evita un bucle)
          ignoreOutgoingRequestHook: function (req) {
            return (req.hostname || req.host || '').indexOf(collectorHost) === 0;
          }
        },
        '@opentelemetry/instrumentation-fs': { enabled: false }
      })
    ]
  });

  sdk.start();
  activo = true;

  // enviar lo pendiente al cerrar (Ctrl+C o docker stop)
  ['SIGINT', 'SIGTERM'].forEach(function (senal) {
    process.once(senal, function () {
      sdk.shutdown().catch(function () {}).finally(function () { process.exit(0); });
    });
  });
}

module.exports = { activo: activo };
