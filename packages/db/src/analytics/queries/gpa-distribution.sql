-- GPA Distribution
-- Shows student count by GPA range

SELECT
    CASE
        WHEN gpa.cumulative_gpa >= 3.7 THEN '3.7-4.0 (Dean''s List)'
        WHEN gpa.cumulative_gpa >= 3.0 THEN '3.0-3.69 (Good Standing)'
        WHEN gpa.cumulative_gpa >= 2.0 THEN '2.0-2.99 (Satisfactory)'
        WHEN gpa.cumulative_gpa >= 1.0 THEN '1.0-1.99 (Warning)'
        ELSE '0.0-0.99 (Critical)'
    END AS gpa_range,
    COUNT(*) AS student_count,
    ROUND(AVG(gpa.cumulative_gpa), 3) AS avg_gpa,
    ROUND(AVG(gpa.cumulative_earned_credits), 1) AS avg_credits
FROM pg.student.student_gpa_summary gpa
WHERE gpa.cumulative_gpa IS NOT NULL
GROUP BY 1
ORDER BY MIN(gpa.cumulative_gpa) DESC;
