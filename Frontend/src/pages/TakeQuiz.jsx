import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Clock, ChevronLeft, ChevronRight, Send, CheckCircle2 } from 'lucide-react';
import { quizApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { Card, CardHead, Loader, Note, Button, Input, Chip } from '../design/primitives';
import { ConfirmModal } from '../design/Modal';
import { toast } from '../design/Toaster';
import { cn } from '../design/cn';

const formatClock = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export default function TakeQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [responses, setResponses] = useState({});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const skewRef = useRef(0);
  const submittedRef = useRef(false);

  const storageKey = `quiz_draft_${id}`;

  const submit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);

      try {
        const response = await quizApi.submit(id, responses);
        localStorage.removeItem(storageKey);
        setResult(response);
        if (auto) toast.success('Time is up — your answers were submitted');
      } catch (err) {
        submittedRef.current = false;
        toast.error(errorMessage(err));
      } finally {
        setSubmitting(false);
        setConfirming(false);
      }
    },
    [id, responses, storageKey]
  );

  useEffect(() => {
    let cancelled = false;

    quizApi
      .start(id)
      .then((data) => {
        if (cancelled) return;
        skewRef.current = new Date(data.serverTime).getTime() - Date.now();
        setSession(data);
        setRemaining(new Date(data.deadline).getTime() - (Date.now() + skewRef.current));

        const saved = localStorage.getItem(`quiz_draft_${id}`);
        if (saved) {
          try {
            setResponses(JSON.parse(saved));
          } catch {
          }
        }
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!session || result) return undefined;

    const tick = setInterval(() => {
      const left = new Date(session.deadline).getTime() - (Date.now() + skewRef.current);
      setRemaining(left);
      if (left <= 0) submit(true);
    }, 1000);

    return () => clearInterval(tick);
  }, [session, result, submit]);

  useEffect(() => {
    if (session && !result) localStorage.setItem(storageKey, JSON.stringify(responses));
  }, [responses, session, result, storageKey]);

  if (error) {
    return (
      <div className="m-4 mt-0 flex flex-col gap-4">
        <Note tone="error">{error}</Note>
        <Button tone="outline" className="self-start" onClick={() => navigate('/list/quizzes')}>Back to quizzes</Button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="m-4 mt-0">
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" strokeWidth={1.5} />
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">Quiz submitted</h1>
            <p className="text-sm text-gray-500">
              You scored <span className="font-semibold text-gray-800">{result.score}</span> out of {result.totalMarks}
            </p>
          </div>
          {result.autoSubmitted && <Note tone="warning">This was submitted after your time ran out.</Note>}
          <Note tone="info">
            {result.reviewAvailable
              ? 'The quiz is closed — you can review every question and answer now.'
              : 'Correct answers unlock once the quiz closes for everyone.'}
          </Note>
          <div className="flex gap-2">
            <Button tone="outline" onClick={() => navigate('/list/quizzes')}>Back to quizzes</Button>
            {result.reviewAvailable && <Button onClick={() => navigate(`/quizzes/${id}/review`)}>Review answers</Button>}
          </div>
        </Card>
      </div>
    );
  }

  if (!session) return <Loader label="Preparing your quiz" />;

  const { quiz } = session;
  const question = quiz.questions[index];
  const answered = quiz.questions.filter((q) => {
    const value = responses[q._id];
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '';
  }).length;

  const setChoice = (questionId, optionId, type) => {
    setResponses((prev) => {
      if (type === 'single') return { ...prev, [questionId]: [optionId] };
      const current = prev[questionId] || [];
      const next = current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId];
      return { ...prev, [questionId]: next };
    });
  };

  const isPicked = (questionId, optionId) => (responses[questionId] || []).includes(optionId);
  const lowTime = remaining < 60000;

  return (
    <div className="m-4 mt-0 flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">{quiz.title}</h1>
          <p className="text-xs text-gray-500">
            {quiz.questions.length} questions · {quiz.totalMarks} marks
            {quiz.negativeMarking && ' · negative marking on'}
          </p>
        </div>
        <div className={cn('flex items-center gap-2 rounded-md px-3 py-2 font-mono text-lg font-semibold', lowTime ? 'bg-red-50 text-red-600' : 'bg-lama-sky-light text-sky-700')}>
          <Clock className="h-4 w-4" />
          {formatClock(remaining)}
        </div>
      </Card>

      {lowTime && <Note tone="warning">Less than a minute left — your answers submit automatically when the timer ends.</Note>}

      <div className="flex flex-col gap-4 lg:flex-row">
        <Card className="flex flex-1 flex-col gap-4">
          <CardHead
            title={`Question ${index + 1} of ${quiz.questions.length}`}
            right={
              <Chip className="bg-lama-purple-light text-indigo-700">
                {question.marks} mark{question.marks === 1 ? '' : 's'}
              </Chip>
            }
          />

          <p className="whitespace-pre-wrap text-sm text-gray-800">{question.text}</p>
          {question.imageUrl && <img src={question.imageUrl} alt="" className="max-h-72 rounded-md object-contain" />}

          {question.type === 'single' || question.type === 'multiple' ? (
            <div className="flex flex-col gap-2">
              {question.type === 'multiple' && <span className="text-xs text-gray-400">Select all that apply</span>}
              {question.options.map((option) => (
                <button
                  key={option._id}
                  type="button"
                  onClick={() => setChoice(question._id, option._id, question.type)}
                  className={cn(
                    'flex items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors',
                    isPicked(question._id, option._id)
                      ? 'border-indigo-300 bg-lama-purple-light'
                      : 'border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center border',
                      question.type === 'single' ? 'rounded-full' : 'rounded-sm',
                      isPicked(question._id, option._id) ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                    )}
                  >
                    {isPicked(question._id, option._id) && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  {option.text}
                </button>
              ))}
            </div>
          ) : (
            <Input
              type={question.type === 'integer' ? 'number' : 'text'}
              value={responses[question._id] ?? ''}
              onChange={(e) => setResponses((prev) => ({ ...prev, [question._id]: e.target.value }))}
              placeholder="Type your answer"
            />
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <Button tone="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            {index === quiz.questions.length - 1 ? (
              <Button onClick={() => setConfirming(true)}>
                <Send className="h-4 w-4" /> Submit quiz
              </Button>
            ) : (
              <Button tone="sky" onClick={() => setIndex((i) => i + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>

        <Card className="flex h-fit w-full flex-col gap-3 lg:w-64">
          <CardHead title="Progress" />
          <p className="text-xs text-gray-500">{answered} of {quiz.questions.length} answered</p>
          <div className="grid grid-cols-6 gap-2 lg:grid-cols-5">
            {quiz.questions.map((q, i) => {
              const value = responses[q._id];
              const done = Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '';
              return (
                <button
                  key={q._id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    'h-8 w-8 rounded-md text-xs font-semibold transition-colors',
                    i === index && 'ring-2 ring-indigo-400',
                    done ? 'bg-lama-purple text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <Button className="w-full" onClick={() => setConfirming(true)}>
            <Send className="h-4 w-4" /> Submit quiz
          </Button>
        </Card>
      </div>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => submit(false)}
        loading={submitting}
        confirmLabel="Submit"
        title="Submit this quiz?"
        message={
          answered < quiz.questions.length
            ? `You have answered ${answered} of ${quiz.questions.length} questions. Unanswered ones score zero and you cannot come back.`
            : 'You cannot change your answers after submitting.'
        }
      />
    </div>
  );
}
