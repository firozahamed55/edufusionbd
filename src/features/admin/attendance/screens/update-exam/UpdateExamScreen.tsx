import { AttendanceMarker } from "../../components/AttendanceMarker";

/** Attendance · Update (Exam) — live exam attendance edit (upserts existing marks). */
export function UpdateExamScreen() {
  return <AttendanceMarker context="exam" />;
}
