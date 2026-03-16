import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function NoteList({ refreshKey }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotes()
  }, [refreshKey])

  async function fetchNotes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setNotes(data)
    setLoading(false)
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (!error) fetchNotes()
  }

  if (loading) return <p className="empty">Loading...</p>
  if (notes.length === 0) return <p className="empty">No notes yet. Add one above.</p>

  return (
    <div>
      {notes.map((note) => (
        <div key={note.id} className="note-card">
          <div className="note-content">
            <p className="note-title">{note.title}</p>
            {note.body && <p className="note-body">{note.body}</p>}
          </div>
          <button onClick={() => handleDelete(note.id)}>Delete</button>
        </div>
      ))}
    </div>
  )
}
