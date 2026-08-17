require('dotenv').config();
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { testUri, TEST_DB, TEST_PORT } = require('./helpers');

const SUITES = [
    'quiz', 'quizHttp', 'quizSetter', 'quizResult', 'quizCsv',
    'ownership', 'classHead', 'marks', 'massAssign',
    'attendance', 'contacts', 'timetable', 'memberId'
];

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const list = only.length ? SUITES.filter((s) => only.some((o) => s.toLowerCase().includes(o.toLowerCase()))) : SUITES;

const waitForServer = async (attempts = 60) => {
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(`http://localhost:${TEST_PORT}/health`);
            if (res.ok) return true;
        } catch { /* not up yet */ }
        await new Promise((r) => setTimeout(r, 500));
    }
    return false;
};

const runSuite = (file) => new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'suites', `${file}.js`)], {
        env: { ...process.env, DB_CONNECT_STRING: testUri(), TEST_PORT: String(TEST_PORT) },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => {
        const pass = (out.match(/^PASS/gm) || []).length;
        const fail = (out.match(/^FAIL/gm) || []).length;
        resolve({ file, code, pass, fail, out });
    });
});

const run = async () => {
    const missing = list.filter((s) => !fs.existsSync(path.join(__dirname, 'suites', `${s}.js`)));
    if (missing.length) {
        console.error(`No such suite: ${missing.join(', ')}`);
        process.exit(1);
    }

    console.log(`database  ${TEST_DB}  (never the working database)`);
    console.log(`server    starting on port ${TEST_PORT}`);

    const server = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'index.js')], {
        env: { ...process.env, DB_CONNECT_STRING: testUri(), PORT: String(TEST_PORT), NODE_ENV: 'test' },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let serverLog = '';
    server.stdout.on('data', (d) => { serverLog += d; });
    server.stderr.on('data', (d) => { serverLog += d; });

    if (!await waitForServer()) {
        console.error('Server never became healthy:\n' + serverLog.split('\n').slice(-8).join('\n'));
        server.kill();
        process.exit(1);
    }
    console.log('');

    let totalPass = 0;
    let totalFail = 0;
    const failed = [];

    for (const suite of list) {
        const result = await runSuite(suite);
        totalPass += result.pass;
        totalFail += result.fail;
        const status = result.fail === 0 && result.code === 0 ? 'ok  ' : 'FAIL';
        console.log(`${status}  ${suite.padEnd(12)} ${String(result.pass).padStart(3)} passed${result.fail ? `, ${result.fail} failed` : ''}`);
        if (result.fail > 0 || result.code !== 0) {
            failed.push(suite);
            result.out.split('\n').filter((l) => l.startsWith('FAIL') || l.includes('Error')).slice(0, 6)
                .forEach((l) => console.log(`      ${l}`));
        }
    }

    server.kill();

    console.log('');
    console.log(`${totalPass} passed, ${totalFail} failed across ${list.length} suite(s)`);
    if (failed.length) console.log(`failing: ${failed.join(', ')}`);
    process.exit(failed.length ? 1 : 0);
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
