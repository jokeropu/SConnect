import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { Search, MessageSquare, Megaphone, GraduationCap } from 'lucide-react';
import { logoutUser } from '../store/authSlice';
import { MENU } from './menuConfig';
import { cn, fullName, ROLE_LABEL, initials } from './cn';
import NotificationBell from '../components/NotificationBell';
import GlobalSearch from '../components/GlobalSearch';

function Menu({ role, onLogout }) {
  return (
    <div className="mt-4 text-sm">
      {MENU.map((group) => (
        <div className="flex flex-col gap-2" key={group.title}>
          <span className="my-4 hidden font-light text-gray-400 lg:block">{group.title}</span>
          {group.items
            .filter((item) => item.visible.includes(role))
            .map((item) =>
              item.to === '/logout' ? (
                <button
                  key={item.label}
                  type="button"
                  onClick={onLogout}
                  className="flex items-center justify-center gap-4 rounded-md py-2 text-gray-500 transition-colors hover:bg-lama-sky-light md:px-2 lg:justify-start"
                >
                  <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  <span className="hidden lg:block">{item.label}</span>
                </button>
              ) : (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-center gap-4 rounded-md py-2 text-gray-500 transition-colors hover:bg-lama-sky-light md:px-2 lg:justify-start',
                      isActive && 'bg-lama-sky-light font-medium text-gray-800'
                    )
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  <span className="hidden lg:block">{item.label}</span>
                </NavLink>
              )
            )}
        </div>
      ))}
    </div>
  );
}

function Navbar({ user, onOpenSearch }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between p-4">
      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden items-center gap-2 rounded-full px-2 text-xs text-gray-400 ring-[1.5px] ring-gray-300 md:flex"
      >
        <Search className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="w-[200px] p-2 text-left">Search...</span>
      </button>

      <div className="flex w-full items-center justify-end gap-6">
        <button
          type="button"
          onClick={() => navigate('/messages')}
          aria-label="Messages"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white"
        >
          <MessageSquare className="h-5 w-5 text-gray-600" strokeWidth={1.75} />
        </button>

        <NotificationBell />

        <button
          type="button"
          onClick={() => navigate('/list/announcements')}
          aria-label="Announcements"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white"
        >
          <Megaphone className="h-5 w-5 text-gray-600" strokeWidth={1.75} />
        </button>

        <button type="button" onClick={() => navigate('/profile')} className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium leading-3">{fullName(user)}</span>
            <span className="text-right text-[10px] text-gray-500">{ROLE_LABEL[user?.role] || ''}</span>
          </div>
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-lama-purple text-xs font-semibold text-gray-700">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(user?.firstName, user?.lastName)
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen">
      <aside className="w-[14%] overflow-y-auto bg-white p-4 md:w-[8%] lg:w-[16%] xl:w-[14%]">
        <NavLink to="/" className="flex items-center justify-center gap-2 lg:justify-start">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lama-purple">
            <GraduationCap className="h-5 w-5 text-gray-800" strokeWidth={2} />
          </span>
          <span className="hidden font-bold lg:block">SConnect</span>
        </NavLink>
        <Menu role={user?.role} onLogout={() => dispatch(logoutUser())} />
      </aside>

      <div className="flex w-[86%] flex-col overflow-y-scroll bg-canvas md:w-[92%] lg:w-[84%] xl:w-[86%]">
        <Navbar user={user} onOpenSearch={() => setSearchOpen(true)} />
        {children}
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
