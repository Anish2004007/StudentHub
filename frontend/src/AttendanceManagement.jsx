
import { useCallback, useEffect, useMemo, useState } from "react";
import API from "./api";
import "./AttendanceManagement.css";

const STATUSES = ["Present", "Absent", "Late", "Excused"];

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

function AttendanceManagement() {
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [date, setDate] = useState(getLocalDate());
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [attendance, setAttendance] = useState({});
  const [remarks, setRemarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Read the logged-in user's role.
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

  const isAdmin = userRole === "Admin";
  const isFaculty = userRole === "Faculty";
  const isStudent = userRole === "Student";
  const canManageAttendance = isAdmin || isFaculty;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [studentResponse, attendanceResponse] =
        await Promise.all([
          API.get("/students"),
          API.get("/api/attendance", {
            params: { date },
          }),
        ]);

      const studentData = Array.isArray(studentResponse.data)
        ? studentResponse.data
        : studentResponse.data.students || [];

      const recordData = Array.isArray(attendanceResponse.data)
        ? attendanceResponse.data
        : attendanceResponse.data.records || [];

      const statusMap = {};
      const remarksMap = {};

      recordData.forEach((record) => {
        const studentId =
          typeof record.studentId === "object"
            ? record.studentId?._id
            : record.studentId;

        if (!studentId) return;

        const id = String(studentId);
        statusMap[id] = record.status;
        remarksMap[id] = record.remarks || "";
      });

      setStudents(studentData);
      setRecords(recordData);
      setAttendance(statusMap);
      setRemarks(remarksMap);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load attendance. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const courses = useMemo(
    () => [
      ...new Set(
        students.map((student) => student.course).filter(Boolean)
      ),
    ].sort(),
    [students]
  );

  const recordByStudent = useMemo(() => {
    const map = new Map();

    records.forEach((record) => {
      const studentId =
        typeof record.studentId === "object"
          ? record.studentId?._id
          : record.studentId;

      if (studentId) {
        map.set(String(studentId), record);
      }
    });

    return map;
  }, [records]);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return students.filter((student) => {
      const id = String(student._id);

      const matchesSearch =
        !term ||
        (student.name || "").toLowerCase().includes(term) ||
        (student.email || "").toLowerCase().includes(term) ||
        (student.course || "").toLowerCase().includes(term);

      const matchesCourse =
        courseFilter === "All" ||
        student.course === courseFilter;

      const studentStatus =
        attendance[id] ||
        recordByStudent.get(id)?.status ||
        "Unmarked";

      const matchesStatus =
        statusFilter === "All" ||
        studentStatus === statusFilter;

      return matchesSearch && matchesCourse && matchesStatus;
    });
  }, [
    students,
    search,
    courseFilter,
    statusFilter,
    attendance,
    recordByStudent,
  ]);

  const savedCount = records.length;

  const presentCount = records.filter(
    (record) => record.status === "Present"
  ).length;

  const absentCount = records.filter(
    (record) => record.status === "Absent"
  ).length;

  const lateCount = records.filter(
    (record) => record.status === "Late"
  ).length;

  const excusedCount = records.filter(
    (record) => record.status === "Excused"
  ).length;

  const unmarkedCount = Math.max(
    0,
    students.length - savedCount
  );

  const attendanceRate =
    students.length > 0
      ? ((presentCount + lateCount) / students.length) * 100
      : 0;

  const handleStatusChange = (studentId, status) => {
    if (!canManageAttendance) return;

    setAttendance((previous) => ({
      ...previous,
      [studentId]: status,
    }));

    setMessage("");
    setError("");
  };

  const handleRemarksChange = (studentId, value) => {
    if (!canManageAttendance) return;

    setRemarks((previous) => ({
      ...previous,
      [studentId]: value,
    }));

    setMessage("");
    setError("");
  };

  const handleSave = async () => {
    if (!canManageAttendance) {
      setError("You do not have permission to manage attendance.");
      return;
    }

    setError("");
    setMessage("");

    const recordsToSave = students
      .filter((student) => attendance[String(student._id)])
      .map((student) => ({
        studentId: student._id,
        status: attendance[String(student._id)],
        remarks: remarks[String(student._id)] || "",
      }));

    if (recordsToSave.length === 0) {
      setError(
        "Mark at least one student's attendance before saving."
      );
      return;
    }

    if (
      recordsToSave.some(
        (record) =>
          !STATUSES.includes(record.status) ||
          record.remarks.length > 300
      )
    ) {
      setError(
        "Check the attendance status and ensure remarks are 300 characters or fewer."
      );
      return;
    }

    setSaving(true);

    try {
      await API.post("/api/attendance/bulk", {
        date,
        records: recordsToSave,
      });

      setMessage(
        `Attendance saved successfully for ${recordsToSave.length} students.`
      );

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save attendance."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    if (!isAdmin) {
      setError("Only an Admin can delete attendance records.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this saved attendance record?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await API.delete(`/api/attendance/${record._id}`);

      setMessage("Attendance record deleted.");
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete the attendance record."
      );
    }
  };

  return (
    <div className="attendance-page">
      <div className="page-heading">
        <div>
          <h2>
            {isStudent ? "My Attendance" : "Attendance Management"}
          </h2>
          <p>
            {isStudent
              ? "View your attendance records and daily status."
              : "Record daily attendance and review student attendance status."}
          </p>
        </div>

        <button
          type="button"
          className="secondary-btn attendance-refresh"
          onClick={loadData}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="alert error-alert" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="alert success-alert" role="status">
          {message}
        </div>
      )}

      <section className="attendance-stats">
        <div className="attendance-stat">
          <span className="attendance-stat-icon">👥</span>
          <div>
            <p>{isStudent ? "My Records" : "Total Students"}</p>
            <h3>{isStudent ? savedCount : students.length}</h3>
          </div>
        </div>

        <div className="attendance-stat">
          <span className="attendance-stat-icon">✅</span>
          <div>
            <p>Present</p>
            <h3>{presentCount}</h3>
          </div>
        </div>

        <div className="attendance-stat">
          <span className="attendance-stat-icon">❌</span>
          <div>
            <p>Absent</p>
            <h3>{absentCount}</h3>
          </div>
        </div>

        <div className="attendance-stat">
          <span className="attendance-stat-icon">📈</span>
          <div>
            <p>Attendance Rate</p>
            <h3>
              {attendanceRate.toFixed(1)}%
            </h3>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>
              {isStudent
                ? "Daily Attendance"
                : "Mark Daily Attendance"}
            </h2>
            <p>
              {isStudent
                ? "Select a date to view your attendance."
                : "Choose a date, select each student's status, and save your changes."}
            </p>
          </div>
        </div>

        <div className="attendance-controls">
          <div className="attendance-field">
            <label htmlFor="attendanceDate">
              Attendance Date
            </label>
            <input
              id="attendanceDate"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setMessage("");
                setError("");
              }}
            />
          </div>

          {!isStudent && (
            <>
              <div className="attendance-field">
                <label htmlFor="attendanceSearch">
                  Search Students
                </label>
                <input
                  id="attendanceSearch"
                  type="search"
                  placeholder="Name, email or course..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <div className="attendance-field">
                <label htmlFor="attendanceCourse">Course</label>
                <select
                  id="attendanceCourse"
                  value={courseFilter}
                  onChange={(event) =>
                    setCourseFilter(event.target.value)
                  }
                >
                  <option value="All">All Courses</option>
                  {courses.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
              </div>

              <div className="attendance-field">
                <label htmlFor="attendanceStatusFilter">
                  Status
                </label>
                <select
                  id="attendanceStatusFilter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                >
                  <option value="All">All Statuses</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                  <option value="Unmarked">Unmarked</option>
                </select>
              </div>
            </>
          )}
        </div>

        {!isStudent && (
          <div className="attendance-summary">
            <span>
              Saved: <strong>{savedCount}</strong> / {students.length}
            </span>
            <span>
              Late: <strong>{lateCount}</strong>
            </span>
            <span>
              Excused: <strong>{excusedCount}</strong>
            </span>
            <span>
              Unmarked: <strong>{unmarkedCount}</strong>
            </span>
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <p>Loading attendance...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <h3>
              {isStudent
                ? "Student profile not linked"
                : "No students available"}
            </h3>
            <p>
              {isStudent
                ? "Your account needs to be linked to your student record."
                : "Add students in Student Management before marking attendance."}
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="empty-state">
            <h3>No matching students</h3>
            <p>
              {isStudent
                ? "No attendance records match the selected date."
                : "Try changing your search, course, or status filter."}
            </p>
          </div>
        ) : (
          <div className="table-container attendance-table-container">
            <table className="student-table attendance-table">
              <thead>
                <tr>
                  {!isStudent && <th>Student</th>}
                  {!isStudent && <th>Course</th>}
                  {isStudent && <th>Date</th>}
                  <th>Status</th>
                  <th>Remarks</th>
                  {isAdmin && <th>Action</th>}
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map((student) => {
                  const id = String(student._id);
                  const savedRecord = recordByStudent.get(id);
                  const currentStatus =
                    attendance[id] ||
                    savedRecord?.status ||
                    "";

                  return (
                    <tr key={id}>
                      {!isStudent && (
                        <td>
                          <div className="student-name">
                            <div className="student-avatar">
                              {(student.name || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div>
                              <strong>{student.name}</strong>
                              <div className="attendance-email">
                                {student.email}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}

                      {!isStudent && (
                        <td>
                          <span className="course-badge">
                            {student.course || "—"}
                          </span>
                        </td>
                      )}

                      {isStudent && <td>{date}</td>}

                      <td>
                        {canManageAttendance ? (
                          <select
                            aria-label={`Attendance status for ${student.name}`}
                            className={`attendance-status-select ${
                              currentStatus
                                ? `status-${currentStatus.toLowerCase()}`
                                : ""
                            }`}
                            value={currentStatus}
                            onChange={(event) =>
                              handleStatusChange(
                                id,
                                event.target.value
                              )
                            }
                          >
                            <option value="">Select status</option>
                            {STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={
                              currentStatus
                                ? `attendance-status-select status-${currentStatus.toLowerCase()}`
                                : "attendance-unsaved"
                            }
                          >
                            {currentStatus || "Not marked"}
                          </span>
                        )}
                      </td>

                      <td>
                        {canManageAttendance ? (
                          <input
                            className="attendance-remarks"
                            type="text"
                            maxLength={300}
                            placeholder="Optional remarks"
                            value={remarks[id] || ""}
                            onChange={(event) =>
                              handleRemarksChange(
                                id,
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          savedRecord?.remarks || "—"
                        )}
                      </td>

                      {isAdmin && (
                        <td>
                          {savedRecord ? (
                            <button
                              type="button"
                              className="delete-btn"
                              onClick={() =>
                                handleDelete(savedRecord)
                              }
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="attendance-unsaved">
                              Unsaved
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canManageAttendance && (
          <div className="attendance-footer">
            <p>
              Only students with a selected status will be saved.
              Existing records for the selected date will be updated.
            </p>

            <button
              type="button"
              className="primary-btn"
              onClick={handleSave}
              disabled={saving || loading || students.length === 0}
            >
              {saving ? "Saving..." : "Save Attendance"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default AttendanceManagement;
