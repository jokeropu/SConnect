import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { checkAuth } from './store/authSlice';
import { connectSocket, disconnectSocket } from './api/socket';
import RequireAuth from './routes/RequireAuth';
import { Loader } from './design/primitives';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Teachers from './pages/Teachers';
import Students from './pages/Students';
import Parents from './pages/Parents';
import Subjects from './pages/Subjects';
import Classes from './pages/Classes';
import Lessons from './pages/Lessons';
import Exams from './pages/Exams';
import Assignments from './pages/Assignments';
import AssignmentDetail from './pages/AssignmentDetail';
import Results from './pages/Results';
import ReportCard from './pages/ReportCard';
import AttendancePage from './pages/AttendancePage';
import Events from './pages/Events';
import Announcements from './pages/Announcements';
import Materials from './pages/Materials';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import UserDetail from './pages/UserDetail';
import ApprovalsPage from './pages/ApprovalsPage';

const ALL = ['admin', 'teacher', 'student', 'parent'];
const STAFF = ['admin', 'teacher'];

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
      return () => disconnectSocket();
    }
    return undefined;
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader label="Loading SConnect" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPassword />} />
      <Route path="/reset-password/:token" element={isAuthenticated ? <Navigate to="/" replace /> : <ResetPassword />} />

      <Route path="/" element={<RequireAuth roles={ALL}><Dashboard /></RequireAuth>} />
      <Route path="/list/teachers" element={<RequireAuth roles={STAFF}><Teachers /></RequireAuth>} />
      <Route path="/list/students" element={<RequireAuth roles={STAFF}><Students /></RequireAuth>} />
      <Route path="/list/parents" element={<RequireAuth roles={STAFF}><Parents /></RequireAuth>} />
      <Route path="/list/subjects" element={<RequireAuth roles={['admin']}><Subjects /></RequireAuth>} />
      <Route path="/list/classes" element={<RequireAuth roles={STAFF}><Classes /></RequireAuth>} />
      <Route path="/list/lessons" element={<RequireAuth roles={STAFF}><Lessons /></RequireAuth>} />
      <Route path="/list/exams" element={<RequireAuth roles={ALL}><Exams /></RequireAuth>} />
      <Route path="/list/assignments" element={<RequireAuth roles={ALL}><Assignments /></RequireAuth>} />
      <Route path="/assignments/:id" element={<RequireAuth roles={ALL}><AssignmentDetail /></RequireAuth>} />
      <Route path="/list/results" element={<RequireAuth roles={ALL}><Results /></RequireAuth>} />
      <Route path="/report-card" element={<RequireAuth roles={ALL}><ReportCard /></RequireAuth>} />
      <Route path="/report-card/:studentId" element={<RequireAuth roles={ALL}><ReportCard /></RequireAuth>} />
      <Route path="/list/attendance" element={<RequireAuth roles={ALL}><AttendancePage /></RequireAuth>} />
      <Route path="/list/events" element={<RequireAuth roles={ALL}><Events /></RequireAuth>} />
      <Route path="/list/announcements" element={<RequireAuth roles={ALL}><Announcements /></RequireAuth>} />
      <Route path="/list/materials" element={<RequireAuth roles={ALL}><Materials /></RequireAuth>} />
      <Route path="/messages" element={<RequireAuth roles={ALL}><Messages /></RequireAuth>} />
      <Route path="/approvals" element={<RequireAuth roles={['admin']}><ApprovalsPage /></RequireAuth>} />
      <Route path="/users/:id" element={<RequireAuth roles={['admin', 'teacher', 'parent']}><UserDetail /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth roles={ALL}><Profile /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth roles={ALL}><Settings /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
