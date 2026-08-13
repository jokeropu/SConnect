import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useSelector } from 'react-redux';
import { ArrowLeft, Check, X, Minus } from 'lucide-react';
import { quizApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { Card, CardHead, Loader, Note, Button, Chip } from '../design/primitives';
import { cn, formatDate, fullName } from '../design/cn';

const VERDICT = {
  correct: { icon: Check, label: 'Correct', className: 'bg-green-100 text-green-700' },
  wrong: { icon: X, label: 'Wrong', className: 'bg-red-100 text-red-700' },
  skipped: { icon: Minus, label: 'Not answered', className: 'bg-gray-100 text-gray-500' },
};

export default function QuizReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const isStudent = user?.role === 'student';
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('studentId');

  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPayload(null);
    setError('');
    quizApi
      .review(id, studentId || undefined)
      .then(setPayload)
      .catch((err) => setError(errorMessage(err)));
  }, [id, studentId]);

  if (error) {
    return (
      <div className="m-4 mt-0 flex flex-col gap-4">
        <Note tone="error">{error}</Note>
        <Button tone="outline" className="self-start" onClick={() => navigate('/list/quizzes')}>Back to quizzes</Button>
      </div>
    );
  }

  if (!payload) return <Loader label="Loading answers" />;

  const { quiz, attempt } = payload;
  const answerFor = (questionId) => attempt?.answers.find((a) => String(a.questionId) === String(questionId));

  const verdictOf = (question) => {
    const answer = answerFor(question._id);
    if (!attempt || !answer) return 'skipped';
    const empty = answer.selectedOptions.length === 0 && !answer.textResponse;
    if (empty) return 'skipped';
    return answer.isCorrect ? 'correct' : 'wrong';
  };

  return (
    <div className="m-4 mt-0 flex flex-col gap-4 pb-4">
      <Card className="flex flex-col gap-3">
        <CardHead
          title={quiz.title}
          right={
            <Button tone="quiet" size="sm" onClick={() => navigate('/list/quizzes')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          }
        />
        <p className="text-xs text-gray-500">
          {quiz.subjectId?.name} · {quiz.classId?.name} · closed {formatDate(quiz.endTime, true)}
        </p>
        {quiz.description && <p className="text-sm text-gray-600">{quiz.description}</p>}

        {attempt ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-lama-purple-light px-4 py-3">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">
                {isStudent ? 'Your score' : `${fullName(attempt.studentId)}'s score`}
              </span>
              <span className="text-xl font-semibold text-gray-800">
                {attempt.score} <span className="text-sm font-normal text-gray-500">/ {attempt.totalMarks}</span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Submitted</span>
              <span className="text-sm text-gray-700">{formatDate(attempt.submittedAt, true)}</span>
            </div>
            {attempt.autoSubmitted && <Chip className="bg-lama-yellow-light text-yellow-700">Auto-submitted</Chip>}
          </div>
        ) : (
          <Note tone="info">
            {isStudent
              ? 'You did not attempt this quiz. The questions and correct answers are shown below.'
              : 'No attempt recorded for this student.'}
          </Note>
        )}
      </Card>

      {quiz.questions.map((question, index) => {
        const answer = answerFor(question._id);
        const verdict = verdictOf(question);
        const Icon = VERDICT[verdict].icon;

        return (
          <Card key={question._id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-400">Question {index + 1}</span>
                <p className="whitespace-pre-wrap text-sm font-medium text-gray-800">{question.text}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {attempt && (
                  <Chip className={VERDICT[verdict].className}>
                    <Icon className="mr-1 h-3 w-3" /> {VERDICT[verdict].label}
                  </Chip>
                )}
                <span className="text-xs text-gray-400">
                  {attempt ? `${answer?.marksAwarded ?? 0} / ${question.marks}` : `${question.marks} mark${question.marks === 1 ? '' : 's'}`}
                </span>
              </div>
            </div>

            {question.imageUrl && <img src={question.imageUrl} alt="" className="max-h-64 rounded-md object-contain" />}

            {question.options.length > 0 ? (
              <div className="flex flex-col gap-2">
                {question.options.map((option) => {
                  const picked = (answer?.selectedOptions || []).some((sel) => String(sel) === String(option._id));
                  return (
                    <div
                      key={option._id}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm',
                        option.isCorrect && 'border-green-300 bg-green-50',
                        picked && !option.isCorrect && 'border-red-300 bg-red-50',
                        !option.isCorrect && !picked && 'border-gray-200'
                      )}
                    >
                      <span className={cn(option.isCorrect && 'font-medium text-green-800')}>{option.text}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {picked && <Chip className="bg-white text-gray-600">Your answer</Chip>}
                        {option.isCorrect && <Check className="h-4 w-4 text-green-600" />}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm">
                  <span className="text-xs text-gray-500">Correct answer</span>
                  <p className="font-medium text-green-800">{question.correctAnswer}</p>
                </div>
                {attempt && (
                  <div
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm',
                      verdict === 'correct' ? 'border-green-300 bg-green-50' : 'border-gray-200'
                    )}
                  >
                    <span className="text-xs text-gray-500">Your answer</span>
                    <p className="font-medium text-gray-800">{answer?.textResponse || '—'}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
