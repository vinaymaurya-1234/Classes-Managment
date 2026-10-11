import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, FileSpreadsheet, FileText, LoaderCircle, Plus, Printer, Save, Send, ShieldCheck, Upload, XCircle } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Card, SectionIntro } from '../components/common/UI'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import './exam-management.css'

const divisions = ['A', 'B', 'C']
const stds = [10, 11, 12]
const emptyQuestion = { std: '10', division: 'A', subject: '', chapter: '', type: 'mcq', text: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A', explanation: '', marks: '1', difficulty: 'medium' }
const emptyPaper = { title: '', std: '10', division: 'A', subject: '', instructions: '', questionCount: '10', durationMinutes: '60', difficulty: '' }
const emptyExam = { paperId: '', title: '', type: 'unit', startsAt: '', durationMinutes: '60', instructions: '' }
const formatDate = value => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not scheduled'
const className = (std, division) => `Class ${std} - ${division}`
const getRows = workbook => {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : []
}
const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const guessColumn = (headers, aliases) => headers.find(header => aliases.includes(normalized(header))) || ''

export default function ExamManagementPage() {
  const { role } = useOutletContext()
  const { token } = useAuth()
  const isTeacher = role === 'teacher'
  const isPrincipal = role === 'principal'
  const isStudent = role === 'student'
  const isParent = role === 'parent'
  const [tab, setTab] = useState(isTeacher ? 'questions' : isPrincipal ? 'schedule' : 'exams')
  const [questions, setQuestions] = useState([])
  const [papers, setPapers] = useState([])
  const [exams, setExams] = useState([])
  const [results, setResults] = useState([])
  const [attempts, setAttempts] = useState([])
  const [classes, setClasses] = useState([])
  const [filters, setFilters] = useState({ std: '10', division: 'A', subject: '', chapter: '', difficulty: '', search: '' })
  const [questionForm, setQuestionForm] = useState(emptyQuestion)
  const [paperForm, setPaperForm] = useState(emptyPaper)
  const [examForm, setExamForm] = useState(emptyExam)
  const [selectedQuestions, setSelectedQuestions] = useState([])
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [importRows, setImportRows] = useState([])
  const [importHeaders, setImportHeaders] = useState([])
  const [columnMap, setColumnMap] = useState({})
  const [importName, setImportName] = useState('')
  const [activeAttempt, setActiveAttempt] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [searchText, setSearchText] = useState('')

  const loadQuestions = useCallback(async () => {
    if (!isTeacher && !isPrincipal) return
    const query = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => { if (value && (key !== 'std' || value)) query.set(key, value) })
    const response = await api.get('/api/exams/questions?' + query.toString(), token)
    setQuestions(response.data || [])
  }, [token, isTeacher, isPrincipal, filters])

  const loadPapers = useCallback(async () => {
    if (!isTeacher && !isPrincipal) return
    const response = await api.get('/api/exams/papers', token)
    setPapers(response.data || [])
  }, [token, isTeacher, isPrincipal])

  const loadExams = useCallback(async () => {
    const response = await api.get('/api/exams/exams', token)
    setExams(response.data || [])
  }, [token])

  const loadResults = useCallback(async () => {
    const response = await api.get('/api/exams/results', token)
    setResults(response.data || [])
  }, [token])

  const loadAttempts = useCallback(async () => {
    if (!isTeacher && !isPrincipal) return
    const response = await api.get('/api/exams/attempts', token)
    setAttempts(response.data || [])
  }, [token, isTeacher, isPrincipal])

  const loadAll = useCallback(async () => {
    setLoading(true); setError('')
    try {
      await Promise.all([loadQuestions(), loadPapers(), loadExams(), loadResults(), loadAttempts()])
      if (isTeacher) {
        const response = await api.get('/api/teacher/classes', token)
        setClasses(response.classes || [])
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [loadQuestions, loadPapers, loadExams, loadResults, loadAttempts, isTeacher, token])

  useEffect(() => { if (token) loadAll() }, [token, loadAll])

  useEffect(() => {
    if (!activeAttempt) return undefined
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(activeAttempt.endsAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0 && activeAttempt.status === 'in_progress') submitExam(true)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  // submitExam is intentionally accessed through the current render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAttempt?.attemptId, activeAttempt?.endsAt])

  useEffect(() => {
    if (!activeAttempt || activeAttempt.status !== 'in_progress') return undefined
    const timer = setTimeout(() => saveAnswers(activeAttempt, true), 900)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAttempt?.answers])

  const filteredQuestions = useMemo(() => questions.filter(q => {
    const query = filters.search.toLowerCase().trim()
    return (!filters.subject || q.subject === filters.subject) &&
      (!filters.chapter || q.chapter === filters.chapter) &&
      (!filters.difficulty || q.difficulty === filters.difficulty) &&
      (!query || (q.text + ' ' + q.subject + ' ' + q.chapter).toLowerCase().includes(query))
  }), [questions, filters])

  const subjects = useMemo(() => [...new Set(questions.map(q => q.subject).filter(Boolean))].sort(), [questions])
  const chapters = useMemo(() => [...new Set(questions.filter(q => q.subject === filters.subject || !filters.subject).map(q => q.chapter).filter(Boolean))].sort(), [questions, filters.subject])
  const formatDuration = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`

  const saveQuestion = async event => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const body = { std: Number(questionForm.std), division: questionForm.division, subject: questionForm.subject, chapter: questionForm.chapter, type: questionForm.type, text: questionForm.text, options: ['A','B','C','D'].map(key => ({ key, text: questionForm['option' + key] })).filter(o => o.text.trim()), correctAnswer: questionForm.correctAnswer, explanation: questionForm.explanation, marks: Number(questionForm.marks), difficulty: questionForm.difficulty }
      if (editingQuestion) await api.put('/api/exams/questions/' + editingQuestion, body, token)
      else await api.post('/api/exams/questions', body, token)
      setQuestionForm(emptyQuestion); setEditingQuestion(null); setNotice(editingQuestion ? 'Question updated.' : 'Question added to the bank.'); await loadQuestions()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const editQuestion = question => {
    setEditingQuestion(question._id)
    setQuestionForm({ ...emptyQuestion, std: String(question.className.match(/\d+/)?.[0] || 10), division: question.division || 'A', subject: question.subject, chapter: question.chapter || '', type: question.type, text: question.text, optionA: question.options?.find(o => o.key === 'A')?.text || '', optionB: question.options?.find(o => o.key === 'B')?.text || '', optionC: question.options?.find(o => o.key === 'C')?.text || '', optionD: question.options?.find(o => o.key === 'D')?.text || '', correctAnswer: question.correctAnswer || 'A', explanation: question.explanation || '', marks: String(question.marks || 1), difficulty: question.difficulty || 'medium' })
    setTab('questions')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteQuestion = async id => {
    if (!window.confirm('Delete this question from the bank? Existing saved papers are not changed.')) return
    try { await api.delete('/api/exams/questions/' + id, token); setNotice('Question deleted.'); await loadQuestions() } catch (err) { setError(err.message) }
  }

  const parseFile = async file => {
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const rows = getRows(workbook)
      if (!rows.length) throw new Error('The spreadsheet has no question rows.')
      const headers = Object.keys(rows[0])
      setImportRows(rows); setImportHeaders(headers); setImportName(file.name)
      setColumnMap({
        std: guessColumn(headers, ['std','standard','class','grade']),
        division: guessColumn(headers, ['division','section']),
        subject: guessColumn(headers, ['subject','subjectname']),
        chapter: guessColumn(headers, ['chapter','chaptername','unit']),
        text: guessColumn(headers, ['question','questiontext','text','questionstatement']),
        optionA: guessColumn(headers, ['optiona','option1','a','optiona']),
        optionB: guessColumn(headers, ['optionb','option2','b','optionb']),
        optionC: guessColumn(headers, ['optionc','option3','c','optionc']),
        optionD: guessColumn(headers, ['optiond','option4','d','optiond']),
        correctAnswer: guessColumn(headers, ['correctanswer','answer','correctoption','key']),
        type: guessColumn(headers, ['type','questiontype']),
        marks: guessColumn(headers, ['marks','mark','score']),
        difficulty: guessColumn(headers, ['difficulty','level']),
        explanation: guessColumn(headers, ['explanation','solution','reason']),
      })
    } catch (err) { setError(err.message) }
  }

  const importQuestions = async () => {
    setSaving(true); setError(''); setNotice('')
    try {
      const mapped = importRows.map(row => {
        const value = key => columnMap[key] ? row[columnMap[key]] : ''
        const stdValue = String(value('std') || filters.std).match(/\d+/)?.[0] || filters.std
        return { std: Number(stdValue), division: String(value('division') || filters.division).trim().toUpperCase(), subject: String(value('subject') || filters.subject).trim(), chapter: String(value('chapter') || '').trim(), text: String(value('text') || '').trim(), optionA: String(value('optionA') || '').trim(), optionB: String(value('optionB') || '').trim(), optionC: String(value('optionC') || '').trim(), optionD: String(value('optionD') || '').trim(), correctAnswer: String(value('correctAnswer') || '').trim(), type: String(value('type') || 'mcq').toLowerCase(), marks: Number(value('marks') || 1), difficulty: String(value('difficulty') || 'medium').toLowerCase(), explanation: String(value('explanation') || '').trim() }
      })
      const response = await api.post('/api/exams/questions/import', { rows: mapped }, token)
      setNotice(`Imported ${response.imported} questions; skipped ${response.skipped}.`)
      if (response.errors?.length) setError(response.errors.slice(0, 8).map(e => `Row ${e.row}: ${e.message}`).join(' · '))
      setImportRows([]); setImportHeaders([]); setImportName(''); await loadQuestions()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const createPaper = async event => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const response = await api.post('/api/exams/papers', { ...paperForm, std: Number(paperForm.std), durationMinutes: Number(paperForm.durationMinutes), questionCount: Number(paperForm.questionCount), questionIds: selectedQuestions }, token)
      setPapers(current => [response.data, ...current]); setNotice('Question paper saved as a draft. Preview it and submit for principal approval.'); setTab('papers'); setSelectedQuestions([])
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const paperAction = async (paper, action, note = '') => {
    setSaving(true); setError(''); setNotice('')
    try {
      if (isTeacher) {
        await api.post('/api/exams/papers/' + paper._id + '/submit', {}, token)
        setNotice('Paper submitted for principal approval.')
      } else {
        await api.put('/api/exams/papers/' + paper._id + '/review', { action, note }, token)
        setNotice(action === 'approve' ? 'Paper approved.' : 'Paper returned to the teacher.')
      }
      await loadPapers()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const createExam = async event => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      await api.post('/api/exams/exams', { ...examForm, startsAt: new Date(examForm.startsAt).toISOString(), durationMinutes: Number(examForm.durationMinutes) }, token)
      setExamForm(emptyExam); setNotice('Exam scheduled for the selected class and division.'); await loadExams(); setTab('schedule')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const startExam = async exam => {
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await api.post('/api/exams/exams/' + exam._id + '/start', {}, token)
      setActiveAttempt({ ...response, status: 'in_progress' }); setCurrentQuestion(0); setSecondsLeft(Math.max(0, Math.ceil((new Date(response.endsAt).getTime() - Date.now()) / 1000)))
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const saveAnswers = async (attempt = activeAttempt, quiet = false) => {
    if (!attempt?.exam?._id || !attempt.attemptId) return
    try {
      await api.put('/api/exams/exams/' + attempt.exam._id + '/answers', { answers: attempt.answers }, token)
      if (!quiet) setNotice('Answers saved.')
    } catch (err) { if (!quiet) setError(err.message) }
  }

  async function submitExam(automatic = false) {
    if (!activeAttempt || activeAttempt.status !== 'in_progress') return
    if (!automatic && !window.confirm('Submit your exam now? You cannot change answers after submission.')) return
    setSaving(true)
    try {
      await api.post('/api/exams/exams/' + activeAttempt.exam._id + '/submit', { answers: activeAttempt.answers }, token)
      setActiveAttempt(null); setNotice(automatic ? 'Time ended. Your exam was submitted.' : 'Exam submitted successfully.')
      await Promise.all([loadExams(), loadResults()])
      setTab(isStudent ? 'results' : 'exams')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const updateAnswer = (questionId, updates) => setActiveAttempt(current => current ? ({ ...current, answers: current.answers.map(answer => String(answer.questionId) === String(questionId) ? { ...answer, ...updates } : answer) }) : current)

  const publishResults = async exam => {
    setSaving(true); setError('')
    try { await api.put('/api/exams/exams/' + exam._id, { resultsPublished: true }, token); setNotice('Results published to students and parents.'); await Promise.all([loadExams(), loadResults()]) }
    catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const gradeAttempt = async attempt => {
    const answers = attempt.answers.filter(a => a.question && !['mcq','true_false'].includes(a.question.type)).map(a => {
      const raw = window.prompt(`Marks for: ${a.question.text}\nMaximum: ${a.question.marks}\nStudent answer: ${a.answer || '(blank)'}`, String(a.marksAwarded || 0))
      return raw === null ? null : { questionId: a.questionId, marksAwarded: Number(raw) }
    }).filter(Boolean)
    if (!answers.length) return
    try { await api.put('/api/exams/attempts/' + attempt._id + '/grade', { answers }, token); setNotice('Descriptive answers graded.'); await Promise.all([loadAttempts(), loadResults()]) }
    catch (err) { setError(err.message) }
  }

  const exportResults = () => {
    const rows = results.map(result => ({ Exam: result.exam?.title || '', Student: result.student?.name || '', Class: result.className, Division: result.division, Score: result.score, Total: result.totalMarks, Correct: result.correctCount, Incorrect: result.incorrectCount, Unanswered: result.unansweredCount, PendingManual: result.pendingManualCount }))
    const csv = [Object.keys(rows[0] || { Exam: '', Student: '', Class: '', Division: '', Score: '', Total: '' }).join(','), ...rows.map(row => Object.values(row).map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = 'exam-results.csv'; link.click(); URL.revokeObjectURL(url)
  }

  const tabs = isTeacher
    ? [['questions','Question bank'],['generator','Paper generator'],['papers','My papers'],['exams','Online exams'],['evaluation','Evaluation']]
    : isPrincipal
      ? [['schedule','Exam schedule'],['approvals','Paper approvals'],['results','Results & reports']]
      : isStudent
        ? [['exams','Upcoming exams'],['results','My results']]
        : [['exams','Child exams'],['results','Exam reports']]

  if (activeAttempt) {
    const question = activeAttempt.questions[currentQuestion]
    const answer = activeAttempt.answers.find(a => String(a.questionId) === String(question?._id))
    return <div className="exam-taking">
      <header className="exam-taking-head"><div><span className="exam-eyebrow">ONLINE EXAM</span><h1>{activeAttempt.exam.title}</h1><p>{activeAttempt.exam.subject} · {activeAttempt.exam.className} · {activeAttempt.exam.totalMarks} marks</p></div><div className={'exam-timer ' + (secondsLeft < 300 ? 'urgent' : '')}><Clock3 size={18}/><strong>{formatDuration(secondsLeft)}</strong><small>Time remaining</small></div></header>
      <div className="exam-taking-grid"><aside className="exam-question-nav"><strong>Questions</strong><div>{activeAttempt.questions.map((q, i) => { const a = activeAttempt.answers.find(x => String(x.questionId) === String(q._id)); return <button key={q._id} className={(currentQuestion === i ? 'current ' : '') + (a?.answer ? 'answered ' : '') + (a?.flagged ? 'flagged' : '')} onClick={() => setCurrentQuestion(i)}>{i + 1}</button> })}</div><small>Green: answered · Amber: review</small><button className="secondary" onClick={() => saveAnswers(activeAttempt)}><Save size={15}/>Save now</button></aside>
        <Card title={`Question ${currentQuestion + 1} of ${activeAttempt.questions.length}`}><div className="exam-question-content"><div className="exam-question-meta"><span>{question?.type?.replace('_',' ')}</span><span>{question?.marks} marks</span></div><h2>{question?.text}</h2>{['mcq','true_false'].includes(question?.type) ? <div className="exam-options">{(question?.options || []).map(option => <label key={option.key} className={answer?.answer === option.key ? 'selected' : ''}><input type="radio" name={String(question._id)} checked={answer?.answer === option.key} onChange={() => updateAnswer(question._id, { answer: option.key })}/><b>{option.key}</b><span>{option.text}</span></label>)}</div> : <label className="exam-written-answer">Your answer<textarea rows={7} value={answer?.answer || ''} onChange={event => updateAnswer(question._id, { answer: event.target.value })} placeholder="Write your answer here..."/></label>}
        <button className={'exam-flag ' + (answer?.flagged ? 'on' : '')} onClick={() => updateAnswer(question._id, { flagged: !answer?.flagged })}><ShieldCheck size={16}/>{answer?.flagged ? 'Marked for review' : 'Mark for review'}</button>
        <div className="exam-taking-actions"><button className="secondary" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion(v => v - 1)}><ChevronLeft size={16}/>Previous</button><button className="primary" onClick={() => currentQuestion < activeAttempt.questions.length - 1 ? setCurrentQuestion(v => v + 1) : submitExam(false)}>{currentQuestion < activeAttempt.questions.length - 1 ? <>Next question <ChevronRight size={16}/></> : <><Send size={15}/>Submit exam</>}</button></div></div></Card></div>
      <p className="exam-autosave"><CheckCircle2 size={14}/>Your answers are saved automatically while you work.</p>
    </div>
  }

  return <>
    <SectionIntro eyebrow="ACADEMICS · EXAM CENTRE" title={isPrincipal ? 'Exam management' : isTeacher ? 'Exams & question bank' : isStudent ? 'Exams' : 'Child exams'} text={isPrincipal ? 'Approve question papers, schedule exams and publish results.' : isTeacher ? 'Build your question bank, generate papers and evaluate written answers.' : isStudent ? 'Check upcoming exams, complete online tests and review published results.' : 'View your child’s scheduled exams and published results.'}>
      <button className="secondary" onClick={loadAll}><CalendarDays size={15}/>Refresh</button>
    </SectionIntro>
    {error && <div className="exam-alert" role="alert">{error}</div>}
    {notice && <div className="exam-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><XCircle size={15}/></button></div>}
    <div className="exam-tabs">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>

    {loading ? <Card><div className="exam-state"><LoaderCircle className="spin" size={22}/>Loading exam centre...</div></Card> : null}

    {isTeacher && tab === 'questions' && <>
      <Card title={editingQuestion ? 'Edit question' : 'Add a question'}>
        <form className="exam-form" onSubmit={saveQuestion}>
          <label>Class<select value={questionForm.std} onChange={e => setQuestionForm({ ...questionForm, std: e.target.value })}>{stds.map(std => <option key={std} value={std}>Class {std}</option>)}</select></label>
          <label>Division<select value={questionForm.division} onChange={e => setQuestionForm({ ...questionForm, division: e.target.value })}>{divisions.map(d => <option key={d}>{d}</option>)}</select></label>
          <label>Subject<input required value={questionForm.subject} onChange={e => setQuestionForm({ ...questionForm, subject: e.target.value })} placeholder="Mathematics"/></label>
          <label>Chapter / topic<input value={questionForm.chapter} onChange={e => setQuestionForm({ ...questionForm, chapter: e.target.value })} placeholder="Chapter 1"/></label>
          <label>Question type<select value={questionForm.type} onChange={e => setQuestionForm({ ...questionForm, type: e.target.value })}><option value="mcq">Multiple choice</option><option value="true_false">True / false</option><option value="short">Short answer</option><option value="long">Long answer</option></select></label>
          <label>Difficulty<select value={questionForm.difficulty} onChange={e => setQuestionForm({ ...questionForm, difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          <label className="exam-full">Question text<textarea required rows={3} value={questionForm.text} onChange={e => setQuestionForm({ ...questionForm, text: e.target.value })} placeholder="Enter the question"/></label>
          {['mcq','true_false'].includes(questionForm.type) && <div className="exam-full exam-option-fields">{['A','B','C','D'].map(key => <label key={key}>Option {key}<input required={key === 'A' || key === 'B'} value={questionForm['option' + key]} onChange={e => setQuestionForm({ ...questionForm, ['option' + key]: e.target.value })} placeholder={`Option ${key}`}/></label>)}</div>}
          {['mcq','true_false'].includes(questionForm.type) && <label>Correct answer<select value={questionForm.correctAnswer} onChange={e => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}>{['A','B','C','D'].filter(key => questionForm['option' + key].trim()).map(key => <option key={key} value={key}>{key} — {questionForm['option' + key]}</option>)}</select></label>}
          <label>Marks<input type="number" min="0.5" step="0.5" required value={questionForm.marks} onChange={e => setQuestionForm({ ...questionForm, marks: e.target.value })}/></label>
          <label className="exam-full">Explanation (optional)<textarea rows={2} value={questionForm.explanation} onChange={e => setQuestionForm({ ...questionForm, explanation: e.target.value })}/></label>
          <div className="exam-form-actions exam-full"><button className="primary" disabled={saving}>{saving ? 'Saving...' : editingQuestion ? 'Update question' : <><Plus size={15}/>Add question</>}</button>{editingQuestion && <button type="button" className="secondary" onClick={() => { setEditingQuestion(null); setQuestionForm(emptyQuestion) }}>Cancel edit</button>}</div>
        </form>
      </Card>
      <Card title="Import questions from Excel"><div className="exam-import-intro"><FileSpreadsheet size={24}/><div><strong>Upload .xlsx, .xls or .csv</strong><p>Choose a file, map its column names to question fields, review errors and import valid rows.</p></div></div><label className="exam-upload"><Upload size={16}/>Choose spreadsheet<input type="file" accept=".xlsx,.xls,.csv" onChange={e => parseFile(e.target.files?.[0])}/></label>{importName && <><p className="exam-muted">Selected: {importName} · {importRows.length} rows</p><div className="exam-column-map">{['std','division','subject','chapter','text','optionA','optionB','optionC','optionD','correctAnswer','type','marks','difficulty','explanation'].map(key => <label key={key}>{({std:'Class / standard',division:'Division',subject:'Subject',chapter:'Chapter',text:'Question text',optionA:'Option A',optionB:'Option B',optionC:'Option C',optionD:'Option D',correctAnswer:'Correct answer',type:'Question type',marks:'Marks',difficulty:'Difficulty',explanation:'Explanation'})[key]}<select value={columnMap[key] || ''} onChange={e => setColumnMap({ ...columnMap, [key]: e.target.value })}><option value="">Use default / skip</option>{importHeaders.map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><button className="primary" disabled={saving || !columnMap.text || !columnMap.subject} onClick={importQuestions}><Upload size={15}/>{saving ? 'Importing...' : 'Validate and import'}</button></>}</Card>
      <Card title="Question bank"><div className="exam-filter-grid"><label>Class<select value={filters.std} onChange={e => { setFilters({ ...filters, std: e.target.value }); setSelectedQuestions([]) }}>{stds.map(std => <option key={std}>{std}</option>)}</select></label><label>Division<select value={filters.division} onChange={e => { setFilters({ ...filters, division: e.target.value }); setSelectedQuestions([]) }}>{divisions.map(d => <option key={d}>{d}</option>)}</select></label><label>Subject<select value={filters.subject} onChange={e => setFilters({ ...filters, subject: e.target.value })}><option value="">All subjects</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label><label>Chapter<select value={filters.chapter} onChange={e => setFilters({ ...filters, chapter: e.target.value })}><option value="">All chapters</option>{chapters.map(c => <option key={c}>{c}</option>)}</select></label><label>Difficulty<select value={filters.difficulty} onChange={e => setFilters({ ...filters, difficulty: e.target.value })}><option value="">All levels</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label>Search<input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Find a question"/></label></div><div className="exam-list-head"><span>{filteredQuestions.length} questions</span><button className="secondary" onClick={() => setTab('generator')}><FileText size={15}/>Use selected in paper</button></div>{filteredQuestions.length ? <div className="exam-question-list">{filteredQuestions.map(q => <article key={q._id} className="exam-bank-item"><label className="exam-select-question"><input type="checkbox" checked={selectedQuestions.includes(q._id)} onChange={e => setSelectedQuestions(current => e.target.checked ? [...current, q._id] : current.filter(id => id !== q._id))}/></label><div className="exam-bank-body"><div className="exam-badges"><span>{q.subject}</span><span>{q.chapter || 'No chapter'}</span><span>{q.difficulty}</span><span>{q.marks} marks</span></div><p>{q.text}</p><small>{q.type.replace('_',' ')} · {q.className} - {q.division}</small></div><div className="exam-bank-actions"><button className="secondary" onClick={() => editQuestion(q)}>Edit</button><button className="danger-quiet" onClick={() => deleteQuestion(q._id)}>Delete</button></div></article>)}</div> : <div className="exam-state">No questions match the selected filters. Add a question or import a spreadsheet.</div>}</Card>
    </>}

    {isTeacher && tab === 'generator' && <Card title="Question paper generator"><form className="exam-form" onSubmit={createPaper}><label>Paper title<input required value={paperForm.title} onChange={e => setPaperForm({ ...paperForm, title: e.target.value })} placeholder="Unit Test 1"/></label><label>Class<select value={paperForm.std} onChange={e => setPaperForm({ ...paperForm, std: e.target.value })}>{stds.map(std => <option key={std}>{std}</option>)}</select></label><label>Division<select value={paperForm.division} onChange={e => setPaperForm({ ...paperForm, division: e.target.value })}>{divisions.map(d => <option key={d}>{d}</option>)}</select></label><label>Subject<input required value={paperForm.subject} onChange={e => setPaperForm({ ...paperForm, subject: e.target.value })} placeholder="Science"/></label><label>Duration (minutes)<input type="number" min="1" required value={paperForm.durationMinutes} onChange={e => setPaperForm({ ...paperForm, durationMinutes: e.target.value })}/></label><label>Random question count<input type="number" min="1" max="100" value={paperForm.questionCount} onChange={e => setPaperForm({ ...paperForm, questionCount: e.target.value })}/></label><label>Random difficulty<select value={paperForm.difficulty} onChange={e => setPaperForm({ ...paperForm, difficulty: e.target.value })}><option value="">Any difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label className="exam-full">Instructions<textarea rows={2} value={paperForm.instructions} onChange={e => setPaperForm({ ...paperForm, instructions: e.target.value })}/></label><div className="exam-full exam-generator-summary"><BookOpen size={18}/><div><strong>{selectedQuestions.length ? `${selectedQuestions.length} selected questions` : `Random selection: ${paperForm.questionCount} questions`}</strong><p>{selectedQuestions.length ? 'The selected questions will be used in the same order.' : 'Questions are randomly selected from your question bank for this class, division and subject.'}</p></div><button type="button" className="secondary" onClick={() => setTab('questions')}>Choose questions</button></div><button className="primary" disabled={saving}>{saving ? 'Generating...' : 'Generate question paper'}</button></form></Card>}

    {isTeacher && tab === 'papers' && <Card title="Your question papers"><div className="exam-paper-grid">{papers.map(paper => <article className="exam-paper-card" key={paper._id}><div className="exam-paper-top"><FileText size={20}/><span className={'exam-status ' + paper.status}>{paper.status}</span></div><h3>{paper.title}</h3><p>{paper.subject} · {paper.className} - {paper.division}</p><div className="exam-paper-stats"><span>{paper.questions?.length || 0} questions</span><span>{paper.totalMarks} marks</span><span>{paper.durationMinutes} min</span></div><div className="exam-paper-actions"><button className="secondary" onClick={() => { setSearchText(paper._id); window.print() }}><Printer size={14}/>Print PDF</button>{paper.status !== 'approved' && <button className="primary" disabled={saving || paper.status === 'review'} onClick={() => paperAction(paper, 'submit')}><Send size={14}/>{paper.status === 'review' ? 'In review' : 'Submit for approval'}</button>}</div>{paper.reviewNote && <p className="exam-muted">Principal note: {paper.reviewNote}</p>}<details className="exam-paper-preview"><summary>Preview paper & answer key</summary><div className="exam-print-area"><h2>{paper.title}</h2><p>{paper.subject} · {paper.className} - {paper.division} · {paper.totalMarks} marks</p><ol>{(paper.questions || []).map(q => <li key={q._id}><p>{q.text} ({q.marks})</p>{q.options?.map(o => <div key={o.key}>{o.key}. {o.text}</div>)}<small>Answer: {q.correctAnswer || 'Manual evaluation'}</small></li>)}</ol></div></details></article>)}</div>{!papers.length && <div className="exam-state">No papers yet. Generate one from the Question Bank.</div>}</Card>}

    {isPrincipal && tab === 'approvals' && <Card title="Question paper approval queue"><div className="exam-paper-grid">{papers.filter(p => p.status === 'review').map(paper => <article className="exam-paper-card" key={paper._id}><div className="exam-paper-top"><FileText size={20}/><span className="exam-status review">Awaiting review</span></div><h3>{paper.title}</h3><p>{paper.subject} · {paper.className} - {paper.division}</p><div className="exam-paper-stats"><span>{paper.questions?.length || 0} questions</span><span>{paper.totalMarks} marks</span><span>{paper.durationMinutes} min</span></div><details className="exam-paper-preview"><summary>Review paper and answer key</summary><div className="exam-print-area"><ol>{(paper.questions || []).map(q => <li key={q._id}><p>{q.text} ({q.marks})</p>{q.options?.map(o => <div key={o.key}>{o.key}. {o.text}</div>)}<small>Answer: {q.correctAnswer || 'Manual evaluation'}</small></li>)}</ol></div></details><label className="exam-note-field">Review note<input id={'note-' + paper._id} placeholder="Optional feedback to teacher"/></label><div className="exam-paper-actions"><button className="secondary" disabled={saving} onClick={() => paperAction(paper, 'return', document.getElementById('note-' + paper._id)?.value || '')}><XCircle size={14}/>Return</button><button className="primary" disabled={saving} onClick={() => paperAction(paper, 'approve')}><CheckCircle2 size={14}/>Approve paper</button></div></article>)}</div>{!papers.some(p => p.status === 'review') && <div className="exam-state">No papers are waiting for approval.</div>}</Card>}

    {isPrincipal && tab === 'schedule' && <><Card title="Schedule an exam"><form className="exam-form" onSubmit={createExam}><label>Approved question paper<select required value={examForm.paperId} onChange={e => { const paper = papers.find(p => p._id === e.target.value); setExamForm({ ...examForm, paperId: e.target.value, title: paper?.title || '', durationMinutes: String(paper?.durationMinutes || 60) }) }}><option value="">Select approved paper</option>{papers.filter(p => p.status === 'approved').map(p => <option key={p._id} value={p._id}>{p.title} · {p.className}-{p.division} · {p.subject}</option>)}</select></label><label>Exam title<input required value={examForm.title} onChange={e => setExamForm({ ...examForm, title: e.target.value })} placeholder="Unit Test 1"/></label><label>Exam type<select value={examForm.type} onChange={e => setExamForm({ ...examForm, type: e.target.value })}><option value="weekly">Weekly test</option><option value="unit">Unit test</option><option value="midterm">Midterm</option><option value="final">Final exam</option><option value="practice">Practice</option><option value="other">Other</option></select></label><label>Start date & time<input type="datetime-local" required value={examForm.startsAt} onChange={e => setExamForm({ ...examForm, startsAt: e.target.value })}/></label><label>Duration (minutes)<input type="number" min="1" required value={examForm.durationMinutes} onChange={e => setExamForm({ ...examForm, durationMinutes: e.target.value })}/></label><label className="exam-full">Instructions<textarea rows={2} value={examForm.instructions} onChange={e => setExamForm({ ...examForm, instructions: e.target.value })}/></label><button className="primary" disabled={saving || !papers.some(p => p._id === examForm.paperId && p.status === 'approved')}><CalendarDays size={15}/>Schedule exam</button></form></Card><Card title="Scheduled exams"><ExamList exams={exams} isPrincipal onPublish={publishResults} saving={saving} onCancel={async exam => { if (!window.confirm('Cancel this exam?')) return; try { await api.put('/api/exams/exams/' + exam._id, { status: 'cancelled' }, token); await loadExams() } catch (err) { setError(err.message) } }}/></Card></>}

    {(isStudent || isParent) && tab === 'exams' && <Card title={isStudent ? 'Your exam timetable' : 'Scheduled exams for your child'}><ExamList exams={exams} isStudent={isStudent} onStart={startExam} saving={saving}/></Card>}

    {isTeacher && tab === 'exams' && <Card title="Online exams"><ExamList exams={exams} isTeacher saving={saving}/></Card>}

    {isTeacher && tab === 'evaluation' && <Card title="Descriptive answer evaluation"><div className="exam-results-list">{attempts.filter(a => a.exam?.teacher && a.pendingManualCount > 0).map(attempt => <article className="exam-result-row" key={attempt._id}><div><strong>{attempt.student?.name || 'Student'} · {attempt.exam?.title}</strong><p>{attempt.exam?.subject} · {attempt.pendingManualCount} answers awaiting grading</p></div><span>{attempt.score} / {attempt.exam?.totalMarks}</span><button className="primary" onClick={() => gradeAttempt(attempt)}>Grade answers</button></article>)}</div>{!attempts.some(a => a.pendingManualCount > 0) && <div className="exam-state">No descriptive answers are waiting for evaluation.</div>}</Card>}

    {(tab === 'results') && <Card title={isPrincipal ? 'Results and performance reports' : isStudent ? 'Published results' : isParent ? 'Child exam reports' : 'Exam results'}><div className="exam-results-toolbar"><p>Results are visible to students and parents only after the principal publishes them.</p>{results.length > 0 && <button className="secondary" onClick={exportResults}><Download size={15}/>Export CSV</button>}</div><div className="exam-results-list">{results.filter(result => !isPrincipal || !searchText || result.student?.name?.toLowerCase().includes(searchText.toLowerCase())).map(result => <article className="exam-result-row" key={result._id}><div><strong>{result.exam?.title || 'Exam'}</strong><p>{result.student?.name || 'Student'} · {result.className} - {result.division} · {result.exam?.subject}</p><small>{result.pendingManualCount ? `${result.pendingManualCount} written answers pending` : `${result.correctCount} correct · ${result.incorrectCount} incorrect · ${result.unansweredCount} unanswered`}</small></div><div className="exam-result-score"><strong>{result.score} / {result.totalMarks}</strong><span>{result.totalMarks ? Math.round(result.score / result.totalMarks * 100) : 0}%</span></div></article>)}</div>{!results.length && <div className="exam-state">No published results yet.</div>}</Card>}
  </>
}

function ExamList({ exams, isPrincipal = false, isStudent = false, isTeacher = false, onStart, onPublish, onCancel, saving }) {
  const now = Date.now()
  return <div className="exam-schedule-list">{exams.map(exam => {
    const starts = new Date(exam.startsAt).getTime()
    const ended = now > starts + Number(exam.durationMinutes) * 60000
    const canStart = isStudent && starts <= now && !ended && exam.status !== 'cancelled'
    return <article className="exam-schedule-card" key={exam._id}><div className="exam-schedule-icon"><CalendarDays size={20}/></div><div className="exam-schedule-info"><div className="exam-badges"><span>{exam.type || 'Exam'}</span><span>{exam.className} - {exam.division}</span><span>{exam.subject}</span></div><h3>{exam.title}</h3><p>{formatDate(exam.startsAt)} · {exam.durationMinutes} minutes · {exam.totalMarks} marks</p>{exam.instructions && <small>{exam.instructions}</small>}{exam.teacher?.name && <small>Teacher: {exam.teacher.name}</small>}</div><div className="exam-schedule-actions"><span className={'exam-status ' + exam.status}>{exam.status}</span>{canStart && <button className="primary" disabled={saving} onClick={() => onStart(exam)}>Start exam</button>}{isStudent && starts > now && <small>Starts in future</small>}{isStudent && ended && <small>Exam window ended</small>}{isPrincipal && !exam.resultsPublished && exam.status !== 'cancelled' && <button className="primary" disabled={saving} onClick={() => onPublish(exam)}>Publish results</button>}{isPrincipal && exam.status === 'scheduled' && <button className="secondary" disabled={saving} onClick={() => onCancel(exam)}>Cancel exam</button>}{isTeacher && <small>Paper: {exam.paper?.title || 'Assigned'}</small>}</div></article>
  })}{!exams.length && <div className="exam-state">No exams to show yet.</div>}</div>
}
