import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useSelector } from 'react-redux';
import { Paperclip, Upload, Check } from 'lucide-react';
import { assignmentApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { Card, Loader, Note, Button, FormRow, Input, Textarea, Chip, Avatar, EmptyState } from '../design/primitives';
import { toast } from '../design/Toaster';
import { formatDate, fullName } from '../design/cn';

export default function AssignmentDetail() {
  const { id } = useParams();
  const { user } = useSelector((state) => state.auth);
  const canGrade = user?.role === 'admin' || user?.role === 'teacher';

  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [grades, setGrades] = useState({});

  const load = useCallback(async () => {
    try {
      setPayload(await assignmentApi.byId(id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('textAnswer', text);
      if (file) form.append('file', file);

      const response = await assignmentApi.submit(id, form);
      toast.success(response.message);
      setText('');
      setFile(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const grade = async (submissionId) => {
    const entry = grades[submissionId] || {};
    try {
      await assignmentApi.grade(submissionId, {
        marksObtained: Number(entry.marks),
        feedback: entry.feedback || '',
      });
      toast.success('Graded');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (error) return <div className="p-4"><Note tone="error">{error}</Note></div>;
  if (!payload) return <Loader label="Loading assignment" />;

  const { assignment, submissions } = payload;
  const mine = user?.role === 'student' ? submissions[0] : null;

  return (
    <div className="flex flex-col gap-4 p-4 lg:flex-row">
      <div className="flex w-full flex-col gap-4 lg:w-2/3">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">{assignment.title}</h1>
              <p className="mt-1 text-xs text-gray-500">
                {assignment.subjectId?.name} · {assignment.classId?.name} · set by {fullName(assignment.teacherId)}
              </p>
            </div>
            <Chip className="bg-lama-sky-light text-sky-700">Due {formatDate(assignment.dueDate, true)}</Chip>
          </div>

          {assignment.description && <p className="mt-4 whitespace-pre-line text-sm text-gray-600">{assignment.description}</p>}

          {assignment.attachmentUrl && (
            <a
              href={assignment.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-lama-purple-light px-3 py-2 text-xs font-medium text-indigo-700"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Open attachment
            </a>
          )}
        </Card>

        {canGrade && (
          <Card>
            <h2 className="text-lg font-semibold">Submissions ({submissions.length})</h2>
            {submissions.length === 0 ? (
              <EmptyState title="No submissions yet" />
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {submissions.map((submission) => (
                  <div key={submission._id} className="rounded-md border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Avatar src={submission.studentId?.avatarUrl} name={submission.studentId?.firstName} size={28} />
                        <div>
                          <p className="text-sm font-medium">{fullName(submission.studentId)}</p>
                          <p className="text-[11px] text-gray-400">{formatDate(submission.submittedAt, true)}</p>
                        </div>
                      </div>
                      <Chip className={submission.status === 'late' ? 'bg-red-100 text-red-700' : submission.status === 'graded' ? 'bg-green-100 text-green-700' : 'bg-lama-sky-light text-sky-700'}>
                        {submission.status}
                      </Chip>
                    </div>

                    {submission.textAnswer && <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{submission.textAnswer}</p>}
                    {submission.fileUrl && (
                      <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                        <Paperclip className="h-3 w-3" />
                        Download file
                      </a>
                    )}

                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <Input
                        type="number"
                        min="0"
                        max={assignment.maxMarks}
                        placeholder={`/ ${assignment.maxMarks}`}
                        defaultValue={submission.marksObtained ?? ''}
                        onChange={(e) => setGrades({ ...grades, [submission._id]: { ...grades[submission._id], marks: e.target.value } })}
                        className="h-9 w-24"
                      />
                      <Input
                        placeholder="Feedback"
                        defaultValue={submission.feedback}
                        onChange={(e) => setGrades({ ...grades, [submission._id]: { ...grades[submission._id], feedback: e.target.value } })}
                        className="h-9 flex-1"
                      />
                      <Button size="sm" onClick={() => grade(submission._id)}>
                        <Check className="h-3.5 w-3.5" />
                        Grade
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="w-full lg:w-1/3">
        {user?.role === 'student' && (
          <Card>
            <h2 className="text-lg font-semibold">Your submission</h2>

            {mine ? (
              <div className="mt-3 flex flex-col gap-2">
                <Chip className={mine.status === 'graded' ? 'bg-green-100 text-green-700' : 'bg-lama-sky-light text-sky-700'}>
                  {mine.status}
                </Chip>
                <p className="text-xs text-gray-400">Submitted {formatDate(mine.submittedAt, true)}</p>
                {mine.status === 'graded' && (
                  <Note tone="success">
                    {mine.marksObtained}/{assignment.maxMarks}
                    {mine.feedback && <span className="mt-1 block">{mine.feedback}</span>}
                  </Note>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-400">Not submitted yet.</p>
            )}

            {mine?.status !== 'graded' && (
              <div className="mt-4 flex flex-col gap-3">
                <FormRow label="Answer">
                  <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your answer, or attach a file" />
                </FormRow>
                <FormRow label="File">
                  <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="pt-2" />
                </FormRow>
                <Button onClick={submit} loading={submitting} className="w-full">
                  <Upload className="h-4 w-4" />
                  {mine ? 'Resubmit' : 'Submit'}
                </Button>
              </div>
            )}
          </Card>
        )}

        {user?.role === 'parent' && (
          <Card>
            <h2 className="text-lg font-semibold">Your children</h2>
            {submissions.length === 0 ? (
              <p className="mt-2 text-xs text-gray-400">No submission recorded.</p>
            ) : (
              submissions.map((submission) => (
                <div key={submission._id} className="mt-3 rounded-md bg-gray-50 p-3">
                  <p className="text-sm font-medium">{fullName(submission.studentId)}</p>
                  <p className="text-xs text-gray-500">
                    {submission.status}
                    {submission.status === 'graded' && ` · ${submission.marksObtained}/${assignment.maxMarks}`}
                  </p>
                </div>
              ))
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
