import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { userApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { PageCard, Table, Row, Loader, EmptyState, Note, Button, Avatar } from '../design/primitives';
import { toast } from '../design/Toaster';
import { formatDate, fullName, ROLE_LABEL } from '../design/cn';

export default function ApprovalsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await userApi.pending();
      setData(response.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (user, status) => {
    try {
      await userApi.setStatus(user._id, status);
      toast.success(`${fullName(user)} ${status}`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <PageCard title="Pending approvals">
      {error && <Note tone="error" className="mt-4">{error}</Note>}
      {loading ? (
        <Loader label="Loading requests" />
      ) : data.length === 0 ? (
        <EmptyState title="Nothing waiting" detail="New student signups appear here for review." />
      ) : (
        <Table
          columns={[
            { header: 'Person', accessor: 'person' },
            { header: 'Role', accessor: 'role', className: 'hidden md:table-cell' },
            { header: 'Requested', accessor: 'created', className: 'hidden lg:table-cell' },
            { header: 'Decision', accessor: 'action' },
          ]}
          data={data}
          renderRow={(item) => (
            <Row key={item._id}>
              <td className="flex items-center gap-3 p-4">
                <Avatar src={item.avatarUrl} name={item.firstName} size={32} />
                <div>
                  <p className="font-semibold">{fullName(item)}</p>
                  <p className="text-xs text-gray-500">{item.email}</p>
                </div>
              </td>
              <td className="hidden px-2 md:table-cell">{ROLE_LABEL[item.role]}</td>
              <td className="hidden px-2 lg:table-cell">{formatDate(item.createdAt)}</td>
              <td className="px-2">
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => decide(item, 'approved')}>
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button size="sm" tone="outline" onClick={() => decide(item, 'suspended')}>
                    <X className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              </td>
            </Row>
          )}
        />
      )}
    </PageCard>
  );
}
