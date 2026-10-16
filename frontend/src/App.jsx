
import { useEffect, useMemo, useState } from "react";
import "./App.css";

import API from "./api";
import Login from "./Login";
import ExamManagement from "./ExamManagement";
import ResultManagement from "./ResultManagement";
import AttendanceManagement from "./AttendanceManagement";
import StudentProfile from "./StudentProfile";
import RiskAlerts from "./RiskAlerts";
import LandingPage from "./LandingPage";
import TimetableCalendar from "./TimetableCalendar";
import AnalyticsDashboard from "./AnalyticsDashboard";

function App() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  // Student management state
  const [students, setStudents] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    course: "",
    age: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name-asc");
  const [currentPage, setCurrentPage] = useState(1);

  const studentsPerPage = 5;

  // Application state
  const [activeTab, setActiveTab] = useState("students");
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Role permissions
  const userRole = currentUser?.role;
  const isAdmin = userRole === "Admin";
  const isFaculty = userRole === "Faculty";
  const isStudent = userRole === "Student";

  const canManageStudents = isAdmin;

  // Verify the existing login session
  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const token = sessionStorage.getItem("studenthub_token");

      if (!token) {
        sessionStorage.removeItem("studenthub_user");
        setAuthChecking(false);
        return;
      }

      try {
        const response = await API.get("/api/auth/me");
        const user = response.data.user;

        if (!cancelled) {
          // Keep the user role available to child components.
          sessionStorage.setItem(
            "studenthub_user",
            JSON.stringify(user)
          );

          setCurrentUser(user);
        }
      } catch (err) {
        sessionStorage.removeItem("studenthub_token");
        sessionStorage.removeItem("studenthub_user");

        if (!cancelled) {
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch students after successful login
  const fetchStudents = async () => {
    try {
      setError("");

      const response = await API.get("/students");

      const records = Array.isArray(response.data)
        ? response.data
        : response.data.students || [];

      setStudents(records);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load student records. Please check the backend server."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      fetchStudents();
    }
  }, [currentUser]);

  // Handle successful login
  const handleLogin = (user) => {
    sessionStorage.setItem(
      "studenthub_user",
      JSON.stringify(user)
    );

    setCurrentUser(user);
    setActiveTab("students");
    setMessage("");
    setError("");
    setLoading(true);
  };

  // Handle logout
  const handleLogout = () => {
    sessionStorage.removeItem("studenthub_token");
    sessionStorage.removeItem("studenthub_user");

    setCurrentUser(null);
    setShowLogin(false);
    setStudents([]);
    setActiveTab("students");
    setMessage("");
    setError("");
    setLoading(true);

    resetForm();
  };

  // Handle form inputs
  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  };

  // Reset student form
  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      course: "",
      age: "",
    });

    setEditingId(null);
  };

  // Add or update student - Admin only
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canManageStudents) {
      setError("You do not have permission to manage students.");
      return;
    }

    setMessage("");
    setError("");

    const payload = {
      ...formData,
      age: Number(formData.age),
    };

    try {
      if (editingId) {
        await API.put(`/students/${editingId}`, payload);
        setMessage("Student updated successfully.");
      } else {
        await API.post("/students", payload);
        setMessage("Student added successfully.");
      }

      resetForm();
      setCurrentPage(1);

      await fetchStudents();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save student. Please check the details."
      );
    }
  };

  // Load student details for editing
  const handleEdit = (student) => {
    if (!canManageStudents) {
      setError("You do not have permission to edit students.");
      return;
    }

    setFormData({
      name: student.name || "",
      email: student.email || "",
      course: student.course || "",
      age: student.age != null ? String(student.age) : "",
    });

    setEditingId(student._id);
    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Delete student - Admin only
  const handleDelete = async (id) => {
    if (!canManageStudents) {
      setError("You do not have permission to delete students.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this student?"
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      await API.delete(`/students/${id}`);

      setMessage("Student deleted successfully.");

      if (editingId === id) {
        resetForm();
      }

      await fetchStudents();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete student. Please try again."
      );
    }
  };

  // Unique courses
  const courses = useMemo(() => {
    return [
      ...new Set(
        students.map((student) => student.course).filter(Boolean)
      ),
    ].sort();
  }, [students]);

  // Dashboard statistics
  const totalStudents = students.length;
  const courseCount = courses.length;

  const averageAge =
    totalStudents > 0
      ? (
          students.reduce(
            (total, student) => total + (Number(student.age) || 0),
            0
          ) / totalStudents
        ).toFixed(1)
      : "0";

  // Search, filter and sort
  const filteredStudents = useMemo(() => {
    let result = [...students];

    if (search.trim()) {
      const searchTerm = search.toLowerCase().trim();

      result = result.filter((student) => {
        return (
          (student.name || "").toLowerCase().includes(searchTerm) ||
          (student.email || "").toLowerCase().includes(searchTerm) ||
          (student.course || "").toLowerCase().includes(searchTerm)
        );
      });
    }

    if (courseFilter !== "All") {
      result = result.filter(
        (student) => student.course === courseFilter
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "name-desc":
          return (b.name || "").localeCompare(a.name || "");

        case "age-asc":
          return (Number(a.age) || 0) - (Number(b.age) || 0);

        case "age-desc":
          return (Number(b.age) || 0) - (Number(a.age) || 0);

        case "course-asc":
          return (a.course || "").localeCompare(b.course || "");

        case "name-asc":
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });

    return result;
  }, [students, search, courseFilter, sortBy]);

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / studentsPerPage)
  );

  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * studentsPerPage;

  const paginatedStudents = filteredStudents.slice(
    startIndex,
    startIndex + studentsPerPage
  );

  // Search, filter and sort handlers
  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setCurrentPage(1);
  };

  const handleCourseFilterChange = (event) => {
    setCourseFilter(event.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (event) => {
    setSortBy(event.target.value);
    setCurrentPage(1);
  };

  // Navigation
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMessage("");
    setError("");
  };

  // Session verification screen
  if (authChecking) {
    return (
      <div className={`login-screen ${darkMode ? "dark-mode" : ""}`}>
        <p>Checking your StudentHub session...</p>
      </div>
    );
  }

  // Login screen
  
if (!currentUser) {
  if (!showLogin) {
    return (
      <LandingPage
        onLogin={() => setShowLogin(true)}
        darkMode={darkMode}
        onToggleDarkMode={() =>
          setDarkMode((previous) => !previous)
        }
      />
    );
  }

  return (
    <Login
      onLogin={handleLogin}
      darkMode={darkMode}
      onToggleDarkMode={() =>
        setDarkMode((previous) => !previous)
      }
    />
  );
}


  return (
    <div className={`app ${darkMode ? "dark-mode" : ""}`}>
      {/* Header */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">🎓</div>

          <div>
            <h1>StudentHub</h1>
            <p>Student &amp; Exam Management System</p>
          </div>
        </div>

        <div className="account-controls">
          <div className="account-info">
            <strong>{currentUser.name}</strong>
            <span>{currentUser.role}</span>
          </div>

          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

        <button
          type="button"
          className="theme-toggle"
          onClick={() => setDarkMode((previous) => !previous)}
        >
          {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
      </header>

      <main className="main-content">
        <div className="workspace">
          {/* Sidebar */}
          <aside className="sidebar" aria-label="Main navigation">
            <p className="sidebar-label">WORKSPACE</p>

            <button
              type="button"
              className={`nav-item ${
                activeTab === "students" ? "active" : ""
              }`}
              onClick={() => handleTabChange("students")}
            >
              <span className="nav-icon">👨‍🎓</span>
              <span>{isStudent ? "My Records" : "Students"}</span>
            </button>

            <button
              type="button"
              className={`nav-item ${
                activeTab === "exams" ? "active" : ""
              }`}
              onClick={() => handleTabChange("exams")}
            >
              <span className="nav-icon">📝</span>
              <span>Exams</span>
            </button>

            <button
              type="button"
              className={`nav-item ${
                activeTab === "results" ? "active" : ""
              }`}
              onClick={() => handleTabChange("results")}
            >
              <span className="nav-icon">📊</span>
              <span>Results</span>
            </button>

            <button
              type="button"
              className={`nav-item ${
                activeTab === "attendance" ? "active" : ""
              }`}
              onClick={() => handleTabChange("attendance")}
            >
              <span className="nav-icon">📅</span>
              <span>Attendance</span>
            </button>

            <button
              type="button"
              className={`nav-item ${
                activeTab === "profile" ? "active" : ""
              }`}
              onClick={() => handleTabChange("profile")}
            >
              <span className="nav-icon">🪪</span>
              <span>{isStudent ? "My Profile" : "Student Profile"}</span>
            </button>

            <button
              type="button"
              className={`nav-item ${
                activeTab === "risk-alerts" ? "active" : ""
              }`}
              onClick={() => handleTabChange("risk-alerts")}
            >
              <span className="nav-icon">🚨</span>
              <span>Risk Alerts</span>
            </button>

            <button
              type="button"
              className={`nav-item ${
                activeTab === "timetable-calendar" ? "active" : ""
              }`}
              onClick={() => handleTabChange("timetable-calendar")}
            >
              <span className="nav-icon">🗓️</span>
              <span>Timetable & Calendar</span>
            </button>

            <button
              type="button"
              className={`nav-item ${
                activeTab === "analytics" ? "active" : ""
              }`}
              onClick={() => handleTabChange("analytics")}
            >
              <span className="nav-icon">📈</span>
              <span>Academic Analytics</span>
            </button>

            <div className="sidebar-note">
              <span className="sidebar-note-icon">✦</span>
              <strong>StudentHub</strong>
              <p>Your academic workspace, all in one place.</p>
            </div>
          </aside>

          {/* Main content */}
          <section className="content-area">
            {/* Student dashboard */}
            {activeTab === "students" && (
              <>
                <div className="page-heading">
                  <div>
                    <h2>
                      {isAdmin
                        ? "Admin Dashboard"
                        : isFaculty
                          ? "Faculty Dashboard"
                          : "Student Dashboard"}
                    </h2>

                    <p>
                      {isAdmin
                        ? "Manage students and oversee academic activities."
                        : isFaculty
                          ? "Review student records and academic activities."
                          : "View your academic records and monitor your progress."}
                    </p>
                  </div>
                </div>

                {/* Statistics */}
                <section className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">👨‍🎓</div>
                    <div>
                      <p>{isStudent ? "My Records" : "Total Students"}</p>
                      <h2>{totalStudents}</h2>
                    </div>
                  </div>

                  {!isStudent && (
                    <>
                      <div className="stat-card">
                        <div className="stat-icon">📚</div>
                        <div>
                          <p>Total Courses</p>
                          <h2>{courseCount}</h2>
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <div>
                          <p>Average Age</p>
                          <h2>{averageAge}</h2>
                        </div>
                      </div>
                    </>
                  )}
                </section>

                {message && (
                  <div className="alert success-alert" role="status">
                    {message}
                  </div>
                )}

                {error && (
                  <div className="alert error-alert" role="alert">
                    {error}
                  </div>
                )}

                {/* Add or edit student - Admin only */}
                {canManageStudents && (
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <h2>
                          {editingId ? "Edit Student" : "Add New Student"}
                        </h2>
                        <p>
                          {editingId
                            ? "Update the selected student's details."
                            : "Enter the details below to register a student."}
                        </p>
                      </div>
                    </div>

                    <form
                      className="student-form"
                      onSubmit={handleSubmit}
                    >
                      <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input
                          id="name"
                          type="text"
                          name="name"
                          placeholder="Enter student name"
                          value={formData.name}
                          onChange={handleChange}
                          maxLength={100}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                          id="email"
                          type="email"
                          name="email"
                          placeholder="Enter email address"
                          value={formData.email}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="course">Course</label>
                        <input
                          id="course"
                          type="text"
                          name="course"
                          placeholder="e.g. MCA, BCA, BSc IT"
                          value={formData.course}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="age">Age</label>
                        <input
                          id="age"
                          type="number"
                          name="age"
                          placeholder="Enter age"
                          min="1"
                          max="120"
                          value={formData.age}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="primary-btn"
                        >
                          {editingId ? "Update Student" : "Add Student"}
                        </button>

                        {editingId && (
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={resetForm}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </section>
                )}

                {/* Student records */}
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>
                        {isStudent ? "My Student Record" : "Student Records"}
                      </h2>
                      <p>
                        {isAdmin
                          ? "Search, filter, sort, edit, or remove students."
                          : isFaculty
                            ? "Search, filter, and review student records."
                            : "Review your registered student details."}
                      </p>
                    </div>

                    <span>
                      {filteredStudents.length}{" "}
                      {filteredStudents.length === 1 ? "record" : "records"}
                    </span>
                  </div>

                  {!isStudent && (
                    <div className="table-toolbar">
                      <div className="search-wrap">
                        <input
                          type="search"
                          placeholder="Search name, email or course..."
                          value={search}
                          onChange={handleSearchChange}
                          aria-label="Search students"
                        />
                      </div>

                      <select
                        value={courseFilter}
                        onChange={handleCourseFilterChange}
                        aria-label="Filter by course"
                      >
                        <option value="All">All Courses</option>
                        {courses.map((course) => (
                          <option key={course} value={course}>
                            {course}
                          </option>
                        ))}
                      </select>

                      <div className="sort-wrap">
                        <label htmlFor="sortStudents">Sort by</label>
                        <select
                          id="sortStudents"
                          className="sort-select"
                          value={sortBy}
                          onChange={handleSortChange}
                          aria-label="Sort students"
                        >
                          <option value="name-asc">Name: A–Z</option>
                          <option value="name-desc">Name: Z–A</option>
                          <option value="age-asc">Age: Low to High</option>
                          <option value="age-desc">Age: High to Low</option>
                          <option value="course-asc">Course: A–Z</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {loading ? (
                    <div className="empty-state">
                      <p>Loading student records...</p>
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="empty-state">
                      <h3>
                        {isStudent
                          ? "No linked student record found"
                          : "No students found"}
                      </h3>
                      <p>
                        {isStudent
                          ? "Ask your administrator to link your account to your student record."
                          : "Add a student or change your search and filters."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="table-container">
                        <table className="student-table">
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Email</th>
                              <th>Course</th>
                              <th>Age</th>
                              {isAdmin && <th>Actions</th>}
                            </tr>
                          </thead>

                          <tbody>
                            {paginatedStudents.map((student) => (
                              <tr key={student._id}>
                                <td>
                                  <div className="student-name">
                                    <div className="student-avatar">
                                      {(student.name || "?")
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                    <span>{student.name}</span>
                                  </div>
                                </td>

                                <td>{student.email}</td>

                                <td>
                                  <span className="course-badge">
                                    {student.course}
                                  </span>
                                </td>

                                <td>{student.age}</td>

                                {isAdmin && (
                                  <td>
                                    <div className="action-buttons">
                                      <button
                                        type="button"
                                        className="edit-btn"
                                        onClick={() => handleEdit(student)}
                                      >
                                        Edit
                                      </button>

                                      <button
                                        type="button"
                                        className="delete-btn"
                                        onClick={() =>
                                          handleDelete(student._id)
                                        }
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {!isStudent && (
                        <div className="pagination">
                          <div className="pagination-info">
                            Showing {startIndex + 1}–
                            {Math.min(
                              startIndex + studentsPerPage,
                              filteredStudents.length
                            )}{" "}
                            of {filteredStudents.length} students
                          </div>

                          <div className="pagination-controls">
                            <button
                              type="button"
                              disabled={safePage === 1}
                              onClick={() =>
                                setCurrentPage((page) =>
                                  Math.max(1, page - 1)
                                )
                              }
                            >
                              Previous
                            </button>

                            {Array.from(
                              { length: totalPages },
                              (_, index) => index + 1
                            ).map((page) => (
                              <button
                                type="button"
                                key={page}
                                className={`page-number ${
                                  safePage === page ? "active" : ""
                                }`}
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </button>
                            ))}

                            <button
                              type="button"
                              disabled={safePage === totalPages}
                              onClick={() =>
                                setCurrentPage((page) =>
                                  Math.min(totalPages, page + 1)
                                )
                              }
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}

            {/* Other modules */}
            {activeTab === "exams" && <ExamManagement />}

            {activeTab === "results" && <ResultManagement />}

            {activeTab === "attendance" && <AttendanceManagement />}

            {activeTab === "risk-alerts" && <RiskAlerts />}

            {activeTab === "profile" && (
              <StudentProfile
                students={students}
                onStudentUpdated={fetchStudents}
              />
            )}
            {activeTab === "timetable-calendar" && (
              <TimetableCalendar
                currentUser={currentUser}
                darkMode={darkMode}
              />
            )}
            {activeTab === "analytics" && (
              <AnalyticsDashboard
                currentUser={currentUser}
                darkMode={darkMode}
              />
            )}
          </section>
        </div>

        <footer className="footer">
          <p>StudentHub — Student &amp; Exam Management System</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
