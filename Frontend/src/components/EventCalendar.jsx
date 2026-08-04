import { useState } from 'react';
import Calendar from 'react-calendar';
import { MoreHorizontal } from 'lucide-react';
import { formatDate } from '../design/cn';

export default function EventCalendar({ events }) {
  const [value, setValue] = useState(new Date());

  const sameDay = (a, b) =>
    new Date(a).toDateString() === new Date(b).toDateString();

  const dayEvents = (events || []).filter((event) => sameDay(event.startTime, value));
  const shown = dayEvents.length > 0 ? dayEvents : events || [];

  return (
    <div className="rounded-md bg-white p-4">
      <Calendar onChange={setValue} value={value} />

      <div className="flex items-center justify-between">
        <h1 className="my-4 text-xl font-semibold">Events</h1>
        <MoreHorizontal className="h-5 w-5 text-gray-400" />
      </div>

      <div className="flex flex-col gap-4">
        {shown.length === 0 && <p className="text-xs text-gray-400">Nothing scheduled.</p>}

        {shown.slice(0, 5).map((event, index) => (
          <div
            key={event._id}
            className={`rounded-md border-2 border-t-4 border-gray-100 p-5 ${index % 2 === 0 ? 'border-t-lama-sky' : 'border-t-lama-purple'}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-600">{event.title}</h2>
              <span className="text-xs text-gray-300">{formatDate(event.startTime, true)}</span>
            </div>
            <p className="mt-2 text-sm text-gray-400">{event.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
