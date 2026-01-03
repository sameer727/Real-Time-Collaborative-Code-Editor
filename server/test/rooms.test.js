const request = require('supertest');
const { app } = require('../src/index');
const persistence = require('../src/persistence');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await persistence.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Rooms API', () => {
  let roomId;

  test('creates a room', async () => {
    const res = await request(app).post('/api/rooms').send({ language: 'javascript' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('roomId');
    roomId = res.body.roomId;
  });

  test('returns metadata for created room', async () => {
    const res = await request(app).get(`/api/rooms/${roomId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('language', 'javascript');
  });

  test('save and load snapshot', async () => {
    const fakeUpdate = Buffer.from('1234').toString('base64');
    const saveRes = await request(app).post(`/api/rooms/${roomId}/save`).send({ updateBase64: fakeUpdate });
    expect(saveRes.statusCode).toBe(200);
    expect(saveRes.body).toEqual({ ok: true });

    const loadRes = await request(app).get(`/api/rooms/${roomId}/load`);
    expect(loadRes.statusCode).toBe(200);
    expect(loadRes.body).toHaveProperty('updateBase64');
    expect(loadRes.body.updateBase64).toBe(fakeUpdate);
  });
});
