import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationApi } from '../api/endpoints';
import { getSocket } from '../api/socket';
import { cn, relativeTime } from '../design/cn';

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await notificationApi.list({ limit: 12 });
      setItems(data.data);
      setUnread(data.unreadCount);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onNotification = (notification) => {
      setItems((current) => [notification, ...current].slice(0, 12));
      setUnread((count) => count + 1);
    };

    socket.on('notification', onNotification);
    return () => socket.off('notification', onNotification);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const openItem = async (item) => {
    if (!item.read) {
      await notificationApi.markRead(item._id).catch(() => {});
      setItems((current) => current.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
      setUnread((count) => Math.max(0, count - 1));
    }
    setOpen(false);
    if (item.link) navigate(item.link);
  };

  const markAll = async () => {
    await notificationApi.markAllRead().catch(() => {});
    setItems((current) => current.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white"
      >
        <Bell className="h-5 w-5 text-gray-600" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -right-3 -top-3 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-[10px] text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="anim-pop absolute right-0 top-10 z-40 w-80 overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-gray-200">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-xs font-semibold text-gray-600">Notifications</span>
            <button type="button" onClick={markAll} className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline">
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-gray-400">Nothing yet</p>
            ) : (
              items.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 border-b border-gray-50 px-3 py-2.5 text-left transition-colors hover:bg-lama-purple-light',
                    !item.read && 'bg-lama-sky-light'
                  )}
                >
                  <span className="text-xs font-semibold text-gray-800">{item.title}</span>
                  <span className="line-clamp-2 text-[11px] text-gray-500">{item.message}</span>
                  <span className="text-[10px] text-gray-400">{relativeTime(item.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
