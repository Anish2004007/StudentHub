
import { useCallback, useEffect, useMemo, useState } from "react";
import API from "./api";
import "./TimetableCalendar.css";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const CATEGORIES = [
  "Holiday",
  "Examination",
  "Assignment Deadline",
  "College Event",
  "Academic",
  "Other",
];

const emptyTimetable = {
  subject: "",
  course: "",
  dayOfWeek: "Monday",
  startTime: "09:00",
  endTime: "10:00",
  faculty: "",
  room: "",
  semester: "",
  academicYear: "",
  notes: "",
};

const emptyEvent = {
  title: "",
  description: "",
  category: "Academic",
  startDate: "",
  endDate: "",
  allDay: true,
  startTime: "",
  endTime: "",
  location: "",
  course: "",
};

function todayString() {
  const date = new Date();
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return localDate.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TimetableCalendar({ currentUser, darkMode }) {
  const isAdmin = currentUser?.role === "Admin";

  const [view, setView] = useState("timetable");
  const [timetable, setTimetable] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [courseFilter, setCourseFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState(todayString().slice(0, 7));

  const [showTimetableForm, setShowTimetableForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingTimetableId, setEditingTimetableId] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  const [timetableForm, setTimetableForm] = useState(emptyTimetable);
  const [eventForm, setEventForm] = useState(emptyEvent);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [timetableResponse, eventResponse] = await Promise.all([
        API.get("/api/timetable"),
        API.get("/api/calendar"),
      ]);

      setTimetable(
        Array.isArray(timetableResponse.data)
          ? timetableResponse.data
          : []
      );

      setEvents(
        Array.isArray(eventResponse.data) ? eventResponse.data : []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load timetable and academic calendar."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const courses = useMemo(() => {
    return [
      ...new Set(
        [
          ...timetable.map((entry) => entry.course),
          ...events.map((event) => event.course),
        ].filter(Boolean)
      ),
    ].sort();
  }, [timetable, events]);

  const visibleTimetable = useMemo(() => {
    return timetable
      .filter((entry) => {
        const matchesCourse =
          !courseFilter || entry.course === courseFilter;
        const matchesDay =
          dayFilter === "All" || entry.dayOfWeek === dayFilter;

        return matchesCourse && matchesDay;
      })
      .sort((a, b) => {
        const dayDifference =
          DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek);

        return dayDifference || a.startTime.localeCompare(b.startTime);
      });
  }, [timetable, courseFilter, dayFilter]);

  const visibleEvents = useMemo(() => {
    return events
      .filter((event) => {
        const matchesCourse =
          !courseFilter ||
          !event.course ||
          event.course === courseFilter;

        const matchesMonth =
          !monthFilter ||
          (event.startDate <= `${monthFilter}-31` &&
            event.endDate >= `${monthFilter}-01`);

        return matchesCourse && matchesMonth;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [events, courseFilter, monthFilter]);

  const changeTimetableField = (event) => {
    const { name, value } = event.target;
    setTimetableForm((previous) => ({ ...previous, [name]: value }));
  };

  const changeEventField = (event) => {
    const { name, value, type, checked } = event.target;
    setEventForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const resetTimetableForm = () => {
    setTimetableForm(emptyTimetable);
    setEditingTimetableId(null);
    setShowTimetableForm(false);
  };

  const resetEventForm = () => {
    setEventForm(emptyEvent);
    setEditingEventId(null);
    setShowEventForm(false);
  };

  const submitTimetable = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...timetableForm,
        subject: timetableForm.subject.trim(),
        course: timetableForm.course.trim(),
        faculty: timetableForm.faculty.trim(),
        room: timetableForm.room.trim(),
      };

      if (editingTimetableId) {
        await API.put(
          `/api/timetable/${editingTimetableId}`,
          payload
        );
        setMessage("Timetable entry updated successfully.");
      } else {
        await API.post("/api/timetable", payload);
        setMessage("Timetable entry created successfully.");
      }

      resetTimetableForm();
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save timetable entry."
      );
    } finally {
      setSaving(false);
    }
  };

  const submitEvent = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...eventForm,
        title: eventForm.title.trim(),
        course: eventForm.course.trim(),
        location: eventForm.location.trim(),
        startTime: eventForm.allDay ? "" : eventForm.startTime,
        endTime: eventForm.allDay ? "" : eventForm.endTime,
      };

      if (editingEventId) {
        await API.put(`/api/calendar/${editingEventId}`, payload);
        setMessage("Academic event updated successfully.");
      } else {
        await API.post("/api/calendar", payload);
        setMessage("Academic event created successfully.");
      }

      resetEventForm();
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save academic event."
      );
    } finally {
      setSaving(false);
    }
  };

  const editTimetable = (entry) => {
    setTimetableForm({
      ...emptyTimetable,
      ...entry,
    });
    setEditingTimetableId(entry._id);
    setShowTimetableForm(true);
    setView("timetable");
    setError("");
    setMessage("");
  };

  const editEvent = (event) => {
    setEventForm({
      ...emptyEvent,
      ...event,
    });
    setEditingEventId(event._id);
    setShowEventForm(true);
    setView("calendar");
    setError("");
    setMessage("");
  };

  const deleteRecord = async (kind, id) => {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete this ${
        kind === "timetable" ? "timetable entry" : "academic event"
      }?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      if (kind === "timetable") {
        await API.delete(`/api/timetable/${id}`);
        setMessage("Timetable entry deleted successfully.");
      } else {
        await API.delete(`/api/calendar/${id}`);
        setMessage("Academic event deleted successfully.");
      }

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to delete the record."
      );
    }
  };

  return (
    <section
      className={`tc-page ${darkMode ? "tc-dark" : ""}`}
      aria-label="Timetable and academic calendar"
    >
      <div className="tc-heading">
        <div>
          <span className="tc-eyebrow">ACADEMIC PLANNER</span>
          <h2>Timetable &amp; Academic Calendar</h2>
          <p>Keep track of classes, examinations, deadlines and events.</p>
        </div>

        <button
          type="button"
          className="tc-refresh"
          onClick={loadData}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      <div className="tc-tabs" role="tablist" aria-label="Planner views">
        <button
          type="button"
          role="tab"
          aria-selected={view === "timetable"}
          className={view === "timetable" ? "active" : ""}
          onClick={() => {
            setView("timetable");
            setError("");
            setMessage("");
          }}
        >
          🗓️ Class Timetable
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={view === "calendar"}
          className={view === "calendar" ? "active" : ""}
          onClick={() => {
            setView("calendar");
            setError("");
            setMessage("");
          }}
        >
          📅 Academic Calendar
        </button>
      </div>

      <div className="tc-stats">
        <article className="tc-stat">
          <span>Class entries</span>
          <strong>{timetable.length}</strong>
        </article>
        <article className="tc-stat">
          <span>Academic events</span>
          <strong>{events.length}</strong>
        </article>
        <article className="tc-stat">
          <span>Upcoming events</span>
          <strong>
            {events.filter((item) => item.endDate >= todayString()).length}
          </strong>
        </article>
      </div>

      {error && <div className="tc-alert tc-error" role="alert">{error}</div>}
      {message && (
        <div className="tc-alert tc-success" role="status">{message}</div>
      )}

      <div className="tc-panel">
        <div className="tc-toolbar">
          <div className="tc-filter">
            <label htmlFor="tc-course-filter">Course</label>
            <select
              id="tc-course-filter"
              value={courseFilter}
              onChange={(event) => setCourseFilter(event.target.value)}
            >
              <option value="">All available courses</option>
              {courses.map((course) => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </div>

          {view === "timetable" ? (
            <div className="tc-filter">
              <label htmlFor="tc-day-filter">Day</label>
              <select
                id="tc-day-filter"
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
              >
                <option value="All">All days</option>
                {DAYS.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="tc-filter">
              <label htmlFor="tc-month-filter">Month</label>
              <input
                id="tc-month-filter"
                type="month"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
              />
            </div>
          )}

          {isAdmin && (
            <button
              type="button"
              className="tc-primary"
              onClick={() => {
                setError("");
                setMessage("");
                if (view === "timetable") {
                  if (!showTimetableForm) {
                    resetEventForm();
                    setTimetableForm(emptyTimetable);
                    setEditingTimetableId(null);
                  }
                  setShowTimetableForm((previous) => !previous);
                } else {
                  if (!showEventForm) {
                    resetTimetableForm();
                    setEventForm(emptyEvent);
                    setEditingEventId(null);
                  }
                  setShowEventForm((previous) => !previous);
                }
              }}
            >
              + Add {view === "timetable" ? "Class" : "Event"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="tc-empty">Loading academic planner…</div>
        ) : view === "timetable" ? (
          <>
            {isAdmin && showTimetableForm && (
              <form className="tc-form" onSubmit={submitTimetable}>
                <h3>{editingTimetableId ? "Edit Class" : "Add Class"}</h3>

                <div className="tc-form-grid">
                  <label>Subject *
                    <input name="subject" value={timetableForm.subject} onChange={changeTimetableField} required maxLength={120} />
                  </label>
                  <label>Course *
                    <input name="course" value={timetableForm.course} onChange={changeTimetableField} required maxLength={100} />
                  </label>
                  <label>Day *
                    <select name="dayOfWeek" value={timetableForm.dayOfWeek} onChange={changeTimetableField} required>
                      {DAYS.map((day) => <option key={day}>{day}</option>)}
                    </select>
                  </label>
                  <label>Start time *
                    <input type="time" name="startTime" value={timetableForm.startTime} onChange={changeTimetableField} required />
                  </label>
                  <label>End time *
                    <input type="time" name="endTime" value={timetableForm.endTime} onChange={changeTimetableField} required />
                  </label>
                  <label>Faculty *
                    <input name="faculty" value={timetableForm.faculty} onChange={changeTimetableField} required maxLength={120} />
                  </label>
                  <label>Room *
                    <input name="room" value={timetableForm.room} onChange={changeTimetableField} required maxLength={50} />
                  </label>
                  <label>Semester
                    <input name="semester" value={timetableForm.semester} onChange={changeTimetableField} maxLength={50} />
                  </label>
                  <label>Academic year
                    <input name="academicYear" value={timetableForm.academicYear} onChange={changeTimetableField} maxLength={30} placeholder="2026-2027" />
                  </label>
                  <label className="tc-wide">Notes
                    <textarea name="notes" value={timetableForm.notes} onChange={changeTimetableField} maxLength={500} />
                  </label>
                </div>

                <div className="tc-form-actions">
                  <button className="tc-primary" disabled={saving}>
                    {saving ? "Saving…" : editingTimetableId ? "Save Changes" : "Create Class"}
                  </button>
                  <button type="button" className="tc-secondary" onClick={resetTimetableForm}>Cancel</button>
                </div>
              </form>
            )}

            {visibleTimetable.length === 0 ? (
              <div className="tc-empty">
                <span>🗓️</span>
                <h3>No timetable entries found</h3>
                <p>{isAdmin ? "Use Add Class to create the first entry." : "There are no classes matching these filters."}</p>
              </div>
            ) : (
              <div className="tc-table-wrap">
                <table className="tc-table">
                  <thead>
                    <tr>
                      <th>Day / Time</th><th>Subject</th><th>Course</th>
                      <th>Faculty</th><th>Room</th>{isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTimetable.map((entry) => (
                      <tr key={entry._id}>
                        <td>
                          <strong>{entry.dayOfWeek}</strong>
                          <span>{entry.startTime} – {entry.endTime}</span>
                        </td>
                        <td>
                          <strong>{entry.subject}</strong>
                          {entry.semester && <span>{entry.semester}</span>}
                        </td>
                        <td>{entry.course}</td>
                        <td>{entry.faculty}</td>
                        <td>{entry.room}</td>
                        {isAdmin && (
                          <td>
                            <div className="tc-actions">
                              <button type="button" className="tc-edit" onClick={() => editTimetable(entry)}>Edit</button>
                              <button type="button" className="tc-delete" onClick={() => deleteRecord("timetable", entry._id)}>Delete</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            {isAdmin && showEventForm && (
              <form className="tc-form" onSubmit={submitEvent}>
                <h3>{editingEventId ? "Edit Academic Event" : "Add Academic Event"}</h3>

                <div className="tc-form-grid">
                  <label>Event title *
                    <input name="title" value={eventForm.title} onChange={changeEventField} required maxLength={150} />
                  </label>
                  <label>Category *
                    <select name="category" value={eventForm.category} onChange={changeEventField} required>
                      {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </label>
                  <label>Start date *
                    <input type="date" name="startDate" value={eventForm.startDate} onChange={changeEventField} required />
                  </label>
                  <label>End date *
                    <input type="date" name="endDate" min={eventForm.startDate || undefined} value={eventForm.endDate} onChange={changeEventField} required />
                  </label>

                  <label className="tc-checkbox">
                    <input type="checkbox" name="allDay" checked={eventForm.allDay} onChange={changeEventField} />
                    All-day event
                  </label>

                  {!eventForm.allDay && (
                    <>
                      <label>Start time *
                        <input type="time" name="startTime" value={eventForm.startTime} onChange={changeEventField} required />
                      </label>
                      <label>End time *
                        <input type="time" name="endTime" value={eventForm.endTime} onChange={changeEventField} required />
                      </label>
                    </>
                  )}

                  <label>Course (leave blank for all courses)
                    <input name="course" value={eventForm.course} onChange={changeEventField} maxLength={100} />
                  </label>
                  <label>Location
                    <input name="location" value={eventForm.location} onChange={changeEventField} maxLength={150} />
                  </label>
                  <label className="tc-wide">Description
                    <textarea name="description" value={eventForm.description} onChange={changeEventField} maxLength={2000} />
                  </label>
                </div>

                <div className="tc-form-actions">
                  <button className="tc-primary" disabled={saving}>
                    {saving ? "Saving…" : editingEventId ? "Save Changes" : "Create Event"}
                  </button>
                  <button type="button" className="tc-secondary" onClick={resetEventForm}>Cancel</button>
                </div>
              </form>
            )}

            {visibleEvents.length === 0 ? (
              <div className="tc-empty">
                <span>📅</span>
                <h3>No academic events found</h3>
                <p>{isAdmin ? "Use Add Event to create the first event." : "There are no events matching these filters."}</p>
              </div>
            ) : (
              <div className="tc-event-list">
                {visibleEvents.map((event) => (
                  <article className="tc-event" key={event._id}>
                    <div className="tc-event-date">
                      <strong>{new Date(`${event.startDate}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit" })}</strong>
                      <span>{new Date(`${event.startDate}T00:00:00`).toLocaleDateString(undefined, { month: "short" })}</span>
                    </div>
                    <div className="tc-event-details">
                      <div className="tc-event-title-row">
                        <h3>{event.title}</h3>
                        <span className="tc-category">{event.category}</span>
                      </div>
                      <p>{event.description || "No description provided."}</p>
                      <div className="tc-event-meta">
                        <span>📆 {formatDate(event.startDate)}{event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ""}</span>
                        {!event.allDay && <span>🕒 {event.startTime} – {event.endTime}</span>}
                        {event.location && <span>📍 {event.location}</span>}
                        {event.course && <span>🎓 {event.course}</span>}
                        {!event.course && <span>🌐 All courses</span>}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="tc-actions tc-event-actions">
                        <button type="button" className="tc-edit" onClick={() => editEvent(event)}>Edit</button>
                        <button type="button" className="tc-delete" onClick={() => deleteRecord("calendar", event._id)}>Delete</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default TimetableCalendar;

