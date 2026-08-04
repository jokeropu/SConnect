import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { resultApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { Card, Loader, Note, EmptyState, Chip } from '../design/primitives';
import { GRADE_TONE } from '../design/cn';
import UserCard from '../components/UserCard';

export default function ReportCard() {
  const { studentId } = useParams();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setPayload(await resultApi.reportCard(studentId));
      } catch (err) {
        setError(errorMessage(err));
      }
    };
    load();
  }, [studentId]);

  if (error) return <div className="p-4"><Note tone="error">{error}</Note></div>;
  if (!payload) return <Loader label="Building report card" />;

  const { summary, subjects } = payload;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap gap-4">
        <UserCard type="overall %" count={summary.percentage} />
        <UserCard type="grade" count={summary.grade} tone="teachers" />
        <UserCard type="GPA" count={summary.gpa} />
        <UserCard type="marks" count={`${summary.totalObtained}/${summary.totalMax}`} tone="staff" />
      </div>

      <Card>
        <h1 className="text-lg font-semibold">Subject breakdown</h1>

        {subjects.length === 0 ? (
          <EmptyState title="Nothing published yet" detail="Once exam results are published they are summarised here." />
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {subjects.map((entry) => (
              <div key={entry.subject.code} className="rounded-md border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{entry.subject.name}</p>
                    <p className="text-xs text-gray-400">{entry.subject.code}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      {entry.obtained}/{entry.max} ({entry.percentage}%)
                    </span>
                    <Chip className={`bg-gray-100 ${GRADE_TONE[entry.grade] || 'text-gray-600'}`}>{entry.grade}</Chip>
                  </div>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-lama-purple" style={{ width: `${Math.min(100, entry.percentage)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
