const request = require('supertest');
const ioClient = require('socket.io-client');
const { app, http, io } = require('../server');

let url;

// levantar el servidor en un puerto libre antes de las pruebas
beforeAll((done) => {
  http.listen(0, () => {
    url = 'http://localhost:' + http.address().port;
    done();
  });
});

afterAll((done) => {
    // io.close() cierra Socket.IO y tambien el servidor HTTP
    io.close(done);
});


// envia un mensaje por socket y espera lo que el servidor reenvia
function enviarPorSocket(mensaje) {
  return new Promise((resolve, reject) => {
    const cliente = ioClient(url, { forceNew: true });
    const timer = setTimeout(() => { cliente.close(); resolve(null); }, 1000);

    cliente.on('Evento-Mensaje-Server', (msg) => {
      clearTimeout(timer);
      cliente.close();
      resolve(JSON.parse(msg));
    });
    cliente.on('connect', () => {
      cliente.emit('Evento-Mensaje-Server', JSON.stringify(mensaje));
    });
    cliente.on('connect_error', reject);
  });
}

describe('rutas HTTP (Supertest)', () => {
  test('GET / devuelve la pagina del chat', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('id="messages"');
  });

  test('una ruta inexistente devuelve 404', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
  });
});

describe('servidor + una-lib (Socket.IO)', () => {
  test('una URL de imagen llega como <img>', async () => {
    const res = await enviarPorSocket({ nombre: 'Ana', mensaje: 'http://image.com/image.jpg', color: '#123ABC' });
    expect(res.mensaje).toMatch(/^<img/);
  });

  test('un video de YouTube llega como reproductor <iframe>', async () => {
    const res = await enviarPorSocket({ nombre: 'Ana', mensaje: 'https://youtu.be/qYwlqx-JLok', color: '#123ABC' });
    expect(res.mensaje).toContain('https://www.youtube.com/embed/qYwlqx-JLok');
  });

  test('el codigo malicioso se elimina antes de reenviarse', async () => {
    const res = await enviarPorSocket({ nombre: '<b>Ana</b>', mensaje: 'hola <script>alert(1)</script>', color: '#123ABC' });
    expect(res.mensaje).toBe('hola');
    expect(res.nombre).toBe('Ana');
  });

  test('un mensaje rechazado no se reenvia a nadie', async () => {
    const res = await enviarPorSocket({ nombre: 'Ana', mensaje: '<script>alert(1)</script>', color: '#123ABC' });
    expect(res).toBeNull();
  });
});
