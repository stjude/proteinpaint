

insert into cohorts(cohort, name, abbrev, sample_count) values
('SJLIFE', 'St. Jude Lifetime Cohort Study', 'SJLIFE', 5053),
('CCSS', 'Childhood Cancer Survivor Study', 'CCSS', 2688),
('SJLIFE+CCSS', 'St. Jude Lifetime Cohort Study and Childhood Cancer Survivor Study', 'SJLIFE+CCSS', 7741);



insert into features(name) values
('Survivors on Portal'), ('Years of cancer diagnosis'), ('Inclusion criteria'),
('Age at cancer diagnosis'), ('Cancer diagnosis'), ('Study design'), ('Methods of contact'),
('Source of sequenced germline DNA'), ('Therapeutic exposures'), 
('Methods for ascertainment of outcomes');

insert into cohort_features(cohort, idfeature, value)
values
('SJLIFE', 1, '5053'),
('SJLIFE', 2, '1962-2012'),
('SJLIFE', 3, 'Survived ≥ 5 years from diagnosis'),
('SJLIFE', 4, '<25 years'),
('SJLIFE', 5, 'All diagnoses'),
('SJLIFE', 6, 'Retrospective cohort with prospective follow-up, hospital-based'),
('SJLIFE', 7, 'Clinic visits and surveys'),
('SJLIFE', 8, 'Blood'),
('SJLIFE', 9, 'Chemotherapy, radiation, surgery'),
('SJLIFE', 10, 'Clinical assessments, medical records, self-report, NDI'),
('CCSS', 1, '2688'),
('CCSS', 2, '1987-1999 ("Expanded Cohort")'),
('CCSS', 3, 'Survived ≥ 5 years from diagnosis'),
('CCSS', 4, '<21 years'),
('CCSS', 5, 'Leukemia, CNS, HL, NHL, neuroblastoma, soft tissue sarcoma, Wilms, bone tumors'),
('CCSS', 6, 'Retrospective cohort with prospective follow-up, hospital-based'),
('CCSS', 7, 'Surveys'),
('CCSS', 8, 'Saliva or blood'),
('CCSS', 9, 'Chemotherapy, radiation, surgery'),
('CCSS', 10, 'Self-report, pathology reports (secondary neoplasm), NDI');
