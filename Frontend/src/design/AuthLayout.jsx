import { GraduationCap, CheckSquare, MessageSquare, BarChart3, CalendarDays } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: CalendarDays, title: 'Timetable and lessons', body: 'Every class schedule in one weekly view.' },
  { icon: CheckSquare, title: 'Attendance that adds up', body: 'Mark a register in seconds, track the percentage over the term.' },
  { icon: BarChart3, title: 'Exams, grades, report cards', body: 'Enter marks once and the grade, percentage and GPA follow.' },
  { icon: MessageSquare, title: 'Talk to the right people', body: 'Parents and students reach their own teachers, nobody else.' },
];

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
      <aside className="hidden flex-col justify-between bg-lama-purple px-11 py-11 lg:flex xl:px-14">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/80">
            <GraduationCap className="h-5 w-5 text-gray-800" strokeWidth={2} />
          </span>
          <span className="text-[19px] font-extrabold leading-none tracking-tight text-gray-900">SConnect</span>
        </div>

        <div>
          <h2 className="max-w-[14ch] text-balance font-extrabold tracking-tight text-gray-900" style={{ fontSize: 'clamp(34px, 4vw, 50px)', lineHeight: 1.06 }}>
            One school, one place.
          </h2>
          <p className="mt-5 max-w-[36ch] text-[15.5px] leading-relaxed text-gray-700">
            Admins, teachers, students and parents, each seeing exactly what they should.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, title: heading, body }) => (
              <li key={heading} className="flex items-start gap-3 text-gray-800">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/60">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[14.5px] font-semibold">{heading}</p>
                  <p className="text-[13px] text-gray-700">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-gray-700">Student and teacher management, built for schools.</p>
      </aside>

      <div className="flex flex-col items-center justify-center px-4 py-10 lg:px-10">
        <div className="w-full max-w-[26rem]">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lama-purple">
              <GraduationCap className="h-5 w-5 text-gray-800" strokeWidth={2} />
            </span>
            <span className="text-base font-extrabold text-gray-900">SConnect</span>
          </div>

          <div className="mb-6 flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="mt-6 border-t border-gray-100 pt-4 text-center text-sm">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
