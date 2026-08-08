-- ============================================================================
-- `fn_national_holidays` / `fn_import_national_holidays` — audit S-4.8.
--
-- "Every school in Bangladesh will re-enter the same ~22 government holidays by
-- hand, every year. This is the highest-value feature on this screen."
--
-- WHAT IS AND IS NOT IN HERE. Only the FIXED-DATE public holidays — the ones
-- fixed by the Gregorian calendar and the same every year. The lunar Islamic
-- holidays (Eid-ul-Fitr, Eid-ul-Adha, Ashura, Eid-e-Miladunnabi, Shab-e-Barat,
-- Shab-e-Qadr) and the lunisolar Hindu/Buddhist/Christian ones (Durga Puja,
-- Buddha Purnima, Janmashtami) move each year and are announced by the Ministry
-- of Public Administration. Shipping a guess for those would be worse than
-- shipping nothing: a wrong Eid date in the register is exactly the error an
-- inspector notices, and the operator would never think to check a date the
-- product filled in for them.
--
-- So the import seeds what is knowable and the screen says plainly which
-- holidays the operator still has to add. A tool that is honest about its
-- boundary gets used; one that quietly guesses gets distrusted after the first
-- wrong year.
--
-- PREVIEW, THEN APPLY. `fn_national_holidays(year)` is a pure read that returns
-- the candidate rows plus whether each date is already marked, so the screen
-- can show exactly what will change before anything is written.
-- ============================================================================

create or replace function public.fn_national_holidays(p_year int)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  v_inst uuid;
  v_rows jsonb;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();

  with fixed(md, name_bn, name_en) as (
    values
      ('02-21', 'শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস', 'Shaheed Day & International Mother Language Day'),
      ('03-17', 'জাতির পিতার জন্মদিন ও জাতীয় শিশু দিবস', 'Birthday of the Father of the Nation & National Children''s Day'),
      ('03-26', 'স্বাধীনতা ও জাতীয় দিবস', 'Independence and National Day'),
      ('04-14', 'পহেলা বৈশাখ', 'Pahela Baishakh (Bengali New Year)'),
      ('05-01', 'মে দিবস', 'May Day'),
      ('08-15', 'জাতীয় শোক দিবস', 'National Mourning Day'),
      ('12-16', 'বিজয় দিবস', 'Victory Day'),
      ('12-25', 'বড়দিন', 'Christmas Day')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', d,
           'name_bn', f.name_bn,
           'name_en', f.name_en,
           -- So the preview can say "3 of 8 already set" rather than making the
           -- operator guess whether the import will overwrite something.
           'already_marked', exists (
             select 1 from public.academic_calendar c
              where c.institution_id = v_inst and c.cal_date = d and c.is_working_day = false)
         ) order by d), '[]'::jsonb)
    into v_rows
    from fixed f, lateral (select make_date(p_year, split_part(f.md,'-',1)::int, split_part(f.md,'-',2)::int) d) x;

  return jsonb_build_object('year', p_year, 'holidays', v_rows);
end;
$$;

create or replace function public.fn_import_national_holidays(p_year int, p_academic_year_id uuid default null)
returns int language plpgsql security definer set search_path to '' as $$
declare
  v_inst uuid;
  v_row jsonb;
  v_count int := 0;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  for v_row in
    select value from jsonb_array_elements((public.fn_national_holidays(p_year)) -> 'holidays')
  loop
    /*
     * `do update` rather than `do nothing`: re-running the import should repair
     * a date somebody mislabelled, and the government name is the authority for
     * a government holiday. An institution-specific holiday on the same date
     * would be overwritten — which is why the screen previews first.
     */
    insert into public.academic_calendar(institution_id, academic_year_id, cal_date, is_working_day, holiday_label)
    values (v_inst, p_academic_year_id, (v_row->>'date')::date, false, v_row->>'name_en')
    on conflict (institution_id, cal_date) do update
      set is_working_day = false,
          holiday_label = excluded.holiday_label,
          academic_year_id = coalesce(excluded.academic_year_id, public.academic_calendar.academic_year_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.fn_national_holidays(int) to authenticated;
grant execute on function public.fn_import_national_holidays(int, uuid) to authenticated;
