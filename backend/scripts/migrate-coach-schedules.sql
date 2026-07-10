-- =========================================================================================
-- MIGRATION SCRIPT: Split Coach Schedules into 1-hour slots (SAFE VERSION)
-- Description:
-- 1. Finds all existing CoachSchedules with duration > 1 hour.
-- 2. Filters out schedules that are linked in BookingDetails (to avoid breaking active/past bookings).
-- 3. For eligible schedules, inserts new 1-hour records for the entire duration and deletes the old one.
-- 4. Prints out a list of skipped schedules that require manual review.
-- 5. Safe execution using BEGIN/COMMIT/ROLLBACK TRANSACTION.
-- =========================================================================================

SET NOCOUNT ON;

DECLARE @DryRun BIT = 1; -- 1: Dry Run (Audit Only), 0: Execute

DECLARE @EligibleCount INT = 0;
DECLARE @PlannedSlotsCount INT = 0;
DECLARE @MigratedCount INT = 0;
DECLARE @SkippedCount INT = 0;
DECLARE @ErrorCount INT = 0;
DECLARE @DataModified NVARCHAR(3) = 'No';

PRINT '====================================================';
PRINT 'STARTING SAFE MIGRATION: COACH SCHEDULES (1H SLOTS) ';
PRINT 'DRY RUN MODE: ' + CAST(@DryRun AS VARCHAR(1));
PRINT '====================================================';

-- Determine skipped records (Manual Review Required)
SELECT CoachScheduleID, CoachID, WorkingDate, StartTime, EndTime, DATEDIFF(MINUTE, StartTime, EndTime) as DurationMinutes
INTO #SkippedDueToBooking
FROM CoachSchedules
WHERE DATEDIFF(MINUTE, StartTime, EndTime) > 60
  AND CoachScheduleID IN (SELECT DISTINCT CoachScheduleID FROM BookingDetails WHERE CoachScheduleID IS NOT NULL);

-- Determine skipped records (Past Legacy)
SELECT CoachScheduleID, CoachID, WorkingDate, StartTime, EndTime, DATEDIFF(MINUTE, StartTime, EndTime) as DurationMinutes
INTO #SkippedPastLegacySchedules
FROM CoachSchedules
WHERE DATEDIFF(MINUTE, StartTime, EndTime) > 60
  AND CoachScheduleID NOT IN (SELECT CoachScheduleID FROM #SkippedDueToBooking)
  AND CAST(CONCAT(CAST(WorkingDate AS VARCHAR(10)), ' ', CAST(EndTime AS VARCHAR(8))) AS DATETIME) <= GETDATE();

SELECT @SkippedCount = COUNT(*) FROM #SkippedDueToBooking;
DECLARE @SkippedPastCount INT = 0;
SELECT @SkippedPastCount = COUNT(*) FROM #SkippedPastLegacySchedules;

IF @SkippedPastCount > 0
BEGIN
    PRINT '----------------------------------------------------';
    PRINT 'B. Skipped past legacy schedules:';

    DECLARE @PastID INT, @PastCoachID INT, @PastStart TIME, @PastEnd TIME, @PastDate DATE, @PastDur INT;
    DECLARE past_cursor CURSOR FOR SELECT CoachScheduleID, CoachID, StartTime, EndTime, WorkingDate, DurationMinutes FROM #SkippedPastLegacySchedules;
    OPEN past_cursor;
    FETCH NEXT FROM past_cursor INTO @PastID, @PastCoachID, @PastStart, @PastEnd, @PastDate, @PastDur;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        PRINT ' - CoachScheduleID: ' + CAST(@PastID AS VARCHAR(10)) + ' | CoachID: ' + CAST(@PastCoachID AS VARCHAR(10)) + ' | Date: ' + CAST(@PastDate AS VARCHAR(15)) + ' | Reason: Past legacy schedule - intentionally retained unchanged.';
        FETCH NEXT FROM past_cursor INTO @PastID, @PastCoachID, @PastStart, @PastEnd, @PastDate, @PastDur;
    END
    CLOSE past_cursor; DEALLOCATE past_cursor;
END

IF @SkippedCount > 0
BEGIN
    PRINT '----------------------------------------------------';
    PRINT 'C. Manual Review Required:';

    DECLARE @SkipID INT, @SkipCoachID INT, @SkipStart TIME, @SkipEnd TIME, @SkipDate DATE, @SkipDur INT;
    DECLARE @BookingID INT, @BookingDetailID INT;
    DECLARE skip_cursor CURSOR FOR
    SELECT s.CoachScheduleID, s.CoachID, s.StartTime, s.EndTime, s.WorkingDate, s.DurationMinutes, bd.BookingID, bd.BookingDetailID
    FROM #SkippedDueToBooking s
    LEFT JOIN BookingDetails bd ON s.CoachScheduleID = bd.CoachScheduleID;

    OPEN skip_cursor;
    FETCH NEXT FROM skip_cursor INTO @SkipID, @SkipCoachID, @SkipStart, @SkipEnd, @SkipDate, @SkipDur, @BookingID, @BookingDetailID;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        PRINT ' - CoachScheduleID: ' + CAST(@SkipID AS VARCHAR(10)) +
              ' | CoachID: ' + CAST(@SkipCoachID AS VARCHAR(10)) +
              ' | WorkingDate: ' + CAST(@SkipDate AS VARCHAR(20)) +
              ' | StartTime: ' + CAST(@SkipStart AS VARCHAR(8)) +
              ' | EndTime: ' + CAST(@SkipEnd AS VARCHAR(8)) +
              ' | DurationMinutes: ' + CAST(@SkipDur AS VARCHAR(10)) +
              ' | BookingID: ' + ISNULL(CAST(@BookingID AS VARCHAR(10)), 'N/A') +
              ' | BookingDetailID: ' + ISNULL(CAST(@BookingDetailID AS VARCHAR(10)), 'N/A') +
              ' | Reason: Linked to BookingDetails' +
              ' | SuggestedAction: Manual review required. Legacy booking remains intact.';

        FETCH NEXT FROM skip_cursor INTO @SkipID, @SkipCoachID, @SkipStart, @SkipEnd, @SkipDate, @SkipDur, @BookingID, @BookingDetailID;
    END;
    CLOSE skip_cursor;
    DEALLOCATE skip_cursor;
END

BEGIN TRY
    BEGIN TRANSACTION;

    CREATE TABLE #NewSchedules (
        SourceCoachScheduleID INT,
        CoachID INT,
        WorkingDate DATE,
        PlannedStartTime TIME,
        PlannedEndTime TIME,
        PlannedAvailabilityStatus NVARCHAR(30),
        CreatedAt DATETIME
    );

    CREATE TABLE #ProcessedSchedules (
        CoachScheduleID INT,
        CoachID INT,
        WorkingDate DATE,
        StartTime TIME,
        EndTime TIME,
        DurationMinutes INT
    );

    DECLARE @ScheduleID INT, @CoachID INT, @WorkingDate DATE, @StartTime TIME, @EndTime TIME, @Status NVARCHAR(30), @CreatedAt DATETIME;
    DECLARE @Duration INT;

    DECLARE schedule_cursor CURSOR FOR
    SELECT CoachScheduleID, CoachID, WorkingDate, StartTime, EndTime, Status, CreatedAt, DATEDIFF(MINUTE, StartTime, EndTime)
    FROM CoachSchedules
    WHERE DATEDIFF(MINUTE, StartTime, EndTime) > 60
      AND CoachScheduleID NOT IN (SELECT CoachScheduleID FROM #SkippedDueToBooking)
      AND CoachScheduleID NOT IN (SELECT CoachScheduleID FROM #SkippedPastLegacySchedules);

    OPEN schedule_cursor;
    FETCH NEXT FROM schedule_cursor INTO @ScheduleID, @CoachID, @WorkingDate, @StartTime, @EndTime, @Status, @CreatedAt, @Duration;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @EligibleCount = @EligibleCount + 1;
        INSERT INTO #ProcessedSchedules (CoachScheduleID, CoachID, WorkingDate, StartTime, EndTime, DurationMinutes)
        VALUES (@ScheduleID, @CoachID, @WorkingDate, @StartTime, @EndTime, @Duration);

        DECLARE @CurrentStart TIME = @StartTime;
        DECLARE @CurrentEnd TIME = DATEADD(HOUR, 1, @CurrentStart);

        WHILE @CurrentStart < @EndTime
        BEGIN
            INSERT INTO #NewSchedules (SourceCoachScheduleID, CoachID, WorkingDate, PlannedStartTime, PlannedEndTime, PlannedAvailabilityStatus, CreatedAt)
            VALUES (@ScheduleID, @CoachID, @WorkingDate, @CurrentStart, @CurrentEnd, @Status, @CreatedAt);

            SET @PlannedSlotsCount = @PlannedSlotsCount + 1;

            SET @CurrentStart = @CurrentEnd;
            SET @CurrentEnd = DATEADD(HOUR, 1, @CurrentStart);
            IF @CurrentEnd > @EndTime SET @CurrentEnd = @EndTime;
        END

        FETCH NEXT FROM schedule_cursor INTO @ScheduleID, @CoachID, @WorkingDate, @StartTime, @EndTime, @Status, @CreatedAt, @Duration;
    END;

    CLOSE schedule_cursor;
    DEALLOCATE schedule_cursor;

    -- Print Eligible records
    PRINT '----------------------------------------------------';
    PRINT 'A. Eligible records:';
    DECLARE @E_ID INT, @E_CID INT, @E_WD DATE, @E_ST TIME, @E_ET TIME, @E_Dur INT;
    DECLARE elig_cursor CURSOR FOR SELECT CoachScheduleID, CoachID, WorkingDate, StartTime, EndTime, DurationMinutes FROM #ProcessedSchedules;
    OPEN elig_cursor;
    FETCH NEXT FROM elig_cursor INTO @E_ID, @E_CID, @E_WD, @E_ST, @E_ET, @E_Dur;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        PRINT ' - CoachScheduleID: ' + CAST(@E_ID AS VARCHAR(10)) + ' | CoachID: ' + CAST(@E_CID AS VARCHAR(10)) + ' | WorkingDate: ' + CAST(@E_WD AS VARCHAR(15)) + ' | StartTime: ' + CAST(@E_ST AS VARCHAR(8)) + ' | EndTime: ' + CAST(@E_ET AS VARCHAR(8)) + ' | DurationMinutes: ' + CAST(@E_Dur AS VARCHAR(10)) + ' | Số slot 1 giờ dự kiến tạo: ' + CAST((@E_Dur / 60) AS VARCHAR(10));
        FETCH NEXT FROM elig_cursor INTO @E_ID, @E_CID, @E_WD, @E_ST, @E_ET, @E_Dur;
    END
    CLOSE elig_cursor; DEALLOCATE elig_cursor;

    -- Print Planned slots
    PRINT '----------------------------------------------------';
    PRINT 'B. Planned slots:';
    DECLARE @P_SID INT, @P_CID INT, @P_WD DATE, @P_ST TIME, @P_ET TIME, @P_Stat NVARCHAR(30);
    DECLARE plan_cursor CURSOR FOR SELECT SourceCoachScheduleID, CoachID, WorkingDate, PlannedStartTime, PlannedEndTime, PlannedAvailabilityStatus FROM #NewSchedules;
    OPEN plan_cursor;
    FETCH NEXT FROM plan_cursor INTO @P_SID, @P_CID, @P_WD, @P_ST, @P_ET, @P_Stat;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        PRINT ' - SourceCoachScheduleID: ' + CAST(@P_SID AS VARCHAR(10)) + ' | CoachID: ' + CAST(@P_CID AS VARCHAR(10)) + ' | WorkingDate: ' + CAST(@P_WD AS VARCHAR(15)) + ' | PlannedStartTime: ' + CAST(@P_ST AS VARCHAR(8)) + ' | PlannedEndTime: ' + CAST(@P_ET AS VARCHAR(8)) + ' | PlannedAvailabilityStatus: ' + ISNULL(@P_Stat, 'N/A');
        FETCH NEXT FROM plan_cursor INTO @P_SID, @P_CID, @P_WD, @P_ST, @P_ET, @P_Stat;
    END
    CLOSE plan_cursor; DEALLOCATE plan_cursor;

    -- Conditional Execution based on @DryRun
    IF @DryRun = 0
    BEGIN
        INSERT INTO CoachSchedules (CoachID, WorkingDate, StartTime, EndTime, Status, CreatedAt)
        SELECT CoachID, WorkingDate, PlannedStartTime, PlannedEndTime, PlannedAvailabilityStatus, CreatedAt FROM #NewSchedules;

        DELETE FROM CoachSchedules
        WHERE CoachScheduleID IN (SELECT CoachScheduleID FROM #ProcessedSchedules);

        SET @MigratedCount = @EligibleCount;
        SET @DataModified = 'Yes';
    END

    DROP TABLE #NewSchedules;
    DROP TABLE #ProcessedSchedules;
    DROP TABLE #SkippedDueToBooking;
    DROP TABLE #SkippedPastLegacySchedules;

    COMMIT TRANSACTION;

    PRINT '----------------------------------------------------';
    PRINT 'D. Summary:';
    PRINT ' - EligibleForMigration: ' + CAST(@EligibleCount AS VARCHAR(10));
    PRINT ' - PlannedSlotsToCreate: ' + CAST(@PlannedSlotsCount AS VARCHAR(10));
    PRINT ' - ActuallyMigrated: ' + CAST(@MigratedCount AS VARCHAR(10));
    PRINT ' - SkippedDueToBooking: ' + CAST(@SkippedCount AS VARCHAR(10));
    PRINT ' - SkippedPastLegacySchedules: ' + CAST(@SkippedPastCount AS VARCHAR(10));
    PRINT ' - SkippedAmbiguous: 0';
    PRINT ' - Errors: ' + CAST(@ErrorCount AS VARCHAR(10));
    PRINT ' - DataModified: ' + @DataModified;
    PRINT '====================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    SET @ErrorCount = @ErrorCount + 1;

    PRINT '----------------------------------------------------';
    PRINT '❌ ERROR OCCURRED. TRANSACTION ROLLED BACK.';
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    PRINT '====================================================';
END CATCH;
