import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Pencil, Trash2, CalendarRange } from 'lucide-react';
import { lessonApi, classApi, subjectApi, userApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { useListQuery } from '../utils/useListQuery';
import { PageCard, Table, Row, Pagination, RoundIcon, Loader, EmptyState, Note, FormRow, Input, Select, Button } from '../design/primitives';
import { Modal, ConfirmModal } from '../design/Modal';
import { toast } from '../design/Toaster';
import { fullName, ownsRecord } from '../design/cn';
import BigCalendar from '../components/BigCalendar';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const EMPTY = { name: '', subjectId: '', classId: '', teacherId: '', day: 'monday', startTime: '09:00', endTime: '10:00', room: '' };

export default function Lessons() {
  const { user } = useSelector((state) => state.auth);
  const canEdit = user?.role === 'admin' || user?.role === 'teacher';

  const [page, setPage] = useState(1);
  const [classId, setClassId] = useState('');
  const [view, setView] = useState('table');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [options, setOptions] = useState({ classes: [], subjects: [], teachers: [] });

  const { data, meta, loading, error, reload } = useListQuery(
    lessonApi.list,
    { classId: classId || undefined, page, limit: view === 'calendar' ? 100 : 10 },
    [classId, page, view]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [classes, subjects, teachers] = await Promise.all([
          classApi.list({ limit: 100 }),
          subjectApi.list({ limit: 100 }),
          user?.role === 'admin' ? userApi.list({ role: 'teacher', limit: 100 }) : Promise.resolve({ data: [] }),
        ]);
        setOptions({ classes: classes.data, subjects: subjects.data, teachers: teachers.data });
      } catch {
        setOptions({ classes: [], subjects: [], teachers: [] });
      }
    };
    load();
  }, [user?.role]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, teacherId: user?.role === 'teacher' ? user._id : '' });
    setOpen(true);
  };

  const openEdit = (lesson) => {
    setEditing(lesson);
    setForm({
      name: lesson.name,
      subjectId: lesson.subjectId?._id || '',
      classId: lesson.classId?._id || '',
      teacherId: lesson.teacherId?._id || '',
      day: lesson.day,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      room: lesson.room || '',
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await lessonApi.update(editing._id, form);
        toast.success('Lesson updated');
      } else {
        await lessonApi.create(form);
        toast.success('Lesson created');
      }
      setOpen(false);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await lessonApi.remove(pendingDelete._id);
      toast.success('Lesson deleted');
      setPendingDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const columns = [
    { header: 'Lesson', accessor: 'name' },
    { header: 'Class', accessor: 'class', className: 'hidden md:table-cell' },
    { header: 'Teacher', accessor: 'teacher', className: 'hidden lg:table-cell' },
    { header: 'When', accessor: 'when', className: 'hidden md:table-cell' },
    ...(canEdit ? [{ header: 'Actions', accessor: 'action' }] : []),
  ];

  const renderRow = (item) => (
    <Row key={item._id}>
      <td className="p-4 font-semibold">{item.subjectId?.name || item.name}</td>
      <td className="hidden px-2 md:table-cell">{item.classId?.name}</td>
      <td className="hidden px-2 lg:table-cell">{fullName(item.teacherId)}</td>
      <td className="hidden px-2 capitalize md:table-cell">
        {item.day} {item.startTime}–{item.endTime}
      </td>
      {canEdit && (
        <td className="px-2">
          <div className="flex items-center gap-2">
            {ownsRecord(user, item.teacherId) && (
              <>
                <RoundIcon icon={Pencil} tone="yellow" label="Edit" onClick={() => openEdit(item)} />
                <RoundIcon icon={Trash2} tone="purple" label="Delete" onClick={() => setPendingDelete(item)} />
              </>
            )}
          </div>
        </td>
      )}
    </Row>
  );

  return (
    <>
      <PageCard
        title="All Lessons"
        search={
          <Select value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }} className="w-44">
            <option value="">All classes</option>
            {options.classes.map((entry) => (
              <option key={entry._id} value={entry._id}>{entry.name}</option>
            ))}
          </Select>
        }
        actions={
          <>
            <RoundIcon
              icon={CalendarRange}
              tone={view === 'calendar' ? 'purple' : 'sky'}
              label="Toggle calendar"
              onClick={() => setView(view === 'table' ? 'calendar' : 'table')}
            />
            {canEdit && <RoundIcon icon={Plus} tone="yellow" label="Add lesson" onClick={openNew} />}
          </>
        }
        footer={view === 'table' ? <Pagination page={page} totalPages={meta?.totalPages} total={meta?.total} onChange={setPage} /> : null}
      >
        {error && <Note tone="error" className="mt-4">{error}</Note>}
        {loading ? (
          <Loader label="Loading lessons" />
        ) : view === 'calendar' ? (
          <div className="mt-4 h-[700px]">
            <BigCalendar lessons={data} />
          </div>
        ) : data.length === 0 ? (
          <EmptyState title="No lessons scheduled" detail="Add lessons to build the weekly timetable." />
        ) : (
          <Table columns={columns} renderRow={renderRow} data={data} />
        )}
      </PageCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit lesson' : 'New lesson'}
        footer={
          <>
            <Button tone="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Create'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <FormRow label="Lesson name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Algebra — 9-A" />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Subject" required>
              <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">Select</option>
                {options.subjects.map((entry) => (
                  <option key={entry._id} value={entry._id}>{entry.name}</option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Class" required>
              <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">Select</option>
                {options.classes.map((entry) => (
                  <option key={entry._id} value={entry._id}>{entry.name}</option>
                ))}
              </Select>
            </FormRow>
          </div>
          {user?.role === 'admin' && (
            <FormRow label="Teacher" required>
              <Select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">Select</option>
                {options.teachers.map((entry) => (
                  <option key={entry._id} value={entry._id}>{fullName(entry)}</option>
                ))}
              </Select>
            </FormRow>
          )}
          <div className="grid grid-cols-3 gap-3">
            <FormRow label="Day">
              <Select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                {DAYS.map((day) => (
                  <option key={day} value={day} className="capitalize">{day}</option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Start">
              <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </FormRow>
            <FormRow label="End">
              <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </FormRow>
          </div>
          <FormRow label="Room">
            <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Room 204" />
          </FormRow>
        </div>
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete lesson?"
        message="This removes the lesson from the timetable."
      />
    </>
  );
}
