import { Pin } from 'lucide-react';
import { formatDate } from '../design/cn';

const TONES = ['bg-lama-sky-light', 'bg-lama-purple-light', 'bg-lama-yellow-light'];

export default function AnnouncementsPanel({ announcements }) {
  return (
    <div className="rounded-md bg-white p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Announcements</h1>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {(!announcements || announcements.length === 0) && (
          <p className="text-xs text-gray-400">No announcements yet.</p>
        )}

        {(announcements || []).slice(0, 4).map((item, index) => (
          <div key={item._id} className={`rounded-md p-4 ${TONES[index % TONES.length]}`}>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 font-medium">
                {item.pinned && <Pin className="h-3.5 w-3.5 text-gray-500" />}
                {item.title}
              </h2>
              <span className="rounded-md bg-white px-1 py-1 text-xs text-gray-400">{formatDate(item.createdAt)}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-gray-400">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
