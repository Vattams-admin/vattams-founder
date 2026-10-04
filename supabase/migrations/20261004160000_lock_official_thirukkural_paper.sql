-- Lock the Thirukkural official competition to the approved 30-question paper.
-- Any older in-progress official attempt using the previous age-randomized paper
-- is closed so the new fixed-paper runtime can start cleanly.

update public.competition_attempts
set
  status = 'submitted',
  submitted_at = coalesce(submitted_at, now()),
  scored_at = coalesce(scored_at, now()),
  updated_at = now()
where course_id = 'DNWt3cPE4ZSJG90CTC1e'
  and status = 'in_progress'
  and question_ids <> jsonb_build_array(
    'TKR-REC-01','TKR-REC-02','TKR-REC-03','TKR-REC-04',
    'TKR-REC-05','TKR-REC-06','TKR-REC-07','TKR-REC-08',
    'TKR-ADH-01','TKR-ADH-02','TKR-ADH-03','TKR-ADH-04',
    'TKR-ADH-05','TKR-ADH-06','TKR-ADH-07',
    'TKR-MEAN-01','TKR-MEAN-02','TKR-MEAN-03','TKR-MEAN-04',
    'TKR-MEAN-05','TKR-MEAN-06','TKR-MEAN-07','TKR-MEAN-08',
    'TKR-KNOW-01','TKR-KNOW-02','TKR-KNOW-03','TKR-KNOW-04',
    'TKR-KNOW-05','TKR-KNOW-06','TKR-KNOW-07'
  );
