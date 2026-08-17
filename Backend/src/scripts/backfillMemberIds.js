require('dotenv').config();
const mongoose = require('mongoose');
const main = require('../config/db');
const User = require('../models/user');
const Counter = require('../models/counter');
const { MEMBER_ID_PREFIX } = require('../config/appConfig');

const run = async () => {
    await main();

    const pending = await User.find({ memberId: { $in: [null, ''] } }).sort({ createdAt: 1 });

    if (pending.length === 0) {
        console.log('Every account already has a member id.');
        await mongoose.connection.close();
        return;
    }

    console.log(`Assigning ids to ${pending.length} account(s), oldest first.`);

    for (const user of pending) {
        const prefix = MEMBER_ID_PREFIX[user.role] || 'USR';
        const year = new Date(user.createdAt).getFullYear();
        const seq = await Counter.next(`member:${prefix}:${year}`);
        const memberId = `${prefix}-${year}-${String(seq).padStart(4, '0')}`;

        await User.collection.updateOne({ _id: user._id }, { $set: { memberId } });
        console.log(`  ${memberId}  ${user.email}`);
    }

    console.log('Done.');
    await mongoose.connection.close();
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
