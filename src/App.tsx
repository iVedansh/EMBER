import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  AudioLines, Compass, Heart, Home, Library, ListMusic, MoreHorizontal,
  Pause, Play, Plus, Search, SkipBack, SkipForward, SlidersHorizontal,
  Volume2, Disc3, Sun, Moon, Shuffle, Repeat2, X, LogOut, UserRound,
  LoaderCircle, Music2, ExternalLink
} from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'

type Playlist = { id: string; name: string; description?: string | null }

type Track = {
  id: string | number
  title: string
  artist: string
  album: string
  duration: string
  genre: string
  cover: string
  coverUrl?: string
  audioUrl?: string
  license?: string
  downloadAllowed: boolean
  source?: string
  genreTags?: string[]
  databaseId?: string
  sourceTrackId?: string
}

const demoTracks: Track[] = [
  { id: 1, title: 'Golden Hour', artist: 'Mira Sol', album: 'Afterglow', duration: '3:24', genre: 'Electronic', cover: 'linear-gradient(140deg,#ef7d36,#3a2016 72%)', downloadAllowed: false },
  { id: 2, title: 'Soft Signals', artist: 'North Arcade', album: 'Quiet Machines', duration: '4:08', genre: 'Ambient', cover: 'linear-gradient(140deg,#b5c36b,#26351f 72%)', downloadAllowed: false },
  { id: 3, title: 'Night Bus', artist: 'June Static', album: 'City in Motion', duration: '2:56', genre: 'Indie', cover: 'linear-gradient(140deg,#c85c35,#4b211b 72%)', downloadAllowed: false },
  { id: 4, title: 'Paper Planes', artist: 'Sunday Service', album: 'Small Worlds', duration: '3:42', genre: 'Jazz', cover: 'linear-gradient(140deg,#d4ae79,#6c4932 72%)', downloadAllowed: false },
  { id: 5, title: 'Green Lights', artist: 'Kite Theory', album: 'Open Roads', duration: '3:11', genre: 'Electronic', cover: 'linear-gradient(140deg,#c8f031,#34411a 72%)', downloadAllowed: false },
  { id: 6, title: 'Somewhere Warm', artist: 'Lena Vale', album: 'Postcards', duration: '4:21', genre: 'Soul', cover: 'linear-gradient(140deg,#bd8a6d,#422e2a 72%)', downloadAllowed: false },
]

const navItems = [
  { label: 'Home', icon: Home },
  { label: 'Discover', icon: Compass },
  { label: 'Your library', icon: Library },
]

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

function Cover({ track, small = false }: { track: Track; small?: boolean }) {
  return <div className={`cover ${small ? 'cover-small' : ''}`} style={{ background: track.cover }} aria-label={`${track.album} cover`}>
    {track.coverUrl ? <img src={track.coverUrl} alt="" loading="lazy" /> : <Disc3 size={small ? 22 : 38} strokeWidth={1.2} />}
    <span className="cover-mark" />
  </div>
}

export default function App() {
  const [query, setQuery] = useState('')
  const [activeNav, setActiveNav] = useState('Home')
  const [current, setCurrent] = useState<Track>(demoTracks[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [liked, setLiked] = useState<Array<string | number>>(() => {
    try { return JSON.parse(localStorage.getItem('ember-liked') ?? '[2,5]') as Array<string | number> } catch { return [2, 5] }
  })
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('ember-theme') === 'light' ? 'light' : 'dark')
  const [genre, setGenre] = useState('All')
  const [queueOpen, setQueueOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [catalogTracks, setCatalogTracks] = useState<Track[]>([])
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([])
  const [recentTracks, setRecentTracks] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([])
  const [playlistDialog, setPlaylistDialog] = useState<'create' | 'add' | null>(null)
  const [playlistName, setPlaylistName] = useState('')
  const [playlistDescription, setPlaylistDescription] = useState('')
  const [playlistBusy, setPlaylistBusy] = useState(false)
  const [playlistError, setPlaylistError] = useState('')
  const [addTrack, setAddTrack] = useState<Track | null>(null)
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [trackDuration, setTrackDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    localStorage.setItem('ember-liked', JSON.stringify(liked))
  }, [liked])

  useEffect(() => {
    localStorage.setItem('ember-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => { if (alive) setSession(data.session) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) {
        setAuthOpen(false)
        setAuthMessage('')
      } else {
        setCatalogTracks([])
        setLibraryTracks([])
        setRecentTracks([])
        setPlaylists([])
        setPlaylistTracks([])
        setActivePlaylistId(null)
        setLiked(previous => previous.filter(id => typeof id === 'number'))
        setIsPlaying(false)
      }
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client || !session) return
    let active = true
    const loadFavourites = async () => {
      const { data, error } = await client
        .from('favourites')
        .select('tracks(id, source, source_track_id, title, artist_name, album, cover_url, duration_seconds, genre_tags, licence_url, download_allowed)')
        .eq('user_id', session.user.id)
      if (!active) return
      if (error) {
        setCatalogError('Could not load saved favourites from your account.')
        return
      }
      const savedTracks = (data ?? []).map((row: { tracks: Record<string, unknown> | Record<string, unknown>[] | null }) => {
        const item = Array.isArray(row.tracks) ? row.tracks[0] : row.tracks
        if (!item || !item.source_track_id) return null
        const tags = Array.isArray(item.genre_tags) ? item.genre_tags.map(String) : []
        const source = String(item.source ?? 'jamendo')
        const sourceTrackId = String(item.source_track_id)
        return {
          id: `${source}:${sourceTrackId}`,
          databaseId: String(item.id ?? ''),
          sourceTrackId,
          title: String(item.title ?? 'Untitled'),
          artist: String(item.artist_name ?? 'Unknown artist'),
          album: String(item.album ?? 'Single'),
          duration: formatTime(Number(item.duration_seconds ?? 0)),
          genre: tags[0] ?? 'Music',
          genreTags: tags,
          cover: 'linear-gradient(140deg,#c75a2b,#322019 75%)',
          coverUrl: String(item.cover_url ?? '') || undefined,
          license: String(item.licence_url ?? '') || undefined,
          downloadAllowed: item.download_allowed === true,
          source: source === 'jamendo' ? 'Jamendo' : source,
        } satisfies Track
      }).filter(Boolean) as Track[]
      setLibraryTracks(savedTracks)
      setLiked(previous => [...previous.filter(id => typeof id === 'number'), ...savedTracks.map(track => track.id)])
    }
    void loadFavourites()
    return () => { active = false }
  }, [session?.user.id])

  useEffect(() => {
    const client = supabase
    if (!client || !session) {
      setPlaylists([])
      setPlaylistTracks([])
      setActivePlaylistId(null)
      return
    }
    let active = true
    const loadPlaylists = async () => {
      const { data, error } = await client
        .from('playlists')
        .select('id, name, description')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      if (!active) return
      if (error) {
        setCatalogError('Could not load playlists. Check that the Supabase migration has been applied.')
        return
      }
      const items = (data ?? []) as Playlist[]
      setPlaylists(items)
      setActivePlaylistId(currentId => currentId && items.some(item => item.id === currentId) ? currentId : null)
    }
    void loadPlaylists()
    return () => { active = false }
  }, [session?.user.id])

  useEffect(() => {
    const client = supabase
    if (!client || !session) {
      setRecentTracks([])
      return
    }
    let active = true
    const loadHistory = async () => {
      const { data, error } = await client
        .from('play_history')
        .select('played_at, tracks(id, source, source_track_id, title, artist_name, album, cover_url, duration_seconds, genre_tags, licence_url, download_allowed)')
        .eq('user_id', session.user.id)
        .order('played_at', { ascending: false })
        .limit(8)
      if (!active) return
      if (error) {
        setCatalogError('Could not load your listening history.')
        return
      }
      const tracks = (data ?? []).map((row: { tracks: Record<string, unknown> | Record<string, unknown>[] | null }) => {
        const item = Array.isArray(row.tracks) ? row.tracks[0] : row.tracks
        if (!item || !item.source_track_id) return null
        const tags = Array.isArray(item.genre_tags) ? item.genre_tags.map(String) : []
        const source = String(item.source ?? 'jamendo')
        const sourceTrackId = String(item.source_track_id)
        return {
          id: source + ':' + sourceTrackId,
          databaseId: String(item.id ?? ''),
          sourceTrackId,
          title: String(item.title ?? 'Untitled'),
          artist: String(item.artist_name ?? 'Unknown artist'),
          album: String(item.album ?? 'Single'),
          duration: formatTime(Number(item.duration_seconds ?? 0)),
          genre: tags[0] ?? 'Music',
          genreTags: tags,
          cover: 'linear-gradient(140deg,#c75a2b,#322019 75%)',
          coverUrl: String(item.cover_url ?? '') || undefined,
          license: String(item.licence_url ?? '') || undefined,
          downloadAllowed: item.download_allowed === true,
          source: source === 'jamendo' ? 'Jamendo' : source,
        } satisfies Track
      }).filter(Boolean) as Track[]
      setRecentTracks(tracks)
    }
    void loadHistory()
    return () => { active = false }
  }, [session?.user.id])

  useEffect(() => {
    const client = supabase
    if (!client || !session || !activePlaylistId) {
      setPlaylistTracks([])
      return
    }
    let active = true
    const loadPlaylistTracks = async () => {
      const { data, error } = await client
        .from('playlist_tracks')
        .select('position, tracks(id, source, source_track_id, title, artist_name, album, cover_url, duration_seconds, genre_tags, licence_url, download_allowed)')
        .eq('playlist_id', activePlaylistId)
        .order('position', { ascending: true })
      if (!active) return
      if (error) {
        setCatalogError('Could not load this playlist.')
        return
      }
      const items = (data ?? []).map((row: { tracks: Record<string, unknown> | Record<string, unknown>[] | null }) => {
        const item = Array.isArray(row.tracks) ? row.tracks[0] : row.tracks
        if (!item || !item.source_track_id) return null
        const tags = Array.isArray(item.genre_tags) ? item.genre_tags.map(String) : []
        const source = String(item.source ?? 'jamendo')
        const sourceTrackId = String(item.source_track_id)
        return {
          id: `${source}:${sourceTrackId}`,
          databaseId: String(item.id ?? ''),
          sourceTrackId,
          title: String(item.title ?? 'Untitled'),
          artist: String(item.artist_name ?? 'Unknown artist'),
          album: String(item.album ?? 'Single'),
          duration: formatTime(Number(item.duration_seconds ?? 0)),
          genre: tags[0] ?? 'Music',
          genreTags: tags,
          cover: 'linear-gradient(140deg,#c75a2b,#322019 75%)',
          coverUrl: String(item.cover_url ?? '') || undefined,
          license: String(item.licence_url ?? '') || undefined,
          downloadAllowed: item.download_allowed === true,
          source: source === 'jamendo' ? 'Jamendo' : source,
        } satisfies Track
      }).filter(Boolean) as Track[]
      setPlaylistTracks(items)
    }
    void loadPlaylistTracks()
    return () => { active = false }
  }, [session?.user.id, activePlaylistId])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setCatalogTracks([])
      setCatalogError('')
      setCatalogBusy(false)
      return
    }
    if (!session?.access_token) {
      setCatalogTracks([])
      setCatalogBusy(false)
      setCatalogError('Sign in to search the live music catalogue. The demo tracks below are only a preview.')
      return
    }
    if (!supabaseConfigured || !supabase) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setCatalogBusy(true)
      setCatalogError('')
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/music-catalog?q=${encodeURIComponent(term)}`, {
          method: 'GET',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          signal: controller.signal,
        })
        const payload = await response.json() as { tracks?: Array<Record<string, unknown>>; error?: string }
        if (!response.ok) throw new Error(payload.error ?? 'Could not search the catalogue.')
        const mapped = (payload.tracks ?? []).map((item): Track => {
          const duration = Number(item.durationSeconds ?? 0)
          const coverUrl = String(item.coverUrl ?? '')
          return {
            id: `jamendo:${String(item.sourceTrackId ?? '')}`,
            databaseId: typeof item.databaseId === 'string' ? item.databaseId : undefined,
            sourceTrackId: String(item.sourceTrackId ?? ''),
            title: String(item.title ?? 'Untitled'),
            artist: String(item.artistName ?? 'Unknown artist'),
            album: String(item.album ?? 'Single'),
            duration: formatTime(duration),
            genre: Array.isArray(item.genreTags) && item.genreTags.length ? String(item.genreTags[0]) : 'Music',
            genreTags: Array.isArray(item.genreTags) ? item.genreTags.map(String) : [],
            cover: 'linear-gradient(140deg,#c75a2b,#322019 75%)',
            coverUrl: coverUrl || undefined,
            audioUrl: typeof item.audioUrl === 'string' ? item.audioUrl : undefined,
            license: typeof item.licenceUrl === 'string' ? item.licenceUrl : undefined,
            downloadAllowed: item.downloadAllowed === true,
            source: 'Jamendo',
          }
        }).filter(track => Boolean(track.id) && !String(track.id).endsWith(':'))
        if (!controller.signal.aborted) {
          setCatalogTracks(mapped)
          if (mapped.length === 0) setCatalogError('No matching tracks found. Try another search.')
        }
      } catch (error) {
        if (!controller.signal.aborted) setCatalogError(error instanceof Error ? error.message : 'Catalogue search failed.')
      } finally {
        if (!controller.signal.aborted) setCatalogBusy(false)
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, session?.access_token])

  const sourceTracks = query.trim().length >= 2 && session ? catalogTracks : demoTracks
  const visibleTracks = useMemo(() => sourceTracks.filter(track => {
    const matchesQuery = session && query.trim().length >= 2
      ? true
      : `${track.title} ${track.artist} ${track.album} ${track.genre}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (genre === 'All' || track.genre.toLowerCase() === genre.toLowerCase() || (track.genreTags ?? []).some(tag => tag.toLowerCase() === genre.toLowerCase()))
  }), [sourceTracks, query, genre, session])

  const playTrack = async (track: Track) => {
    setCurrent(track)
    setCurrentTime(0)
    setTrackDuration(0)
    let playableTrack = track

    if (!playableTrack.audioUrl && playableTrack.sourceTrackId && session && supabaseConfigured) {
      setCatalogBusy(true)
      try {
        const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/music-catalog?id=' + encodeURIComponent(playableTrack.sourceTrackId), {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: 'Bearer ' + session.access_token,
          },
        })
        const payload = await response.json() as { tracks?: Array<Record<string, unknown>>; error?: string }
        if (!response.ok) throw new Error(payload.error ?? 'Could not load this stream.')
        const item = payload.tracks?.[0]
        if (item && typeof item.audioUrl === 'string' && item.audioUrl) {
          playableTrack = {
            ...playableTrack,
            audioUrl: item.audioUrl,
            coverUrl: String(item.coverUrl ?? playableTrack.coverUrl ?? ''),
            license: String(item.licenceUrl ?? playableTrack.license ?? ''),
            downloadAllowed: item.downloadAllowed === true,
          }
        }
      } catch (error) {
        setCatalogError(error instanceof Error ? error.message : 'Could not load this stream.')
      } finally {
        setCatalogBusy(false)
      }
    }

    setCurrent(playableTrack)
    if (playableTrack.audioUrl && audioRef.current) {
      audioRef.current.src = playableTrack.audioUrl
      void audioRef.current.play().then(() => {
        setIsPlaying(true)
        if (session && supabase && playableTrack.databaseId) {
          void supabase.from('play_history').insert({ user_id: session.user.id, track_id: playableTrack.databaseId, listened_seconds: 0 }).then(({ error }) => {
            if (error) {
              setCatalogError('Playback started, but listening history could not be saved.')
              return
            }
            setRecentTracks(previous => [playableTrack, ...previous.filter(item => item.id !== playableTrack.id)].slice(0, 8))
          })
        }
      }).catch(() => {
        setIsPlaying(false)
        setCatalogError('This track could not start. Try another result.')
      })
    } else {
      setIsPlaying(false)
      if (playableTrack.source) setCatalogError('This track has no playable stream URL right now. Try another track.')
    }
  }

  const togglePlay = () => {
    if (!current.audioUrl) {
      setIsPlaying(false)
      if (current.source) setCatalogError('This track does not include a playable stream.')
      return
    }
    if (isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
    } else {
      void audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }

  const toggleLike = async (track: Track) => {
    const wasLiked = liked.includes(track.id)
    setLiked(old => wasLiked ? old.filter(item => item !== track.id) : [...old, track.id])
    if (!session || !supabase || !track.databaseId) return

    const result = wasLiked
      ? await supabase.from('favourites').delete().eq('user_id', session.user.id).eq('track_id', track.databaseId)
      : await supabase.from('favourites').insert({ user_id: session.user.id, track_id: track.databaseId })

    if (result.error) {
      setLiked(old => wasLiked ? [...old, track.id] : old.filter(item => item !== track.id))
      setCatalogError('Could not update your saved music. Check your Supabase migration and try again.')
    } else {
      setLibraryTracks(old => wasLiked
        ? old.filter(saved => saved.id !== track.id)
        : [track, ...old.filter(saved => saved.id !== track.id)])
    }
  }
  const genres = ['All', 'Electronic', 'Ambient', 'Indie', 'Jazz', 'Soul']

  const activePlaylist = playlists.find(playlist => playlist.id === activePlaylistId)

  const openCreatePlaylist = () => {
    if (!session) {
      setAuthMode('signin')
      setAuthOpen(true)
      setAuthMessage('Sign in to create and save playlists.')
      return
    }
    setPlaylistName('')
    setPlaylistDescription('')
    setPlaylistError('')
    setPlaylistDialog('create')
  }

  const openAddTrack = (track: Track) => {
    if (!session) {
      setAuthMode('signin')
      setAuthOpen(true)
      setAuthMessage('Sign in to save tracks to playlists.')
      return
    }
    if (!track.databaseId) {
      setCatalogError('Search the live catalogue to add playable tracks to a playlist.')
      return
    }
    if (playlists.length === 0) {
      setAddTrack(track)
      setPlaylistDialog('create')
      setPlaylistError('Create a playlist first. Then use the add button on a track to save it.')
      return
    }
    setAddTrack(track)
    setPlaylistError('')
    setPlaylistDialog('add')
  }

  const createPlaylist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session || !supabase) return
    const name = playlistName.trim()
    if (!name) return
    setPlaylistBusy(true)
    setPlaylistError('')
    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({ user_id: session.user.id, name, description: playlistDescription.trim() || null })
        .select('id, name, description')
        .single()
      if (error) throw error
      const created = data as Playlist
      setPlaylists(previous => [created, ...previous])
      setActivePlaylistId(created.id)
      setActiveNav('Playlist')
      setPlaylistDialog(null)
    } catch (error) {
      setPlaylistError(error instanceof Error ? error.message : 'Could not create this playlist.')
    } finally {
      setPlaylistBusy(false)
    }
  }

  const addTrackToPlaylist = async (playlistId: string) => {
    if (!session || !supabase || !addTrack?.databaseId) return
    setPlaylistBusy(true)
    setPlaylistError('')
    try {
      const { data: lastRow, error: positionError } = await supabase
        .from('playlist_tracks')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (positionError) throw positionError
      const { error } = await supabase.from('playlist_tracks').insert({
        playlist_id: playlistId,
        track_id: addTrack.databaseId,
        position: (lastRow?.position ?? -1) + 1,
      })
      if (error) throw error
      if (playlistId === activePlaylistId) setPlaylistTracks(previous => [...previous, addTrack])
      setPlaylistDialog(null)
      setAddTrack(null)
    } catch (error) {
      setPlaylistError(error instanceof Error ? error.message : 'Could not add this track.')
    } finally {
      setPlaylistBusy(false)
    }
  }

  const removeTrackFromPlaylist = async (track: Track) => {
    if (!session || !supabase || !activePlaylistId || !track.databaseId) return
    const { error } = await supabase.from('playlist_tracks').delete().eq('playlist_id', activePlaylistId).eq('track_id', track.databaseId)
    if (error) setCatalogError('Could not remove this track from the playlist.')
    else setPlaylistTracks(previous => previous.filter(item => item.id !== track.id))
  }

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthMessage('')
    if (!supabase) {
      setAuthMessage('Supabase is not configured yet. Add your project URL and publishable key to .env.local.')
      return
    }
    if (authPassword.length < 6) {
      setAuthMessage('Use a password with at least 6 characters.')
      return
    }
    setAuthBusy(true)
    try {
      const result = authMode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword })
        : await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword })
      if (result.error) throw result.error
      if (authMode === 'signup' && !result.data.session) {
        setAuthMessage('Account created. Check your email to confirm your address, then sign in.')
      } else {
        setAuthMessage('You are signed in. Your live catalogue search is ready.')
        setAuthOpen(false)
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSignOut = async () => {
    if (!supabase) return
    audioRef.current?.pause()
    const { error } = await supabase.auth.signOut()
    if (error) setCatalogError(error.message)
    else {
      setCatalogTracks([])
      setQuery('')
      setActiveNav('Home')
    }
  }

  const cycleTrack = (direction: -1 | 1) => {
    const collection = query.trim().length >= 2 && session && catalogTracks.length ? catalogTracks : demoTracks
    const index = collection.findIndex(track => track.id === current.id)
    const nextIndex = index < 0 ? 0 : (index + direction + collection.length) % collection.length
    playTrack(collection[nextIndex])
  }

  return (
    <div className={`app theme-${theme}`}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-symbol"><AudioLines size={21} /></span><span>EMBER<span className="brand-dot">.</span></span></div>
        <div className="eyebrow nav-heading">YOUR SPACE</div>
        <nav>
          {navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => setActiveNav(label)}>
            <Icon size={18} /><span>{label}</span>{label === 'Your library' && <span className="nav-count">{liked.length}</span>}
          </button>)}
        </nav>
        <div className="sidebar-rule" />
        <div className="library-heading"><span className="eyebrow">PLAYLISTS</span><button className="icon-button" title="Create playlist" onClick={openCreatePlaylist}><Plus size={17} /></button></div>
        <button className="playlist-link" onClick={() => setActiveNav('Your library')}><span className="playlist-icon"><Heart size={15} fill="currentColor" /></span>Liked songs</button>
        {session && playlists.map(playlist => <button key={playlist.id} className="playlist-link" onClick={() => { setActivePlaylistId(playlist.id); setActiveNav('Playlist') }}><span className="playlist-icon playlist-warm"><ListMusic size={15} /></span><span className="playlist-link-name">{playlist.name}</span></button>)}{session && playlists.length === 0 && <div className="sidebar-empty">No playlists yet</div>}
        <div className="sidebar-bottom">
          <div className="offline-note"><span className="status-dot" /><div><strong>{session ? 'Account connected' : 'Personal listening'}</strong><small>{session?.user.email ?? 'Open catalogue · no ads'}</small></div></div>
          <button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} Switch to {theme === 'dark' ? 'light' : 'dark'} mode</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>YOUR SPACE</span><span className="crumb-slash">/</span><strong>{activeNav.toUpperCase()}</strong></div>
          <div className="top-actions"><span className="date-stamp">PERSONAL MUSIC PLAYER</span>{session ? <button className="account-button" onClick={handleSignOut} title="Sign out"><LogOut size={15} /><span>Sign out</span></button> : <button className="account-button" onClick={() => { setAuthMode('signin'); setAuthOpen(true); setAuthMessage('') }}><UserRound size={15} /><span>Sign in</span></button>}</div>
        </header>

        <section className="welcome-row">
          <div><div className="eyebrow welcome-label"><span className="live-dot" /> YOUR SOUND, YOUR RULES</div><h1>{activeNav === "Discover" ? <>Explore your<br /><em>soundscape.</em></> : activeNav === "Your library" ? <>Your music.<br /><em>Your world.</em></> : <>Find your<br /><em>frequency.</em></>}</h1><p className="intro">{activeNav === "Discover" ? "Search a growing catalogue of independent music." : activeNav === "Your library" ? "Everything you save, gathered in one place." : "A little space for the music that moves you."}</p></div>
          <div className="hero-art" aria-hidden="true"><div className="hero-disc"><div className="disc-inner"><div className="disc-core" /></div></div><div className="hero-sticker">SIDE A<br /><strong>VOL. 001</strong></div><span className="hero-line line-one" /><span className="hero-line line-two" /></div>
        </section>

        <section className="search-section">
          <label className="search-box"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tracks, artists, moods..." aria-label="Search tracks" /><kbd>/</kbd></label>
          <button className="filter-button" onClick={() => setGenre(genre === 'All' ? 'Electronic' : 'All')}><SlidersHorizontal size={17} /><span>Filter</span></button>
        </section>

        {catalogError && <div className="notice-banner" role="status"><span>{catalogError}</span><button className="icon-button" onClick={() => setCatalogError('')} aria-label="Dismiss notice"><X size={15} /></button>{!session && query.trim().length >= 2 && <button className="notice-action" onClick={() => { setAuthOpen(true); setAuthMode('signin'); setAuthMessage('') }}>Sign in to search live music</button>}</div>}

        <section className={`section-block ${activeNav === "Your library" || activeNav === "Playlist" ? "library-hidden" : ""}`}>
          <div className="section-heading"><div><div className="eyebrow">{query.trim().length >= 2 && session ? 'JAMENDO CATALOGUE' : 'THE ROTATION'}</div><h2>{catalogBusy ? 'Finding your sound…' : query ? 'Search results' : 'A good place to start'}</h2></div><button className="text-button" onClick={() => { setQuery(''); setGenre('All'); setCatalogError('') }}>View all <span>↗</span></button></div>
          <div className="genre-row">{genres.map(g => <button key={g} className={`genre-chip ${genre === g ? 'selected' : ''}`} onClick={() => setGenre(g)}>{g}</button>)}</div>
          <div className="track-table">
            <div className="table-head"><span>#</span><span>TITLE</span><span>ALBUM</span><span>TIME</span><span /></div>
            {visibleTracks.map((track, index) => <div key={track.id} className={`track-row ${current.id === track.id ? 'now-playing' : ''}`}>
              <button className="row-number" onClick={() => playTrack(track)} aria-label={`Play ${track.title}`}>{current.id === track.id && isPlaying ? <AudioLines size={17} /> : <><span className="track-index">{String(index + 1).padStart(2, '0')}</span><Play className="row-play" size={16} fill="currentColor" /></>}</button>
              <button className="track-main" onClick={() => playTrack(track)}><Cover track={track} small /><span className="track-titles"><strong>{track.title}</strong><small>{track.artist}{track.source ? ` · ${track.source}` : ''}</small></span></button>
              <span className="album-name">{track.album}</span><span className="duration">{track.duration}</span>
              <div className="row-actions"><button className={`icon-button like-button ${liked.includes(track.id) ? 'liked' : ''}`} title={liked.includes(track.id) ? 'Unlike track' : 'Like track'} onClick={() => void toggleLike(track)}><Heart size={17} fill={liked.includes(track.id) ? 'currentColor' : 'none'} /></button><button className="icon-button" title="Add to playlist" onClick={() => openAddTrack(track)}><Plus size={18} /></button></div>
            </div>)}
            {catalogBusy && <div className="loading-state"><LoaderCircle size={20} className="spin" /> Searching licensed music…</div>}
            {!catalogBusy && visibleTracks.length === 0 && <div className="empty-state">No tracks match that search. Try another title or mood.</div>}
          </div>
          <div className="prototype-note"><span>i</span>{session ? 'Search results come from Jamendo. Playback is available for tracks with a stream URL; download rights are checked separately.' : 'Preview tracks are samples. Sign in to search the live catalogue and stream available tracks.'}</div>
        </section>

        {activeNav === 'Your library' && <section className="library-view">
          <div className="library-intro"><div><div className="eyebrow">YOUR COLLECTION</div><h2>Saved for later.</h2><p>Your liked tracks stay connected to your account across sessions.</p></div><div className="library-total"><Heart size={18} fill="currentColor" /><strong>{libraryTracks.length}</strong><span>saved tracks</span></div></div>
          <div className="section-heading"><div><div className="eyebrow">YOUR PICKS</div><h2>Liked music</h2></div><button className="text-button" onClick={() => setActiveNav('Discover')}>Discover more <span>↗</span></button></div>
          {libraryTracks.length > 0 ? <div className="library-track-grid">{libraryTracks.map((track, index) => <div className="library-card" key={track.id}>
            <button className="library-card-play" onClick={() => void playTrack(track)} aria-label={`Play ${track.title}`}><Cover track={track} /><span className="library-play-badge"><Play size={17} fill="currentColor" /></span></button>
            <div className="library-card-meta"><strong>{track.title}</strong><small>{track.artist}</small><div className="library-card-actions"><span>{track.duration}</span><button className="icon-button liked" title="Remove from liked songs" onClick={() => void toggleLike(track)}><Heart size={16} fill="currentColor" /></button></div></div>
          </div>)}</div> : <div className="library-empty"><div className="empty-disc"><Heart size={25} /></div><h3>Your library is waiting.</h3><p>Search for a track you love and tap the heart to keep it here.</p><button className="auth-submit" onClick={() => setActiveNav('Discover')}>Discover music <span>↗</span></button></div>}
        </section>}

        {activeNav === 'Playlist' && <section className="playlist-view">
          <div className="library-intro"><div><div className="eyebrow">YOUR PLAYLIST</div><h2>{activePlaylist?.name ?? 'Playlist'}</h2><p>{activePlaylist?.description || 'A personal collection of tracks you want to hear again.'}</p></div><div className="library-total"><ListMusic size={18} /><strong>{playlistTracks.length}</strong><span>tracks</span></div></div>
          <div className="section-heading"><div><div className="eyebrow">YOUR SELECTION</div><h2>Tracklist</h2></div><button className="text-button" onClick={() => setActiveNav('Discover')}>Add more music <span>↗</span></button></div>
          {playlistTracks.length > 0 ? <div className="track-table"><div className="table-head"><span>#</span><span>TITLE</span><span>ALBUM</span><span>TIME</span><span /></div>{playlistTracks.map((track,index) => <div key={track.id} className={`track-row ${current.id === track.id ? 'now-playing' : ''}`}><button className="row-number" onClick={() => void playTrack(track)} aria-label={`Play ${track.title}`}>{String(index+1).padStart(2,'0')}</button><button className="track-main" onClick={() => void playTrack(track)}><Cover track={track} small /><span className="track-titles"><strong>{track.title}</strong><small>{track.artist}</small></span></button><span className="album-name">{track.album}</span><span className="duration">{track.duration}</span><div className="row-actions"><button className="icon-button" title="Remove from playlist" onClick={() => void removeTrackFromPlaylist(track)}><X size={17} /></button></div></div>)}</div> : <div className="library-empty"><div className="empty-disc"><ListMusic size={25} /></div><h3>This playlist is ready for a soundtrack.</h3><p>Find music in Discover, then use the plus button on a track to add it here.</p><button className="auth-submit" onClick={() => setActiveNav('Discover')}>Discover music <span>↗</span></button></div>}
        </section>}

        {session && activeNav !== "Your library" && activeNav !== "Playlist" && recentTracks.length > 0 && <section className="section-block recent-section">
          <div className="section-heading"><div><div className="eyebrow">YOUR LISTENING</div><h2>Recently played</h2></div><span className="text-button">Saved to your account</span></div>
          <div className="library-track-grid">{recentTracks.slice(0, 4).map(track => <div className="library-card" key={track.id}>
            <button className="library-card-play" onClick={() => void playTrack(track)} aria-label={"Play " + track.title}><Cover track={track} /><span className="library-play-badge"><Play size={17} fill="currentColor" /></span></button>
            <div className="library-card-meta"><strong>{track.title}</strong><small>{track.artist}</small><div className="library-card-actions"><span>{track.duration}</span><button className="icon-button" title="Play again" onClick={() => void playTrack(track)}><Play size={15} /></button></div></div>
          </div>)}</div>
        </section>}

        <section className={`bottom-grid ${activeNav === "Your library" || activeNav === "Playlist" ? "library-hidden" : ""}`}>
          <div className="feature-panel">
            <div className="eyebrow">MADE FOR YOUR EARS</div><h3>Your library.<br /><em>Your history.</em></h3><p>Build your own corner of the music world, one track at a time.</p><button className="outline-button" onClick={() => { if (!session) setAuthOpen(true); else setActiveNav('Your library') }}>Explore your library <span>↗</span></button>
            <div className="feature-decoration"><Disc3 size={104} strokeWidth={0.7} /></div>
          </div>
          <div className="quick-panel"><div className="section-heading compact"><div><div className="eyebrow">QUICK PICKS</div><h2>Pick a mood</h2></div><Compass size={20} /></div><div className="mood-list">{[{name:'Slow mornings',genre:'Ambient',n:'01'},{name:'After hours',genre:'Electronic',n:'02'},{name:'Easy listening',genre:'Jazz',n:'03'}].map(m => <button key={m.name} className="mood-row" onClick={() => { setGenre(m.genre); setQuery('') }}><span className="mood-number">{m.n}</span><span>{m.name}</span><span className="mood-arrow">↗</span></button>)}</div></div>
        </section>
      </main>

      {queueOpen && <aside className="queue-panel"><div className="section-heading compact"><div><div className="eyebrow">UP NEXT</div><h2>Your queue</h2></div><button className="icon-button" onClick={() => setQueueOpen(false)} aria-label="Close queue"><X size={16} /></button></div>{(query.trim().length >= 2 && session && catalogTracks.length ? catalogTracks : demoTracks).filter(t => t.id !== current.id).slice(0, 5).map(t => <button key={t.id} className="queue-track" onClick={() => playTrack(t)}><Cover track={t} small /><span><strong>{t.title}</strong><small>{t.artist}</small></span><Play size={15} /></button>)}</aside>}

      <footer className="player-bar">
        <div className="playing-track"><Cover track={current} small /><div className="playing-meta"><strong>{current.title}</strong><small>{current.artist}</small></div>{current.license && <a className="license-link" href={current.license} target="_blank" rel="noreferrer" title="View track licence"><ExternalLink size={13} /></a>}<button className={`icon-button like-button ${liked.includes(current.id) ? 'liked' : ''}`} onClick={() => void toggleLike(current)} title="Like current track"><Heart size={17} fill={liked.includes(current.id) ? 'currentColor' : 'none'} /></button></div>
        <div className="player-controls"><div className="control-buttons"><button className="player-icon" title="Shuffle" onClick={() => setCatalogError('Shuffle mode will be added with the full queue controls.')}><Shuffle size={16} /></button><button className="player-icon" title="Previous track" onClick={() => cycleTrack(-1)}><SkipBack size={18} fill="currentColor" /></button><button className="play-button" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button className="player-icon" title="Next track" onClick={() => cycleTrack(1)}><SkipForward size={18} fill="currentColor" /></button><button className="player-icon" title="Repeat" onClick={() => setCatalogError('Repeat mode will be added with the full queue controls.')}><Repeat2 size={16} /></button></div><div className="progress-row"><span>{formatTime(currentTime)}</span><input aria-label="Track progress" className="progress-slider" type="range" min="0" max={trackDuration || 100} value={Math.min(currentTime, trackDuration || 100)} onChange={e => { const next = Number(e.target.value); if (audioRef.current) audioRef.current.currentTime = next; setCurrentTime(next) }} /><span>{formatTime(trackDuration || Number(current.duration.split(':')[0]) * 60 + Number(current.duration.split(':')[1]))}</span></div></div>
        <div className="player-extra"><button className="player-icon" onClick={() => setQueueOpen(!queueOpen)} title="Toggle queue"><ListMusic size={18} /></button><Volume2 size={17} /><input className="volume-slider" aria-label="Volume" type="range" min="0" max="1" step="0.01" defaultValue="0.65" onChange={e => { if (audioRef.current) audioRef.current.volume = Number(e.target.value) }} /></div>
        <audio ref={audioRef} onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={e => setTrackDuration(e.currentTarget.duration)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => cycleTrack(1)} />
      </footer>

      {playlistDialog && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !playlistBusy) setPlaylistDialog(null) }}><section className="auth-modal playlist-modal" role="dialog" aria-modal="true" aria-labelledby="playlist-dialog-title"><button className="modal-close icon-button" onClick={() => setPlaylistDialog(null)} aria-label="Close playlist dialog"><X size={18} /></button><div className="auth-emblem"><ListMusic size={22} /></div><div className="eyebrow">MAKE IT YOURS</div><h2 id="playlist-dialog-title">{playlistDialog === 'create' ? 'New playlist.' : 'Add to playlist.'}</h2><p>{playlistDialog === 'create' ? 'Give this collection a name. You can add tracks from Discover.' : addTrack ? `Choose where to save “${addTrack.title}”.` : 'Choose a playlist.'}</p>{playlistDialog === 'create' ? <form onSubmit={createPlaylist}><label>Playlist name<input required maxLength={80} value={playlistName} onChange={event => setPlaylistName(event.target.value)} placeholder="Late night mix" /></label><label>Description (optional)<input maxLength={180} value={playlistDescription} onChange={event => setPlaylistDescription(event.target.value)} placeholder="A mood, a moment, a memory…" /></label><button className="auth-submit" type="submit" disabled={playlistBusy}>{playlistBusy ? 'Creating…' : 'Create playlist'}</button></form> : <div className="playlist-choice-list">{playlists.map(playlist => <button key={playlist.id} className="playlist-choice" disabled={playlistBusy} onClick={() => void addTrackToPlaylist(playlist.id)}><span className="playlist-choice-icon"><ListMusic size={17} /></span><span><strong>{playlist.name}</strong><small>{playlist.description || 'Personal playlist'}</small></span><span className="mood-arrow">↗</span></button>)}<button className="outline-button create-another" onClick={openCreatePlaylist}><Plus size={15} /> Create a new playlist</button></div>}{playlistError && <div className="auth-message" role="status">{playlistError}</div>}</section></div>}
      {authOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setAuthOpen(false) }}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close icon-button" onClick={() => setAuthOpen(false)} aria-label="Close sign in"><X size={18} /></button><div className="auth-emblem"><Music2 size={22} /></div><div className="eyebrow">YOUR MUSIC, YOUR SPACE</div><h2 id="auth-title">{authMode === 'signin' ? 'Welcome back.' : 'Make it yours.'}</h2><p>{authMode === 'signin' ? 'Sign in to search the live catalogue and start listening.' : 'Create an account to get started with EMBER.'}</p><form onSubmit={handleAuth}><label>Email address<input type="email" required autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com" /></label><label>Password<input type="password" required minLength={6} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="At least 6 characters" /></label><button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? <LoaderCircle size={17} className="spin" /> : null}{authBusy ? 'Please wait…' : authMode === 'signin' ? 'Sign in' : 'Create account'}</button></form>{authMessage && <div className="auth-message" role="status">{authMessage}</div>}{!supabaseConfigured && <div className="auth-message">Setup needed: add the Supabase URL and publishable key to your local environment.</div>}<div className="auth-switch">{authMode === 'signin' ? "New to EMBER?" : 'Already have an account?'} <button onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthMessage('') }}>{authMode === 'signin' ? 'Create account' : 'Sign in'}</button></div></section></div>}
    </div>
  )
}
