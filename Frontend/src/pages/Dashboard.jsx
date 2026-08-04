import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useSelector } from 'react-redux';
import { dashboardApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { Loader, Note, Card } from '../design/primitives';
import { formatDate } from '../design/cn';
import UserCard from '../components/UserCard';
import CountChart from '../components/CountChart';
import AttendanceChart from '../components/AttendanceChart';
import GradeChart from '../components/GradeChart';
import EventCalendar from '../components/EventCalendar';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
import BigCalendar from '../components/BigCalendar';

function AdminView({ data }) {
  return (
    <div className="flex flex-col gap-4 p-4 md:flex-row">
      <div className="flex w-full flex-col gap-8 lg:w-2/3">
        <div className="flex flex-wrap justify-between gap-4">
          <UserCard type="students" count={data.counts.students} />
          <UserCard type="teachers" count={data.counts.teachers} tone="teachers" />
          <UserCard type="parents" count={data.counts.parents} />
          <UserCard type="staff" count={data.counts.admins} tone="staff" />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="h-[450px] w-full lg:w-1/3">
            <CountChart gender={data.gender} />
          </div>
          <div className="h-[450px] w-full lg:w-2/3">
            <AttendanceChart data={data.attendance} />
          </div>
        </div>

        <div className="h-[400px] w-full">
          <GradeChart data={data.grades} />
        </div>

        {data.counts.pending > 0 && (
          <Card>
            <Note tone="warning">
              {data.counts.pending} account(s) are waiting for approval.{' '}
              <Link to="/approvals" className="font-semibold underline">
                Review them
              </Link>
            </Note>
          </Card>
        )}
      </div>

      <div className="flex w-full flex-col gap-8 lg:w-1/3">
        <EventCalendar events={data.events} />
        <AnnouncementsPanel announcements={data.announcements} />
      </div>
    </div>
  );
}

function TeacherView({ data }) {
  return (
    <div className="flex flex-col gap-4 p-4 md:flex-row">
      <div className="flex w-full flex-col gap-8 lg:w-2/3">
        <div className="flex flex-wrap justify-between gap-4">
          <UserCard type="classes" count={data.counts.classes} tone="teachers" />
          <UserCard type="students" count={data.counts.students} />
          <UserCard type="lessons" count={data.counts.lessons} tone="staff" />
          <UserCard type="to grade" count={data.counts.ungraded} />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="h-[450px] w-full lg:w-1/3">
            <CountChart gender={data.gender} />
          </div>
          <div className="h-[450px] w-full lg:w-2/3">
            <AttendanceChart data={data.attendance} />
          </div>
        </div>

        <Card>
          <h2 className="text-lg font-semibold">Assignments due soon</h2>
          <div className="mt-3 flex flex-col gap-2">
            {(data.upcoming || []).length === 0 && <p className="text-xs text-gray-400">Nothing due.</p>}
            {(data.upcoming || []).map((item) => (
              <Link
                key={item._id}
                to={`/assignments/${item._id}`}
                className="flex items-center justify-between rounded-md bg-lama-sky-light px-3 py-2 text-sm hover:brightness-95"
              >
                <span className="font-medium">{item.title}</span>
                <span className="text-xs text-gray-500">
                  {item.classId?.name} · {formatDate(item.dueDate)}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex w-full flex-col gap-8 lg:w-1/3">
        <AnnouncementsPanel announcements={data.announcements} />
        <div className="h-[400px]">
          <GradeChart data={data.grades} />
        </div>
      </div>
    </div>
  );
}

function StudentView({ data, heading }) {
  return (
    <div className="flex flex-col gap-4 p-4 xl:flex-row">
      <div className="w-full xl:w-2/3">
        <div className="mb-4 flex flex-wrap gap-4">
          <UserCard type="attendance %" count={data.attendance.percentage} />
          <UserCard type="due assignments" count={data.counts.pendingAssignments} tone="teachers" />
          <UserCard type="overall %" count={data.report.percentage} />
          <UserCard type="GPA" count={data.report.gpa} tone="staff" />
        </div>

        <div className="h-[750px] rounded-md bg-white p-4">
          <h1 className="text-xl font-semibold">{heading || 'My schedule'}</h1>
          <BigCalendar lessons={data.timetable} />
        </div>
      </div>

      <div className="flex w-full flex-col gap-8 xl:w-1/3">
        <EventCalendar events={data.events} />
        <AnnouncementsPanel announcements={data.announcements} />
      </div>
    </div>
  );
}

function ParentView({ data }) {
  if (!data.children || data.children.length === 0) {
    return (
      <div className="p-4">
        <Card>
          <Note tone="info">No children are linked to your account yet. Ask an administrator to link them.</Note>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {data.children.map((entry) => (
        <div key={entry.child._id}>
          <h1 className="mb-2 px-1 text-lg font-semibold">
            {entry.child.firstName} {entry.child.lastName}
          </h1>
          <StudentView data={entry} heading={`${entry.child.firstName}'s schedule`} />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useSelector((state) => state.auth);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setData(await dashboardApi.load());
      } catch (err) {
        setError(errorMessage(err));
      }
    };
    load();
  }, []);

  if (error) {
    return (
      <div className="p-4">
        <Note tone="error">{error}</Note>
      </div>
    );
  }

  if (!data) return <Loader label={`Loading your ${user?.role || ''} dashboard`} />;

  if (data.role === 'admin') return <AdminView data={data} />;
  if (data.role === 'teacher') return <TeacherView data={data} />;
  if (data.role === 'student') return <StudentView data={data} />;
  return <ParentView data={data} />;
}
