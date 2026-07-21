// ============================================================
// tournaments.repository.ts
// Database layer for the Tournament module using ConnectionPool
// ============================================================

import { getPool, sql } from "@/database/connection";
import type { CreateTournamentInput, CreateDivisionInput, UpdateTournamentInput, UpdateDivisionInput, Tournament, TournamentDivision } from "./tournaments.type";

/**
 * Find all tournaments with filters (status, keyword, dates)
 */
export async function findTournaments(filters: {
  status?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Tournament[]> {
  const pool = await getPool();
  const request = pool.request();

  let query = `
    SELECT * FROM Tournaments
    WHERE IsDeleted = 0
  `;

  if (filters.status) {
    request.input("Status", sql.NVarChar(50), filters.status);
    query += " AND Status = @Status";
  }

  if (filters.keyword) {
    request.input("Keyword", sql.NVarChar(255), `%${filters.keyword}%`);
    query += " AND (TournamentName LIKE @Keyword OR TournamentCode LIKE @Keyword OR Location LIKE @Keyword)";
  }

  if (filters.startDate) {
    request.input("StartDate", sql.DateTime, filters.startDate);
    query += " AND TournamentStart >= @StartDate";
  }

  if (filters.endDate) {
    request.input("EndDate", sql.DateTime, filters.endDate);
    query += " AND TournamentEnd <= @EndDate";
  }

  query += " ORDER BY TournamentStart ASC";

  const result = await request.query(query);
  return result.recordset;
}

/**
 * Find tournament by ID
 */
export async function findTournamentById(id: number): Promise<Tournament | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("TournamentID", sql.Int, id)
    .query(`
      SELECT * FROM Tournaments
      WHERE TournamentID = @TournamentID AND IsDeleted = 0
    `);
  return result.recordset[0] ?? null;
}

/**
 * Find tournament by Code
 */
export async function findTournamentByCode(code: string): Promise<Tournament | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("TournamentCode", sql.NVarChar(50), code)
    .query(`
      SELECT * FROM Tournaments
      WHERE TournamentCode = @TournamentCode AND IsDeleted = 0
    `);
  return result.recordset[0] ?? null;
}

/**
 * Create a new tournament record
 */
export async function createTournament(data: CreateTournamentInput & { createdBy: number }): Promise<Tournament> {
  const pool = await getPool();
  const result = await pool.request()
    .input("TournamentCode", sql.NVarChar(50), data.tournamentCode)
    .input("TournamentName", sql.NVarChar(255), data.tournamentName)
    .input("Description", sql.NVarChar(sql.MAX), data.description || null)
    .input("Location", sql.NVarChar(255), data.location || null)
    .input("RegistrationStart", sql.DateTime, data.registrationStart)
    .input("RegistrationEnd", sql.DateTime, data.registrationEnd)
    .input("TournamentStart", sql.DateTime, data.tournamentStart)
    .input("TournamentEnd", sql.DateTime, data.tournamentEnd)
    .input("PrizeInfo", sql.NVarChar(sql.MAX), data.prizeInfo || null)
    .input("Rules", sql.NVarChar(sql.MAX), data.rules || null)
    .input("ImageURL", sql.NVarChar(500), data.imageURL || null)
    .input("OrganizerName", sql.NVarChar(255), data.organizerName || null)
    .input("CreatedBy", sql.Int, data.createdBy)
    .query(`
      INSERT INTO Tournaments (
        TournamentCode, TournamentName, Description, Location,
        RegistrationStart, RegistrationEnd, TournamentStart, TournamentEnd,
        Status, PrizeInfo, Rules, ImageURL, OrganizerName, CreatedBy, CreatedAt, UpdatedAt, IsDeleted
      )
      OUTPUT INSERTED.*
      VALUES (
        @TournamentCode, @TournamentName, @Description, @Location,
        @RegistrationStart, @RegistrationEnd, @TournamentStart, @TournamentEnd,
        'Draft', @PrizeInfo, @Rules, @ImageURL, @OrganizerName, @CreatedBy, GETDATE(), GETDATE(), 0
      )
    `);
  return result.recordset[0];
}

/**
 * Update tournament details
 */
export async function updateTournament(id: number, data: UpdateTournamentInput): Promise<Tournament> {
  const pool = await getPool();
  const request = pool.request();
  request.input("TournamentID", sql.Int, id);

  let sets: string[] = [];

  if (data.tournamentName !== undefined) {
    request.input("TournamentName", sql.NVarChar(255), data.tournamentName);
    sets.push("TournamentName = @TournamentName");
  }
  if (data.description !== undefined) {
    request.input("Description", sql.NVarChar(sql.MAX), data.description || null);
    sets.push("Description = @Description");
  }
  if (data.location !== undefined) {
    request.input("Location", sql.NVarChar(255), data.location || null);
    sets.push("Location = @Location");
  }
  if (data.registrationStart !== undefined) {
    request.input("RegistrationStart", sql.DateTime, data.registrationStart);
    sets.push("RegistrationStart = @RegistrationStart");
  }
  if (data.registrationEnd !== undefined) {
    request.input("RegistrationEnd", sql.DateTime, data.registrationEnd);
    sets.push("RegistrationEnd = @RegistrationEnd");
  }
  if (data.tournamentStart !== undefined) {
    request.input("TournamentStart", sql.DateTime, data.tournamentStart);
    sets.push("TournamentStart = @TournamentStart");
  }
  if (data.tournamentEnd !== undefined) {
    request.input("TournamentEnd", sql.DateTime, data.tournamentEnd);
    sets.push("TournamentEnd = @TournamentEnd");
  }
  if (data.prizeInfo !== undefined) {
    request.input("PrizeInfo", sql.NVarChar(sql.MAX), data.prizeInfo || null);
    sets.push("PrizeInfo = @PrizeInfo");
  }
  if (data.rules !== undefined) {
    request.input("Rules", sql.NVarChar(sql.MAX), data.rules || null);
    sets.push("Rules = @Rules");
  }
  if (data.imageURL !== undefined) {
    request.input("ImageURL", sql.NVarChar(500), data.imageURL || null);
    sets.push("ImageURL = @ImageURL");
  }
  if (data.organizerName !== undefined) {
    request.input("OrganizerName", sql.NVarChar(255), data.organizerName || null);
    sets.push("OrganizerName = @OrganizerName");
  }

  sets.push("UpdatedAt = GETDATE()");

  const query = `
    UPDATE Tournaments
    SET ${sets.join(", ")}
    OUTPUT INSERTED.*
    WHERE TournamentID = @TournamentID
  `;

  const result = await request.query(query);
  return result.recordset[0];
}

/**
 * Soft delete a tournament by setting IsDeleted = 1
 */
export async function softDeleteTournament(id: number): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.request()
    .input("TournamentID", sql.Int, id)
    .query(`
      UPDATE Tournaments
      SET IsDeleted = 1, UpdatedAt = GETDATE()
      WHERE TournamentID = @TournamentID
    `);
  return (result.rowsAffected[0] ?? 0) > 0;
}

/**
 * Update tournament status (Draft -> Open, Open -> Closed, etc.)
 */
export async function updateTournamentStatus(id: number, status: string): Promise<Tournament> {
  const pool = await getPool();
  const result = await pool.request()
    .input("TournamentID", sql.Int, id)
    .input("Status", sql.NVarChar(50), status)
    .query(`
      UPDATE Tournaments
      SET Status = @Status, UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE TournamentID = @TournamentID
    `);
  return result.recordset[0];
}

/**
 * Retrieve list of divisions for a tournament
 */
export async function findDivisionsByTournamentId(tournamentId: number): Promise<TournamentDivision[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input("TournamentID", sql.Int, tournamentId)
    .query(`
      SELECT td.*,
             (SELECT COUNT(*) FROM TournamentRegistrations tr 
              WHERE tr.DivisionID = td.DivisionID AND tr.RegistrationStatus NOT IN ('Cancelled', 'Rejected')) AS RegisteredCount,
             (SELECT COUNT(*) FROM TournamentRegistrations tr 
              WHERE tr.DivisionID = td.DivisionID AND tr.RegistrationStatus IN ('Paid', 'Confirmed')) AS PaidCount
      FROM TournamentDivisions td
      WHERE td.TournamentID = @TournamentID
      ORDER BY td.DivisionID ASC
    `);
  return result.recordset;
}

/**
 * Create a new tournament division
 */
export async function createDivision(
  tournamentId: number,
  data: CreateDivisionInput & { teamSize: number; genderRequirement: string }
): Promise<TournamentDivision> {
  const pool = await getPool();
  const result = await pool.request()
    .input("TournamentID", sql.Int, tournamentId)
    .input("DivisionName", sql.NVarChar(255), data.divisionName)
    .input("CompetitionFormat", sql.NVarChar(50), data.competitionFormat)
    .input("TeamSize", sql.Int, data.teamSize)
    .input("GenderRequirement", sql.NVarChar(50), data.genderRequirement)
    .input("SkillLevelName", sql.NVarChar(100), data.skillLevelName || null)
    .input("MinDUPR", sql.Decimal(4,2), data.minDUPR !== undefined ? data.minDUPR : null)
    .input("MaxDUPR", sql.Decimal(4,2), data.maxDUPR !== undefined ? data.maxDUPR : null)
    .input("AgeGroup", sql.NVarChar(50), data.ageGroup)
    .input("MinAge", sql.Int, data.minAge !== undefined ? data.minAge : null)
    .input("MaxAge", sql.Int, data.maxAge !== undefined ? data.maxAge : null)
    .input("MaxTeams", sql.Int, data.maxTeams)
    .input("RegistrationFee", sql.Decimal(18,2), data.registrationFee !== undefined ? data.registrationFee : 0)
    .input("BracketType", sql.NVarChar(50), data.bracketType)
    .input("EnableThirdPlace", sql.Bit, (data as any).enableThirdPlace !== false ? 1 : 0)
    .input("RoundScheduleConfig", sql.NVarChar, (data as any).roundScheduleConfig || null)
    .query(`
      INSERT INTO TournamentDivisions (
        TournamentID, DivisionName, CompetitionFormat, TeamSize, GenderRequirement,
        SkillLevelName, MinDUPR, MaxDUPR, AgeGroup, MinAge, MaxAge, MaxTeams,
        RegistrationFee, BracketType, EnableThirdPlace, RoundScheduleConfig, Status, CreatedAt, UpdatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @TournamentID, @DivisionName, @CompetitionFormat, @TeamSize, @GenderRequirement,
        @SkillLevelName, @MinDUPR, @MaxDUPR, @AgeGroup, @MinAge, @MaxAge, @MaxTeams,
        @RegistrationFee, @BracketType, @EnableThirdPlace, @RoundScheduleConfig, 'Draft', GETDATE(), GETDATE()
      )
    `);
  return result.recordset[0];
}

/**
 * Find division by ID
 */
export async function findDivisionById(id: number): Promise<TournamentDivision | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("DivisionID", sql.Int, id)
    .query(`
      SELECT * FROM TournamentDivisions
      WHERE DivisionID = @DivisionID
    `);
  return result.recordset[0] ?? null;
}

/**
 * Update division details
 */
export async function updateDivision(id: number, data: UpdateDivisionInput): Promise<TournamentDivision> {
  const pool = await getPool();
  const request = pool.request();
  request.input("DivisionID", sql.Int, id);

  let sets: string[] = [];

  if (data.divisionName !== undefined) {
    request.input("DivisionName", sql.NVarChar(255), data.divisionName);
    sets.push("DivisionName = @DivisionName");
  }
  if (data.skillLevelName !== undefined) {
    request.input("SkillLevelName", sql.NVarChar(100), data.skillLevelName || null);
    sets.push("SkillLevelName = @SkillLevelName");
  }
  if (data.minDUPR !== undefined) {
    request.input("MinDUPR", sql.Decimal(4,2), data.minDUPR !== null ? data.minDUPR : null);
    sets.push("MinDUPR = @MinDUPR");
  }
  if (data.maxDUPR !== undefined) {
    request.input("MaxDUPR", sql.Decimal(4,2), data.maxDUPR !== null ? data.maxDUPR : null);
    sets.push("MaxDUPR = @MaxDUPR");
  }
  if (data.minAge !== undefined) {
    request.input("MinAge", sql.Int, data.minAge !== null ? data.minAge : null);
    sets.push("MinAge = @MinAge");
  }
  if (data.maxAge !== undefined) {
    request.input("MaxAge", sql.Int, data.maxAge !== null ? data.maxAge : null);
    sets.push("MaxAge = @MaxAge");
  }
  if (data.maxTeams !== undefined) {
    request.input("MaxTeams", sql.Int, data.maxTeams);
    sets.push("MaxTeams = @MaxTeams");
  }
  if (data.registrationFee !== undefined) {
    request.input("RegistrationFee", sql.Decimal(18,2), data.registrationFee);
    sets.push("RegistrationFee = @RegistrationFee");
  }

  if ((data as any).roundScheduleConfig !== undefined) {
    request.input("RoundScheduleConfig", sql.NVarChar, (data as any).roundScheduleConfig || null);
    sets.push("RoundScheduleConfig = @RoundScheduleConfig");
  }

  sets.push("UpdatedAt = GETDATE()");

  const query = `
    UPDATE TournamentDivisions
    SET ${sets.join(", ")}
    OUTPUT INSERTED.*
    WHERE DivisionID = @DivisionID
  `;

  const result = await request.query(query);
  return result.recordset[0];
}

/**
 * Update division status
 */
export async function updateDivisionStatus(id: number, status: string): Promise<TournamentDivision> {
  const pool = await getPool();
  const result = await pool.request()
    .input("DivisionID", sql.Int, id)
    .input("Status", sql.NVarChar(50), status)
    .query(`
      UPDATE TournamentDivisions
      SET Status = @Status, UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE DivisionID = @DivisionID
    `);
  return result.recordset[0];
}

/**
 * Update all divisions status under a specific tournament
 */
export async function updateAllDivisionsStatusInTournament(tournamentId: number, oldStatus: string, newStatus: string): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input("TournamentID", sql.Int, tournamentId)
    .input("OldStatus", sql.NVarChar(50), oldStatus)
    .input("NewStatus", sql.NVarChar(50), newStatus)
    .query(`
      UPDATE TournamentDivisions
      SET Status = @NewStatus, UpdatedAt = GETDATE()
      WHERE TournamentID = @TournamentID AND Status = @OldStatus
    `);
}

/**
 * Find user by email or phone
 */
export async function findUserByEmailOrPhone(val: string): Promise<any | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("Val", sql.NVarChar(100), val.trim())
    .query(`
      SELECT UserID, FullName, Email, PhoneNumber, Status FROM Users
      WHERE (Email = @Val OR PhoneNumber = @Val) AND Status = 'Active'
    `);
  return result.recordset[0] ?? null;
}

/**
 * Find player profile by user ID
 */
export async function findUserPlayerProfile(userId: number): Promise<any | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT u.UserID, u.FullName, u.Email, u.PhoneNumber, u.Gender, u.DateOfBirth, u.Status,
             pp.Rating AS DUPR, pp.SkillLevel, pp.PlayingRole
      FROM Users u
      LEFT JOIN PlayerProfiles pp ON u.UserID = pp.UserID
      WHERE u.UserID = @UserID AND u.Status = 'Active'
    `);
  return result.recordset[0] ?? null;
}

/**
 * Count active registrations in division
 */
export async function countActiveRegistrationsInDivision(divisionId: number): Promise<number> {
  const pool = await getPool();
  const result = await pool.request()
    .input("DivisionID", sql.Int, divisionId)
    .query(`
      SELECT COUNT(*) AS Total FROM TournamentRegistrations
      WHERE DivisionID = @DivisionID AND RegistrationStatus NOT IN ('Cancelled', 'Rejected')
    `);
  return result.recordset[0].Total;
}

/**
 * Find if user is in an active team in the same division
 */
export async function findUserActiveTeamInDivision(divisionId: number, userId: number): Promise<any | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("DivisionID", sql.Int, divisionId)
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT tm.TeamMemberID, tm.TeamID, tm.JoinStatus, t.TeamStatus
      FROM TournamentTeamMembers tm
      INNER JOIN TournamentTeams t ON tm.TeamID = t.TeamID
      WHERE tm.DivisionID = @DivisionID AND tm.UserID = @UserID
        AND tm.JoinStatus IN ('Pending', 'Accepted')
        AND t.TeamStatus NOT IN ('Rejected', 'Withdrawn')
    `);
  return result.recordset[0] ?? null;
}

/**
 * Transaction: Register Singles
 */
export async function registerSinglesTransaction(params: {
  tournamentId: number;
  divisionId: number;
  userId: number;
}): Promise<any> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // Check MaxTeams limit inside transaction
    await new sql.Request(transaction)
      .input("DivisionID", sql.Int, params.divisionId)
      .query(`
        DECLARE @MaxTeams INT;
        SELECT @MaxTeams = MaxTeams 
        FROM TournamentDivisions WITH (UPDLOCK, HOLDLOCK)
        WHERE DivisionID = @DivisionID;

        DECLARE @ActiveCount INT;
        SELECT @ActiveCount = COUNT(*) 
        FROM TournamentRegistrations WITH (UPDLOCK, HOLDLOCK)
        WHERE DivisionID = @DivisionID 
          AND (
            RegistrationStatus IN ('Confirmed', 'Paid')
            OR (RegistrationStatus = 'PendingPayment' AND (PaymentExpiredAt IS NULL OR PaymentExpiredAt >= GETDATE()))
          );

        IF @ActiveCount >= @MaxTeams
        BEGIN
          THROW 50000, N'Nội dung thi đấu này đã đủ số lượng đội tối đa', 1;
        END;
      `);

    const teamCode = `TEAM-S-${params.userId}-${Date.now().toString().slice(-6)}`;
    const teamName = `Player_${params.userId}`;

    // 1. Create team
    const teamResult = await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamName", sql.NVarChar(255), teamName)
      .input("TeamCode", sql.NVarChar(50), teamCode)
      .input("CreatedBy", sql.Int, params.userId)
      .query(`
        INSERT INTO TournamentTeams (TournamentID, DivisionID, TeamName, TeamCode, CreatedBy, TeamStatus, CreatedAt)
        OUTPUT INSERTED.TeamID
        VALUES (@TournamentID, @DivisionID, @TeamName, @TeamCode, @CreatedBy, 'TeamConfirmed', GETDATE())
      `);
    
    const teamId = teamResult.recordset[0].TeamID;

    // 2. Create member
    await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamID", sql.Int, teamId)
      .input("UserID", sql.Int, params.userId)
      .query(`
        INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus, JoinedAt)
        VALUES (@TournamentID, @DivisionID, @TeamID, @UserID, 'Leader', 'Accepted', GETDATE())
      `);

    // 3. Create registration
    const regResult = await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamID", sql.Int, teamId)
      .input("RegisteredBy", sql.Int, params.userId)
      .query(`
        INSERT INTO TournamentRegistrations (TournamentID, DivisionID, TeamID, RegisteredBy, RegistrationStatus, PaymentStatus, RegisteredAt, PaymentExpiredAt)
        OUTPUT INSERTED.*
        VALUES (@TournamentID, @DivisionID, @TeamID, @RegisteredBy, 'PendingPayment', 'Unpaid', GETDATE(), DATEADD(minute, 10, GETDATE()))
      `);

    await transaction.commit();
    return regResult.recordset[0];
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Transaction: Register Manual Form Athletes (Singles/Doubles direct entry)
 */
export async function registerManualAthletesTransaction(params: {
  tournamentId: number;
  divisionId: number;
  userId: number;
  teamName: string;
  fee: number;
  athletes: Array<{
    athleteNo: number;
    fullName: string;
    phoneNumber: string;
    rating: number;
    province: string;
    gender: string;
    dateOfBirth: string;
    photoUrl?: string;
    cccdUrl?: string | null;
    note?: string;
  }>;
}): Promise<any> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // Check MaxTeams limit inside transaction
    await new sql.Request(transaction)
      .input("DivisionID", sql.Int, params.divisionId)
      .query(`
        DECLARE @MaxTeams INT;
        SELECT @MaxTeams = MaxTeams 
        FROM TournamentDivisions WITH (UPDLOCK, HOLDLOCK)
        WHERE DivisionID = @DivisionID;

        DECLARE @ActiveCount INT;
        SELECT @ActiveCount = COUNT(*) 
        FROM TournamentRegistrations WITH (UPDLOCK, HOLDLOCK)
        WHERE DivisionID = @DivisionID 
          AND (
            RegistrationStatus IN ('Confirmed', 'Paid')
            OR (RegistrationStatus = 'PendingPayment' AND (PaymentExpiredAt IS NULL OR PaymentExpiredAt >= GETDATE()))
          );

        IF @ActiveCount >= @MaxTeams
        BEGIN
          THROW 50000, N'Nội dung thi đấu này đã đủ số lượng đội tối đa', 1;
        END;
      `);

    const teamCode = `TEAM-M-${params.userId}-${Date.now().toString().slice(-6)}`;
    
    // 1. Create team
    const teamResult = await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamName", sql.NVarChar(255), params.teamName || `Team_${params.userId}`)
      .input("TeamCode", sql.NVarChar(50), teamCode)
      .input("CreatedBy", sql.Int, params.userId)
      .query(`
        INSERT INTO TournamentTeams (TournamentID, DivisionID, TeamName, TeamCode, CreatedBy, TeamStatus, CreatedAt)
        OUTPUT INSERTED.TeamID
        VALUES (@TournamentID, @DivisionID, @TeamName, @TeamCode, @CreatedBy, 'TeamConfirmed', GETDATE())
      `);
    
    const teamId = teamResult.recordset[0].TeamID;

    // 2. Add Leader Member
    await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamID", sql.Int, teamId)
      .input("UserID", sql.Int, params.userId)
      .query(`
        INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus, JoinedAt)
        VALUES (@TournamentID, @DivisionID, @TeamID, @UserID, 'Leader', 'Accepted', GETDATE())
      `);

    // 3. Create Registration
    const regStatus = params.fee > 0 ? "PendingPayment" : "Confirmed";
    const regResult = await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamID", sql.Int, teamId)
      .input("RegisteredBy", sql.Int, params.userId)
      .input("RegistrationStatus", sql.NVarChar(50), regStatus)
      .query(`
        INSERT INTO TournamentRegistrations (TournamentID, DivisionID, TeamID, RegisteredBy, RegistrationStatus, PaymentStatus, RegisteredAt, PaymentExpiredAt)
        OUTPUT INSERTED.*
        VALUES (@TournamentID, @DivisionID, @TeamID, @RegisteredBy, @RegistrationStatus, 'Unpaid', GETDATE(), 
                CASE WHEN @RegistrationStatus = 'PendingPayment' THEN DATEADD(minute, 10, GETDATE()) ELSE NULL END)
      `);

    const registration = regResult.recordset[0];
    const registrationId = registration.RegistrationID;

    // 4. Create Registration Athletes
    for (const ath of params.athletes) {
      // Find matching user ID by phone number if possible
      let matchedUserId: number | null = null;
      if (ath.athleteNo === 1) {
        matchedUserId = params.userId;
      } else {
        const userRes = await new sql.Request(transaction)
          .input("Phone", sql.NVarChar(20), ath.phoneNumber)
          .query("SELECT TOP 1 UserID FROM Users WHERE PhoneNumber = @Phone");
        if (userRes.recordset.length > 0) {
          matchedUserId = userRes.recordset[0].UserID;
        }
      }

      await new sql.Request(transaction)
        .input("RegistrationID", sql.Int, registrationId)
        .input("TournamentID", sql.Int, params.tournamentId)
        .input("DivisionID", sql.Int, params.divisionId)
        .input("TeamID", sql.Int, teamId)
        .input("UserID", sql.Int, matchedUserId)
        .input("AthleteNo", sql.Int, ath.athleteNo)
        .input("FullName", sql.NVarChar(255), ath.fullName)
        .input("PhoneNumber", sql.NVarChar(20), ath.phoneNumber)
        .input("Rating", sql.Decimal(4,2), ath.rating)
        .input("Province", sql.NVarChar(100), ath.province)
        .input("Gender", sql.NVarChar(20), ath.gender)
        .input("DateOfBirth", sql.Date, ath.dateOfBirth)
        .input("PhotoURL", sql.NVarChar(500), ath.photoUrl || null)
        .input("CccdURL", sql.NVarChar(500), ath.cccdUrl || null)
        .input("Email", sql.NVarChar(255), ath.email || null)
        .input("Note", sql.NVarChar(500), ath.note || null)
        .query(`
          INSERT INTO TournamentRegistrationAthletes (
            RegistrationID, TournamentID, DivisionID, TeamID, UserID,
            AthleteNo, FullName, PhoneNumber, Rating, Province, Gender, DateOfBirth, PhotoURL, CccdURL, Email, Note, CreatedAt, UpdatedAt
          )
          VALUES (
            @RegistrationID, @TournamentID, @DivisionID, @TeamID, @UserID,
            @AthleteNo, @FullName, @PhoneNumber, @Rating, @Province, @Gender, @DateOfBirth, @PhotoURL, @CccdURL, @Email, @Note, GETDATE(), GETDATE()
          )
        `);
    }

    await transaction.commit();
    return registration;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}


/**
 * Transaction: Register Doubles with Existing Partner
 */
export async function registerDoublesExistingPartnerTransaction(params: {
  tournamentId: number;
  divisionId: number;
  userId: number;
  partnerId: number;
}): Promise<any> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const teamCode = `TEAM-D-${params.userId}-${Date.now().toString().slice(-6)}`;
    const teamName = `Team_${params.userId}_${params.partnerId}`;

    // 1. Create team
    const teamResult = await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamName", sql.NVarChar(255), teamName)
      .input("TeamCode", sql.NVarChar(50), teamCode)
      .input("CreatedBy", sql.Int, params.userId)
      .query(`
        INSERT INTO TournamentTeams (TournamentID, DivisionID, TeamName, TeamCode, CreatedBy, TeamStatus, CreatedAt)
        OUTPUT INSERTED.TeamID
        VALUES (@TournamentID, @DivisionID, @TeamName, @TeamCode, @CreatedBy, 'PendingMemberConfirm', GETDATE())
      `);
    
    const teamId = teamResult.recordset[0].TeamID;

    // 2. Add creator
    await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamID", sql.Int, teamId)
      .input("UserID", sql.Int, params.userId)
      .query(`
        INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus, JoinedAt)
        VALUES (@TournamentID, @DivisionID, @TeamID, @UserID, 'Leader', 'Accepted', GETDATE())
      `);

    // 3. Add partner (Pending status)
    await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamID", sql.Int, teamId)
      .input("UserID", sql.Int, params.partnerId)
      .query(`
        INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus, JoinedAt)
        VALUES (@TournamentID, @DivisionID, @TeamID, @UserID, 'Member', 'Pending', GETDATE())
      `);

    // 4. Create Invitation
    const expiredAt = new Date();
    expiredAt.setHours(expiredAt.getHours() + 48); // BR-T24

    const inviteResult = await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamID", sql.Int, teamId)
      .input("SenderID", sql.Int, params.userId)
      .input("ReceiverID", sql.Int, params.partnerId)
      .input("ExpiredAt", sql.DateTime, expiredAt)
      .query(`
        INSERT INTO TournamentTeamInvitations (TournamentID, DivisionID, TeamID, SenderID, ReceiverID, InvitationStatus, ExpiredAt, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@TournamentID, @DivisionID, @TeamID, @SenderID, @ReceiverID, 'Pending', @ExpiredAt, GETDATE())
      `);

    await transaction.commit();
    return inviteResult.recordset[0];
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Find Invitation by ID
 */
export async function findInvitationById(invitationId: number): Promise<any | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("InvitationID", sql.Int, invitationId)
    .query(`
      SELECT * FROM TournamentTeamInvitations
      WHERE InvitationID = @InvitationID
    `);
  return result.recordset[0] ?? null;
}

/**
 * Transaction: Respond to Invitation (Accept or Decline)
 */
export async function respondInvitationTransaction(params: {
  invitationId: number;
  teamId: number;
  divisionId: number;
  tournamentId: number;
  userId: number;
  partnerId: number;
  action: "Accepted" | "Declined";
}): Promise<any> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Update Invitation
    await new sql.Request(transaction)
      .input("InvitationID", sql.Int, params.invitationId)
      .input("Status", sql.NVarChar(50), params.action)
      .query(`
        UPDATE TournamentTeamInvitations
        SET InvitationStatus = @Status, RespondedAt = GETDATE()
        WHERE InvitationID = @InvitationID
      `);

    if (params.action === "Accepted") {
      // 2. Update member to Accepted
      await new sql.Request(transaction)
        .input("TeamID", sql.Int, params.teamId)
        .input("UserID", sql.Int, params.userId)
        .query(`
          UPDATE TournamentTeamMembers
          SET JoinStatus = 'Accepted', JoinedAt = GETDATE()
          WHERE TeamID = @TeamID AND UserID = @UserID
        `);

      // 3. Count accepted members
      const countResult = await new sql.Request(transaction)
        .input("TeamID", sql.Int, params.teamId)
        .query(`
          SELECT COUNT(*) AS AcceptedCount FROM TournamentTeamMembers
          WHERE TeamID = @TeamID AND JoinStatus = 'Accepted'
        `);

      const acceptedCount = countResult.recordset[0].AcceptedCount;

      if (acceptedCount === 2) {
        // Check MaxTeams limit inside transaction
        await new sql.Request(transaction)
          .input("DivisionID", sql.Int, params.divisionId)
          .query(`
            DECLARE @MaxTeams INT;
            SELECT @MaxTeams = MaxTeams 
            FROM TournamentDivisions WITH (UPDLOCK, HOLDLOCK)
            WHERE DivisionID = @DivisionID;

            DECLARE @ActiveCount INT;
            SELECT @ActiveCount = COUNT(*) 
            FROM TournamentRegistrations WITH (UPDLOCK, HOLDLOCK)
            WHERE DivisionID = @DivisionID 
              AND (
                RegistrationStatus IN ('Confirmed', 'Paid')
                OR (RegistrationStatus = 'PendingPayment' AND (PaymentExpiredAt IS NULL OR PaymentExpiredAt >= GETDATE()))
              );

            IF @ActiveCount >= @MaxTeams
            BEGIN
              THROW 50000, N'Nội dung thi đấu này đã đủ số lượng đội tối đa', 1;
            END;
          `);

        // 4. Update Team status -> TeamConfirmed
        await new sql.Request(transaction)
          .input("TeamID", sql.Int, params.teamId)
          .query(`
            UPDATE TournamentTeams
            SET TeamStatus = 'TeamConfirmed'
            WHERE TeamID = @TeamID
          `);

        // 5. Create Registration (PendingPayment)
        const regResult = await new sql.Request(transaction)
          .input("TournamentID", sql.Int, params.tournamentId)
          .input("DivisionID", sql.Int, params.divisionId)
          .input("TeamID", sql.Int, params.teamId)
          .input("RegisteredBy", sql.Int, params.partnerId) // creator/partner
          .query(`
            INSERT INTO TournamentRegistrations (TournamentID, DivisionID, TeamID, RegisteredBy, RegistrationStatus, PaymentStatus, RegisteredAt, PaymentExpiredAt)
            OUTPUT INSERTED.*
            VALUES (@TournamentID, @DivisionID, @TeamID, @RegisteredBy, 'PendingPayment', 'Unpaid', GETDATE(), DATEADD(minute, 10, GETDATE()))
          `);

        const registration = regResult.recordset[0];

        // 6. Create Registration Athletes (Snapshots from Users and PlayerProfiles)
        const playersRes = await new sql.Request(transaction)
          .input("User1", sql.Int, params.partnerId)
          .input("User2", sql.Int, params.userId)
          .query(`
            SELECT u.UserID, u.FullName, u.PhoneNumber, u.Gender, u.DateOfBirth, u.Address, u.Email,
                   ISNULL(pp.Rating, 0.0) AS Rating
            FROM Users u
            LEFT JOIN PlayerProfiles pp ON u.UserID = pp.UserID
            WHERE u.UserID IN (@User1, @User2)
          `);

        const player1 = playersRes.recordset.find(p => p.UserID === params.partnerId);
        const player2 = playersRes.recordset.find(p => p.UserID === params.userId);

        if (player1) {
          await new sql.Request(transaction)
            .input("RegistrationID", sql.Int, registration.RegistrationID)
            .input("TournamentID", sql.Int, params.tournamentId)
            .input("DivisionID", sql.Int, params.divisionId)
            .input("TeamID", sql.Int, params.teamId)
            .input("UserID", sql.Int, player1.UserID)
            .input("FullName", sql.NVarChar(255), player1.FullName)
            .input("PhoneNumber", sql.NVarChar(20), player1.PhoneNumber || "0000000000")
            .input("Rating", sql.Decimal(4,2), player1.Rating)
            .input("Province", sql.NVarChar(100), player1.Address || "Chưa cập nhật")
            .input("Gender", sql.NVarChar(20), player1.Gender || "Male")
            .input("DateOfBirth", sql.Date, player1.DateOfBirth || new Date("2000-01-01"))
            .input("Email", sql.NVarChar(255), player1.Email || null)
            .query(`
              INSERT INTO TournamentRegistrationAthletes (
                RegistrationID, TournamentID, DivisionID, TeamID, UserID,
                AthleteNo, FullName, PhoneNumber, Rating, Province, Gender, DateOfBirth, Email, CreatedAt, UpdatedAt
              )
              VALUES (
                @RegistrationID, @TournamentID, @DivisionID, @TeamID, @UserID,
                1, @FullName, @PhoneNumber, @Rating, @Province, @Gender, @DateOfBirth, @Email, GETDATE(), GETDATE()
              )
            `);
        }

        if (player2) {
          await new sql.Request(transaction)
            .input("RegistrationID", sql.Int, registration.RegistrationID)
            .input("TournamentID", sql.Int, params.tournamentId)
            .input("DivisionID", sql.Int, params.divisionId)
            .input("TeamID", sql.Int, params.teamId)
            .input("UserID", sql.Int, player2.UserID)
            .input("FullName", sql.NVarChar(255), player2.FullName)
            .input("PhoneNumber", sql.NVarChar(20), player2.PhoneNumber || "0000000000")
            .input("Rating", sql.Decimal(4,2), player2.Rating)
            .input("Province", sql.NVarChar(100), player2.Address || "Chưa cập nhật")
            .input("Gender", sql.NVarChar(20), player2.Gender || "Male")
            .input("DateOfBirth", sql.Date, player2.DateOfBirth || new Date("2000-01-01"))
            .input("Email", sql.NVarChar(255), player2.Email || null)
            .query(`
              INSERT INTO TournamentRegistrationAthletes (
                RegistrationID, TournamentID, DivisionID, TeamID, UserID,
                AthleteNo, FullName, PhoneNumber, Rating, Province, Gender, DateOfBirth, Email, CreatedAt, UpdatedAt
              )
              VALUES (
                @RegistrationID, @TournamentID, @DivisionID, @TeamID, @UserID,
                2, @FullName, @PhoneNumber, @Rating, @Province, @Gender, @DateOfBirth, @Email, GETDATE(), GETDATE()
              )
            `);
        }

        await transaction.commit();
        return { registration };
      } else {
        // Only 1 user has accepted so far (in AutoMatch scenario)
        await transaction.commit();
        return { registration: null };
      }
    } else {
      // If Declined
      // 2. Update member to Declined
      await new sql.Request(transaction)
        .input("TeamID", sql.Int, params.teamId)
        .input("UserID", sql.Int, params.userId)
        .query(`
          UPDATE TournamentTeamMembers
          SET JoinStatus = 'Declined'
          WHERE TeamID = @TeamID AND UserID = @UserID
        `);

      // 3. Update Team status to Rejected
      await new sql.Request(transaction)
        .input("TeamID", sql.Int, params.teamId)
        .query(`
          UPDATE TournamentTeams
          SET TeamStatus = 'Rejected'
          WHERE TeamID = @TeamID
        `);

      await transaction.commit();
      return { registration: null };
    }
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Find suggested partners based on division requirements and DUPR closeness
 */
export async function findSuggestedPartnersQuery(params: {
  requesterId: number;
  divisionId: number;
  genderReq: string;
  requesterGender: string;
  minDUPR?: number | null;
  maxDUPR?: number | null;
  minBirthDate?: Date | null;
  maxBirthDate?: Date | null;
  requesterDUPR: number;
}): Promise<any[]> {
  const pool = await getPool();
  const request = pool.request()
    .input("RequesterID", sql.Int, params.requesterId)
    .input("DivisionID", sql.Int, params.divisionId)
    .input("RequesterDUPR", sql.Decimal(4,2), params.requesterDUPR);

  let query = `
    SELECT u.UserID, u.FullName, u.Email, u.PhoneNumber, u.Gender, u.DateOfBirth,
           pp.Rating AS DUPR, pp.SkillLevel, pp.PlayingRole
    FROM Users u
    INNER JOIN PlayerProfiles pp ON u.UserID = pp.UserID
    WHERE u.UserID <> @RequesterID
      AND u.Status = 'Active'
      -- Exclude players who are already on an active team in this division
      AND NOT EXISTS (
        SELECT 1 FROM TournamentTeamMembers tm
        INNER JOIN TournamentTeams t ON tm.TeamID = t.TeamID
        WHERE tm.DivisionID = @DivisionID AND tm.UserID = u.UserID
          AND tm.JoinStatus IN ('Pending', 'Accepted')
          AND t.TeamStatus NOT IN ('Rejected', 'Withdrawn')
      )
  `;

  // Gender Requirements (BR-T09/T10/T11)
  if (params.genderReq === "MaleOnly") {
    query += " AND u.Gender = 'Male'";
  } else if (params.genderReq === "FemaleOnly") {
    query += " AND u.Gender = 'Female'";
  } else if (params.genderReq === "Mixed") {
    // Mixed means partner must be opposite gender
    if (params.requesterGender === "Male") {
      query += " AND u.Gender = 'Female'";
    } else {
      query += " AND u.Gender = 'Male'";
    }
  }

  // Age group constraints (computed in JS and passed as Dates)
  if (params.minBirthDate) {
    request.input("MinBirthDate", sql.DateTime, params.minBirthDate);
    query += " AND u.DateOfBirth <= @MinBirthDate";
  }
  if (params.maxBirthDate) {
    request.input("MaxBirthDate", sql.DateTime, params.maxBirthDate);
    query += " AND u.DateOfBirth > @MaxBirthDate";
  }

  // DUPR limits (BR-T12)
  if (params.minDUPR !== undefined && params.minDUPR !== null) {
    request.input("MinDUPR", sql.Decimal(4,2), params.minDUPR);
    query += " AND pp.Rating >= @MinDUPR";
  }
  if (params.maxDUPR !== undefined && params.maxDUPR !== null) {
    request.input("MaxDUPR", sql.Decimal(4,2), params.maxDUPR);
    query += " AND pp.Rating <= @MaxDUPR";
  }

  query += " ORDER BY ABS(pp.Rating - @RequesterDUPR) ASC";

  const result = await request.query(query);
  return result.recordset;
}

/**
 * Find all active partner requests in a division
 */
export async function findActivePartnerRequests(divisionId: number): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input("DivisionID", sql.Int, divisionId)
    .query(`
      SELECT pr.*, u.Gender, u.DateOfBirth, pp.Rating AS DUPR
      FROM TournamentPartnerRequests pr
      INNER JOIN Users u ON pr.RequesterID = u.UserID
      INNER JOIN PlayerProfiles pp ON pr.RequesterID = pp.UserID
      WHERE pr.DivisionID = @DivisionID AND pr.RequestStatus = 'LookingForPartner'
    `);
  return result.recordset;
}

/**
 * Find partner request by requester and division
 */
export async function findPartnerRequestByRequester(divisionId: number, requesterId: number): Promise<any | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("DivisionID", sql.Int, divisionId)
    .input("RequesterID", sql.Int, requesterId)
    .query(`
      SELECT * FROM TournamentPartnerRequests
      WHERE DivisionID = @DivisionID AND RequesterID = @RequesterID
        AND RequestStatus IN ('LookingForPartner', 'Suggested', 'AutoMatched', 'WaitingBothConfirm')
    `);
  return result.recordset[0] ?? null;
}

/**
 * Create a partner request
 */
export async function createPartnerRequest(data: {
  tournamentId: number;
  divisionId: number;
  requesterId: number;
  matchingMode: string;
  preferredDUPRMin?: number | null;
  preferredDUPRMax?: number | null;
  preferredGender?: string | null;
  requestStatus: string;
}): Promise<any> {
  const pool = await getPool();
  const result = await pool.request()
    .input("TournamentID", sql.Int, data.tournamentId)
    .input("DivisionID", sql.Int, data.divisionId)
    .input("RequesterID", sql.Int, data.requesterId)
    .input("MatchingMode", sql.VarChar(50), data.matchingMode)
    .input("PreferredDUPRMin", sql.Decimal(4,2), data.preferredDUPRMin ?? null)
    .input("PreferredDUPRMax", sql.Decimal(4,2), data.preferredDUPRMax ?? null)
    .input("PreferredGender", sql.NVarChar(50), data.preferredGender ?? null)
    .input("RequestStatus", sql.NVarChar(50), data.requestStatus)
    .query(`
      INSERT INTO TournamentPartnerRequests (
        TournamentID, DivisionID, RequesterID, MatchingMode, 
        PreferredDUPRMin, PreferredDUPRMax, PreferredGender, RequestStatus, CreatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @TournamentID, @DivisionID, @RequesterID, @MatchingMode, 
        @PreferredDUPRMin, @PreferredDUPRMax, @PreferredGender, @RequestStatus, GETDATE()
      )
    `);
  return result.recordset[0];
}

/**
 * Update partner request status
 */
export async function updatePartnerRequestStatus(
  requestId: number,
  status: string,
  matchedUserId?: number | null,
  matchedTeamId?: number | null
): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input("RequestID", sql.Int, requestId)
    .input("Status", sql.NVarChar(50), status)
    .input("MatchedUserID", sql.Int, matchedUserId ?? null)
    .input("MatchedTeamID", sql.Int, matchedTeamId ?? null)
    .query(`
      UPDATE TournamentPartnerRequests
      SET RequestStatus = @Status, MatchedUserID = @MatchedUserID, MatchedTeamID = @MatchedTeamID
      WHERE RequestID = @RequestID
    `);
}

/**
 * Transaction: Create Team and Invitations for AutoMatched players
 */
export async function createAutoMatchTeamTransaction(params: {
  tournamentId: number;
  divisionId: number;
  userAId: number;
  userBId: number;
  requestAId: number;
  requestBId: number;
}): Promise<any> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const teamCode = `TEAM-A-${params.userAId}-${params.userBId}-${Date.now().toString().slice(-4)}`;
    const teamName = `AutoTeam_${params.userAId}_${params.userBId}`;

    // 1. Create team (Status: PendingMemberConfirm or AutoMatching)
    const teamResult = await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamName", sql.NVarChar(255), teamName)
      .input("TeamCode", sql.NVarChar(50), teamCode)
      .input("CreatedBy", sql.Int, params.userAId) // default A as creator
      .query(`
        INSERT INTO TournamentTeams (TournamentID, DivisionID, TeamName, TeamCode, CreatedBy, TeamStatus, CreatedAt)
        OUTPUT INSERTED.TeamID
        VALUES (@TournamentID, @DivisionID, @TeamName, @TeamCode, @CreatedBy, 'PendingMemberConfirm', GETDATE())
      `);

    const teamId = teamResult.recordset[0].TeamID;

    // 2. Add User A (Pending)
    await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamID", sql.Int, teamId)
      .input("UserID", sql.Int, params.userAId)
      .query(`
        INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus, JoinedAt)
        VALUES (@TournamentID, @DivisionID, @TeamID, @UserID, 'Leader', 'Pending', GETDATE())
      `);

    // 3. Add User B (Pending)
    await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamID", sql.Int, teamId)
      .input("UserID", sql.Int, params.userBId)
      .query(`
        INSERT INTO TournamentTeamMembers (TournamentID, DivisionID, TeamID, UserID, MemberRole, JoinStatus, JoinedAt)
        VALUES (@TournamentID, @DivisionID, @TeamID, @UserID, 'Member', 'Pending', GETDATE())
      `);

    // 4. Create Invitation 1: For User A (sender is B)
    const expiredAt = new Date();
    expiredAt.setHours(expiredAt.getHours() + 48);

    const inviteAResult = await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamID", sql.Int, teamId)
      .input("SenderID", sql.Int, params.userBId)
      .input("ReceiverID", sql.Int, params.userAId)
      .input("ExpiredAt", sql.DateTime, expiredAt)
      .query(`
        INSERT INTO TournamentTeamInvitations (TournamentID, DivisionID, TeamID, SenderID, ReceiverID, InvitationStatus, ExpiredAt, CreatedAt)
        OUTPUT INSERTED.InvitationID
        VALUES (@TournamentID, @DivisionID, @TeamID, @SenderID, @ReceiverID, 'Pending', @ExpiredAt, GETDATE())
      `);

    const inviteAId = inviteAResult.recordset[0].InvitationID;

    // 5. Create Invitation 2: For User B (sender is A)
    const inviteBResult = await new sql.Request(transaction)
      .input("TournamentID", sql.Int, params.tournamentId)
      .input("DivisionID", sql.Int, params.divisionId)
      .input("TeamID", sql.Int, teamId)
      .input("SenderID", sql.Int, params.userAId)
      .input("ReceiverID", sql.Int, params.userBId)
      .input("ExpiredAt", sql.DateTime, expiredAt)
      .query(`
        INSERT INTO TournamentTeamInvitations (TournamentID, DivisionID, TeamID, SenderID, ReceiverID, InvitationStatus, ExpiredAt, CreatedAt)
        OUTPUT INSERTED.InvitationID
        VALUES (@TournamentID, @DivisionID, @TeamID, @SenderID, @ReceiverID, 'Pending', @ExpiredAt, GETDATE())
      `);

    const inviteBId = inviteBResult.recordset[0].InvitationID;

    // 6. Update both requests to WaitingBothConfirm, set matched variables
    await new sql.Request(transaction)
      .input("RequestID", sql.Int, params.requestAId)
      .input("MatchedUserID", sql.Int, params.userBId)
      .input("MatchedTeamID", sql.Int, teamId)
      .query(`
        UPDATE TournamentPartnerRequests
        SET RequestStatus = 'WaitingBothConfirm', MatchedUserID = @MatchedUserID, MatchedTeamID = @MatchedTeamID
        WHERE RequestID = @RequestID
      `);

    await new sql.Request(transaction)
      .input("RequestID", sql.Int, params.requestBId)
      .input("MatchedUserID", sql.Int, params.userAId)
      .input("MatchedTeamID", sql.Int, teamId)
      .query(`
        UPDATE TournamentPartnerRequests
        SET RequestStatus = 'WaitingBothConfirm', MatchedUserID = @MatchedUserID, MatchedTeamID = @MatchedTeamID
        WHERE RequestID = @RequestID
      `);

    await transaction.commit();
    return { teamId, inviteAId, inviteBId };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Get latest pending payment by registration ID
 */
export async function getLatestPendingPaymentByRegistration(registrationId: number): Promise<any | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("RegistrationID", sql.Int, registrationId)
    .query(`
      SELECT TOP 1 * FROM TournamentPayments
      WHERE RegistrationID = @RegistrationID
      ORDER BY CreatedAt DESC
    `);
  return result.recordset[0] ?? null;
}

/**
 * Retrieve registration details and its team members for payment verification
 */
export async function findRegistrationForPayment(registrationId: number): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input("RegistrationID", sql.Int, registrationId)
    .query(`
      SELECT r.*, d.RegistrationFee, d.DivisionName, t.TournamentName, t.RegistrationEnd,
             t.Status AS TournamentStatus, tm.UserID, tm.JoinStatus, tm.MemberRole
      FROM TournamentRegistrations r
      INNER JOIN TournamentDivisions d ON r.DivisionID = d.DivisionID
      INNER JOIN Tournaments t ON r.TournamentID = t.TournamentID
      INNER JOIN TournamentTeamMembers tm ON r.TeamID = tm.TeamID
      WHERE r.RegistrationID = @RegistrationID
    `);
  return result.recordset;
}

/**
 * Create a new payment record
 */
export async function createTournamentPayment(data: {
  registrationId: number;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
}): Promise<any> {
  const pool = await getPool();
  const result = await pool.request()
    .input("RegistrationID", sql.Int, data.registrationId)
    .input("Amount", sql.Decimal(18,2), data.amount)
    .input("PaymentMethod", sql.NVarChar(50), data.paymentMethod)
    .input("PaymentStatus", sql.NVarChar(50), data.paymentStatus)
    .query(`
      INSERT INTO TournamentPayments (RegistrationID, Amount, PaymentMethod, PaymentStatus, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@RegistrationID, @Amount, @PaymentMethod, @PaymentStatus, GETDATE())
    `);
  return result.recordset[0];
}

/**
 * Find payment record by ID
 */
export async function findPaymentById(paymentId: number): Promise<any | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("PaymentID", sql.Int, paymentId)
    .query(`
      SELECT * FROM TournamentPayments
      WHERE TournamentPaymentID = @PaymentID
    `);
  return result.recordset[0] ?? null;
}

/**
 * Transaction: Update payment status to paid, confirm registration, and confirm team
 */
export async function confirmPaymentTransaction(params: {
  paymentId: number;
  transactionCode: string;
  gatewayResponse?: string;
}): Promise<any> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Update Payment status to Paid
    const payResult = await new sql.Request(transaction)
      .input("PaymentID", sql.Int, params.paymentId)
      .input("TransactionCode", sql.NVarChar(255), params.transactionCode)
      .input("GatewayResponse", sql.NVarChar(sql.MAX), params.gatewayResponse || null)
      .query(`
        UPDATE TournamentPayments
        SET PaymentStatus = 'Paid', TransactionCode = @TransactionCode, GatewayResponse = @GatewayResponse, PaidAt = GETDATE()
        OUTPUT INSERTED.*
        WHERE TournamentPaymentID = @PaymentID
      `);

    const payment = payResult.recordset[0];

    // 2. Update Registration status to Confirmed
    const regResult = await new sql.Request(transaction)
      .input("RegistrationID", sql.Int, payment.RegistrationID)
      .query(`
        UPDATE TournamentRegistrations
        SET RegistrationStatus = 'Confirmed', PaymentStatus = 'Paid', ConfirmedAt = GETDATE()
        OUTPUT INSERTED.*
        WHERE RegistrationID = @RegistrationID
      `);

    const registration = regResult.recordset[0];

    // 3. Update Team status to Registered
    await new sql.Request(transaction)
      .input("TeamID", sql.Int, registration.TeamID)
      .query(`
        UPDATE TournamentTeams
        SET TeamStatus = 'Registered'
        WHERE TeamID = @TeamID
      `);

    await transaction.commit();
    return { payment, registration };
    await transaction.commit();
    return { payment, registration };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Find confirmed and paid teams in a division
 */
export async function findConfirmedTeamsInDivision(divisionId: number): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input("DivisionID", sql.Int, divisionId)
    .query(`
      SELECT t.* FROM TournamentTeams t
      INNER JOIN TournamentRegistrations r ON t.TeamID = r.TeamID
      WHERE r.DivisionID = @DivisionID AND r.RegistrationStatus IN ('Confirmed', 'Paid')
      ORDER BY t.SeedNo ASC, t.TeamID ASC
    `);
  return result.recordset;
}

/**
 * Delete existing matches for a division (clean slate)
 */
export async function deleteDivisionMatches(divisionId: number, transaction?: sql.Transaction): Promise<void> {
  const pool = await getPool();
  const request = transaction ? new sql.Request(transaction) : pool.request();
  
  // Clean blocks, check-ins, scores, and matches
  await request.input("DivisionID", sql.Int, divisionId).query(`
    DELETE FROM TournamentCourtBlocks WHERE DivisionID = @DivisionID;
    DELETE FROM TournamentMatchCheckIns WHERE MatchID IN (SELECT MatchID FROM TournamentMatches WHERE DivisionID = @DivisionID);
    DELETE FROM TournamentMatchScores WHERE MatchID IN (SELECT MatchID FROM TournamentMatches WHERE DivisionID = @DivisionID);
    DELETE FROM TournamentMatches WHERE DivisionID = @DivisionID;
    DELETE FROM TournamentStandings WHERE DivisionID = @DivisionID;
  `);
}

/**
 * Transaction: Save generated matches and advance BYE matches automatically
 */
export async function saveBracketMatchesTransaction(
  divisionId: number,
  matchesData: any[],
  bracketType: string
): Promise<void> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Delete old matches
    await deleteDivisionMatches(divisionId, transaction);

    // Map memory indices (1, 2, 3...) to database MatchIDs
    const dbMatchIds: Record<number, number> = {};

    // 2. Insert matches sequentially (from parent to children index order: 1, 2, 3...)
    for (const match of matchesData) {
      const request = new sql.Request(transaction)
        .input("TournamentID", sql.Int, match.TournamentID)
        .input("DivisionID", sql.Int, match.DivisionID)
        .input("RoundNo", sql.Int, match.RoundNo)
        .input("MatchNo", sql.Int, match.MatchNo)
        .input("GroupName", sql.NVarChar(50), match.GroupName || null)
        .input("KnockoutRound", sql.NVarChar(50), match.KnockoutRound || null)
        .input("TeamAID", sql.Int, match.TeamAID ?? null)
        .input("TeamBID", sql.Int, match.TeamBID ?? null)
        .input("WinnerTeamID", sql.Int, match.WinnerTeamID ?? null)
        .input("MatchStatus", sql.NVarChar(50), match.MatchStatus)
        .input("ScoreText", sql.NVarChar(255), match.ScoreText || null)
        .input("NextMatchSlot", sql.NVarChar(10), match.NextMatchSlot || null);

      // Resolve NextMatchID from map
      let parentDbId: number | null = null;
      if (match.parentIndex && dbMatchIds[match.parentIndex]) {
        parentDbId = dbMatchIds[match.parentIndex];
      }
      request.input("NextMatchID", sql.Int, parentDbId);

      const insertResult = await request.query(`
        INSERT INTO TournamentMatches (
          TournamentID, DivisionID, RoundNo, MatchNo, GroupName, KnockoutRound,
          TeamAID, TeamBID, WinnerTeamID, MatchStatus, ScoreText, NextMatchID, NextMatchSlot, CreatedAt, UpdatedAt
        )
        OUTPUT INSERTED.MatchID
        VALUES (
          @TournamentID, @DivisionID, @RoundNo, @MatchNo, @GroupName, @KnockoutRound,
          @TeamAID, @TeamBID, @WinnerTeamID, @MatchStatus, @ScoreText, @NextMatchID, @NextMatchSlot, GETDATE(), GETDATE()
        )
      `);

      const dbId = insertResult.recordset[0].MatchID;
      dbMatchIds[match.memIndex] = dbId;

      // 3. If match is BYE-completed, advance winner to the resolved NextMatchID parent immediately!
      if ((match.MatchStatus === "Completed" || match.MatchStatus === "ByeCompleted") && match.WinnerTeamID && parentDbId) {
        const slot = match.NextMatchSlot; // 'TeamA' or 'TeamB'
        if (slot === "TeamA" || slot === "TeamB") {
          await new sql.Request(transaction)
            .input("ParentMatchID", sql.Int, parentDbId)
            .input("WinnerTeamID", sql.Int, match.WinnerTeamID)
            .query(`
              UPDATE TournamentMatches
              SET ${slot === "TeamA" ? "TeamAID" : "TeamBID"} = @WinnerTeamID
              WHERE MatchID = @ParentMatchID
            `);
        }
      }
    }

    // 4. Initialize Standings if RoundRobin or GroupKnockout
    if (bracketType === "RoundRobin" || bracketType === "GroupKnockout") {
      const teamGroups: Record<number, string> = {};
      for (const m of matchesData) {
        if (m.TeamAID && m.GroupName) {
          teamGroups[m.TeamAID] = m.GroupName;
        }
        if (m.TeamBID && m.GroupName) {
          teamGroups[m.TeamBID] = m.GroupName;
        }
      }

      const teams = await new sql.Request(transaction)
        .input("DivisionID", sql.Int, divisionId)
        .query(`
          SELECT DISTINCT TeamID, TournamentID FROM TournamentTeams
          WHERE DivisionID = @DivisionID AND TeamStatus = 'Registered'
        `);

      for (const t of teams.recordset) {
        const groupName = teamGroups[t.TeamID] || null;
        await new sql.Request(transaction)
          .input("TournamentID", sql.Int, t.TournamentID)
          .input("DivisionID", sql.Int, divisionId)
          .input("TeamID", sql.Int, t.TeamID)
          .input("GroupName", sql.NVarChar(50), groupName)
          .query(`
            INSERT INTO TournamentStandings (TournamentID, DivisionID, TeamID, GroupName, Played, Won, Lost, PointsFor, PointsAgainst, PointDifference, RankNo)
            VALUES (@TournamentID, @DivisionID, @TeamID, @GroupName, 0, 0, 0, 0, 0, 0, 1)
          `);
      }
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Transaction: Save generated knockout stage matches (does NOT delete group matches)
 */
export async function saveKnockoutMatchesTransaction(
  divisionId: number,
  matchesData: any[]
): Promise<void> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const dbMatchIds: Record<number, number> = {};

    for (const match of matchesData) {
      const request = new sql.Request(transaction)
        .input("TournamentID", sql.Int, match.TournamentID)
        .input("DivisionID", sql.Int, match.DivisionID)
        .input("RoundNo", sql.Int, match.RoundNo)
        .input("MatchNo", sql.Int, match.MatchNo)
        .input("GroupName", sql.NVarChar(50), match.GroupName || null)
        .input("KnockoutRound", sql.NVarChar(50), match.KnockoutRound || null)
        .input("TeamAID", sql.Int, match.TeamAID ?? null)
        .input("TeamBID", sql.Int, match.TeamBID ?? null)
        .input("WinnerTeamID", sql.Int, match.WinnerTeamID ?? null)
        .input("MatchStatus", sql.NVarChar(50), match.MatchStatus)
        .input("ScoreText", sql.NVarChar(255), match.ScoreText || null)
        .input("NextMatchSlot", sql.NVarChar(10), match.NextMatchSlot || null);

      let parentDbId: number | null = null;
      if (match.parentIndex && dbMatchIds[match.parentIndex]) {
        parentDbId = dbMatchIds[match.parentIndex];
      }
      request.input("NextMatchID", sql.Int, parentDbId);

      const insertResult = await request.query(`
        INSERT INTO TournamentMatches (
          TournamentID, DivisionID, RoundNo, MatchNo, GroupName, KnockoutRound,
          TeamAID, TeamBID, WinnerTeamID, MatchStatus, ScoreText, NextMatchID, NextMatchSlot, CreatedAt, UpdatedAt
        )
        OUTPUT INSERTED.MatchID
        VALUES (
          @TournamentID, @DivisionID, @RoundNo, @MatchNo, @GroupName, @KnockoutRound,
          @TeamAID, @TeamBID, @WinnerTeamID, @MatchStatus, @ScoreText, @NextMatchID, @NextMatchSlot, GETDATE(), GETDATE()
        )
      `);

      const dbId = insertResult.recordset[0].MatchID;
      dbMatchIds[match.memIndex] = dbId;

      if ((match.MatchStatus === "Completed" || match.MatchStatus === "ByeCompleted") && match.WinnerTeamID && parentDbId) {
        const slot = match.NextMatchSlot;
        if (slot === "TeamA" || slot === "TeamB") {
          await new sql.Request(transaction)
            .input("ParentMatchID", sql.Int, parentDbId)
            .input("WinnerTeamID", sql.Int, match.WinnerTeamID)
            .query(`
              UPDATE TournamentMatches
              SET ${slot === "TeamA" ? "TeamAID" : "TeamBID"} = @WinnerTeamID
              WHERE MatchID = @ParentMatchID
            `);
        }
      }
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Retrieve matches for division
 */
export async function getDivisionMatches(divisionId: number): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input("DivisionID", sql.Int, divisionId)
    .query(`
      SELECT m.*, 
             tA.TeamName AS TeamAName, tB.TeamName AS TeamBName, tW.TeamName AS WinnerName,
             c.CourtName
      FROM TournamentMatches m
      LEFT JOIN TournamentTeams tA ON m.TeamAID = tA.TeamID
      LEFT JOIN TournamentTeams tB ON m.TeamBID = tB.TeamID
      LEFT JOIN TournamentTeams tW ON m.WinnerTeamID = tW.TeamID
      LEFT JOIN Courts c ON m.CourtID = c.CourtID
      WHERE m.DivisionID = @DivisionID
      ORDER BY m.RoundNo ASC, m.MatchNo ASC
    `);
  return result.recordset;
}

/**
 * Retrieve standings table for division
 */
export async function getDivisionStandings(divisionId: number): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input("DivisionID", sql.Int, divisionId)
    .query(`
      SELECT s.*, t.TeamName, t.TeamCode
      FROM TournamentStandings s
      INNER JOIN TournamentTeams t ON s.TeamID = t.TeamID
      WHERE s.DivisionID = @DivisionID
      ORDER BY s.RankNo ASC, s.Won DESC, s.PointDifference DESC, s.PointsFor DESC
    `);
  return result.recordset;
}

/**
 * Transaction: Save schedules and insert court blocks
 */
export async function saveMatchScheduleTransaction(
  divisionId: number,
  schedules: Array<{
    matchId: number;
    courtId: number;
    scheduledStart: Date;
    scheduledEnd: Date;
    tournamentId: number;
  }>
): Promise<void> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const requestClean = new sql.Request(transaction);
    await requestClean
      .input("DivisionID", sql.Int, divisionId)
      .query(`
        DELETE b FROM TournamentCourtBlocks b
        INNER JOIN TournamentMatches m ON b.MatchID = m.MatchID
        WHERE b.DivisionID = @DivisionID AND m.MatchStatus NOT IN ('Completed', 'InProgress')
      `);

    for (const sch of schedules) {
      // 1. Update Match
      await new sql.Request(transaction)
        .input("MatchID", sql.Int, sch.matchId)
        .input("CourtID", sql.Int, sch.courtId)
        .input("ScheduledStart", sql.DateTime, sch.scheduledStart)
        .input("ScheduledEnd", sql.DateTime, sch.scheduledEnd)
        .query(`
          UPDATE TournamentMatches
          SET CourtID = @CourtID, ScheduledStart = @ScheduledStart, ScheduledEnd = @ScheduledEnd, UpdatedAt = GETDATE()
          WHERE MatchID = @MatchID
        `);

      // 2. Create Court Block
      await new sql.Request(transaction)
        .input("TournamentID", sql.Int, sch.tournamentId)
        .input("DivisionID", sql.Int, divisionId)
        .input("MatchID", sql.Int, sch.matchId)
        .input("CourtID", sql.Int, sch.courtId)
        .input("Start", sql.DateTime, sch.scheduledStart)
        .input("End", sql.DateTime, sch.scheduledEnd)
        .query(`
          INSERT INTO TournamentCourtBlocks (TournamentID, DivisionID, MatchID, CourtID, StartDateTime, EndDateTime, Reason, Status, CreatedAt)
          VALUES (@TournamentID, @DivisionID, @MatchID, @CourtID, @Start, @End, N'Trận đấu giải', 'Active', GETDATE())
        `);
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Retrieve match details with bracket type
 */
export async function findMatchDetail(matchId: number): Promise<any | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input("MatchID", sql.Int, matchId)
    .query(`
      SELECT m.*, d.BracketType, d.DivisionName, t.TournamentName 
      FROM TournamentMatches m
      INNER JOIN TournamentDivisions d ON m.DivisionID = d.DivisionID
      INNER JOIN Tournaments t ON m.TournamentID = t.TournamentID
      WHERE m.MatchID = @MatchID
    `);
  return result.recordset[0] ?? null;
}

/**
 * Check if player is part of the match teams
 */
export async function isPlayerInMatchTeams(userId: number, teamAId: number, teamBId: number): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.request()
    .input("UserID", sql.Int, userId)
    .input("TeamAID", sql.Int, teamAId)
    .input("TeamBID", sql.Int, teamBId)
    .query(`
      SELECT COUNT(*) AS Cnt FROM TournamentTeamMembers 
      WHERE UserID = @UserID AND TeamID IN (@TeamAID, @TeamBID) AND JoinStatus = 'Accepted'
    `);
  return result.recordset[0].Cnt > 0;
}

/**
 * Transaction: Update match score records, status, and advance bracket parent team slot
 */
export async function saveMatchScoreTransaction(params: {
  matchId: number;
  winnerTeamId: number;
  scoreText: string;
  sets: Array<{ setNo: number; teamAScore: number; teamBScore: number }>;
}): Promise<any> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Delete old set scores
    await new sql.Request(transaction)
      .input("MatchID", sql.Int, params.matchId)
      .query("DELETE FROM TournamentMatchScores WHERE MatchID = @MatchID");

    // 2. Insert new set scores
    for (const set of params.sets) {
      await new sql.Request(transaction)
        .input("MatchID", sql.Int, params.matchId)
        .input("SetNo", sql.Int, set.setNo)
        .input("TeamAScore", sql.Int, set.teamAScore)
        .input("TeamBScore", sql.Int, set.teamBScore)
        .query(`
          INSERT INTO TournamentMatchScores (MatchID, SetNo, TeamAScore, TeamBScore, CreatedAt)
          VALUES (@MatchID, @SetNo, @TeamAScore, @TeamBScore, GETDATE())
        `);
    }

    // Calculate set wins & json
    let teamASetWon = 0;
    let teamBSetWon = 0;
    for (const set of params.sets) {
      if (set.teamAScore > set.teamBScore) teamASetWon++;
      else if (set.teamBScore > set.teamAScore) teamBSetWon++;
    }
    const scoreJson = JSON.stringify(params.sets);

    // 3. Update match details to Completed
    const matchResult = await new sql.Request(transaction)
      .input("MatchID", sql.Int, params.matchId)
      .input("WinnerTeamID", sql.Int, params.winnerTeamId)
      .input("ScoreText", sql.NVarChar(255), params.scoreText)
      .input("ScoreJson", sql.NVarChar(sql.MAX), scoreJson)
      .input("TeamASetWon", sql.Int, teamASetWon)
      .input("TeamBSetWon", sql.Int, teamBSetWon)
      .query(`
        UPDATE TournamentMatches
        SET MatchStatus = 'Completed', 
            WinnerTeamID = @WinnerTeamID, 
            ScoreText = @ScoreText,
            ScoreJson = @ScoreJson,
            TeamASetWon = @TeamASetWon,
            TeamBSetWon = @TeamBSetWon,
            UpdatedAt = GETDATE()
        OUTPUT INSERTED.*
        WHERE MatchID = @MatchID
      `);

    const match = matchResult.recordset[0];

    // 4. Bracket advancement
    // 4a. Advance winner to NextMatchID
    if (match.NextMatchID && match.NextMatchSlot) {
      const slot = match.NextMatchSlot; // 'TeamA' or 'TeamB'
      if (slot === "TeamA" || slot === "TeamB") {
        await new sql.Request(transaction)
          .input("ParentMatchID", sql.Int, match.NextMatchID)
          .input("WinnerTeamID", sql.Int, params.winnerTeamId)
          .query(`
            UPDATE TournamentMatches
            SET ${slot === "TeamA" ? "TeamAID" : "TeamBID"} = @WinnerTeamID
            WHERE MatchID = @ParentMatchID
          `);
      }
    }

    // 4b. Relegate loser to Third Place match if this is a Semifinal
    if (match.KnockoutRound === "Bán kết") {
      const loserTeamId = match.TeamAID === params.winnerTeamId ? match.TeamBID : match.TeamAID;
      // Find the Third Place match
      const thirdPlaceRes = await new sql.Request(transaction)
        .input("DivisionID", sql.Int, match.DivisionID)
        .query(`
          SELECT MatchID, TeamAID, TeamBID FROM TournamentMatches 
          WHERE DivisionID = @DivisionID AND KnockoutRound = N'Tranh hạng 3'
        `);
      
      if (thirdPlaceRes.recordset.length > 0) {
        const thirdPlaceMatch = thirdPlaceRes.recordset[0];
        // Assign to the first available slot
        if (!thirdPlaceMatch.TeamAID) {
          await new sql.Request(transaction)
            .input("MatchID", sql.Int, thirdPlaceMatch.MatchID)
            .input("LoserTeamID", sql.Int, loserTeamId)
            .query("UPDATE TournamentMatches SET TeamAID = @LoserTeamID WHERE MatchID = @MatchID");
        } else if (!thirdPlaceMatch.TeamBID && thirdPlaceMatch.TeamAID !== loserTeamId) {
          await new sql.Request(transaction)
            .input("MatchID", sql.Int, thirdPlaceMatch.MatchID)
            .input("LoserTeamID", sql.Int, loserTeamId)
            .query("UPDATE TournamentMatches SET TeamBID = @LoserTeamID WHERE MatchID = @MatchID");
        }
      }
    }

    // 5. Correct Division & Tournament status recomputation
    const divRes = await new sql.Request(transaction)
      .input("DivisionID", sql.Int, match.DivisionID)
      .query("SELECT BracketType, Status FROM TournamentDivisions WHERE DivisionID = @DivisionID");
    
    const div = divRes.recordset[0];
    if (div) {
      if (div.BracketType === "RoundRobin" || div.BracketType === "SingleElimination") {
        const uncompletedResult = await new sql.Request(transaction)
          .input("DivisionID", sql.Int, match.DivisionID)
          .query(`
            SELECT COUNT(*) AS UncompletedCount FROM TournamentMatches
            WHERE DivisionID = @DivisionID AND MatchStatus NOT IN ('Completed', 'Forfeit', 'ByeCompleted')
          `);
        if (uncompletedResult.recordset[0].UncompletedCount === 0) {
          await new sql.Request(transaction)
            .input("DivisionID", sql.Int, match.DivisionID)
            .query("UPDATE TournamentDivisions SET Status = 'Completed', UpdatedAt = GETDATE() WHERE DivisionID = @DivisionID");
        }
      } else if (div.BracketType === "GroupKnockout") {
        const knockoutMatchesRes = await new sql.Request(transaction)
          .input("DivisionID", sql.Int, match.DivisionID)
          .query("SELECT COUNT(*) AS KnockoutCount FROM TournamentMatches WHERE DivisionID = @DivisionID AND GroupName = 'Knockout'");

        const knockoutCount = knockoutMatchesRes.recordset[0].KnockoutCount;

        if (knockoutCount === 0) {
          // Only group stage matches exist
          const uncompletedGroupRes = await new sql.Request(transaction)
            .input("DivisionID", sql.Int, match.DivisionID)
            .query(`
              SELECT COUNT(*) AS UncompletedGroup FROM TournamentMatches
              WHERE DivisionID = @DivisionID AND GroupName != 'Knockout' AND MatchStatus NOT IN ('Completed', 'Forfeit', 'ByeCompleted')
            `);
          if (uncompletedGroupRes.recordset[0].UncompletedGroup === 0) {
            await new sql.Request(transaction)
              .input("DivisionID", sql.Int, match.DivisionID)
              .query("UPDATE TournamentDivisions SET Status = 'GroupCompleted', UpdatedAt = GETDATE() WHERE DivisionID = @DivisionID");
          }
        } else {
          // Knockout stage exists
          const uncompletedKnockoutRes = await new sql.Request(transaction)
            .input("DivisionID", sql.Int, match.DivisionID)
            .query(`
              SELECT COUNT(*) AS UncompletedKnockout FROM TournamentMatches
              WHERE DivisionID = @DivisionID AND GroupName = 'Knockout' AND MatchStatus NOT IN ('Completed', 'Forfeit', 'ByeCompleted')
            `);
          if (uncompletedKnockoutRes.recordset[0].UncompletedKnockout === 0) {
            await new sql.Request(transaction)
              .input("DivisionID", sql.Int, match.DivisionID)
              .query("UPDATE TournamentDivisions SET Status = 'Completed', UpdatedAt = GETDATE() WHERE DivisionID = @DivisionID");
          }
        }
      }

      // Check Tournament completion
      const uncompletedDivsResult = await new sql.Request(transaction)
        .input("TournamentID", sql.Int, match.TournamentID)
        .query(`
          SELECT COUNT(*) AS UncompletedDivCount FROM TournamentDivisions
          WHERE TournamentID = @TournamentID AND Status NOT IN ('Completed', 'Cancelled')
        `);

      if (uncompletedDivsResult.recordset[0].UncompletedDivCount === 0) {
        await new sql.Request(transaction)
          .input("TournamentID", sql.Int, match.TournamentID)
          .query("UPDATE Tournaments SET Status = 'Completed', UpdatedAt = GETDATE() WHERE TournamentID = @TournamentID");
      }
    }

    await transaction.commit();
    return match;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Recalculate standings for a Round Robin division
 */
export async function updateRoundRobinStandingsTransaction(divisionId: number): Promise<void> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Get all matches for division (only Group stage if applicable)
    const matchesResult = await new sql.Request(transaction)
      .input("DivisionID", sql.Int, divisionId)
      .query("SELECT * FROM TournamentMatches WHERE DivisionID = @DivisionID AND MatchStatus = 'Completed' AND GroupName IS NOT NULL AND GroupName <> 'Knockout'");

    const matches = matchesResult.recordset;

    // Get all standings entries
    const standingsResult = await new sql.Request(transaction)
      .input("DivisionID", sql.Int, divisionId)
      .query("SELECT * FROM TournamentStandings WHERE DivisionID = @DivisionID");

    const standings = standingsResult.recordset;

    // Reset standings map
    const stats: Record<number, {
      played: number;
      won: number;
      lost: number;
      pointsFor: number;
      pointsAgainst: number;
      pointDiff: number;
    }> = {};

    for (const st of standings) {
      stats[st.TeamID] = { played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };
    }

    // Direct H2H lookup map
    const h2hMatches: Record<string, { winner: number; teamAPoints: number; teamBPoints: number }> = {};

    // Process completed matches
    for (const m of matches) {
      if (!m.TeamAID || !m.TeamBID || !m.WinnerTeamID) continue;

      let teamAPoints = 0;
      let teamBPoints = 0;

      // Check if ScoreJson exists
      if (m.ScoreJson) {
        try {
          const sets = JSON.parse(m.ScoreJson);
          for (const set of sets) {
            teamAPoints += set.teamAScore ?? set.TeamAScore ?? 0;
            teamBPoints += set.teamBScore ?? set.TeamBScore ?? 0;
          }
        } catch (e) {
          // ignore parsing error
        }
      } else {
        // Fallback for old schema
        const scoresResult = await new sql.Request(transaction)
          .input("MatchID", sql.Int, m.MatchID)
          .query("SELECT * FROM TournamentMatchScores WHERE MatchID = @MatchID");

        const sets = scoresResult.recordset;
        for (const set of sets) {
          teamAPoints += set.teamAScore ?? set.TeamAScore ?? 0;
          teamBPoints += set.teamBScore ?? set.TeamBScore ?? 0;
        }
      }

      // Record direct H2H
      const key1 = `${m.TeamAID}_${m.TeamBID}`;
      const key2 = `${m.TeamBID}_${m.TeamAID}`;
      h2hMatches[key1] = { winner: m.WinnerTeamID, teamAPoints, teamBPoints };
      h2hMatches[key2] = { winner: m.WinnerTeamID, teamAPoints: teamBPoints, teamBPoints: teamAPoints };

      // Initialize team stats if missing (fallback)
      if (!stats[m.TeamAID]) stats[m.TeamAID] = { played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };
      if (!stats[m.TeamBID]) stats[m.TeamBID] = { played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };

      // Update played
      stats[m.TeamAID].played += 1;
      stats[m.TeamBID].played += 1;

      // Update points for/against
      stats[m.TeamAID].pointsFor += teamAPoints;
      stats[m.TeamAID].pointsAgainst += teamBPoints;
      stats[m.TeamAID].pointDiff += (teamAPoints - teamBPoints);

      stats[m.TeamBID].pointsFor += teamBPoints;
      stats[m.TeamBID].pointsAgainst += teamAPoints;
      stats[m.TeamBID].pointDiff += (teamBPoints - teamAPoints);

      // Update won/lost
      if (m.WinnerTeamID === m.TeamAID) {
        stats[m.TeamAID].won += 1;
        stats[m.TeamBID].lost += 1;
      } else {
        stats[m.TeamBID].won += 1;
        stats[m.TeamAID].lost += 1;
      }
    }

    // Save standings to DB
    for (const teamId of Object.keys(stats).map(Number)) {
      const s = stats[teamId];
      await new sql.Request(transaction)
        .input("DivisionID", sql.Int, divisionId)
        .input("TeamID", sql.Int, teamId)
        .input("Played", sql.Int, s.played)
        .input("Won", sql.Int, s.won)
        .input("Lost", sql.Int, s.lost)
        .input("PointsFor", sql.Int, s.pointsFor)
        .input("PointsAgainst", sql.Int, s.pointsAgainst)
        .input("PointDifference", sql.Int, s.pointDiff)
        .query(`
          UPDATE TournamentStandings
          SET Played = @Played, Won = @Won, Lost = @Lost, 
              PointsFor = @PointsFor, PointsAgainst = @PointsAgainst, PointDifference = @PointDifference
          WHERE DivisionID = @DivisionID AND TeamID = @TeamID
        `);
    }

    // 2. Fetch updated standings, sort them to calculate ranks, and update RankNo
    const finalStandingsResult = await new sql.Request(transaction)
      .input("DivisionID", sql.Int, divisionId)
      .query("SELECT StandingID, TeamID, GroupName, Won, PointDifference, PointsFor FROM TournamentStandings WHERE DivisionID = @DivisionID");

    const finalStandings = finalStandingsResult.recordset;

    // Group by GroupName
    const groups: Record<string, any[]> = {};
    for (const st of finalStandings) {
      const gName = st.GroupName || 'Default';
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push(st);
    }

    // Sort and update RankNo per group
    for (const gName of Object.keys(groups)) {
      const groupStandings = groups[gName];
      // Helper function to compute mini-table stats among a subgroup of tied teams
      const getH2HStats = (subgroupTeamIds: Set<number>) => {
        const h2hStats: Record<number, { won: number; pointsFor: number; pointsAgainst: number; pointDiff: number }> = {};
        for (const tId of subgroupTeamIds) {
          h2hStats[tId] = { won: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };
        }
        for (const m of matches) {
          if (m.TeamAID && m.TeamBID && subgroupTeamIds.has(m.TeamAID) && subgroupTeamIds.has(m.TeamBID) && m.WinnerTeamID) {
            let pA = 0, pB = 0;
            if (m.ScoreJson) {
              try {
                const sets = JSON.parse(m.ScoreJson);
                for (const set of sets) {
                  pA += set.teamAScore ?? set.TeamAScore ?? 0;
                  pB += set.teamBScore ?? set.TeamBScore ?? 0;
                }
              } catch (e) {}
            }
            h2hStats[m.TeamAID].pointsFor += pA;
            h2hStats[m.TeamAID].pointsAgainst += pB;
            h2hStats[m.TeamAID].pointDiff += (pA - pB);

            h2hStats[m.TeamBID].pointsFor += pB;
            h2hStats[m.TeamBID].pointsAgainst += pA;
            h2hStats[m.TeamBID].pointDiff += (pB - pA);

            if (m.WinnerTeamID === m.TeamAID) h2hStats[m.TeamAID].won += 1;
            else if (m.WinnerTeamID === m.TeamBID) h2hStats[m.TeamBID].won += 1;
          }
        }
        return h2hStats;
      };

      groupStandings.sort((a, b) => {
        if (b.Won !== a.Won) return b.Won - a.Won;

        // Group teams with same Won count
        const tiedTeamIds = new Set(groupStandings.filter(st => st.Won === a.Won).map(st => st.TeamID));

        if (tiedTeamIds.size === 2) {
          // Exactly 2 teams tied: Direct H2H winner
          const directMatch = h2hMatches[`${a.TeamID}_${b.TeamID}`];
          if (directMatch && directMatch.winner) {
            if (directMatch.winner === a.TeamID) return -1;
            if (directMatch.winner === b.TeamID) return 1;
          }
        } else if (tiedTeamIds.size > 2) {
          // Mini-table among >2 tied teams
          const miniStats = getH2HStats(tiedTeamIds);
          const statA = miniStats[a.TeamID];
          const statB = miniStats[b.TeamID];
          if (statA && statB) {
            if (statB.won !== statA.won) return statB.won - statA.won;
            if (statB.pointDiff !== statA.pointDiff) return statB.pointDiff - statA.pointDiff;
            if (statB.pointsFor !== statA.pointsFor) return statB.pointsFor - statA.pointsFor;
          }
        }

        if (b.PointDifference !== a.PointDifference) return b.PointDifference - a.PointDifference;
        if (b.PointsFor !== a.PointsFor) return b.PointsFor - a.PointsFor;
        return a.TeamID - b.TeamID;
      });

      for (let index = 0; index < groupStandings.length; index++) {
        const rank = index + 1;
        await new sql.Request(transaction)
          .input("StandingID", sql.Int, groupStandings[index].StandingID)
          .input("RankNo", sql.Int, rank)
          .query("UPDATE TournamentStandings SET RankNo = @RankNo WHERE StandingID = @StandingID");
      }
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Lấy danh sách các đơn đăng ký của một nội dung giải đấu kèm thông tin vận động viên
 */
export async function getDivisionRegistrations(divisionId: number): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input("DivisionID", sql.Int, divisionId)
    .query(`
      SELECT 
        r.RegistrationID,
        r.RegistrationStatus,
        r.PaymentStatus,
        r.RegisteredAt,
        r.ConfirmedAt,
        r.CccdVerified,
        r.IsCheckedIn,
        r.IsCertificateSent,
        r.CertificateSentAt,
        r.CertificatePdfUrl,
        r.PaymentExpiredAt,
        t.TeamName,
        t.TeamCode,
        (SELECT TOP 1 Status FROM Refunds WHERE RegistrationID = r.RegistrationID AND Status NOT IN ('Completed', 'Failed', 'Rejected')) AS RefundStatus,
        (SELECT TOP 1 RefundCode FROM Refunds WHERE RegistrationID = r.RegistrationID AND Status NOT IN ('Completed', 'Failed', 'Rejected')) AS RefundCode,
        a.AthleteID,
        a.AthleteNo,
        a.FullName,
        a.PhoneNumber,
        a.Rating,
        a.Province,
        a.Gender,
        a.DateOfBirth,
        a.PhotoURL,
        a.CccdURL,
        a.Email,
        a.Note
      FROM TournamentRegistrations r
      INNER JOIN TournamentTeams t ON r.TeamID = t.TeamID
      LEFT JOIN TournamentRegistrationAthletes a ON r.RegistrationID = a.RegistrationID
      WHERE r.DivisionID = @DivisionID AND r.RegistrationStatus = 'Confirmed'
      ORDER BY r.RegistrationID DESC, a.AthleteNo ASC
    `);
  return result.recordset;
}

/**
 * Cập nhật duyệt CCCD hoặc điểm danh (Check-in) cho đơn đăng ký
 */
export async function updateRegistrationAction(registrationId: number, field: "CccdVerified" | "IsCheckedIn", value: boolean): Promise<any> {
  const pool = await getPool();
  const bitValue = value ? 1 : 0;
  
  const query = field === "CccdVerified" 
    ? `UPDATE TournamentRegistrations SET CccdVerified = @Val WHERE RegistrationID = @RegistrationID`
    : `UPDATE TournamentRegistrations SET IsCheckedIn = @Val WHERE RegistrationID = @RegistrationID`;

  await pool.request()
    .input("RegistrationID", sql.Int, registrationId)
    .input("Val", sql.Bit, bitValue)
    .query(query);

  const updatedResult = await pool.request()
    .input("RegistrationID", sql.Int, registrationId)
    .query(`SELECT * FROM TournamentRegistrations WHERE RegistrationID = @RegistrationID`);

  return updatedResult.recordset[0];
}

/**
 * Từ chối đơn đăng ký giải đấu (Hồ sơ giả mạo)
 */
export async function rejectRegistration(registrationId: number): Promise<any> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    // 1. Update TournamentRegistrations status to Rejected
    const regResult = await new sql.Request(transaction)
      .input("RegistrationID", sql.Int, registrationId)
      .query(`
        UPDATE TournamentRegistrations
        SET RegistrationStatus = 'Rejected', PaymentStatus = 'Failed'
        OUTPUT INSERTED.*
        WHERE RegistrationID = @RegistrationID
      `);
    
    const registration = regResult.recordset[0];
    if (registration) {
      // 2. Update Team status to Withdrawn
      await new sql.Request(transaction)
        .input("TeamID", sql.Int, registration.TeamID)
        .query(`
          UPDATE TournamentTeams
          SET TeamStatus = 'Withdrawn'
          WHERE TeamID = @TeamID
        `);
    }
    
    await transaction.commit();
    return registration;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Idempotent background task: Cancel expired tournament registrations (10 minutes)
 * and output the detailed list of cancelled ones.
 */
export async function repoReleaseExpiredRegistrations(): Promise<any[]> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Update expired registrations and OUTPUT their IDs
    const cancelledListResult = await new sql.Request(transaction).query(`
      DECLARE @CancelledList TABLE (RegistrationID INT, RegisteredBy INT, DivisionID INT, TournamentID INT);

      UPDATE TournamentRegistrations
      SET RegistrationStatus = 'Cancelled',
          PaymentStatus = 'Failed'
      OUTPUT INSERTED.RegistrationID, INSERTED.RegisteredBy, INSERTED.DivisionID, INSERTED.TournamentID
      INTO @CancelledList
      WHERE RegistrationStatus = 'PendingPayment'
        AND PaymentStatus IN ('Unpaid', 'Pending')
        AND PaymentExpiredAt < GETDATE();

      -- 2. Update their pending payments to Cancelled
      UPDATE TournamentPayments
      SET PaymentStatus = 'Cancelled'
      WHERE RegistrationID IN (SELECT RegistrationID FROM @CancelledList)
        AND PaymentStatus = 'Pending';

      -- 3. Update team status to Withdrawn
      UPDATE TournamentTeams
      SET TeamStatus = 'Withdrawn'
      WHERE TeamID IN (
        SELECT TeamID FROM TournamentRegistrations
        WHERE RegistrationID IN (SELECT RegistrationID FROM @CancelledList)
      );

      -- 4. Select details
      SELECT c.RegistrationID, c.RegisteredBy, d.DivisionName, t.TournamentName
      FROM @CancelledList c
      INNER JOIN TournamentDivisions d ON c.DivisionID = d.DivisionID
      INNER JOIN Tournaments t ON c.TournamentID = t.TournamentID;
    `);

    await transaction.commit();
    return cancelledListResult.recordset;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Update single match status
 */
export async function updateMatchStatus(matchId: number, status: string): Promise<any> {
  const pool = await getPool();
  const result = await pool.request()
    .input("MatchID", sql.Int, matchId)
    .input("MatchStatus", sql.NVarChar(50), status)
    .query(`
      UPDATE TournamentMatches
      SET MatchStatus = @MatchStatus, UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE MatchID = @MatchID
    `);
  return result.recordset[0];
}

/**
 * Lấy đăng ký còn hoạt động của user hiện tại đối với giải đấu
 */
export async function repoGetMyRegistrationForTournament(tournamentId: number, userId: number): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input("TournamentID", sql.Int, tournamentId)
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT DISTINCT
        r.RegistrationID,
        r.RegistrationStatus,
        r.PaymentStatus,
        r.RegisteredAt,
        r.PaymentExpiredAt,
        r.DivisionID,
        r.CertificatePdfUrl,
        d.DivisionName,
        d.RegistrationFee,
        t.TeamName,
        t.TeamCode
      FROM TournamentRegistrations r
      INNER JOIN TournamentTeams t ON r.TeamID = t.TeamID
      INNER JOIN TournamentDivisions d ON r.DivisionID = d.DivisionID
      LEFT JOIN TournamentRegistrationAthletes a ON r.RegistrationID = a.RegistrationID
      WHERE r.TournamentID = @TournamentID
        AND r.RegistrationStatus NOT IN ('Cancelled', 'Rejected')
        AND (
          r.RegisteredBy = @UserID 
          OR a.UserID = @UserID
          OR a.PhoneNumber = (SELECT PhoneNumber FROM Users WHERE UserID = @UserID)
        )
      ORDER BY r.RegistrationID DESC
    `);
  return result.recordset;
}

/**
 * Lấy thông tin đăng ký để tạo chứng chỉ gửi email
 */
export async function getRegistrationForCertificate(registrationId: number): Promise<any[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input("RegistrationID", sql.Int, registrationId)
    .query(`
      SELECT 
        r.RegistrationID,
        r.RegistrationStatus,
        r.PaymentStatus,
        r.IsCertificateSent,
        r.CertificateSentAt,
        r.CertificatePdfUrl,
        t.TeamID,
        t.TeamName,
        t.TeamCode,
        d.DivisionID,
        d.DivisionName,
        d.BracketType,
        tn.TournamentID,
        tn.TournamentName,
        tn.Location,
        tn.PrizeInfo,
        ISNULL(a.Email, u.Email) AS Email,
        u.FullName
      FROM TournamentRegistrations r
      INNER JOIN TournamentTeams t ON r.TeamID = t.TeamID
      INNER JOIN TournamentDivisions d ON r.DivisionID = d.DivisionID
      INNER JOIN Tournaments tn ON r.TournamentID = tn.TournamentID
      INNER JOIN TournamentTeamMembers tm ON t.TeamID = tm.TeamID
      INNER JOIN Users u ON tm.UserID = u.UserID
      LEFT JOIN TournamentRegistrationAthletes a ON r.RegistrationID = a.RegistrationID AND (a.UserID = u.UserID OR a.FullName = u.FullName)
      WHERE r.RegistrationID = @RegistrationID AND tm.JoinStatus = 'Accepted'
    `);
  return result.recordset;
}

/**
 * Cập nhật trạng thái đã gửi chứng chỉ
 */
export async function updateCertificateSent(registrationId: number): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input("RegistrationID", sql.Int, registrationId)
    .query(`
      UPDATE TournamentRegistrations
      SET IsCertificateSent = 1, CertificateSentAt = GETDATE()
      WHERE RegistrationID = @RegistrationID
    `);
}

/**
 * Cập nhật đường dẫn file PDF chứng chỉ giải đấu
 */
export async function updateCertificatePdfUrl(registrationId: number, pdfUrl: string | null): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input("RegistrationID", sql.Int, registrationId)
    .input("PdfUrl", sql.NVarChar, pdfUrl)
    .query(`
      UPDATE TournamentRegistrations
      SET CertificatePdfUrl = @PdfUrl
      WHERE RegistrationID = @RegistrationID
    `);
}


