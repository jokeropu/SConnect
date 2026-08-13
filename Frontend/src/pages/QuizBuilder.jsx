import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Plus, Trash2, ArrowLeft, GripVertical } from 'lucide-react';
import { quizApi, classApi, subjectApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { Card, CardHead, Loader, Note, Button, FormRow, Input, Textarea, Select, Chip, RoundIcon } from '../design/primitives';
import { toast } from '../design/Toaster';

const TYPES = [
  { value: 'single', label: 'Single correct' },
  { value: 'multiple', label: 'Multiple correct' },
  { value: 'text', label: 'Fill in the blank' },
  { value: 'integer', label: 'Numeric answer' },
];

const blankOption = () => ({ text: '', isCorrect: false });

const blankQuestion = () => ({
  text: '',
  type: 'single',
  marks: 1,
  negativeMarks: 0,
  correctAnswer: '',
  options: [blankOption(), blankOption()],
});

const EMPTY = {
  title: '',
  description: '',
  subjectId: '',
  classId: '',
  startTime: '',
  endTime: '',
  timeLimit: 30,
  negativeMarking: false,
};

export default function QuizBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = !!id;

  const [meta, setMeta] = useState(EMPTY);
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [options, setOptions] = useState({ classes: [], subjects: [] });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([classApi.list({ limit: 100 }), subjectApi.list({ limit: 100 })])
      .then(([classes, subjects]) => setOptions({ classes: classes.data, subjects: subjects.data }))
      .catch(() => setOptions({ classes: [], subjects: [] }));
  }, []);

  useEffect(() => {
    if (!editing) return;
    quizApi
      .byId(id)
      .then(({ quiz }) => {
        setMeta({
          title: quiz.title,
          description: quiz.description || '',
          subjectId: quiz.subjectId?._id || quiz.subjectId || '',
          classId: quiz.classId?._id || quiz.classId || '',
          startTime: String(quiz.startTime).slice(0, 16),
          endTime: String(quiz.endTime).slice(0, 16),
          timeLimit: quiz.timeLimit,
          negativeMarking: quiz.negativeMarking,
        });
        setQuestions(
          quiz.questions.map((q) => ({
            text: q.text,
            type: q.type,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            correctAnswer: q.correctAnswer || '',
            options: q.options.length > 0 ? q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) : [blankOption(), blankOption()],
          }))
        );
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, editing]);

  const patchQuestion = (index, patch) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const patchOption = (qIndex, oIndex, patch) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        return { ...q, options: q.options.map((o, j) => (j === oIndex ? { ...o, ...patch } : o)) };
      })
    );
  };

  const pickCorrect = (qIndex, oIndex, checked) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        if (q.type === 'single') {
          return { ...q, options: q.options.map((o, j) => ({ ...o, isCorrect: j === oIndex })) };
        }
        return { ...q, options: q.options.map((o, j) => (j === oIndex ? { ...o, isCorrect: checked } : o)) };
      })
    );
  };

  const changeType = (index, type) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        if (type !== 'single') return { ...q, type };

        const firstCorrect = q.options.findIndex((o) => o.isCorrect);
        return { ...q, type, options: q.options.map((o, j) => ({ ...o, isCorrect: j === firstCorrect })) };
      })
    );
  };

  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  const validate = () => {
    if (!meta.title.trim()) return 'Give the quiz a title';
    if (!meta.subjectId || !meta.classId) return 'Pick a subject and a class';
    if (!meta.startTime || !meta.endTime) return 'Set the opening and closing time';
    if (new Date(meta.endTime) <= new Date(meta.startTime)) return 'The closing time must be after the opening time';
    if (Number(meta.timeLimit) < 1) return 'Time limit must be at least 1 minute';

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return `Question ${i + 1} needs text`;
      if (q.type === 'single' || q.type === 'multiple') {
        const filled = q.options.filter((o) => o.text.trim());
        if (filled.length < 2) return `Question ${i + 1} needs at least 2 options`;
        const correct = q.options.filter((o) => o.isCorrect && o.text.trim()).length;
        if (correct === 0) return `Question ${i + 1} needs a correct option marked`;
        if (q.type === 'single' && correct > 1) return `Question ${i + 1} is single-correct but has ${correct} marked`;
      } else if (!String(q.correctAnswer).trim()) {
        return `Question ${i + 1} needs a correct answer`;
      } else if (q.type === 'integer' && Number.isNaN(Number(q.correctAnswer))) {
        return `Question ${i + 1} expects a numeric answer`;
      }
    }
    return null;
  };

  const save = async (status) => {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...meta,
        timeLimit: Number(meta.timeLimit),
        questions: questions.map((q) => ({
          text: q.text.trim(),
          type: q.type,
          marks: Number(q.marks) || 0,
          negativeMarks: Number(q.negativeMarks) || 0,
          correctAnswer: q.type === 'text' || q.type === 'integer' ? String(q.correctAnswer).trim() : null,
          options:
            q.type === 'single' || q.type === 'multiple'
              ? q.options.filter((o) => o.text.trim()).map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }))
              : [],
        })),
      };

      if (editing) {
        await quizApi.update(id, payload);
        if (status === 'published') await quizApi.setStatus(id, 'published');
        toast.success(status === 'published' ? 'Quiz published' : 'Quiz saved');
      } else {
        const response = await quizApi.create({ ...payload, status });
        toast.success(status === 'published' ? 'Quiz published' : 'Draft saved');
        if (!response.quiz) return;
      }
      navigate('/list/quizzes');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading quiz" />;

  return (
    <div className="m-4 mt-0 flex flex-col gap-4">
      {error && <Note tone="error">{error}</Note>}

      <Card className="flex flex-col gap-4">
        <CardHead
          title={editing ? 'Edit quiz' : 'Create quiz'}
          right={
            <Button tone="quiet" size="sm" onClick={() => navigate('/list/quizzes')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          }
        />

        <div className="flex flex-col gap-3.5">
          <FormRow label="Title" required>
            <Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="Algebra — Chapter 3 quiz" />
          </FormRow>
          <FormRow label="Description">
            <Textarea rows={2} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="Instructions students see before starting" />
          </FormRow>
          <div className="grid gap-3 md:grid-cols-2">
            <FormRow label="Subject" required>
              <Select value={meta.subjectId} onChange={(e) => setMeta({ ...meta, subjectId: e.target.value })}>
                <option value="">Select</option>
                {options.subjects.map((entry) => (
                  <option key={entry._id} value={entry._id}>{entry.name}</option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Class" required>
              <Select value={meta.classId} onChange={(e) => setMeta({ ...meta, classId: e.target.value })}>
                <option value="">Select</option>
                {options.classes.map((entry) => (
                  <option key={entry._id} value={entry._id}>{entry.name}</option>
                ))}
              </Select>
            </FormRow>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <FormRow label="Opens" required>
              <Input type="datetime-local" value={meta.startTime} onChange={(e) => setMeta({ ...meta, startTime: e.target.value })} />
            </FormRow>
            <FormRow label="Closes" required>
              <Input type="datetime-local" value={meta.endTime} onChange={(e) => setMeta({ ...meta, endTime: e.target.value })} />
            </FormRow>
            <FormRow label="Time limit" hint="minutes" required>
              <Input type="number" min="1" max="600" value={meta.timeLimit} onChange={(e) => setMeta({ ...meta, timeLimit: e.target.value })} />
            </FormRow>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={meta.negativeMarking}
              onChange={(e) => setMeta({ ...meta, negativeMarking: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            Apply negative marking for wrong answers
          </label>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHead
          title={`Questions (${questions.length})`}
          right={<Chip className="bg-lama-purple-light text-indigo-700">{totalMarks} marks total</Chip>}
        />

        {questions.map((question, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-md border border-gray-200 p-4">
            <div className="flex items-start gap-2">
              <GripVertical className="mt-2 h-4 w-4 shrink-0 text-gray-300" />
              <span className="mt-2 text-xs font-semibold text-gray-400">Q{index + 1}</span>
              <div className="flex-1">
                <Textarea
                  rows={2}
                  value={question.text}
                  onChange={(e) => patchQuestion(index, { text: e.target.value })}
                  placeholder="What is the value of x in 2x + 4 = 10?"
                />
              </div>
              {questions.length > 1 && (
                <RoundIcon
                  icon={Trash2}
                  tone="purple"
                  label="Remove question"
                  className="mt-1"
                  onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== index))}
                />
              )}
            </div>

            <div className="grid gap-3 pl-6 md:grid-cols-3">
              <FormRow label="Type">
                <Select value={question.type} onChange={(e) => changeType(index, e.target.value)}>
                  {TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Marks">
                <Input type="number" min="0" value={question.marks} onChange={(e) => patchQuestion(index, { marks: e.target.value })} />
              </FormRow>
              <FormRow label="Negative marks" hint={meta.negativeMarking ? '' : 'disabled'}>
                <Input
                  type="number"
                  min="0"
                  disabled={!meta.negativeMarking}
                  value={question.negativeMarks}
                  onChange={(e) => patchQuestion(index, { negativeMarks: e.target.value })}
                />
              </FormRow>
            </div>

            {question.type === 'single' || question.type === 'multiple' ? (
              <div className="flex flex-col gap-2 pl-6">
                <span className="text-xs font-medium text-gray-500">
                  Options <span className="text-gray-400">— tick the correct one{question.type === 'multiple' ? '(s)' : ''}</span>
                </span>
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <input
                      type={question.type === 'single' ? 'radio' : 'checkbox'}
                      name={`correct-${index}`}
                      checked={option.isCorrect}
                      onChange={(e) => pickCorrect(index, oIndex, e.target.checked)}
                      className="h-4 w-4 shrink-0 border-gray-300"
                      aria-label={`Mark option ${oIndex + 1} correct`}
                    />
                    <Input
                      value={option.text}
                      onChange={(e) => patchOption(index, oIndex, { text: e.target.value })}
                      placeholder={`Option ${oIndex + 1}`}
                      className="h-9"
                    />
                    {question.options.length > 2 && (
                      <RoundIcon
                        icon={Trash2}
                        tone="purple"
                        label="Remove option"
                        onClick={() => patchQuestion(index, { options: question.options.filter((_, j) => j !== oIndex) })}
                      />
                    )}
                  </div>
                ))}
                <Button
                  tone="quiet"
                  size="sm"
                  className="self-start"
                  onClick={() => patchQuestion(index, { options: [...question.options, blankOption()] })}
                >
                  <Plus className="h-3.5 w-3.5" /> Add option
                </Button>
              </div>
            ) : (
              <div className="pl-6">
                <FormRow label="Correct answer" hint={question.type === 'integer' ? 'numeric' : 'case-insensitive'}>
                  <Input
                    type={question.type === 'integer' ? 'number' : 'text'}
                    value={question.correctAnswer}
                    onChange={(e) => patchQuestion(index, { correctAnswer: e.target.value })}
                    placeholder={question.type === 'integer' ? '3' : 'Photosynthesis'}
                  />
                </FormRow>
              </div>
            )}
          </div>
        ))}

        <Button tone="outline" className="self-start" onClick={() => setQuestions((prev) => [...prev, blankQuestion()])}>
          <Plus className="h-4 w-4" /> Add question
        </Button>
      </Card>

      <div className="flex items-center justify-end gap-2 pb-4">
        <Button tone="outline" onClick={() => navigate('/list/quizzes')}>Cancel</Button>
        <Button tone="sky" onClick={() => save('draft')} loading={saving}>Save as draft</Button>
        <Button onClick={() => save('published')} loading={saving}>Publish</Button>
      </div>
    </div>
  );
}
