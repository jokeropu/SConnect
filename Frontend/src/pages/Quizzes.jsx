import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { Plus, Pencil, Trash2, BarChart3, Send, Lock, PlayCircle, Eye } from 'lucide-react';
import { quizApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { useListQuery, useDebounced } from '../utils/useListQuery';
import { PageCard, Table, Row, TableSearch, Pagination, RoundIcon, Loader, EmptyState, Note, Button, Chip } from '../design/primitives';
import { ConfirmModal } from '../design/Modal';
import { toast } from '../design/Toaster';
import { formatDate, ownsRecord } from '../design/cn';

const STATUS_TONE = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  closed: 'bg-lama-sky-light text-sky-700',
};

export default function Quizzes() {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const canEdit = user?.role === 'admin' || user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState(null);

  const debounced = useDebounced(search);
  const { data, meta, loading, error, reload } = useListQuery(
    quizApi.list,
    { search: debounced || undefined, page },
    [debounced, page]
  );

  const setStatus = async (quiz, status) => {
    try {
      const response = await quizApi.setStatus(quiz._id, status);
      toast.success(response.message);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const confirmDelete = async () => {
    try {
      await quizApi.remove(pendingDelete._id);
      toast.success('Quiz deleted');
      setPendingDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const studentAction = (quiz) => {
    const attempt = quiz.myAttempt;

    if (attempt?.status === 'submitted') {
      return (
        <div className="flex items-center gap-2">
          <Chip className="bg-lama-purple-light text-indigo-700">
            {attempt.score} / {attempt.totalMarks}
          </Chip>
          {quiz.isOver && (
            <Button size="sm" tone="outline" onClick={() => navigate(`/quizzes/${quiz._id}/review`)}>
              Review
            </Button>
          )}
        </div>
      );
    }
    if (quiz.isOpen) {
      return (
        <Button size="sm" onClick={() => navigate(`/quizzes/${quiz._id}/take`)}>
          {attempt ? 'Resume' : 'Start'}
        </Button>
      );
    }
    if (quiz.isOver) {
      return (
        <div className="flex items-center gap-2">
          <Chip className="bg-gray-100 text-gray-500">Not attempted</Chip>
          <Button size="sm" tone="outline" onClick={() => navigate(`/quizzes/${quiz._id}/review`)}>
            Review
          </Button>
        </div>
      );
    }
    return <Chip className="bg-lama-yellow-light text-yellow-700">Opens {formatDate(quiz.startTime, true)}</Chip>;
  };

  const columns = [
    { header: 'Quiz', accessor: 'title' },
    { header: 'Class', accessor: 'class', className: 'hidden md:table-cell' },
    { header: 'Window', accessor: 'window', className: 'hidden lg:table-cell' },
    ...(canEdit ? [{ header: 'Status', accessor: 'status' }] : []),
    { header: isStudent ? 'Your attempt' : canEdit ? 'Actions' : 'Answers', accessor: 'action' },
  ];

  const renderRow = (item) => (
    <Row key={item._id}>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{item.title}</span>
        </div>
        <p className="text-xs text-gray-500">
          {item.subjectId?.name} · {item.questionCount} question{item.questionCount === 1 ? '' : 's'} · {item.totalMarks} marks · {item.timeLimit} min
        </p>
      </td>
      <td className="hidden px-2 md:table-cell">{item.classId?.name}</td>
      <td className="hidden px-2 text-xs lg:table-cell">
        {formatDate(item.startTime, true)}
        <br />
        <span className="text-gray-400">to {formatDate(item.endTime, true)}</span>
      </td>
      {canEdit && (
        <td className="px-2">
          <div className="flex flex-col items-start gap-1">
            <Chip className={STATUS_TONE[item.status]}>{item.status}</Chip>
            <span className="text-[11px] text-gray-400">{item.submissionCount} submitted</span>
          </div>
        </td>
      )}
      <td className="px-2">
        {isStudent ? (
          studentAction(item)
        ) : !canEdit ? (
          item.isOver ? (
            <Button size="sm" tone="outline" onClick={() => navigate(`/quizzes/${item._id}/review`)}>
              View answers
            </Button>
          ) : (
            <Chip className="bg-lama-yellow-light text-yellow-700">In progress</Chip>
          )
        ) : (
          <div className="flex items-center gap-2">
            <RoundIcon icon={BarChart3} label="Results" onClick={() => navigate(`/quizzes/${item._id}/results`)} />
            {item.status === 'closed' && (
              <RoundIcon icon={Eye} label="Review answers" onClick={() => navigate(`/quizzes/${item._id}/review`)} />
            )}
            {ownsRecord(user, item.createdBy) && (
              <>
                {item.status === 'draft' && (
                  <>
                    <RoundIcon icon={Send} tone="yellow" label="Publish" onClick={() => setStatus(item, 'published')} />
                    <RoundIcon icon={Pencil} tone="yellow" label="Edit" onClick={() => navigate(`/quizzes/${item._id}/edit`)} />
                  </>
                )}
                {item.status === 'published' && (
                  <RoundIcon icon={Lock} tone="yellow" label="Close quiz" onClick={() => setStatus(item, 'closed')} />
                )}
                <RoundIcon icon={Trash2} tone="purple" label="Delete" onClick={() => setPendingDelete(item)} />
              </>
            )}
          </div>
        )}
      </td>
    </Row>
  );

  return (
    <>
      <PageCard
        title="Quizzes"
        search={<TableSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} />}
        actions={canEdit && <RoundIcon icon={Plus} tone="yellow" label="Create quiz" onClick={() => navigate('/quizzes/new')} />}
        footer={<Pagination page={page} totalPages={meta?.totalPages} total={meta?.total} onChange={setPage} />}
      >
        {error && <Note tone="error" className="mt-4">{error}</Note>}
        {loading ? (
          <Loader label="Loading quizzes" />
        ) : data.length === 0 ? (
          <EmptyState
            title="No quizzes yet"
            detail={canEdit ? 'Create one to test your class.' : 'Your teachers have not published a quiz yet.'}
            action={canEdit && <Button onClick={() => navigate('/quizzes/new')}><PlayCircle className="h-4 w-4" /> Create quiz</Button>}
          />
        ) : (
          <Table columns={columns} renderRow={renderRow} data={data} />
        )}
      </PageCard>

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete quiz?"
        message="The quiz and every student attempt will be permanently removed."
      />
    </>
  );
}
