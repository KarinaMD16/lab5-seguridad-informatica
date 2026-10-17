
// npm install para descargar los paquetes...

// libreriuas
var validation = require('./libs/unalib');
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
  var msg = validation.validarMensaje(JSON.stringify(req.body));
  var obj = JSON.parse(msg);

  // mensaje vacio o rechazado por la validacion
  if (obj.mensaje === '') {
    return res.status(400).json({ error: 'Mensaje rechazado por la validacion' });
  }

  io.emit('Evento-Mensaje-Server', msg);
  res.status(201).json(obj);
});


// escuchar una conexion por socket
io.on('connection', function(socket){
  // si se escucha "chat message"
  socket.on('Evento-Mensaje-Server', function(msg){

    msg = validation.validarMensaje(msg);


    // no reenviar mensajes vacios o rechazados por la validacion
    if (JSON.parse(msg).mensaje === '') {
      return;
    }

    // volvemos a emitir el mismo mensaje
    io.emit('Evento-Mensaje-Server', msg);
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

