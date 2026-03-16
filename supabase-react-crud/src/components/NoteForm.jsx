import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function NoteForm({ onNoteAdded }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('notes').insert({ title, body })

    if (error) {
      setError(error.message)
    } else {
      setTitle('')
      setBody('')
      onNoteAdded()
    }
    setLoading(false)
  }

  return (
    <form className="note-form" onSubmit={handleSubmit}>
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        placeholder="Body (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        Add note
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
