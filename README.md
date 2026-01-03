# Real-Time Collaborative Code Editor

MVP for a real-time collaborative code editor using Monaco, Yjs, and WebSockets.

Features:
- Real-time collaborative editing
- Room-based sessions
- Monaco Editor integration
- Persistent storage (MongoDB)

See `client/` and `server/` folders for implementation details.

## Local development

- Start server (will also run y-websocket on the same port):
  cd server && npm install && npm run dev

- Start client:
  cd client && npm install && npm run dev

- Run server tests:
  cd server && npm test

