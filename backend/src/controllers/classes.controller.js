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
  if (await ClassDivision.exists({})) return
  const standards = new Map()
  const students = await User.find({ role: 'student' }).select('std division className').lean()
  students.forEach(student => {
    const standard = Number(student.std || String(student.className || '').match(/\d+/)?.[0])
    if (!standard || standard < 1 || standard > 12) return
    const divisions = standards.get(standard) || new Set()
    divisions.add(String(student.division || 'A').toUpperCase())
    standards.set(standard, divisions)
  })
  const teachers = await User.find({ role: 'teacher' }).select('teachingClasses').lean()
  teachers.forEach(teacher => (teacher.teachingClasses || []).forEach(value => {
    const match = String(value).match(/(?:class\s*)?(\d{1,2})(?:\s*[-/]\s*([a-z]))?/i)
    if (!match) return
    const standard = Number(match[1])
    if (standard < 1 || standard > 12) return
    const divisions = standards.get(standard) || new Set()
    divisions.add((match[2] || 'A').toUpperCase())
    standards.set(standard, divisions)
  }))
  const timetable = await TimetableEntry.find({}).select('standard division className').lean()
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
  await ClassDivision.insertMany(docs, { ordered: false })
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
        if (assignedStudents || assignedTeachers) return res.status(409).json({ success: false, message: `${doc.displayName} is referenced by users or academic records. Reassign or remove those records before removing it.` })
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
