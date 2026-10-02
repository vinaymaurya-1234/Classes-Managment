export const roles = {
  principal: { label:'Principal', color:'Forest control' },
  teacher: { label:'Teacher', color:'Teaching workspace' },
  student: { label:'Student', color:'Learning space' },
  parent: { label:'Parent', color:'Family view' },
}

export const todayLectures = [
  { time:'08:00', subject:'Mathematics', teacher:'Ms. Priya', room:'Room 04', status:'upcoming' },
  { time:'10:00', subject:'Physics', teacher:'Mr. Arjun', room:'Room 02', status:'live' },
  { time:'12:00', subject:'Chemistry', teacher:'Ms. Neha', room:'Lab 01', status:'upcoming' },
  { time:'16:00', subject:'Biology', teacher:'Mr. Rohan', room:'Room 03', status:'upcoming' },
]

export const students = [
  { name:'Aarav Sharma', className:'12th Science', attendance:94, fee:'Paid', score:88 },
  { name:'Ananya Patel', className:'11th Science', attendance:91, fee:'Pending', score:82 },
  { name:'Vivaan Shah', className:'12th Science', attendance:87, fee:'Paid', score:79 },
  { name:'Diya Mehta', className:'10th Science', attendance:96, fee:'Paid', score:91 },
]

export const teachers = [
  { name:'Priya Nair', className:'Mathematics Faculty', attendance:100 },
  { name:'Arjun Rao', className:'Physics Faculty', attendance:98 },
  { name:'Neha Kulkarni', className:'Chemistry Faculty', attendance:100 },
  { name:'Rohan Desai', className:'Biology Faculty', attendance:96 },
]

export const children = [
  { name:'Aarav Sharma', className:'12th Science', attendance:'94%', score:'88%' },
  { name:'Anaya Sharma', className:'9th Science', attendance:'90%', score:'84%' },
]
