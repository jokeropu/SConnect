require('dotenv').config();
const mongoose = require('mongoose');
const main = require('../config/db');
const User = require('../models/user');

const TO_DOMAIN = process.argv[2] || 'gmail.com';
const ROLE_ORDER = { admin: 0, teacher: 1, student: 2, parent: 3 };

const run = async () => {
    await main();

    const users = await User.find({ email: /@([a-z]+\.)?sconnect\.local$/i })
        .select('email role memberId firstName lastName')
        .lean();

    if (users.length === 0) {
        console.log('No sconnect.local addresses left to rewrite.');
        await mongoose.connection.close();
        return;
    }

    // everything already on the target domain is reserved before we start
    const taken = new Set(
        (await User.find({ email: new RegExp(`@${TO_DOMAIN.replace('.', '\\.')}$`, 'i') }).select('email').lean())
            .map((u) => u.email.toLowerCase())
    );

    users.sort((a, b) =>
        (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) || String(a.memberId).localeCompare(String(b.memberId)));

    let changed = 0;
    let deduped = 0;

    for (const user of users) {
        const local = user.email.split('@')[0];
        let candidate = `${local}@${TO_DOMAIN}`.toLowerCase();

        // three subdomains collapse into one, so a student and a parent who
        // share a name would otherwise land on the same address
        let n = 2;
        if (taken.has(candidate)) {
            while (taken.has(`${local}${n}@${TO_DOMAIN}`.toLowerCase())) n++;
            candidate = `${local}${n}@${TO_DOMAIN}`.toLowerCase();
            deduped++;
        }
        taken.add(candidate);

        // email is immutable in the schema, so this goes through the driver
        await User.collection.updateOne({ _id: user._id }, { $set: { email: candidate } });
        changed++;
    }

    const left = await User.countDocuments({ email: /sconnect\.local$/i });
    const total = await User.countDocuments({});
    const distinct = (await User.distinct('email')).length;

    console.log(`rewrote   ${changed} addresses to @${TO_DOMAIN}`);
    console.log(`deduped   ${deduped} that would have collided`);
    console.log(`remaining on sconnect.local: ${left}`);
    console.log(`unique addresses: ${distinct} of ${total} accounts ${distinct === total ? '(OK)' : '(DUPLICATES!)'}`);

    await mongoose.connection.close();
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
