require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const main = require('../config/db');
const User = require('../models/user');
const Classroom = require('../models/classroom');
const Subject = require('../models/subject');
const Lesson = require('../models/lesson');
const TeacherProfile = require('../models/teacherProfile');
const StudentProfile = require('../models/studentProfile');
const ParentProfile = require('../models/parentProfile');

const SUBJECTS = [
    { name: 'Mathematics', code: 'MATH' },
    { name: 'Physics', code: 'PHY' },
    { name: 'Chemistry', code: 'CHEM' },
    { name: 'Biology', code: 'BIO' },
    { name: 'English', code: 'ENG' },
    { name: 'History', code: 'HIST' },
    { name: 'Computer Science', code: 'CS' }
];

const makeUser = async (firstName, lastName, email, role) => {
    const existing = await User.findOne({ email });
    if (existing) return existing;

    return await User.create({
        firstName,
        lastName,
        email,
        password: await bcrypt.hash('Password@123', 10),
        role,
        status: 'approved',
        sex: Math.random() > 0.5 ? 'male' : 'female',
        phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
        address: 'Demo Street 12'
    });
};

const run = async () => {
    await main();

    const subjects = [];
    for (const entry of SUBJECTS) {
        const subject = await Subject.findOneAndUpdate(
            { code: entry.code },
            { $set: entry },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        subjects.push(subject);
    }

    const classes = [];
    for (let grade = 6; grade <= 10; grade++) {
        for (const section of ['A', 'B']) {
            const name = `${grade}-${section}`;
            const classroom = await Classroom.findOneAndUpdate(
                { name },
                { $set: { name, gradeLevel: grade, section, capacity: 40, academicYear: '2025-2026', subjects: subjects.map((s) => s._id) } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            classes.push(classroom);
        }
    }

    const teachers = [];
    for (let i = 1; i <= 8; i++) {
        const teacher = await makeUser(`Teacher${i}`, 'Demo', `teacher${i}@sconnect.local`, 'teacher');
        await TeacherProfile.findOneAndUpdate(
            { userId: teacher._id },
            { $set: { subjects: [subjects[i % subjects.length]._id], classes: [classes[i % classes.length]._id] } },
            { upsert: true }
        );
        teachers.push(teacher);
    }

    for (let i = 1; i <= 30; i++) {
        const student = await makeUser(`Student${i}`, 'Demo', `student${i}@sconnect.local`, 'student');
        const parent = await makeUser(`Parent${i}`, 'Demo', `parent${i}@sconnect.local`, 'parent');
        const classroom = classes[i % classes.length];

        await StudentProfile.findOneAndUpdate(
            { userId: student._id },
            { $set: { classId: classroom._id, parentId: parent._id, rollNumber: `R${1000 + i}` } },
            { upsert: true }
        );
        await ParentProfile.findOneAndUpdate(
            { userId: parent._id },
            { $addToSet: { children: student._id } },
            { upsert: true }
        );
    }

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const slots = [['09:00', '10:00'], ['10:00', '11:00'], ['11:30', '12:30'], ['13:30', '14:30']];

    for (const classroom of classes) {
        for (let d = 0; d < days.length; d++) {
            for (let s = 0; s < slots.length; s++) {
                const subject = subjects[(d + s) % subjects.length];
                const teacher = teachers[(d + s) % teachers.length];

                await Lesson.findOneAndUpdate(
                    { classId: classroom._id, day: days[d], startTime: slots[s][0] },
                    {
                        $set: {
                            name: `${subject.name} — ${classroom.name}`,
                            subjectId: subject._id,
                            classId: classroom._id,
                            teacherId: teacher._id,
                            day: days[d],
                            startTime: slots[s][0],
                            endTime: slots[s][1],
                            room: `Room ${100 + s}`
                        }
                    },
                    { upsert: true, setDefaultsOnInsert: true }
                );
            }
        }
    }

    console.log('Demo data seeded. Every demo account uses the password: Password@123');
    await mongoose.connection.close();
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
