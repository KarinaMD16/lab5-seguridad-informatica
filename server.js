
// npm install para descargar los paquetes...

// OpenTelemetry (Grafana, solo local) y Sentry (solo Render) deben cargarse
// antes que el resto de librerias
require('./otel');
var Sentry = require('./instrument');

// libreriuas
var validation = require('./libs/unalib');
var telemetria = require('./libs/telemetria');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;


// leer el cuerpo JSON de las solicitudes (maximo 10 KB)
app.use(express.json({ limit: '10kb' }));


// root: presentar html
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

// recibir un mensaje por HTTP: se valida con una-lib y se reenvia al chat
app.post('/mensajes', function (req, res) {
  telemetria.conSpan('chat.procesar_mensaje', { 'chat.canal': 'http' }, function (span) {
    var msg = validation.validarMensaje(JSON.stringify(req.body));
    var obj = JSON.parse(msg);

    // mensaje vacio o rechazado por la validacion
    if (obj.mensaje === '') {
      telemetria.marcarError(span, 'mensaje rechazado');
      telemetria.contarMensaje('http', 'rechazado');
      telemetria.log('warn', 'Mensaje rechazado por la validacion', { canal: 'http', status: 400 });
      return res.status(400).json({ error: 'Mensaje rechazado por la validacion' });
    }

    io.emit('Evento-Mensaje-Server', msg);
    telemetria.contarMensaje('http', 'aceptado');
    telemetria.log('info', 'Mensaje aceptado y reenviado al chat', {
      canal: 'http', status: 201, longitud: obj.mensaje.length
    });
    res.status(201).json(obj);
  });
});



// Sentry captura los errores de Express (debe ir despues de las rutas)
if (Sentry) {
  Sentry.setupExpressErrorHandler(app);
}

// escuchar una conexion por socket
io.on('connection', function(socket){
  // si se escucha "chat message"
  socket.on('Evento-Mensaje-Server', function(msg){
    telemetria.conSpan('chat.procesar_mensaje', { 'chat.canal': 'socket' }, function (span) {
      msg = validation.validarMensaje(msg);
      var obj = JSON.parse(msg);

      // no reenviar mensajes vacios o rechazados por la validacion
      if (obj.mensaje === '') {
        telemetria.marcarError(span, 'mensaje rechazado');
        telemetria.contarMensaje('socket', 'rechazado');
        telemetria.log('warn', 'Mensaje rechazado por la validacion', { canal: 'socket' });
        return;
      }

      // volvemos a emitir el mismo mensaje
      io.emit('Evento-Mensaje-Server', msg);
      telemetria.contarMensaje('socket', 'aceptado');
      telemetria.log('info', 'Mensaje aceptado y reenviado al chat', {
        canal: 'socket', longitud: obj.mensaje.length
      });
    });
  });
});

// solo escuchar en el puerto si se ejecuta directamente (npm start),
// no cuando lo importan las pruebas
if (require.main === module) {
  http.listen(port, function () {
    console.log('listening on *:' + port);
  });
}

module.exports = { app: app, http: http, io: io };

