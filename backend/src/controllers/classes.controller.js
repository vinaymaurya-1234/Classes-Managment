import ClassDivision from '../models/ClassDivision.js'
import User from '../models/User.js'
import TimetableEntry from '../models/TimetableEntry.js'
import Homework from '../models/Homework.js'
import Chapter from '../models/Chapter.js'
import Exam from '../models/Exam.js'
import QuestionPaper from '../models/QuestionPaper.js'
import Question from '../models/Question.js'

const principalOnly = req => req.user?.role === 'principal'
const labelFor = standard => `Class ${standard}`

async function seedFromLegacyData() {
  const standards = new Map()
  const students = await User.find({ role: 'student' }).select('std division className classDivision').lean()
  students.forEach(student => {
    const standard = Number(student.std || String(student.className || '').match(/\d+/)?.[0])
    if (!standard || standard < 1 || standard > 12) return
    const divisions = standards.get(standard) || new Set()
    divisions.add(String(student.division || 'A').toUpperCase())
    standards.set(standard, divisions)
  })
  const teachers = await User.find({ role: 'teacher' }).select('teachingClasses teachingClassDivisions').lean()
  teachers.forEach(teacher => (teacher.teachingClasses || []).forEach(value => {
    const match = String(value).match(/(1[0-2]|[1-9])(?:\s*[-/]\s*(?:division\s*)?([a-z0-9_-]{1,8}))?/i)
    if (!match) return
    const standard = Number(match[1])
    if (standard < 1 || standard > 12) return
    const divisions = standards.get(standard) || new Set()
    divisions.add((match[2] || 'A').toUpperCase())
    standards.set(standard, divisions)
  }))
  const homework = await Homework.find({}).select('className division').lean()
  homework.forEach(item => { const standard=Number(String(item.className||'').match(/\d+/)?.[0]); if(!standard||standard<1||standard>12||!item.division)return; const divisions=standards.get(standard)||new Set(); divisions.add(String(item.division).toUpperCase()); standards.set(standard,divisions) })
  const chapters = await Chapter.find({}).select('className').lean()
  chapters.forEach(item => { const match=String(item.className||'').match(/(1[0-2]|[1-9])(?:\s*[-/]\s*(?:division\s*)?([a-z0-9_-]{1,8}))?/i); if(!match)return; const standard=Number(match[1]); const divisions=standards.get(standard)||new Set(); if(match[2])divisions.add(match[2].toUpperCase()); standards.set(standard,divisions) })
  const questions = await Question.find({}).select('className division').lean()
  const papers = await QuestionPaper.find({}).select('className division').lean()
  const exams = await Exam.find({}).select('className division').lean()
  for (const record of [...questions,...papers,...exams]) { const standard=Number(String(record.className||'').match(/\d+/)?.[0]); if(!standard||standard<1||standard>12||!record.division)continue; const divisions=standards.get(standard)||new Set(); divisions.add(String(record.division).toUpperCase()); standards.set(standard,divisions) }
  const timetable = await TimetableEntry.find({}).select('standard division className classDivision').lean()
  timetable.forEach(entry => {
    const standard = Number(entry.standard || String(entry.className || '').match(/\d+/)?.[0])
    if (!standard || standard < 1 || standard > 12) return
    const divisions = standards.get(standard) || new Set()
    divisions.add(String(entry.division || 'A').toUpperCase())
    standards.set(standard, divisions)
  })
  if (!standards.size) return
  const docs = []
  for (const [standard, divisions] of standards) {
    for (const division of divisions) {
      const standardLabel = labelFor(standard)
      docs.push({ standard, standardLabel, division, displayName: `${standardLabel} - ${division}`, active: true })
    }
  }
  if (!(await ClassDivision.exists({}))) await ClassDivision.insertMany(docs, { ordered: false })
  const created = await ClassDivision.find({ active: true }).lean()
  const byKey = new Map(created.map(item => [`${item.standard}:${item.division}`, item]))
  const studentOps = students.flatMap(student => {
    if (student.classDivision) return []
    const standard = Number(student.std || String(student.className || '').match(/\d+/)?.[0])
    const division = String(student.division || 'A').toUpperCase()
    const doc = byKey.get(`${standard}:${division}`)
    return doc ? [{ updateOne: { filter: { _id: student._id }, update: { $set: { classDivision: doc._id, std: doc.standard, division: doc.division, className: `Class ${doc.standard}` } } }] : []
  })
  if (studentOps.length) await User.bulkWrite(studentOps)
  const teacherOps = teachers.filter(teacher => !(teacher.teachingClassDivisions || []).length).map(teacher => {
    const ids = (teacher.teachingClasses || []).flatMap(value => {
      const match = String(value).match(/(1[0-2]|[1-9])(?:\s*[-/]\s*(?:division\s*)?([a-z0-9_-]{1,8}))?/i)
      if (!match) return []
      const standard = Number(match[1])
      const divisionName = match[2] ? match[2].toUpperCase() : ''
      return created.filter(doc => doc.standard === standard && (!divisionName || doc.division === divisionName))
    })
    const unique = [...new Map(ids.map(item => [String(item._id), item])).values()]
    return { updateOne: { filter: { role: 'teacher', _id: teacher._id }, update: { $set: { teachingClassDivisions: unique.map(item => item._id), teachingClasses: unique.map(item => item.displayName) } } }
  })
  if (teacherOps.length) await User.bulkWrite(teacherOps)
  const timetableOps = timetable.flatMap(entry => {
    if (entry.classDivision) return []
    const standard = Number(entry.standard || String(entry.className || '').match(/\d+/)?.[0])
    const division = String(entry.division || 'A').toUpperCase()
    const doc = byKey.get(`${standard}:${division}`)
    return doc ? [{ updateOne: { filter: { _id: entry._id }, update: { $set: { classDivision: doc._id, className: doc.displayName, standard: doc.standard, division: doc.division } } }] : []
  })
  if (timetableOps.length) await TimetableEntry.bulkWrite(timetableOps)
  const migrateRecords = async (Model, field = 'division') => {
    const records = await Model.find({ classDivision: null }).select(`className ${field}`).lean()
    const ops = records.flatMap(record => {
      const standard = Number(String(record.className || '').match(/\d+/)?.[0])
      const division = String(record[field] || '').trim().toUpperCase()
      if (!standard || !division) return []
      const doc = byKey.get(`${standard}:${division}`)
      return doc ? [{ updateOne: { filter: { _id: record._id }, update: { $set: { classDivision: doc._id } } } }] : []
    })
    if (ops.length) await Model.bulkWrite(ops)
  }
  await migrateRecords(Homework)
  await migrateRecords(Question)
  await migrateRecords(QuestionPaper)
  await migrateRecords(Exam)
  const chapterRecords = await Chapter.find({ classDivision: null }).select('className').lean()
  const chapterOps = chapterRecords.flatMap(record => {
    const match = String(record.className || '').match(/(1[0-2]|[1-9])(?:\s*[-/]\s*(?:division\s*)?([a-z0-9_-]{1,8}))?/i)
    if (!match?.[2]) return []
    const doc = byKey.get(`${Number(match[1])}:${match[2].toUpperCase()}`)
    return doc ? [{ updateOne: { filter: { _id: record._id }, update: { $set: { classDivision: doc._id } } } }] : []
  })
  if (chapterOps.length) await Chapter.bulkWrite(chapterOps)

}

export const listClassDivisions = async (req, res, next) => {
  try {
    await seedFromLegacyData()
    const filter = req.user?.role === 'principal' ? {} : { active: true }
    const classes = await ClassDivision.find(filter).sort({ standard: 1, division: 1 }).lean()
    res.json({ success: true, classes: classes.map(item => ({ id: item._id.toString(), standard: item.standard, standardLabel: item.standardLabel, division: item.division, displayName: item.displayName, active: item.active })) })
  } catch (error) { next(error) }
}

export const saveClassStructure = async (req, res, next) => {
  try {
    if (!principalOnly(req)) return res.status(403).json({ success: false, message: 'Only the principal can manage class structure.' })
    const standards = Array.isArray(req.body.standards) ? req.body.standards : []
    if (!standards.length) return res.status(400).json({ success: false, message: 'Add at least one class with a division.' })
    const normalized = []
    const seen = new Set()
    for (const item of standards) {
      const standard = Number(item.standard)
      const standardLabel = String(item.label || labelFor(standard)).trim()
      const divisions = Array.isArray(item.divisions) ? item.divisions.map(value => String(value).trim().toUpperCase()).filter(Boolean) : []
      if (!Number.isInteger(standard) || standard < 1 || standard > 12 || !standardLabel || !divisions.length) return res.status(400).json({ success: false, message: 'Each class must have a valid standard (1–12), a name, and at least one division.' })
      for (const division of divisions) {
        if (!/^[A-Z0-9_-]{1,8}$/.test(division)) return res.status(400).json({ success: false, message: `Invalid division name: ${division}` })
        const key = `${standard}:${division}`
        if (seen.has(key)) return res.status(400).json({ success: false, message: 'Duplicate class division detected.' })
        seen.add(key)
        normalized.push({ standard, standardLabel, division, displayName: `${standardLabel} - ${division}` })
      }
    }
    const existing = await ClassDivision.find({})
    const desiredKeys = new Set(normalized.map(item => `${item.standard}:${item.division}`))
    for (const doc of existing) {
      const key = `${doc.standard}:${doc.division}`
      if (!desiredKeys.has(key) && doc.active) {
        const assignedStudents = await User.countDocuments({ role: 'student', classDivision: doc._id })
        const assignedTeachers = await User.countDocuments({ teachingClassDivisions: doc._id })
        const linkedRecords = await Promise.all([TimetableEntry.countDocuments({ classDivision: doc._id }), Homework.countDocuments({ classDivision: doc._id }), Chapter.countDocuments({ classDivision: doc._id }), Exam.countDocuments({ classDivision: doc._id }), QuestionPaper.countDocuments({ classDivision: doc._id }), Question.countDocuments({ classDivision: doc._id })])
        if (assignedStudents || assignedTeachers || linkedRecords.some(count => count > 0)) return res.status(409).json({ success: false, message: `${doc.displayName} is referenced by users or academic records. Reassign or remove those records before removing it.` })
        doc.active = false
        await doc.save()
      }
    }
    for (const item of normalized) {
      await ClassDivision.findOneAndUpdate({ standard: item.standard, division: item.division }, { $set: { ...item, active: true } }, { upsert: true, new: true, setDefaultsOnInsert: true })
    }
    const classes = await ClassDivision.find({ active: true }).sort({ standard: 1, division: 1 }).lean()
    res.json({ success: true, classes: classes.map(item => ({ id: item._id.toString(), standard: item.standard, standardLabel: item.standardLabel, division: item.division, displayName: item.displayName, active: item.active })) })
  } catch (error) { next(error) }
}
