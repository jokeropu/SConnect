import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Trash2 } from 'lucide-react';
import { eventApi, classApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { useListQuery } from '../utils/useListQuery';
import { PageCard, Table, Row, Pagination, RoundIcon, Loader, EmptyState, Note, FormRow, Input, Textarea, Select, Button, Chip } from '../design/primitives';
import { Modal, ConfirmModal } from '../design/Modal';
import { toast } from '../design/Toaster';
import { formatDate } from '../design/cn';
import EventCalendar from '../components/EventCalendar';

const EMPTY = { title: '', description: '', audience: 'all', classId: '', category: 'general', startTime: '', endTime: '' };

const CATEGORY_TONE = {
  general: 'bg-lama-sky-light text-sky-700',
  exam: 'bg-red-100 text-red-700',
  holiday: 'bg-green-100 text-green-700',
  meeting: 'bg-lama-purple-light text-indigo-700',
  sports: 'bg-lama-yellow-light text-yellow-700',
  cultural: 'bg-pink-100 text-pink-700',
};

export default function Events() {
  const { user } = useSelector((state) => state.auth);
  const canEdit = user?.role === 'admin' || user?.role === 'teacher';

  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [classes, setClasses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const { data, meta, loading, error, reload } = useListQuery(eventApi.list, { page, limit: 20 }, [page]);

  useEffect(() => {
    if (!canEdit) return;
    classApi
      .list({ limit: 100 })
      .then((response) => setClasses(response.data))
      .catch(() => setClasses([]));
  }, [canEdit]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.audience === 'all') delete payload.classId;
      await eventApi.create(payload);
      toast.success('Event created');
      setOpen(false);
      setForm(EMPTY);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await eventApi.remove(pendingDelete._id);
      toast.success('Event deleted');
      setPendingDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 xl:flex-row">
      <div className="w-full xl:w-2/3">
        <PageCard
          title="School events"
          actions={canEdit && <RoundIcon icon={Plus} tone="yellow" label="New event" onClick={() => setOpen(true)} />}
          footer={<Pagination page={page} totalPages={meta?.totalPages} total={meta?.total} onChange={setPage} />}
        >
          {error && <Note tone="error" className="mt-4">{error}</Note>}
          {loading ? (
            <Loader label="Loading events" />
          ) : data.length === 0 ? (
            <EmptyState title="Nothing scheduled" detail="Exams, holidays and meetings show up here." />
          ) : (
            <Table
              columns={[
                { header: 'Event', accessor: 'title' },
                { header: 'When', accessor: 'when', className: 'hidden md:table-cell' },
                { header: 'Audience', accessor: 'audience', className: 'hidden lg:table-cell' },
                ...(canEdit ? [{ header: 'Actions', accessor: 'action' }] : []),
              ]}
              data={data}
              renderRow={(item) => (
                <Row key={item._id}>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <Chip className={CATEGORY_TONE[item.category]}>{item.category}</Chip>
                    </div>
                    {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                  </td>
                  <td className="hidden px-2 md:table-cell">{formatDate(item.startTime, true)}</td>
                  <td className="hidden px-2 lg:table-cell">{item.classId?.name || 'Whole school'}</td>
                  {canEdit && (
                    <td className="px-2">
                      <RoundIcon icon={Trash2} tone="purple" label="Delete" onClick={() => setPendingDelete(item)} />
                    </td>
                  )}
                </Row>
              )}
            />
          )}
        </PageCard>
      </div>

      <div className="w-full xl:w-1/3">
        <EventCalendar events={data} />
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New event"
        footer={
          <>
            <Button tone="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Create</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <FormRow label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </FormRow>
          <FormRow label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Starts" required>
              <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </FormRow>
            <FormRow label="Ends" required>
              <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </FormRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="general">General</option>
                <option value="exam">Exam</option>
                <option value="holiday">Holiday</option>
                <option value="meeting">Meeting</option>
                <option value="sports">Sports</option>
                <option value="cultural">Cultural</option>
              </Select>
            </FormRow>
            <FormRow label="Audience">
              <Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                {user?.role === 'admin' && <option value="all">Whole school</option>}
                <option value="class">One class</option>
              </Select>
            </FormRow>
          </div>
          {form.audience === 'class' && (
            <FormRow label="Class" required>
              <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">Select</option>
                {classes.map((entry) => (
                  <option key={entry._id} value={entry._id}>{entry.name}</option>
                ))}
              </Select>
            </FormRow>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete event?"
        message="It will be removed from every calendar."
      />
    </div>
  );
}
