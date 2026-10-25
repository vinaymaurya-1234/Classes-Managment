import { Router } from 'express'
import mongoose from 'mongoose'
import { requireAuth } from '../middleware/auth.middleware.js'
import User from '../models/User.js'
import Chapter from '../models/Chapter.js'
import Question from '../models/Question.js'
import QuestionPaper from '../models/QuestionPaper.js'
import Exam from '../models/Exam.js'
import ExamAttempt from '../models/ExamAttempt.js'
import ExamResult from '../models/ExamResult.js'

const router = Router()
router.use(requireAuth)
const divisions = ['A', 'B', 'C']
const stds = [10, 11, 12]
const classLabel = (std, division) => `Class ${Number(std)} - ${division}`
const forbidden = res => res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' })
const validId = id => mongoose.isValidObjectId(id)
const fail = (res, status, message) => res.status(status).json({ success: false, message })
const isPrincipal = user => user?.role === 'principal'
const isTeacher = user => user?.role === 'teacher'
const isStudent = user => user?.role === 'student'
const normalizeClassAssignment = value => {
  const raw = String(value || '').trim()
  const match = raw.match(/(?:class\\s*)?(10|11|12)(?:\\s*[-–/]\\s*([ABC]))?/i)
  return match ? { std: Number(match[1]), division: match[2]?.toUpperCase() || '' } : null
}
const canTeach = async (user, std, division) => {
  const labels = Array.isArray(user.teachingClasses) ? user.teachingClasses : []
  const assigned = labels.some(value => {
    const parsed = normalizeClassAssignment(value)
    return parsed && parsed.std === Number(std) && (!parsed.division || parsed.division === String(division).toUpperCase())
  })
  if (assigned) return true

  // Older chapter records and accounts may use "10-A", "Class 10", or
  // "Class 10 - A". Match those legacy formats without granting access to
  // another class or division.
  const chapters = await Chapter.find({ teacher: user._id }).select('className').lean()
  return chapters.some(chapter => {
    const parsed = normalizeClassAssignment(chapter.className)
    return parsed && parsed.std === Number(std) && (!parsed.division || parsed.division === String(division).toUpperCase())
  })
}
const getStudentClass = user => {
  const classMatch = String(user.className || '').match(/\\d+/)
  const std = Number(user.std || classMatch?.[0])
  const division = String(user.division || 'A').trim().toUpperCase()
  return { std, division, className: `Class ${std}` }
}
const studentExamFilter = user => {
  const { std, division } = getStudentClass(user)
  return { std, $or: [{ division }, { division: '' }, { division: { $exists: false } }, { division: null }] }
}
const studentCanAccessExam = (user, exam) => {
  const { std, division } = getStudentClass(user)
  return Number.isInteger(std) && std === Number(exam.std) &&
    (!String(exam.division || '').trim() || String(exam.division).trim().toUpperCase() === division)
}
const safeQuestion = question => ({
  _id: question._id,
  text: question.text,
  type: question.type,
  options: question.options,
  marks: question.marks,
  chapter: question.chapter,
  difficulty: question.difficulty,
})
const sanitizePaper = (paper, includeAnswers = false) => ({
  _id: paper._id, title: paper.title, className: paper.className, std: paper.std,
  division: paper.division, subject: paper.subject, instructions: paper.instructions,
  totalMarks: paper.totalMarks, durationMinutes: paper.durationMinutes, status: paper.status,
  questions: paper.questions.map(q => includeAnswers ? q : safeQuestion(q)),
  createdAt: paper.createdAt, teacher: paper.teacher,
})
const sanitizeExam = exam => ({
  _id: exam._id, title: exam.title, type: exam.type, className: exam.className,
  std: exam.std, division: exam.division, subject: exam.subject, startsAt: exam.startsAt,
  durationMinutes: exam.durationMinutes, totalMarks: exam.totalMarks, instructions: exam.instructions,
  status: exam.status, resultsPublished: exam.resultsPublished, paper: exam.paper,
})

router.get('/questions', async (req, res, next) => {
  try {
    const user = req.user
    const filter = {}
    if (isTeacher(user)) filter.teacher = user._id
    else if (!isPrincipal(user)) return forbidden(res)
    for (const key of ['std', 'division', 'subject', 'chapter', 'difficulty', 'type']) {
      if (req.query[key]) {
        if (key === 'std') filter.className = `Class ${Number(req.query.std)}`
        else filter[key] = String(req.query[key]).trim()
      }
    }
    if (req.query.search) filter.text = { $regex: String(req.query.search).trim().slice(0, 100), $options: 'i' }
    const questions = await Question.find(filter).sort({ updatedAt: -1 }).limit(500).lean()
    res.json({ success: true, data: questions.map(q => ({ ...q, correctAnswer: isPrincipal(user) || String(q.teacher) === String(user._id) ? q.correctAnswer : undefined })) })
  } catch (error) { next(error) }
})

router.post('/questions', async (req, res, next) => {
  try {
    if (!isTeacher(req.user)) return forbidden(res)
    const body = req.body || {}
    const std = Number(body.std), division = String(body.division || '').toUpperCase()
    const subject = String(body.subject || '').trim(), text = String(body.text || '').trim()
    const type = ['mcq', 'short', 'long', 'true_false'].includes(body.type) ? body.type : 'mcq'
    const marks = Number(body.marks || 1)
    if (!stds.includes(std) || (division && !divisions.includes(division)) || !subject || !text || !Number.isFinite(marks) || marks < 0.5) return fail(res, 400, 'Class, subject, question text and valid marks are required. Division is optional.')
    if (!await canTeach(req.user, std, division)) return forbidden(res)
    const options = Array.isArray(body.options) ? body.options.map((o, i) => ({ key: String(o.key || String.fromCharCode(65 + i)), text: String(o.text || '').trim() })).filter(o => o.text) : []
    const correctAnswer = String(body.correctAnswer || '').trim()
    if (['mcq', 'true_false'].includes(type) && (!options.length || !correctAnswer || !options.some(o => o.key === correctAnswer || o.text === correctAnswer))) return fail(res, 400, 'Objective questions require options and a correct answer matching an option.')
    const normalizedAnswer = options.find(o => o.key === correctAnswer || o.text === correctAnswer)?.key || correctAnswer
    const question = await Question.create({ teacher: req.user._id, className: `Class ${std}`, division, subject, chapter: String(body.chapter || '').trim(), topic: String(body.topic || '').trim(), type, text, options, correctAnswer: normalizedAnswer, explanation: String(body.explanation || '').trim(), marks, difficulty: ['easy', 'medium', 'hard'].includes(body.difficulty) ? body.difficulty : 'medium', tags: Array.isArray(body.tags) ? body.tags.map(String).slice(0, 20) : [] })
    res.status(201).json({ success: true, data: question })
  } catch (error) { next(error) }
})

router.post('/questions/import', async (req, res, next) => {
  try {
    if (!isTeacher(req.user)) return forbidden(res)
    const rows = Array.isArray(req.body.rows) ? req.body.rows : []
    if (!rows.length || rows.length > 500) return fail(res, 400, 'Upload between 1 and 500 validated question rows per import.')
    const created = [], errors = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {}
      const std = Number(row.std), division = String(row.division || '').toUpperCase()
      const subject = String(row.subject || '').trim(), text = String(row.text || '').trim()
      const type = ['mcq', 'short', 'long', 'true_false'].includes(String(row.type || '').toLowerCase()) ? String(row.type).toLowerCase() : 'mcq'
      const marks = Number(row.marks || 1)
      const options = Array.isArray(row.options) ? row.options.map((o, j) => ({ key: String(o.key || String.fromCharCode(65 + j)), text: String(o.text || '').trim() })).filter(o => o.text) : ['A','B','C','D'].map(k => ({ key: k, text: String(row['option' + k] || row[k] || '').trim() })).filter(o => o.text)
      const correctAnswer = String(row.correctAnswer || row.answer || '').trim()
      if (!stds.includes(std) || (division && !divisions.includes(division)) || !subject || !text || !Number.isFinite(marks) || marks < 0.5) { errors.push({ row: i + 2, message: 'Missing class, subject, question text or valid marks. Division is optional.' }); continue }
      if (!await canTeach(req.user, std, division)) { errors.push({ row: i + 2, message: `Class ${std}-${division} is not assigned to you.` }); continue }
      if (['mcq', 'true_false'].includes(type) && (!options.length || !correctAnswer || !options.some(o => o.key === correctAnswer || o.text === correctAnswer))) { errors.push({ row: i + 2, message: 'Objective question has missing options or an invalid answer.' }); continue }
      const duplicate = await Question.exists({ teacher: req.user._id, className: `Class ${std}`, division, subject, text })
      if (duplicate) { errors.push({ row: i + 2, message: 'Duplicate question skipped.' }); continue }
      const normalizedAnswer = options.find(o => o.key === correctAnswer || o.text === correctAnswer)?.key || correctAnswer
      created.push({ teacher: req.user._id, className: `Class ${std}`, division, subject, chapter: String(row.chapter || '').trim(), topic: String(row.topic || '').trim(), type, text, options, correctAnswer: normalizedAnswer, explanation: String(row.explanation || '').trim(), marks, difficulty: ['easy','medium','hard'].includes(String(row.difficulty).toLowerCase()) ? String(row.difficulty).toLowerCase() : 'medium' })
    }
    const data = created.length ? await Question.insertMany(created) : []
    res.status(201).json({ success: true, imported: data.length, skipped: errors.length, errors })
  } catch (error) { next(error) }
})

router.put('/questions/:id', async (req, res, next) => {
  try {
    if (!isTeacher(req.user) || !validId(req.params.id)) return forbidden(res)
    const question = await Question.findOne({ _id: req.params.id, teacher: req.user._id })
    if (!question) return fail(res, 404, 'Question not found.')
    const std = req.body.std === undefined ? Number(String(question.className).match(/\\d+/)?.[0]) : Number(req.body.std)
    const division = req.body.division === undefined ? question.division : String(req.body.division).toUpperCase()
    if (!stds.includes(std) || (division && !divisions.includes(division))) return fail(res, 400, 'Choose a valid class and optionally division A, B or C.')
    if (!await canTeach(req.user, std, division)) return forbidden(res)
    question.className = `Class ${std}`; question.division = division
    const allowed = ['subject','chapter','topic','type','text','options','correctAnswer','explanation','marks','difficulty','tags']
    for (const key of allowed) if (req.body[key] !== undefined) question[key] = req.body[key]
    await question.save()
    res.json({ success: true, data: question })
  } catch (error) { next(error) }
})

router.delete('/questions/:id', async (req, res, next) => {
  try {
    if (!isTeacher(req.user) || !validId(req.params.id)) return forbidden(res)
    const question = await Question.findOneAndDelete({ _id: req.params.id, teacher: req.user._id })
    if (!question) return fail(res, 404, 'Question not found.')
    res.json({ success: true })
  } catch (error) { next(error) }
})

router.get('/papers', async (req, res, next) => {
  try {
    const filter = isPrincipal(req.user) ? {} : isTeacher(req.user) ? { teacher: req.user._id } : null
    if (!filter) return forbidden(res)
    if (req.query.status) filter.status = String(req.query.status)
    const papers = await QuestionPaper.find(filter).sort({ updatedAt: -1 }).limit(300).lean()
    res.json({ success: true, data: papers.map(p => sanitizePaper(p, isPrincipal(req.user) || String(p.teacher) === String(req.user._id))) })
  } catch (error) { next(error) }
})

router.post('/papers', async (req, res, next) => {
  try {
    if (!isTeacher(req.user)) return forbidden(res)
    const body = req.body || {}, std = Number(body.std), division = String(body.division || '').toUpperCase()
    const subject = String(body.subject || '').trim(), title = String(body.title || '').trim()
    if (!stds.includes(std) || (division && !divisions.includes(division)) || !subject || !title) return fail(res, 400, 'Paper title, class and subject are required. Division is optional.')
    if (!await canTeach(req.user, std, division)) return forbidden(res)
    let questions = []
    if (Array.isArray(body.questionIds) && body.questionIds.length) {
      if (body.questionIds.some(id => !validId(id))) return fail(res, 400, 'One or more question IDs are invalid.')
      const found = await Question.find({ _id: { $in: body.questionIds }, teacher: req.user._id, className: `Class ${std}`, division, subject })
      const byId = new Map(found.map(question => [String(question._id), question]))
      questions = body.questionIds.map(id => byId.get(String(id))).filter(Boolean)
    } else {
      const count = Math.min(100, Math.max(1, Number(body.questionCount || 10)))
      const filter = { teacher: req.user._id, className: `Class ${std}`, division, subject }
      if (body.difficulty && ['easy','medium','hard'].includes(body.difficulty)) filter.difficulty = body.difficulty
      questions = await Question.aggregate([{ $match: { ...filter, teacher: new mongoose.Types.ObjectId(String(req.user._id)) } }, { $sample: { size: count } }])
    }
    if (!questions.length) return fail(res, 400, 'No matching questions found. Add questions or change your filters.')
    const snapshots = questions.map(q => ({ questionRef: q._id, text: q.text, type: q.type, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, marks: Number(q.marks || 1), difficulty: q.difficulty || 'medium', chapter: q.chapter || '' }))
    const totalMarks = snapshots.reduce((sum, q) => sum + q.marks, 0)
    const paper = await QuestionPaper.create({ teacher: req.user._id, title, className: `Class ${std}`, std, division, subject, instructions: String(body.instructions || '').trim(), questions: snapshots, totalMarks, durationMinutes: Math.max(1, Number(body.durationMinutes || 60)), status: 'draft' })
    res.status(201).json({ success: true, data: sanitizePaper(paper, true) })
  } catch (error) { next(error) }
})

router.post('/papers/:id/submit', async (req, res, next) => {
  try {
    if (!isTeacher(req.user) || !validId(req.params.id)) return forbidden(res)
    const paper = await QuestionPaper.findOne({ _id: req.params.id, teacher: req.user._id })
    if (!paper) return fail(res, 404, 'Paper not found.')
    if (paper.status === 'approved') return fail(res, 409, 'Approved papers cannot be resubmitted.')
    paper.status = 'review'; paper.reviewNote = ''; await paper.save()
    res.json({ success: true, data: sanitizePaper(paper, true) })
  } catch (error) { next(error) }
})

router.put('/papers/:id/review', async (req, res, next) => {
  try {
    if (!isPrincipal(req.user)) return forbidden(res)
    const paper = await QuestionPaper.findById(req.params.id)
    if (!paper) return fail(res, 404, 'Paper not found.')
    if (paper.status !== 'review') return fail(res, 409, 'Only papers awaiting review can be approved or returned.')
    if (!['approve','return'].includes(req.body.action)) return fail(res, 400, 'Action must be approve or return.')
    paper.status = req.body.action === 'approve' ? 'approved' : 'returned'
    paper.reviewNote = String(req.body.note || '').trim()
    paper.reviewedBy = req.user._id; paper.reviewedAt = new Date()
    await paper.save()
    res.json({ success: true, data: sanitizePaper(paper, true) })
  } catch (error) { next(error) }
})

router.get('/exams', async (req, res, next) => {
  try {
    const user = req.user
    let filter = {}
    if (isTeacher(user)) filter.teacher = user._id
    else if (isStudent(user)) {
      // Older student records may have className (e.g. "Class 10") but no std.
      const classMatch = String(user.className || '').match(/\\d+/)
      const studentStd = Number(user.std || classMatch?.[0])
      const studentDivision = String(user.division || 'A').trim().toUpperCase()
      if (!Number.isInteger(studentStd) || studentStd < 1) return res.json({ success: true, data: [] })
      filter = {
        std: studentStd,
        $or: [{ division: studentDivision }, { division: '' }, { division: { $exists: false } }, { division: null }],
        status: { $ne: 'cancelled' },
      }
    } else if (user.role === 'parent') {
      const parent = await User.findById(user._id).populate('children', 'std division className').lean()
      const children = parent?.children || []
      const classFilters = children.flatMap(child => {
        const classMatch = String(child.className || '').match(/\\d+/)
        const childStd = Number(child.std || classMatch?.[0])
        if (!Number.isInteger(childStd) || childStd < 1) return []
        const childDivision = String(child.division || 'A').trim().toUpperCase()
        return [{ std: childStd, $or: [{ division: childDivision }, { division: '' }, { division: { $exists: false } }, { division: null }] }]
      })
      if (!classFilters.length) return res.json({ success: true, data: [] })
      filter = { $or: classFilters, status: { $ne: 'cancelled' } }
    } else if (!isPrincipal(user)) return forbidden(res)
    const exams = await Exam.find(filter).sort({ startsAt: 1 }).populate('teacher', 'name').populate('paper', 'title')
    res.json({ success: true, data: exams.map(e => ({ ...sanitizeExam(e), teacher: e.teacher, paper: e.paper })) })
  } catch (error) { next(error) }
})

router.post('/exams', async (req, res, next) => {
  try {
    if (!isPrincipal(req.user)) return forbidden(res)
    const body = req.body || {}, paperId = String(body.paperId || '')
    const paper = validId(paperId) ? await QuestionPaper.findOne({ _id: paperId, status: 'approved' }) : null
    if (!paper) return fail(res, 400, 'Choose an approved question paper.')
    const startsAt = new Date(body.startsAt), type = ['weekly','unit','midterm','final','practice','other'].includes(body.type) ? body.type : 'unit'
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() < Date.now() - 60000) return fail(res, 400, 'Choose a valid future exam date and time.')
    const exam = await Exam.create({ createdBy: req.user._id, teacher: paper.teacher, paper: paper._id, title: String(body.title || paper.title).trim(), type, className: paper.className, std: paper.std, division: paper.division, subject: paper.subject, startsAt, durationMinutes: Math.max(1, Number(body.durationMinutes || paper.durationMinutes)), totalMarks: paper.totalMarks, instructions: String(body.instructions ?? paper.instructions).trim(), status: 'scheduled', answerReviewEnabled: body.answerReviewEnabled === true, attemptsAllowed: Math.min(5, Math.max(1, Number(body.attemptsAllowed || 1))) })
    res.status(201).json({ success: true, data: sanitizeExam(exam) })
  } catch (error) { next(error) }
})

router.put('/exams/:id', async (req, res, next) => {
  try {
    if (!isPrincipal(req.user)) return forbidden(res)
    const exam = await Exam.findById(req.params.id)
    if (!exam) return fail(res, 404, 'Exam not found.')
    if (['completed','cancelled'].includes(exam.status)) return fail(res, 409, 'Completed or cancelled exams cannot be edited.')
    if (req.body.title !== undefined) exam.title = String(req.body.title).trim()
    if (req.body.type && ['weekly','unit','midterm','final','practice','other'].includes(req.body.type)) exam.type = req.body.type
    if (req.body.startsAt !== undefined) { const date = new Date(req.body.startsAt); if (!Number.isFinite(date.getTime())) return fail(res, 400, 'Invalid exam date.'); exam.startsAt = date }
    if (req.body.durationMinutes !== undefined) exam.durationMinutes = Math.max(1, Number(req.body.durationMinutes))
    if (req.body.status === 'cancelled') exam.status = 'cancelled'
    if (req.body.resultsPublished !== undefined && req.body.resultsPublished === true) {
      if (Date.now() < new Date(exam.startsAt).getTime() + exam.durationMinutes * 60000) return fail(res, 409, 'The exam must finish before results can be published.')
      if (await ExamAttempt.exists({ exam: exam._id, status: 'in_progress' })) return fail(res, 409, 'Wait until all active attempts are submitted before publishing results.')
      if (await ExamResult.exists({ exam: exam._id, pendingManualCount: { $gt: 0 } })) return fail(res, 409, 'Teachers must finish grading descriptive answers before results can be published.')
      exam.resultsPublished = true
      await ExamResult.updateMany({ exam: exam._id }, { published: true })
    }
    await exam.save()
    res.json({ success: true, data: sanitizeExam(exam) })
  } catch (error) { next(error) }
})

router.post('/exams/:id/start', async (req, res, next) => {
  try {
    if (!isStudent(req.user) || !validId(req.params.id)) return forbidden(res)
    const exam = await Exam.findById(req.params.id)
    if (!exam || exam.status === 'cancelled' || !studentCanAccessExam(req.user, exam)) return fail(res, 404, 'Exam not found for your class and division.')
    const now = Date.now(), start = new Date(exam.startsAt).getTime(), end = start + exam.durationMinutes * 60000
    if (now < start) return fail(res, 409, 'This exam has not started yet.')
    if (now >= end) return fail(res, 409, 'The exam time window has ended.')
    if (exam.status === 'scheduled') { exam.status = 'live'; await exam.save() }
    let attempt = await ExamAttempt.findOne({ exam: exam._id, student: req.user._id })
    if (!attempt) {
      const paper = await QuestionPaper.findById(exam.paper)
      attempt = await ExamAttempt.create({ exam: exam._id, student: req.user._id, answers: paper.questions.map(q => ({ questionId: q._id, answer: '', flagged: false })) })
    }
    if (attempt.status !== 'in_progress') return fail(res, 409, 'You have already submitted this exam.')
    const paper = await QuestionPaper.findById(exam.paper).lean()
    res.json({ success: true, attemptId: attempt._id, startedAt: attempt.startedAt, endsAt: new Date(Math.min(end, new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60000)), exam: sanitizeExam(exam), questions: paper.questions.map(safeQuestion), answers: attempt.answers.map(a => ({ questionId: a.questionId, answer: a.answer, flagged: a.flagged })) })
  } catch (error) { next(error) }
})

router.put('/exams/:id/answers', async (req, res, next) => {
  try {
    if (!isStudent(req.user) || !validId(req.params.id)) return forbidden(res)
    const exam = await Exam.findById(req.params.id)
    if (!exam || !studentCanAccessExam(req.user, exam)) return fail(res, 404, 'Exam not found for your class and division.')
    if (!exam) return fail(res, 404, 'Exam not found.')
    const attempt = await ExamAttempt.findOne({ exam: exam._id, student: req.user._id, status: 'in_progress' })
    if (!attempt) return fail(res, 404, 'Active exam attempt not found.')
    if (Date.now() >= new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60000 || Date.now() >= new Date(exam.startsAt).getTime() + exam.durationMinutes * 60000) return fail(res, 409, 'Exam time has ended. Submit your current answers.')
    if (!Array.isArray(req.body.answers)) return fail(res, 400, 'Answers must be an array.')
    const allowed = new Set(attempt.answers.map(a => String(a.questionId)))
    for (const answer of req.body.answers) {
      if (!allowed.has(String(answer.questionId))) continue
      const target = attempt.answers.find(a => String(a.questionId) === String(answer.questionId))
      target.answer = String(answer.answer || '').slice(0, 10000)
      target.flagged = answer.flagged === true
    }
    await attempt.save()
    res.json({ success: true, savedAt: new Date().toISOString() })
  } catch (error) { next(error) }
})

router.post('/exams/:id/submit', async (req, res, next) => {
  try {
    if (!isStudent(req.user) || !validId(req.params.id)) return forbidden(res)
    const exam = await Exam.findById(req.params.id)
    if (!exam || exam.status === 'cancelled' || !studentCanAccessExam(req.user, exam)) return fail(res, 404, 'Exam not found for your class and division.')
    const attempt = await ExamAttempt.findOne({ exam: exam._id, student: req.user._id, status: 'in_progress' })
    if (!attempt) return fail(res, 404, 'Active exam attempt not found.')
    if (Array.isArray(req.body.answers)) {
      for (const answer of req.body.answers) {
        const target = attempt.answers.find(a => String(a.questionId) === String(answer.questionId))
        if (target) { target.answer = String(answer.answer || '').slice(0, 10000); target.flagged = answer.flagged === true }
      }
    }
    const paper = await QuestionPaper.findById(exam.paper).lean()
    let autoScore = 0, correctCount = 0, incorrectCount = 0, unansweredCount = 0, pendingManualCount = 0
    for (const answer of attempt.answers) {
      const question = paper.questions.find(q => String(q._id) === String(answer.questionId))
      if (!question) continue
      if (!String(answer.answer || '').trim()) { unansweredCount++; answer.marksAwarded = 0; answer.reviewed = true }
      else if (['mcq','true_false'].includes(question.type)) {
        const correct = String(answer.answer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase()
        answer.marksAwarded = correct ? question.marks : 0; answer.reviewed = true
        if (correct) { autoScore += question.marks; correctCount++ } else incorrectCount++
      } else { pendingManualCount++; answer.reviewed = false }
    }
    attempt.autoScore = autoScore; attempt.manualScore = 0; attempt.score = autoScore
    attempt.correctCount = correctCount; attempt.incorrectCount = incorrectCount; attempt.unansweredCount = unansweredCount
    attempt.pendingManualCount = pendingManualCount; attempt.status = pendingManualCount ? 'submitted' : 'graded'; attempt.submittedAt = new Date()
    await attempt.save()
    const result = await ExamResult.findOneAndUpdate({ attempt: attempt._id }, { exam: exam._id, attempt: attempt._id, student: req.user._id, className: exam.className, division: exam.division, totalMarks: exam.totalMarks, score: attempt.score, autoScore, manualScore: 0, correctCount, incorrectCount, unansweredCount, pendingManualCount, published: exam.resultsPublished }, { upsert: true, new: true, setDefaultsOnInsert: true })
    res.json({ success: true, message: pendingManualCount ? 'Exam submitted. Descriptive answers are awaiting teacher evaluation.' : 'Exam submitted successfully.', result: exam.resultsPublished ? result : undefined })
  } catch (error) { next(error) }
})

router.get('/attempts', async (req, res, next) => {
  try {
    let filter = {}
    if (isTeacher(req.user)) {
      const examIds = (await Exam.find({ teacher: req.user._id }).select('_id').lean()).map(exam => exam._id)
      filter = { exam: { $in: examIds }, status: { $in: ['submitted', 'graded'] } }
    } else if (isPrincipal(req.user)) {
      filter = { status: { $in: ['submitted', 'graded'] } }
    } else return forbidden(res)
    const attempts = await ExamAttempt.find(filter).sort({ submittedAt: -1 }).populate('student', 'name email std division').populate({ path: 'exam', select: 'title subject startsAt totalMarks className division teacher paper', populate: { path: 'paper' } }).lean()
    const data = attempts.map(attempt => {
      const paperQuestions = attempt.exam?.paper?.questions || []
      return { ...attempt, answers: attempt.answers.map(answer => ({ ...answer, question: paperQuestions.find(question => String(question._id) === String(answer.questionId)) || null })) }
    })
    res.json({ success: true, data })
  } catch (error) { next(error) }
})

router.get('/exams/:id/review', async (req, res, next) => {
  try {
    if (!isStudent(req.user) || !validId(req.params.id)) return forbidden(res)
    const exam = await Exam.findOne({ _id: req.params.id, std: Number(req.user.std), $or: [{ division: req.user.division || '' }, { division: '' }], resultsPublished: true, answerReviewEnabled: true })
    if (!exam) return fail(res, 404, 'Answer review is not available for this exam.')
    const attempt = await ExamAttempt.findOne({ exam: exam._id, student: req.user._id, status: { $in: ['submitted', 'graded'] } }).lean()
    if (!attempt) return fail(res, 404, 'Submitted attempt not found.')
    const paper = await QuestionPaper.findById(exam.paper).lean()
    const data = paper.questions.map(question => {
      const answer = attempt.answers.find(item => String(item.questionId) === String(question._id))
      return { _id: question._id, text: question.text, type: question.type, options: question.options, marks: question.marks, correctAnswer: question.correctAnswer, explanation: question.explanation, answer: answer?.answer || '', marksAwarded: answer?.marksAwarded || 0 }
    })
    res.json({ success: true, exam: sanitizeExam(exam), answers: data })
  } catch (error) { next(error) }
})

router.get('/students/:studentId/attempts', async (req, res, next) => {
  try {
    if (!isPrincipal(req.user)) return forbidden(res)
    if (!validId(req.params.studentId)) return fail(res, 400, 'Invalid student ID.')
    const student = await User.findOne({ _id: req.params.studentId, role: 'student' }).select('_id')
    if (!student) return fail(res, 404, 'Student not found.')
    const attempts = await ExamAttempt.find({ student: student._id, status: { $in: ['submitted', 'graded'] } })
      .sort({ submittedAt: -1, updatedAt: -1 }).populate('exam', 'title subject startsAt totalMarks paper')
      .limit(100).lean()
    const data = await Promise.all(attempts.map(async attempt => {
      const paper = attempt.exam?.paper ? await QuestionPaper.findById(attempt.exam.paper).lean() : null
      const questions = (paper?.questions || []).map(question => {
        const answer = (attempt.answers || []).find(item => String(item.questionId) === String(question._id))
        const response = String(answer?.answer || '').trim()
        const correct = ['mcq', 'true_false'].includes(question.type) && response !== '' &&
          (response === String(question.correctAnswer) || response === String(question.options?.find(option => option.key === question.correctAnswer)?.text || ''))
        return {
          id: String(question._id), text: question.text, type: question.type,
          options: question.options || [], selectedAnswer: response,
          correctAnswer: question.correctAnswer || '', explanation: question.explanation || '',
          marks: Number(question.marks || 0), marksAwarded: Number(answer?.marksAwarded || 0),
          status: !response ? 'skipped' : ['mcq', 'true_false'].includes(question.type) ? (correct ? 'correct' : 'incorrect') : (answer?.reviewed ? 'graded' : 'awaiting-review'),
        }
      })
      return { id: String(attempt._id), exam: attempt.exam, score: attempt.score, totalMarks: attempt.exam?.totalMarks || 0,
        submittedAt: attempt.submittedAt, status: attempt.status, correctCount: attempt.correctCount,
        incorrectCount: attempt.incorrectCount, unansweredCount: attempt.unansweredCount, questions }
    }))
    return res.json({ success: true, data })
  } catch (error) { next(error) }
})

router.get('/results', async (req, res, next) => {
  try {
    const user = req.user
    let filter = {}
    if (isStudent(user)) filter = { student: user._id, published: true }
    else if (user.role === 'parent') {
      const parent = await User.findById(user._id).populate('children', '_id')
      const ids = (parent?.children || []).map(c => c._id)
      filter = { student: { $in: ids }, published: true }
    } else if (isTeacher(user)) filter = { exam: { $in: (await Exam.find({ teacher: user._id }).select('_id')).map(e => e._id) } }
    else if (!isPrincipal(user)) return forbidden(res)
    const results = await ExamResult.find(filter).sort({ createdAt: -1 }).populate('student', 'name email std division').populate('exam', 'title subject startsAt totalMarks className division resultsPublished answerReviewEnabled').limit(1000).lean()
    res.json({ success: true, data: results })
  } catch (error) { next(error) }
})

router.put('/attempts/:id/grade', async (req, res, next) => {
  try {
    if (!isTeacher(req.user) || !validId(req.params.id)) return forbidden(res)
    const attempt = await ExamAttempt.findById(req.params.id).populate('exam')
    if (!attempt || String(attempt.exam.teacher) !== String(req.user._id)) return fail(res, 404, 'Attempt not found.')
    if (!Array.isArray(req.body.answers)) return fail(res, 400, 'Graded answers are required.')
    const paper = await QuestionPaper.findById(attempt.exam.paper).lean()
    let manualScore = 0, pending = 0
    for (const item of req.body.answers) {
      const target = attempt.answers.find(a => String(a.questionId) === String(item.questionId))
      const question = paper.questions.find(q => String(q._id) === String(item.questionId))
      if (!target || !question || ['mcq','true_false'].includes(question.type)) continue
      const marks = Number(item.marksAwarded)
      if (!Number.isFinite(marks) || marks < 0 || marks > question.marks) return fail(res, 400, 'Marks awarded must be between zero and the question maximum.')
      target.marksAwarded = marks; target.reviewed = true
    }
    for (const answer of attempt.answers) {
      const question = paper.questions.find(q => String(q._id) === String(answer.questionId))
      if (question && !['mcq','true_false'].includes(question.type)) {
        if (!answer.reviewed) pending++
        else manualScore += answer.marksAwarded
      }
    }
    attempt.manualScore = manualScore; attempt.score = attempt.autoScore + manualScore; attempt.pendingManualCount = pending
    attempt.status = pending ? 'submitted' : 'graded'
    await attempt.save()
    const result = await ExamResult.findOneAndUpdate({ attempt: attempt._id }, { score: attempt.score, autoScore: attempt.autoScore, manualScore, pendingManualCount: pending }, { new: true })
    res.json({ success: true, data: result })
  } catch (error) { next(error) }
})

export default router
