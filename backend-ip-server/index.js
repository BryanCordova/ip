const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = 'tu_password_seguro'; 
const LOG_FILE = path.join(__dirname, 'registro_ips.txt');

// --- FUNCIONES DE UTILIDAD ---

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress;
}

function getPeruTime() {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(new Date());
}

/**
 * Función de Limpieza Automática:
 * Verifica si el archivo existe y si su fecha de creación es mayor a 30 días.
 */
function limpiarLogsAntiguos() {
  if (fs.existsSync(LOG_FILE)) {
    const stats = fs.statSync(LOG_FILE);
    const fechaArchivo = new Date(stats.birthtime); // Fecha de creación
    const ahora = new Date();
    
    // Diferencia en milisegundos convertida a días
    const diferenciaDias = (ahora - fechaArchivo) / (1000 * 60 * 60 * 24);

    if (diferenciaDias >= 30) {
      fs.unlinkSync(LOG_FILE); // Elimina el archivo
      console.log(`[LIMPIEZA] Archivo de logs eliminado por antigüedad (30 días).`);
    }
  }
}

// --- ENDPOINTS ---

app.get('/save-ip', (req, res) => {
  // 1. Ejecutar limpieza antes de escribir
  limpiarLogsAntiguos();

  const ip = getClientIp(req);
  const fecha = getPeruTime();
  const userAgent = req.headers['user-agent'] || 'Desconocido';
  
  // Información avanzada: Referer (de dónde viene el usuario)
  const procedencia = req.headers['referer'] || 'Acceso Directo';

  const registro = `[${fecha}] | IP: ${ip} | NAVEGADOR: ${userAgent} | REF: ${procedencia}\n`;

  fs.appendFile(LOG_FILE, registro, (err) => {
    if (err) return res.status(500).send('Error de escritura');
    res.json({ status: "logged", ip });
  });
});

app.get('/admin/download-ips', (req, res) => {
  const pass = req.query.pass;
  if (pass !== ADMIN_PASSWORD) return res.status(401).send('No autorizado');

  if (!fs.existsSync(LOG_FILE)) {
    return res.status(404).send('El archivo no existe o fue rotado hace poco.');
  }

  res.download(LOG_FILE, `logs_peru_${new Date().toISOString().slice(0,10)}.txt`);
});

app.listen(PORT, () => {
  console.log(`Servidor de auditoría activo en puerto ${PORT}`);
});
