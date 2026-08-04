import { useState } from 'react';
import { Link } from 'react-router';
import { useSelector } from 'react-redux';
import { Eye, Filter, Plus, Trash2, Pencil } from 'lucide-react';
import { userApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { useListQuery, useDebounced } from '../utils/useListQuery';
import { PageCard, Table, Row, TableSearch, Pagination, RoundIcon, Loader, EmptyState, Note, Chip, Avatar, Select } from '../design/primitives';
import { ConfirmModal } from '../design/Modal';
import { toast } from '../design/Toaster';
import { fullName, STATUS_TONE } from '../design/cn';
import UserFormModal from './UserFormModal';

export default function PeopleList({ role, title }) {
  const { user: current } = useSelector((state) => state.auth);
  const isAdmin = current?.role === 'admin';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const debouncedSearch = useDebounced(search);

  const { data, meta, loading, error, reload } = useListQuery(
    userApi.list,
    { role, search: debouncedSearch || undefined, status: status || undefined, page },
    [role, debouncedSearch, status, page]
  );

  const columns = [
    { header: 'Info', accessor: 'info' },
    { header: 'Email', accessor: 'email', className: 'hidden md:table-cell' },
    { header: 'Phone', accessor: 'phone', className: 'hidden lg:table-cell' },
    { header: 'Status', accessor: 'status', className: 'hidden md:table-cell' },
    ...(isAdmin ? [{ header: 'Actions', accessor: 'action' }] : []),
  ];

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await userApi.remove(pendingDelete._id);
      toast.success('User deleted');
      setPendingDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const renderRow = (item) => {
    const tone = STATUS_TONE[item.status] || STATUS_TONE.pending;
    return (
      <Row key={item._id}>
        <td className="flex items-center gap-4 p-4">
          <Avatar src={item.avatarUrl} name={`${item.firstName || ''}${item.lastName || ''}`} className="hidden xl:inline-flex" />
          <div className="flex flex-col">
            <h3 className="font-semibold">{fullName(item)}</h3>
            <p className="text-xs text-gray-500 md:hidden">{item.email}</p>
          </div>
        </td>
        <td className="hidden px-2 md:table-cell">{item.email}</td>
        <td className="hidden px-2 lg:table-cell">{item.phone || '—'}</td>
        <td className="hidden px-2 md:table-cell">
          <Chip className={tone.className}>{tone.label}</Chip>
        </td>
        {isAdmin && (
          <td className="px-2">
            <div className="flex items-center gap-2">
              <Link to={`/users/${item._id}`}>
                <RoundIcon icon={Eye} label="View" />
              </Link>
              <RoundIcon
                icon={Pencil}
                tone="yellow"
                label="Edit"
                onClick={() => {
                  setEditing(item);
                  setFormOpen(true);
                }}
              />
              <RoundIcon icon={Trash2} tone="purple" label="Delete" onClick={() => setPendingDelete(item)} />
            </div>
          </td>
        )}
      </Row>
    );
  };

  return (
    <>
      <PageCard
        title={title}
        search={<TableSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} />}
        actions={
          <>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-32">
              <option value="">All status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </Select>
            <RoundIcon icon={Filter} tone="yellow" label="Filter" onClick={() => setStatus('')} />
            {isAdmin && (
              <RoundIcon
                icon={Plus}
                tone="yellow"
                label={`Add ${role}`}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              />
            )}
          </>
        }
        footer={<Pagination page={page} totalPages={meta?.totalPages} total={meta?.total} onChange={setPage} />}
      >
        {error && <Note tone="error" className="mt-4">{error}</Note>}
        {loading ? (
          <Loader label={`Loading ${title.toLowerCase()}`} />
        ) : data.length === 0 ? (
          <EmptyState title={`No ${role}s found`} detail="Try a different search, or add one." />
        ) : (
          <Table columns={columns} renderRow={renderRow} data={data} />
        )}
      </PageCard>

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        role={role}
        user={editing}
        onSaved={reload}
      />

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete this account?"
        message={`${fullName(pendingDelete)} and all of their records will be permanently removed.`}
      />
    </>
  );
}
