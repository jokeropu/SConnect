import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Save } from 'lucide-react';
import { attendanceApi, classApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { PageCard, Card, Table, Row, Loader, EmptyState, Note, Select, Input, Button, Chip, Avatar } from '../design/primitives';
import { toast } from '../design/Toaster';
import { ATTENDANCE_TONE } from '../design/cn';
import UserCard from '../components/UserCard';
import AttendanceChart from '../components/AttendanceChart';

const STATUSES = ['present', 'absent', 'late', 'excused'];

function TeacherView() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    classApi
      .list({ limit: 100 })
      .then((response) => {
        setClasses(response.data);
        if (response.data.length > 0) setClassId(response.data[0]._id);
      })
      .catch(() => setClasses([]));
  }, []);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError('');
    try {
      const response = await attendanceApi.sheet({ classId, date });
      setRoster(response.roster);
    } catch (err) {
      setError(errorMessage(err));
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await attendanceApi.mark({
        classId,
        date,
        records: roster.map((row) => ({ studentId: row.studentId, status: row.status, note: row.note })),
      });
      toast.success('Attendance saved');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setAll = (status) => setRoster(roster.map((row) => ({ ...row, status })));

  return (
    <PageCard
      title="Attendance register"
      search={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-40">
            {classes.map((entry) => (
              <option key={entry._id} value={entry._id}>{entry.name}</option>
            ))}
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </div>
      }
      actions={
        <>
          <Button size="sm" tone="outline" onClick={() => setAll('present')}>All present</Button>
          <Button size="sm" onClick={save} loading={saving}>
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </>
      }
    >
      {error && <Note tone="error" className="mt-4">{error}</Note>}
      {loading ? (
        <Loader label="Loading roster" />
      ) : roster.length === 0 ? (
        <EmptyState title="No students in this class" detail="Enrol students before marking attendance." />
      ) : (
        <Table
          columns={[
            { header: 'Student', accessor: 'student' },
            { header: 'Status', accessor: 'status' },
            { header: 'Note', accessor: 'note', className: 'hidden md:table-cell' },
          ]}
          data={roster}
          renderRow={(row) => (
            <Row key={row.studentId}>
              <td className="flex items-center gap-3 p-3">
                <Avatar src={row.avatarUrl} name={row.name} size={30} />
                <div>
                  <p className="font-medium">{row.name}</p>
                  {row.rollNumber && <p className="text-[11px] text-gray-400">{row.rollNumber}</p>}
                </div>
              </td>
              <td className="px-2">
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        setRoster(roster.map((entry) => (entry.studentId === row.studentId ? { ...entry, status } : entry)))
                      }
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-all ${
                        row.status === status ? ATTENDANCE_TONE[status] : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </td>
              <td className="hidden px-2 md:table-cell">
                <Input
                  value={row.note}
                  onChange={(e) =>
                    setRoster(roster.map((entry) => (entry.studentId === row.studentId ? { ...entry, note: e.target.value } : entry)))
                  }
                  className="h-8"
                  placeholder="Optional"
                />
              </td>
            </Row>
          )}
        />
      )}
    </PageCard>
  );
}

function LearnerView() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [studentResponse, trendResponse] = await Promise.all([
          attendanceApi.student(),
          attendanceApi.trend({ weeks: 4 }),
        ]);
        setSummary(studentResponse);
        setTrend(trendResponse.data.map((row) => ({ name: row.date.slice(5), present: row.present, absent: row.absent })));
      } catch (err) {
        setError(errorMessage(err));
      }
    };
    load();
  }, []);

  if (error) return <div className="p-4"><Note tone="error">{error}</Note></div>;
  if (!summary) return <Loader label="Loading attendance" />;

  return (
    <div className="flex flex-col gap-4 p-4">
      {summary.belowThreshold && (
        <Note tone="warning">
          Your attendance is {summary.percentage}%, below the required {summary.threshold}%.
        </Note>
      )}

      <div className="flex flex-wrap gap-4">
        <UserCard type="attendance %" count={summary.percentage} />
        <UserCard type="present" count={summary.present} tone="teachers" />
        <UserCard type="absent" count={summary.absent} />
        <UserCard type="late" count={summary.late} tone="staff" />
      </div>

      <div className="h-[400px]">
        <AttendanceChart data={trend} />
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Day by day</h2>
        {summary.timeline.length === 0 ? (
          <EmptyState title="No attendance recorded yet" />
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.timeline.map((entry) => (
              <Chip key={entry.date} className={ATTENDANCE_TONE[entry.status]}>
                {entry.date} · {entry.status}
              </Chip>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useSelector((state) => state.auth);
  return user?.role === 'admin' || user?.role === 'teacher' ? <TeacherView /> : <LearnerView />;
}
