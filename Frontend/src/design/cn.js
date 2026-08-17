import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));

export const initials = (first, last) =>
  `${(first || '?')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();

export const fullName = (user) =>
  user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '—';

export const ownsRecord = (user, owner) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return String(owner?._id || owner) === String(user._id);
};

export const rollPosition = (rollNumber) => (rollNumber ? String(rollNumber).split('-').pop() : null);

export const ROLE_LABEL = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
};

export const STATUS_TONE = {
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', className: 'bg-lama-yellow-light text-yellow-700' },
  suspended: { label: 'Suspended', className: 'bg-red-100 text-red-700' },
};

export const GRADE_TONE = {
  'A+': 'text-green-600',
  A: 'text-green-600',
  B: 'text-lime-600',
  C: 'text-yellow-600',
  D: 'text-orange-600',
  E: 'text-orange-700',
  F: 'text-red-600',
};

export const ATTENDANCE_TONE = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  late: 'bg-lama-yellow-light text-yellow-700',
  excused: 'bg-lama-sky-light text-sky-700',
};

export const formatDate = (value, withTime = false) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const options = withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' };
  return date.toLocaleString(undefined, options);
};

export const relativeTime = (value) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
};
