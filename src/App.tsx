import { useMemo, useRef, useState } from 'react'
import {
  AudioLines, Compass, Heart, Home, Library, ListMusic, MoreHorizontal,
  Pause, Play, Plus, Search, SkipBack, SkipForward, SlidersHorizontal,
  Volume2, Disc3, Sun, Moon, Shuffle, Repeat2
} from 'lucide-react'

type Track = {
  id: number
  title: string
  artist: string
  album: string
  duration: string
  genre: string
  cover: string
  audioUrl?: string
  license?: string
  downloadAllowed: boolean
}

const tracks: Track[] = [
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

function Cover({ track, small = false }: { track: Track; small?: boolean }) {
  return <div className={`cover ${small ? 'cover-small' : ''}`} style={{ background: track.cover }} aria-label={`${track.album} cover`}>
    <Disc3 size={small ? 22 : 38} strokeWidth={1.2} />
    <span className="cover-mark" />
  </div>
}

export default function App() {
  const [query, setQuery] = useState('')
  const [activeNav, setActiveNav] = useState('Home')
  const [current, setCurrent] = useState<Track>(tracks[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [liked, setLiked] = useState<number[]>([2, 5])
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [genre, setGenre] = useState('All')
  const [queueOpen, setQueueOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const visibleTracks = useMemo(() => tracks.filter(track => {
    const matchesQuery = `${track.title} ${track.artist} ${track.album} ${track.genre}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (genre === 'All' || track.genre === genre)
  }), [query, genre])

  const playTrack = (track: Track) => {
    setCurrent(track)
    if (track.audioUrl && audioRef.current) {
      audioRef.current.src = track.audioUrl
      void audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    } else {
      setIsPlaying(false)
    }
  }

  const togglePlay = () => {
    if (!current.audioUrl) {
      setIsPlaying(false)
      return
    }
    if (isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
    } else {
      void audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }

  const toggleLike = (id: number) => setLiked(old => old.includes(id) ? old.filter(item => item !== id) : [...old, id])
  const genres = ['All', 'Electronic', 'Ambient', 'Indie', 'Jazz', 'Soul']

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
        <div className="library-heading"><span className="eyebrow">PLAYLISTS</span><button className="icon-button" title="Create playlist" onClick={() => alert('Playlist creation will be connected to your account in Phase 2.')}><Plus size={17} /></button></div>
        <button className="playlist-link" onClick={() => setActiveNav('Your library')}><span className="playlist-icon"><Heart size={15} fill="currentColor" /></span>Liked songs</button>
        <button className="playlist-link" onClick={() => setActiveNav('Your library')}><span className="playlist-icon playlist-warm"><ListMusic size={15} /></span>Late night mix</button>
        <div className="sidebar-bottom">
          <div className="offline-note"><span className="status-dot" /><div><strong>Personal listening</strong><small>Open catalogue · no ads</small></div></div>
          <button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} Switch to {theme === 'dark' ? 'light' : 'dark'} mode</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>YOUR SPACE</span><span className="crumb-slash">/</span><strong>{activeNav.toUpperCase()}</strong></div>
          <div className="top-actions"><span className="date-stamp">PERSONAL MUSIC PLAYER</span><button className="profile-button" title="Account setup">V</button></div>
        </header>

        <section className="welcome-row">
          <div><div className="eyebrow welcome-label"><span className="live-dot" /> YOUR SOUND, YOUR RULES</div><h1>Find your<br /><em>frequency.</em></h1><p className="intro">A little space for the music that moves you.</p></div>
          <div className="hero-art" aria-hidden="true"><div className="hero-disc"><div className="disc-inner"><div className="disc-core" /></div></div><div className="hero-sticker">SIDE A<br /><strong>VOL. 001</strong></div><span className="hero-line line-one" /><span className="hero-line line-two" /></div>
        </section>

        <section className="search-section">
          <label className="search-box"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tracks, artists, moods..." aria-label="Search tracks" /><kbd>/</kbd></label>
          <button className="filter-button" onClick={() => setGenre(genre === 'All' ? 'Electronic' : 'All')}><SlidersHorizontal size={17} /><span>Filter</span></button>
        </section>

        <section className="section-block">
          <div className="section-heading"><div><div className="eyebrow">THE ROTATION</div><h2>{query ? 'Search results' : 'A good place to start'}</h2></div><button className="text-button" onClick={() => { setQuery(''); setGenre('All') }}>View all <span>↗</span></button></div>
          <div className="genre-row">{genres.map(g => <button key={g} className={`genre-chip ${genre === g ? 'selected' : ''}`} onClick={() => setGenre(g)}>{g}</button>)}</div>
          <div className="track-table">
            <div className="table-head"><span>#</span><span>TITLE</span><span>ALBUM</span><span>TIME</span><span /></div>
            {visibleTracks.map((track, index) => <div key={track.id} className={`track-row ${current.id === track.id ? 'now-playing' : ''}`}>
              <button className="row-number" onClick={() => playTrack(track)} aria-label={`Play ${track.title}`}>{current.id === track.id && isPlaying ? <AudioLines size={17} /> : <><span className="track-index">{String(index + 1).padStart(2, '0')}</span><Play className="row-play" size={16} fill="currentColor" /></>}</button>
              <button className="track-main" onClick={() => playTrack(track)}><Cover track={track} small /><span className="track-titles"><strong>{track.title}</strong><small>{track.artist}</small></span></button>
              <span className="album-name">{track.album}</span><span className="duration">{track.duration}</span>
              <div className="row-actions"><button className={`icon-button like-button ${liked.includes(track.id) ? 'liked' : ''}`} title={liked.includes(track.id) ? 'Unlike track' : 'Like track'} onClick={() => toggleLike(track.id)}><Heart size={17} fill={liked.includes(track.id) ? 'currentColor' : 'none'} /></button><button className="icon-button" title="More options" onClick={() => setQueueOpen(!queueOpen)}><MoreHorizontal size={19} /></button></div>
            </div>)}
            {visibleTracks.length === 0 && <div className="empty-state">No tracks match that search. Try another title or mood.</div>}
          </div>
          <div className="prototype-note"><span>i</span> Preview catalogue only. Real tracks will load when the Jamendo/Audius API adapters are configured.</div>
        </section>

        <section className="bottom-grid">
          <div className="feature-panel">
            <div className="eyebrow">MADE FOR YOUR EARS</div><h3>Your library.<br /><em>Your history.</em></h3><p>Build your own corner of the music world, one track at a time.</p><button className="outline-button" onClick={() => setActiveNav('Your library')}>Explore your library <span>↗</span></button>
            <div className="feature-decoration"><Disc3 size={104} strokeWidth={0.7} /></div>
          </div>
          <div className="quick-panel"><div className="section-heading compact"><div><div className="eyebrow">QUICK PICKS</div><h2>Pick a mood</h2></div><Compass size={20} /></div><div className="mood-list">{[{name:'Slow mornings',genre:'Ambient',n:'01'},{name:'After hours',genre:'Electronic',n:'02'},{name:'Easy listening',genre:'Jazz',n:'03'}].map(m => <button key={m.name} className="mood-row" onClick={() => { setGenre(m.genre); setQuery('') }}><span className="mood-number">{m.n}</span><span>{m.name}</span><span className="mood-arrow">↗</span></button>)}</div></div>
        </section>
      </main>

      {queueOpen && <aside className="queue-panel"><div className="section-heading compact"><div><div className="eyebrow">UP NEXT</div><h2>Your queue</h2></div><button className="icon-button" onClick={() => setQueueOpen(false)}>×</button></div>{tracks.filter(t => t.id !== current.id).slice(0, 4).map(t => <button key={t.id} className="queue-track" onClick={() => playTrack(t)}><Cover track={t} small /><span><strong>{t.title}</strong><small>{t.artist}</small></span><Play size={15} /></button>)}</aside>}

      <footer className="player-bar">
        <div className="playing-track"><Cover track={current} small /><div className="playing-meta"><strong>{current.title}</strong><small>{current.artist}</small></div><button className={`icon-button like-button ${liked.includes(current.id) ? 'liked' : ''}`} onClick={() => toggleLike(current.id)} title="Like current track"><Heart size={17} fill={liked.includes(current.id) ? 'currentColor' : 'none'} /></button></div>
        <div className="player-controls"><div className="control-buttons"><button className="player-icon" title="Shuffle"><Shuffle size={16} /></button><button className="player-icon" title="Previous track" onClick={() => playTrack(tracks[(tracks.findIndex(t => t.id === current.id) + tracks.length - 1) % tracks.length])}><SkipBack size={18} fill="currentColor" /></button><button className="play-button" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button className="player-icon" title="Next track" onClick={() => playTrack(tracks[(tracks.findIndex(t => t.id === current.id) + 1) % tracks.length])}><SkipForward size={18} fill="currentColor" /></button><button className="player-icon" title="Repeat"><Repeat2 size={16} /></button></div><div className="progress-row"><span>0:00</span><div className="progress-track"><div className="progress-fill" /></div><span>{current.duration}</span></div></div>
        <div className="player-extra"><button className="player-icon" onClick={() => setQueueOpen(!queueOpen)} title="Toggle queue"><ListMusic size={18} /></button><Volume2 size={17} /><div className="volume-track"><div /></div></div>
        <audio ref={audioRef} onEnded={() => { const i = tracks.findIndex(t => t.id === current.id); playTrack(tracks[(i + 1) % tracks.length]) }} />
      </footer>
    </div>
  )
}
