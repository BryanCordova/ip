const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Cambia esta contraseña por una segura
const ADMIN_PASSWORD = '123';

// Middleware para obtener la IP real del visitante
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip
  );
}

// Endpoint para guardar la IP
app.get('/save-ip', (req, res) => {
  const ip = getClientIp(req);
  const fecha = new Date().toISOString();
  const linea = `${fecha} - ${ip}\n`;
  fs.appendFile(path.join(__dirname, 'ips.txt'), linea, err => {
    if (err) {
      return res.status(500).json({ ok: false, error: 'No se pudo guardar la IP' });
    }
    res.json({ ok: true, ip });
  });
});

// Endpoint protegido para descargar el archivo de IPs
app.get('/admin/download-ips', (req, res) => {
  const pass = req.query.pass;
  if (pass !== ADMIN_PASSWORD) {
    return res.status(401).send('No autorizado');
  }
  const filePath = path.join(__dirname, 'ips.txt');
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('No hay IPs registradas aún.');
  }
  res.download(filePath, 'ips.txt');
});

// Página de prueba
app.get('/', (req, res) => {
  res.send('<h2>Servidor de IPs activo. Usa /save-ip para guardar la IP y /admin/download-ips?pass=TU_CONTRASEÑA para descargar.');
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
}); 