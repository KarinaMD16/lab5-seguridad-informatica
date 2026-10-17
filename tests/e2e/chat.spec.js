// @ts-check
const { test, expect } = require('@playwright/test');

// medios de prueba estables (ejemplos oficiales de MDN, licencia libre)
const URL_IMAGEN = 'https://developer.mozilla.org/shared-assets/images/examples/grapefruit-slice.jpg';
const URL_VIDEO = 'https://developer.mozilla.org/shared-assets/videos/flower.mp4';

// script del paso 2 (intento de inyeccion)
const SCRIPT = '<script>alert("XSS")</script>';
const SCRIPT_IMG = 'hola <img src=x onerror=alert("XSS")>';

// el chat es compartido entre pestanas: cada prueba usa un nombre unico
// para encontrar solo sus propios mensajes
function nombreUnico(testInfo) {
  return 'e2e' + testInfo.workerIndex + Date.now();
}

// escribe nombre y mensaje en el formulario y pulsa "Send"
async function enviarMensaje(page, nombre, mensaje) {
  await page.getByRole('textbox', { name: 'Username' }).fill(nombre);
  await page.getByRole('textbox', { name: /Escriba un mensaje/ }).fill(mensaje);
  await page.getByRole('button', { name: 'Send' }).click();
}

// el <li> del chat que contiene el nombre del usuario de la prueba
function mensajeDe(page, nombre) {
  return page.getByRole('listitem').filter({ hasText: nombre });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Chat Socket.IO UNA');
});

test('enviar una URL de imagen muestra la imagen y termina de cargar', async ({ page }, testInfo) => {
  const nombre = nombreUnico(testInfo);

  await enviarMensaje(page, nombre, URL_IMAGEN);

  // el backend devolvio el mensaje y el frontend inserto la imagen
  const imagen = mensajeDe(page, nombre).getByRole('img');
  await expect(imagen).toBeVisible();
  await expect(imagen).toHaveAttribute('src', URL_IMAGEN);

  // la imagen termino de cargar (complete y con ancho real)
  await expect.poll(() => imagen.evaluate((img) => img.complete && img.naturalWidth), {
    message: 'la imagen deberia terminar de cargar',
    timeout: 15000,
  }).toBeGreaterThan(0);
});

test('enviar una URL de video muestra el reproductor y carga el contenido', async ({ page }, testInfo) => {
  const nombre = nombreUnico(testInfo);

  await enviarMensaje(page, nombre, URL_VIDEO);

  // el backend devolvio el mensaje y el frontend inserto el reproductor
  const video = mensajeDe(page, nombre).locator('video');
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute('src', URL_VIDEO);
  await expect(video).toHaveAttribute('controls', '');

  // el video cargo sus datos (readyState >= 2: HAVE_CURRENT_DATA) y tiene duracion
  await expect.poll(() => video.evaluate((v) => v.readyState), {
    message: 'el video deberia cargar su contenido',
    timeout: 20000,
  }).toBeGreaterThanOrEqual(2);
  expect(await video.evaluate((v) => v.duration)).toBeGreaterThan(0);
});

test('enviar solo un script: no se ejecuta y el backend lo rechaza', async ({ page }, testInfo) => {
  const nombre = nombreUnico(testInfo);

  // registrar el detector de alert ANTES de enviar
  const dialogos = [];
  page.on('dialog', async (dialog) => {
    dialogos.push(dialog.message());
    await dialog.dismiss();
  });

  await enviarMensaje(page, nombre, SCRIPT);

  // enviar un mensaje normal despues: cuando aparece, el script ya fue procesado
  await enviarMensaje(page, nombre, 'mensaje de control');
  await expect(mensajeDe(page, nombre)).toHaveText(nombre + ': mensaje de control');

  // el script fue rechazado: solo existe el mensaje de control
  await expect(mensajeDe(page, nombre)).toHaveCount(1);
  await expect(page.locator('#messages script')).toHaveCount(0);
  expect(dialogos, 'no deberia ejecutarse ningun alert').toEqual([]);
});

test('enviar un script mezclado con texto: no se ejecuta y el mensaje se sanea', async ({ page }, testInfo) => {
  const nombre = nombreUnico(testInfo);

  // registrar el detector de alert ANTES de enviar
  const dialogos = [];
  page.on('dialog', async (dialog) => {
    dialogos.push(dialog.message());
    await dialog.dismiss();
  });

  await enviarMensaje(page, nombre, SCRIPT_IMG);

  // el mensaje llega saneado: solo queda el texto, sin la etiqueta <img>
  const mensaje = mensajeDe(page, nombre);
  await expect(mensaje).toHaveText(nombre + ': hola');
  await expect(mensaje.locator('img')).toHaveCount(0);

  // esperar un momento por si el onerror intentara ejecutarse
  await page.waitForTimeout(1000);
  expect(dialogos, 'no deberia ejecutarse ningun alert').toEqual([]);
});
