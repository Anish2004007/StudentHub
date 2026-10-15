
import { useEffect, useState } from "react";
import API from "./api";

function ResultManagement() {
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);

  const [formData, setFormData] = useState({
    student: "",
    exam: "",
    marksObtained: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
  const canManageResults = isAdmin || isFaculty;

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const [studentResponse, examResponse, resultResponse] =
        await Promise.all([
          API.get("/students"),
          API.get("/api/exams"),
          API.get("/api/results"),
        ]);

      setStudents(
        Array.isArray(studentResponse.data)
          ? studentResponse.data
          : studentResponse.data.students || []
      );

      setExams(
        Array.isArray(examResponse.data)
          ? examResponse.data
          : examResponse.data.exams || []
      );

      setResults(
        Array.isArray(resultResponse.data)
          ? resultResponse.data
          : resultResponse.data.results || []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load results. Check the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedExam = exams.find(
    (exam) => exam._id === formData.exam
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      student: "",
      exam: "",
      marksObtained: "",
    });

    setEditingId(null);
  };

  // Add or update a result.
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canManageResults) {
      setError("You do not have permission to manage results.");
      return;
    }

    setMessage("");
    setError("");

    const marks = Number(formData.marksObtained);

    if (
      !formData.student ||
      !formData.exam ||
      formData.marksObtained.trim() === "" ||
      !Number.isFinite(marks) ||
      marks < 0
    ) {
      setError("Please enter valid student, exam, and marks.");
      return;
    }

    if (
      !selectedExam ||
      marks > Number(selectedExam.totalMarks)
    ) {
      setError(
        selectedExam
          ? `Marks cannot exceed ${selectedExam.totalMarks}.`
          : "Please select a valid exam."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        student: formData.student,
        exam: formData.exam,
        marksObtained: marks,
      };

      const response = editingId
        ? await API.put(`/api/results/${editingId}`, payload)
        : await API.post("/api/results", payload);

      setMessage(
        response.data?.message ||
          (editingId
            ? "Result updated successfully."
            : "Result added successfully.")
      );

      resetForm();
      await fetchData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save result."
      );
    } finally {
      setSaving(false);
    }
  };

  // Edit a result - Admin and Faculty only.
  const handleEdit = (result) => {
    if (!canManageResults) {
      setError("You do not have permission to edit results.");
      return;
    }

    setFormData({
      student: result.student?._id || "",
      exam: result.exam?._id || "",
      marksObtained: String(result.marksObtained ?? ""),
    });

    setEditingId(result._id);
    setMessage("");
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete a result - Admin only.
  const handleDelete = async (id) => {
    if (!isAdmin) {
      setError("Only an Admin can delete results.");
      return;
    }

    if (!window.confirm("Delete this result permanently?")) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await API.delete(`/api/results/${id}`);

      setMessage(
        response.data?.message || "Result deleted successfully."
      );

      if (editingId === id) {
        resetForm();
      }

      await fetchData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete result."
      );
    }
  };

  const getPercentage = (result) => {
    const total = Number(result.exam?.totalMarks || 0);

    if (total <= 0) return "0.00";

    return (
      (Number(result.marksObtained) / total) *
      100
    ).toFixed(2);
  };

  const getStatus = (result) => {
    const passingMarks = Number(
      result.exam?.passingMarks || 0
    );

    return Number(result.marksObtained) >= passingMarks
      ? "Pass"
      : "Fail";
  };

  const passCount = results.filter(
    (result) => getStatus(result) === "Pass"
  ).length;

  const failCount = results.length - passCount;

  return (
    <div className="main-content">
      {/* Result statistics */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div>
            <p>Total Results</p>
            <h2>{results.length}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div>
            <p>Passed</p>
            <h2>{passCount}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div>
            <p>Failed</p>
            <h2>{failCount}</h2>
          </div>
        </div>
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

      {/* Result entry form - Admin and Faculty only */}
      {canManageResults && (
        <section className="panel">
          <div className="panel-header">
            <h2>
              {editingId ? "Edit Result" : "Add Exam Result"}
            </h2>
          </div>

          {students.length === 0 || exams.length === 0 ? (
            <div className="empty-state">
              <h3>Students and exams are required</h3>
              <p>
                Add at least one student and one exam before entering
                results.
              </p>
            </div>
          ) : (
            <form className="student-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="result-student">Student</label>
                <select
                  id="result-student"
                  name="student"
                  value={formData.student}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Student</option>

                  {students.map((student) => (
                    <option
                      key={student._id}
                      value={student._id}
                    >
                      {student.name} — {student.course}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="result-exam">Exam</label>
                <select
                  id="result-exam"
                  name="exam"
                  value={formData.exam}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Exam</option>

                  {exams.map((exam) => (
                    <option key={exam._id} value={exam._id}>
                      {exam.title} — {exam.course}, Semester{" "}
                      {exam.semester}
                    </option>
                  ))}
                </select>
              </div>

              {selectedExam && (
                <div className="form-group">
                  <label>Exam Marks</label>
                  <p>
                    Total: {selectedExam.totalMarks} | Passing:{" "}
                    {selectedExam.passingMarks}
                  </p>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="marks-obtained">
                  Marks Obtained
                </label>
                <input
                  id="marks-obtained"
                  name="marksObtained"
                  type="number"
                  min="0"
                  max={selectedExam?.totalMarks ?? undefined}
                  step="any"
                  value={formData.marksObtained}
                  onChange={handleChange}
                  placeholder="Enter marks obtained"
                  required
                />
              </div>

              {selectedExam &&
                formData.marksObtained.trim() !== "" &&
                Number.isFinite(Number(formData.marksObtained)) &&
                Number(formData.marksObtained) >= 0 &&
                Number(formData.marksObtained) <=
                  Number(selectedExam.totalMarks) && (
                  <div className="form-group">
                    <label>Calculated Result</label>
                    <p>
                      Percentage:{" "}
                      {(
                        (Number(formData.marksObtained) /
                          Number(selectedExam.totalMarks)) *
                        100
                      ).toFixed(2)}
                      % | Status:{" "}
                      {Number(formData.marksObtained) >=
                      Number(selectedExam.passingMarks)
                        ? "Pass"
                        : "Fail"}
                    </p>
                  </div>
                )}

              <div className="form-actions">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Result"
                      : "Add Result"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      )}

      {/* Results table */}
      <section className="panel">
        <div className="panel-header">
          <h2>
            {userRole === "Student"
              ? "My Exam Results"
              : "Student Exam Results"}
          </h2>
          <span>{results.length} records</span>
        </div>

        {loading ? (
          <p>Loading results...</p>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <h3>No results available</h3>
            <p>
              {canManageResults
                ? "Add an exam result using the form above."
                : "Your results will appear here when available."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="student-table">
              <thead>
                <tr>
                  {userRole !== "Student" && <th>Student</th>}
                  <th>Exam</th>
                  <th>Marks</th>
                  <th>Percentage</th>
                  <th>Status</th>
                  {canManageResults && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {results.map((result) => (
                  <tr key={result._id}>
                    {userRole !== "Student" && (
                      <td>
                        {result.student?.name ||
                          "Student unavailable"}
                      </td>
                    )}

                    <td>
                      {result.exam?.title || "Exam unavailable"}
                    </td>

                    <td>
                      {result.marksObtained}/
                      {result.exam?.totalMarks ?? "—"}
                    </td>

                    <td>{getPercentage(result)}%</td>

                    <td>
                      <span
                        className={
                          getStatus(result) === "Pass"
                            ? "course-badge"
                            : "alert error-alert"
                        }
                      >
                        {getStatus(result)}
                      </span>
                    </td>

                    {canManageResults && (
                      <td>
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="edit-btn"
                            onClick={() => handleEdit(result)}
                          >
                            Edit
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              className="delete-btn"
                              onClick={() =>
                                handleDelete(result._id)
                              }
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default ResultManagement;
