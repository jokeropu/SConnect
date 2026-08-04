import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router';
import AppShell from '../design/AppShell';
import { EmptyState, Loader } from '../design/primitives';

export default function RequireAuth({ roles, children }) {
  const { isAuthenticated, loading, user } = useSelector((state) => state.auth);
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader label="Loading SConnect" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return (
      <AppShell>
        <EmptyState
          title="You do not have access to this page"
          detail={`This area is available to ${roles.join(', ')} accounts only.`}
        />
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
