import { useEffect, useState } from 'react'
import { KeyRound, Save, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { changePasswordApi, updateProfileApi } from '../api/auth.api'
import AvatarCropper from '../components/profile/AvatarCropper'

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '', avatarUrl: '' })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '', phone: user.phone || '', avatarUrl: user.avatarUrl || '' })
    }
  }, [user])

  const saveProfile = async event => {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      const result = await updateProfileApi(token, form)
      updateUser(result.user)
      setMessage('Profile updated successfully.')
    } catch (err) {
      setError(err.message)
    }
  }

  const savePassword = async event => {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      await changePasswordApi(token, passwords)
      setPasswords({ currentPassword: '', newPassword: '' })
      setMessage('Password updated successfully.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="profile-page">
      <div className="section-intro"><div><h2>Edit your profile</h2><p>Update the information connected to your ClassLeaf account.</p></div></div>
      {(message || error) && <div className={error ? 'profile-message error' : 'profile-message'}>{error || message}</div>}
      <div className="profile-grid">
        <form className="card profile-card" onSubmit={saveProfile}>
          <div className="profile-card-head"><div className="profile-icon"><UserRound size={19} /></div><div><h3>Personal details</h3><p>Your role is managed by your school.</p></div></div>
          <label>Full name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /></label>
          <label>Email address<input value={user?.email || ''} disabled /></label>
          <label>Role<input value={user?.role || ''} disabled /></label>
          <label>Phone<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label>
          <div className="profile-avatar-field"><AvatarCropper value={form.avatarUrl} onChange={avatarUrl => setForm({ ...form, avatarUrl })} /></div>
          <button className="primary"><Save size={15} />Save profile</button>
        </form>
        <form className="card profile-card" onSubmit={savePassword}>
          <div className="profile-card-head"><div className="profile-icon"><KeyRound size={19} /></div><div><h3>Change password</h3><p>Use at least 8 characters for your new password.</p></div></div>
          <label>Current password<input type="password" value={passwords.currentPassword} onChange={event => setPasswords({ ...passwords, currentPassword: event.target.value })} required /></label>
          <label>New password<input type="password" minLength={8} value={passwords.newPassword} onChange={event => setPasswords({ ...passwords, newPassword: event.target.value })} required /></label>
          <button className="secondary"><KeyRound size={15} />Update password</button>
        </form>
      </div>
    </div>
  )
}