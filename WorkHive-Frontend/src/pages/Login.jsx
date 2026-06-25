import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { Check, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react'
import api from '../lib/api'

export default function Login() {
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('L3')
  const [isSignUp, setIsSignUp] = useState(location.pathname === '/signup')
  const [successMsg, setSuccessMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const login = useAuthStore((state) => state.login)
  const googleLogin = useAuthStore((state) => state.googleLogin)

  useEffect(() => {
    setIsSignUp(location.pathname === '/signup')
    setError('')
    setSuccessMsg('')
  }, [location.pathname])

  useEffect(() => {
    let intervalId
    let resizeTimeout

    const renderGoogleButton = () => {
      if (typeof google !== 'undefined' && google.accounts) {
        const btnId = isSignUp ? 'google-signup-btn' : 'google-login-btn'
        const container = document.getElementById(btnId)
        if (container) {
          container.innerHTML = ''
          let containerWidth = container.offsetWidth
          if (!containerWidth) {
            const parent = container.parentElement
            containerWidth = parent ? parent.offsetWidth : 400
          }
          if (!containerWidth) {
            containerWidth = window.innerWidth < 480 ? window.innerWidth - 96 : 400
          }

          google.accounts.id.renderButton(container, {
            theme: 'outline',
            size: 'large',
            width: Math.max(200, Math.min(400, containerWidth)),
            text: isSignUp ? 'signup_with' : 'signin_with',
            logo_alignment: 'center'
          })
        }
      }
    }

    const initializeGoogleBtn = () => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(intervalId)
        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: async (response) => {
            setError('')
            setLoading(true)
            const result = await googleLogin(response.credential)
            if (!result.success) {
              setError(result.error)
            }
            setLoading(false)
          },
        })
        renderGoogleButton()
      }
    }

    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(renderGoogleButton, 150)
    }

    initializeGoogleBtn()
    intervalId = setInterval(initializeGoogleBtn, 100)

    window.addEventListener('resize', handleResize)

    return () => {
      clearInterval(intervalId)
      clearTimeout(resizeTimeout)
      window.removeEventListener('resize', handleResize)
    }
  }, [isSignUp, googleLogin])

  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, text: '', color: 'transparent' }
    let score = 0
    if (pass.length >= 8) score += 1
    if (/[0-9]/.test(pass)) score += 1
    if (/[A-Z]/.test(pass)) score += 1
    if (/[^A-Za-z0-9]/.test(pass)) score += 1

    if (score === 1) return { score, text: 'Weak', color: 'var(--danger)' }
    if (score === 2) return { score, text: 'Fair', color: 'var(--warning)' }
    if (score === 3) return { score, text: 'Good', color: 'var(--info)' }
    if (score === 4) return { score, text: 'Strong', color: 'var(--success)' }
    return { score: 0, text: 'Very Weak', color: 'var(--danger)' }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    const result = await login(email, password)
    if (!result.success) setError(result.error)
    setLoading(false)
  }

  const handleSignUpSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      await api.post('/api/v1/auth/register', {
        email,
        password,
        full_name: fullName,
        role: role
      })
      setSuccessMsg('Registration request submitted! Your account is pending administrator approval. You will receive an email once it is approved.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit registration request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container" style={{
      minHeight: '100vh',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* ── Left: Branding panel ── */}
      <div className="login-left" style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 75%, #6366f1 100%)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800' viewBox='0 0 800 800'%3E%3Cpath d='M-100,100 C100,150 200,-50 400,100 C600,250 700,50 900,100' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-opacity='0.05'/%3E%3Cpath d='M-100,180 C120,220 180,60 420,200 C640,320 680,160 900,180' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-opacity='0.05'/%3E%3Cpath d='M-100,260 C150,290 220,130 450,270 C620,390 720,210 900,260' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-opacity='0.05'/%3E%3Cpath d='M-100,340 C110,390 240,230 410,380 C630,490 710,320 900,340' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-opacity='0.05'/%3E%3Cpath d='M-100,420 C130,480 210,310 430,440 C650,560 690,400 900,420' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-opacity='0.05'/%3E%3Cpath d='M-100,500 C140,540 230,390 460,520 C610,640 730,470 900,500' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-opacity='0.05'/%3E%3Cpath d='M-100,580 C120,630 250,480 420,610 C640,730 700,560 900,580' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-opacity='0.05'/%3E%3Cpath d='M-100,660 C160,710 220,550 440,680 C660,810 680,630 900,660' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-opacity='0.05'/%3E%3Cpath d='M-100,740 C150,790 240,640 450,770 C630,890 720,710 900,740' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-opacity='0.05'/%3E%3C/svg%3E"), linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 75%, #6366f1 100%)`,
        backgroundSize: '800px 800px, auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '3rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '300px', height: '300px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', left: '-60px',
          width: '200px', height: '200px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '50%'
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
          <div style={{
            width: 44, height: 44,
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
            borderRadius: '0.75rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 800, color: 'white',
            border: '1px solid rgba(255,255,255,0.3)'
          }}>W</div>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>
            WorkHive
          </span>
        </div>

        {/* Hero text */}
        <div style={{ position: 'relative' }}>
          <h1 style={{
            fontSize: '2.5rem', fontWeight: 800, color: 'white',
            lineHeight: 1.2, marginBottom: '1.25rem',
            letterSpacing: '-0.03em'
          }}>
            Your team's<br />work, organised.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1.0625rem', lineHeight: 1.6, maxWidth: '340px' }}>
            WorkHive brings your projects, tasks, files, and team together — simply and securely.
          </p>

          {/* Feature list */}
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {['Projects & Kanban boards', 'Secure file sharing via Google Drive', 'Team workload balancing', 'Real-time notifications'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', flexShrink: 0
                }}>
                  <Check size={12} strokeWidth={3} />
                </div>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9375rem' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Forms ── */}
      <div className="login-right" style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '3rem',
        background: 'var(--surface-bg)',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {successMsg ? (
            // WAITING / SUCCESS PAGE
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--success-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--success-dark)', marginBottom: '0.5rem'
              }}>
                <ShieldCheck size={36} />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--gray-900)' }}>
                Request Submitted
              </h2>
              <p style={{ color: 'var(--gray-600)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                Your registration request has been submitted successfully and is pending administrator approval. An email notification has been sent to you and the workspace administrators.
              </p>
              <div style={{
                background: 'var(--gray-50)', padding: '1rem', borderRadius: 'var(--radius)',
                border: '1px solid var(--gray-100)', width: '100%', textAlign: 'left',
                fontSize: '0.875rem', color: 'var(--gray-600)', display: 'flex', flexDirection: 'column', gap: '0.5rem'
              }}>
                <p><strong>Name:</strong> {fullName}</p>
                <p><strong>Email:</strong> {email}</p>
                <p><strong>Role:</strong> <span style={{ textTransform: 'capitalize' }}>{role}</span></p>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '0.5rem' }}
                onClick={() => {
                  setSuccessMsg('')
                  setFullName('')
                  setEmail('')
                  setPassword('')
                  setIsSignUp(false)
                }}
              >
                Back to Sign In
              </button>
            </div>
          ) : isSignUp ? (
            // SIGN UP FORM
            <>
              <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>
                  Create an account
                </h2>
                <p style={{ color: 'var(--gray-500)', fontSize: '0.9375rem' }}>
                  Request access to join your WorkHive workspace
                </p>
              </div>

              <form id="signup-form" key="signup-form" onSubmit={handleSignUpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="register-name">Full name</label>
                  <input
                    id="register-name"
                    type="text"
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="register-email">Email address</label>
                  <input
                    id="register-email"
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="register-password">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="register-password"
                      type={showPass ? 'text' : 'password'}
                      className="form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      style={{ paddingRight: '3rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      style={{
                        position: 'absolute', right: '0.75rem', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--gray-400)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Password strength</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: getPasswordStrength(password).color }}>
                          {getPasswordStrength(password).text}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', height: '4px' }}>
                        {[1, 2, 3, 4].map(step => (
                          <div
                            key={step}
                            style={{
                              flex: 1,
                              borderRadius: '2px',
                              background: step <= getPasswordStrength(password).score ? getPasswordStrength(password).color : 'var(--gray-200)',
                              transition: 'all 0.2s ease-in-out'
                            }}
                          />
                        ))}
                      </div>
                      <p style={{ fontSize: '10px', color: 'var(--gray-400)', marginTop: '0.25rem' }}>
                        Must be at least 8 characters and include numbers, uppercase & special characters.
                      </p>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="register-role">I want to join as</label>
                  <select
                    id="register-role"
                    className="form-input form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="L3">L3 (Team Member)</option>
                    <option value="client">Client (Guest Account)</option>
                    <option value="L2">L2 (Project Lead)</option>
                  </select>
                </div>

                {error && (
                  <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  id="signup-submit-btn"
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={loading}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  {loading ? (
                    <>
                      <span className="spinner" />
                      Submitting request…
                    </>
                  ) : 'Submit Access Request'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--gray-200)' }} />
                  <span style={{ color: 'var(--gray-400)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>or continue with</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--gray-200)' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div id="google-signup-btn" style={{ width: '100%', minHeight: '44px' }} />
                </div>
              </form>

              <div style={{ marginTop: '2rem', padding: '1rem 1.25rem', background: 'var(--brand-50)', borderRadius: 'var(--radius)', border: '1px solid var(--brand-100)' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--brand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                  <span>Request submission is protected with enterprise-grade security.</span>
                </p>
              </div>

              <p style={{ marginTop: '1.5rem', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.8125rem' }}>
                Already have an account?{' '}
                <span
                  onClick={() => navigate('/login')}
                  style={{ color: 'var(--brand-600)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Sign In
                </span>
              </p>
            </>
          ) : (
            // SIGN IN FORM
            <>
              <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>
                  Welcome back
                </h2>
                <p style={{ color: 'var(--gray-500)', fontSize: '0.9375rem' }}>
                  Sign in to your WorkHive account
                </p>
              </div>

              <form id="login-form" key="login-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="login-email">Email address</label>
                  <input
                    id="login-email"
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="login-password">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="login-password"
                      type={showPass ? 'text' : 'password'}
                      className="form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      style={{ paddingRight: '3rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      style={{
                        position: 'absolute', right: '0.75rem', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--gray-400)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      title={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  id="login-submit-btn"
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={loading}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  {loading ? (
                    <>
                      <span className="spinner" />
                      Signing in…
                    </>
                  ) : 'Sign In'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--gray-200)' }} />
                  <span style={{ color: 'var(--gray-400)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>or continue with</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--gray-200)' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div id="google-login-btn" style={{ width: '100%', minHeight: '44px' }} />
                </div>
              </form>

              <div style={{ marginTop: '2rem', padding: '1rem 1.25rem', background: 'var(--brand-50)', borderRadius: 'var(--radius)', border: '1px solid var(--brand-100)' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--brand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                  <span>Your session is protected with enterprise-grade security.</span>
                </p>
              </div>

              <p style={{ marginTop: '1.5rem', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.8125rem' }}>
                Don't have an account?{' '}
                <span
                  onClick={() => navigate('/signup')}
                  style={{ color: 'var(--brand-600)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Request Access / Sign Up
                </span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Responsive: hide left panel on mobile */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="linear-gradient(135deg, #1e1b4b"] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
