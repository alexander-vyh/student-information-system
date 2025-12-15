-- Department Metrics
-- Shows enrollment and credit metrics by department

SELECT
    d.code AS dept_code,
    d.name AS department,
    COUNT(DISTINCT s.id) AS sections,
    COUNT(DISTINCT r.id) AS enrollments,
    COUNT(DISTINCT r.student_id) AS unique_students,
    ROUND(AVG(r.credit_hours), 1) AS avg_credits,
    SUM(r.credit_hours) AS total_credit_hours
FROM pg.curriculum.departments d
JOIN pg.curriculum.courses c ON c.department_id = d.id
JOIN pg.curriculum.sections s ON s.course_id = c.id
LEFT JOIN pg.enrollment.registrations r ON r.section_id = s.id
GROUP BY d.code, d.name
ORDER BY enrollments DESC;
