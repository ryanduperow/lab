import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import NoteForm from './components/NoteForm'
import NoteList from './components/NoteList'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (!session) {
    return <Auth />
  }

  return (
    <>
      <header className="app-header">
        <h1>Notes</h1>
        <div>
          <span className="user-info">{session.user.email}</span>
          {' '}
          <button onClick={handleSignOut}>Sign out</button>
        </div>
      </header>
      <NoteForm onNoteAdded={() => setRefreshKey((k) => k + 1)} />
      <NoteList refreshKey={refreshKey} />
    </>
  )
}

export default App
