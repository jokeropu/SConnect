import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Pencil, Trash2, ClipboardCheck, Send } from 'lucide-react';
import { examApi, classApi, subjectApi, userApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { useListQuery, useDebounced } from '../utils/useListQuery';
import { PageCard, Table, Row, TableSearch, Pagination, RoundIcon, Loader, EmptyState, Note, FormRow, Input, Select, Button, Chip } from '../design/primitives';
import { Modal, ConfirmModal } from '../design/Modal';
import { toast } from '../design/Toaster';
import { formatDate, fullName } from '../design/cn';

const EMPTY = { title: '', subjectId: '', classId: '', term: 'unit-1', startTime: '', endTime: '', maxMarks: 100, room: '' };

function ResultsModal({ exam, open, onClose, onSaved }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !exam) return;
    const load = async () => {
      setLoading(true);
      try {
        const response = await classApi.byId(exam.classId?._id || exam.classId);
        setRoster(
          response.students.map((entry) => ({
            studentId: entry.userId._id,
            name: fullName(entry.userId),
            marksObtained: '',
            remarks: '',
          }))
        );
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, exam]);

  const save = async () => {
    const entries = roster
      .filter((row) => row.marksObtained !== '')
      .map((row) => ({ studentId: row.studentId, marksObtained: Number(row.marksObtained), remarks: row.remarks }));

    if (entries.length === 0) {
      toast.error('Enter at least one mark');
      return;
    }

    setSaving(true);
    try {
      await examApi.enterResults(exam._id, entries);
      toast.success(`Saved ${entries.length} result(s)`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Enter results — ${exam?.title || ''}`}
      description={`Out of ${exam?.maxMarks || 0} marks`}
      width="max-w-2xl"
      footer={
        <>
          <Button tone="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save results</Button>
        </>
      }
    >
      {loading ? (
        <Loader label="Loading roster" />
      ) : roster.length === 0 ? (
        <EmptyState title="No students in this class" />
      ) : (
        <div className="flex flex-col gap-2">
          {roster.map((row, index) => (
            <div key={row.studentId} className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2">
              <span className="flex-1 text-sm font-medium">{row.name}</span>
              <Input
                type="number"
                min="0"
                max={exam?.maxMarks}
                value={row.marksObtained}
                onChange={(e) => {
                  const next = [...roster];
                  next[index] = { ...row, marksObtained: e.target.value };
                  setRoster(next);
                }}
                className="h-9 w-24"
                placeholder="Marks"
              />
              <Input
                value={row.remarks}
                onChange={(e) => {
                  const next = [...roster];
                  next[index] = { ...row, remarks: e.target.value };
                  setRoster(next);
                }}
                className="h-9 w-40"
                placeholder="Remarks"
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function Exams() {
  const { user } = useSelector((state) => state.auth);
  const canEdit = user?.role === 'admin' || user?.role === 'teacher';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [resultsFor, setResultsFor] = useState(null);
  const [options, setOptions] = useState({ classes: [], subjects: [] });

  const debounced = useDebounced(search);
  const { data, meta, loading, error, reload } = useListQuery(
    examApi.list,
    { search: debounced || undefined, page },
    [debounced, page]
  );

  useEffect(() => {
    Promise.all([classApi.list({ limit: 100 }), subjectApi.list({ limit: 100 })])
      .then(([classes, subjects]) => setOptions({ classes: classes.data, subjects: subjects.data }))
      .catch(() => setOptions({ classes: [], subjects: [] }));
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (exam) => {
    setEditing(exam);
    setForm({
      title: exam.title,
      subjectId: exam.subjectId?._id || '',
      classId: exam.classId?._id || '',
      term: exam.term,
      startTime: String(exam.startTime).slice(0, 16),
      endTime: String(exam.endTime).slice(0, 16),
      maxMarks: exam.maxMarks,
      room: exam.room || '',
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, maxMarks: Number(form.maxMarks) };
      if (editing) {
        await examApi.update(editing._id, payload);
        toast.success('Exam updated');
      } else {
        await examApi.create(payload);
        toast.success('Exam scheduled');
      }
      setOpen(false);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const publish = async (exam) => {
    try {
      const response = await examApi.publish(exam._id);
      toast.success(response.message);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const confirmDelete = async () => {
    try {
      await examApi.remove(pendingDelete._id);
      toast.success('Exam deleted');
      setPendingDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const columns = [
    { header: 'Exam', accessor: 'title' },
    { header: 'Class', accessor: 'class', className: 'hidden md:table-cell' },
    { header: 'Date', accessor: 'date', className: 'hidden md:table-cell' },
    { header: 'Marks', accessor: 'marks', className: 'hidden lg:table-cell' },
    ...(canEdit ? [{ header: 'Actions', accessor: 'action' }] : []),
  ];

  const renderRow = (item) => (
    <Row key={item._id}>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{item.title}</span>
          {item.resultsPublished && <Chip className="bg-green-100 text-green-700">Published</Chip>}
        </div>
        <p className="text-xs text-gray-500">{item.subjectId?.name}</p>
      </td>
      <td className="hidden px-2 md:table-cell">{item.classId?.name}</td>
      <td className="hidden px-2 md:table-cell">{formatDate(item.startTime, true)}</td>
      <td className="hidden px-2 lg:table-cell">{item.maxMarks}</td>
      {canEdit && (
        <td className="px-2">
          <div className="flex items-center gap-2">
            <RoundIcon icon={ClipboardCheck} label="Enter results" onClick={() => setResultsFor(item)} />
            {!item.resultsPublished && <RoundIcon icon={Send} tone="yellow" label="Publish results" onClick={() => publish(item)} />}
            <RoundIcon icon={Pencil} tone="yellow" label="Edit" onClick={() => openEdit(item)} />
            <RoundIcon icon={Trash2} tone="purple" label="Delete" onClick={() => setPendingDelete(item)} />
          </div>
        </td>
      )}
    </Row>
  );

  return (
    <>
      <PageCard
        title="All Exams"
        search={<TableSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} />}
        actions={canEdit && <RoundIcon icon={Plus} tone="yellow" label="Schedule exam" onClick={openNew} />}
        footer={<Pagination page={page} totalPages={meta?.totalPages} total={meta?.total} onChange={setPage} />}
      >
        {error && <Note tone="error" className="mt-4">{error}</Note>}
        {loading ? (
          <Loader label="Loading exams" />
        ) : data.length === 0 ? (
          <EmptyState title="No exams scheduled" detail="Schedule one to start recording results." />
        ) : (
          <Table columns={columns} renderRow={renderRow} data={data} />
        )}
      </PageCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit exam' : 'Schedule exam'}
        footer={
          <>
            <Button tone="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Schedule'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <FormRow label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mathematics Unit 1" />
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
            <FormRow label="Starts" required>
              <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </FormRow>
            <FormRow label="Ends" required>
              <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </FormRow>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormRow label="Term">
              <Select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })}>
                <option value="unit-1">Unit 1</option>
                <option value="unit-2">Unit 2</option>
                <option value="midterm">Midterm</option>
                <option value="final">Final</option>
                <option value="other">Other</option>
              </Select>
            </FormRow>
            <FormRow label="Max marks">
              <Input type="number" min="1" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} />
            </FormRow>
            <FormRow label="Room">
              <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </FormRow>
          </div>
        </div>
      </Modal>

      <ResultsModal exam={resultsFor} open={!!resultsFor} onClose={() => setResultsFor(null)} onSaved={reload} />

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete exam?"
        message="The exam and all of its results will be removed."
      />
    </>
  );
}
