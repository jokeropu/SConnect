import {
  Home, GraduationCap, Users, UserRound, BookOpen, School, CalendarDays,
  FileText, ClipboardList, BarChart3, CheckSquare, CalendarCheck,
  MessageSquare, Megaphone, FolderOpen, User, Settings, LogOut,
} from 'lucide-react';

export const MENU = [
  {
    title: 'MENU',
    items: [
      { icon: Home, label: 'Home', to: '/', end: true, visible: ['admin', 'teacher', 'student', 'parent'] },
      { icon: GraduationCap, label: 'Teachers', to: '/list/teachers', visible: ['admin', 'teacher'] },
      { icon: Users, label: 'Students', to: '/list/students', visible: ['admin', 'teacher'] },
      { icon: UserRound, label: 'Parents', to: '/list/parents', visible: ['admin', 'teacher'] },
      { icon: BookOpen, label: 'Subjects', to: '/list/subjects', visible: ['admin'] },
      { icon: School, label: 'Classes', to: '/list/classes', visible: ['admin', 'teacher'] },
      { icon: CalendarDays, label: 'Lessons', to: '/list/lessons', visible: ['admin', 'teacher'] },
      { icon: FileText, label: 'Exams', to: '/list/exams', visible: ['admin', 'teacher', 'student', 'parent'] },
      { icon: ClipboardList, label: 'Assignments', to: '/list/assignments', visible: ['admin', 'teacher', 'student', 'parent'] },
      { icon: BarChart3, label: 'Results', to: '/list/results', visible: ['admin', 'teacher', 'student', 'parent'] },
      { icon: CheckSquare, label: 'Attendance', to: '/list/attendance', visible: ['admin', 'teacher', 'student', 'parent'] },
      { icon: CalendarCheck, label: 'Events', to: '/list/events', visible: ['admin', 'teacher', 'student', 'parent'] },
      { icon: MessageSquare, label: 'Messages', to: '/messages', visible: ['admin', 'teacher', 'student', 'parent'] },
      { icon: Megaphone, label: 'Announcements', to: '/list/announcements', visible: ['admin', 'teacher', 'student', 'parent'] },
      { icon: FolderOpen, label: 'Materials', to: '/list/materials', visible: ['admin', 'teacher', 'student', 'parent'] },
    ],
  },
  {
    title: 'OTHER',
    items: [
      { icon: User, label: 'Profile', to: '/profile', visible: ['admin', 'teacher', 'student', 'parent'] },
      { icon: Settings, label: 'Settings', to: '/settings', visible: ['admin', 'teacher', 'student', 'parent'] },
      { icon: LogOut, label: 'Logout', to: '/logout', visible: ['admin', 'teacher', 'student', 'parent'] },
    ],
  },
];
