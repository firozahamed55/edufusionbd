import { AttendanceMarker } from "../../components/AttendanceMarker";

/** Attendance · Update (Section) — live daily attendance edit (upserts existing marks). */
export function UpdateSectionScreen() {
  return <AttendanceMarker context="daily" />;
}
