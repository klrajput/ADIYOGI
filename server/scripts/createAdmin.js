#!/usr/bin/env node
'use strict';

/**
 * Create an admin account, or promote an existing account to admin.
 *
 * Usage (from server/):
 *   node scripts/createAdmin.js --email admin@example.com --password <secret>
 *   node scripts/createAdmin.js --email admin@example.com --password <secret> --update-password
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create:admin
 *
 * The password must be at least 10 characters. It is never echoed or logged; the script
 * prints only the account email, its role and the action performed.
 * Requires MONGODB_URI (and JWT_SECRET/SESSION_SECRET outside NODE_ENV=test).
 */
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const User = require('../src/models/User');
const { MIN_ADMIN_PASSWORD_LENGTH } = require('../src/services/seedService');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USAGE = `Usage: node scripts/createAdmin.js --email <email> --password <password> [options]

Creates an admin account, or promotes an existing account with that email to admin.
Options:
  --email <email>          Account email (falls back to ADMIN_EMAIL).
  --password <password>    Password, at least ${MIN_ADMIN_PASSWORD_LENGTH} characters (falls back to ADMIN_PASSWORD).
  --display-name <name>    Display name for a newly created account (default: Administrator).
  --update-password        Also reset the password of an existing account.
  --help, -h               Show this help.`;

/**
 * @param {string[]} argv
 * @returns {{email:string,password:string,displayName:string,updatePassword:boolean,help:boolean}}
 */
function parseArgs(argv) {
  const args = {
    email: '',
    password: '',
    displayName: '',
    updatePassword: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--update-password') {
      args.updatePassword = true;
      continue;
    }
    if (token === '--email' || token === '--password' || token === '--display-name') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`missing value for ${token}`);
      }
      index += 1;
      if (token === '--email') args.email = value;
      else if (token === '--password') args.password = value;
      else args.displayName = value;
      continue;
    }
    if (token.startsWith('--email=')) {
      args.email = token.slice('--email='.length);
      continue;
    }
    if (token.startsWith('--password=')) {
      args.password = token.slice('--password='.length);
      continue;
    }
    if (token.startsWith('--display-name=')) {
      args.displayName = token.slice('--display-name='.length);
      continue;
    }
    throw new Error(`unknown argument: ${token}`);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const email = String(args.email || env.adminEmail || '')
    .trim()
    .toLowerCase();
  const password = String(args.password || env.adminPassword || '');
  const displayName = String(args.displayName || 'Administrator').trim();

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('a valid --email (or ADMIN_EMAIL) is required');
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`--password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`);
  }
  if (displayName.length < 2 || displayName.length > 40) {
    throw new Error('--display-name must be between 2 and 40 characters');
  }

  await connectDatabase();

  const existing = await User.findOne({ email }).select('+email');
  if (existing) {
    const changes = [];
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      changes.push('promoted');
    }
    if (existing.status !== 'active') {
      existing.status = 'active';
      changes.push('reactivated');
    }
    if (existing.deletedAt) {
      existing.deletedAt = null;
      changes.push('undeleted');
    }
    if (args.updatePassword) {
      // Assigning plaintext is intentional: the User pre-save hook hashes it with bcrypt.
      existing.passwordHash = password;
      changes.push('password-updated');
    }
    if (changes.length > 0) await existing.save();

    console.log(`email: ${existing.email}`);
    console.log(`role: ${existing.role}`);
    console.log(`action: ${changes.length > 0 ? changes.join('+') : 'unchanged'}`);
    return;
  }

  const user = await User.create({
    email,
    passwordHash: password,
    role: 'admin',
    displayName,
  });
  console.log(`email: ${user.email}`);
  console.log(`role: ${user.role}`);
  console.log('action: created');
}

main()
  .catch((error) => {
    console.error(`createAdmin failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    disconnectDatabase().catch((error) => {
      console.error(`Disconnect failed: ${error.message}`);
      process.exitCode = 1;
    });
  });
