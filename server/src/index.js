require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { setupWSConnection } = require('y-websocket/bin/utils');
const WebSocket = require('ws');

const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());

// Serve simple static files (editor preview for E2E)
app.use(express.static(path.join(__dirname, '..', 'public')));
// Expose client node_modules as /vendor for E2E (local copies of yjs/y-websocket/y-monaco)
app.use('/vendor', express.static(path.join(__dirname, '..', '..', 'client', 'node_modules')));

const roomsRouter = require('./routes/rooms');
const persistence = require('./persistence');

// Connect to MongoDB if URI provided
if (process.env.MONGODB_URI) {
  persistence.connect(process.env.MONGODB_URI).catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
  });
}

app.use('/api/rooms', roomsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const server = http.createServer(app);

// y-websocket server (for Yjs documents)
const wss = new WebSocket.Server({ server });
wss.on('connection', (conn, req) => {
  // setupWSConnection will handle Yjs messages and document syncing
  setupWSConnection(conn, req);
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Simple request logger for debugging E2E connectivity
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} - from ${req.ip}`);
  next();
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Server listening on ${HOST}:${PORT}`);
  });
}

module.exports = { app, server }; 
