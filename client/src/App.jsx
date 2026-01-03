import React, { useState, useEffect } from 'react';
import Editor from './components/Editor';

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setRoomId(room);
      setJoined(true);
    }
  }, []);

  function handleJoin() {
    if (!roomId) return alert('Enter a room id');
    setJoined(true);
  }

  async function createRoom() {
    try {
      const res = await fetch('http://localhost:5000/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      setRoomId(data.roomId);
      setJoined(true);
    } catch (err) {
      console.error(err);
      alert('Failed to create room');
    }
  }

  return (
    <div className="app">
      {!joined ? (
        <div className="join">
          <h2>Join or Create a Room</h2>
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="room-id" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleJoin}>Join</button>
            <button onClick={createRoom}>Create Room</button>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: '#f5f5f5' }}>
            <strong>Room:</strong>
            <span style={{ fontFamily: 'monospace' }}>{roomId}</span>
            <button onClick={() => {
              const url = `${location.origin}/room/${roomId}/join`;
              navigator.clipboard.writeText(url).then(() => alert('Link copied')); 
            }}>Copy Link</button>
            <button onClick={() => { navigator.clipboard.writeText(`${location.origin}/r/${roomId}`); alert('Short link copied'); }}>Copy Short Link</button>
          </div>
          <Editor roomId={roomId} />
        </div>
      )}
    </div>
  );
}
