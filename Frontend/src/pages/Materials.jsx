import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Trash2, Download, FileText } from 'lucide-react';
import { materialApi, subjectApi, classApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { useListQuery, useDebounced } from '../utils/useListQuery';
import { PageCard, TableSearch, Pagination, RoundIcon, Loader, EmptyState, Note, FormRow, Input, Textarea, Select, Button } from '../design/primitives';
import { Modal, ConfirmModal } from '../design/Modal';
import { toast } from '../design/Toaster';
import { formatDate, fullName } from '../design/cn';

const EMPTY = { title: '', description: '', subjectId: '', classId: '' };

export default function Materials() {
  const { user } = useSelector((state) => state.auth);
  const canUpload = user?.role === 'admin' || user?.role === 'teacher';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [options, setOptions] = useState({ subjects: [], classes: [] });

  const debounced = useDebounced(search);
  const { data, meta, loading, error, reload } = useListQuery(
    materialApi.list,
    { search: debounced || undefined, page },
    [debounced, page]
  );

  useEffect(() => {
    if (!canUpload) return;
    Promise.all([subjectApi.list({ limit: 100 }), classApi.list({ limit: 100 })])
      .then(([subjects, classes]) => setOptions({ subjects: subjects.data, classes: classes.data }))
      .catch(() => setOptions({ subjects: [], classes: [] }));
  }, [canUpload]);

  const save = async () => {
    if (!file) {
      toast.error('Choose a file first');
      return;
    }

    setSaving(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => value && payload.append(key, value));
      payload.append('file', file);

      await materialApi.upload(payload);
      toast.success('Material uploaded');
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

  const download = async (item) => {
    try {
      const response = await materialApi.download(item._id);
      window.open(response.url, '_blank', 'noopener');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const confirmDelete = async () => {
    try {
      await materialApi.remove(pendingDelete._id);
      toast.success('Material deleted');
      setPendingDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageCard
        title="Study materials"
        search={<TableSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} />}
        actions={canUpload && <RoundIcon icon={Plus} tone="yellow" label="Upload material" onClick={() => setOpen(true)} />}
        footer={<Pagination page={page} totalPages={meta?.totalPages} total={meta?.total} onChange={setPage} />}
      >
        {error && <Note tone="error" className="mt-4">{error}</Note>}
        {loading ? (
          <Loader label="Loading materials" />
        ) : data.length === 0 ? (
          <EmptyState title="Nothing shared yet" detail="Teachers can upload notes, slides and past papers here." />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((item) => (
              <div key={item._id} className="flex flex-col gap-2 rounded-md border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-lama-sky-light">
                    <FileText className="h-4 w-4 text-sky-700" />
                  </span>
                  <div className="flex items-center gap-1.5">
                    <RoundIcon icon={Download} label="Download" onClick={() => download(item)} />
                    {canUpload && <RoundIcon icon={Trash2} tone="purple" label="Delete" onClick={() => setPendingDelete(item)} />}
                  </div>
                </div>
                <p className="font-semibold">{item.title}</p>
                {item.description && <p className="line-clamp-2 text-xs text-gray-500">{item.description}</p>}
                <p className="text-[11px] text-gray-400">
                  {item.subjectId?.name} · {fullName(item.uploadedBy)} · {formatDate(item.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </PageCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Upload material"
        footer={
          <>
            <Button tone="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Upload</Button>
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
            <FormRow label="Subject" required>
              <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">Select</option>
                {options.subjects.map((entry) => (
                  <option key={entry._id} value={entry._id}>{entry.name}</option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Class" hint="Optional">
              <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">All classes</option>
                {options.classes.map((entry) => (
                  <option key={entry._id} value={entry._id}>{entry.name}</option>
                ))}
              </Select>
            </FormRow>
          </div>
          <FormRow label="File" required hint="Up to 10 MB">
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="pt-2" />
          </FormRow>
        </div>
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete material?"
        message="The file will be removed from storage."
      />
    </>
  );
}
