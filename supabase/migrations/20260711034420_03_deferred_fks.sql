-- Circular / late-bound foreign keys (all nullable, ON DELETE SET NULL)
alter table institution
  add constraint institution_head_teacher_fk
  foreign key (head_teacher_id) references teacher(id) on delete set null,
  add constraint institution_logo_file_fk
  foreign key (logo_file_id) references file_object(id) on delete set null;

alter table profile
  add constraint profile_linked_teacher_fk
  foreign key (linked_teacher_id) references teacher(id) on delete set null,
  add constraint profile_linked_student_fk
  foreign key (linked_student_id) references student(id) on delete set null,
  add constraint profile_linked_guardian_fk
  foreign key (linked_guardian_id) references guardian(id) on delete set null,
  add constraint profile_avatar_file_fk
  foreign key (avatar_file_id) references file_object(id) on delete set null;

alter table student
  add constraint student_current_enrollment_fk
  foreign key (current_enrollment_id) references student_enrollment(id) on delete set null;
