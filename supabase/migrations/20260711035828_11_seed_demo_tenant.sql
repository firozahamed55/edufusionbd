do $$
declare
  v_inst uuid; v_year uuid; v_term uuid; v_scheme uuid; v_shift uuid; v_secA uuid; v_secB uuid;
  v_deptSci uuid; v_desigSr uuid; v_catGen uuid; v_acct uuid; v_headTuition uuid; v_headExam uuid;
  v_c6 uuid; v_c7 uuid; v_c8 uuid; v_c9 uuid; v_c10 uuid;
  v_sBangla uuid; v_sEng uuid; v_sMath uuid; v_sSci uuid; v_sRel uuid;
  v_cs6 uuid; v_cs7 uuid; v_cs8 uuid; v_cs9 uuid; v_cs10 uuid;
  v_roleAdmin uuid; v_roleTeacher uuid; v_roleAcct uuid; v_roleExam uuid;
  v_t1 uuid; v_t2 uuid; v_t3 uuid;
  v_stu uuid; v_guard uuid; v_enr uuid; v_inv uuid; v_exam uuid; v_es uuid; v_cs uuid; i int;
  v_names text[] := array['রাকিব হাসান','সাদিয়া আক্তার','তানভীর আহমেদ','নুসরাত জাহান','ইমরান হোসেন','মেহেদী হাসান','ফারিয়া ইসলাম','আরিফুল ইসলাম','সুমাইয়া খাতুন','জুবায়ের রহমান','তাসনিম আরা','রায়হান কবির'];
begin
  insert into institution (name_bn, name_en, eiin, board_id, institution_type, address, phone, email, status)
    values ('ঢাকা আদর্শ উচ্চ বিদ্যালয়','Dhaka Adarsha High School','108234',
            (select id from education_board where short_name='Dhaka' limit 1),'school','মিরপুর, ঢাকা','01711000000','info@dahs.edu.bd','active')
    returning id into v_inst;
  insert into subscription (institution_id, plan_id, status, current_period_start, current_period_end, seats)
    values (v_inst,(select id from plan where code='premium'),'active', current_date, current_date + 365, 2000);
  insert into academic_year (institution_id, year_label, start_date, end_date, is_current)
    values (v_inst,'2026','2026-01-01','2026-12-31', true) returning id into v_year;
  insert into academic_term (institution_id, academic_year_id, name_en, name_bn, is_current)
    values (v_inst, v_year,'Annual','বার্ষিক', true) returning id into v_term;
  insert into grade_scheme (institution_id, name, is_default) values (v_inst,'GPA-5', true) returning id into v_scheme;
  insert into grade_scale (grade_scheme_id, grade_letter, gpa_point, min_marks, max_marks) values
    (v_scheme,'A+',5.00,80,100),(v_scheme,'A',4.00,70,79),(v_scheme,'A-',3.50,60,69),
    (v_scheme,'B',3.00,50,59),(v_scheme,'C',2.00,40,49),(v_scheme,'D',1.00,33,39),(v_scheme,'F',0.00,0,32);
  insert into department (institution_id, name) values (v_inst,'বিজ্ঞান') returning id into v_deptSci;
  insert into designation (institution_id, name, rank) values (v_inst,'সিনিয়র শিক্ষক',1) returning id into v_desigSr;
  insert into shift (institution_id, name) values (v_inst,'দিবা') returning id into v_shift;
  insert into section (institution_id, name) values (v_inst,'ক') returning id into v_secA;
  insert into section (institution_id, name) values (v_inst,'খ') returning id into v_secB;
  insert into student_category (institution_id, name, basis, discount_type, discount_value) values (v_inst,'সাধারণ','general','none',0) returning id into v_catGen;
  insert into financial_account (institution_id, name, type) values (v_inst,'প্রধান নগদ','cash') returning id into v_acct;
  insert into sms_account (institution_id, balance, per_sms_rate, masking_enabled) values (v_inst, 5000, 0.45, true);
  insert into fee_head (institution_id, name, category, is_recurring) values (v_inst,'টিউশন ফি','tuition', true) returning id into v_headTuition;
  insert into fee_head (institution_id, name, category, is_recurring) values (v_inst,'পরীক্ষার ফি','exam', false) returning id into v_headExam;
  insert into class (institution_id, name_bn, name_en, numeric_level, grade_scheme_id) values (v_inst,'৬ষ্ঠ','Class 6',6,v_scheme) returning id into v_c6;
  insert into class (institution_id, name_bn, name_en, numeric_level, grade_scheme_id) values (v_inst,'৭ম','Class 7',7,v_scheme) returning id into v_c7;
  insert into class (institution_id, name_bn, name_en, numeric_level, grade_scheme_id) values (v_inst,'৮ম','Class 8',8,v_scheme) returning id into v_c8;
  insert into class (institution_id, name_bn, name_en, numeric_level, grade_scheme_id) values (v_inst,'৯ম','Class 9',9,v_scheme) returning id into v_c9;
  insert into class (institution_id, name_bn, name_en, numeric_level, grade_scheme_id) values (v_inst,'১০ম','Class 10',10,v_scheme) returning id into v_c10;
  insert into subject (institution_id, name_bn, name_en, code, type, full_marks, pass_marks) values (v_inst,'বাংলা','Bangla','101','compulsory',100,33) returning id into v_sBangla;
  insert into subject (institution_id, name_bn, name_en, code, type, full_marks, pass_marks) values (v_inst,'ইংরেজি','English','107','compulsory',100,33) returning id into v_sEng;
  insert into subject (institution_id, name_bn, name_en, code, type, full_marks, pass_marks) values (v_inst,'গণিত','Mathematics','109','compulsory',100,33) returning id into v_sMath;
  insert into subject (institution_id, name_bn, name_en, code, type, full_marks, pass_marks) values (v_inst,'বিজ্ঞান','Science','127','compulsory',100,33) returning id into v_sSci;
  insert into subject (institution_id, name_bn, name_en, code, type, full_marks, pass_marks) values (v_inst,'ধর্ম','Religion','111','compulsory',100,33) returning id into v_sRel;
  insert into class_subject (institution_id, class_id, subject_id, is_optional)
    select v_inst, c.id, s.id, false
    from (values (v_c6),(v_c7),(v_c8),(v_c9),(v_c10)) c(id)
    cross join (values (v_sBangla),(v_sEng),(v_sMath),(v_sSci),(v_sRel)) s(id);
  insert into class_section (institution_id, class_id, section_id, shift_id, academic_year_id, room_no, capacity) values (v_inst,v_c6,v_secA,v_shift,v_year,'101',50) returning id into v_cs6;
  insert into class_section (institution_id, class_id, section_id, shift_id, academic_year_id, room_no, capacity) values (v_inst,v_c7,v_secA,v_shift,v_year,'102',50) returning id into v_cs7;
  insert into class_section (institution_id, class_id, section_id, shift_id, academic_year_id, room_no, capacity) values (v_inst,v_c8,v_secA,v_shift,v_year,'103',50) returning id into v_cs8;
  insert into class_section (institution_id, class_id, section_id, shift_id, academic_year_id, room_no, capacity) values (v_inst,v_c9,v_secA,v_shift,v_year,'201',50) returning id into v_cs9;
  insert into class_section (institution_id, class_id, section_id, shift_id, academic_year_id, room_no, capacity) values (v_inst,v_c10,v_secA,v_shift,v_year,'202',50) returning id into v_cs10;
  insert into role (institution_id, code, name, is_system) values (v_inst,'institution_admin','Admin', true) returning id into v_roleAdmin;
  insert into role (institution_id, code, name, is_system) values (v_inst,'teacher','Teacher', true) returning id into v_roleTeacher;
  insert into role (institution_id, code, name, is_system) values (v_inst,'accountant','Accountant', true) returning id into v_roleAcct;
  insert into role (institution_id, code, name, is_system) values (v_inst,'exam_controller','Exam Controller', true) returning id into v_roleExam;
  insert into role_permission (role_id, permission_id) select v_roleAdmin, id from permission;
  insert into teacher (institution_id, employee_code, name_bn, name_en, gender, designation_id, department_id, main_subject_id, employment_type, mobile, status)
    values (v_inst,'EMP-0001','মোঃ কামাল উদ্দিন','Md Kamal Uddin','male',v_desigSr,v_deptSci,v_sMath,'permanent','01710000001','active') returning id into v_t1;
  insert into teacher (institution_id, employee_code, name_bn, name_en, gender, designation_id, department_id, main_subject_id, employment_type, mobile, status)
    values (v_inst,'EMP-0002','সালমা বেগম','Salma Begum','female',v_desigSr,v_deptSci,v_sEng,'permanent','01710000002','active') returning id into v_t2;
  insert into teacher (institution_id, employee_code, name_bn, name_en, gender, designation_id, department_id, main_subject_id, employment_type, mobile, status)
    values (v_inst,'EMP-0003','আব্দুর রহিম','Abdur Rahim','male',v_desigSr,v_deptSci,v_sBangla,'permanent','01710000003','active') returning id into v_t3;
  update class_section set class_teacher_id = v_t1 where id = v_cs6;
  update class_section set class_teacher_id = v_t2 where id = v_cs9;
  insert into teacher_assignment (institution_id, teacher_id, class_section_id, subject_id) values
    (v_inst,v_t1,v_cs6,v_sMath),(v_inst,v_t2,v_cs9,v_sEng),(v_inst,v_t3,v_cs6,v_sBangla);
  for i in 1..12 loop
    v_cs := (array[v_cs6,v_cs7,v_cs8,v_cs9,v_cs10])[1 + (i % 5)];
    insert into student (institution_id, student_code, name_bn, name_en, dob, gender, religion, student_category_id, admission_date, status)
      values (v_inst,'STU-'||lpad(i::text,4,'0'), v_names[i], 'Student '||i, date '2012-01-01' + (i*37),
              (case when i%2=0 then 'female' else 'male' end)::gender,'islam', v_catGen, current_date - 200, 'active')
      returning id into v_stu;
    insert into student_enrollment (institution_id, student_id, academic_year_id, class_section_id, roll_no, status)
      values (v_inst, v_stu, v_year, v_cs, i, 'active') returning id into v_enr;
    update student set current_enrollment_id = v_enr where id = v_stu;
    insert into guardian (institution_id, name, nid, occupation, mobile, monthly_income)
      values (v_inst,'অভিভাবক '||i, '199000000000'||lpad(i::text,3,'0'),'ব্যবসা','017115'||lpad(i::text,5,'0'), 30000)
      returning id into v_guard;
    insert into student_guardian (student_id, guardian_id, relationship, is_primary_contact) values (v_stu, v_guard, 'father', true);
    if i <= 6 then
      insert into fee_invoice (institution_id, student_id, academic_year_id, academic_term_id, period, due_date)
        values (v_inst, v_stu, v_year, v_term, '2026-01', current_date + 10) returning id into v_inv;
      insert into fee_invoice_line (fee_invoice_id, fee_head_id, amount) values (v_inv, v_headTuition, 1200);
      insert into fee_invoice_line (fee_invoice_id, fee_head_id, amount) values (v_inv, v_headExam, 300);
      if i % 2 = 0 then
        insert into fee_payment (institution_id, fee_invoice_id, student_id, amount, method, account_id, paid_at)
          values (v_inst, v_inv, v_stu, 1500, 'cash', v_acct, now());
      end if;
    end if;
    insert into attendance (institution_id, student_id, class_section_id, att_date, context, status)
      values (v_inst, v_stu, v_cs, current_date, 'daily', (case when i%4=0 then 'absent' else 'present' end)::attendance_status);
  end loop;
  insert into exam (institution_id, name, academic_year_id, academic_term_id, type, grade_scheme_id, start_date, end_date, status)
    values (v_inst,'অর্ধবার্ষিক পরীক্ষা', v_year, v_term, 'term', v_scheme, current_date - 30, current_date - 20, 'published') returning id into v_exam;
  insert into exam_subject (exam_id, class_id, subject_id, full_marks, pass_marks, exam_date)
    values (v_exam, v_c6, v_sMath, 100, 33, current_date - 30) returning id into v_es;
  insert into mark (institution_id, exam_subject_id, student_id, marks_obtained, status)
    select v_inst, v_es, se.student_id, 40 + (se.roll_no*3 % 55), 'submitted'
    from student_enrollment se where se.class_section_id = v_cs6;
  insert into notice (institution_id, title, body, audience, event_date, status)
    values (v_inst,'বার্ষিক ক্রীড়া প্রতিযোগিতা','আগামী ১৫ তারিখে বার্ষিক ক্রীড়া অনুষ্ঠিত হবে।','all_parents', current_date + 15, 'published');
  raise notice 'Seed complete. institution_id=%', v_inst;
end $$;
