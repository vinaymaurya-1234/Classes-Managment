import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  LoaderCircle,
  UserPlus,
  X,
  BookOpen,
  Trophy,
  Wallet,
  Users,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { Card, SectionIntro } from "../components/common/UI";
import { useAuth } from "../context/AuthContext";
import { createUserApi, listUsersApi, updateUserApi } from "../api/users.api";
import { api } from "../api/client";
import { students, teachers } from "../data/mockData";
import { listClassDivisionsApi } from "../api/classes.api";

const labels = { student: "Students", teacher: "Teachers", parent: "Parents" };
const descriptions = {
  student: "Manage student records, class and optional division.",
  teacher: "Manage faculty and assign their teaching classes.",
  parent: "Manage parent accounts and family contacts.",
};
const emptyForm = () => ({
  name: "",
  email: "",
  password: "",
  phone: "",
  classDivisionId: "",
  teachingClassDivisionIds: [],
  childIds: [],
  parentName: "",
  parentEmail: "",
  parentPassword: "",
  parentPhone: "",
});

export default function PeoplePage({ type, title }) {
  const { search = "", role } = useOutletContext();
  const { token } = useAuth();
  const isManagedType = ["student", "teacher", "parent"].includes(type);
  const canManage = role === "principal" && isManagedType;
  const heading = title || labels[type] || "People";

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(canManage);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [feeRecords, setFeeRecords] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [parentMatch, setParentMatch] = useState(null);
  const [parentLookupLoading, setParentLookupLoading] = useState(false);
  const [classDivisions, setClassDivisions] = useState([]);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [selectedTeachingClass, setSelectedTeachingClass] = useState("");
  const [placementValue, setPlacementValue] = useState("");
  const [assignmentValues, setAssignmentValues] = useState([]);
  const [editingPlacement, setEditingPlacement] = useState(false);
  const [editingAssignments, setEditingAssignments] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!canManage || !token) return;
    setLoading(true);
    setError("");
    try {
      const result = await listUsersApi(token, type);
      setData(Array.isArray(result.users) ? result.users : []);
    } catch (err) {
      setError(err.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [canManage, token, type]);

  useEffect(() => {
    if (canManage && token) loadUsers();
  }, [canManage, token, loadUsers]);

  useEffect(() => {
    if (!token) return;
    listClassDivisionsApi(token).then(result => setClassDivisions(result.classes || [])).catch(err => setError(err.message || "Unable to load class structure."));
  }, [token]);
  const visibleData = useMemo(() => {
    const query = String(search).toLowerCase().trim();
    const source = canManage ? data : type === "student" ? students : teachers;
    return source.filter((item) =>
      [
        item.name,
        item.email,
        item.phone,
        item.className,
        item.std,
        item.division,
        ...(item.teachingClasses || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [canManage, data, search, type]);

  const openPerson = async (person) => {
    setSelectedPerson(person);
    setPlacementValue(person.classDivisionId || "");
    setAssignmentValues(person.teachingClassDivisionIds || []);
    setEditingPlacement(false);
    setEditingAssignments(false);
    setSelectedAttempt(null);
    setAttempts([]);
    setFeeRecords([]);
    setTeacherClasses([]);
    setSelectedTeachingClass("");
    setError("");
    if (!canManage || !token) return;
    setDetailLoading(true);
    try {
      if (type === "student") {
        const [result, fees] = await Promise.all([
          api.get(
            `/api/exams/students/${encodeURIComponent(person.id)}/attempts`,
            token,
          ),
          api.get("/api/fees/students", token).catch(() => ({ fees: [] })),
        ]);
        setAttempts(result.data || []);
        setFeeRecords(
          (fees.fees || []).filter((item) => item.student?.id === person.id),
        );
      } else if (type === "teacher") {
        const result = await api.get(
          `/api/teacher/classes?teacherId=${encodeURIComponent(person.id)}`,
          token,
        );
        setTeacherClasses(result.classes || []);
      } else if (type === "parent") {
        const fees = await api
          .get("/api/fees/students", token)
          .catch(() => ({ fees: [] }));
        const linkedIds = (person.children || []).map((child) => child.id);
        setFeeRecords(
          (fees.fees || []).filter((fee) =>
            linkedIds.includes(fee.student?.id),
          ),
        );
      }
    } catch (err) {
      setError(err.message || "Unable to load account details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const openModal = async () => {
    setForm(emptyForm());
    setParentMatch(null);
    setError("");
    setModalOpen(true);
    if (type === "parent" && token && !availableStudents.length) {
      try {
        const result = await listUsersApi(token, "student");
        setAvailableStudents(result.users || []);
      } catch (err) {
        setError(err.message || "Unable to load students for parent linking.");
      }
    }
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const lookupParent = async () => {
    const email = form.parentEmail.trim().toLowerCase();
    setParentMatch(null);
    if (!email || !email.includes('@') || type !== 'student' || !token) return;
    setParentLookupLoading(true);
    try {
      const result = await api.get(`/api/users/parent-lookup?email=${encodeURIComponent(email)}`, token);
      setParentMatch(result.parent || null);
    } catch (err) {
      setError(err.message || 'Unable to check parent account.');
    } finally {
      setParentLookupLoading(false);
    }
  };

  const toggleClass = (value) => {
    setForm(current => ({ ...current, teachingClassDivisionIds: current.teachingClassDivisionIds.includes(value) ? current.teachingClassDivisionIds.filter(item=>item!==value) : [...current.teachingClassDivisionIds,value] }))
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        role: type,
        ...(type === "student"
          ? { classDivisionId: form.classDivisionId, parentName: form.parentName.trim(), parentEmail: form.parentEmail.trim(), parentPassword: form.parentPassword, parentPhone: form.parentPhone.trim() }
          : {}),
        ...(type === "teacher"
          ? { teachingClassDivisionIds: form.teachingClassDivisionIds }
          : {}),
        ...(type === "parent" ? { childIds: form.childIds } : {}),
      };
      await createUserApi(token, payload);
      setModalOpen(false);
      setForm(emptyForm());
      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to create this account.");
    } finally {
      setSaving(false);
    }
  };

  const saveTeacherClasses = async () => {
    if (!assignmentValues.length) { setError('Select at least one configured class division.'); return }
    try {
      await updateUserApi(token, selectedPerson.id, { teachingClassDivisionIds: assignmentValues })
      setEditingAssignments(false)
      await loadUsers()
      const updated = (await listUsersApi(token, type)).users?.find(item=>item.id===selectedPerson.id)
      if (updated) setSelectedPerson(updated)
    } catch (err) { setError(err.message || 'Unable to update teacher assignments.') }
  }

  const savePlacement = async () => {
    if (!placementValue) { setError('Select a configured class division.'); return }
    try {
      const response = await api.put(`/api/users/${encodeURIComponent(selectedPerson.id)}/class-placement`, { classDivisionId: placementValue }, token)
      setSelectedPerson(current => ({ ...current, ...(response.user || {}), classDivisionId: placementValue }))
      setEditingPlacement(false)
      await loadUsers()
    } catch (err) { setError(err.message || 'Unable to update student class.') }
  }

  const toggleAssignment = id => setAssignmentValues(current => current.includes(id) ? current.filter(value=>value!==id) : [...current,id])

  return (
    <>
      <SectionIntro
        eyebrow="MANAGEMENT"
        title={heading}
        text={
          descriptions[type] ||
          "Manage people connected to your tuition centre."
        }
      >
        {canManage && (
          <button type="button" className="primary" onClick={openModal}>
            <UserPlus size={16} />
            Add {type}
          </button>
        )}
      </SectionIntro>

      {error && !modalOpen && (
        <div className="profile-message error people-error">{error}</div>
      )}

      {selectedPerson ? (
        <Card title={`${selectedPerson.name} · ${type} details`}>
          <div className="person-detail-page">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSelectedPerson(null);
                setSelectedAttempt(null);
                setError("");
              }}
            >
              <ArrowLeft size={15} /> Back to {heading.toLowerCase()}
            </button>
            <div className="person-detail-hero">
              {selectedPerson.avatarUrl ? (
                <img
                  className="avatar avatar-image"
                  src={selectedPerson.avatarUrl}
                  alt=""
                />
              ) : (
                <span className="avatar green">
                  {(selectedPerson.name || "?")[0].toUpperCase()}
                </span>
              )}
              <div>
                <h2>{selectedPerson.name}</h2>
                <p>{selectedPerson.email}</p>
                <span>{selectedPerson.phone || "No phone provided"}</span>
              </div>
            </div>
            {detailLoading ? (
              <div className="people-state">
                <LoaderCircle size={18} className="spin" />
                Loading details...
              </div>
            ) : (
              <>
                <div className="person-detail-actions">
                  {type === "student" && <button type="button" className="secondary" onClick={() => setEditingPlacement(value=>!value)}>Edit class and division</button>}
                  {type === "teacher" && <button type="button" className="secondary" onClick={() => setEditingAssignments(value=>!value)}>Edit teaching assignments</button>}
                </div>
                {type === "student" && editingPlacement && <div className="teacher-assignment-field">
                  <label>Class / Division<select value={placementValue} onChange={event=>setPlacementValue(event.target.value)}><option value="">Choose class division</option>{classDivisions.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
                  <div className="user-modal-actions"><button type="button" className="secondary" onClick={()=>setEditingPlacement(false)}>Cancel</button><button type="button" className="primary" onClick={savePlacement}>Save class</button></div>
                </div>}
                {type === "teacher" && editingAssignments && <fieldset className="teacher-assignment-field">
                  <legend>Teaching class divisions</legend>
                  <div className="teacher-assignment-options">{classDivisions.filter(item=>item.active).map(item=><label key={item.id}><input type="checkbox" checked={assignmentValues.includes(item.id)} onChange={()=>toggleAssignment(item.id)}/>{item.displayName}</label>)}</div>
                  <div className="user-modal-actions"><button type="button" className="secondary" onClick={()=>setEditingAssignments(false)}>Cancel</button><button type="button" className="primary" onClick={saveTeacherClasses} disabled={!assignmentValues.length}>Save assignments</button></div>
                </fieldset>}
                <div className="person-detail-grid">
                  <div>
                    <span>Email</span>
                    <strong>{selectedPerson.email || "—"}</strong>
                  </div>
                  <div>
                    <span>Phone</span>
                    <strong>{selectedPerson.phone || "—"}</strong>
                  </div>
                  {type === "student" && (
                    <>
                      <div>
                        <span>Class</span>
                        <strong>
                          Class {selectedPerson.std || "—"}
                          {selectedPerson.division
                            ? ` · Division ${selectedPerson.division}`
                            : ""}
                        </strong>
                      </div>
                      <div>
                        <span>Account created</span>
                        <strong>
                          {selectedPerson.createdAt
                            ? new Date(
                                selectedPerson.createdAt,
                              ).toLocaleDateString("en-IN")
                            : "—"}
                        </strong>
                      </div>
                    </>
                  )}
                  {type === "teacher" && (
                    <div className="person-detail-wide">
                      <span>Assigned classes</span>
                      <strong>
                        {(selectedPerson.teachingClasses || []).join(", ") ||
                          "No classes assigned"}
                      </strong>
                    </div>
                  )}
                </div>
                {canManage && type === "student" && (
                  <div className="person-detail-section">
                    <div className="person-detail-section-head">
                      <h3>
                        <Trophy size={16} /> Recent attempted tests
                      </h3>
                      <span>{attempts.length} attempts</span>
                    </div>
                    {attempts.length ? (
                      attempts.map((attempt) => (
                        <article className="person-test-card" key={attempt.id}>
                          <button
                            type="button"
                            className="person-test-summary"
                            onClick={() =>
                              setSelectedAttempt(
                                selectedAttempt?.id === attempt.id
                                  ? null
                                  : attempt,
                              )
                            }
                          >
                            <span>
                              <strong>{attempt.exam?.title || "Exam"}</strong>
                              <small>
                                {attempt.exam?.subject || "Subject"} ·{" "}
                                {attempt.submittedAt
                                  ? new Date(
                                      attempt.submittedAt,
                                    ).toLocaleDateString("en-IN")
                                  : "Submitted"}
                              </small>
                            </span>
                            <span className="person-test-score">
                              {attempt.score ?? 0} / {attempt.totalMarks}
                            </span>
                            <ChevronRight size={16} />
                          </button>
                          {selectedAttempt?.id === attempt.id && (
                            <div className="person-question-review">
                              {(attempt.questions || []).map(
                                (question, index) => (
                                  <div
                                    className="person-question"
                                    key={question.id}
                                  >
                                    <div className="person-question-title">
                                      <strong>
                                        Q{index + 1}. {question.text}
                                      </strong>
                                      <span
                                        className={
                                          "pill " +
                                          (question.status === "correct"
                                            ? "success"
                                            : question.status === "incorrect"
                                              ? "danger"
                                              : "neutral")
                                        }
                                      >
                                        {question.status}
                                      </span>
                                    </div>
                                    <p>
                                      Your answer:{" "}
                                      <b>
                                        {question.selectedAnswer || "Skipped"}
                                      </b>
                                    </p>
                                    {question.correctAnswer && (
                                      <p>
                                        Correct answer:{" "}
                                        <b>{question.correctAnswer}</b>
                                      </p>
                                    )}
                                    {question.explanation && (
                                      <small>{question.explanation}</small>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                        </article>
                      ))
                    ) : (
                      <p className="person-detail-empty">
                        No submitted test attempts found for this student.
                      </p>
                    )}
                  </div>
                )}
                {type === "student" && (
                  <div className="person-detail-section">
                    <div className="person-detail-section-head">
                      <h3>
                        <Wallet size={16} /> Fee details
                      </h3>
                    </div>
                    {feeRecords.length ? (
                      feeRecords.map((fee) => (
                        <div
                          className="person-fee-row"
                          key={fee.id || fee.academicYear}
                        >
                          <span>{fee.academicYear}</span>
                          <strong>
                            ₹
                            {Number(fee.pendingAmount || 0).toLocaleString(
                              "en-IN",
                            )}{" "}
                            pending
                          </strong>
                          <small>
                            ₹
                            {Number(fee.paidAmount || 0).toLocaleString(
                              "en-IN",
                            )}{" "}
                            paid of ₹
                            {Number(fee.totalFee || 0).toLocaleString("en-IN")}
                          </small>
                        </div>
                      ))
                    ) : (
                      <p className="person-detail-empty">
                        No fee record is available yet.
                      </p>
                    )}
                  </div>
                )}
                {type === "parent" && (
                  <div className="person-detail-section">
                    <div className="person-detail-section-head">
                      <h3>
                        <Users size={16} /> Linked children and fee overview
                      </h3>
                      <span>
                        {(selectedPerson.children || []).length} children
                      </span>
                    </div>
                    {(selectedPerson.children || []).map((child) => (
                      <div className="person-fee-row" key={child.id}>
                        <span>
                          {child.name} · Class {child.std || "—"}
                          {child.division
                            ? " · Division " + child.division
                            : ""}
                        </span>
                        <small>{child.email}</small>
                      </div>
                    ))}
                    {feeRecords.length ? (
                      feeRecords.map((fee) => (
                        <div
                          className="person-fee-row"
                          key={fee.id || fee.student?.id}
                        >
                          <span>
                            {fee.student?.name} ·{" "}
                            {fee.student?.className || "Class not assigned"}
                          </span>
                          <strong>
                            ₹
                            {Number(fee.pendingAmount || 0).toLocaleString(
                              "en-IN",
                            )}{" "}
                            pending
                          </strong>
                          <small>
                            {fee.installmentCount || 0} recorded installments
                          </small>
                          {(fee.installments || []).map(
                            (installment, index) => (
                              <small key={installment.id || index}>
                                Installment {index + 1}: ₹
                                {Number(installment.amount || 0).toLocaleString(
                                  "en-IN",
                                )}{" "}
                                ·{" "}
                                {installment.paidOn
                                  ? new Date(
                                      installment.paidOn,
                                    ).toLocaleDateString("en-IN")
                                  : "Date not recorded"}
                              </small>
                            ),
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="person-detail-empty">
                        No fee records are available for this parent’s linked
                        children.
                      </p>
                    )}
                  </div>
                )}
                {type === "teacher" && (
                  <div className="person-detail-section">
                    <div className="person-detail-section-head">
                      <h3>
                        <BookOpen size={16} /> Teaching overview
                      </h3>
                    </div>
                    {teacherClasses.length ? (
                      teacherClasses.map((item) => (
                        <article
                          className="person-teaching-class"
                          key={item.label}
                        >
                          <button
                            type="button"
                            className="person-teaching-class-head"
                            onClick={() =>
                              setSelectedTeachingClass(
                                selectedTeachingClass === item.label
                                  ? ""
                                  : item.label,
                              )
                            }
                          >
                            <div>
                              <strong>{item.label}</strong>
                              <small>
                                {item.subjects?.join(" · ") ||
                                  "Subjects not configured"}
                              </small>
                            </div>
                            <span>
                              {item.studentCount || 0} students ·{" "}
                              {selectedTeachingClass === item.label
                                ? "Hide details"
                                : "View details"}
                            </span>
                          </button>
                          {selectedTeachingClass === item.label && (
                            <div className="person-teaching-class-columns">
                              <div>
                                <b>Chapters in progress</b>
                                {item.chapters?.length ? (
                                  item.chapters.map((ch) => (
                                    <div
                                      className="person-chapter-row"
                                      key={ch.id}
                                    >
                                      <span>{ch.title}</span>
                                      <small>
                                        {ch.subject || "Subject"} · {ch.status}
                                        {ch.progress
                                          ? ` · ${ch.progress}%`
                                          : ""}
                                      </small>
                                    </div>
                                  ))
                                ) : (
                                  <small>
                                    No chapters recorded for this class yet.
                                  </small>
                                )}
                              </div>
                              <div>
                                <b>Students in this class</b>
                                {item.students?.length ? (
                                  item.students.map((student) => (
                                    <div
                                      className="person-chapter-row"
                                      key={student.id}
                                    >
                                      <span>{student.name}</span>
                                      <small>
                                        {student.email || "No email"}
                                        {student.division
                                          ? " · " + student.division
                                          : ""}
                                      </small>
                                    </div>
                                  ))
                                ) : (
                                  <small>
                                    No students assigned to this class.
                                  </small>
                                )}
                              </div>
                            </div>
                          )}
                        </article>
                      ))
                    ) : (
                      <p className="person-detail-empty">
                        No teaching classes are assigned to this teacher yet.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      ) : (
        <Card title={`${heading} directory`}>
          {loading ? (
            <div className="people-state">
              <LoaderCircle size={18} className="spin" />
              Loading {heading.toLowerCase()}...
            </div>
          ) : visibleData.length ? (
            <div className="attendance-table">
              {visibleData.map((person) => (
                <div
                  className="table-row people-clickable-row"
                  key={person.id || person.email || person.name}
                  onClick={() => openPerson(person)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openPerson(person);
                    }
                  }}
                >
                  <span className="person">
                    {person.avatarUrl ? (
                      <img
                        className="avatar avatar-image"
                        src={person.avatarUrl}
                        alt=""
                      />
                    ) : (
                      <span className="avatar green">
                        {(person.name || "?")[0].toUpperCase()}
                      </span>
                    )}
                    <div>
                      <b>{person.name}</b>
                      <small>
                        {(type === "student" && person.std
                          ? `Class ${person.std}${person.division ? ` - ${person.division}` : ""}`
                          : "") ||
                          (type === "teacher" && person.teachingClasses?.length
                            ? person.teachingClasses.join(", ")
                            : "") ||
                          person.className ||
                          person.email ||
                          (type === "teacher" ? "Faculty" : "Parent account")}
                      </small>
                    </div>
                  </span>
                  <div className="people-row-actions">
                    <strong>
                      {person.phone ||
                        (person.attendance != null
                          ? `${person.attendance}% attendance`
                          : "")}
                    </strong>
                  </div>
                  <span className="pill success">Active</span>
                  <ChevronRight size={15} />
                </div>
              ))}
            </div>
          ) : (
            <div className="people-state">
              No {heading.toLowerCase()} found.
            </div>
          )}
        </Card>
      )}

      {modalOpen && (
        <div className="user-modal-backdrop" onMouseDown={closeModal}>
          <div
            className="user-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="user-modal-head">
              <div>
                <span className="eyebrow">NEW ACCOUNT</span>
                <h3>Add {type}</h3>
                <p>Create login credentials and academic details.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit}>
              <label>
                Full name
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder={
                    type === "student"
                      ? "Student name"
                      : type === "teacher"
                        ? "Teacher name"
                        : "Parent name"
                  }
                  required
                />
              </label>
              <label>
                Email address
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="name@example.com"
                  required
                />
              </label>
              <label>
                Temporary password
                <input
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                  placeholder="At least 8 characters"
                  required
                />
              </label>
              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="Optional"
                />
              </label>

              {type === "student" && (
                <label>
                  Class and division
                  <select value={form.classDivisionId} onChange={event=>setForm({...form,classDivisionId:event.target.value})} required>
                    <option value="">Choose class / division</option>
                    {classDivisions.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}
                  </select>
                  {!classDivisions.length&&<small>Set up classes first from the Class Structure tab.</small>}
                </label>
              )}

              {type === "student" && (
                <fieldset className="parent-login-section">
                  <legend>Parent / Guardian login</legend>
                  <p>Enter the parent Gmail. If this parent already has an account for another child, use the same Gmail; the existing account will be linked automatically.</p>
                  <label>Parent full name
                    <input value={form.parentName} onChange={event=>setForm({...form,parentName:event.target.value})} placeholder="Parent name" required />
                  </label>
                  <label>Parent Gmail
                    <input type="email" value={form.parentEmail} onChange={event=>{setForm({...form,parentEmail:event.target.value});setParentMatch(null)}} onBlur={lookupParent} placeholder="parent@gmail.com" required />
                  </label>
                  {parentLookupLoading && <small>Checking for an existing parent account...</small>}
                  {parentMatch && <div className="profile-message success">Existing parent found: {parentMatch.name} ({parentMatch.email}). This student will be linked to this account; no new password is needed.</div>}
                  {!parentMatch && <label>Temporary parent password
                    <input type="password" minLength={8} value={form.parentPassword} onChange={event=>setForm({...form,parentPassword:event.target.value})} placeholder="Required for a new parent account" />
                  </label>}
                  <label>Parent phone
                    <input value={form.parentPhone} onChange={event=>setForm({...form,parentPhone:event.target.value})} placeholder="Optional" />
                  </label>
                  {!parentMatch && <small>If the Gmail already belongs to a parent, the system will reuse that account and preserve its password. If no account exists, enter a temporary password.</small>}
                </fieldset>
              )}

              {type === "parent" && (
                <fieldset className="teacher-assignment-field">
                  <legend>Link children (optional)</legend>
                  <p>Select the students linked to this parent account.</p>
                  <div className="teacher-assignment-options">
                    {availableStudents.map((student) => (
                      <label key={student.id}>
                        <input
                          type="checkbox"
                          checked={form.childIds.includes(student.id)}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              childIds: current.childIds.includes(student.id)
                                ? current.childIds.filter(
                                    (id) => id !== student.id,
                                  )
                                : [...current.childIds, student.id],
                            }))
                          }
                        />
                        {student.name} · Class {student.std || "—"}
                        {student.division ? " - " + student.division : ""}
                      </label>
                    ))}
                    {!availableStudents.length && (
                      <small>No student accounts loaded yet.</small>
                    )}
                  </div>
                </fieldset>
              )}

              {type === "teacher" && (
                <fieldset className="teacher-assignment-field">
                  <legend>Assign teaching classes</legend>
                  <p>Select every class this teacher will teach.</p>
                  <div className="teacher-assignment-options">
                    {classDivisions.filter(item=>item.active).map(option => (
                      <label key={option.id}>
                        <input type="checkbox" checked={form.teachingClassDivisionIds.includes(option.id)} onChange={() => toggleClass(option.id)} />
                        {option.displayName}
                      </label>
                    ))}
                  </div>
                  {!form.teachingClassDivisionIds.length && (
                    <small>Choose one or more configured class divisions.</small>
                  )}
                </fieldset>
              )}

              {error && (
                <div className="login-error user-modal-error">{error}</div>
              )}
              <div className="user-modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={
                    saving ||
                    (type === "teacher" && !form.teachingClassDivisionIds.length) ||
                    (type === "student" && (!form.parentName.trim() || !form.parentEmail.trim()))
                  }
                >
                  {saving && <LoaderCircle size={15} className="spin" />}
                  {saving ? "Creating..." : `Create ${type}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
