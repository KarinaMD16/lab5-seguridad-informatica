// Ayudas de telemetria para UNA Chat: logs, una metrica propia y spans.
// Si los paquetes de OpenTelemetry no estan o la telemetria esta apagada,
// todo funciona igual: el API de OpenTelemetry no hace nada sin SDK activo.
var api = null;
var apiLogs = null;
try { api = require('@opentelemetry/api'); } catch (e) { api = null; }
try { apiLogs = require('@opentelemetry/api-logs'); } catch (e) { apiLogs = null; }

var tracer = api ? api.trace.getTracer('una-chat') : null;
// desde @opentelemetry/api 1.10 el API de logs viene incluido (api.logs);
// el paquete separado api-logs solo se usa con versiones anteriores
var logsApi = (api && api.logs) || (apiLogs && apiLogs.logs) || null;
var logger = logsApi ? logsApi.getLogger('una-chat') : null;
var contadorMensajes = api
  ? api.metrics.getMeter('una-chat').createCounter('una_chat_mensajes', {
      description: 'Mensajes procesados por el chat, por canal y resultado'
    })
  : null;

var NIVELES = {
  info: { numero: 9, consola: 'log' },
  warn: { numero: 13, consola: 'warn' },
  error: { numero: 17, consola: 'error' }
};

// escribe en consola y envia el log a Grafana (Loki). Si hay un span activo,
// el log lleva su trace_id y span_id automaticamente.
function log(nivel, texto, atributos) {
  var n = NIVELES[nivel] || NIVELES.info;
  console[n.consola]('[' + nivel + '] ' + texto, atributos ? JSON.stringify(atributos) : '');
  if (logger) {
    logger.emit({
      severityNumber: n.numero,
      severityText: nivel.toUpperCase(),
      body: texto,
      attributes: atributos || {}
    });
  }
}

// cuenta un mensaje procesado (metrica una_chat_mensajes)
function contarMensaje(canal, resultado) {
  if (contadorMensajes) {
    contadorMensajes.add(1, { canal: canal, resultado: resultado });
  }
}

// ejecuta fn dentro de un span; fn recibe el span (o null sin OpenTelemetry)
function conSpan(nombre, atributos, fn) {
  if (!tracer) {
    return fn(null);
  }
  return tracer.startActiveSpan(nombre, { attributes: atributos }, function (span) {
    try {
      return fn(span);
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: api.SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

function marcarError(span, mensaje) {
  if (span) {
    span.setStatus({ code: api.SpanStatusCode.ERROR, message: mensaje });
  }
}

module.exports = { log: log, contarMensaje: contarMensaje, conSpan: conSpan, marcarError: marcarError };
