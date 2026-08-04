import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Trash2, Pin, AlertTriangle } from 'lucide-react';
import { announcementApi, classApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { useListQuery, useDebounced } from '../utils/useListQuery';
import { PageCard, TableSearch, Pagination, RoundIcon, Loader, EmptyState, Note, FormRow, Input, Textarea, Select, Button, Chip } from '../design/primitives';
import { Modal, ConfirmModal } from '../design/Modal';
import { toast } from '../design/Toaster';
import { formatDate, fullName } from '../design/cn';

const EMPTY = { title: '', body: '', scope: 'global', classId: '', pinned: false, urgent: false };

export default function Announcements() {
  const { user } = useSelector((state) => state.auth);
  const canPost = user?.role === 'admin' || user?.role === 'teacher';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [classes, setClasses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const debounced = useDebounced(search);
  const { data, meta, loading, error, reload } = useListQuery(
    announcementApi.list,
    { search: debounced || undefined, page },
    [debounced, page]
  );

  useEffect(() => {
    if (!canPost) return;
    classApi
      .list({ limit: 100 })
      .then((response) => setClasses(response.data))
      .catch(() => setClasses([]));
  }, [canPost]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.scope === 'global') delete payload.classId;
      await announcementApi.create(payload);
      toast.success('Announcement posted');
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
      await announcementApi.remove(pendingDelete._id);
      toast.success('Announcement deleted');
      setPendingDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageCard
        title="Announcements"
        search={<TableSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} />}
        actions={canPost && <RoundIcon icon={Plus} tone="yellow" label="New announcement" onClick={() => setOpen(true)} />}
        footer={<Pagination page={page} totalPages={meta?.totalPages} total={meta?.total} onChange={setPage} />}
      >
        {error && <Note tone="error" className="mt-4">{error}</Note>}
        {loading ? (
          <Loader label="Loading announcements" />
        ) : data.length === 0 ? (
          <EmptyState title="Nothing announced" detail="School and class notices show up here." />
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {data.map((item) => (
              <div
                key={item._id}
                className={`rounded-md p-4 ${item.urgent ? 'bg-red-50' : item.pinned ? 'bg-lama-yellow-light' : 'bg-lama-purple-light'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 font-semibold">
                      {item.pinned && <Pin className="h-3.5 w-3.5 text-gray-500" />}
                      {item.urgent && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                      {item.title}
                    </h3>
                    <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{item.body}</p>
                    <p className="mt-2 text-[11px] text-gray-400">
                      {fullName(item.authorId)} · {formatDate(item.createdAt, true)}
                      {item.classId && ` · ${item.classId.name}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Chip className="bg-white text-gray-500">{item.scope}</Chip>
                    {canPost && <RoundIcon icon={Trash2} tone="purple" label="Delete" onClick={() => setPendingDelete(item)} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New announcement"
        footer={
          <>
            <Button tone="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Post</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <FormRow label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </FormRow>
          <FormRow label="Message" required>
            <Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Scope">
              <Select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                {user?.role === 'admin' && <option value="global">Whole school</option>}
                <option value="class">One class</option>
              </Select>
            </FormRow>
            {form.scope === 'class' && (
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
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
              Pin to top
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} />
              Mark urgent
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete announcement?"
        message="It will disappear for everyone."
      />
    </>
  );
}
