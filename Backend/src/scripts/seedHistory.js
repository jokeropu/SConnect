require('dotenv').config();
const mongoose = require('mongoose');
const main = require('../config/db');

const User = require('../models/user');
const Classroom = require('../models/classroom');
const Subject = require('../models/subject');
const Lesson = require('../models/lesson');
const StudentProfile = require('../models/studentProfile');
const Attendance = require('../models/attendance');
const Exam = require('../models/exam');
const Result = require('../models/result');
const Assignment = require('../models/assignment');
const Submission = require('../models/submission');
const Quiz = require('../models/quiz');
const QuizAttempt = require('../models/quizAttempt');
const Announcement = require('../models/announcement');
const Event = require('../models/event');
const Material = require('../models/material');
const Notification = require('../models/notification');
const { scoreBreakdown } = require('../utils/gradeUtility');
const { QUIZ_RESULT_WEIGHT } = require('../config/appConfig');

const TERM_START = new Date('2026-05-18T00:00:00Z');
const SCHOOL_DAYS = 60;
const MIDTERM_WEEK = 6;
const FINAL_WEEK = 12;
const NO_EXAM = ['PE'];

let rngState = 917263541;
const rand = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const gauss = (mean, sd) => {
    const u = Math.max(rand(), 1e-9);
    const v = Math.max(rand(), 1e-9);
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const schoolDays = (count) => {
    const days = [];
    const cursor = new Date(TERM_START);
    while (days.length < count) {
        if (cursor.getUTCDay() >= 1 && cursor.getUTCDay() <= 5) days.push(new Date(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
};
const iso = (d) => d.toISOString().slice(0, 10);

const QUESTION_BANK = {
    MATH: [['What is 7 × 8?', '56'], ['Solve: 2x + 6 = 18', '6'], ['What is 15% of 200?', '30'],
        ['Area of a square of side 9?', '81'], ['What is 144 ÷ 12?', '12']],
    ENG: [['Plural of "child"?', 'children'], ['Past tense of "go"?', 'went'], ['Opposite of "ancient"?', 'modern'],
        ['A word describing a noun is a?', 'adjective'], ['Correct spelling', 'necessary']],
    SCI: [['What gas do plants absorb?', 'carbon dioxide'], ['How many legs has an insect?', '6'],
        ['What is H2O commonly called?', 'water'], ['Which organ pumps blood?', 'heart'], ['Largest planet?', 'jupiter']],
    PHY: [['Unit of force?', 'newton'], ['Speed of light in km/s?', '300000'], ['What does a voltmeter measure?', 'voltage'],
        ['Acceleration due to gravity?', '9.8'], ['Unit of power?', 'watt']],
    CHEM: [['Symbol for sodium?', 'na'], ['pH of pure water?', '7'], ['Gas released when metal meets acid?', 'hydrogen'],
        ['Atomic number of carbon?', '6'], ['Common name for NaCl?', 'salt']],
    BIO: [['Powerhouse of the cell?', 'mitochondria'], ['How many chambers has a human heart?', '4'],
        ['Green pigment in plants?', 'chlorophyll'], ['Largest human organ?', 'skin'], ['Blood cells carrying oxygen?', 'red']],
    COMP: [['What does CPU stand for?', 'central processing unit'], ['Binary of 5?', '101'],
        ['What does HTML stand for?', 'hypertext markup language'], ['1 kilobyte in bytes?', '1024'], ['Brain of the computer?', 'cpu']],
    HIST: [['Who was the first Prime Minister of India?', 'nehru'], ['In which year did India gain independence?', '1947'],
        ['Who built the Taj Mahal?', 'shah jahan'], ['The Quit India movement year?', '1942'], ['Ashoka belonged to which dynasty?', 'maurya']],
    GEO: [['Longest river in the world?', 'nile'], ['Capital of Australia?', 'canberra'],
        ['Largest ocean?', 'pacific'], ['How many continents are there?', '7'], ['Highest mountain?', 'everest']],
    GK: [['National bird of India?', 'peacock'], ['How many days in a leap year?', '366'],
        ['Currency of Japan?', 'yen'], ['How many colours in a rainbow?', '7'], ['Largest mammal?', 'blue whale']],
    VE: [['Telling the truth is called?', 'honesty'], ['Helping others in need is?', 'kindness'],
        ['Waiting calmly is?', 'patience'], ['Doing what you promised shows?', 'responsibility'], ['Treating all equally is?', 'fairness']]
};

const run = async () => {
    await main();
    const t0 = Date.now();

    if (await Attendance.countDocuments({}) > 0) {
        console.log('History already exists. Clear attendance/exams/quizzes first.');
        await mongoose.connection.close();
        process.exit(1);
    }

    const classes = await Classroom.find({}).sort({ gradeLevel: 1, section: 1 });
    const subjects = await Subject.find({});
    const byCode = {};
    subjects.forEach((s) => { byCode[s.code] = s; });
    const codeOf = {};
    subjects.forEach((s) => { codeOf[String(s._id)] = s.code; });

    if (classes.length === 0) {
        console.log('No classes found. Run seedSchool.js first.');
        await mongoose.connection.close();
        process.exit(1);
    }

    const lessons = await Lesson.find({}).select('classId subjectId teacherId');
    // who teaches what, where
    const teacherFor = {};
    for (const l of lessons) {
        teacherFor[`${l.classId}|${l.subjectId}`] = l.teacherId;
    }

    const profiles = await StudentProfile.find({}).select('userId classId');
    const roster = {};
    profiles.forEach((p) => { (roster[p.classId] = roster[p.classId] || []).push(p.userId); });

    // ---------- latent traits: what makes the data cohere ----------
    const trait = {};
    for (const p of profiles) {
        // One latent disposition feeds both attainment and attendance. Drawing
        // them independently makes a student who never turns up top the class,
        // and every screen then contradicts every other.
        const core = gauss(0, 1);
        trait[p.userId] = {
            ability: clamp(0.66 + 0.12 * core + gauss(0, 0.09), 0.22, 0.97),
            diligence: clamp(0.89 + 0.055 * core + gauss(0, 0.055), 0.45, 1),
            bias: {}
        };
        for (const s of subjects) trait[p.userId].bias[s.code] = gauss(0, 0.07);
    }
    const sectionEffect = {};
    classes.forEach((c) => { sectionEffect[c._id] = gauss(0, 0.04); });
    const difficulty = { MATH: 0.06, PHY: 0.07, CHEM: 0.08, BIO: 0.03, ENG: 0.0, SCI: 0.03,
        COMP: -0.03, HIST: 0.02, GEO: 0.02, GK: -0.05, VE: -0.08, PE: -0.1 };

    const scoreFor = (studentId, code, classId) => clamp(
        trait[studentId].ability + trait[studentId].bias[code] + sectionEffect[classId] - (difficulty[code] || 0) + gauss(0, 0.07),
        0.05, 1
    );

    const days = schoolDays(SCHOOL_DAYS);
    console.log(`term            ${iso(days[0])} to ${iso(days[days.length - 1])}, ${days.length} school days`);

    // ---------- attendance ----------
    const sheets = [];
    for (const c of classes) {
        const head = c.supervisorId;
        for (const day of days) {
            const records = roster[c._id].map((studentId) => {
                const roll = rand();
                const d = trait[studentId].diligence;
                let status = 'present';
                if (roll > d + 0.055) status = 'absent';
                else if (roll > d) status = 'late';
                else if (roll > d - 0.006) status = 'excused';
                return { studentId, status, note: status === 'excused' ? 'Informed in advance' : '' };
            });
            sheets.push({ classId: c._id, lessonId: null, date: iso(day), takenBy: head, records });
        }
    }
    await Attendance.insertMany(sheets, { ordered: false });
    console.log(`attendance      ${sheets.length} registers`);

    // ---------- exams ----------
    const examDocs = [];
    const examPlan = [];
    for (let grade = 1; grade <= 10; grade++) {
        const sections = classes.filter((c) => c.gradeLevel === grade);
        const codes = Object.keys(grade <= 4
            ? { MATH: 1, ENG: 1, SCI: 1, VE: 1, GK: 1, PE: 1 }
            : { MATH: 1, ENG: 1, PHY: 1, CHEM: 1, BIO: 1, COMP: 1, HIST: 1, GEO: 1, PE: 1 })
            .filter((code) => !NO_EXAM.includes(code));

        for (const code of codes) {
            const candidates = [...new Set(sections
                .map((c) => String(teacherFor[`${c._id}|${byCode[code]._id}`]))
                .filter(Boolean))];
            if (candidates.length === 0) continue;

            // one teacher owning the grade sets both papers; otherwise they rotate
            const midSetter = candidates[0];
            const finalSetter = candidates.length > 1 ? candidates[1 % candidates.length] : candidates[0];

            for (const [term, week, setter] of [['midterm', MIDTERM_WEEK, midSetter], ['final', FINAL_WEEK, finalSetter]]) {
                const when = days[Math.min(days.length - 1, week * 5 - 1)];
                for (const c of sections) {
                    examDocs.push({
                        title: `${byCode[code].name} — ${term === 'midterm' ? 'Mid Term' : 'Final Examination'}`,
                        subjectId: byCode[code]._id,
                        classId: c._id,
                        createdBy: setter,
                        term,
                        startTime: new Date(new Date(when).setUTCHours(9, 0)),
                        endTime: new Date(new Date(when).setUTCHours(12, 0)),
                        maxMarks: grade <= 4 ? 50 : 100,
                        passMarks: grade <= 4 ? 17 : 33,
                        room: `Hall ${c.name}`,
                        resultsPublished: true
                    });
                    examPlan.push({ code, classId: c._id, term });
                }
            }
        }
    }
    const savedExams = await Exam.insertMany(examDocs, { ordered: false });
    console.log(`exams           ${savedExams.length}  (mid term + final, one paper per grade per subject)`);

    // ---------- exam results, entered by each section's own subject teacher ----------
    const results = [];
    savedExams.forEach((exam, i) => {
        const { code, classId } = examPlan[i];
        const marker = teacherFor[`${classId}|${exam.subjectId}`];
        for (const studentId of roster[classId]) {
            const marksObtained = Math.round(scoreFor(studentId, code, classId) * exam.maxMarks);
            const { percentage, grade, points } = scoreBreakdown(marksObtained, exam.maxMarks);
            results.push({
                examId: exam._id, studentId, marksObtained, maxMarks: exam.maxMarks,
                percentage, grade, points, weight: 1, enteredBy: marker
            });
        }
    });
    for (let i = 0; i < results.length; i += 2000) {
        await Result.insertMany(results.slice(i, i + 2000), { ordered: false });
    }
    console.log(`exam results    ${results.length}`);

    // ---------- assignments and submissions ----------
    const assignmentDocs = [];
    const assignmentMeta = [];
    for (const c of classes) {
        const codes = Object.keys(byCode).filter((code) => teacherFor[`${c._id}|${byCode[code]._id}`]);
        for (const code of codes) {
            if (code === 'PE') continue;
            for (const round of [0, 1]) {
                const set = days[10 + round * 22];
                const due = days[16 + round * 22];
                assignmentDocs.push({
                    title: `${byCode[code].name} worksheet ${round + 1} — ${c.name}`,
                    description: 'Complete the exercises and submit before the due date.',
                    subjectId: byCode[code]._id,
                    classId: c._id,
                    teacherId: teacherFor[`${c._id}|${byCode[code]._id}`],
                    maxMarks: 20,
                    startDate: set,
                    dueDate: due
                });
                assignmentMeta.push({ code, classId: c._id, due });
            }
        }
    }
    const savedAssignments = await Assignment.insertMany(assignmentDocs, { ordered: false });
    console.log(`assignments     ${savedAssignments.length}`);

    const submissions = [];
    savedAssignments.forEach((assignment, i) => {
        const { code, classId, due } = assignmentMeta[i];
        for (const studentId of roster[classId]) {
            const d = trait[studentId].diligence;
            if (rand() > d + 0.04) continue;
            const late = rand() > d + 0.02;
            const marks = Math.round(scoreFor(studentId, code, classId) * assignment.maxMarks);
            submissions.push({
                assignmentId: assignment._id, studentId,
                textAnswer: 'Submitted work for review.',
                status: 'graded', marksObtained: marks,
                feedback: marks >= 16 ? 'Excellent work.' : marks >= 11 ? 'Good effort, revise the last section.' : 'Please see me to go over this.',
                gradedBy: assignment.teacherId,
                gradedAt: new Date(new Date(due).getTime() + 3 * 86400000),
                submittedAt: new Date(new Date(due).getTime() + (late ? 86400000 : -86400000))
            });
        }
    });
    for (let i = 0; i < submissions.length; i += 2000) {
        await Submission.insertMany(submissions.slice(i, i + 2000), { ordered: false });
    }
    console.log(`submissions     ${submissions.length}`);

    // ---------- quizzes: one per section per subject, set by that section's teacher ----------
    const quizDocs = [];
    const quizMeta = [];
    for (const c of classes) {
        const codes = Object.keys(QUESTION_BANK).filter((code) => teacherFor[`${c._id}|${byCode[code]?._id}`]);
        for (const code of codes) {
            const opened = days[24];
            quizDocs.push({
                title: `${byCode[code].name} quiz — ${c.name}`,
                description: 'A short check on the last few lessons.',
                subjectId: byCode[code]._id,
                classId: c._id,
                createdBy: teacherFor[`${c._id}|${byCode[code]._id}`],
                status: 'closed',
                startTime: new Date(new Date(opened).setUTCHours(9, 0)),
                endTime: new Date(new Date(opened).setUTCHours(16, 0)),
                timeLimit: 15,
                negativeMarking: false,
                questions: QUESTION_BANK[code].map(([text, answer], qi) => (
                    qi % 2 === 0
                        ? {
                            text, type: 'single', marks: 2, negativeMarks: 0,
                            options: [
                                { text: answer, isCorrect: true },
                                { text: 'None of these', isCorrect: false },
                                { text: 'Cannot be determined', isCorrect: false }
                            ]
                        }
                        : { text, type: 'text', marks: 2, negativeMarks: 0, correctAnswer: answer, options: [] }
                ))
            });
            quizMeta.push({ code, classId: c._id });
        }
    }
    const savedQuizzes = await Quiz.insertMany(quizDocs, { ordered: false });
    console.log(`quizzes         ${savedQuizzes.length}`);

    const attempts = [];
    const quizResults = [];
    savedQuizzes.forEach((quiz, i) => {
        const { code, classId } = quizMeta[i];
        for (const studentId of roster[classId]) {
            if (rand() > trait[studentId].diligence + 0.03) continue;
            const skill = scoreFor(studentId, code, classId);

            let score = 0;
            const answers = quiz.questions.map((q) => {
                const right = rand() < skill;
                const answer = { questionId: q._id, selectedOptions: [], textResponse: null, isCorrect: right, marksAwarded: right ? q.marks : 0 };
                if (q.type === 'single') {
                    const chosen = right ? q.options.find((o) => o.isCorrect) : q.options.find((o) => !o.isCorrect);
                    answer.selectedOptions = [chosen._id];
                } else {
                    answer.textResponse = right ? q.correctAnswer : 'not sure';
                }
                score += answer.marksAwarded;
                return answer;
            });

            const started = new Date(new Date(quiz.startTime).getTime() + Math.floor(rand() * 5 * 3600000));
            attempts.push({
                quizId: quiz._id, studentId, answers, score, totalMarks: quiz.totalMarks,
                status: 'submitted', startedAt: started,
                submittedAt: new Date(started.getTime() + (5 + rand() * 9) * 60000),
                timeTakenMs: Math.round((5 + rand() * 9) * 60000), autoSubmitted: false
            });

            if (!quiz.totalMarks) throw new Error(`quiz ${quiz.title} has no totalMarks`);
            const { percentage, grade, points } = scoreBreakdown(score, quiz.totalMarks);
            quizResults.push({
                quizId: quiz._id, studentId, marksObtained: score, maxMarks: quiz.totalMarks,
                percentage, grade, points, weight: QUIZ_RESULT_WEIGHT,
                remarks: `Quiz: ${quiz.title}`, enteredBy: quiz.createdBy
            });
        }
    });
    for (let i = 0; i < attempts.length; i += 1500) {
        await QuizAttempt.insertMany(attempts.slice(i, i + 1500), { ordered: false });
    }
    for (let i = 0; i < quizResults.length; i += 2000) {
        await Result.insertMany(quizResults.slice(i, i + 2000), { ordered: false });
    }
    console.log(`quiz attempts   ${attempts.length}`);

    // ---------- notices, events, materials ----------
    const principal = await User.findOne({ role: 'admin', address: 'Principal' }) || await User.findOne({ role: 'admin' });
    const notices = [
        ['Half-yearly examination schedule', 'The Mid Term timetable is on the notice board. Please check your hall allocation.', true, false],
        ['Annual Sports Day', 'Sports Day will be held on the school ground. Parents are welcome.', true, false],
        ['Library books due', 'All borrowed books must be returned before the term ends.', false, false],
        ['Fee reminder', 'The second instalment is due by the end of this month.', false, true],
        ['Parent-teacher meeting', 'Meetings are scheduled for Saturday morning. Slots are on the portal.', true, false]
    ].map(([title, body, pinned, urgent]) => ({ title, body, scope: 'global', classId: null, pinned, urgent, authorId: principal._id }));
    await Announcement.insertMany(notices);

    const events = [
        ['Mid Term Examinations', 'exam', MIDTERM_WEEK * 5 - 1],
        ['Final Examinations', 'exam', FINAL_WEEK * 5 - 1],
        ['Independence Day', 'holiday', 55],
        ['Annual Sports Day', 'sports', 40],
        ['Science Exhibition', 'cultural', 30],
        ['Parent-Teacher Meeting', 'meeting', 45]
    ].map(([title, category, dayIndex]) => {
        const when = days[Math.min(dayIndex, days.length - 1)];
        return {
            title, description: `${title} — see the notice board for details.`,
            audience: 'all', classId: null, category,
            startTime: new Date(new Date(when).setUTCHours(9, 0)),
            endTime: new Date(new Date(when).setUTCHours(15, 0)),
            createdBy: principal._id
        };
    });
    await Event.insertMany(events);

    const materials = [];
    for (const c of classes.slice(0, 12)) {
        const codes = Object.keys(byCode).filter((code) => teacherFor[`${c._id}|${byCode[code]._id}`]).slice(0, 3);
        for (const code of codes) {
            materials.push({
                title: `${byCode[code].name} notes — ${c.name}`,
                description: 'Chapter notes shared by the subject teacher.',
                subjectId: byCode[code]._id, classId: c._id,
                uploadedBy: teacherFor[`${c._id}|${byCode[code]._id}`],
                fileUrl: 'https://res.cloudinary.com/demo/raw/upload/sample-notes.pdf',
                filePublicId: null, fileType: 'application/pdf',
                downloads: Math.floor(rand() * 40)
            });
        }
    }
    await Material.insertMany(materials);
    console.log(`notices/events  ${notices.length} notices, ${events.length} events, ${materials.length} materials`);

    // ---------- a believable handful of recent notifications ----------
    const recentStudents = profiles.slice(0, 40).map((p) => p.userId);
    const notes = recentStudents.map((userId, i) => ({
        userId,
        type: i % 3 === 0 ? 'result_published' : i % 3 === 1 ? 'assignment_graded' : 'announcement_posted',
        title: i % 3 === 0 ? 'Exam result published' : i % 3 === 1 ? 'Your assignment has been graded' : 'New announcement',
        message: i % 3 === 0 ? 'Final Examination results are now available.'
            : i % 3 === 1 ? 'Your worksheet has been marked.' : 'Parent-teacher meeting scheduled for Saturday.',
        link: i % 3 === 0 ? '/list/results' : i % 3 === 1 ? '/list/assignments' : '/list/announcements',
        read: rand() > 0.6
    }));
    await Notification.insertMany(notes);
    console.log(`notifications   ${notes.length}`);

    console.log('');
    console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
    await mongoose.connection.close();
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
