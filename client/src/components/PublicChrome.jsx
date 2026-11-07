import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../context/ThemeContext';
import { homeFor } from '../utils/format';
import { Logo } from './Icon';

// Top bar for the public pages (landing, login, register, legal)
// `links` (home page only): section links shown in the middle, e.g. [['#about', 'About']]
export function PublicNav({ links }) {
  const { user } = useAuth();
  return (
    <div className="pub-nav-wrap">
      <nav className="pub-nav">
        <Link to="/" className="pub-logo"><Logo size={30} />Ecotrackify</Link>
        {links ? (
          <div className="pub-links">
            {links.map(([href, label], i) => <a key={href} href={href} className={i === 0 ? 'on' : ''} onClick={(e) => { const el = document.querySelector(href); if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}>{label}</a>)}
          </div>
        ) : <span />}
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <ThemeToggle />
          {user ? (
            <Link className="btn" to={homeFor(user)}>Go to dashboard</Link>
          ) : (
            <>
              <Link className="btn btn-sky" to="/login">Log in</Link>
              <Link className="btn btn-mint" to="/register">Create account</Link>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}

// Footer shown on the public pages
export function Footer() {
  const location = useLocation();
  const from = { from: location.pathname + location.search };
  return (
    <footer className="footer" id="contact">
      <div className="footer-grid">
        <div>
          <div className="footer-logo"><Logo size={24} />Ecotrackify</div>
          <p className="small" style={{ marginTop: 10, maxWidth: '30em' }}>
            Measure your carbon footprint, set goals that match your own emissions, and reduce CO₂ together with your community or organisation.
          </p>
        </div>
        <div>
          <h4>Product</h4>
          <Link to="/register">Create an account</Link>
        </div>
        <div>
          <h4>Company</h4>
          <Link to="/register/business">For organisations</Link>
          <Link to="/terms" state={from}>Terms of Service</Link>
          <Link to="/privacy" state={from}>Privacy Policy</Link>
        </div>
        <div>
          <h4>Contact</h4>
          <span className="small" style={{ userSelect: 'all', color: 'var(--ink-2)' }}>support@ecotrackify.app</span>
          <p className="small" style={{ marginTop: 6 }}>Hyderabad, India</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Ecotrackify</span>
        <span><Link to="/terms" state={from} style={{ display: 'inline', fontSize: 'inherit' }}>Terms</Link> · <Link to="/privacy" state={from} style={{ display: 'inline', fontSize: 'inherit' }}>Privacy</Link></span>
      </div>
    </footer>
  );
}
