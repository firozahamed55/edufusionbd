-- ============================================================
-- EduFusionBD v2.0 — Migration 02: Core tables
-- ============================================================
-- Conventions: uuid PK gen_random_uuid(); timestamptz; institution_id on
-- every tenant table; soft-delete on master data; money numeric(12,2).

-- ---------- A. GLOBAL REFERENCE ----------
create table education_board (
  id uuid primary key default gen_random_uuid(),
  name text not null, short_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table division (
  id uuid primary key default gen_random_uuid(),
  name_bn text not null, name_en text not null,
  created_at timestamptz not null default now()
);
create table district (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references division(id) on delete restrict,
  name_bn text not null, name_en text not null,
  created_at timestamptz not null default now()
);
create table upazila (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references district(id) on delete restrict,
  name_bn text not null, name_en text not null,
  created_at timestamptz not null default now()
);
create table plan (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null,
  price_monthly numeric(12,2) not null default 0 check (price_monthly >= 0),
  max_students int, features jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table permission (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, label text not null, module text not null
);
create table enum_label (
  id uuid primary key default gen_random_uuid(),
  enum_type text not null, token text not null,
  label_bn text not null, label_en text not null,
  unique (enum_type, token)
);
create table sms_package (
  id uuid primary key default gen_random_uuid(),
  name text not null, sms_qty int not null check (sms_qty >= 0),
  rate numeric(12,4) not null default 0, price numeric(12,2) not null default 0,
  masking boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- B. TENANCY + IDENTITY ----------
create table institution (
  id uuid primary key default gen_random_uuid(),
  name_bn text not null, name_en text not null,
  eiin text unique, board_id uuid references education_board(id) on delete set null,
  institution_type text, address text, phone text, email text, website text,
  logo_file_id uuid, established_year int,
  head_teacher_id uuid,  -- deferred FK -> teacher (added in migration 07)
  status text not null default 'trial' check (status in ('active','suspended','trial')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table subscription (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  plan_id uuid not null references plan(id) on delete restrict,
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled')),
  current_period_start date, current_period_end date, seats int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table profile (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references institution(id) on delete restrict,
  full_name text, phone text, avatar_file_id uuid,
  status text not null default 'invited' check (status in ('active','suspended','invited')),
  is_platform_admin boolean not null default false,
  linked_teacher_id uuid, linked_student_id uuid, linked_guardian_id uuid,  -- deferred FKs
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table role (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institution(id) on delete cascade,
  code text not null, name text not null, description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create table role_permission (
  role_id uuid not null references role(id) on delete cascade,
  permission_id uuid not null references permission(id) on delete cascade,
  primary key (role_id, permission_id)
);
create table user_role (
  profile_id uuid not null references profile(id) on delete cascade,
  role_id uuid not null references role(id) on delete cascade,
  institution_id uuid references institution(id) on delete cascade,
  primary key (profile_id, role_id)
);
create table access_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institution(id) on delete set null,
  profile_id uuid references profile(id) on delete set null,
  action text, ip inet, user_agent text, at timestamptz not null default now()
);
create table file_object (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  bucket text not null, path text not null, mime text, size_bytes bigint,
  checksum text, entity text, entity_id uuid,
  uploaded_by uuid references profile(id) on delete set null,
  created_at timestamptz not null default now()
);
create table institution_head (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null, designation text,
  signature_file_id uuid references file_object(id) on delete set null,
  created_at timestamptz not null default now()
);
create table signature (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  role_label text not null, holder_name text,
  image_file_id uuid references file_object(id) on delete set null,
  created_at timestamptz not null default now()
);
create table setting (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  key text not null, value jsonb not null default '{}', scope text not null default 'global',
  updated_at timestamptz not null default now(),
  unique (institution_id, key, scope)
);

-- ---------- C. TENANT REFERENCE + ACADEMIC ----------
create table designation (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null, rank int, deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table department (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null, deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table student_category (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null,
  discount_type text not null default 'none' check (discount_type in ('percent','fixed','none')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  basis text not null default 'general' check (basis in ('general','staff_child','sibling','transport')),
  deleted_at timestamptz, created_at timestamptz not null default now()
);
create table academic_year (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  year_label text not null, start_date date, end_date date,
  is_current boolean not null default false, deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create table academic_term (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  academic_year_id uuid not null references academic_year(id) on delete cascade,
  name_bn text, name_en text not null, start_date date, end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create table grade_scheme (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null, is_default boolean not null default false, deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table grade_scale (
  id uuid primary key default gen_random_uuid(),
  grade_scheme_id uuid not null references grade_scheme(id) on delete cascade,
  grade_letter text not null, gpa_point numeric(3,2) not null,
  min_marks numeric(6,2) not null, max_marks numeric(6,2) not null,
  check (min_marks <= max_marks)
);
create table class (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name_bn text not null, name_en text not null, numeric_level int,
  grade_scheme_id uuid references grade_scheme(id) on delete set null,
  deleted_at timestamptz, created_at timestamptz not null default now()
);
create table section (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null, deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table shift (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null, deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table subject (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name_bn text not null, name_en text not null, code text,
  type text not null default 'compulsory' check (type in ('compulsory','optional')),
  full_marks numeric(6,2), pass_marks numeric(6,2),
  deleted_at timestamptz, created_at timestamptz not null default now()
);
create table subject_group (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null, created_at timestamptz not null default now()
);
create table subject_group_member (
  subject_group_id uuid not null references subject_group(id) on delete cascade,
  subject_id uuid not null references subject(id) on delete cascade,
  primary key (subject_group_id, subject_id)
);
create table class_subject (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  class_id uuid not null references class(id) on delete cascade,
  subject_id uuid not null references subject(id) on delete restrict,
  is_optional boolean not null default false,
  full_marks numeric(6,2), pass_marks numeric(6,2),
  unique (class_id, subject_id)
);
create table fee_head (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null,
  category text not null check (category in ('tuition','exam','transport','session','admission')),
  is_recurring boolean not null default false, deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table financial_account (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null, type text not null check (type in ('cash','bank','mfs')),
  opening_balance numeric(12,2) not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- D. PEOPLE ----------
create table teacher (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  employee_code text, name_bn text not null, name_en text not null,
  dob date check (dob is null or dob < current_date), gender gender,
  blood_group blood_group, religion religion, nid text, nationality text default 'বাংলাদেশি',
  designation_id uuid references designation(id) on delete set null,
  department_id uuid references department(id) on delete set null,
  main_subject_id uuid references subject(id) on delete set null,
  joining_date date, employment_type employment_type,
  email text, mobile text, alt_mobile text,
  emergency_contact_name text, emergency_contact_relation text, emergency_contact_number text,
  highest_degree text, experience_years int, photo_file_id uuid references file_object(id) on delete set null,
  status text not null default 'active' check (status in ('active','on_leave','separated')),
  metadata jsonb not null default '{}',
  created_by uuid references profile(id) on delete set null,
  updated_by uuid references profile(id) on delete set null,
  deleted_at timestamptz, deleted_by uuid references profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table class_section (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  class_id uuid not null references class(id) on delete restrict,
  section_id uuid not null references section(id) on delete restrict,
  shift_id uuid references shift(id) on delete set null,
  academic_year_id uuid not null references academic_year(id) on delete restrict,
  room_no text, capacity int,
  class_teacher_id uuid references teacher(id) on delete set null,
  deleted_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table teacher_address (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teacher(id) on delete cascade,
  type text not null check (type in ('present','permanent')),
  division_id uuid references division(id) on delete set null,
  district_id uuid references district(id) on delete set null,
  upazila_id uuid references upazila(id) on delete set null,
  village text, house_road text,
  unique (teacher_id, type)
);
create table teacher_document (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teacher(id) on delete cascade,
  type text not null, file_id uuid references file_object(id) on delete set null,
  created_at timestamptz not null default now()
);
create table teacher_assignment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  teacher_id uuid not null references teacher(id) on delete cascade,
  class_section_id uuid not null references class_section(id) on delete cascade,
  subject_id uuid not null references subject(id) on delete restrict,
  unique (class_section_id, subject_id, teacher_id)
);
create table timetable_period (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  class_section_id uuid not null references class_section(id) on delete cascade,
  academic_year_id uuid references academic_year(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  period_no int not null, subject_id uuid references subject(id) on delete set null,
  teacher_id uuid references teacher(id) on delete set null,
  start_time time, end_time time, room_no text,
  unique (class_section_id, day_of_week, period_no),
  check (start_time is null or end_time is null or start_time < end_time)
);
create table student (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  student_code text, name_bn text not null, name_en text not null,
  dob date not null check (dob < current_date), gender gender not null,
  blood_group blood_group, religion religion, birth_reg_no varchar(17),
  nationality text default 'বাংলাদেশি', photo_file_id uuid references file_object(id) on delete set null,
  student_category_id uuid references student_category(id) on delete set null,
  current_enrollment_id uuid,  -- deferred FK -> student_enrollment
  admission_date date,
  status text not null default 'active' check (status in ('active','inactive','transferred','graduated')),
  metadata jsonb not null default '{}',
  created_by uuid references profile(id) on delete set null,
  updated_by uuid references profile(id) on delete set null,
  deleted_at timestamptz, deleted_by uuid references profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table student_enrollment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  student_id uuid not null references student(id) on delete cascade,
  academic_year_id uuid not null references academic_year(id) on delete restrict,
  class_section_id uuid not null references class_section(id) on delete restrict,
  roll_no int,
  status text not null default 'active' check (status in ('active','promoted','transferred','dropped')),
  promoted_from_id uuid references student_enrollment(id) on delete set null,
  deleted_at timestamptz, created_at timestamptz not null default now()
);
create table guardian (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null, nid text, occupation text, mobile text, alt_mobile text,
  monthly_income numeric(12,2) check (monthly_income is null or monthly_income >= 0),
  metadata jsonb not null default '{}', deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table student_guardian (
  student_id uuid not null references student(id) on delete cascade,
  guardian_id uuid not null references guardian(id) on delete cascade,
  relationship text not null check (relationship in ('father','mother','other')),
  is_primary_contact boolean not null default false,
  primary key (student_id, guardian_id)
);
create table student_address (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id) on delete cascade,
  type text not null check (type in ('present','permanent')),
  division_id uuid references division(id) on delete set null,
  district_id uuid references district(id) on delete set null,
  upazila_id uuid references upazila(id) on delete set null,
  village text, house_road text,
  unique (student_id, type)
);
create table student_document (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id) on delete cascade,
  type text not null, file_id uuid references file_object(id) on delete set null,
  created_at timestamptz not null default now()
);
create table migration_batch (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  academic_year_id uuid not null references academic_year(id) on delete restrict,
  source_class_section_id uuid references class_section(id) on delete set null,
  target_class_section_id uuid references class_section(id) on delete set null,
  type text not null default 'merit' check (type in ('merit','no_merit')),
  status text not null default 'draft' check (status in ('draft','completed','reverted')),
  created_by uuid references profile(id) on delete set null,
  created_at timestamptz not null default now()
);
create table migration_student (
  id uuid primary key default gen_random_uuid(),
  migration_batch_id uuid not null references migration_batch(id) on delete cascade,
  student_id uuid not null references student(id) on delete cascade,
  source_enrollment_id uuid references student_enrollment(id) on delete set null,
  target_enrollment_id uuid references student_enrollment(id) on delete set null,
  old_roll int, new_roll int, merit_rank int,
  result text check (result in ('pass','fail'))
);

-- ---------- E. EXAM ----------
create table exam (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null, academic_year_id uuid not null references academic_year(id) on delete restrict,
  academic_term_id uuid references academic_term(id) on delete set null,
  type text check (type in ('semester','term','model')),
  grade_scheme_id uuid references grade_scheme(id) on delete set null,
  start_date date, end_date date,
  status text not null default 'setup' check (status in ('setup','running','locked','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create table exam_subject (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exam(id) on delete cascade,
  class_id uuid not null references class(id) on delete restrict,
  subject_id uuid not null references subject(id) on delete restrict,
  full_marks numeric(6,2), pass_marks numeric(6,2),
  exam_date date, start_time time, duration int,
  unique (exam_id, class_id, subject_id)
);
create table mark (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  exam_subject_id uuid not null references exam_subject(id) on delete cascade,
  student_id uuid not null references student(id) on delete cascade,
  marks_obtained numeric(6,2) check (marks_obtained is null or marks_obtained >= 0),
  is_absent boolean not null default false,
  entered_by uuid references profile(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_subject_id, student_id)
);
create table exam_result (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  exam_id uuid not null references exam(id) on delete cascade,
  student_id uuid not null references student(id) on delete cascade,
  total_marks numeric(8,2), gpa numeric(3,2) check (gpa is null or (gpa >= 0 and gpa <= 5)),
  grade text, merit_rank int, result text check (result in ('pass','fail')),
  status text not null default 'draft' check (status in ('draft','processed','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id)
);
create table result_approval (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exam(id) on delete cascade,
  approved_by uuid references profile(id) on delete set null,
  approved_at timestamptz, status text,
  unique (exam_id)
);
create table marksheet_config (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  exam_id uuid references exam(id) on delete cascade,
  class_id uuid references class(id) on delete cascade,
  config jsonb not null default '{}'
);
create table mark_config (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  config jsonb not null default '{}'
);
create table comment_config (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  config jsonb not null default '{}'
);
create table exam_date_config (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  exam_id uuid references exam(id) on delete cascade, config jsonb not null default '{}'
);
create table result_sheet_export (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  exam_id uuid not null references exam(id) on delete cascade,
  class_id uuid references class(id) on delete set null,
  section_id uuid references section(id) on delete set null,
  format text check (format in ('pdf','excel')),
  generated_by uuid references profile(id) on delete set null,
  file_id uuid references file_object(id) on delete set null,
  at timestamptz not null default now()
);

-- ---------- F. ATTENDANCE ----------
create table academic_calendar (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  cal_date date not null, is_working_day boolean not null default true, holiday_label text,
  unique (institution_id, cal_date)
);
create table attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  student_id uuid not null references student(id) on delete cascade,
  class_section_id uuid not null references class_section(id) on delete restrict,
  att_date date not null, context attendance_context not null default 'daily',
  exam_id uuid references exam(id) on delete cascade,
  exam_key uuid generated always as (coalesce(exam_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  status attendance_status not null,
  marked_by uuid references profile(id) on delete set null,
  guardian_sms_sent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (student_id, att_date, context, exam_key)
);

-- ---------- G. FEE & FINANCE ----------
create table fee_mapping (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  class_id uuid not null references class(id) on delete cascade,
  fee_head_id uuid not null references fee_head(id) on delete restrict,
  student_category_id uuid references student_category(id) on delete set null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  frequency text not null check (frequency in ('monthly','one_time','exam','session','admission')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table fee_invoice (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  student_id uuid not null references student(id) on delete restrict,
  academic_year_id uuid not null references academic_year(id) on delete restrict,
  academic_term_id uuid references academic_term(id) on delete set null,
  period text, total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  waiver_amount numeric(12,2) not null default 0 check (waiver_amount >= 0),
  due_amount numeric(12,2) generated always as (total_amount - paid_amount - waiver_amount) stored,
  status text not null default 'due' check (status in ('paid','due','partial','void')),
  due_date date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid_amount + waiver_amount <= total_amount)
);
create table fee_invoice_line (
  id uuid primary key default gen_random_uuid(),
  fee_invoice_id uuid not null references fee_invoice(id) on delete cascade,
  fee_head_id uuid not null references fee_head(id) on delete restrict,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  waiver numeric(12,2) not null default 0 check (waiver >= 0)
);
create table fee_payment (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  fee_invoice_id uuid not null references fee_invoice(id) on delete cascade,
  student_id uuid references student(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  method text not null check (method in ('cash','bkash','nagad','rocket','card')),
  account_id uuid references financial_account(id) on delete set null,
  txn_ref text, paid_by text, received_by uuid references profile(id) on delete set null,
  paid_at timestamptz not null default now(), sms_sent boolean not null default false
);
create table digital_transaction (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  gateway text not null check (gateway in ('bkash','nagad','rocket','card')),
  gateway_txn_id text, student_id uuid references student(id) on delete set null,
  fee_invoice_id uuid references fee_invoice(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('success','pending','failed')),
  at timestamptz not null default now(),
  unique (institution_id, gateway, gateway_txn_id)
);
create table ledger_entry (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  account_id uuid references financial_account(id) on delete set null,
  entry_date date not null default current_date, direction ledger_direction not null,
  amount numeric(12,2) not null check (amount >= 0),
  source_type text, source_id uuid, head text, note text,
  created_at timestamptz not null default now()
);

-- ---------- H. COMMUNICATIONS ----------
create table sms_provider_account (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  provider text not null, sender_id text, masking_enabled boolean not null default false,
  credentials_ref text, created_at timestamptz not null default now()
);
create table sms_account (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  balance numeric(12,2) not null default 0, per_sms_rate numeric(12,4) not null default 0,
  masking_enabled boolean not null default false,
  last_recharge_amount numeric(12,2), last_recharge_at timestamptz,
  unique (institution_id)
);
create table sms_transaction (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  sms_account_id uuid not null references sms_account(id) on delete cascade,
  sms_package_id uuid references sms_package(id) on delete set null,
  amount numeric(12,2) not null default 0, sms_added int not null default 0,
  at timestamptz not null default now()
);
create table sms_template (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name text not null, description text, body text not null,
  category text check (category in ('result','routine','fee_reminder','attendance','holiday','admission')),
  usage_count int not null default 0, deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table sms_campaign (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  recipient_type text check (recipient_type in ('student','parent','teacher')),
  recipient_group text, language app_language default 'bn',
  template_id uuid references sms_template(id) on delete set null,
  body text, segment_count int, recipient_count int, est_cost numeric(12,2),
  sent_by uuid references profile(id) on delete set null, sent_at timestamptz,
  created_at timestamptz not null default now()
);
create table sms_recipient (
  id uuid primary key default gen_random_uuid(),
  sms_campaign_id uuid not null references sms_campaign(id) on delete cascade,
  recipient_msisdn text not null, student_id uuid references student(id) on delete set null,
  profile_id uuid references profile(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed')),
  provider_msg_id text, cost numeric(12,4), delivered_at timestamptz, error_code text
);
create table notice (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  title text not null, body text,
  audience text check (audience in ('all_parents','class_wise','all_students')),
  event_date date, date_range daterange,
  status text not null default 'draft' check (status in ('published','scheduled','urgent','draft')),
  is_archived boolean not null default false,
  created_by uuid references profile(id) on delete set null,
  created_at timestamptz not null default now()
);
create table notice_attachment (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references notice(id) on delete cascade,
  file_id uuid references file_object(id) on delete set null
);

-- ---------- I. CERTIFICATES ----------
create table certificate_template (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  type text not null check (type in ('marksheet','admit','id','testimonial','transfer')),
  format_config jsonb not null default '{}', is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create table id_card_batch (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  class_id uuid references class(id) on delete set null,
  section_id uuid references section(id) on delete set null,
  roll_from int, roll_to int, template text, class_color text, valid_till date,
  includes jsonb not null default '{}', created_at timestamptz not null default now()
);
create table admit_card_batch (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  exam_id uuid references exam(id) on delete cascade,
  class_id uuid references class(id) on delete set null,
  section_id uuid references section(id) on delete set null,
  roll_from int, roll_to int, center text, issue_date date,
  includes jsonb not null default '{}', created_at timestamptz not null default now()
);
create table admit_card (
  id uuid primary key default gen_random_uuid(),
  admit_card_batch_id uuid not null references admit_card_batch(id) on delete cascade,
  student_id uuid references student(id) on delete set null, seat_no text, center text
);
create table testimonial (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  student_id uuid not null references student(id) on delete restrict,
  session text, conduct text, cert_no text, parent_name text, permanent_address text,
  language app_language default 'bn', remarks text, issued_at timestamptz,
  created_at timestamptz not null default now()
);
create table transfer_certificate (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  student_id uuid not null references student(id) on delete restrict,
  session text, issue_date date, cert_type text, cert_no text,
  parent_name text, permanent_address text, reason text,
  language app_language default 'bn', created_at timestamptz not null default now()
);
create table seat_plan (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  exam_id uuid references exam(id) on delete cascade,
  room_no text, seats_per_room int, arrangement text check (arrangement in ('roll','name')),
  per_bench int
);

-- ---------- J. SYSTEM ----------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institution(id) on delete set null,
  entity text not null, entity_id uuid,
  action text not null, changed_by uuid references profile(id) on delete set null,
  at timestamptz not null default now(), before jsonb, after jsonb
);
create table export_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  profile_id uuid references profile(id) on delete set null,
  kind text, params jsonb, file_id uuid references file_object(id) on delete set null,
  at timestamptz not null default now()
);
create table notification (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institution(id) on delete cascade,
  profile_id uuid not null references profile(id) on delete cascade,
  type text, message text, is_read boolean not null default false,
  at timestamptz not null default now()
);
create table code_sequence (
  institution_id uuid not null references institution(id) on delete cascade,
  entity text not null, next_val bigint not null default 1,
  primary key (institution_id, entity)
);
