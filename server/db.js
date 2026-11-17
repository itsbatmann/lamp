// ---------------------------------------------------------------
// db.js — connects to MongoDB.
// Set MONGODB_URI in server/.env, for example:
//   local:  mongodb://127.0.0.1:27017/lumora
//   Atlas:  mongodb+srv://<user>:<password>@<cluster>.mongodb.net/lumora
// ---------------------------------------------------------------
import dns from 'node:dns';
import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add it to server/.env (see .env.example).');
  }

  // Atlas "mongodb+srv://" addresses need a special DNS lookup. Some networks
  // (VPNs, DNS filters, some routers) block it, giving "querySrv ECONNREFUSED".
  // Setting DNS_SERVERS=8.8.8.8,1.1.1.1 in .env makes the API use public DNS instead.
  if (process.env.DNS_SERVERS) {
    const servers = process.env.DNS_SERVERS.split(',').map((s) => s.trim());
    dns.setServers(servers);
    dns.promises.setServers(servers);
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || 'lumora', // which database to use, whatever the URI says
    serverSelectionTimeoutMS: 10000,            // give up after 10s instead of hanging
  });
  console.log(`Connected to MongoDB (database: ${mongoose.connection.name})`);
}
