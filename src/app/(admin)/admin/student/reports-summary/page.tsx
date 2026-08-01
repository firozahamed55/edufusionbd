import { permanentRedirect } from "next/navigation";

/**
 * The enrolment report moved into the Reports module (analysis II · R-2, R-5).
 *
 * The route is kept as a permanent redirect rather than deleted. URL
 * preservation is a standing rule of the admin IA work (§8.4), and this
 * particular URL has been the destination of TWO navigation entries — a
 * Students tab and the whole "Insights" zone — so it is the one people have
 * bookmarked and pasted to each other.
 *
 * `permanentRedirect` (308) rather than `redirect` (307): the move is permanent,
 * and a 308 lets a browser stop asking.
 */
export default function Page() {
  permanentRedirect("/admin/reports/enrolment");
}
