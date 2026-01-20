const express = require('express');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone'); // ← Necesario para hora de Perú

const app = express();
const PORT = process.env.PORT || 3000;

// ¡CAMBIAR ESTA CONTRASEÑA POR UNA MUY SEGURA!
const ADMIN_PASSWORD = '123';

// Ruta del archivo donde se guardan los datos
const DATA_FILE = path.join(__dirname, 'ips.txt');

// Función para obtener la IP real del visitante
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

// Middleware para registrar automáticamente cada visita
app.use((req, res, next) => {
  // Solo registramos GET (puedes quitar esta condición si quieres registrar todo)
  if (req.method === 'GET') {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referer = req.headers.referer || '-';
    const fechaPeru = moment().tz('America/Lima').format('YYYY-MM-DD HH:mm:ss');

    const linea = `[${fechaPeru}] - IP: ${ip} | User-Agent: ${userAgent} | Referer: ${referer} | Ruta: ${req.originalUrl}\n`;

    fs.appendFile(DATA_FILE, linea, (err) => {
      if (err) console.error('Error al guardar datos:', err);
    });
  }
  next();
});

// Endpoint para forzar el guardado (opcional, ya que se guarda automáticamente)
app.get('/save-info', (req, res) => {
  const ip = getClientIp(req);
  res.json({ ok: true, message: 'Información registrada', ip });
});

// Endpoint protegido para descargar el archivo
app.get('/admin/download-ips', (req, res) => {
  const pass = req.query.pass;

  if (pass !== ADMIN_PASSWORD) {
    return res.status(401).send('Acceso no autorizado');
  }

  // Verificamos si el archivo existe
  if (!fs.existsSync(DATA_FILE)) {
    return res.status(404).send('Aún no hay registros.');
  }

  res.download(DATA_FILE, `visitas_${moment().tz('America/Lima').format('YYYY-MM-DD')}.txt`);
});

// Endpoint para ver cuántos días faltan para la limpieza automática
app.get('/admin/status', (req, res) => {
  const pass = req.query.pass;
  if (pass !== ADMIN_PASSWORD) {
    return res.status(401).send('No autorizado');
  }

  if (!fs.existsSync(DATA_FILE)) {
    return res.json({ message: 'No existe archivo aún' });
  }

  const stats = fs.statSync(DATA_FILE);
  const creationDate = moment(stats.birthtime).tz('America/Lima');
  const daysSinceCreation = moment().tz('America/Lima').diff(creationDate, 'days');

  const daysLeft = 30 - daysSinceCreation;

  res.json({
    archivoCreado: creationDate.format('YYYY-MM-DD HH:mm:ss'),
    diasTranscurridos: daysSinceCreation,
    diasRestantesParaLimpieza: daysLeft > 0 ? daysLeft : 0,
    proximoReset: daysLeft <= 0 ? '¡Se limpiará en la próxima visita!' : `En ${daysLeft} días`
  });
});

// Limpieza automática cada 30 días (se ejecuta al iniciar y cada visita)
function limpiarArchivoSiEsNecesario() {
  if (fs.existsSync(DATA_FILE)) {
    const stats = fs.statSync(DATA_FILE);
    const creationDate = moment(stats.birthtime).tz('America/Lima');
    const daysDiff = moment().tz('America/Lima').diff(creationDate, 'days');

    if (daysDiff >= 30) {
      console.log(`[AUTO-CLEAN] Archivo ips.txt tiene ${daysDiff} días → Se elimina`);
      fs.unlink(DATA_FILE, (err) => {
        if (err) console.error('Error al eliminar archivo:', err);
        else console.log('[AUTO-CLEAN] Archivo eliminado correctamente');
      });
    }
  }
}

// Ejecutamos la limpieza al iniciar el servidor
limpiarArchivoSiEsNecesario();

// Página principal (información)
app.get('/', (req, res) => {
  res.send(`
    <h2>Servidor activo - Hora Perú: ${moment().tz('America/Lima').format('DD/MM/YYYY HH:mm:ss')}</h2>
    <p>Todas las visitas se registran automáticamente.</p>
    <p>Descargar registros (requiere contraseña): <br>
    <code>/admin/download?pass=TU_CONTRASEÑA</code></p>
  `);
});

// Iniciamos el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT} | Hora Perú: ${moment().tz('America/Lima').format('DD/MM/YYYY HH:mm:ss')}`);
});
