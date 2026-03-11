import { useState, useRef, useCallback } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const API_KEY  = import.meta.env.VITE_API_KEY  || ''

// ─── Icons ────────────────────────────────────────────────────────────────
const UploadIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)
const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)
const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)
const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
  </svg>
)

// ─── Spinner ──────────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={{
    width: 22, height: 22, borderRadius: '50%',
    border: '2px solid rgba(12,12,20,0.2)',
    borderTopColor: 'var(--ink)',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  }}/>
)

// ─── Step Badge ───────────────────────────────────────────────────────────
const Step = ({ n, label, active, done }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: done ? 0.5 : 1 }}>
    <div style={{
      width: 28, height: 28, borderRadius: '50%', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: active ? 'var(--accent)' : done ? 'var(--surface-2)' : 'var(--surface)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
      fontSize: 12, fontWeight: 700,
      color: active ? 'var(--ink)' : done ? 'var(--muted-2)' : 'var(--muted)',
      flexShrink: 0, transition: 'all 0.3s',
    }}>
      {done ? '✓' : n}
    </div>
    <span style={{
      fontSize: 13, fontWeight: 500,
      color: active ? '#e5e7eb' : 'var(--muted)',
      transition: 'color 0.3s',
    }}>{label}</span>
  </div>
)

// ─── Progress Steps ───────────────────────────────────────────────────────
const STEPS = ['Upload file', 'Validate data', 'Generate AI summary', 'Send email']
const ProcessingSteps = ({ currentStep }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {STEPS.map((label, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: i < currentStep ? 'rgba(61,255,160,0.15)'
                    : i === currentStep ? 'var(--accent-dim)'
                    : 'var(--surface)',
          border: `1.5px solid ${
            i < currentStep  ? 'var(--green)'
          : i === currentStep ? 'var(--accent)'
          : 'var(--border)'}`,
          transition: 'all 0.3s',
        }}>
          {i < currentStep
            ? <span style={{ fontSize: 11, color: 'var(--green)' }}>✓</span>
            : i === currentStep
            ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-ring 1s infinite' }}/>
            : <span style={{ fontSize: 10, color: 'var(--muted)' }}>{i+1}</span>
          }
        </div>
        <span style={{
          fontSize: 13,
          color: i <= currentStep ? '#e5e7eb' : 'var(--muted)',
          fontWeight: i === currentStep ? 500 : 400,
          transition: 'color 0.3s',
        }}>{label}</span>
      </div>
    ))}
  </div>
)

// ─── Main App ─────────────────────────────────────────────────────────────
export default function App() {
  const [file, setFile]     = useState(null)
  const [email, setEmail]   = useState('')
  const [name, setName]     = useState('')
  const [dragging, setDrag] = useState(false)
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [error, setError]   = useState('')
  const [result, setResult] = useState(null)
  const [step, setStep]     = useState(0)
  const fileRef             = useRef(null)

  const handleFile = useCallback((f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv','xlsx','xls'].includes(ext)) {
      setError('Only .csv or .xlsx files are accepted.')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB.')
      return
    }
    setFile(f)
    setError('')
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDrag(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const onDragOver = (e) => { e.preventDefault(); setDrag(true) }
  const onDragLeave = () => setDrag(false)

  const onSubmit = async () => {
    if (!file) return setError('Please select a file.')
    if (!email) return setError('Please enter a recipient email.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Enter a valid email address.')

    setStatus('loading')
    setError('')
    setStep(0)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('email', email)
    if (name) formData.append('senderName', name)

    // Simulate step progression
    const stepTimer = (s, delay) => setTimeout(() => setStep(s), delay)
    stepTimer(1, 600)
    stepTimer(2, 1400)
    stepTimer(3, 2800)

    try {
      const { data } = await axios.post(`${API_BASE}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(API_KEY && { 'X-API-Key': API_KEY }),
        },
      })
      setStep(4)
      setTimeout(() => {
        setStatus('success')
        setResult(data)
      }, 500)
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong. Please try again.'
      setStatus('error')
      setError(msg)
    }
  }

  const reset = () => {
    setFile(null); setEmail(''); setName(''); setStatus('idle')
    setError(''); setResult(null); setStep(0)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Nav ── */}
      <nav style={{
        padding: '20px 40px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(12,12,20,0.7)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--ink)', fontWeight: 800, fontSize: 14,
            fontFamily: 'var(--font-display)',
          }}>R</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>
            Rabbitt AI
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            background: 'var(--accent-dim)', color: 'var(--accent)',
            padding: '4px 10px', borderRadius: 20, fontSize: 11,
            fontWeight: 600, border: '1px solid rgba(232,255,71,0.25)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <SparkleIcon /> Sales Insight Automator
          </span>
        </div>
      </nav>

      {/* ── Hero ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px 80px' }}>

        <div className="animate-fade-up" style={{ textAlign: 'center', marginBottom: 56, maxWidth: 540 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20,
            background: 'var(--accent-dim)', border: '1px solid rgba(232,255,71,0.2)',
            borderRadius: 20, padding: '6px 14px', fontSize: 12, color: 'var(--accent)', fontWeight: 600,
          }}>
            <SparkleIcon /> Powered by Google Gemini
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(36px,6vw,58px)',
            lineHeight: 1.05, letterSpacing: '-2px', color: '#fff', marginBottom: 18,
          }}>
            Sales data.<br/>
            <span style={{
              background: 'linear-gradient(90deg, var(--accent), #a8f560)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Executive clarity.
            </span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 17, lineHeight: 1.65, fontWeight: 300 }}>
            Upload your quarterly CSV or Excel file. Our AI distils it into a
            professional narrative summary and delivers it straight to any inbox — in seconds.
          </p>
        </div>

        {/* ── Card ── */}
        <div className="animate-fade-up-1" style={{ width: '100%', maxWidth: 760 }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 20, overflow: 'hidden',
            backdropFilter: 'blur(20px)',
          }}>

            {/* ── Idle / Form ── */}
            {status === 'idle' && (
              <div style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>

                {/* Drop zone */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted-2)', marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Sales Data File
                  </label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    style={{
                      border: `2px dashed ${dragging ? 'var(--accent)' : file ? 'rgba(61,255,160,0.4)' : 'var(--border-light)'}`,
                      borderRadius: var(--radius),
                      padding: '32px 24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: dragging ? 'var(--accent-dim)' : file ? 'rgba(61,255,160,0.05)' : 'var(--surface)',
                      transition: 'all var(--transition)',
                      position: 'relative',
                    }}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={e => handleFile(e.target.files[0])}
                      style={{ display: 'none' }}
                    />
                    {file ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10, background: 'rgba(61,255,160,0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)',
                        }}>
                          <FileIcon />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 500, fontSize: 14, color: '#e5e7eb' }}>{file.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            {(file.size / 1024).toFixed(1)} KB · click to change
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{
                          width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
                          background: 'var(--surface-2)', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: 'var(--muted)',
                        }}>
                          <UploadIcon />
                        </div>
                        <div style={{ fontWeight: 500, color: '#e5e7eb', marginBottom: 4 }}>
                          Drop your file here or <span style={{ color: 'var(--accent)' }}>browse</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Supports .csv and .xlsx — max 5MB</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Email + Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted-2)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Recipient Email *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}>
                        <MailIcon />
                      </span>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="exec@company.com"
                        style={{
                          width: '100%', padding: '12px 14px 12px 42px',
                          background: 'var(--surface-2)', border: '1px solid var(--border-light)',
                          borderRadius: var(--radius-sm), color: '#e5e7eb', fontSize: 14,
                          outline: 'none', transition: 'border-color var(--transition)',
                          fontFamily: 'var(--font-body)',
                        }}
                        onFocus={e => e.target.style.borderColor = 'rgba(232,255,71,0.5)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted-2)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Sender Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="The Sales Team"
                      maxLength={100}
                      style={{
                        width: '100%', padding: '12px 14px',
                        background: 'var(--surface-2)', border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)', color: '#e5e7eb', fontSize: 14,
                        outline: 'none', transition: 'border-color var(--transition)',
                        fontFamily: 'var(--font-body)',
                      }}
                      onFocus={e => e.target.style.borderColor = 'rgba(232,255,71,0.5)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                    background: 'rgba(255,95,95,0.1)', border: '1px solid rgba(255,95,95,0.25)',
                    borderRadius: 'var(--radius-sm)', color: '#ff8a8a', fontSize: 13,
                    animation: 'fadeIn 0.2s',
                  }}>
                    <AlertIcon /> {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={onSubmit}
                  disabled={!file || !email}
                  style={{
                    width: '100%', padding: '15px',
                    background: !file || !email ? 'var(--surface-2)' : 'var(--accent)',
                    border: 'none', borderRadius: 'var(--radius)',
                    color: !file || !email ? 'var(--muted)' : 'var(--ink)',
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                    cursor: !file || !email ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition)', letterSpacing: '-0.2px',
                  }}
                  onMouseEnter={e => { if (file && email) e.target.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => e.target.style.transform = 'none'}
                >
                  Generate & Send Summary →
                </button>
              </div>
            )}

            {/* ── Loading ── */}
            {status === 'loading' && (
              <div style={{ padding: '48px 40px', textAlign: 'center' }}>
                <div style={{ marginBottom: 32 }}>
                  <div style={{
                    width: 68, height: 68, borderRadius: 18, margin: '0 auto 20px',
                    background: 'var(--accent-dim)', border: '1px solid rgba(232,255,71,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, animation: 'float 2s ease-in-out infinite',
                  }}>✨</div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                    Generating your insight...
                  </h2>
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                    Gemini is analysing <strong style={{ color: '#e5e7eb' }}>{file?.name}</strong>
                  </p>
                </div>
                <div style={{
                  background: 'var(--surface-2)', borderRadius: 'var(--radius)',
                  padding: '24px 28px', textAlign: 'left', maxWidth: 340, margin: '0 auto',
                }}>
                  <ProcessingSteps currentStep={step} />
                </div>
              </div>
            )}

            {/* ── Success ── */}
            {status === 'success' && (
              <div style={{ padding: '48px 40px', textAlign: 'center', animation: 'fadeUp 0.5s' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
                  background: 'rgba(61,255,160,0.12)', border: '2px solid var(--green)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--green)',
                }}>
                  <CheckIcon />
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 10 }}>
                  Report Sent!
                </h2>
                <p style={{ color: 'var(--muted)', marginBottom: 8, fontSize: 15 }}>
                  Your AI-generated sales insight has been delivered to
                </p>
                <p style={{
                  color: 'var(--accent)', fontWeight: 600, fontSize: 16,
                  background: 'var(--accent-dim)', display: 'inline-block',
                  padding: '6px 16px', borderRadius: 20, marginBottom: 28,
                }}>
                  {email}
                </p>

                {result?.stats && (
                  <div style={{
                    display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap',
                  }}>
                    <StatChip label="Records processed" value={result.stats.totalRows} />
                    <StatChip label="Columns analysed" value={result.stats.columns?.length} />
                    <StatChip label="Request ID" value={result.requestId?.slice(0,8) + '…'} mono />
                  </div>
                )}

                <button
                  onClick={reset}
                  style={{
                    padding: '12px 32px', background: 'var(--surface-2)',
                    border: '1px solid var(--border-light)', borderRadius: 'var(--radius)',
                    color: '#e5e7eb', fontFamily: 'var(--font-display)', fontWeight: 600,
                    fontSize: 14, cursor: 'pointer', transition: 'all var(--transition)',
                  }}
                  onMouseEnter={e => e.target.style.background = 'var(--surface)'}
                  onMouseLeave={e => e.target.style.background = 'var(--surface-2)'}
                >
                  ← Process another file
                </button>
              </div>
            )}

            {/* ── Error ── */}
            {status === 'error' && (
              <div style={{ padding: '48px 40px', textAlign: 'center', animation: 'fadeUp 0.5s' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
                  background: 'rgba(255,95,95,0.1)', border: '2px solid rgba(255,95,95,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28,
                }}>⚠️</div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 10 }}>
                  Something went wrong
                </h2>
                <p style={{
                  color: '#ff8a8a', marginBottom: 28, maxWidth: 400, margin: '0 auto 28px',
                  background: 'rgba(255,95,95,0.08)', padding: '12px 20px', borderRadius: 10,
                  border: '1px solid rgba(255,95,95,0.2)', fontSize: 14,
                }}>
                  {error}
                </p>
                <button
                  onClick={reset}
                  style={{
                    padding: '12px 32px', background: 'var(--accent)',
                    border: 'none', borderRadius: 'var(--radius)',
                    color: 'var(--ink)', fontFamily: 'var(--font-display)', fontWeight: 700,
                    fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Feature Tiles ── */}
        {status === 'idle' && (
          <div className="animate-fade-up-2" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
            maxWidth: 760, width: '100%', marginTop: 28,
          }}>
            {[
              { icon: '🔒', title: 'Secured API', desc: 'Rate-limited endpoints with API key auth & Helmet headers' },
              { icon: '🤖', title: 'Gemini AI', desc: 'Gemini 1.5 Flash for fast, nuanced executive narratives' },
              { icon: '📬', title: 'Email Delivery', desc: 'Beautifully formatted HTML reports sent via SMTP' },
            ].map((f, i) => (
              <div key={i} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '20px 20px',
                transition: 'border-color var(--transition)',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 5, color: '#e5e7eb' }}>{f.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        padding: '20px 40px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 12, color: 'var(--muted)',
      }}>
        <span>© 2026 Rabbitt AI · Sales Insight Automator</span>
        <a href="/api-docs" target="_blank" rel="noopener" style={{
          color: 'var(--accent)', textDecoration: 'none', fontWeight: 600,
        }}>Swagger Docs ↗</a>
      </footer>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function StatChip({ label, value, mono }) {
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border-light)',
      borderRadius: 10, padding: '10px 16px', textAlign: 'center', minWidth: 110,
    }}>
      <div style={{ fontSize: mono ? 13 : 20, fontWeight: 700, color: '#fff', fontFamily: mono ? 'monospace' : 'var(--font-display)' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
