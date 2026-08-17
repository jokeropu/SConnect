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
const Counter = require('../models/counter');
const { rollNumberFor } = require('../utils/validate');

const PASSWORD = process.env.SEED_PASSWORD || 'Password@123';
const YEAR = '2026-2027';
const SECTIONS = ['A', 'B', 'C'];
const PER_SECTION = 15;
const SIBLING_RATE = 0.15;
const MY_EMAIL = 'sohamval10@gmail.com';
const MY_GRADE = 10;
const MY_SECTION = 'A';

const SUBJECTS = [
    { name: 'Mathematics', code: 'MATH' },
    { name: 'English', code: 'ENG' },
    { name: 'Science', code: 'SCI' },
    { name: 'General Knowledge', code: 'GK' },
    { name: 'Value Education', code: 'VE' },
    { name: 'Physical Education', code: 'PE' },
    { name: 'Physics', code: 'PHY' },
    { name: 'Chemistry', code: 'CHEM' },
    { name: 'Biology', code: 'BIO' },
    { name: 'Computer', code: 'COMP' },
    { name: 'History', code: 'HIST' },
    { name: 'Geography', code: 'GEO' }
];

// periods per week, per section
const JUNIOR_PLAN = { MATH: 6, ENG: 5, SCI: 5, VE: 3, GK: 3, PE: 3 };
const SENIOR_PLAN = { MATH: 6, ENG: 5, PHY: 4, CHEM: 4, BIO: 4, COMP: 3, HIST: 3, GEO: 3, PE: 3 };

// staffing: grade-owned subjects get one teacher per grade, the rest span grades
const JUNIOR_STAFF = [
    { code: 'MATH', count: 4, ownsGrade: true },
    { code: 'ENG', count: 4, ownsGrade: true },
    { code: 'SCI', count: 4, ownsGrade: true },
    { code: 'VE', count: 4, ownsGrade: true, alsoTeaches: 'GK' },
    { code: 'PE', count: 2, ownsGrade: false }
];
const SENIOR_STAFF = [
    { code: 'MATH', count: 6, ownsGrade: true },
    { code: 'ENG', count: 6, ownsGrade: true },
    { code: 'PHY', count: 4, ownsGrade: false },
    { code: 'CHEM', count: 4, ownsGrade: false },
    { code: 'BIO', count: 4, ownsGrade: false },
    { code: 'COMP', count: 3, ownsGrade: false },
    { code: 'HIST', count: 3, ownsGrade: false },
    { code: 'GEO', count: 3, ownsGrade: false },
    { code: 'PE', count: 3, ownsGrade: false }
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const SLOTS = [
    ['08:00', '08:45'], ['08:45', '09:30'], ['09:30', '10:15'],
    ['10:45', '11:30'], ['11:30', '12:15'], ['12:15', '13:00'], ['13:00', '13:45']
];
const JUNIOR_PERIODS = 5;
const SENIOR_PERIODS = 7;

const SURNAMES = ['Sharma', 'Verma', 'Iyer', 'Nair', 'Reddy', 'Bose', 'Chatterjee', 'Banerjee', 'Mukherjee',
    'Ghosh', 'Das', 'Sen', 'Dutta', 'Rao', 'Menon', 'Pillai', 'Joshi', 'Kulkarni', 'Deshpande', 'Patel',
    'Shah', 'Mehta', 'Kapoor', 'Malhotra', 'Chopra', 'Bhatia', 'Sethi', 'Khanna', 'Saxena', 'Mishra',
    'Tiwari', 'Pandey', 'Trivedi', 'Rastogi', 'Agarwal', 'Gupta', 'Singhal', 'Jain', 'Bansal', 'Goyal'];
const MALE = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan',
    'Kabir', 'Ayaan', 'Dhruv', 'Aryan', 'Rudra', 'Karthik', 'Nikhil', 'Siddharth', 'Varun', 'Aniket',
    'Manav', 'Pranav', 'Harsh', 'Tanmay', 'Yash', 'Devansh', 'Om', 'Parth', 'Shaurya', 'Neel'];
const FEMALE = ['Aadhya', 'Ananya', 'Diya', 'Ishita', 'Kavya', 'Myra', 'Sara', 'Anika', 'Navya', 'Riya',
    'Aarohi', 'Prisha', 'Siya', 'Tara', 'Meera', 'Nitya', 'Ira', 'Kiara', 'Avni', 'Shreya',
    'Trisha', 'Anvi', 'Rhea', 'Pari', 'Saanvi', 'Vanya', 'Larisa', 'Mahika', 'Aditi', 'Sanya'];

let rngState = 20260817;
const rand = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const shuffle = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const usedEmails = new Set();
const emailFor = (first, last, suffix) => {
    const base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
    let email = `${base}@${suffix}`;
    let n = 2;
    while (usedEmails.has(email)) {
        email = `${base}${n++}@${suffix}`;
    }
    usedEmails.add(email);
    return email;
};

const makePerson = (sex) => {
    const first = sex === 'male' ? pick(MALE) : pick(FEMALE);
    return { firstName: first, lastName: pick(SURNAMES), sex };
};

const run = async () => {
    await main();
    const t0 = Date.now();
    const hash = await bcrypt.hash(PASSWORD, 10);

    const existing = await User.countDocuments({ email: { $nin: [MY_EMAIL, 'admin@sconnect.local'] } });
    if (existing > 0) {
        console.log(`Refusing to run: ${existing} account(s) beyond the two reserved ones already exist.`);
        console.log('Wipe them first so the school is generated from a clean slate.');
        await mongoose.connection.close();
        process.exit(1);
    }
    (await User.find({}).select('email')).forEach((u) => usedEmails.add(u.email));

    // ---------- subjects ----------
    const subjects = {};
    for (const entry of SUBJECTS) {
        subjects[entry.code] = await Subject.create(entry);
    }
    console.log(`subjects        ${Object.keys(subjects).length}`);

    // ---------- classrooms ----------
    const classes = {};
    for (let grade = 1; grade <= 10; grade++) {
        for (const section of SECTIONS) {
            const name = `${grade}-${section}`;
            classes[name] = await Classroom.create({
                name,
                gradeLevel: grade,
                section,
                capacity: 40,
                academicYear: YEAR,
                subjects: Object.keys(grade <= 4 ? JUNIOR_PLAN : SENIOR_PLAN).map((c) => subjects[c]._id)
            });
        }
    }
    console.log(`classrooms      ${Object.keys(classes).length}`);

    // ---------- leadership ----------
    const makeUser = async (person, role, suffix, extra = {}) => User.create({
        firstName: person.firstName,
        lastName: person.lastName,
        email: emailFor(person.firstName, person.lastName, suffix),
        password: hash,
        role,
        status: 'approved',
        sex: person.sex,
        phone: `9${Math.floor(100000000 + rand() * 899999999)}`,
        address: `${Math.floor(rand() * 200) + 1}, ${pick(['MG Road', 'Park Street', 'Nehru Nagar', 'Gandhi Marg', 'Lake View'])}`,
        ...extra
    });

    const admins = [];
    for (const title of ['Principal', 'Vice Principal (Classes 1-4)', 'Vice Principal (Classes 5-10)']) {
        const person = makePerson(rand() > 0.5 ? 'male' : 'female');
        const user = await makeUser(person, 'admin', 'sconnect.local', { address: title });
        admins.push({ user, title });
    }
    console.log(`admins          ${admins.length}`);

    // ---------- teachers ----------
    // sectionTeacher[className][subjectCode] = teacher
    const sectionTeacher = {};
    Object.keys(classes).forEach((name) => { sectionTeacher[name] = {}; });
    const teachers = [];
    const teacherSubjects = new Map();
    const teacherClasses = new Map();

    const registerTeaching = (teacher, className, code) => {
        sectionTeacher[className][code] = teacher;
        if (!teacherSubjects.has(teacher._id)) teacherSubjects.set(teacher._id, new Set());
        if (!teacherClasses.has(teacher._id)) teacherClasses.set(teacher._id, new Set());
        teacherSubjects.get(teacher._id).add(String(subjects[code]._id));
        teacherClasses.get(teacher._id).add(String(classes[className]._id));
    };

    const buildTier = async (staff, grades) => {
        for (const spec of staff) {
            const pool = [];
            for (let i = 0; i < spec.count; i++) {
                const person = makePerson(rand() > 0.45 ? 'female' : 'male');
                const user = await makeUser(person, 'teacher', 'sconnect.local');
                pool.push(user);
                teachers.push(user);
            }

            if (spec.ownsGrade) {
                grades.forEach((grade, index) => {
                    const teacher = pool[index % pool.length];
                    for (const section of SECTIONS) {
                        registerTeaching(teacher, `${grade}-${section}`, spec.code);
                        if (spec.alsoTeaches) registerTeaching(teacher, `${grade}-${section}`, spec.alsoTeaches);
                    }
                });
            } else {
                // spread across grades so every grade sees at least two of them
                let i = 0;
                for (const grade of grades) {
                    for (const section of SECTIONS) {
                        registerTeaching(pool[i % pool.length], `${grade}-${section}`, spec.code);
                        i++;
                    }
                }
            }
        }
    };

    await buildTier(JUNIOR_STAFF, [1, 2, 3, 4]);
    await buildTier(SENIOR_STAFF, [5, 6, 7, 8, 9, 10]);
    console.log(`teachers        ${teachers.length}`);

    // ---------- class heads: the grade's Maths teacher supervises its 3 sections ----------
    const classHeads = [];
    for (let grade = 1; grade <= 10; grade++) {
        const head = sectionTeacher[`${grade}-A`].MATH;
        classHeads.push({ grade, teacher: head });
        for (const section of SECTIONS) {
            await Classroom.findByIdAndUpdate(classes[`${grade}-${section}`]._id, { $set: { supervisorId: head._id } });
            teacherClasses.get(head._id).add(String(classes[`${grade}-${section}`]._id));
        }
    }
    console.log(`class heads     ${classHeads.length}`);

    for (const teacher of teachers) {
        await TeacherProfile.create({
            userId: teacher._id,
            subjects: [...(teacherSubjects.get(teacher._id) || [])],
            classes: [...(teacherClasses.get(teacher._id) || [])],
            qualifications: pick(['B.Ed, M.A.', 'B.Ed, M.Sc.', 'M.Ed', 'B.Ed, M.Com', 'M.Sc, Ph.D.'])
        });
    }

    // ---------- timetable ----------
    const schedule = buildTimetable(classes, sectionTeacher, subjects);
    const lessonDocs = schedule.map((slot) => ({
        name: `${slot.subjectName} — ${slot.className}`,
        subjectId: subjects[slot.code]._id,
        classId: classes[slot.className]._id,
        teacherId: slot.teacher._id,
        day: slot.day,
        startTime: slot.start,
        endTime: slot.end,
        room: `Room ${slot.className}`
    }));
    await Lesson.insertMany(lessonDocs);
    console.log(`lessons         ${lessonDocs.length}`);

    // ---------- students ----------
    const mine = await User.findOne({ email: MY_EMAIL });
    const students = [];

    for (let grade = 1; grade <= 10; grade++) {
        for (const section of SECTIONS) {
            const className = `${grade}-${section}`;
            const isMySection = grade === MY_GRADE && section === MY_SECTION;
            const seeded = isMySection && mine ? PER_SECTION - 1 : PER_SECTION;

            for (let i = 0; i < seeded; i++) {
                const person = makePerson(i % 2 === 0 ? 'male' : 'female');
                const user = await makeUser(person, 'student', 'student.sconnect.local', {
                    birthday: new Date(2026 - (grade + 5), Math.floor(rand() * 12), Math.floor(rand() * 28) + 1)
                });
                students.push({ user, className, grade, surname: person.lastName });
            }
            if (isMySection && mine) {
                students.push({ user: mine, className, grade, surname: mine.lastName || 'Chowdhury', existing: true });
            }
        }
    }
    console.log(`students        ${students.length}`);

    // ---------- siblings, then parents ----------
    const siblingPairs = [];
    const paired = new Set();
    const shuffled = shuffle(students.map((_, i) => i));
    const wantPairs = Math.round(students.length * SIBLING_RATE / (1 + SIBLING_RATE));

    for (const a of shuffled) {
        if (siblingPairs.length >= wantPairs || paired.has(a)) continue;
        const partner = shuffled.find((b) => !paired.has(b) && b !== a && students[b].grade !== students[a].grade);
        if (partner === undefined) continue;
        paired.add(a);
        paired.add(partner);
        siblingPairs.push([a, partner]);
    }

    const groups = [
        ...siblingPairs,
        ...students.map((_, i) => i).filter((i) => !paired.has(i)).map((i) => [i])
    ];

    let parentCount = 0;
    for (const group of groups) {
        const eldest = students[group[0]];
        const person = makePerson(rand() > 0.5 ? 'male' : 'female');
        person.lastName = eldest.surname;
        const parent = await makeUser(person, 'parent', 'parent.sconnect.local', {
            address: pick(['Guardian', 'Guardian', 'Guardian'])
        });
        await ParentProfile.create({
            userId: parent._id,
            children: group.map((i) => students[i].user._id),
            occupation: pick(['Engineer', 'Doctor', 'Teacher', 'Business', 'Accountant', 'Architect', 'Civil Servant'])
        });
        for (const i of group) students[i].parent = parent;
        parentCount++;
    }
    console.log(`parents         ${parentCount}  (${siblingPairs.length} with two children)`);

    // ---------- student profiles, roll numbers alphabetical within a section ----------
    const bySection = {};
    for (const entry of students) {
        (bySection[entry.className] = bySection[entry.className] || []).push(entry);
    }
    for (const [className, list] of Object.entries(bySection)) {
        list.sort((a, b) => `${a.user.firstName} ${a.user.lastName}`.localeCompare(`${b.user.firstName} ${b.user.lastName}`));
        for (let i = 0; i < list.length; i++) {
            await StudentProfile.findOneAndUpdate(
                { userId: list[i].user._id },
                {
                    $set: {
                        classId: classes[className]._id,
                        parentId: list[i].parent?._id || null,
                        rollNumber: rollNumberFor(className, i + 1),
                        admissionDate: new Date(2026 - (list[i].grade - 1), 3, 1)
                    }
                },
                { upsert: true, setDefaultsOnInsert: true }
            );
        }
    }

    console.log('');
    console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s. Every seeded account uses: ${PASSWORD}`);
    console.log('');
    console.log('Showcase logins:');
    console.log(`  principal   ${admins[0].user.email}`);
    console.log(`  class head  ${classHeads[9].teacher.email}   (grade 10)`);
    const sample = bySection['10-A'].find((s) => !s.existing);
    console.log(`  student     ${sample.user.email}`);
    console.log(`  parent      ${sample.parent.email}`);
    if (mine) console.log(`  yours       ${MY_EMAIL}  -> student in ${MY_GRADE}-${MY_SECTION}`);

    await mongoose.connection.close();
};

// Every section must be taught in every one of its periods, and a teacher can
// only be in one room at a time. With a grade owned by one teacher per subject,
// supply equals demand exactly, so a greedy fill always strands something.
// Each period is instead a bipartite matching between sections and free
// teachers, solved with augmenting paths, which König's theorem guarantees.
// Each lesson is an edge between a section and a teacher; a timetable is a
// proper edge colouring where the colours are the week's periods. König's
// theorem says a bipartite graph needs only as many colours as its busiest
// vertex, and this is the construction: give the edge a colour free at both
// ends, or swap an alternating chain of two colours until one is.
function colourLessons(edges, colours) {
    const atSection = new Map();
    const atTeacher = new Map();
    const colourOf = new Array(edges.length).fill(-1);

    const rowFor = (map, key) => {
        if (!map.has(key)) map.set(key, new Array(colours).fill(null));
        return map.get(key);
    };
    const firstFree = (row) => row.indexOf(null);

    for (let e = 0; e < edges.length; e++) {
        const section = rowFor(atSection, edges[e].section);
        const teacher = rowFor(atTeacher, edges[e].teacher);

        const a = firstFree(section);
        const b = firstFree(teacher);
        if (a === -1 || b === -1) return null;

        if (teacher[a] === null) {
            section[a] = e; teacher[a] = e; colourOf[e] = a;
            continue;
        }
        if (section[b] === null) {
            section[b] = e; teacher[b] = e; colourOf[e] = b;
            continue;
        }

        // a is taken at the teacher and b at the section. The teacher has an
        // a-edge but no b-edge, so it sits at the end of an a/b alternating
        // chain; swapping the chain frees a there without disturbing a at the
        // section, which is where this edge then goes.
        const chain = [];
        let node = edges[e].teacher;
        let onSection = false;
        let want = a;

        while (chain.length <= colours * 2) {
            const row = onSection ? rowFor(atSection, node) : rowFor(atTeacher, node);
            const next = row[want];
            if (next === null) break;
            chain.push(next);
            node = onSection ? edges[next].teacher : edges[next].section;
            onSection = !onSection;
            want = want === a ? b : a;
        }
        if (chain.length > colours * 2) return null;

        // clear the whole chain before rewriting it: chain edges share vertices,
        // so flipping one at a time lets a later edge wipe an earlier one
        for (const idx of chain) {
            const was = colourOf[idx];
            rowFor(atSection, edges[idx].section)[was] = null;
            rowFor(atTeacher, edges[idx].teacher)[was] = null;
        }
        for (const idx of chain) {
            const now = colourOf[idx] === a ? b : a;
            colourOf[idx] = now;
            rowFor(atSection, edges[idx].section)[now] = idx;
            rowFor(atTeacher, edges[idx].teacher)[now] = idx;
        }

        if (section[a] !== null || teacher[a] !== null) return null;
        section[a] = e; teacher[a] = e; colourOf[e] = a;
    }

    return colourOf;
}

function scheduleTier(names, sectionTeacher, plan, periodsPerDay, subjects) {
    const colours = DAYS.length * periodsPerDay;

    const edges = [];
    for (const name of shuffle(names)) {
        for (const [code, count] of Object.entries(plan)) {
            for (let i = 0; i < count; i++) {
                edges.push({ section: name, teacher: String(sectionTeacher[name][code]._id), code });
            }
        }
    }

    const ordered = shuffle(edges);
    const solved = colourLessons(ordered, colours);
    if (!solved) return null;

    const placed = ordered.map((edge, i) => {
        const day = DAYS[Math.floor(solved[i] / periodsPerDay)];
        const period = solved[i] % periodsPerDay;
        return {
            className: edge.section,
            code: edge.code,
            teacher: sectionTeacher[edge.section][edge.code],
            day,
            start: SLOTS[period][0],
            end: SLOTS[period][1],
            subjectName: subjects[edge.code].name
        };
    });

    return { placed, attempt: 1 };
}

// A colouring bug would produce a timetable that looks fine per section and is
// impossible to teach, so the result is checked rather than trusted.
function assertTimetableValid(placed, classes) {
    const teacherAt = new Set();
    const sectionAt = new Set();
    const perSection = {};

    for (const slot of placed) {
        const when = `${slot.day} ${slot.start}`;
        const t = `${slot.teacher._id} ${when}`;
        const s = `${slot.className} ${when}`;

        if (teacherAt.has(t)) throw new Error(`Teacher double-booked at ${when}`);
        if (sectionAt.has(s)) throw new Error(`${slot.className} has two lessons at ${when}`);
        teacherAt.add(t);
        sectionAt.add(s);

        perSection[slot.className] = perSection[slot.className] || {};
        perSection[slot.className][slot.code] = (perSection[slot.className][slot.code] || 0) + 1;
    }

    for (const [name, counts] of Object.entries(perSection)) {
        const plan = classes[name].gradeLevel <= 4 ? JUNIOR_PLAN : SENIOR_PLAN;
        for (const [code, want] of Object.entries(plan)) {
            if (counts[code] !== want) {
                throw new Error(`${name} got ${counts[code] || 0} ${code} periods, expected ${want}`);
            }
        }
    }
}

function buildTimetable(classes, sectionTeacher, subjects) {
    const junior = Object.keys(classes).filter((n) => classes[n].gradeLevel <= 4);
    const senior = Object.keys(classes).filter((n) => classes[n].gradeLevel > 4);

    // the two tiers share no teachers, so they schedule independently
    const j = scheduleTier(junior, sectionTeacher, JUNIOR_PLAN, JUNIOR_PERIODS, subjects);
    if (!j) throw new Error('Could not build a clash-free junior timetable');
    const s = scheduleTier(senior, sectionTeacher, SENIOR_PLAN, SENIOR_PERIODS, subjects);
    if (!s) throw new Error('Could not build a clash-free senior timetable');

    const all = [...j.placed, ...s.placed];
    assertTimetableValid(all, classes);
    console.log(`timetable       ${all.length} lessons, no teacher double-booked`);
    return all;
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
