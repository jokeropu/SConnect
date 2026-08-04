import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search } from 'lucide-react';
import { dashboardApi } from '../api/endpoints';
import { Modal } from '../design/Modal';
import { fullName } from '../design/cn';

const SECTIONS = [
  { key: 'users', label: 'People', to: (item) => `/users/${item._id}`, title: (item) => fullName(item), sub: (item) => item.role },
  { key: 'classes', label: 'Classes', to: () => '/list/classes', title: (item) => item.name, sub: (item) => `Grade ${item.gradeLevel}` },
  { key: 'subjects', label: 'Subjects', to: () => '/list/subjects', title: (item) => item.name, sub: (item) => item.code },
  { key: 'assignments', label: 'Assignments', to: (item) => `/assignments/${item._id}`, title: (item) => item.title, sub: () => 'Assignment' },
];

export default function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults(null);
      return undefined;
    }

    const id = setTimeout(async () => {
      try {
        setResults(await dashboardApi.search(term));
      } catch {
        setResults(null);
      }
    }, 250);

    return () => clearTimeout(id);
  }, [term]);

  const go = (path) => {
    onClose();
    navigate(path);
  };

  const empty =
    results && SECTIONS.every((section) => (results[section.key] || []).length === 0);

  return (
    <Modal open={open} onClose={onClose} title="Search" description="People, classes, subjects and assignments" width="max-w-xl">
      <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Type at least two characters..."
          className="h-10 w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {empty && <p className="py-6 text-center text-xs text-gray-400">No matches</p>}

        {results &&
          SECTIONS.map((section) => {
            const items = results[section.key] || [];
            if (items.length === 0) return null;

            return (
              <div key={section.key}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{section.label}</p>
                <div className="flex flex-col">
                  {items.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => go(section.to(item))}
                      className="flex items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-lama-purple-light"
                    >
                      <span className="font-medium text-gray-700">{section.title(item)}</span>
                      <span className="text-[11px] text-gray-400">{section.sub(item)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    </Modal>
  );
}
