-- ===== Bilingual enum labels (H7: token stored, label rendered) =====
insert into enum_label (enum_type, token, label_bn, label_en) values
  ('gender','male','পুরুষ','Male'),('gender','female','মহিলা','Female'),('gender','other','অন্যান্য','Other'),
  ('religion','islam','ইসলাম','Islam'),('religion','hindu','হিন্দু','Hindu'),('religion','christian','খ্রিষ্টান','Christian'),('religion','buddhist','বৌদ্ধ','Buddhist'),('religion','other','অন্যান্য','Other'),
  ('student_status','active','সক্রিয়','Active'),('student_status','inactive','নিষ্ক্রিয়','Inactive'),('student_status','transferred','স্থানান্তরিত','Transferred'),('student_status','graduated','গ্র্যাজুয়েট','Graduated'),
  ('teacher_status','active','কর্মরত','Active'),('teacher_status','on_leave','ছুটিতে','On Leave'),('teacher_status','separated','অব্যাহতি','Separated'),
  ('attendance_status','present','উপস্থিত','Present'),('attendance_status','absent','অনুপস্থিত','Absent'),('attendance_status','late','দেরি','Late'),('attendance_status','leave','ছুটি','Leave'),('attendance_status','exam_absent','পরীক্ষায় অনুপস্থিত','Exam Absent'),
  ('fee_status','paid','পরিশোধিত','Paid'),('fee_status','due','বকেয়া','Due'),('fee_status','partial','আংশিক','Partial'),('fee_status','void','বাতিল','Void'),
  ('payment_method','cash','নগদ','Cash'),('payment_method','bkash','বিকাশ','bKash'),('payment_method','nagad','নগদ','Nagad'),('payment_method','rocket','রকেট','Rocket'),('payment_method','card','কার্ড','Card'),
  ('notice_status','published','প্রকাশিত','Published'),('notice_status','scheduled','নির্ধারিত','Scheduled'),('notice_status','urgent','জরুরি','Urgent'),('notice_status','draft','খসড়া','Draft');

-- ===== Bangladesh divisions =====
insert into division (name_bn, name_en) values
  ('ঢাকা','Dhaka'),('চট্টগ্রাম','Chattogram'),('রাজশাহী','Rajshahi'),('খুলনা','Khulna'),
  ('বরিশাল','Barishal'),('সিলেট','Sylhet'),('রংপুর','Rangpur'),('ময়মনসিংহ','Mymensingh');

-- ===== Education boards =====
insert into education_board (name, short_name) values
  ('Dhaka Education Board','Dhaka'),('Chattogram Education Board','Chattogram'),
  ('Rajshahi Education Board','Rajshahi'),('Khulna Education Board','Khulna'),
  ('Bangladesh Madrasah Education Board','Madrasah'),
  ('Bangladesh Technical Education Board','Technical');

-- ===== SaaS plans =====
insert into plan (code, name, price_monthly, max_students, features, is_active) values
  ('starter','Starter',0,300,'{"sms":false,"reports":"basic"}',true),
  ('standard','Standard',2500,1500,'{"sms":true,"reports":"advanced"}',true),
  ('premium','Premium',6000,null,'{"sms":true,"reports":"advanced","digital_fee":true}',true);

-- ===== Global permission catalog =====
insert into permission (code, label, module) values
  ('dashboard.view','View Dashboard','dashboard'),
  ('student.view','View Students','student'),('student.create','Create Student','student'),('student.update','Update Student','student'),('student.delete','Delete Student','student'),('student.migrate','Migrate Students','student'),
  ('teacher.view','View Teachers','teacher'),('teacher.create','Create Teacher','teacher'),('teacher.update','Update Teacher','teacher'),('teacher.delete','Delete Teacher','teacher'),
  ('attendance.view','View Attendance','attendance'),('attendance.mark','Mark Attendance','attendance'),
  ('exam.view','View Exams','exam'),('exam.manage','Manage Exams','exam'),('exam.mark_entry','Enter Marks','exam'),('exam.result_process','Process Results','exam'),('exam.result_publish','Publish Results','exam'),
  ('fee.view','View Fees','fee'),('fee.collect','Collect Fees','fee'),('fee.void','Void Fees','fee'),('fee.mapping','Manage Fee Mapping','fee'),
  ('certificate.view','View Certificates','certificate'),('certificate.generate','Generate Certificates','certificate'),
  ('sms.view','View SMS','sms'),('sms.send','Send SMS','sms'),('notice.manage','Manage Notices','sms'),
  ('core.settings','Manage Settings','core'),('core.user_manage','Manage Users','core');
