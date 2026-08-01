CREATE OR REPLACE FUNCTION handle_question_answer_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if the correctOption actually changed
  IF OLD."correctOption" IS DISTINCT FROM NEW."correctOption" THEN
    
    -- 1. Update the correctness of all existing answers for this question
    UPDATE "AttemptAnswer"
    SET "isCorrect" = ("selectedOption" = NEW."correctOption")
    WHERE "questionId" = NEW.id;

    -- 2. Recalculate scores for all QuizAttempts that contain this question
    -- We use a CTE (Common Table Expression) to aggregate the new counts
    WITH attempt_aggregates AS (
      SELECT 
        aa."attemptId",
        COUNT(*) FILTER (WHERE aa."isCorrect" = true) AS correct_c,
        COUNT(*) FILTER (WHERE aa."isCorrect" = false AND aa."selectedOption" IS NOT NULL) AS wrong_c,
        COUNT(*) FILTER (WHERE aa."selectedOption" IS NULL) AS skipped_c
      FROM "AttemptAnswer" aa
      WHERE aa."attemptId" IN (
        SELECT DISTINCT "attemptId" 
        FROM "AttemptAnswer" 
        WHERE "questionId" = NEW.id
      )
      GROUP BY aa."attemptId"
    )
    UPDATE "QuizAttempt" qa
    SET 
      "correctCount" = agg.correct_c,
      "wrongCount" = agg.wrong_c,
      "skippedCount" = agg.skipped_c,
      "negativeMarks" = CASE 
                          WHEN q."allowNegativeMarking" THEN (agg.wrong_c * q."negativeValue")
                          ELSE 0
                        END,
      "netScore" = CASE 
                     WHEN q."allowNegativeMarking" THEN (agg.correct_c * q."marksPerCorrect") - (agg.wrong_c * q."negativeValue")
                     ELSE (agg.correct_c * q."marksPerCorrect")
                   END,
      "totalScore" = (agg.correct_c + agg.wrong_c + agg.skipped_c) * q."marksPerCorrect",
      "percentageScore" = CASE 
                            WHEN ((agg.correct_c + agg.wrong_c + agg.skipped_c) * q."marksPerCorrect") > 0 
                            THEN ( 
                                   (CASE 
                                     WHEN q."allowNegativeMarking" THEN (agg.correct_c * q."marksPerCorrect") - (agg.wrong_c * q."negativeValue")
                                     ELSE (agg.correct_c * q."marksPerCorrect")
                                   END)::float / 
                                   ((agg.correct_c + agg.wrong_c + agg.skipped_c) * q."marksPerCorrect")::float 
                                 ) * 100
                            ELSE 0 
                          END
    FROM attempt_aggregates agg
    JOIN "Quiz" q ON q.id = qa."quizId"
    WHERE qa.id = agg."attemptId";
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it already exists so we can safely run this multiple times
DROP TRIGGER IF EXISTS on_question_answer_update ON "Question";

-- Create the trigger on the Question table
CREATE TRIGGER on_question_answer_update
AFTER UPDATE ON "Question"
FOR EACH ROW
EXECUTE FUNCTION handle_question_answer_update();
