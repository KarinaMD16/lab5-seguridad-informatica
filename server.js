
// npm install para descargar los paquetes...

// OpenTelemetry (Grafana, solo local) y Sentry (solo Render) deben cargarse
// antes que el resto de librerias
require('./otel');
var Sentry = require('./instrument');

// libreriuas
var validation = require('./libs/unalib');
var telemetria = require('./libs/telemetria');
// Auth0 + Supabase Vault (laboratorio 8, codigo del repo del curso)
var authGate = require('./server/auth');
var vault = require('./server/vault');
var express = require('express');
var app = express();
// Render atiende HTTPS en un proxy: necesario para las cookies seguras
app.set('trust proxy', 1);
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;


// leer el cuerpo JSON de las solicitudes (maximo 10 KB)
app.use(express.json({ limit: '10kb' }));


// root: presentar html
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

// ---------- Auth0 ----------
app.get('/auth/config', function (req, res) {
  var settings = authGate.authSettings();
  if (!settings) {
    res.json({ enabled: false });
    return;
  }
  // el Client Secret nunca sale en esta respuesta
  res.json({ enabled: true, domain: settings.domain, clientId: settings.clientId });
});

app.get('/auth/login', function (req, res) {
  if (!authGate.authSettings()) {
    res.status(404).json({ error: 'Login is disabled.' });
    return;
  }
  authGate.beginLogin(req, res);
});

app.get('/auth/callback', function (req, res) {
  if (!authGate.authSettings()) {
    res.redirect('/');
    return;
  }
  authGate.finishLogin(req, res);
});

app.get('/auth/logout', function (req, res) {
  authGate.logout(req, res);
});

// sesion actual: 401 sin cookie, nombre y correo con sesion
app.get('/sala', function (req, res) {
  if (!authGate.authSettings()) {
    res.json({ enabled: false });
    return;
  }
  authGate.readSession(req, res);
});

// con Auth0 activo, /mensajes tambien exige sesion (misma cookie)
function requerirSesion(req, res, next) {
  if (!authGate.authSettings()) return next();
  var falso = { handshake: { headers: { cookie: req.headers.cookie || '' } }, data: {} };
  authGate.authorizeSocket(falso, function (err) {
    if (err) return res.status(401).json({ error: 'Debes iniciar sesión.' });
    req.usuario = falso.data.user;
    next();
  });
}

// recibir un mensaje por HTTP: se valida con una-lib y se reenvia al chat
app.post('/mensajes', requerirSesion, function (req, res) {
  telemetria.conSpan('chat.procesar_mensaje', { 'chat.canal': 'http' }, function (span) {
    var crudo = JSON.stringify(req.body);
    if (req.usuario && req.usuario.name) {
      crudo = authGate.stampSender(crudo, req.usuario.name);
    }
    var msg = validation.validarMensaje(crudo);
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

// con Auth0 activo, solo se conectan sockets con sesion valida
io.use(function (socket, next) {
  if (!authGate.authSettings()) {
    next();
    return;
  }
  authGate.authorizeSocket(socket, next);
});

// escuchar una conexion por socket
io.on('connection', function(socket){
  // si se escucha "chat message"
  socket.on('Evento-Mensaje-Server', function(msg){
    telemetria.conSpan('chat.procesar_mensaje', { 'chat.canal': 'socket' }, function (span) {
      // el nombre sale de la sesion de Auth0, no de lo que escribe el cliente
      if (socket.data && socket.data.user && socket.data.user.name) {
        msg = authGate.stampSender(msg, socket.data.user.name);
      }
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
// leer el Client Secret desde Supabase Vault y probarlo contra Auth0
// antes de aceptar conexiones. Sin AUTH0_DOMAIN/AUTH0_CLIENT_ID, no hace nada.
function boot() {
  if (!authGate.authSettings()) return Promise.resolve();
  if (process.env.AUTH0_CLIENT_SECRET) {
    console.warn('AUTH0_CLIENT_SECRET is set and is ignored. The client secret is loaded from Supabase Vault.');
  }
  return vault.loadAuth0ClientSecret().then(function (secret) {
    return authGate.initAuth0(secret).then(function () {
      console.log('Auth0 client secret loaded from Supabase Vault (startup probe: invalid_grant, expected).');
    }).catch(function (err) {
      var message = err && err.message ? String(err.message) : '';
      if (message.indexOf('Auth0 ') === 0 && message.length < 120) throw new Error(message);
      throw new Error(vault.redact(message, secret));
    });
  });
}

if (require.main === module) {
  boot().then(function () {
    http.listen(port, function () {
      console.log('listening on *:' + port);
    });
  }).catch(function (err) {
    console.error(err && err.message ? err.message : 'Auth0 startup failed.');
    process.exit(1);
  });
}

module.exports = { app: app, http: http, io: io };

