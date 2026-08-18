import { forwardRef } from 'react';
import { Search, ChevronDown, Inbox, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { cn } from './cn';

const BTN_TONE = {
  primary: 'bg-lama-purple text-gray-800 hover:brightness-95',
  sky: 'bg-lama-sky text-gray-800 hover:brightness-95',
  yellow: 'bg-lama-yellow text-gray-800 hover:brightness-95',
  outline: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
  quiet: 'bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800',
  danger: 'bg-red-500 text-white hover:brightness-95',
};

const BTN_SIZE = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-sm gap-2',
};

export const Button = forwardRef(function Button(
  { className, tone = 'primary', size = 'md', loading, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-all',
        'select-none whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none',
        BTN_SIZE[size],
        BTN_TONE[tone],
        className
      )}
      {...props}
    >
      {loading ? 'Working…' : children}
    </button>
  );
});

export const RoundIcon = ({ icon: Icon, tone = 'sky', label, className, ...props }) => {
  const bg = tone === 'purple' ? 'bg-lama-purple' : tone === 'yellow' ? 'bg-lama-yellow' : 'bg-lama-sky';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105', bg, className)}
      {...props}
    >
      <Icon className="h-3.5 w-3.5 text-gray-700" strokeWidth={2} />
    </button>
  );
};

export const Card = ({ className, children, ...props }) => (
  <div className={cn('rounded-lg bg-white p-4', className)} {...props}>
    {children}
  </div>
);

export const CardHead = ({ title, right, className }) => (
  <div className={cn('flex items-center justify-between', className)}>
    <h2 className="text-lg font-semibold">{title}</h2>
    {right}
  </div>
);

export const Chip = ({ children, className }) => (
  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', className)}>
    {children}
  </span>
);

const fieldBase =
  'w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 ' +
  'outline-none transition-colors focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400';

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(fieldBase, 'h-10', invalid && 'border-red-400', className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(fieldBase, 'resize-y py-2.5', invalid && 'border-red-400', className)}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, children, invalid, ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        className={cn(fieldBase, 'h-10 cursor-pointer appearance-none pr-8', invalid && 'border-red-400')}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
    </div>
  );
});

export const FormRow = ({ label, hint, error, required, children, className }) => (
  <div className={cn('flex w-full flex-col gap-1.5', className)}>
    {label && (
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-gray-500">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </span>
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
      </div>
    )}
    {children}
    {error && <span className="text-xs text-red-500">{error}</span>}
  </div>
);

const NOTE_TONE = {
  error: 'border-red-300 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-700',
  warning: 'border-yellow-200 bg-lama-yellow-light text-yellow-800',
  info: 'border-indigo-200 bg-lama-purple-light text-indigo-700',
};

const NOTE_ICON = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

export const Note = ({ tone = 'info', children, className }) => {
  const Icon = NOTE_ICON[tone] || Info;
  return (
    <div
      className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-xs', NOTE_TONE[tone], className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

export const Loader = ({ label = 'Loading', className }) => (
  <div className={cn('flex flex-col items-center gap-3 py-16', className)}>
    <div className="loading-bar h-[3px] w-40 bg-gray-100" role="progressbar" aria-label={label} />
    <span className="text-xs font-medium text-gray-400">{label}</span>
  </div>
);

export const EmptyState = ({ title, detail, action, className }) => (
  <div className={cn('flex flex-col items-center gap-3 px-6 py-16 text-center', className)}>
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lama-purple-light">
      <Inbox className="h-5 w-5 text-indigo-400" strokeWidth={1.75} />
    </div>
    <div className="flex flex-col gap-1">
      <p className="font-semibold text-gray-700">{title}</p>
      {detail && <p className="max-w-sm text-xs text-gray-400">{detail}</p>}
    </div>
    {action}
  </div>
);

export const TableSearch = ({ value, onChange, placeholder = 'Search...' }) => (
  <div className="flex w-full items-center gap-2 rounded-full px-2 text-xs ring-[1.5px] ring-gray-300 md:w-auto">
    <Search className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent p-2 outline-none md:w-[200px]"
    />
  </div>
);

export const Table = ({ columns, renderRow, data }) => (
  <div className="w-full overflow-x-auto">
    <table className="mt-4 w-full">
      <thead>
        <tr className="text-left text-sm text-gray-500">
          {columns.map((col) => (
            <th key={col.accessor} className={cn('px-2 py-2 font-medium', col.className)}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{data.map((item) => renderRow(item))}</tbody>
    </table>
  </div>
);

export const Row = ({ children, className, ...props }) => (
  <tr
    className={cn('border-b border-gray-200 text-sm even:bg-slate-50 hover:bg-lama-purple-light', className)}
    {...props}
  >
    {children}
  </tr>
);

export const Pagination = ({ page, totalPages, total, onChange }) => {
  if (!totalPages || totalPages <= 1) {
    return <p className="p-4 text-xs text-gray-400">{total ?? 0} record(s)</p>;
  }

  const pages = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let i = start; i < start + 5 && i <= totalPages; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between p-4 text-gray-500">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-md bg-slate-200 px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        Prev
      </button>
      <div className="flex items-center gap-2 text-sm">
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn('rounded-sm px-2 text-xs', p === page && 'bg-lama-sky font-semibold')}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-md bg-slate-200 px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
};

export const Avatar = ({ src, name, size = 40, className }) => (
  <span
    className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-lama-purple text-xs font-semibold text-gray-700', className)}
    style={{ width: size, height: size }}
  >
    {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (name || '?').slice(0, 2).toUpperCase()}
  </span>
);

export const PageCard = ({ title, search, actions, children, footer }) => (
  <div className="m-4 mt-0 flex-1 rounded-md bg-white p-4">
    <div className="flex items-center justify-between">
      <h1 className="hidden text-lg font-semibold md:block">{title}</h1>
      <div className="flex w-full flex-col items-center gap-4 md:w-auto md:flex-row">
        {search}
        {actions && <div className="flex items-center gap-4 self-end">{actions}</div>}
      </div>
    </div>
    {children}
    {footer}
  </div>
);
