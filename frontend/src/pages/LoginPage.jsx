import { useState } from 'react'
import { Eye, EyeOff, GraduationCap, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = await login(email, password)
      const destination = location.state?.from
      navigate(destination?.startsWith(`/${user.role}/`) ? destination : `/${user.role}/overview`, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="login-page">
    <section className="login-brand-panel">
      <div className="login-brand">
        <div className="brand-mark"><GraduationCap size={22}/></div>
        <div><strong>ClassLeaf</strong><span>Tuition management</span></div>
      </div>
      <div className="login-copy">
        <span className="eyebrow">ONE ACCOUNT · YOUR ROLE</span>
        <h1>Everything your class needs, in one place.</h1>
        <p>Sign in with your school email. Your account automatically opens the right workspace for you.</p>
      </div>
      <div className="login-trust"><ShieldCheck size={17}/><span>Secure role-based access</span></div>
    </section>

    <section className="login-card-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-heading"><span className="eyebrow">WELCOME BACK</span><h2>Sign in</h2><p>Use the email and password provided by your school.</p></div>
        {error && <div className="login-error">{error}</div>}
        <label>Email address<div className="input-wrap"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@school.com" autoComplete="email" required/></div></label>
        <label>Password<div className="input-wrap"><LockKeyhole size={17}/><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
        <button className="primary login-submit" disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </section>
  </main>
}
