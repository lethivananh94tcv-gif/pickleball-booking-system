import { getPool, sql } from "@/database/connection";

export interface PlayerProfileData {
  playingRole: string;
  experienceYears: number;
  skillLevel: string;
  playStyle: string;
  goal: string;
  matchingStatus: string;
  availableStartTime?: string | null;
  availableEndTime?: string | null;
}

export async function findProfileByUserId(userId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT 
        p.PlayerProfileID,
        p.UserID,
        p.PlayingRole,
        p.ExperienceYears,
        p.SkillLevel,
        p.PlayStyle,
        p.Goal,
        p.Rating,
        p.MatchingStatus,
        CONVERT(VARCHAR(5), p.AvailableStartTime, 108) AS AvailableStartTime,
        CONVERT(VARCHAR(5), p.AvailableEndTime, 108) AS AvailableEndTime,
        u.FullName,
        u.Email,
        u.PhoneNumber,
        u.AvatarURL,
        u.Gender
      FROM PlayerProfiles p
      INNER JOIN Users u ON p.UserID = u.UserID
      WHERE p.UserID = @UserID
    `);
  return result.recordset[0] || null;
}

export async function createProfile(userId: number, data: PlayerProfileData) {
  const pool = await getPool();
  
  // Clean time format: HH:mm
  const startTime = data.availableStartTime ? data.availableStartTime.substring(0, 5) : null;
  const endTime = data.availableEndTime ? data.availableEndTime.substring(0, 5) : null;

  await pool
    .request()
    .input("UserID", sql.Int, userId)
    .input("PlayingRole", sql.NVarChar(30), data.playingRole)
    .input("ExperienceYears", sql.Int, data.experienceYears)
    .input("SkillLevel", sql.NVarChar(30), data.skillLevel)
    .input("PlayStyle", sql.NVarChar(100), data.playStyle)
    .input("Goal", sql.NVarChar(255), data.goal)
    .input("MatchingStatus", sql.NVarChar(30), data.matchingStatus)
    .input("AvailableStartTime", sql.VarChar(5), startTime)
    .input("AvailableEndTime", sql.VarChar(5), endTime)
    .query(`
      INSERT INTO PlayerProfiles (
        UserID, PlayingRole, ExperienceYears, SkillLevel, PlayStyle, Goal, Rating, MatchingStatus, AvailableStartTime, AvailableEndTime
      ) VALUES (
        @UserID, @PlayingRole, @ExperienceYears, @SkillLevel, @PlayStyle, @Goal, 5.0, @MatchingStatus, 
        CAST(@AvailableStartTime AS TIME), CAST(@AvailableEndTime AS TIME)
      )
    `);
  return findProfileByUserId(userId);
}

export async function updateProfile(userId: number, data: PlayerProfileData) {
  const pool = await getPool();

  const startTime = data.availableStartTime ? data.availableStartTime.substring(0, 5) : null;
  const endTime = data.availableEndTime ? data.availableEndTime.substring(0, 5) : null;

  await pool
    .request()
    .input("UserID", sql.Int, userId)
    .input("PlayingRole", sql.NVarChar(30), data.playingRole)
    .input("ExperienceYears", sql.Int, data.experienceYears)
    .input("SkillLevel", sql.NVarChar(30), data.skillLevel)
    .input("PlayStyle", sql.NVarChar(100), data.playStyle)
    .input("Goal", sql.NVarChar(255), data.goal)
    .input("MatchingStatus", sql.NVarChar(30), data.matchingStatus)
    .input("AvailableStartTime", sql.VarChar(5), startTime)
    .input("AvailableEndTime", sql.VarChar(5), endTime)
    .query(`
      UPDATE PlayerProfiles
      SET
        PlayingRole = @PlayingRole,
        ExperienceYears = @ExperienceYears,
        SkillLevel = @SkillLevel,
        PlayStyle = @PlayStyle,
        Goal = @Goal,
        MatchingStatus = @MatchingStatus,
        AvailableStartTime = CAST(@AvailableStartTime AS TIME),
        AvailableEndTime = CAST(@AvailableEndTime AS TIME)
      WHERE UserID = @UserID
    `);
  return findProfileByUserId(userId);
}

export async function findAllMatchingProfiles(userId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT 
        p.PlayerProfileID,
        p.UserID,
        p.PlayingRole,
        p.ExperienceYears,
        p.SkillLevel,
        p.PlayStyle,
        p.Goal,
        p.Rating,
        p.MatchingStatus,
        CONVERT(VARCHAR(5), p.AvailableStartTime, 108) AS AvailableStartTime,
        CONVERT(VARCHAR(5), p.AvailableEndTime, 108) AS AvailableEndTime,
        u.FullName,
        u.Email,
        u.PhoneNumber,
        u.AvatarURL,
        u.Gender
      FROM PlayerProfiles p
      INNER JOIN Users u ON p.UserID = u.UserID
      WHERE p.UserID <> @UserID 
        AND p.MatchingStatus = 'Available'
        AND p.AvailableStartTime IS NOT NULL
        AND p.AvailableEndTime IS NOT NULL
    `);
  return result.recordset;
}

export async function createPlayerMatch(player1Id: number, player2Id: number, score: number, matchType: string) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("Player1ID", sql.Int, player1Id)
    .input("Player2ID", sql.Int, player2Id)
    .input("MatchingScore", sql.Decimal(5, 2), score)
    .input("MatchType", sql.NVarChar(30), matchType)
    .query(`
      INSERT INTO PlayerMatches (Player1ID, Player2ID, MatchingScore, MatchType, MatchStatus, MatchedAt)
      VALUES (@Player1ID, @Player2ID, @MatchingScore, @MatchType, 'Suggested', GETDATE())
    `);
  return result.rowsAffected;
}

export async function upsertPlayerMatch(player1Id: number, player2Id: number, score: number, matchType: string, status: string) {
  const pool = await getPool();
  
  // Try to find an existing match record between these two players (in either direction, since it's mutual)
  const existingRes = await pool
    .request()
    .input("P1", sql.Int, player1Id)
    .input("P2", sql.Int, player2Id)
    .query(`
      SELECT MatchID FROM PlayerMatches
      WHERE (Player1ID = @P1 AND Player2ID = @P2)
         OR (Player1ID = @P2 AND Player2ID = @P1)
    `);
    
  if (existingRes.recordset.length > 0) {
    const matchId = existingRes.recordset[0].MatchID;
    await pool
      .request()
      .input("MatchID", sql.Int, matchId)
      .input("MatchType", sql.NVarChar(30), matchType)
      .input("MatchStatus", sql.NVarChar(30), status)
      .query(`
        UPDATE PlayerMatches
        SET MatchType = @MatchType, MatchStatus = @MatchStatus, MatchedAt = GETDATE()
        WHERE MatchID = @MatchID
      `);
  } else {
    await pool
      .request()
      .input("P1", sql.Int, player1Id)
      .input("P2", sql.Int, player2Id)
      .input("MatchingScore", sql.Decimal(5, 2), score)
      .input("MatchType", sql.NVarChar(30), matchType)
      .input("MatchStatus", sql.NVarChar(30), status)
      .query(`
        INSERT INTO PlayerMatches (Player1ID, Player2ID, MatchingScore, MatchType, MatchStatus, MatchedAt)
        VALUES (@P1, @P2, @MatchingScore, @MatchType, @MatchStatus, GETDATE())
      `);
  }
}

export async function findUserGroups(userId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT 
        g.GroupID, 
        g.GroupName, 
        g.Status,
        g.CreatedBy AS CreatorID,
        g.SkillLevel,
        g.AverageExperience,
        g.Description,
        m.RoleInGroup AS MyRole,
        CASE WHEN g.Description LIKE '%Box chat chung%' OR g.GroupName LIKE '%Thách đấu%' THEN 1 ELSE 0 END AS IsChallengeChat,
        (SELECT COUNT(*) FROM GroupMembers gm WHERE gm.GroupID = g.GroupID AND gm.Status = 'Active') AS CurrentPlayers,
        CASE WHEN g.Description LIKE '%Box chat chung%' OR g.GroupName LIKE '%Thách đấu%' THEN 10 ELSE 4 END AS MaxPlayers,
        u.FullName AS CreatorName
      FROM PlayingGroups g
      INNER JOIN GroupMembers m ON g.GroupID = m.GroupID
      LEFT JOIN Users u ON g.CreatedBy = u.UserID
      WHERE m.UserID = @UserID AND m.Status = 'Active' AND g.Status IN ('Open', 'Active', 'Full', 'Closed')
    `);
  return result.recordset;
}

export async function findAllOtherActiveGroups(excludeGroupId: number, userId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("ExcludeGroupID", sql.Int, excludeGroupId)
    .query(`
      SELECT GroupID FROM PlayingGroups g
      WHERE g.GroupID <> @ExcludeGroupID 
        AND g.Status IN ('Open', 'Active', 'Full')
        AND NOT EXISTS (
          SELECT 1
          FROM GroupMembers myMember
          JOIN GroupMembers opponentMember ON myMember.UserID = opponentMember.UserID
          WHERE myMember.GroupID = @ExcludeGroupID
            AND opponentMember.GroupID = g.GroupID
            AND myMember.Status = 'Active'
            AND opponentMember.Status = 'Active'
        )
    `);
  return result.recordset.map((r: any) => r.GroupID);
}

export async function findOpenRecruitingGroups(userId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT 
        g.GroupID, 
        g.GroupName, 
        g.Status,
        g.CreatedBy AS CreatorID,
        g.SkillLevel,
        g.AverageExperience,
        g.Description,
        (SELECT COUNT(*) FROM GroupMembers gm WHERE gm.GroupID = g.GroupID AND gm.Status = 'Active') AS CurrentPlayers,
        CASE WHEN g.Description LIKE '%Box chat chung%' OR g.GroupName LIKE '%Thách đấu%' THEN 10 ELSE 4 END AS MaxPlayers,
        u.FullName AS CreatorName,
        u.AvatarURL AS CreatorAvatar
      FROM PlayingGroups g
      LEFT JOIN Users u ON g.CreatedBy = u.UserID
      WHERE g.Status IN ('Open', 'Active')
        AND (g.Description IS NULL OR g.Description NOT LIKE '%Box chat chung%') 
        AND g.GroupName NOT LIKE '%Thách đấu%'
        AND (SELECT COUNT(*) FROM GroupMembers gm WHERE gm.GroupID = g.GroupID AND gm.Status = 'Active') BETWEEN 2 AND 3
        AND NOT EXISTS (
          SELECT 1 FROM GroupMembers gm2 
          WHERE gm2.GroupID = g.GroupID AND gm2.UserID = @UserID AND gm2.Status = 'Active'
        )
    `);
  return result.recordset;
}

export async function findAcceptedMatchBetweenPlayers(player1Id: number, player2Id: number): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("P1", sql.Int, player1Id)
    .input("P2", sql.Int, player2Id)
    .query(`
      SELECT 1 FROM PlayerMatches
      WHERE (
        (Player1ID = @P1 AND Player2ID = @P2) OR
        (Player1ID = @P2 AND Player2ID = @P1)
      )
      AND MatchStatus = 'Accepted'
      AND MatchType = 'Teammate'
    `);
  return result.recordset.length > 0;
}

export async function findUserTeammate(userId: number): Promise<number | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT TOP 1
        CASE 
          WHEN Player1ID = @UserID THEN Player2ID
          ELSE Player1ID
        END AS TeammateID
      FROM PlayerMatches
      WHERE (Player1ID = @UserID OR Player2ID = @UserID)
        AND MatchStatus = 'Accepted'
        AND MatchType = 'Teammate'
    `);
  if (result.recordset.length > 0) {
    return result.recordset[0].TeammateID;
  }
  return null;
}

export async function getRecentActivityCount(userId: number): Promise<number> {
  const pool = await getPool();
  const bookingsRes = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT COUNT(*) AS cnt
      FROM Bookings
      WHERE UserID = @UserID
        AND BookingDate >= DATEADD(day, -30, GETDATE())
    `);
  const matchesRes = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT COUNT(*) AS cnt
      FROM PlayerMatches
      WHERE (Player1ID = @UserID OR Player2ID = @UserID)
        AND MatchedAt >= DATEADD(day, -30, GETDATE())
    `);
  return (bookingsRes.recordset[0]?.cnt || 0) + (matchesRes.recordset[0]?.cnt || 0);
}

export async function getAcceptedOpponentLeaders(userId: number): Promise<number[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT 
        CASE 
          WHEN Player1ID = @UserID THEN Player2ID
          ELSE Player1ID
        END AS OpponentLeaderID
      FROM PlayerMatches
      WHERE (Player1ID = @UserID OR Player2ID = @UserID)
        AND MatchType = 'Opponent'
        AND MatchStatus = 'Accepted'
    `);
  return result.recordset.map((row: any) => row.OpponentLeaderID);
}
