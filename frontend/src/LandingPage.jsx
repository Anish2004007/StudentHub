
import "./LandingPage.css";

function LandingPage({ onLogin, darkMode, onToggleDarkMode }) {
  
const features = [
  {
    icon: "📅",
    title: "Smart Attendance",
    description:
      "Track daily, weekly, and monthly attendance records with an organized attendance management system.",
  },
  {
    icon: "📝",
    title: "Exam Management",
    description:
      "Organize examinations, manage exam schedules, and keep academic information accessible.",
  },
  {
    icon: "📊",
    title: "Results & Performance",
    description:
      "Review marks, examination results, and academic performance to monitor progress.",
  },
  {
    icon: "🎯",
    title: "Academic Insights",
    description:
      "Identify students who may need additional support through academic risk alerts.",
  },
  {
    icon: "🗓️",
    title: "Timetable & Academic Calendar",
    description:
      "Organize class schedules, view academic events, and keep track of important dates and activities.",
  },
  {
    icon: "📈",
    title: "Advanced Academic Analytics",
    description:
      "Explore performance statistics, course-wise results, attendance trends, pass percentages, and academic risk indicators.",
  },
];

  return (
    <div className={`landing-page ${darkMode ? "landing-dark" : ""}`}>
      <header className="landing-navbar">
        <a className="landing-brand" href="#home" aria-label="StudentHub home">
          <span className="landing-brand-icon">🎓</span>
          <span>
            <strong>StudentHub</strong>
            <small>Student & Exam Management</small>
          </span>
        </a>

        <nav className="landing-nav-links" aria-label="Main navigation">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </nav>

        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-theme-btn"
            onClick={onToggleDarkMode}
            aria-label="Toggle color theme"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>

          <button
            type="button"
            className="landing-login-btn"
            onClick={onLogin}
          >
            Login <span aria-hidden="true">→</span>
          </button>
        </div>
      </header>

      <main>
        <section className="landing-hero" id="home">
          <div className="landing-hero-content">
            <span className="landing-eyebrow">
              YOUR ACADEMIC JOURNEY, SIMPLIFIED
            </span>

            <h1>
              Your Education.
              <br />
              Your Progress.
              <br />
              <span>Your StudentHub.</span>
            </h1>

            <p>
              One organized workspace for student records, attendance,
              examinations, results, and academic progress.
            </p>

            <div className="landing-hero-actions">
              <button
                type="button"
                className="landing-primary-btn"
                onClick={onLogin}
              >
                Get Started <span aria-hidden="true">→</span>
              </button>

              <a className="landing-secondary-btn" href="#features">
                Explore Features
              </a>
            </div>

            <div className="landing-trust-note">
              <span className="landing-trust-icon">✓</span>
              Designed for Students, Faculty & Administrators
            </div>
          </div>

          <div className="landing-hero-visual" aria-hidden="true">
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />

            <div className="landing-visual-card">
              <div className="landing-visual-top">
                <span className="landing-mini-logo">🎓</span>
                <div>
                  <strong>StudentHub</strong>
                  <small>Your academic workspace</small>
                </div>
                <span className="landing-live-dot" />
              </div>

              <div className="landing-visual-welcome">
                <span>WELCOME TO YOUR FUTURE</span>
                <h3>Learn. Track. Achieve.</h3>
              </div>

              <div className="landing-visual-grid">
                <div className="landing-mini-card">
                  <span>📅</span>
                  <strong>Attendance</strong>
                  <small>Track your presence</small>
                </div>

                <div className="landing-mini-card">
                  <span>📝</span>
                  <strong>Examinations</strong>
                  <small>Stay prepared</small>
                </div>

                <div className="landing-mini-card">
                  <span>📈</span>
                  <strong>Performance</strong>
                  <small>Monitor progress</small>
                </div>

                <div className="landing-mini-card">
                  <span>🎯</span>
                  <strong>Academic Goals</strong>
                  <small>Keep moving forward</small>
                </div>
              </div>

              <div className="landing-visual-footer">
                <span className="landing-footer-symbol">✦</span>
                <span>Everything you need, in one place.</span>
              </div>
            </div>

            <div className="landing-floating-card landing-float-top">
              <span>✓</span>
              <div>
                <strong>Stay organized</strong>
                <small>All your records together</small>
              </div>
            </div>

            <div className="landing-floating-card landing-float-bottom">
              <span>📊</span>
              <div>
                <strong>Track your growth</strong>
                <small>Make progress visible</small>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">EVERYTHING IN ONE PLACE</span>
            <h2>Make your academic life simpler</h2>
            <p>
              The essential tools you need to manage and monitor your
              academic journey.
            </p>
          </div>

          <div className="landing-feature-grid">
            {features.map((feature) => (
              <article className="landing-feature-card" key={feature.title}>
                <div className="landing-feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-cta" id="about">
          <div>
            <span className="landing-eyebrow">READY TO GET STARTED?</span>
            <h2>Your academic workspace is waiting.</h2>
            <p>
              Sign in with your Student, Faculty, or Admin account to
              access your personalized dashboard.
            </p>
          </div>

          <button
            type="button"
            className="landing-primary-btn"
            onClick={onLogin}
          >
            Login to StudentHub <span aria-hidden="true">→</span>
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        <a className="landing-footer-brand" href="#home">
          🎓 StudentHub
        </a>
        <span>Student & Exam Management System</span>
        <span>© {new Date().getFullYear()} StudentHub</span>
      </footer>
    </div>
  );
}

export default LandingPage;
