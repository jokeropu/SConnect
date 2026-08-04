import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { classApi, userApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { useListQuery, useDebounced } from '../utils/useListQuery';
import { PageCard, Table, Row, TableSearch, Pagination, RoundIcon, Loader, EmptyState, Note, FormRow, Input, Select, Button, Chip } from '../design/primitives';
import { Modal, ConfirmModal } from '../design/Modal';
import { toast } from '../design/Toaster';
import { fullName } from '../design/cn';

const EMPTY = { name: '', gradeLevel: 6, section: 'A', capacity: 40, academicYear: '2025-2026', supervisorId: '' };

export default function Classes() {
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [teachers, setTeachers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const debounced = useDebounced(search);
  const { data, meta, loading, error, reload } = useListQuery(
    classApi.list,
    { search: debounced || undefined, page },
    [debounced, page]
  );

  useEffect(() => {
    if (!isAdmin) return;
    userApi
      .list({ role: 'teacher', limit: 100 })
      .then((response) => setTeachers(response.data))
      .catch(() => setTeachers([]));
  }, [isAdmin]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({
      name: entry.name,
      gradeLevel: entry.gradeLevel,
      section: entry.section,
      capacity: entry.capacity,
      academicYear: entry.academicYear,
      supervisorId: entry.supervisorId?._id || '',
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = { ...form, gradeLevel: Number(form.gradeLevel), capacity: Number(form.capacity) };
    if (!payload.supervisorId) delete payload.supervisorId;

    try {
      if (editing) {
        await classApi.update(editing._id, payload);
        toast.success('Class updated');
      } else {
        await classApi.create(payload);
        toast.success('Class created');
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
      await classApi.remove(pendingDelete._id);
      toast.success('Class deleted');
      setPendingDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const columns = [
    { header: 'Class', accessor: 'name' },
    { header: 'Capacity', accessor: 'capacity', className: 'hidden md:table-cell' },
    { header: 'Grade', accessor: 'grade', className: 'hidden md:table-cell' },
    { header: 'Supervisor', accessor: 'supervisor', className: 'hidden lg:table-cell' },
    ...(isAdmin ? [{ header: 'Actions', accessor: 'action' }] : []),
  ];

  const renderRow = (item) => (
    <Row key={item._id}>
      <td className="flex items-center gap-3 p-4">
        <span className="font-semibold">{item.name}</span>
        <Chip className="bg-lama-sky-light text-sky-700">
          <Users className="mr-1 h-3 w-3" />
          {item.enrolled}/{item.capacity}
        </Chip>
      </td>
      <td className="hidden px-2 md:table-cell">{item.capacity}</td>
      <td className="hidden px-2 md:table-cell">{item.gradeLevel}</td>
      <td className="hidden px-2 lg:table-cell">{item.supervisorId ? fullName(item.supervisorId) : '—'}</td>
      {isAdmin && (
        <td className="px-2">
          <div className="flex items-center gap-2">
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
        title="All Classes"
        search={<TableSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} />}
        actions={isAdmin && <RoundIcon icon={Plus} tone="yellow" label="Add class" onClick={openNew} />}
        footer={<Pagination page={page} totalPages={meta?.totalPages} total={meta?.total} onChange={setPage} />}
      >
        {error && <Note tone="error" className="mt-4">{error}</Note>}
        {loading ? (
          <Loader label="Loading classes" />
        ) : data.length === 0 ? (
          <EmptyState title="No classes yet" detail="Create a class before enrolling students." />
        ) : (
          <Table columns={columns} renderRow={renderRow} data={data} />
        )}
      </PageCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit class' : 'New class'}
        footer={
          <>
            <Button tone="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Create'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <FormRow label="Name" required hint="For example 9-A">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormRow>
          <div className="grid grid-cols-3 gap-3">
            <FormRow label="Grade">
              <Input type="number" min="1" max="12" value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} />
            </FormRow>
            <FormRow label="Section">
              <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
            </FormRow>
            <FormRow label="Capacity">
              <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </FormRow>
          </div>
          <FormRow label="Academic year">
            <Input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} />
          </FormRow>
          <FormRow label="Supervisor">
            <Select value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
              <option value="">None</option>
              {teachers.map((teacher) => (
                <option key={teacher._id} value={teacher._id}>
                  {fullName(teacher)}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete class?"
        message={`${pendingDelete?.name} will be removed along with its lessons. Classes with enrolled students cannot be deleted.`}
      />
    </>
  );
}
