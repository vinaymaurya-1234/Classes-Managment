import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, MessageCircle, Paperclip, Search, Send, Trash2, Pencil, X, MoreHorizontal } from 'lucide-react'
import './ChatPage.css'
import { useAuth } from '../context/AuthContext'
import { deleteDirectMessageApi, editDirectMessageApi, getChatContactsApi, getDirectMessagesApi, sendDirectMessageApi } from '../api/chat.api'

const initials = name => String(name || '?').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
const timeLabel = value => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const dateLabel = value => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))

export default function ChatPage() {
  const { user, token } = useAuth()
  const [contacts, setContacts] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [openMessageMenuId, setOpenMessageMenuId] = useState(null)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [selectedMessageIds, setSelectedMessageIds] = useState([])
  const longPressTimer = useRef(null)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)

  const loadContacts = useCallback(async () => {
    try {
      const result = await getChatContactsApi(token)
      setContacts(result.contacts || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [token])

  const loadMessages = useCallback(async (quiet = false) => {
    if (!selected) return
    try {
      const result = await getDirectMessagesApi(token, selected.id)
      setMessages(result.messages || [])
      if (!quiet) setError('')
    } catch (err) { if (!quiet) setError(err.message) }
  }, [token, selected])

  useEffect(() => { loadContacts() }, [loadContacts])
  useEffect(() => {
    if (!selected) { setMessages([]); return undefined }
    let cancelled = false
    let timer
    const poll = async () => {
      await loadMessages(true)
      if (!cancelled) timer = window.setTimeout(poll, 2500)
    }
    poll()
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [selected, loadMessages])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    if (!openMessageMenuId) return undefined
    const closeOnOutsideClick = event => {
      if (!event.target.closest('.chat-message-menu-wrap')) setOpenMessageMenuId(null)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [openMessageMenuId])

  const filteredContacts = useMemo(() => contacts.filter(contact => `${contact.name} ${contact.email} ${contact.role}`.toLowerCase().includes(search.toLowerCase())), [contacts, search])
  const chooseFile = async event => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    if (!(picked.type.startsWith('image/') || picked.type === 'application/pdf')) { setError('Only images and PDF files are allowed.'); return }
    if (picked.size > 3 * 1024 * 1024) { setError('File size must be 3 MB or smaller.'); return }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(picked)
    })
    setFile({ name: picked.name, mimeType: picked.type, dataUrl })
    setError('')
  }
  const send = async event => {
    event.preventDefault()
    if (!selected || (!text.trim() && !file) || sending) return
    setSending(true); setError('')
    try {
      const result = await sendDirectMessageApi(token, selected.id, { text, attachment: file })
      setMessages(current => [...current, result.message])
      setText(''); setFile(null)
      loadContacts()
    } catch (err) { setError(err.message) }
    finally { setSending(false) }
  }
  const toggleMessageSelection = message => {
    if (message.senderId !== String(user?.id || user?._id || '') || message.deleted) return
    setSelectedMessageIds(current => current.includes(message.id) ? current.filter(id => id !== message.id) : [...current, message.id])
    setOpenMessageMenuId(null)
  }
  const startEdit = message => {
    setSelectedMessageIds([])
    setEditingMessageId(message.id)
    setEditingText(message.text)
    setOpenMessageMenuId(null)
  }
  const saveEdit = async message => {
    const next = editingText.trim()
    if (!next || next === message.text) { setEditingMessageId(null); return }
    try {
      const result = await editDirectMessageApi(token, message.id, next)
      setMessages(current => current.map(item => item.id === message.id ? result.message : item))
      setEditingMessageId(null)
      setEditingText('')
    } catch (err) { setError(err.message) }
  }
  const removeSelectedMessages = async () => {
    const targets = messages.filter(message => selectedMessageIds.includes(message.id))
    for (const message of targets) {
      try {
        const result = await deleteDirectMessageApi(token, message.id)
        setMessages(current => current.map(item => item.id === message.id ? result.message : item))
      } catch (err) { setError(err.message); break }
    }
    setSelectedMessageIds([])
  }
  const removeMessage = async message => {
    setOpenMessageMenuId(null)
    if (!window.confirm('Delete this message for both users?')) return
    try {
      const result = await deleteDirectMessageApi(token, message.id)
      setMessages(current => current.map(item => item.id === message.id ? result.message : item))
    } catch (err) { setError(err.message) }
  }
  const roleLabel = role => role ? role.charAt(0).toUpperCase() + role.slice(1) : ''

  return <section className="chat-page">
    <div className="chat-heading"><div><span className="eyebrow">MESSAGES</span><h2>Chats</h2><p>Have a private conversation with another account.</p></div></div>
    <div className="chat-workspace">
      <aside className="chat-contacts">
        <div className="chat-contacts-title"><strong>Messages</strong><span>{contacts.length} people</span></div>
        <label className="chat-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search people..."/></label>
        <div className="chat-contact-list">
          {loading ? <div className="chat-empty">Loading people...</div> : filteredContacts.map((contact, index) => <React.Fragment key={contact.id}>{user?.role === 'parent' && contact.role === 'principal' && <div className="chat-contacts-section">School Administration</div>}{user?.role === 'parent' && contact.role === 'teacher' && filteredContacts[index - 1]?.role !== 'teacher' && <div className="chat-contacts-section">My Child&apos;s Teachers</div>}<button className={'chat-contact ' + (selected?.id === contact.id ? 'active' : '')} onClick={() => { setSelected(contact); setError('') }}>
            <span className="chat-avatar">{contact.avatarUrl ? <img src={contact.avatarUrl} alt=""/> : initials(contact.name)}</span>
            <span className="chat-contact-copy"><strong>{contact.name}</strong><small>{roleLabel(contact.role)}{contact.std ? ` · Std ${contact.std}` : ''}</small></span>
          </button></React.Fragment>)}
          {!loading && !filteredContacts.length && <div className="chat-empty">No people found.</div>}
        </div>
      </aside>
      <section className="chat-conversation">
        {selected ? <>
          <header className="chat-conversation-head">{selectedMessageIds.length ? <><strong>{selectedMessageIds.length} selected</strong><div className="chat-selection-actions">{selectedMessageIds.length === 1 && messages.some(message => message.id === selectedMessageIds[0] && message.text && message.senderId === String(user?.id || user?._id || '') && !message.deleted) && <button type="button" title="Edit" onClick={() => { const message = messages.find(item => item.id === selectedMessageIds[0]); if (message) startEdit(message) }}><Pencil size={18}/></button>}<button type="button" title="Delete" onClick={removeSelectedMessages}><Trash2 size={18}/></button><button type="button" title="Cancel selection" onClick={() => setSelectedMessageIds([])}><X size={18}/></button></div></> : <><span className="chat-avatar">{selected.avatarUrl ? <img src={selected.avatarUrl} alt=""/> : initials(selected.name)}</span><div><strong>{selected.name}</strong><small>{roleLabel(selected.role)}{selected.std ? ` · Standard ${selected.std}` : ''}</small></div></>}</header>
          <div className="chat-messages">
            {!messages.length && <div className="chat-start"><MessageCircle size={28}/><strong>Start a conversation</strong><span>Send a message to {selected.name}.</span></div>}
            {messages.map((message, index) => {
              const mine = message.senderId === String(user?.id || user?._id || '')
              const previous = messages[index - 1]
              const showDate = !previous || dateLabel(previous.createdAt) !== dateLabel(message.createdAt)
              return <div key={message.id}>{showDate && <div className="chat-date"><span>{dateLabel(message.createdAt)}</span></div>}
                <div className={'chat-message-row ' + (mine ? 'mine' : '') + (selectedMessageIds.includes(message.id) ? ' selected' : '')} onPointerDown={event => { if (event.pointerType !== 'touch' || !mine) return; longPressTimer.current = window.setTimeout(() => toggleMessageSelection(message), 500) }} onPointerUp={() => window.clearTimeout(longPressTimer.current)} onPointerLeave={() => window.clearTimeout(longPressTimer.current)} onContextMenu={event => { if (mine) { event.preventDefault(); toggleMessageSelection(message) } }} onClick={() => { if (selectedMessageIds.length && mine) toggleMessageSelection(message) }}><article className="chat-bubble">
                  {message.deleted ? <em>This message was deleted</em> : <>
                    {editingMessageId === message.id ? <div className="chat-edit-form"><input autoFocus value={editingText} maxLength={5000} onChange={event => setEditingText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); saveEdit(message) } if (event.key === 'Escape') setEditingMessageId(null) }}/><div><button type="button" onClick={() => setEditingMessageId(null)}>Cancel</button><button type="button" onClick={() => saveEdit(message)} disabled={!editingText.trim()}>Save</button></div></div> : message.text && <div className="chat-bubble-text-row"><p>{message.text}</p><small className="chat-inline-time">{timeLabel(message.createdAt)}{message.edited ? ' · edited' : ''}</small></div>}
                    {message.attachment && (message.attachment.mimeType.startsWith('image/') ? <a href={message.attachment.dataUrl} target="_blank" rel="noreferrer" className="chat-image-link"><img src={message.attachment.dataUrl} alt={message.attachment.name}/></a> : <a className="chat-file" href={message.attachment.dataUrl} download={message.attachment.name}><FileText size={20}/><span>{message.attachment.name}<small>PDF attachment</small></span></a>)}
                  </>}
                  <footer>{!message.text && <small>{timeLabel(message.createdAt)}</small>}{mine && !message.deleted && <div className="chat-message-menu-wrap"><button type="button" className="chat-message-menu-trigger" title="Message options" aria-label="Message options" aria-expanded={openMessageMenuId === message.id} onClick={() => setOpenMessageMenuId(current => current === message.id ? null : message.id)}><MoreHorizontal size={17}/></button>{openMessageMenuId === message.id && <div className="chat-message-menu"><button type="button" onClick={() => startEdit(message)}><Pencil size={14}/>Edit</button><button type="button" className="delete" onClick={() => removeMessage(message)}><Trash2 size={14}/>Delete message</button></div>}</div>}</footer>
                </article></div>
              </div>
            })}
            <div ref={bottomRef}/>
          </div>
          {error && <div className="chat-error">{error}</div>}
          <form className="chat-composer" onSubmit={send}>
            {file && <div className="chat-attachment-preview"><span>{file.name}</span><button type="button" onClick={() => setFile(null)}><X size={14}/></button></div>}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={chooseFile}/>
            <button type="button" className="chat-attach" title="Attach image or PDF" onClick={() => fileRef.current?.click()}><Paperclip size={19}/></button>
            <input value={text} onChange={event => setText(event.target.value)} placeholder="Type a message..." maxLength={5000}/>
            <button className="chat-send" type="submit" disabled={sending || (!text.trim() && !file)}><Send size={17}/></button>
          </form>
        </> : <div className="chat-placeholder"><span><MessageCircle size={30}/></span><h3>Your messages</h3><p>Select a person to start a private conversation.</p></div>}
      </section>
    </div>
    {error && !selected && <p className="chat-error">{error}</p>}
  </section>
}
