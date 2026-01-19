const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Render usa la variable de entorno PORT, si no existe usa el 3000
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = 'tu_password_seguro'; 
const LOG_FILE = path.join(__dirname, 'registro_ips.txt');

// Función para obtener la hora de Perú
function getPeruTime() {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(new Date());
}

function limpiarLogsAntiguos() {
  if (fs.existsSync(LOG_FILE)) {
    try {
      const stats = fs.statSync(LOG_FILE);
      const fechaArchivo = new Date(stats.birthtime);
      const ahora = new Date();
      const diferenciaDias = (ahora - fechaArchivo) / (1000 * 60 * 60 * 24);

      if (diferenciaDias >= 30) {
        fs.unlinkSync(LOG_FILE);
        console.log("Logs antiguos eliminados.");
      }
    } catch (e) {
      console.error("Error limpiando logs:", e);
    }
  }
}

app.get('/save-ip', (req, res) => {
  limpiarLogsAntiguos();
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const fecha = getPeruTime();
  const userAgent = req.headers['user-agent'] || 'Desconocido';
  
  const registro = `[${fecha}] | IP: ${ip} | SISTEMA: ${userAgent}\n`;

  fs.appendFile(LOG_FILE, registro, (err) => {
    if (err) return res.status(500).json({ error: "Error al escribir" });
    res.json({ status: "ok", ip });
  });
});

app.get('/admin/download-ips', (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(401).send('No autorizado');
  if (!fs.existsSync(LOG_FILE)) return res.status(404).send('No hay registros.');
  res.download(LOG_FILE);
});

app.get('/', (req, res) => {
  res.send('Servidor Activo');
});

// IMPORTANTE: Escuchar en 0.0.0.0 para que Render pueda conectar
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
