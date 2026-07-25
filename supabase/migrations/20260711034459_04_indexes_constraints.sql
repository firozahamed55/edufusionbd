-- ===== Tenant-scoped natural-key uniqueness (soft-delete aware) =====
create unique index uq_academic_year_label on academic_year (institution_id, year_label) where deleted_at is null;
create unique index uq_student_code on student (institution_id, student_code) where deleted_at is null and student_code is not null;
create unique index uq_teacher_code on teacher (institution_id, employee_code) where deleted_at is null and employee_code is not null;
create unique index uq_enrollment_year on student_enrollment (student_id, academic_year_id) where deleted_at is null;
create unique index uq_enrollment_roll on student_enrollment (class_section_id, roll_no) where deleted_at is null and roll_no is not null;
create unique index uq_class_section on class_section (institution_id, class_id, section_id, coalesce(shift_id,'00000000-0000-0000-0000-000000000000'::uuid), academic_year_id) where deleted_at is null;
create unique index uq_guardian_nid on guardian (institution_id, nid) where nid is not null and deleted_at is null;
create unique index uq_testimonial_certno on testimonial (institution_id, cert_no) where cert_no is not null;
create unique index uq_transfer_certno on transfer_certificate (institution_id, cert_no) where cert_no is not null;

-- ===== "Exactly one" partial-unique flags (M3) =====
create unique index uq_year_current on academic_year (institution_id) where is_current;
create unique index uq_term_current on academic_term (academic_year_id) where is_current;
create unique index uq_grade_scheme_default on grade_scheme (institution_id) where is_default;
create unique index uq_cert_template_default on certificate_template (institution_id, type) where is_default;
create unique index uq_primary_guardian on student_guardian (student_id) where is_primary_contact;

-- ===== institution_id indexes (leftmost in every RLS predicate) =====
create index ix_profile_institution on profile (institution_id);
create index ix_teacher_institution on teacher (institution_id);
create index ix_student_institution on student (institution_id);
create index ix_enrollment_institution on student_enrollment (institution_id);
create index ix_guardian_institution on guardian (institution_id);
create index ix_class_section_institution on class_section (institution_id);
create index ix_exam_institution on exam (institution_id);
create index ix_mark_institution on mark (institution_id);
create index ix_exam_result_institution on exam_result (institution_id);
create index ix_attendance_institution on attendance (institution_id);
create index ix_fee_invoice_institution on fee_invoice (institution_id);
create index ix_fee_payment_institution on fee_payment (institution_id);
create index ix_ledger_institution on ledger_entry (institution_id);
create index ix_sms_campaign_institution on sms_campaign (institution_id);
create index ix_notice_institution on notice (institution_id);
create index ix_audit_institution on audit_log (institution_id);

-- ===== Foreign-key indexes (Postgres does not auto-create these) =====
create index ix_enrollment_student on student_enrollment (student_id);
create index ix_enrollment_class_section on student_enrollment (class_section_id);
create index ix_enrollment_year on student_enrollment (academic_year_id);
create index ix_student_guardian_guardian on student_guardian (guardian_id);
create index ix_student_category on student (student_category_id);
create index ix_student_address_student on student_address (student_id);
create index ix_student_document_student on student_document (student_id);
create index ix_teacher_assignment_teacher on teacher_assignment (teacher_id);
create index ix_teacher_assignment_cs on teacher_assignment (class_section_id);
create index ix_teacher_assignment_subject on teacher_assignment (subject_id);
create index ix_timetable_cs on timetable_period (class_section_id);
create index ix_timetable_teacher on timetable_period (teacher_id);
create index ix_class_section_teacher on class_section (class_teacher_id);
create index ix_class_section_year on class_section (academic_year_id);
create index ix_exam_subject_exam on exam_subject (exam_id);
create index ix_exam_subject_subject on exam_subject (subject_id);
create index ix_mark_student on mark (student_id);
create index ix_exam_result_student on exam_result (student_id);
create index ix_fee_invoice_line_invoice on fee_invoice_line (fee_invoice_id);
create index ix_fee_payment_invoice on fee_payment (fee_invoice_id);
create index ix_fee_mapping_class on fee_mapping (class_id);
create index ix_ledger_account on ledger_entry (account_id);
create index ix_sms_recipient_campaign on sms_recipient (sms_campaign_id);
create index ix_notice_attachment_notice on notice_attachment (notice_id);

-- ===== Composite / covering indexes for hot query paths =====
create index ix_attendance_cs_date on attendance (institution_id, class_section_id, att_date);
create index ix_attendance_student_date on attendance (institution_id, student_id, att_date);
create index ix_fee_invoice_status on fee_invoice (institution_id, status, due_date);
create index ix_fee_invoice_student on fee_invoice (institution_id, student_id);
create index ix_exam_result_rank on exam_result (exam_id, merit_rank);
create index ix_enrollment_cs_status on student_enrollment (institution_id, class_section_id, status);
create index ix_sms_recipient_status on sms_recipient (sms_campaign_id, status);
create index ix_notice_status on notice (institution_id, status, event_date);
create index ix_ledger_date on ledger_entry (institution_id, entry_date, account_id);
create index ix_notification_unread on notification (profile_id, is_read, at);

-- ===== Trigram indexes for name search =====
create index ix_student_name_trgm on student using gin (name_en gin_trgm_ops);
create index ix_teacher_name_trgm on teacher using gin (name_en gin_trgm_ops);
