require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const main = require('../config/db');
const User = require('../models/user');

const KEEP = ['admin@gmail.com', 'admin@sconnect.local'];
const GOOGLE_ONLY = ['sohamval10@gmail.com'];
const OUT = process.argv[2];

const SYMBOLS = '#@!$%&*?+=~^';
const TAIL = 'abcdefghijkmnpqrstuvwxyz';

let seed = 84213097;
const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
};
const pick = (s) => s[Math.floor(rand() * s.length)];

const letters = (s) => String(s || '').replace(/[^A-Za-z]/g, '');

const makePassword = (first, last) => {
    const stem = letters(first).slice(0, 8) || 'User';
    const surname = letters(last);
    const initials = surname
        ? surname[0].toUpperCase() + (surname[1] || 'x').toLowerCase()
        : pick('BCDFGHJKLMNPRSTVW') + pick(TAIL);
    const digits = String(Math.floor(rand() * 90) + 10);
    let tail = '';
    for (let i = 0; i < 1 + Math.floor(rand() * 2); i++) tail += pick(TAIL);
    return `${stem.charAt(0).toUpperCase()}${stem.slice(1)}${pick(SYMBOLS)}${initials}${digits}${tail}`;
};

const run = async () => {
    await main();
    const t0 = Date.now();

    const users = await User.find({}).select('memberId firstName lastName email role').lean();
    const targets = users.filter((u) => !KEEP.includes(u.email) && !GOOGLE_ONLY.includes(u.email));

    console.log(`${users.length} accounts, ${targets.length} getting a new password`);
    console.log(`untouched: ${KEEP.filter((e) => users.some((u) => u.email === e)).join(', ')} (break-glass), ${GOOGLE_ONLY.join(', ')} (Google)`);

    const seen = new Set();
    const plain = new Map();
    for (const u of targets) {
        let candidate = makePassword(u.firstName, u.lastName);
        while (seen.has(candidate)) candidate = makePassword(u.firstName, u.lastName);
        seen.add(candidate);
        plain.set(String(u._id), candidate);
    }

    let done = 0;
    const BATCH = 40;
    for (let i = 0; i < targets.length; i += BATCH) {
        const slice = targets.slice(i, i + BATCH);
        const hashes = await Promise.all(slice.map((u) => bcrypt.hash(plain.get(String(u._id)), 10)));
        await Promise.all(slice.map((u, j) =>
            User.collection.updateOne({ _id: u._id }, { $set: { password: hashes[j] } })));
        done += slice.length;
        if (done % 200 === 0 || done === targets.length) {
            process.stdout.write(`  hashed ${done}/${targets.length}\r`);
        }
    }
    console.log('');

    if (OUT) {
        const rows = users.map((u) => ({
            id: u.memberId,
            name: `${u.firstName} ${u.lastName || ''}`.trim(),
            email: u.email,
            role: u.role,
            password: GOOGLE_ONLY.includes(u.email) ? null
                : KEEP.includes(u.email) ? (process.env.SEED_ADMIN_PASSWORD || 'Admin@12345')
                    : plain.get(String(u._id))
        }));
        fs.writeFileSync(OUT, JSON.stringify(rows));
        console.log(`wrote ${rows.length} credentials to ${OUT}`);
    }

    console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await mongoose.connection.close();
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
