import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { subjectApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { useListQuery, useDebounced } from '../utils/useListQuery';
import { PageCard, Table, Row, TableSearch, Pagination, RoundIcon, Loader, EmptyState, Note, FormRow, Input, Textarea, Button } from '../design/primitives';
import { Modal, ConfirmModal } from '../design/Modal';
import { toast } from '../design/Toaster';

export default function Subjects() {
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const debounced = useDebounced(search);
  const { data, meta, loading, error, reload } = useListQuery(
    subjectApi.list,
    { search: debounced || undefined, page },
    [debounced, page]
  );

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', code: '', description: '' });
    setOpen(true);
  };

  const openEdit = (subject) => {
    setEditing(subject);
    setForm({ name: subject.name, code: subject.code, description: subject.description || '' });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await subjectApi.update(editing._id, form);
        toast.success('Subject updated');
      } else {
        await subjectApi.create(form);
        toast.success('Subject created');
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
      await subjectApi.remove(pendingDelete._id);
      toast.success('Subject deleted');
      setPendingDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const columns = [
    { header: 'Subject', accessor: 'name' },
    { header: 'Code', accessor: 'code', className: 'hidden md:table-cell' },
    { header: 'Teachers', accessor: 'teachers', className: 'hidden lg:table-cell' },
    ...(isAdmin ? [{ header: 'Actions', accessor: 'action' }] : []),
  ];

  const renderRow = (item) => (
    <Row key={item._id}>
      <td className="p-4 font-semibold">{item.name}</td>
      <td className="hidden px-2 md:table-cell">{item.code}</td>
      <td className="hidden px-2 lg:table-cell">
        {(item.teachers || []).map((t) => `${t.firstName} ${t.lastName}`).join(', ') || '—'}
      </td>
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
        title="All Subjects"
        search={<TableSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} />}
        actions={isAdmin && <RoundIcon icon={Plus} tone="yellow" label="Add subject" onClick={openNew} />}
        footer={<Pagination page={page} totalPages={meta?.totalPages} total={meta?.total} onChange={setPage} />}
      >
        {error && <Note tone="error" className="mt-4">{error}</Note>}
        {loading ? (
          <Loader label="Loading subjects" />
        ) : data.length === 0 ? (
          <EmptyState title="No subjects yet" detail="Add the subjects your school teaches." />
        ) : (
          <Table columns={columns} renderRow={renderRow} data={data} />
        )}
      </PageCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit subject' : 'New subject'}
        footer={
          <>
            <Button tone="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Create'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <FormRow label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mathematics" />
          </FormRow>
          <FormRow label="Code" required>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MATH" />
          </FormRow>
          <FormRow label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </FormRow>
        </div>
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete subject?"
        message={`${pendingDelete?.name} will be removed. Subjects used by a lesson cannot be deleted.`}
      />
    </>
  );
}
