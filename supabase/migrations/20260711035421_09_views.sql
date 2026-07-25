-- All views use security_invoker so the querying user's RLS applies (no owner-bypass leak).

create view v_effective_subject_marks with (security_invoker = true) as
select es.id as exam_subject_id, es.exam_id, es.class_id, es.subject_id,
       coalesce(es.full_marks, cs.full_marks, s.full_marks) as full_marks,
       coalesce(es.pass_marks, cs.pass_marks, s.pass_marks) as pass_marks
from exam_subject es
join subject s on s.id = es.subject_id
left join class_subject cs on cs.class_id = es.class_id and cs.subject_id = es.subject_id;

create view v_family_children with (security_invoker = true) as
select sg.guardian_id, count(distinct sg.student_id) as child_count,
       array_agg(distinct sg.student_id) as student_ids
from student_guardian sg
group by sg.guardian_id;

create view v_fee_invoice_balance with (security_invoker = true) as
select fi.id as fee_invoice_id, fi.institution_id, fi.student_id,
       fi.total_amount, fi.paid_amount, fi.waiver_amount, fi.due_amount,
       coalesce((select sum(amount) from fee_invoice_line l where l.fee_invoice_id = fi.id),0) as lines_total,
       coalesce((select sum(amount) from fee_payment p where p.fee_invoice_id = fi.id),0) as payments_total,
       (fi.total_amount = coalesce((select sum(amount) from fee_invoice_line l where l.fee_invoice_id = fi.id),0)) as is_reconciled
from fee_invoice fi;

create view v_attendance_student_summary with (security_invoker = true) as
select institution_id, student_id, class_section_id,
       count(*) filter (where status in ('present','late')) as present_days,
       count(*) as total_days,
       round(100.0 * count(*) filter (where status in ('present','late')) / nullif(count(*),0), 1) as rate_pct
from attendance where context = 'daily'
group by institution_id, student_id, class_section_id;

create view v_attendance_trend with (security_invoker = true) as
select institution_id, class_section_id, date_trunc('week', att_date)::date as week_start,
       count(*) filter (where status in ('present','late')) as present,
       count(*) filter (where status = 'absent') as absent, count(*) as total
from attendance where context = 'daily'
group by institution_id, class_section_id, date_trunc('week', att_date);

create view v_attendance_daily_summary with (security_invoker = true) as
select institution_id, class_section_id, att_date,
       count(*) filter (where status = 'present') as present,
       count(*) filter (where status = 'absent') as absent,
       count(*) filter (where status = 'late') as late,
       count(*) filter (where status = 'leave') as on_leave
from attendance where context = 'daily'
group by institution_id, class_section_id, att_date;

create view v_sms_campaign_summary with (security_invoker = true) as
select c.id as sms_campaign_id, c.institution_id, c.recipient_type, c.sent_at,
       count(r.*) as recipient_count,
       count(r.*) filter (where r.status = 'delivered') as delivered,
       count(r.*) filter (where r.status = 'failed') as failed,
       coalesce(sum(r.cost),0) as total_cost
from sms_campaign c left join sms_recipient r on r.sms_campaign_id = c.id
group by c.id;

create view v_student_demographics with (security_invoker = true) as
select se.institution_id, se.class_section_id, s.gender, s.religion, s.status, count(*) as cnt
from student s join student_enrollment se on se.id = s.current_enrollment_id
group by se.institution_id, se.class_section_id, s.gender, s.religion, s.status;

create view v_dashboard_kpi with (security_invoker = true) as
select i.id as institution_id,
  (select count(*) from student s where s.institution_id = i.id and s.deleted_at is null and s.status = 'active') as active_students,
  (select count(*) from teacher t where t.institution_id = i.id and t.deleted_at is null and t.status = 'active') as active_teachers,
  (select count(*) from class_section cs where cs.institution_id = i.id and cs.deleted_at is null) as class_sections,
  (select coalesce(sum(due_amount),0) from fee_invoice fi where fi.institution_id = i.id and fi.status in ('due','partial')) as total_due,
  (select coalesce(sum(amount),0) from fee_payment fp where fp.institution_id = i.id and fp.paid_at >= date_trunc('month', now())) as collected_this_month
from institution i;

grant select on v_effective_subject_marks, v_family_children, v_fee_invoice_balance,
  v_attendance_student_summary, v_attendance_trend, v_attendance_daily_summary,
  v_sms_campaign_summary, v_student_demographics, v_dashboard_kpi to authenticated;
