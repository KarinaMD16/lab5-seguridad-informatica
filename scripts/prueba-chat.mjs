// Prueba de la parte 2: envia mensajes correctos y un fallo controlado
// al chat local, para luego ubicarlos en Grafana Cloud.
// Uso: node scripts/prueba-chat.mjs [url]   (por defecto http://localhost:3000)
const base = process.argv[2] || 'http://localhost:3000';

async function enviar(mensaje) {
  const res = await fetch(base + '/mensajes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Prueba', mensaje, color: '#123ABC' })
  });
  return res.status;
}

console.log('Inicio de la prueba:', new Date().toLocaleString());
for (let i = 1; i <= 5; i++) {
  console.log(`Mensaje correcto ${i}:`, await enviar(`Hola UNA Chat ${i}`));
}
console.log('Fallo controlado (mensaje vacio):', await enviar(''));
console.log('Fallo controlado (mensaje vacio):', await enviar(''));
console.log('Fin de la prueba:', new Date().toLocaleString());
