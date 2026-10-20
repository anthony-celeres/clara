-- supabase/seed.sql
-- Initial seed data for CLARA

-- 1. Knowledge Base Topics
insert into public.knowledge_base (kb_id, title, category, version, is_active)
values
  (101, 'RA 9048 Clerical Error Correction', 'Birth', '1.0', true),
  (102, 'Late Registration of Birth', 'Birth', '1.0', true),
  (103, 'Indigenous Peoples Registration (IPRA RA 8371)', 'Birth', '1.0', true),
  (104, 'Marriage Certificates and Registration', 'Marriage', '1.0', true),
  (105, 'Death Certificates and Registration', 'Death', '1.0', true)
on conflict (kb_id) do update
set title = excluded.title,
    category = excluded.category,
    version = excluded.version,
    is_active = excluded.is_active;

-- 2. Civic Guides (Filipino, English, Bisaya)
insert into public.guides (guide_id, kb_id, title, category, steps_json, requirements_json, fees_text, tips, language)
values
  -- Guide 1: RA 9048 Filipino
  (
    1, 101, 'Clerical Error Correction (RA 9048)', 'Birth',
    '[
      {"step_number": 1, "instruction": "Ihanda ang Special Power of Attorney (SPA) kung ikaw ay proxy."},
      {"step_number": 2, "instruction": "Dalhin ang orihinal na PSA Birth Certificate at valid IDs sa LCRO."},
      {"step_number": 3, "instruction": "Magbayad ng filing fee na nagkakahalaga ng ₱1,000."},
      {"step_number": 4, "instruction": "Mag-antay ng 1-3 buwan para sa posting at PSA affirmation period."}
    ]'::jsonb,
    '[
      "Notarized Special Power of Attorney (Original)",
      "Representative''s Valid ID",
      "Owner''s Valid ID",
      "PSA Birth Certificate (Original)",
      "Filing Fee (₱1,000)"
    ]'::jsonb,
    'Filing fee: ₱1,000. Karagdagang local fees at PSA copy fees (~₱155-₱365).',
    'Ang pag-proseso ay tumatagal ng 1 hanggang 3 buwan dahil sa mandatory 10-day posting period.',
    'fil'
  ),
  -- Guide 2: RA 9048 English
  (
    2, 101, 'Clerical Error Correction (RA 9048)', 'Birth',
    '[
      {"step_number": 1, "instruction": "Prepare a Notarized Special Power of Attorney (SPA) if you are filing as a proxy."},
      {"step_number": 2, "instruction": "Bring the original PSA Birth Certificate and valid IDs to the Local Civil Registry Office (LCRO)."},
      {"step_number": 3, "instruction": "Pay the filing fee amounting to ₱1,000."},
      {"step_number": 4, "instruction": "Wait 1 to 3 months for the mandatory posting and PSA affirmation period."}
    ]'::jsonb,
    '[
      "Notarized Special Power of Attorney (Original)",
      "Representative''s Valid ID",
      "Owner''s Valid ID",
      "PSA Birth Certificate (Original)",
      "Filing Fee (₱1,000)"
    ]'::jsonb,
    'Filing fee: ₱1,000. Additional local fees and PSA copy fees (~₱155-₱365).',
    'Processing takes 1 to 3 months due to the mandatory 10-day posting period.',
    'eng'
  ),
  -- Guide 3: RA 9048 Bisaya
  (
    3, 101, 'Clerical Error Correction (RA 9048)', 'Birth',
    '[
      {"step_number": 1, "instruction": "I-andam ang Notarized Special Power of Attorney (SPA) kung ikaw representante lamang."},
      {"step_number": 2, "instruction": "Dad-a ang orihinal nga PSA Birth Certificate ug valid IDs sa LCRO."},
      {"step_number": 3, "instruction": "Magbayad og filing fee nga mobalor og ₱1,000."},
      {"step_number": 4, "instruction": "Hulat og 1 hangtod 3 ka bulan para sa posting ug PSA affirmation period."}
    ]'::jsonb,
    '[
      "Notarized Special Power of Attorney (Original)",
      "Representative''s Valid ID",
      "Owner''s Valid ID",
      "PSA Birth Certificate (Original)",
      "Filing Fee (₱1,000)"
    ]'::jsonb,
    'Filing fee: ₱1,000. Adunay dugang nga local fees ug PSA copy fees (~₱155-₱365).',
    'Ang proseso molungtad og 1 hangtod 3 ka bulan tungod sa mandatory 10-day posting period.',
    'vis'
  ),
  -- Guide 4: Late Registration Filipino
  (
    4, 102, 'Late Registration of Birth', 'Birth',
    '[
      {"step_number": 1, "instruction": "Kumuha ng Certificate of Negative Registration mula sa PSA."},
      {"step_number": 2, "instruction": "Ihanda ang Joint Affidavit ng dalawang testigo."},
      {"step_number": 3, "instruction": "Dalhin ang mga supporting records (School Form 137, Baptismal, atbp.)."},
      {"step_number": 4, "instruction": "Mag-antay ng 10-araw na mandatory posting period sa LCRO bago aprubahan."}
    ]'::jsonb,
    '[
      "Certificate of Negative Registration (PSA)",
      "Joint Affidavit of Two Witnesses",
      "Supporting Records (School Form 137, Baptismal Certificate)",
      "Valid ID of Registrant",
      "Barangay Certification of Residency"
    ]'::jsonb,
    'Registration fees: ₱200-₱500. PSA copy fees: ₱155-₱365.',
    'Ang mandatory 10-day posting period ay kinakailangan bago aprubahan ng LCRO.',
    'fil'
  ),
  -- Guide 5: Late Registration English
  (
    5, 102, 'Late Registration of Birth', 'Birth',
    '[
      {"step_number": 1, "instruction": "Obtain a Certificate of Negative Registration from the PSA."},
      {"step_number": 2, "instruction": "Prepare a Joint Affidavit of two disinterested witnesses."},
      {"step_number": 3, "instruction": "Bring supporting records (School Form 137, Baptismal Certificate, etc.)."},
      {"step_number": 4, "instruction": "Wait for the 10-day mandatory posting period at the LCRO before approval."}
    ]'::jsonb,
    '[
      "Certificate of Negative Registration (PSA)",
      "Joint Affidavit of Two Witnesses",
      "Supporting Records (School Form 137, Baptismal Certificate)",
      "Valid ID of Registrant",
      "Barangay Certification of Residency"
    ]'::jsonb,
    'Registration fees: ₱200-₱500. PSA copy fees: ₱155-₱365.',
    'A mandatory 10-day posting period is required before approval by the LCRO.',
    'eng'
  ),
  -- Guide 6: Late Registration Bisaya
  (
    6, 102, 'Late Registration of Birth', 'Birth',
    '[
      {"step_number": 1, "instruction": "Kumuha og Certificate of Negative Registration gikan sa PSA."},
      {"step_number": 2, "instruction": "I-andam ang Joint Affidavit sa duha ka saksi."},
      {"step_number": 3, "instruction": "Dad-a ang mga supporting records (School Form 137, Baptismal, ug uban pa)."},
      {"step_number": 4, "instruction": "Hulat sa 10 ka adlaw nga mandatory posting period sa LCRO sa dili pa kini aprobahan."}
    ]'::jsonb,
    '[
      "Certificate of Negative Registration (PSA)",
      "Joint Affidavit of Two Witnesses",
      "Supporting Records (School Form 137, Baptismal Certificate)",
      "Valid ID of Registrant",
      "Barangay Certification of Residency"
    ]'::jsonb,
    'Registration fees: ₱200-₱500. PSA copy fees: ₱155-₱365.',
    'Kinahanglan ang mandatory nga 10 ka adlaw nga posting period sa dili pa aprobahan sa LCRO.',
    'vis'
  ),
  -- Guide 7: IPRA Filipino
  (
    7, 103, 'Indigenous Peoples Registration (IPRA RA 8371)', 'Birth',
    '[
      {"step_number": 1, "instruction": "Kumuha ng Tribal Chieftain Certificate ng pagkakakilanlan."},
      {"step_number": 2, "instruction": "Kumuha ng Barangay Certification of residency."},
      {"step_number": 3, "instruction": "I-file sa LCRO. Kuwalipikado sa libreng pagpaparehistro sa ilalim ng BRAP."}
    ]'::jsonb,
    '[
      "Tribal Chieftain''s Certification of Identity",
      "Barangay Certification of Residency",
      "Affidavit of Two Community Elders",
      "NCIP Certificate (if available)"
    ]'::jsonb,
    'Libreng late registration sa ilalim ng Birth Registration Assistance Project (BRAP) para sa Indigenous Peoples.',
    'Ang mga katutubo ay maaaring gumamit ng Tribal Chieftain Affidavit bilang sapat na patunay ng pagkakakilanlan.',
    'fil'
  ),
  -- Guide 8: IPRA English
  (
    8, 103, 'Indigenous Peoples Registration (IPRA RA 8371)', 'Birth',
    '[
      {"step_number": 1, "instruction": "Obtain a Tribal Chieftain Certificate of identity."},
      {"step_number": 2, "instruction": "Obtain a Barangay Certification of residency."},
      {"step_number": 3, "instruction": "File with the LCRO. Eligible for free registration under BRAP."}
    ]'::jsonb,
    '[
      "Tribal Chieftain''s Certification of Identity",
      "Barangay Certification of Residency",
      "Affidavit of Two Community Elders",
      "NCIP Certificate (if available)"
    ]'::jsonb,
    'Free late registration under the Birth Registration Assistance Project (BRAP) for Indigenous Peoples.',
    'Indigenous peoples can use a Tribal Chieftain Affidavit as sufficient proof of identity.',
    'eng'
  ),
  -- Guide 9: IPRA Bisaya
  (
    9, 103, 'Indigenous Peoples Registration (IPRA RA 8371)', 'Birth',
    '[
      {"step_number": 1, "instruction": "Kumuha og Tribal Chieftain Certificate isip kamatuoran sa pagkakakilanlan."},
      {"step_number": 2, "instruction": "Kumuha og Barangay Certification sa residency."},
      {"step_number": 3, "instruction": "I-file sa LCRO. Kwalipikado sa libre nga pagparehistro ubos sa BRAP."}
    ]'::jsonb,
    '[
      "Tribal Chieftain''s Certification of Identity",
      "Barangay Certification of Residency",
      "Affidavit of Two Community Elders",
      "NCIP Certificate (if available)"
    ]'::jsonb,
    'Libre nga late registration ubos sa Birth Registration Assistance Project (BRAP) para sa mga Indigenous Peoples.',
    'Ang mga lumad/katutubo mahimong mogamit sa Tribal Chieftain Affidavit isip igo nga pamatuod sa pagkakakilanlan.',
    'vis'
  )
on conflict (guide_id) do update
set kb_id = excluded.kb_id,
    title = excluded.title,
    category = excluded.category,
    steps_json = excluded.steps_json,
    requirements_json = excluded.requirements_json,
    fees_text = excluded.fees_text,
    tips = excluded.tips,
    language = excluded.language;

-- 3. Evaluation & Demo Personas
insert into public.personas (persona_id, name, avatar, age, address, backstory, problem_type, test_query, checklist_items, is_active)
values
  (
    1, 'Sharmaine C. Dalandan', '👧', 21,
    'Cagayan de Oro City, Misamis Oriental',
    'Education student in Cagayan de Oro City. She discovered she has a double birth registration (registered in both Manila and CDO LCROs) with a minor name discrepancy. This issue is blocking her registration for the upcoming Licensure Examination for Teachers (LET). She needs to know how to cancel one registration and correct the other.',
    'Double Registration',
    'May dalawa akong birth certificate — magkaiba ang pangalan at lugar ng rehistro. Ano ang gagawin ko para sa LET board exam?',
    '["PSA Birth Certificate Manila Copy (Original)", "PSA Birth Certificate CDO Copy (Original)", "LET Application Form / Document Checklist", "School Records (Transcript / Form 137)", "Valid Government Issued ID"]'::jsonb,
    true
  ),
  (
    2, 'Vanessa A. Maralangaw', '👩', 20,
    'T''boli Ancestral Domain, South Cotabato',
    'A T''boli college student in South Cotabato. Her grandparents have traditional singular names and have never had official birth certificates. Due to this, they have no school, baptismal, or other standard records. She needs a culturally sensitive and legal registration pathway for her grandparents under the Indigenous Peoples Rights Act (IPRA RA 8371).',
    'Indigenous Peoples Registration',
    'Lolo at lola ko ay mga T''boli, isang pangalan lang ang gamit nila. Walang silang birth certificate. Paano sila magparehistro sa LCRO?',
    '["Tribal Chieftain''s Certification of Identity", "Barangay Certification of Residency", "Affidavit of Two Community Elders", "NCIP Certification"]'::jsonb,
    true
  ),
  (
    3, 'Melanie P. Avocardo', '👩‍💼', 22,
    'Davao City, Davao del Sur',
    'College student acting as proxy for her father. Her father''s birth certificate contains a clerical spelling error in the surname (spelled ''Avocado'' instead of ''Avocardo''). She has made multiple wasted trips to the Davao LCRO because she kept getting conflicting requirements. She needs a single, verified, upfront checklist under RA 9048 to resolve it in one final trip.',
    'Clerical Error (RA 9048)',
    'Pabalik-balik ako sa LCRO para sa correction ng apelyido ng papa ko galing Avocado papuntang Avocardo. Ano ba talaga ang kailangan?',
    '["Notarized Special Power of Attorney (Original)", "Representative''s Valid ID (Melanie''s)", "Owner''s Valid ID (Father''s)", "PSA Birth Certificate of Father (Original)", "Filing Fee (₱1,000)"]'::jsonb,
    true
  )
on conflict (persona_id) do update
set name = excluded.name,
    avatar = excluded.avatar,
    age = excluded.age,
    address = excluded.address,
    backstory = excluded.backstory,
    problem_type = excluded.problem_type,
    test_query = excluded.test_query,
    checklist_items = excluded.checklist_items,
    is_active = excluded.is_active;

-- Reset sequence numbers to prevent primary key collision on future inserts
select setval(pg_get_serial_sequence('public.guides', 'guide_id'), coalesce(max(guide_id), 1)) from public.guides;
select setval(pg_get_serial_sequence('public.personas', 'persona_id'), coalesce(max(persona_id), 1)) from public.personas;
