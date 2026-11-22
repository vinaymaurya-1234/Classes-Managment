import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import User from '../models/User.js'
import ClassDivision from '../models/ClassDivision.js'

const MANAGED_ROLES = ['teacher', 'student', 'parent']
const requirePrincipal = req => req.user?.role === 'principal'
const publicUser = user => {
  const divisionDoc = user.classDivision && typeof user.classDivision === 'object' ? user.classDivision : null
  const teachingDocs = user.teachingClassDivisions || []
  return {
    id: user._id.toString(), name: user.name, email: user.email, role: user.role,
    phone: user.phone || '', avatarUrl: user.avatarUrl || '',
    className: divisionDoc?.displayName || user.className || '',
    classDivisionId: divisionDoc?._id?.toString() || user.classDivision?.toString() || '',
    std: divisionDoc?.standard ?? user.std ?? null,
    division: divisionDoc?.division || user.division || (user.role === 'student' ? 'A' : ''),
    teachingClasses: teachingDocs.length ? teachingDocs.map(item => item.displayName || item.toString()) : (user.teachingClasses || []),
    teachingClassDivisionIds: teachingDocs.map(item => item?._id?.toString()).filter(Boolean),
    children: (user.children || []).map(child => child?._id ? ({ id: child._id.toString(), name: child.name, email: child.email, std: child.std ?? null, division: child.division || '', className: child.classDivision?.displayName || child.className || '', classDivisionId: child.classDivision?._id?.toString() || '' }) : ({ id: child.toString() })),
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt,
  }
}
const populateUser = query => query.populate('classDivision').populate('teachingClassDivisions').populate({ path:'children', select:'name email std division className classDivision', populate:{path:'classDivision'} })

export const listUsers = async (req, res, next) => {
  try {
    if (!requirePrincipal(req)) return res.status(403).json({ success:false, message:'Only the principal can manage users' })
    const role=String(req.query.role||'').trim().toLowerCase()
    const filter=role?{role}:{role:{$in:MANAGED_ROLES}}
    if(role&&!MANAGED_ROLES.includes(role)) return res.status(400).json({success:false,message:'Invalid user role'})
    const users=await populateUser(User.find(filter)).sort({createdAt:-1})
    res.json({success:true,users:users.map(publicUser)})
  } catch(error){next(error)}
}

export const createUser = async (req,res,next) => {
  try {
    if(!requirePrincipal(req)) return res.status(403).json({success:false,message:'Only the principal can create users'})
    const name=String(req.body.name||'').trim(), email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||''), role=String(req.body.role||'').trim().toLowerCase()
    const phone=String(req.body.phone||'').trim(), avatarUrl=String(req.body.avatarUrl||'').trim()
    const parentName=String(req.body.parentName||'').trim(), parentEmail=String(req.body.parentEmail||'').trim().toLowerCase(), parentPassword=String(req.body.parentPassword||''), parentPhone=String(req.body.parentPhone||'').trim()
    const classDivisionId=String(req.body.classDivisionId||'').trim()
    const teachingClassDivisionIds=Array.isArray(req.body.teachingClassDivisionIds)?[...new Set(req.body.teachingClassDivisionIds.map(String))]:[]
    const childIds=Array.isArray(req.body.childIds)?[...new Set(req.body.childIds.map(String))]:[]
    if(!name||!email||!password||!role) return res.status(400).json({success:false,message:'Name, email, password and role are required'})
    if(!MANAGED_ROLES.includes(role)) return res.status(400).json({success:false,message:'Only teacher, student or parent accounts can be created here'})
    if(password.length<8) return res.status(400).json({success:false,message:'Password must be at least 8 characters'})
    if(role==='student'&&!classDivisionId) return res.status(400).json({success:false,message:'Select a class and division from the school class structure.'})
    if(role==='student'&&(!parentName||!parentEmail)) return res.status(400).json({success:false,message:'Parent name and parent Gmail are required.'})
    if(role==='student'&&parentEmail===email) return res.status(400).json({success:false,message:'Student and parent accounts must use different email addresses.'})
    if(role==='teacher'&&!teachingClassDivisionIds.length) return res.status(400).json({success:false,message:'Assign at least one configured class/division to the teacher.'})
    const allClassIds=[...(role==='student'?[classDivisionId]:[]),...(role==='teacher'?teachingClassDivisionIds:[])]
    if(allClassIds.some(id=>!mongoose.isValidObjectId(id))) return res.status(400).json({success:false,message:'Invalid class/division selection.'})
    const classDocs=allClassIds.length?await ClassDivision.find({_id:{$in:allClassIds},active:true}):[]
    if(classDocs.length!==new Set(allClassIds).size) return res.status(400).json({success:false,message:'One or more selected classes are not active in Class Structure.'})
    const studentDivision=role==='student'?classDocs.find(doc=>doc._id.toString()===classDivisionId):null
    if(role!=='parent'&&childIds.length) return res.status(400).json({success:false,message:'Only parent accounts can be linked to children.'})
    if(role==='parent'&&childIds.length){const students=await User.find({_id:{$in:childIds},role:'student'}).select('_id');if(students.length!==childIds.length)return res.status(400).json({success:false,message:'Choose valid student accounts only.'})}
    if(await User.exists({email})) return res.status(409).json({success:false,message:'A user with this email already exists'})
    let parentAccount = null
    let createParentAccount = false
    if(role==='student'){
      parentAccount = await User.findOne({email:parentEmail})
      if(parentAccount && parentAccount.role!=='parent') return res.status(409).json({success:false,message:'This Gmail is already used by a non-parent account.'})
      if(!parentAccount){
        if(parentPassword.length<8) return res.status(400).json({success:false,message:'For a new parent account, temporary password must be at least 8 characters.'})
        createParentAccount = true
      }
    }
    const teacherDocs=role==='teacher'?classDocs:[]
    const user=await User.create({
      name,email,password:await bcrypt.hash(password,12),role,phone,avatarUrl,
      ...(studentDivision?{std:studentDivision.standard,division:studentDivision.division,className:studentDivision.displayName,classDivision:studentDivision._id}:{}),
      ...(role==='teacher'?{teachingClassDivisions:teacherDocs.map(doc=>doc._id),teachingClasses:teacherDocs.map(doc=>doc.displayName)}:{}),
      ...(role==='parent'?{children:childIds}:{})
    })
    if(role==='student'){
      if(createParentAccount){
        try {
          parentAccount = await User.create({name:parentName,email:parentEmail,password:await bcrypt.hash(parentPassword,12),role:'parent',phone:parentPhone,children:[user._id],mustChangePassword:true})
        } catch(parentError) {
          await User.deleteOne({_id:user._id})
          throw parentError
        }
      } else {
        parentAccount.name = parentName || parentAccount.name
        if(parentPhone) parentAccount.phone = parentPhone
        if(!parentAccount.children.some(id=>id.toString()===user._id.toString())) parentAccount.children.push(user._id)
        await parentAccount.save()
      }
    }
    const populated=await populateUser(User.findById(user._id))
    res.status(201).json({success:true,message:`${role.charAt(0).toUpperCase()+role.slice(1)} account created successfully`,user:publicUser(populated)})
  }catch(error){if(error?.code===11000)return res.status(409).json({success:false,message:'A user with this email already exists'});next(error)}
}

export const updateTeacherAssignments = async(req,res,next)=>{
  try{
    if(!requirePrincipal(req))return res.status(403).json({success:false,message:'Only the principal can manage users'})
    const ids=Array.isArray(req.body.teachingClassDivisionIds)?[...new Set(req.body.teachingClassDivisionIds.map(String))]:[]
    if(!ids.length||ids.some(id=>!mongoose.isValidObjectId(id)))return res.status(400).json({success:false,message:'Select at least one valid class/division.'})
    const divisions=await ClassDivision.find({_id:{$in:ids},active:true})
    if(divisions.length!==ids.length)return res.status(400).json({success:false,message:'One or more selected class divisions are not active.'})
    const teacher=await User.findOne({_id:req.params.id,role:'teacher'})
    if(!teacher)return res.status(404).json({success:false,message:'Teacher not found'})
    teacher.teachingClassDivisions=divisions.map(doc=>doc._id)
    teacher.teachingClasses=divisions.map(doc=>doc.displayName)
    await teacher.save()
    const populated=await populateUser(User.findById(teacher._id))
    res.json({success:true,message:'Teacher assignments updated successfully',user:publicUser(populated)})
  }catch(error){next(error)}
}
