require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const TEST_DB = process.env.TEST_DB_NAME || 'sconnect_test';
const TEST_PORT = Number(process.env.TEST_PORT || 4010);

const testUri = () => {
    const uri = process.env.DB_CONNECT_STRING;
    if (!uri) throw new Error('DB_CONNECT_STRING is not set');

    const [head, query] = uri.split('?');
    const parts = head.split('/');
    parts[parts.length - 1] = TEST_DB;
    const rebuilt = parts.join('/') + (query ? `?${query}` : '');

    if (rebuilt.includes(`/${TEST_DB}`) === false) throw new Error('Could not point the URI at a test database');
    return rebuilt;
};

const connect = async () => {
    await mongoose.connect(testUri());
    const name = mongoose.connection.name;
    if (name !== TEST_DB) throw new Error(`Refusing to run against "${name}"`);
    return mongoose;
};

const disconnect = () => mongoose.disconnect();

const BASE = `http://localhost:${TEST_PORT}/api`;
const token = (user) => jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_ACCESS_KEY, { expiresIn: '15m' });

const hit = async (method, path, user, body) => {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(user)}` },
        body: body ? JSON.stringify(body) : undefined
    });
    let json = null;
    try { json = await res.json(); } catch {}
    return { code: res.status, json };
};

const raw = async (method, path, user) => {
    const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token(user)}` } });
    const bytes = Buffer.from(await res.arrayBuffer());
    return { code: res.status, headers: res.headers, bytes, body: bytes.toString('utf8') };
};

const tag = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const rx = (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');

const reporter = () => {
    let failures = 0;
    const check = (label, actual, expected) => {
        const ok = JSON.stringify(actual) === JSON.stringify(expected);
        if (!ok) failures++;
        const detail = ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail}`);
    };
    return {
        check,
        fail: (message) => { failures++; console.log(`FAIL  ${message}`); },
        finish: (name) => {
            console.log(failures === 0 ? `\nALL ${name} CHECKS PASSED` : `\n${failures} CHECK(S) FAILED`);
            return failures;
        },
        get failures() { return failures; }
    };
};

module.exports = { testUri, connect, disconnect, BASE, TEST_DB, TEST_PORT, token, hit, raw, tag, rx, reporter };
