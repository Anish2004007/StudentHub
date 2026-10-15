
import { useState } from "react";
import API from "./api";
import "./Login.css";

function Login({ onLogin, darkMode, onToggleDarkMode }) {
  const [role, setRole] = useState("Student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await API.post("/api/auth/login", {
        role,
        email: email.trim().toLowerCase(),
        password,
      });

      const { token, user } = response.data;

      if (!token || !user) {
        throw new Error(
          "The server returned an invalid login response."
        );
      }

      // The backend must verify the account's actual role.
      if (user.role !== role) {
        throw new Error(
          "The account role does not match the selected role."
        );
      }

      sessionStorage.setItem("studenthub_token", token);
      onLogin(user);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to log in. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`login-screen ${darkMode ? "dark-mode" : ""}`}>
      <button
        type="button"
        className="login-theme-toggle"
        onClick={onToggleDarkMode}
      >
        {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
      </button>

      <section className="login-card">
        <div className="login-brand-icon">🎓</div>

        <h1>Welcome to StudentHub</h1>

        <p className="login-subtitle">
          Sign in to access your academic workspace.
        </p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="login-role">Login as</label>

            <select
              id="login-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              required
              disabled={submitting}
            >
              <option value="Student">🎓 Student</option>
              <option value="Faculty">👨‍🏫 Faculty</option>
              <option value="Admin">🛡️ Admin</option>
            </select>
          </div>

          <div className="login-field">
            <label htmlFor="login-email">Email address</label>

            <input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
              disabled={submitting}
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>

            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={submitting}
              />

              <button
                type="button"
                className="show-password-btn"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : `Sign In as ${role}`}
          </button>
        </form>

        <p className="login-security-note">
          Sign in using the account and role assigned by your
          college administrator.
        </p>
      </section>
    </div>
  );
}

export default Login;
