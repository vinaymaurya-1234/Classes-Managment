import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePasswordApi } from '../api/auth.api'
import { useAuth } from '../context/AuthContext'

export default function ParentPasswordSetupPage() {
  const { token, user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setSaving(true)
    try {
      await changePasswordApi(token, { newPassword: password })
      updateUser({ ...user, mustChangePassword: false })
      navigate('/parent/overview', { replace: true })
    } catch (err) {
      setError(err.message || 'Unable to update password.')
    } finally {
      setSaving(false)
    }
  }

  return <main className="login-page">
    <section className="login-card-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-heading">
          <span className="eyebrow">SECURE YOUR ACCOUNT</span>
          <h2>Set your new password</h2>
          <p>For your security, create a new password before opening the parent dashboard.</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <label>New password
          <input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        <label>Confirm new password
          <input type="password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        <button className="primary login-submit" disabled={saving}>{saving ? 'Saving...' : 'Save new password'}</button>
        <button type="button" className="secondary" onClick={logout}>Sign out</button>
      </form>
    </section>
  </main>
}
