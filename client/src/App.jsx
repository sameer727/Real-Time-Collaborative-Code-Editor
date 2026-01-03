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
        <Editor roomId={roomId} />
      )}
    </div>
  );
}
