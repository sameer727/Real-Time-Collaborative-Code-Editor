const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  title: { type: String },
  language: { type: String, default: 'javascript' },
  yjsState: { type: Buffer },
  lastModified: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', RoomSchema);
