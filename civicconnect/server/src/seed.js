// Development seed: creates a demo organization, categories and one user per role.
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { config } from './config.js';
import { connectDb } from './db.js';
import { Organization } from './models/Organization.js';
import { Category } from './models/Category.js';
import { User } from './models/User.js';

if (config.isProd && process.env.SEED_FORCE !== 'true') { console.error('Refusing to seed in production (set SEED_FORCE=true to override).'); process.exit(1); }
await connectDb();
if (process.argv.includes('--reset')) await Promise.all([Organization, Category, User].map((m) => m.deleteMany({})));
if (await Organization.exists({ name: 'Demo City Municipal Corporation' })) { console.log('Already seeded. Use --reset to start over.'); process.exit(0); }

const org = await Organization.create({ name: 'Demo City Municipal Corporation', jurisdictions: [{ name: 'Ward A' }, { name: 'Ward B' }, { name: 'Ward C' }] });
const [a, b] = org.jurisdictions;
await Category.insertMany([
  ['Roads & potholes', '#f97316'], ['Garbage & sanitation', '#16a34a'], ['Water leakage & drainage', '#0ea5e9'],
  ['Streetlights', '#eab308'], ['Damaged public property', '#a855f7'], ['Other', '#64748b'],
].map(([name, color]) => ({ organization: org._id, name, color })));
const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD || 'Password@123', 12);
await User.insertMany([
  { name: 'Admin User', email: 'admin@demo.test', role: 'admin', organization: org._id },
  { name: 'Staff (all wards)', email: 'staff@demo.test', role: 'staff', organization: org._id, jurisdictions: [] },
  { name: 'Staff (Ward A only)', email: 'wardA@demo.test', role: 'staff', organization: org._id, jurisdictions: [a._id] },
  { name: 'Staff (Ward B only)', email: 'wardB@demo.test', role: 'staff', organization: org._id, jurisdictions: [b._id] },
  { name: 'Demo Resident', email: 'resident@demo.test', role: 'resident', organization: org._id, jurisdiction: a._id },
].map((u) => ({ ...u, passwordHash })));
console.log('Seeded. Demo logins (password: Password@123): admin@demo.test, staff@demo.test, wardA@demo.test, wardB@demo.test, resident@demo.test');
await mongoose.disconnect();
