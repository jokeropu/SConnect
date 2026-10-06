import { useMemo, useState } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';

const localizer = momentLocalizer(moment);

const DAY_INDEX = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const toDate = (day, time) => {
  const [hours, minutes] = String(time || '09:00').split(':').map(Number);
  const base = moment().startOf('week').add(DAY_INDEX[day] ?? 1, 'days');
  return base.hour(hours).minute(minutes).second(0).toDate();
};

function LessonEvent({ event }) {
  const time = `${moment(event.start).format('h:mm')}–${moment(event.end).format('h:mm A')}`;
  return (
    <>
      <span className="lesson-event__meta">
        {time}
        {event.room ? ` · ${event.room}` : ''}
      </span>
      <span className="lesson-event__subject">{event.subject}</span>
    </>
  );
}

const components = { event: LessonEvent };

const toMinutes = (time) => {
  const [hours, minutes] = String(time || '09:00').split(':').map(Number);
  return hours * 60 + minutes;
};

const atMinutes = (total) => new Date(2025, 0, 1, Math.floor(total / 60), total % 60, 0);

export default function BigCalendar({ lessons }) {
  const [view, setView] = useState(Views.WORK_WEEK);

  const events = useMemo(
    () =>
      (lessons || []).map((lesson) => ({
        id: lesson._id,
        title: `${lesson.subjectId?.name || lesson.name}${lesson.room ? ` · ${lesson.room}` : ''}`,
        subject: lesson.subjectId?.name || lesson.name,
        room: lesson.room,
        start: toDate(lesson.day, lesson.startTime),
        end: toDate(lesson.day, lesson.endTime),
      })),
    [lessons]
  );

  const grid = useMemo(() => {
    const boundaries = new Set();
    for (const lesson of lessons || []) {
      boundaries.add(toMinutes(lesson.startTime));
      boundaries.add(toMinutes(lesson.endTime));
    }
    if (boundaries.size === 0) {
      for (let hour = 8; hour <= 17; hour++) boundaries.add(hour * 60);
    }
    const sorted = [...boundaries].sort((a, b) => a - b);
    const isBoundary = (date) => boundaries.has(date.getHours() * 60 + date.getMinutes());

    return {
      min: atMinutes(sorted[0]),
      max: atMinutes(sorted[sorted.length - 1]),
      slotPropGetter: (date) => (isBoundary(date) ? { className: 'rbc-period-start' } : {}),
      endLabel: `"${moment(atMinutes(sorted[sorted.length - 1])).format('h:mm A')}"`,
      formats: { timeGutterFormat: (date) => (isBoundary(date) ? moment(date).format('h:mm A') : '') },
    };
  }, [lessons]);

  return (
    <Calendar
      localizer={localizer}
      events={events}
      components={components}
      startAccessor="start"
      endAccessor="end"
      views={['work_week', 'day']}
      view={view}
      onView={setView}
      style={{ height: '98%', '--rbc-end-label': grid.endLabel }}
      step={15}
      timeslots={1}
      min={grid.min}
      max={grid.max}
      slotPropGetter={grid.slotPropGetter}
      formats={grid.formats}
    />
  );
}
