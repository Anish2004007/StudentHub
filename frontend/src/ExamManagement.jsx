
import { useEffect, useState } from "react";
import API from "./api";

const INITIAL_FORM = {
  title: "",
  course: "",
  semester: "1",
  examType: "Internal",
  examDate: "",
  duration: "60",
  totalMarks: "100",
  passingMarks: "40",
  description: "",
};

function ExamManagement() {
  const [exams, setExams] = useState([]);
  const [formData, setFormData] = useState({ ...INITIAL_FORM });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Get the logged-in user's role.
  const user = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("studenthub_user") || "null");
    } catch {
      return null;
    }
  })();

  const userRole = user?.role;
  const isAdmin = userRole === "Admin";
  const canManageExams = isAdmin || userRole === "Faculty";

  const fetchExams = async () => {
    try {
      const response = await API.get("/api/exams");

      setExams(
        Array.isArray(response.data)
          ? response.data
          : response.data.exams || []
      );

      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load exams. Check the backend server."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({ ...INITIAL_FORM });
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canManageExams) {
      setError("You do not have permission to manage exams.");
      return;
    }

    setMessage("");
    setError("");

    const totalMarks = Number(formData.totalMarks);
    const passingMarks = Number(formData.passingMarks);
    const duration = Number(formData.duration);
    const semester = Number(formData.semester);

    if (
      formData.totalMarks.trim() === "" ||
      formData.passingMarks.trim() === "" ||
      !Number.isFinite(totalMarks) ||
      !Number.isFinite(passingMarks) ||
      totalMarks < 1 ||
      passingMarks < 0 ||
      passingMarks > totalMarks
    ) {
      setError("Passing marks must be between 0 and total marks.");
      return;
    }

    if (
      !Number.isFinite(duration) ||
      duration < 1 ||
      !Number.isFinite(semester) ||
      semester < 1
    ) {
      setError("Enter a valid exam duration and semester.");
      return;
    }

    const payload = {
      ...formData,
      totalMarks,
      passingMarks,
      duration,
      semester,
    };

    setSaving(true);

    try {
      const response = editingId
        ? await API.put(`/api/exams/${editingId}`, payload)
        : await API.post("/api/exams", payload);

      setMessage(
        response.data?.message ||
          (editingId
            ? "Exam updated successfully."
            : "Exam created successfully.")
      );

      resetForm();
      await fetchExams();
    } catch (err) {
      console.error("Exam save error:", err.response?.data || err);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to save the exam."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (exam) => {
    if (!canManageExams) {
      setError("You do not have permission to edit exams.");
      return;
    }

    setFormData({
      title: exam.title || "",
      course: exam.course || "",
      semester: String(exam.semester ?? 1),
      examType: exam.examType || "Internal",
      examDate: exam.examDate
        ? new Date(exam.examDate).toISOString().slice(0, 10)
        : "",
      duration: String(exam.duration ?? 60),
      totalMarks: String(exam.totalMarks ?? 100),
      passingMarks: String(exam.passingMarks ?? 40),
      description: exam.description || "",
    });

    setEditingId(exam._id);
    setMessage("");
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!isAdmin) {
      setError("Only an Admin can delete exams.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this exam?")) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await API.delete(`/api/exams/${id}`);

      setMessage(response.data?.message || "Exam deleted successfully.");

      if (editingId === id) {
        resetForm();
      }

      await fetchExams();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to delete the exam."
      );
    }
  };

  return (
    <div className="main-content">
      {/* Exam form: Admin and Faculty only */}
      {canManageExams && (
        <section className="panel">
          <div className="panel-header">
            <h2>{editingId ? "Edit Exam" : "Add New Exam"}</h2>
          </div>

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

          <form className="student-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="exam-title">Exam Title</label>
              <input
                id="exam-title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. MCA Semester 1 Examination"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="exam-course">Course</label>
              <input
                id="exam-course"
                name="course"
                value={formData.course}
                onChange={handleChange}
                placeholder="e.g. MCA"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="exam-semester">Semester</label>
              <select
                id="exam-semester"
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                required
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
                  (number) => (
                    <option key={number} value={number}>
                      Semester {number}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="exam-type">Exam Type</label>
              <select
                id="exam-type"
                name="examType"
                value={formData.examType}
                onChange={handleChange}
                required
              >
                {[
                  "Internal",
                  "Mid Semester",
                  "End Semester",
                  "Practical",
                  "Supplementary",
                ].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="exam-date">Exam Date</label>
              <input
                id="exam-date"
                name="examDate"
                type="date"
                value={formData.examDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="exam-duration">Duration (minutes)</label>
              <input
                id="exam-duration"
                name="duration"
                type="number"
                min="1"
                value={formData.duration}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="exam-total-marks">Total Marks</label>
              <input
                id="exam-total-marks"
                name="totalMarks"
                type="number"
                min="1"
                value={formData.totalMarks}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="exam-passing-marks">Passing Marks</label>
              <input
                id="exam-passing-marks"
                name="passingMarks"
                type="number"
                min="0"
                max={formData.totalMarks || undefined}
                value={formData.passingMarks}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="exam-description">
                Description (Optional)
              </label>
              <textarea
                id="exam-description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter exam instructions or details"
                rows="3"
              />
            </div>

            <div className="form-actions">
              <button
                className="primary-btn"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Exam"
                    : "Add Exam"}
              </button>

              {editingId && (
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {/* Scheduled exams */}
      <section className="panel">
        <div className="panel-header">
          <h2>Scheduled Exams</h2>
          <span>{exams.length} exams</span>
        </div>

        {error && !canManageExams && (
          <div className="alert error-alert" role="alert">
            {error}
          </div>
        )}

        {message && !canManageExams && (
          <div className="alert success-alert" role="status">
            {message}
          </div>
        )}

        {loading ? (
          <p>Loading exams...</p>
        ) : exams.length === 0 ? (
          <div className="empty-state">
            <h3>No exams scheduled yet</h3>
            <p>
              {canManageExams
                ? "Use the form above to add your first exam."
                : "Scheduled exams will appear here when available."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="student-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Course</th>
                  <th>Semester</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Marks</th>
                  {canManageExams && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {exams.map((exam) => (
                  <tr key={exam._id}>
                    <td>
                      <strong>{exam.title}</strong>
                      {exam.description && <p>{exam.description}</p>}
                    </td>
                    <td>{exam.course}</td>
                    <td>{exam.semester}</td>
                    <td>{exam.examType}</td>
                    <td>
                      {exam.examDate
                        ? new Date(exam.examDate).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>{exam.duration} min</td>
                    <td>
                      {exam.passingMarks}/{exam.totalMarks} to pass
                    </td>

                    {canManageExams && (
                      <td>
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="edit-btn"
                            onClick={() => handleEdit(exam)}
                          >
                            Edit
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              className="delete-btn"
                              onClick={() => handleDelete(exam._id)}
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

export default ExamManagement;
