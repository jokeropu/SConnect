import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Eye, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { quizApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { Card, CardHead, Loader, Note, Button, Chip, Table, Row, Avatar, EmptyState } from '../design/primitives';
import { toast } from '../design/Toaster';
import { cn, formatDate, fullName, initials } from '../design/cn';

const Stat = ({ label, value, hint }) => (
  <Card className="flex flex-1 flex-col gap-1 border border-gray-100">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-2xl font-semibold text-gray-800">{value}</span>
    {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
  </Card>
);

export default function QuizResults() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    quizApi
      .results(id)
      .then(setPayload)
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const blob = await quizApi.resultsCsv(id);
      const slug =
        (payload?.quiz?.title || 'quiz').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'quiz';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug}-results.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return (
      <div className="m-4 mt-0 flex flex-col gap-4">
        <Note tone="error">{error}</Note>
        <Button tone="outline" className="self-start" onClick={() => navigate('/list/quizzes')}>Back to quizzes</Button>
      </div>
    );
  }

  if (!payload) return <Loader label="Loading results" />;

  const { quiz, summary, attempts, questionStats } = payload;

  const chartData = questionStats.map((stat, index) => ({
    name: `Q${index + 1}`,
    accuracy: stat.accuracy,
  }));

  const columns = [
    { header: 'Student', accessor: 'student' },
    { header: 'Score', accessor: 'score' },
    { header: 'Submitted', accessor: 'submitted', className: 'hidden md:table-cell' },
    { header: '', accessor: 'action' },
  ];

  const renderRow = (attempt, rank) => {
    const percent = attempt.totalMarks > 0 ? Math.round((attempt.score / attempt.totalMarks) * 100) : 0;
    return (
      <Row key={attempt._id}>
        <td className="p-4">
          <div className="flex items-center gap-3">
            <span className="w-5 text-xs font-semibold text-gray-400">{rank}</span>
            <Avatar
              src={attempt.studentId?.avatarUrl}
              name={initials(attempt.studentId?.firstName, attempt.studentId?.lastName)}
              size={32}
            />
            <div className="flex flex-col">
              <span className="font-medium">{fullName(attempt.studentId)}</span>
              <span className="text-xs text-gray-400">{attempt.studentId?.email}</span>
            </div>
          </div>
        </td>
        <td className="px-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{attempt.score}</span>
            <span className="text-xs text-gray-400">/ {attempt.totalMarks}</span>
            <Chip className={cn(percent >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>{percent}%</Chip>
            {attempt.autoSubmitted && <Chip className="bg-lama-yellow-light text-yellow-700">Auto</Chip>}
          </div>
        </td>
        <td className="hidden px-2 text-xs text-gray-500 md:table-cell">{formatDate(attempt.submittedAt, true)}</td>
        <td className="px-2">
          <Button
            size="sm"
            tone="outline"
            onClick={() => navigate(`/quizzes/${id}/review?studentId=${attempt.studentId?._id}`)}
          >
            <Eye className="h-3.5 w-3.5" /> Answers
          </Button>
        </td>
      </Row>
    );
  };

  return (
    <div className="m-4 mt-0 flex flex-col gap-4 pb-4">
      <Card className="flex flex-col gap-2">
        <CardHead
          title={quiz.title}
          right={
            <div className="flex items-center gap-2">
              <Button tone="outline" size="sm" onClick={downloadCsv} loading={downloading}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button tone="quiet" size="sm" onClick={() => navigate('/list/quizzes')}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </div>
          }
        />
        <p className="text-xs text-gray-500">
          {quiz.subjectId?.name} · {quiz.classId?.name} · {formatDate(quiz.startTime, true)} to {formatDate(quiz.endTime, true)}
        </p>
      </Card>

      <div className="flex flex-wrap gap-4">
        <Stat label="Submitted" value={summary.submitted} hint={`${summary.notAttempted} not attempted`} />
        <Stat label="Class size" value={summary.totalStudents} />
        <Stat label="Average" value={summary.averageScore} hint={`out of ${summary.totalMarks}`} />
        <Stat label="Highest" value={summary.highestScore} />
        <Stat label="Lowest" value={summary.lowestScore} />
      </div>

      {questionStats.length > 0 && (
        <Card className="flex flex-col gap-3">
          <CardHead title="Accuracy per question" />
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [`${value}%`, 'Correct']} contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb' }} />
                <Bar dataKey="accuracy" fill="#C3EBFA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <CardHead title="Question breakdown" />
        <div className="flex flex-col gap-3">
          {questionStats.map((stat, index) => (
            <div key={stat._id} className="rounded-md border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-gray-800">
                  <span className="mr-2 text-xs text-gray-400">Q{index + 1}</span>
                  {stat.text}
                </p>
                <Chip className={cn('shrink-0', stat.accuracy >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                  {stat.accuracy}% correct
                </Chip>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {stat.correct} of {stat.answered} answered correctly
              </p>

              {stat.optionCounts.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1">
                  {stat.optionCounts.map((option) => {
                    const share = stat.answered > 0 ? Math.round((option.count / stat.answered) * 100) : 0;
                    return (
                      <div key={option._id} className="flex items-center gap-2 text-xs">
                        <span className={cn('w-40 shrink-0 truncate', option.isCorrect && 'font-medium text-green-700')}>
                          {option.text}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={cn('h-full rounded-full', option.isCorrect ? 'bg-green-400' : 'bg-gray-300')}
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right text-gray-500">{option.count} ({share}%)</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">
                  Expected answer: <span className="font-medium text-green-700">{stat.correctAnswer}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHead title={`Attempts (${attempts.length})`} />
        {attempts.length === 0 ? (
          <EmptyState title="No submissions yet" detail="Results appear here as students submit." />
        ) : (
          <Table columns={columns} renderRow={(item) => renderRow(item, attempts.indexOf(item) + 1)} data={attempts} />
        )}
      </Card>
    </div>
  );
}
