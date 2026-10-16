import http from 'node:http';
import mongoose from 'mongoose';
import { config } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { initSocket } from './sockets/index.js';

await connectDb();
const server = http.createServer(createApp());
initSocket(server);
server.listen(config.port, () => console.log(`CivicConnect API listening on :${config.port}`));

const shutdown = () => server.close(async () => { await mongoose.disconnect(); process.exit(0); });
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
