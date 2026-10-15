
import { useCallback, useEffect, useMemo, useState } from "react";
import "./RiskAlerts.css";
import API from "./api";

function RiskAlerts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const getStoredUser = () => {
    try {
      return JSON.parse(
        sessionStorage.getItem("studenthub_user") || "null"
      );
    } catch {
      return null;
    }
  };

  const user = getStoredUser();
  const userRole = user?.role;
  const isStudent = userRole === "Student";

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/risk-alerts");
      setData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load risk alerts. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const alerts = data?.alerts || [];
  const summary = data?.summary || {};

  const filteredAlerts = useMemo(() => {
    return alerts.filter((student) => {
      const matchesFilter =
        filter === "All" || student.riskLevel === filter;

      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        (student.name || "").toLowerCase().includes(query) ||
        (student.email || "").toLowerCase().includes(query) ||
        (student.course || "").toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [alerts, filter, search]);

  const formatPercentage = (value) =>
    value === null || value === undefined
      ? "N/A"
      : `${value}%`;

  const riskClass = (level) => {
    if (level === "High") return "risk-high";
    if (level === "Medium") return "risk-medium";
    if (level === "Low") return "risk-low";
    return "risk-unknown";
  };

  return (
    <div className="risk-page">
      <div className="risk-page-heading">
        <div>
          <h2>
            {isStudent ? "My Academic Risk Overview" : "Student Risk Alerts"}
          </h2>
          <p>
            {isStudent
              ? "Review your attendance, exam performance, and suggested actions."
              : "Identify students who may benefit from additional academic support using attendance and exam results."}
          </p>
        </div>

        <button
          type="button"
          className="risk-refresh-btn"
          onClick={fetchAlerts}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh Alerts"}
        </button>
      </div>

      {error && (
        <div className="risk-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchAlerts}
            disabled={loading}
          >
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="risk-empty-state">
          Loading risk information...
        </div>
      ) : data ? (
        <>
          <div className="risk-summary-grid">
            {isStudent ? (
              <>
                <div className="risk-summary-card">
                  <span className="risk-summary-icon">📈</span>
                  <p>Attendance</p>
                  <h3>
                    {formatPercentage(
                      filteredAlerts[0]?.attendancePercentage
                    )}
                  </h3>
                </div>

                <div className="risk-summary-card">
                  <span className="risk-summary-icon">📝</span>
                  <p>Average Marks</p>
                  <h3>
                    {formatPercentage(
                      filteredAlerts[0]?.averageMarks
                    )}
                  </h3>
                </div>

                <div className="risk-summary-card">
                  <span className="risk-summary-icon">❌</span>
                  <p>Failed Exams</p>
                  <h3>
                    {filteredAlerts[0]?.failedExams ?? 0}
                  </h3>
                </div>

                <div className="risk-summary-card">
                  <span className="risk-summary-icon">🎯</span>
                  <p>Risk Level</p>
                  <h3>
                    {filteredAlerts[0]?.riskLevel || "Unavailable"}
                  </h3>
                </div>
              </>
            ) : (
              <>
                <div className="risk-summary-card">
                  <span className="risk-summary-icon">🎓</span>
                  <p>Total Students</p>
                  <h3>{summary.totalStudents ?? 0}</h3>
                </div>

                <div className="risk-summary-card high-summary">
                  <span className="risk-summary-icon">🚨</span>
                  <p>High Risk</p>
                  <h3>{summary.highRisk ?? 0}</h3>
                </div>

                <div className="risk-summary-card medium-summary">
                  <span className="risk-summary-icon">⚠️</span>
                  <p>Medium Risk</p>
                  <h3>{summary.mediumRisk ?? 0}</h3>
                </div>

                <div className="risk-summary-card low-summary">
                  <span className="risk-summary-icon">✓</span>
                  <p>Low Risk</p>
                  <h3>{summary.lowRisk ?? 0}</h3>
                </div>

                <div className="risk-summary-card unknown-summary">
                  <span className="risk-summary-icon">📋</span>
                  <p>Insufficient Data</p>
                  <h3>{summary.insufficientData ?? 0}</h3>
                </div>
              </>
            )}
          </div>

          <div className="risk-threshold-note">
            <strong>Current thresholds:</strong>{" "}
            Attendance below{" "}
            {data.thresholds?.attendancePercentage ?? 75}% · Average marks
            below {data.thresholds?.averageMarksPercentage ?? 50}%.
            These are configurable project settings, not official academic
            rules.
          </div>

          <section className="risk-panel">
            <div className="risk-panel-heading">
              <div>
                <h3>
                  {isStudent
                    ? "My Risk Assessment"
                    : "Students Requiring Attention"}
                </h3>
                <p>
                  {isStudent
                    ? "Review your warning signs and recommended actions."
                    : "Review each student's warning signs and suggested actions."}
                </p>
              </div>
              <span>{filteredAlerts.length} records</span>
            </div>

            {!isStudent && (
              <div className="risk-toolbar">
                <input
                  type="search"
                  placeholder="Search name, email or course..."
                  aria-label="Search risk alerts"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                <select
                  aria-label="Filter risk level"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="All">All Risk Levels</option>
                  <option value="High">High Risk</option>
                  <option value="Medium">Medium Risk</option>
                  <option value="Low">Low Risk</option>
                  <option value="Insufficient data">
                    Insufficient Data
                  </option>
                </select>
              </div>
            )}

            {filteredAlerts.length === 0 ? (
              <div className="risk-empty-state">
                <h3>
                  {isStudent
                    ? "No risk information available"
                    : "No matching students"}
                </h3>
                <p>
                  {isStudent
                    ? "Your account may not be linked to a student record, or there may not be enough academic data yet."
                    : "Try changing your search or risk-level filter."}
                </p>
              </div>
            ) : (
              <div className="risk-table-wrap">
                <table className="risk-table">
                  <thead>
                    <tr>
                      {!isStudent && <th>Student</th>}
                      <th>Attendance</th>
                      <th>Average Marks</th>
                      <th>Failed Exams</th>
                      <th>Risk Level</th>
                      <th>Reasons &amp; Recommended Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAlerts.map((student) => (
                      <tr key={student.studentId}>
                        {!isStudent && (
                          <td>
                            <div className="risk-student-name">
                              <strong>
                                {student.name || "Unnamed Student"}
                              </strong>
                              <span>
                                {student.email || "No email"}
                              </span>
                              <small>
                                {student.course || "No course"}
                              </small>
                            </div>
                          </td>
                        )}

                        <td>
                          <strong>
                            {formatPercentage(
                              student.attendancePercentage
                            )}
                          </strong>
                          <small className="risk-cell-note">
                            {student.attendanceRecords ?? 0} eligible records
                          </small>
                        </td>

                        <td>
                          <strong>
                            {formatPercentage(student.averageMarks)}
                          </strong>
                          <small className="risk-cell-note">
                            {student.examsAttempted ?? 0} valid results
                          </small>
                        </td>

                        <td>{student.failedExams ?? 0}</td>

                        <td>
                          <span
                            className={`risk-badge ${riskClass(
                              student.riskLevel
                            )}`}
                          >
                            {student.riskLevel || "Unknown"}
                          </span>
                        </td>

                        <td>
                          <div className="risk-details">
                            {student.reasons?.length > 0 && (
                              <ul className="risk-reasons">
                                {student.reasons.map((reason, index) => (
                                  <li key={`reason-${index}`}>
                                    {reason}
                                  </li>
                                ))}
                              </ul>
                            )}

                            {student.recommendations?.length > 0 && (
                              <div className="risk-recommendations">
                                <strong>Suggested action</strong>
                                <ul>
                                  {student.recommendations.map(
                                    (recommendation, index) => (
                                      <li key={`action-${index}`}>
                                        {recommendation}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="risk-disclaimer">
            Risk levels are screening indicators, not definitive judgments.
            Review individual circumstances before taking academic action.
          </p>
        </>
      ) : null}
    </div>
  );
}

export default RiskAlerts;
