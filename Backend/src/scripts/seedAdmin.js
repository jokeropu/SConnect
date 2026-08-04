require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const main = require('../config/db');
const User = require('../models/user');

const run = async () => {
    await main();

    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@sconnect.local').toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';

    const existing = await User.findOne({ email });
    if (existing) {
        console.log(`Admin already exists: ${email}`);
        await mongoose.connection.close();
        return;
    }

    await User.create({
        firstName: 'School',
        lastName: 'Admin',
        email,
        password: await bcrypt.hash(password, 10),
        role: 'admin',
        status: 'approved'
    });

    console.log('Admin created.');
    console.log(`  email:    ${email}`);
    console.log(`  password: ${password}`);
    console.log('Change this password after the first sign in.');

    await mongoose.connection.close();
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
