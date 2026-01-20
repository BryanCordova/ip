const express = require('express');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const fetch = require('node-fetch'); // ← Nueva dependencia para la API de geolocalización

const app = express();
const PORT = process.env.PORT || 3000;

// ¡CAMBIAR ESTA CONTRASEÑA POR UNA MUY SEGURA!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123';

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

// Función para obtener geolocalización por IP (usando ipapi.co - gratis hasta ~30k consultas/mes)
async function getGeoInfo(ip) {
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await response.json();

    return {
      ciudad: data.city || 'Desconocida',
      region: data.region || 'Desconocida', // Provincia o departamento
      pais: data.country_name || 'Desconocido',
      lat: data.latitude || 'N/A',
      lon: data.longitude || 'N/A',
      isp: data.org || data.asn || 'Desconocido',
      es_proxy: data.proxy || data.vpn || data.tor || data.hosting || false
    };
  } catch (error) {
    console.error('Error al obtener geolocalización:', error);
    return {
      ciudad: 'Error',
      region: 'Error',
      pais: 'Error',
      lat: 'N/A',
      lon: 'N/A',
      isp: 'Error',
      es_proxy: false
    };
  }
}

// Middleware para registrar automáticamente cada visita GET
app.use(async (req, res, next) => {
  if (req.method === 'GET') {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referer = req.headers.referer || '-';
    const fechaPeru = moment().tz('America/Lima').format('YYYY-MM-DD HH:mm:ss');

    // Obtenemos datos de geolocalización
    const geo = await getGeoInfo(ip);

    const linea = `[${fechaPeru}] - IP: ${ip}\n` +
                  `  Ciudad: ${geo.ciudad} | Región/Provincia: ${geo.region} | País: ${geo.pais}\n` +
                  `  Lat/Lon aprox: ${geo.lat}, ${geo.lon} | ISP: ${geo.isp}\n` +
                  `  User-Agent: ${userAgent} | Referer: ${referer} | Ruta: ${req.originalUrl}\n` +
                  `  ¿VPN/Proxy?: ${geo.es_proxy ? 'SÍ' : 'No'}\n` +
                  `----------------------------------------\n`;

    fs.appendFile(DATA_FILE, linea, (err) => {
      if (err) console.error('Error al guardar datos:', err);
    });
  }
  next();
});

// Endpoint protegido para descargar el archivo
app.get('/admin/download-ips', (req, res) => {
  const pass = req.query.pass;

  if (pass !== ADMIN_PASSWORD) {
    return res.status(401).send('Acceso no autorizado');
  }

  if (!fs.existsSync(DATA_FILE)) {
    return res.status(404).send('Aún no hay registros.');
  }

  res.download(DATA_FILE, `visitas_${moment().tz('America/Lima').format('YYYY-MM-DD')}.txt`);
});

// Endpoint para ver estado (días para limpieza)
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

// Limpieza automática cada 30 días
function limpiarArchivoSiEsNecesario() {
  if (fs.existsSync(DATA_FILE)) {
    const stats = fs.statSync(DATA_FILE);
    const creationDate = moment(stats.birthtime).tz('America/Lima');
    const daysDiff = moment().tz('America/Lima').diff(creationDate, 'days');

    if (daysDiff >= 30) {
      console.log(`[AUTO-CLEAN] Archivo tiene ${daysDiff} días → Eliminando`);
      fs.unlink(DATA_FILE, (err) => {
        if (err) console.error('Error al eliminar:', err);
        else console.log('[AUTO-CLEAN] Archivo eliminado correctamente');
      });
    }
  }
}

limpiarArchivoSiEsNecesario();

// Página principal
app.get('/', (req, res) => {
  res.send(`
    <h2>Servidor activo - Hora Perú: ${moment().tz('America/Lima').format('DD/MM/YYYY HH:mm:ss')}</h2>
    <p>Todas las visitas se registran automáticamente con geolocalización por IP.</p>
    <p>Descargar registros (requiere contraseña): <br>
    <code>/admin/download?pass=123</code></p>
  `);
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT} | Hora Perú: ${moment().tz('America/Lima').format('DD/MM/YYYY HH:mm:ss')}`);
});
