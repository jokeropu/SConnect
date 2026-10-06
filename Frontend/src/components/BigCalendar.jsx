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
      style={{ height: '98%' }}
      min={new Date(2025, 0, 1, 8, 0, 0)}
      max={new Date(2025, 0, 1, 17, 0, 0)}
    />
  );
}
