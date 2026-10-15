
import { useEffect, useRef, useState } from "react";
import API from "./api";
import "./StudentProfile.css";

const API_BASE_URL = "http://localhost:5000";

const EMPTY_SUMMARY = {
  attendance: [],
  results: [],
  loading: false,
  attendanceError: false,
  resultsError: false,
};

function getStudentId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;

  return String(value._id || value.id || "");
}

function getRecords(data, keys) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function getRecordStudentId(record, possibleKeys) {
  for (const key of possibleKeys) {
    const id = getStudentId(record?.[key]);
    if (id) return id;
  }

  return "";
}

function getResultPercentage(result) {
  const exam = result.exam || result.examId;

  const marks = Number(
    result.marksObtained ??
      result.obtainedMarks ??
      result.marks
  );

  const total = Number(
    result.totalMarks ??
      result.maxMarks ??
      (exam && typeof exam === "object"
        ? exam.totalMarks ?? exam.maxMarks
        : undefined)
  );

  if (
    !Number.isFinite(marks) ||
    !Number.isFinite(total) ||
    total <= 0 ||
    marks < 0 ||
    marks > total
  ) {
    return null;
  }

  return (marks / total) * 100;
}

function getPassingStatus(result) {
  const exam = result.exam || result.examId;

  const passingMarks = Number(
    result.passingMarks ??
      (exam && typeof exam === "object"
        ? exam.passingMarks
        : undefined)
  );

  const marks = Number(
    result.marksObtained ??
      result.obtainedMarks ??
      result.marks
  );

  if (
    !Number.isFinite(passingMarks) ||
    !Number.isFinite(marks) ||
    passingMarks < 0
  ) {
    return null;
  }

  return marks >= passingMarks;
}

function StudentProfile({ students = [], onStudentUpdated }) {
  const [selectedId, setSelectedId] = useState("");
  const [profile, setProfile] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    course: "",
    age: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [preview, setPreview] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [academicSummary, setAcademicSummary] =
    useState(EMPTY_SUMMARY);

  const fileInputRef = useRef(null);

  // Keep the selected student valid when the student list changes.
  useEffect(() => {
    if (students.length === 0) {
      setSelectedId("");
      setProfile(null);
      return;
    }

    const selectedExists = students.some(
      (student) => student._id === selectedId
    );

    if (!selectedExists) {
      setSelectedId(students[0]._id);
    }
  }, [students, selectedId]);

  // Load the selected student's profile.
  useEffect(() => {
    if (!selectedId) {
      setProfile(null);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      setError("");
      setMessage("");
      setIsEditing(false);

      setPreview("");
      setSelectedFile(null);

      try {
        const response = await API.get(
          `/students/${selectedId}`
        );

        if (cancelled) return;

        const student =
          response.data.student || response.data;

        setProfile(student);

        setFormData({
          name: student.name || "",
          email: student.email || "",
          course: student.course || "",
          age:
            student.age != null
              ? String(student.age)
              : "",
        });
      } catch (err) {
        if (cancelled) return;

        setProfile(null);

        setError(
          err.response?.data?.message ||
            "Unable to load this student profile."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Load attendance and result records for the selected student.
  useEffect(() => {
    if (!selectedId) {
      setAcademicSummary(EMPTY_SUMMARY);
      return;
    }

    let cancelled = false;

    const loadAcademicSummary = async () => {
      setAcademicSummary({
        attendance: [],
        results: [],
        loading: true,
        attendanceError: false,
        resultsError: false,
      });

      const [attendanceResponse, resultsResponse] =
        await Promise.allSettled([
          API.get("/api/attendance"),
          API.get("/api/results"),
        ]);

      if (cancelled) return;

      let attendance = [];
      let results = [];
      let attendanceError = false;
      let resultsError = false;

      if (attendanceResponse.status === "fulfilled") {
        const records = getRecords(
          attendanceResponse.value.data,
          ["attendance", "records", "data"]
        );

        attendance = records.filter(
          (record) =>
            getRecordStudentId(record, [
              "studentId",
              "student",
            ]) === selectedId
        );
      } else {
        attendanceError = true;
      }

      if (resultsResponse.status === "fulfilled") {
        const records = getRecords(
          resultsResponse.value.data,
          ["results", "records", "data"]
        );

        results = records.filter(
          (record) =>
            getRecordStudentId(record, [
              "student",
              "studentId",
            ]) === selectedId
        );
      } else {
        resultsError = true;
      }

      setAcademicSummary({
        attendance,
        results,
        loading: false,
        attendanceError,
        resultsError,
      });
    };

    loadAcademicSummary();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Release temporary preview URLs.
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // Select and preview a profile picture.
  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setMessage("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Please select a JPG, PNG, or WebP image."
      );
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be 5 MB or less.");
      event.target.value = "";
      return;
    }

    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });

    setSelectedFile(file);
  };

  // Upload the selected picture to the Express backend.
  const handlePhotoUpload = async () => {
    if (!selectedFile || !selectedId) {
      setError("Please select a profile picture first.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const uploadData = new FormData();

      uploadData.append("profilePicture", selectedFile);

      const response = await API.post(
        `/students/${selectedId}/profile-picture`,
        uploadData
      );

      const updatedStudent =
        response.data.student || response.data;

      setProfile(updatedStudent);
      setSelectedFile(null);

      setPreview((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return "";
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setMessage("Profile picture updated successfully.");

      if (onStudentUpdated) {
        await onStudentUpdated();
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to upload the picture. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleCancelPhoto = () => {
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });

    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setError("");
  };

  // Save changes to the student's personal information.
  const handleSave = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.course.trim() ||
      !formData.age
    ) {
      setError("Please complete all required fields.");
      return;
    }

    const age = Number(formData.age);

    if (!Number.isInteger(age) || age < 1 || age > 120) {
      setError(
        "Age must be a whole number between 1 and 120."
      );
      return;
    }

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      course: formData.course.trim(),
      age,
    };

    setSaving(true);

    try {
      const response = await API.put(
        `/students/${selectedId}`,
        payload
      );

      const updatedStudent =
        response.data.student || response.data;

      setProfile(updatedStudent);

      setFormData({
        name: updatedStudent.name || "",
        email: updatedStudent.email || "",
        course: updatedStudent.course || "",
        age: String(updatedStudent.age ?? ""),
      });

      setIsEditing(false);
      setMessage("Student profile updated successfully.");

      if (onStudentUpdated) {
        await onStudentUpdated();
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update the profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!profile) return;

    setFormData({
      name: profile.name || "",
      email: profile.email || "",
      course: profile.course || "",
      age:
        profile.age != null
          ? String(profile.age)
          : "",
    });

    setIsEditing(false);
    setError("");
    setMessage("");
  };

  // Attendance and result calculations.
  const attendanceRecords = academicSummary.attendance;
  const resultRecords = academicSummary.results;

  const presentCount = attendanceRecords.filter(
    (record) =>
      ["present", "late"].includes(
        String(record.status || "").toLowerCase()
      )
  ).length;

  const attendancePercentage =
    attendanceRecords.length > 0
      ? Math.round(
          (presentCount / attendanceRecords.length) * 100
        )
      : null;

  const scoredResults = resultRecords
    .map((result) => {
      const percentage = getResultPercentage(result);

      if (percentage === null) return null;

      return {
        ...result,
        percentage,
        passStatus: getPassingStatus(result),
      };
    })
    .filter(Boolean);

  const averagePercentage =
    scoredResults.length > 0
      ? scoredResults.reduce(
          (sum, result) => sum + result.percentage,
          0
        ) / scoredResults.length
      : null;

  const latestResult = [...scoredResults].sort(
    (a, b) =>
      new Date(
        b.createdAt || b.updatedAt || 0
      ).getTime() -
      new Date(
        a.createdAt || a.updatedAt || 0
      ).getTime()
  )[0];

  // Empty state.
  if (students.length === 0) {
    return (
      <section className="profile-page">
        <div className="page-heading">
          <div>
            <h2>Student Profile</h2>
            <p>
              View and manage individual student information.
            </p>
          </div>
        </div>

        <div className="panel profile-empty">
          <div className="profile-empty-icon">👨‍🎓</div>
          <h3>No students available</h3>
          <p>
            Add a student from the Students section to get started.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="profile-page">
      <div className="page-heading">
        <div>
          <h2>Student Profile</h2>
          <p>
            View and manage individual student information.
          </p>
        </div>
      </div>

      <section className="panel profile-selector">
        <label htmlFor="profileStudent">
          Select Student
        </label>

        <select
          id="profileStudent"
          value={selectedId}
          onChange={(event) =>
            setSelectedId(event.target.value)
          }
        >
          {students.map((student) => (
            <option
              key={student._id}
              value={student._id}
            >
              {student.name} — {student.course}
            </option>
          ))}
        </select>
      </section>

      {message && (
        <div
          className="alert success-alert"
          role="status"
        >
          {message}
        </div>
      )}

      {error && (
        <div
          className="alert error-alert"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="panel profile-empty">
          <p>Loading student profile...</p>
        </div>
      ) : profile ? (
        <>
          {/* Student profile and picture */}
          <section className="panel profile-hero">
            <div className="profile-photo-section">
              <div className="profile-avatar">
                {!(
                  preview ||
                  profile.profilePicture
                ) && (
                  <span>
                    {(profile.name || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}

                {(preview ||
                  profile.profilePicture) && (
                  <img
                    src={
                      preview ||
                      `${API_BASE_URL}${profile.profilePicture}`
                    }
                    alt={`${profile.name}'s profile`}
                    onError={(event) => {
                      event.currentTarget.style.display =
                        "none";
                    }}
                    onLoad={(event) => {
                      event.currentTarget.style.display =
                        "block";
                    }}
                  />
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                hidden
                id="profilePictureInput"
              />

              <label
                htmlFor="profilePictureInput"
                className="secondary-btn profile-photo-button"
              >
                Choose Photo
              </label>

              {selectedFile && (
                <div className="profile-photo-actions">
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={handlePhotoUpload}
                    disabled={uploading}
                  >
                    {uploading
                      ? "Uploading..."
                      : "Upload Photo"}
                  </button>

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleCancelPhoto}
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <small>
                JPG, PNG or WebP · Maximum 5 MB
              </small>
            </div>

            <div className="profile-identity">
              <span className="profile-eyebrow">
                STUDENT PROFILE
              </span>

              <h3>{profile.name}</h3>
              <p>{profile.email}</p>

              <span className="course-badge">
                {profile.course}
              </span>
            </div>

            {!isEditing && (
              <button
                type="button"
                className="primary-btn profile-edit-action"
                onClick={() => {
                  setMessage("");
                  setError("");
                  setIsEditing(true);
                }}
              >
                Edit Profile
              </button>
            )}
          </section>

          {/* Academic performance summary */}
          <section className="academic-summary">
            <div className="academic-summary-heading">
              <div>
                <h2>Academic Overview</h2>
                <p>
                  Attendance and examination performance
                </p>
              </div>
            </div>

            {academicSummary.loading ? (
              <div className="panel academic-message">
                Loading academic statistics...
              </div>
            ) : (
              <>
                <div className="academic-stats-grid">
                  <div className="panel academic-stat-card">
                    <span className="academic-stat-icon">
                      📅
                    </span>

                    <p>Attendance Rate</p>

                    <h3>
                      {academicSummary.attendanceError
                        ? "Unavailable"
                        : attendancePercentage === null
                          ? "—"
                          : `${attendancePercentage}%`}
                    </h3>

                    <small>
                      {academicSummary.attendanceError
                        ? "Could not load attendance"
                        : `${presentCount} attended out of ${attendanceRecords.length} records`}
                    </small>
                  </div>

                  <div className="panel academic-stat-card">
                    <span className="academic-stat-icon">
                      📝
                    </span>

                    <p>Examinations</p>

                    <h3>
                      {academicSummary.resultsError
                        ? "Unavailable"
                        : resultRecords.length}
                    </h3>

                    <small>Recorded results</small>
                  </div>

                  <div className="panel academic-stat-card">
                    <span className="academic-stat-icon">
                      📊
                    </span>

                    <p>Average Score</p>

                    <h3>
                      {academicSummary.resultsError
                        ? "Unavailable"
                        : averagePercentage === null
                          ? "—"
                          : `${averagePercentage.toFixed(1)}%`}
                    </h3>

                    <small>
                      Across valid scored results
                    </small>
                  </div>

                  <div className="panel academic-stat-card">
                    <span className="academic-stat-icon">
                      🎯
                    </span>

                    <p>Latest Result</p>

                    <h3>
                      {academicSummary.resultsError
                        ? "Unavailable"
                        : latestResult
                          ? `${latestResult.percentage.toFixed(1)}%`
                          : "—"}
                    </h3>

                    <small>
                      {!latestResult
                        ? "No scored results available"
                        : latestResult.passStatus === null
                          ? "Pass status unavailable"
                          : latestResult.passStatus
                            ? "Passed"
                            : "Not passed"}
                    </small>
                  </div>
                </div>

                {(academicSummary.attendanceError ||
                  academicSummary.resultsError) && (
                  <p
                    className="academic-warning"
                    role="status"
                  >
                    Some academic statistics could not
                    be loaded. Your student profile is
                    still available.
                  </p>
                )}
              </>
            )}
          </section>

          {/* Personal information */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Personal Information</h2>

                <p>
                  {isEditing
                    ? "Update the fields below and save your changes."
                    : "Student details stored in StudentHub."}
                </p>
              </div>
            </div>

            {isEditing ? (
              <form
                className="student-form"
                onSubmit={handleSave}
              >
                <div className="form-group">
                  <label htmlFor="profileName">
                    Full Name
                  </label>

                  <input
                    id="profileName"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profileEmail">
                    Email Address
                  </label>

                  <input
                    id="profileEmail"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    maxLength={254}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profileCourse">
                    Course
                  </label>

                  <input
                    id="profileCourse"
                    name="course"
                    value={formData.course}
                    onChange={handleChange}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profileAge">
                    Age
                  </label>

                  <input
                    id="profileAge"
                    name="age"
                    type="number"
                    min="1"
                    max="120"
                    step="1"
                    value={formData.age}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Changes"}
                  </button>

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-details-grid">
                <div className="profile-detail">
                  <span>Full Name</span>
                  <strong>{profile.name}</strong>
                </div>

                <div className="profile-detail">
                  <span>Email Address</span>
                  <strong>{profile.email}</strong>
                </div>

                <div className="profile-detail">
                  <span>Course</span>
                  <strong>{profile.course}</strong>
                </div>

                <div className="profile-detail">
                  <span>Age</span>
                  <strong>{profile.age} years</strong>
                </div>

                <div className="profile-detail">
                  <span>Registration Date</span>
                  <strong>
                    {profile.createdAt
                      ? new Date(
                          profile.createdAt
                        ).toLocaleDateString()
                      : "Not available"}
                  </strong>
                </div>

                <div className="profile-detail">
                  <span>Last Updated</span>
                  <strong>
                    {profile.updatedAt
                      ? new Date(
                          profile.updatedAt
                        ).toLocaleDateString()
                      : "Not available"}
                  </strong>
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="panel profile-empty">
          <h3>Profile unavailable</h3>
          <p>
            We could not retrieve the selected student's
            details.
          </p>
        </div>
      )}
    </section>
  );
}

export default StudentProfile;
