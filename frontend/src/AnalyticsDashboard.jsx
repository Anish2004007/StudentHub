
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import API from "./api";
import "./AnalyticsDashboard.css";

function AnalyticsDashboard({ currentUser, darkMode }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isStudent = currentUser?.role === "Student";

  useEffect(() => {
    let cancelled = false;

    const fetchAnalytics = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await API.get("/api/analytics");

        if (!cancelled) {
          setAnalytics(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              "Unable to load academic analytics. Please check the backend."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = analytics?.summary || {};
  const textColor = darkMode ? "#e5e7eb" : "#334155";
  const gridColor = darkMode ? "#374151" : "#e2e8f0";

  const cards = [
    {
      label: isStudent ? "My Average Marks" : "Average Marks",
      value: `${summary.averageMarks ?? 0}%`,
      icon: "📊",
      detail: "Average percentage across recorded results",
    },
    {
      label: "Attendance Rate",
      value: `${summary.attendanceRate ?? 0}%`,
      icon: "📅",
      detail: "Present and Late records, excluding Excused",
    },
    {
      label: "Pass Percentage",
      value: `${summary.passPercentage ?? 0}%`,
      icon: "🎯",
      detail: "Percentage of recorded results marked Pass",
    },
    {
      label: isStudent ? "My Risk Status" : "At-Risk Students",
      value: isStudent
        ? summary.atRiskStudents
          ? "Needs Attention"
          : "No Alert"
        : summary.atRiskStudents ?? 0,
      icon: "⚠️",
      detail: "Based on marks and attendance thresholds",
    },
  ];

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="analytics-message">
          Loading academic analytics...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page">
        <div className="analytics-error" role="alert">
          <strong>Analytics unavailable</strong>
          <p>{error}</p>
          <button
            type="button"
            className="analytics-retry"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analytics-page">
        No analytics data is available.
      </div>
    );
  }

  const courseDistribution = analytics.courseDistribution || [];
  const performanceByCourse = analytics.performanceByCourse || [];
  const attendanceTrend = analytics.attendanceTrend || [];
  const passFail = [
    { result: "Pass", count: analytics.passFail?.pass ?? 0 },
    { result: "Fail", count: analytics.passFail?.fail ?? 0 },
  ];

  const tooltipStyle = {
    backgroundColor: darkMode ? "#1f2937" : "#ffffff",
    border: `1px solid ${gridColor}`,
    borderRadius: "8px",
    color: textColor,
  };

  return (
    <div className="analytics-page">
      <div className="analytics-heading">
        <div>
          <h2>
            {isStudent
              ? "My Academic Analytics"
              : "Academic Analytics Dashboard"}
          </h2>
          <p>
            {isStudent
              ? "Monitor your academic performance and attendance."
              : "Review academic performance, attendance, and student outcomes."}
          </p>
        </div>

        <span className="analytics-role">
          {currentUser?.role || "User"} View
        </span>
      </div>

      <section className="analytics-kpi-grid">
        {!isStudent && (
          <article className="analytics-kpi">
            <div className="analytics-kpi-icon">👨‍🎓</div>
            <div>
              <p>Total Students</p>
              <h3>{summary.totalStudents ?? 0}</h3>
              <span>Registered student records</span>
            </div>
          </article>
        )}

        {cards.map((card) => (
          <article className="analytics-kpi" key={card.label}>
            <div className="analytics-kpi-icon">{card.icon}</div>
            <div>
              <p>{card.label}</p>
              <h3>{card.value}</h3>
              <span>{card.detail}</span>
            </div>
          </article>
        ))}
      </section>

      {summary.totalResults === 0 && (
        <div className="analytics-notice">
          No valid exam results are available yet. Performance charts will
          populate after results have been recorded.
        </div>
      )}

      <section className="analytics-chart-grid">
        {!isStudent && (
          <article className="analytics-chart-card">
            <h3>Student Distribution by Course</h3>
            {courseDistribution.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={courseDistribution}
                  margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridColor}
                  />
                  <XAxis dataKey="course" tick={{ fill: textColor }} />
                  <YAxis allowDecimals={false} tick={{ fill: textColor }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="count"
                    name="Students"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="analytics-empty">No course data available.</p>
            )}
          </article>
        )}

        <article className="analytics-chart-card">
          <h3>
            {isStudent
              ? "Performance by Exam Course"
              : "Average Marks by Course"}
          </h3>
          {performanceByCourse.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={performanceByCourse}
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                />
                <XAxis dataKey="course" tick={{ fill: textColor }} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: textColor }}
                  unit="%"
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="averagePercentage"
                  name="Average Marks"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="analytics-empty">
              No performance data available.
            </p>
          )}
        </article>

        <article className="analytics-chart-card">
          <h3>Attendance Trend</h3>
          {attendanceTrend.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={attendanceTrend}
                margin={{ top: 10, right: 15, left: 0, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: textColor }}
                  minTickGap={20}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: textColor }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="present"
                  name="Present"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="absent"
                  name="Absent"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="late"
                  name="Late"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="analytics-empty">
              No attendance data available.
            </p>
          )}
        </article>

        <article className="analytics-chart-card">
          <h3>Pass vs Fail</h3>
          {passFail.some((item) => item.count > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={passFail}
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                />
                <XAxis dataKey="result" tick={{ fill: textColor }} />
                <YAxis allowDecimals={false} tick={{ fill: textColor }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="count"
                  name="Results"
                  fill="#6366f1"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="analytics-empty">
              No pass/fail data available.
            </p>
          )}
        </article>
      </section>

      <p className="analytics-footnote">
        Analytics are calculated from recorded results and attendance.
        At-risk alerts use the configured marks and attendance thresholds.
      </p>
    </div>
  );
}

export default AnalyticsDashboard;
