-- Academic Standing Breakdown
-- Shows current academic standing distribution (most recent per student)

WITH current_standing AS (
    SELECT DISTINCT ON (student_id)
        student_id,
        standing
    FROM pg.student.academic_standing_history
    ORDER BY student_id, determined_at DESC
)
SELECT
    standing AS standing_code,
    COUNT(*) AS student_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS percentage
FROM current_standing
GROUP BY standing
ORDER BY student_count DESC;
