-- IPEDS Completions (Simplified)
-- Counts graduates by program and level
-- Note: Full IPEDS requires CIP codes, race/ethnicity, gender breakdowns

SELECT
    p.name AS program_name,
    dt.code AS degree_code,
    dt.level AS degree_level,
    COUNT(DISTINCT s.id) AS completers
FROM pg.student.students s
JOIN pg.student.student_programs sp ON s.id = sp.student_id
JOIN pg.curriculum.programs p ON sp.program_id = p.id
JOIN pg.curriculum.degree_types dt ON p.degree_type_id = dt.id
WHERE sp.status = 'graduated'
GROUP BY p.name, dt.code, dt.level
ORDER BY completers DESC;
