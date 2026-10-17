const request = require('supertest');
const validation = require('../../libs/unalib');
const { app, http, io } = require('../../server');

// espiar validarMensaje para comprobar que el backend la llama de verdad
let espia;

beforeAll((done) => {
  http.listen(0, done);
});

beforeEach(() => {
  espia = jest.spyOn(validation, 'validarMensaje');
});

afterEach(() => {
  espia.mockRestore();
});

// cerrar Socket.IO y el servidor HTTP al terminar
afterAll((done) => {
  io.close(done);
});

// envia un mensaje a la ruta real del backend
function enviar(mensaje, nombre) {
  return request(app)
    .post('/mensajes')
    .send({ nombre: nombre || 'Ana', mensaje: mensaje, color: '#123ABC' });
}

describe('POST /mensajes', () => {

  test('URL de imagen valida: el backend acepta el mensaje', async () => {
    const res = await enviar('http://image.com/image.jpg');

    expect(espia).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(res.body.mensaje).toMatch(/^<img/);
    expect(res.body.mensaje).toContain('src="http://image.com/image.jpg"');
  });

  test('URL de video de YouTube valida: el backend acepta el mensaje', async () => {
    const res = await enviar('https://www.youtube.com/watch?v=qYwlqx-JLok');

    expect(espia).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(res.body.mensaje).toMatch(/^<iframe/);
    expect(res.body.mensaje).toContain('https://www.youtube.com/embed/qYwlqx-JLok');
  });

  test('URL de archivo de video valida: el backend acepta el mensaje', async () => {
    const res = await enviar('https://cdn.com/clip.mp4');

    expect(espia).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(res.body.mensaje).toMatch(/^<video/);
    expect(res.body.mensaje).toContain('controls');
  });

  test('URL no permitida: se devuelve contenido saneado', async () => {
    const res = await enviar('visita http://phishing.com/login');

    expect(espia).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(res.body.mensaje).toBe('visita [URL no permitida]');
  });

  test('script mezclado con texto: se elimina el codigo y queda el texto', async () => {
    const res = await enviar('hola <script>alert(1)</script>', '<b>Ana</b>');

    expect(espia).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(res.body.mensaje).toBe('hola');
    expect(res.body.nombre).toBe('Ana');
  });

  test('solo script: la validacion rechaza la entrada', async () => {
    const res = await enviar('<script>alert(1)</script>');

    expect(espia).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('imagen con onerror (inyeccion de atributos): no se acepta como imagen', async () => {
    const res = await enviar('http://x.com/a.jpg" onerror="alert(1)');

    expect(espia).toHaveBeenCalledTimes(1);
    expect(res.body.mensaje || '').not.toMatch(/<img|onerror\s*=/i);
  });

  test('mensaje sin texto: la validacion rechaza la entrada', async () => {
    const res = await request(app).post('/mensajes').send({ nombre: 'Ana' });

    expect(espia).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(400);
  });

});
