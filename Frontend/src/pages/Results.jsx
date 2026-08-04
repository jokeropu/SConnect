import { useState } from 'react';
import { Link } from 'react-router';
import { useSelector } from 'react-redux';
import { FileBarChart } from 'lucide-react';
import { resultApi } from '../api/endpoints';
import { useListQuery } from '../utils/useListQuery';
import { PageCard, Table, Row, Pagination, Loader, EmptyState, Note, Chip } from '../design/primitives';
import { formatDate, fullName, GRADE_TONE } from '../design/cn';

export default function Results() {
  const { user } = useSelector((state) => state.auth);
  const [page, setPage] = useState(1);

  const { data, meta, loading, error } = useListQuery(resultApi.list, { page }, [page]);

  const columns = [
    { header: 'Exam', accessor: 'exam' },
    ...(user?.role === 'student' ? [] : [{ header: 'Student', accessor: 'student', className: 'hidden md:table-cell' }]),
    { header: 'Score', accessor: 'score', className: 'hidden md:table-cell' },
    { header: 'Grade', accessor: 'grade' },
    { header: 'Date', accessor: 'date', className: 'hidden lg:table-cell' },
  ];

  const renderRow = (item) => (
    <Row key={item._id}>
      <td className="p-4">
        <span className="font-semibold">{item.examId?.title || 'Assignment'}</span>
        <p className="text-xs text-gray-500">{item.examId?.subjectId?.name}</p>
      </td>
      {user?.role !== 'student' && <td className="hidden px-2 md:table-cell">{fullName(item.studentId)}</td>}
      <td className="hidden px-2 md:table-cell">
        {item.marksObtained}/{item.maxMarks} <span className="text-xs text-gray-400">({item.percentage}%)</span>
      </td>
      <td className="px-2">
        <Chip className={`bg-gray-100 ${GRADE_TONE[item.grade] || 'text-gray-600'}`}>{item.grade}</Chip>
      </td>
      <td className="hidden px-2 lg:table-cell">{formatDate(item.createdAt)}</td>
    </Row>
  );

  return (
    <PageCard
      title="All Results"
      actions={
        (user?.role === 'student' || user?.role === 'parent') && (
          <Link
            to="/report-card"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-lama-purple px-3 text-xs font-medium text-gray-800 hover:brightness-95"
          >
            <FileBarChart className="h-3.5 w-3.5" />
            Report card
          </Link>
        )
      }
      footer={<Pagination page={page} totalPages={meta?.totalPages} total={meta?.total} onChange={setPage} />}
    >
      {error && <Note tone="error" className="mt-4">{error}</Note>}
      {loading ? (
        <Loader label="Loading results" />
      ) : data.length === 0 ? (
        <EmptyState title="No results yet" detail="Results appear here once a teacher publishes them." />
      ) : (
        <Table columns={columns} renderRow={renderRow} data={data} />
      )}
    </PageCard>
  );
}
