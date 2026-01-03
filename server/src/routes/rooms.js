const express = require('express');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const Room = require('../models/Room');

const router = express.Router();

// Simple in-memory fallback storage when MongoDB isn't connected
const inMemoryRooms = new Map();

function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

// Create a new room and return its id
router.post('/', async (req, res) => {
  try {
    const roomId = uuidv4();
    const payload = { roomId, language: req.body.language || 'javascript', lastModified: new Date() };

    if (isDbConnected()) {
      const room = new Room(payload);
      await room.save();
    } else {
      inMemoryRooms.set(roomId, payload);
    }

    res.json({ roomId, url: `/room/${roomId}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get room metadata
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isDbConnected()) {
      const room = await Room.findOne({ roomId: id }).select('-yjsState');
      if (!room) return res.status(404).json({ error: 'Room not found' });
      return res.json({ roomId: id, language: room.language, lastModified: room.lastModified });
    }

    const room = inMemoryRooms.get(id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Save Yjs snapshot (base64 encoded)
router.post('/:id/save', async (req, res) => {
  const { id } = req.params;
  const { updateBase64 } = req.body;
  if (!updateBase64) return res.status(400).json({ error: 'updateBase64 is required' });
  try {
    if (isDbConnected()) {
      let room = await Room.findOne({ roomId: id });
      if (!room) {
        room = new Room({ roomId: id });
      }
      room.yjsState = Buffer.from(updateBase64, 'base64');
      room.lastModified = new Date();
      await room.save();
    } else {
      const room = inMemoryRooms.get(id) || { roomId: id };
      room.yjsState = Buffer.from(updateBase64, 'base64');
      room.lastModified = new Date();
      inMemoryRooms.set(id, room);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save snapshot' });
  }
});

// Load Yjs snapshot
router.get('/:id/load', async (req, res) => {
  const { id } = req.params;
  try {
    if (isDbConnected()) {
      const room = await Room.findOne({ roomId: id });
      if (!room || !room.yjsState) return res.status(204).end();
      const updateBase64 = room.yjsState.toString('base64');
      return res.json({ updateBase64, lastModified: room.lastModified });
    }

    const room = inMemoryRooms.get(id);
    if (!room || !room.yjsState) return res.status(204).end();
    const updateBase64 = room.yjsState.toString('base64');
    res.json({ updateBase64, lastModified: room.lastModified });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load snapshot' });
  }
});

module.exports = router; 
