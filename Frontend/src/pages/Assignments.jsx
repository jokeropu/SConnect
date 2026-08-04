import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useSelector } from 'react-redux';
import { Plus, Eye, Trash2, Paperclip } from 'lucide-react';
import { assignmentApi, classApi, subjectApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { useListQuery, useDebounced } from '../utils/useListQuery';
import { PageCard, Table, Row, TableSearch, Pagination, RoundIcon, Loader, EmptyState, Note, FormRow, Input, Textarea, Select, Button, Chip } from '../design/primitives';
import { Modal, ConfirmModal } from '../design/Modal';
import { toast } from '../design/Toaster';
import { formatDate } from '../design/cn';

const EMPTY = { title: '', description: '', subjectId: '', classId: '', dueDate: '', maxMarks: 100 };

export default function Assignments() {
  const { user } = useSelector((state) => state.auth);
  const canEdit = user?.role === 'admin' || user?.role === 'teacher';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [options, setOptions] = useState({ classes: [], subjects: [] });

  const debounced = useDebounced(search);
  const { data, meta, loading, error, reload } = useListQuery(
    assignmentApi.list,
    { search: debounced || undefined, page },
    [debounced, page]
  );

  useEffect(() => {
    if (!canEdit) return;
    Promise.all([classApi.list({ limit: 100 }), subjectApi.list({ limit: 100 })])
      .then(([classes, subjects]) => setOptions({ classes: classes.data, subjects: subjects.data }))
      .catch(() => setOptions({ classes: [], subjects: [] }));
  }, [canEdit]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      if (file) payload.append('attachment', file);

      await assignmentApi.create(payload);
      toast.success('Assignment created');
      setOpen(false);
      setForm(EMPTY);
      setFile(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await assignmentApi.remove(pendingDelete._id);
      toast.success('Assignment deleted');
      setPendingDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const columns = [
    { header: 'Assignment', accessor: 'title' },
    { header: 'Class', accessor: 'class', className: 'hidden md:table-cell' },
    { header: 'Due', accessor: 'due', className: 'hidden md:table-cell' },
    { header: 'Status', accessor: 'status', className: 'hidden lg:table-cell' },
    { header: 'Actions', accessor: 'action' },
  ];

  const statusChip = (item) => {
    if (user?.role !== 'student') return <span className="text-xs text-gray-400">{item.maxMarks} marks</span>;
    if (!item.mySubmission) {
      return new Date(item.dueDate) < new Date() ? (
        <Chip className="bg-red-100 text-red-700">Missed</Chip>
      ) : (
        <Chip className="bg-lama-yellow-light text-yellow-700">Not submitted</Chip>
      );
    }
    if (item.mySubmission.status === 'graded') {
      return <Chip className="bg-green-100 text-green-700">{item.mySubmission.marksObtained}/{item.maxMarks}</Chip>;
    }
    return <Chip className="bg-lama-sky-light text-sky-700">{item.mySubmission.status}</Chip>;
  };

  const renderRow = (item) => (
    <Row key={item._id}>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{item.title}</span>
          {item.attachmentUrl && <Paperclip className="h-3.5 w-3.5 text-gray-400" />}
        </div>
        <p className="text-xs text-gray-500">{item.subjectId?.name}</p>
      </td>
      <td className="hidden px-2 md:table-cell">{item.classId?.name}</td>
      <td className="hidden px-2 md:table-cell">{formatDate(item.dueDate, true)}</td>
      <td className="hidden px-2 lg:table-cell">{statusChip(item)}</td>
      <td className="px-2">
        <div className="flex items-center gap-2">
          <Link to={`/assignments/${item._id}`}>
            <RoundIcon icon={Eye} label="Open" />
          </Link>
          {canEdit && <RoundIcon icon={Trash2} tone="purple" label="Delete" onClick={() => setPendingDelete(item)} />}
        </div>
      </td>
    </Row>
  );

  return (
    <>
      <PageCard
        title="All Assignments"
        search={<TableSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} />}
        actions={canEdit && <RoundIcon icon={Plus} tone="yellow" label="New assignment" onClick={() => setOpen(true)} />}
        footer={<Pagination page={page} totalPages={meta?.totalPages} total={meta?.total} onChange={setPage} />}
      >
        {error && <Note tone="error" className="mt-4">{error}</Note>}
        {loading ? (
          <Loader label="Loading assignments" />
        ) : data.length === 0 ? (
          <EmptyState title="No assignments" detail="Nothing has been set for your classes yet." />
        ) : (
          <Table columns={columns} renderRow={renderRow} data={data} />
        )}
      </PageCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New assignment"
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
          <FormRow label="Instructions">
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Due date" required>
              <Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </FormRow>
            <FormRow label="Max marks">
              <Input type="number" min="1" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} />
            </FormRow>
          </div>
          <FormRow label="Attachment" hint="PDF, DOC, image, up to 10 MB">
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="pt-2" />
          </FormRow>
        </div>
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete assignment?"
        message="The assignment and every submission against it will be removed."
      />
    </>
  );
}
