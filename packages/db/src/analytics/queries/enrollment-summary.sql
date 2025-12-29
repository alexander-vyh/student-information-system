-- Enrollment Summary by Term
-- Shows registration counts and credit hours by term and status

SELECT
    t.code AS term,
    t.name AS term_name,
    r.status,
    COUNT(*) AS registrations,
    SUM(r.credit_hours) AS total_credits
FROM pg.enrollment.registrations r
JOIN pg.curriculum.sections s ON r.section_id = s.id
JOIN pg.core.terms t ON s.term_id = t.id
GROUP BY t.code, t.name, r.status
ORDER BY t.code, r.status;
