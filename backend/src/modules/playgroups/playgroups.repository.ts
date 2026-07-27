import { getPool, sql } from "@/database/connection";

export interface GroupData {
  groupName: string;
  maxPlayers: number;
  skillLevel: string;
  description: string;
}

export async function countActiveGroupsForCreator(creatorId: number): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("CreatorID", sql.Int, creatorId)
    .query(`
      SELECT COUNT(*) AS count
      FROM PlayingGroups
      WHERE CreatedBy = @CreatorID AND Status IN ('Open', 'Active', 'Full')
    `);
  return result.recordset[0]?.count || 0;
}

export async function createGroup(data: GroupData, creatorId: number) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Insert PlayingGroup
    const groupResult = await transaction
      .request()
      .input("GroupName", sql.NVarChar(100), data.groupName)
      .input("CreatorID", sql.Int, creatorId)
      .input("SkillLevel", sql.NVarChar(30), data.skillLevel)
      .input("Description", sql.NVarChar(255), data.description)
      .query(`
        INSERT INTO PlayingGroups (GroupName, CreatedBy, SkillLevel, Status, Description, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.GroupID
        VALUES (@GroupName, @CreatorID, @SkillLevel, 'Open', @Description, GETDATE(), GETDATE())
      `);

    const groupId = groupResult.recordset[0].GroupID;

    // 2. Insert Group Member (Leader)
    await transaction
      .request()
      .input("GroupID", sql.Int, groupId)
      .input("UserID", sql.Int, creatorId)
      .query(`
        INSERT INTO GroupMembers (GroupID, UserID, RoleInGroup, JoinedAt, Status)
        VALUES (@GroupID, @UserID, 'Leader', GETDATE(), 'Active')
      `);

    await transaction.commit();
    return groupId;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function listGroups(filters: { skillLevel?: string; keyword?: string }) {
  const pool = await getPool();
  let query = `
    SELECT
      g.GroupID,
      g.GroupName,
      g.CreatedBy AS CreatorID,
      4 AS MaxPlayers,
      COUNT(gm.GroupMemberID) AS CurrentPlayers,
      g.SkillLevel,
      g.AverageExperience,
      g.Status,
      g.Description,
      g.CreatedAt,
      u.FullName AS CreatorName,
      u.AvatarURL AS CreatorAvatar
    FROM PlayingGroups g
    INNER JOIN Users u ON g.CreatedBy = u.UserID
    LEFT JOIN GroupMembers gm ON g.GroupID = gm.GroupID AND gm.Status = 'Active'
    WHERE g.Status IN ('Open', 'Active', 'Full')
      AND g.GroupName NOT LIKE '%⚔️ Thách đấu%'
      AND g.Description NOT LIKE '%Box chat chung%'
  `;

  const request = pool.request();

  if (filters.skillLevel && filters.skillLevel !== 'all') {
    query += ` AND g.SkillLevel = @SkillLevel`;
    request.input("SkillLevel", sql.NVarChar(30), filters.skillLevel);
  }

  if (filters.keyword) {
    query += ` AND (g.GroupName LIKE @Keyword OR g.Description LIKE @Keyword)`;
    request.input("Keyword", sql.NVarChar(100), `%${filters.keyword}%`);
  }

  query += `
    GROUP BY
      g.GroupID,
      g.GroupName,
      g.CreatedBy,
      g.SkillLevel,
      g.AverageExperience,
      g.Status,
      g.Description,
      g.CreatedAt,
      u.FullName,
      u.AvatarURL
    ORDER BY g.GroupID DESC
  `;

  const result = await request.query(query);
  return result.recordset;
}

export async function getGroupDetails(groupId: number) {
  const pool = await getPool();
  const groupResult = await pool
    .request()
    .input("GroupID", sql.Int, groupId)
    .query(`
      SELECT
        g.GroupID,
        g.GroupName,
        g.CreatedBy AS CreatorID,
        g.SkillLevel,
        g.AverageExperience,
        g.Status,
        g.Description,
        g.CreatedAt,
        u.FullName AS CreatorName,
        u.Email AS CreatorEmail
      FROM PlayingGroups g
      INNER JOIN Users u ON g.CreatedBy = u.UserID
      WHERE g.GroupID = @GroupID
    `);

  const group = groupResult.recordset[0];
  if (!group) return null;

  const membersResult = await pool
    .request()
    .input("GroupID", sql.Int, groupId)
    .query(`
      SELECT
        m.GroupMemberID,
        m.UserID,
        m.RoleInGroup,
        m.JoinedAt,
        m.Status AS MemberStatus,
        u.FullName,
        u.Email,
        u.PhoneNumber,
        u.AvatarURL,
        u.Gender,
        p.SkillLevel,
        p.PlayingRole,
        p.ExperienceYears
      FROM GroupMembers m
      INNER JOIN Users u ON m.UserID = u.UserID
      LEFT JOIN PlayerProfiles p ON p.UserID = u.UserID
      WHERE m.GroupID = @GroupID AND m.Status = 'Active'
    `);

  return {
    ...group,
    CurrentPlayers: membersResult.recordset.length,
    MaxPlayers: 4,
    members: membersResult.recordset
  };
}

export async function countActiveGroupMembers(groupId: number): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("GroupID", sql.Int, groupId)
    .query(`
      SELECT COUNT(*) AS count
      FROM GroupMembers
      WHERE GroupID = @GroupID AND Status = 'Active'
    `);
  return result.recordset[0]?.count || 0;
}

export async function checkGroupOverlap(groupIdA: number, groupIdB: number): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("GroupID_A", sql.Int, groupIdA)
    .input("GroupID_B", sql.Int, groupIdB)
    .query(`
      SELECT 1
      FROM GroupMembers myMember
      JOIN GroupMembers opponentMember ON myMember.UserID = opponentMember.UserID
      WHERE myMember.GroupID = @GroupID_A
        AND opponentMember.GroupID = @GroupID_B
        AND myMember.Status = 'Active'
        AND opponentMember.Status = 'Active'
    `);
  return result.recordset.length > 0;
}

export async function checkUserInGroup(groupId: number, userId: number): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("GroupID", sql.Int, groupId)
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT 1 FROM GroupMembers
      WHERE GroupID = @GroupID AND UserID = @UserID AND Status = 'Active'
    `);
  return result.recordset.length > 0;
}

export async function addGroupMember(groupId: number, userId: number) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Insert group member
    await transaction
      .request()
      .input("GroupID", sql.Int, groupId)
      .input("UserID", sql.Int, userId)
      .query(`
        INSERT INTO GroupMembers (GroupID, UserID, RoleInGroup, JoinedAt, Status)
        VALUES (@GroupID, @UserID, 'Member', GETDATE(), 'Active')
      `);

    // Query count of active members
    const countRes = await transaction.request()
      .input("GroupID", sql.Int, groupId)
      .query(`SELECT COUNT(*) AS count FROM GroupMembers WHERE GroupID = @GroupID AND Status = 'Active'`);
    const currentPlayersCount = countRes.recordset[0].count;

    // Update group status if full (MaxPlayers = 4)
    const status = currentPlayersCount >= 4 ? 'Full' : 'Open';
    await transaction
      .request()
      .input("GroupID", sql.Int, groupId)
      .input("Status", sql.NVarChar(30), status)
      .query(`
        UPDATE PlayingGroups
        SET
          Status = @Status,
          UpdatedAt = GETDATE()
        WHERE GroupID = @GroupID
      `);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function removeGroupMember(groupId: number, userId: number) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Mark member as Left
    await transaction
      .request()
      .input("GroupID", sql.Int, groupId)
      .input("UserID", sql.Int, userId)
      .query(`
        UPDATE GroupMembers
        SET Status = 'Left'
        WHERE GroupID = @GroupID AND UserID = @UserID AND Status = 'Active'
      `);

    // Query count of remaining active members
    const countRes = await transaction.request()
      .input("GroupID", sql.Int, groupId)
      .query(`SELECT COUNT(*) AS count FROM GroupMembers WHERE GroupID = @GroupID AND Status = 'Active'`);
    const remainingCount = countRes.recordset[0]?.count || 0;

    // Update group status to Closed if 0 members, or Open if it was Full
    await transaction
      .request()
      .input("GroupID", sql.Int, groupId)
      .input("RemainingCount", sql.Int, remainingCount)
      .query(`
        UPDATE PlayingGroups
        SET
          Status = CASE 
            WHEN @RemainingCount = 0 THEN 'Closed'
            WHEN Status = 'Full' THEN 'Open' 
            ELSE Status 
          END,
          UpdatedAt = GETDATE()
        WHERE GroupID = @GroupID
      `);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateGroupStatus(groupId: number, status: string) {
  const pool = await getPool();
  await pool
    .request()
    .input("GroupID", sql.Int, groupId)
    .input("Status", sql.NVarChar(30), status)
    .query(`
      UPDATE PlayingGroups
      SET Status = @Status, UpdatedAt = GETDATE()
      WHERE GroupID = @GroupID
    `);
}

export async function removeAllGroupMembers(groupId: number) {
  const pool = await getPool();
  await pool
    .request()
    .input("GroupID", sql.Int, groupId)
    .query(`
      UPDATE GroupMembers
      SET Status = 'Left'
      WHERE GroupID = @GroupID AND Status = 'Active'
    `);
}

export async function transferLeadership(groupId: number, oldLeaderId: number, newLeaderId: number) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    await transaction.request()
      .input("GroupID", sql.Int, groupId)
      .input("NewLeaderID", sql.Int, newLeaderId)
      .query(`
        UPDATE PlayingGroups
        SET CreatedBy = @NewLeaderID, UpdatedAt = GETDATE()
        WHERE GroupID = @GroupID
      `);

    await transaction.request()
      .input("GroupID", sql.Int, groupId)
      .input("NewLeaderID", sql.Int, newLeaderId)
      .query(`
        UPDATE GroupMembers
        SET RoleInGroup = 'Leader'
        WHERE GroupID = @GroupID AND UserID = @NewLeaderID
      `);

    await transaction.request()
      .input("GroupID", sql.Int, groupId)
      .input("OldLeaderID", sql.Int, oldLeaderId)
      .query(`
        UPDATE GroupMembers
        SET RoleInGroup = 'Member'
        WHERE GroupID = @GroupID AND UserID = @OldLeaderID
      `);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function findActiveGroupBetweenPlayers(player1Id: number, player2Id: number): Promise<number | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("Player1ID", sql.Int, player1Id)
    .input("Player2ID", sql.Int, player2Id)
    .query(`
      SELECT gm1.GroupID
      FROM GroupMembers gm1
      INNER JOIN GroupMembers gm2 ON gm1.GroupID = gm2.GroupID
      INNER JOIN PlayingGroups pg ON gm1.GroupID = pg.GroupID
      WHERE gm1.UserID = @Player1ID AND gm1.Status = 'Active'
        AND gm2.UserID = @Player2ID AND gm2.Status = 'Active'
        AND pg.Status IN ('Open', 'Active', 'Full')
        AND (
          SELECT COUNT(*)
          FROM GroupMembers gm3
          WHERE gm3.GroupID = gm1.GroupID AND gm3.Status = 'Active'
        ) = 2
    `);
  return result.recordset[0]?.GroupID || null;
}

export async function createAutoGroup(
  data: {
    groupName: string;
    skillLevel: string;
    description: string;
    averageExperience: number;
  },
  creatorId: number,
  memberId: number
) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Insert PlayingGroup
    const groupResult = await transaction
      .request()
      .input("GroupName", sql.NVarChar(100), data.groupName)
      .input("CreatorID", sql.Int, creatorId)
      .input("SkillLevel", sql.NVarChar(30), data.skillLevel)
      .input("AverageExperience", sql.Decimal(5, 2), data.averageExperience)
      .input("Description", sql.NVarChar(255), data.description)
      .query(`
        INSERT INTO PlayingGroups (GroupName, CreatedBy, SkillLevel, AverageExperience, Status, Description, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.GroupID
        VALUES (@GroupName, @CreatorID, @SkillLevel, @AverageExperience, 'Open', @Description, GETDATE(), GETDATE())
      `);

    const groupId = groupResult.recordset[0].GroupID;

    // 2. Insert Group Member (Leader)
    await transaction
      .request()
      .input("GroupID", sql.Int, groupId)
      .input("UserID", sql.Int, creatorId)
      .query(`
        INSERT INTO GroupMembers (GroupID, UserID, RoleInGroup, JoinedAt, Status)
        VALUES (@GroupID, @UserID, 'Leader', GETDATE(), 'Active')
      `);

    // 3. Insert Group Member (Member)
    await transaction
      .request()
      .input("GroupID", sql.Int, groupId)
      .input("UserID", sql.Int, memberId)
      .query(`
        INSERT INTO GroupMembers (GroupID, UserID, RoleInGroup, JoinedAt, Status)
        VALUES (@GroupID, @UserID, 'Member', GETDATE(), 'Active')
      `);

    await transaction.commit();
    return groupId;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateGroup(
  groupId: number,
  data: {
    groupName: string;
    skillLevel: string;
    averageExperience: number;
    description: string;
    status: string;
  }
) {
  const pool = await getPool();
  await pool
    .request()
    .input("GroupID", sql.Int, groupId)
    .input("GroupName", sql.NVarChar(100), data.groupName)
    .input("SkillLevel", sql.NVarChar(30), data.skillLevel)
    .input("AverageExperience", sql.Decimal(5, 2), data.averageExperience)
    .input("Description", sql.NVarChar(255), data.description)
    .input("Status", sql.NVarChar(30), data.status)
    .query(`
      UPDATE PlayingGroups
      SET
        GroupName = @GroupName,
        SkillLevel = @SkillLevel,
        AverageExperience = @AverageExperience,
        Description = @Description,
        Status = @Status,
        UpdatedAt = GETDATE()
      WHERE GroupID = @GroupID
    `);
}

export async function getGroupMessages(groupId: number, limit: number = 50) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("GroupID", sql.Int, groupId)
    .input("Limit", sql.Int, limit)
    .query(`
      SELECT TOP (@Limit)
        m.MessageID,
        m.GroupID,
        m.SenderID,
        u.FullName AS SenderName,
        u.AvatarURL AS SenderAvatar,
        m.Content,
        m.CreatedAt
      FROM GroupMessages m
      JOIN Users u ON m.SenderID = u.UserID
      WHERE m.GroupID = @GroupID AND m.IsDeleted = 0
      ORDER BY m.CreatedAt DESC
    `);

  // Return in ascending order for chat UI
  return result.recordset.reverse();
}

export async function createGroupMessage(groupId: number, senderId: number, content: string) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("GroupID", sql.Int, groupId)
    .input("SenderID", sql.Int, senderId)
    .input("Content", sql.NVarChar(1000), content)
    .query(`
      INSERT INTO GroupMessages (GroupID, SenderID, Content, CreatedAt, IsDeleted)
      OUTPUT
        INSERTED.MessageID,
        INSERTED.GroupID,
        INSERTED.SenderID,
        INSERTED.Content,
        INSERTED.CreatedAt
      VALUES (@GroupID, @SenderID, @Content, GETDATE(), 0)
    `);
  return result.recordset[0];
}

export async function getUnreadCounts(userId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      WITH UserGroups AS (
        SELECT GroupID
        FROM GroupMembers
        WHERE UserID = @UserID AND Status = 'Active'
      ),
      GroupUnreads AS (
        SELECT
          ug.GroupID,
          COUNT(gm.MessageID) AS UnreadCount
        FROM UserGroups ug
        LEFT JOIN GroupMessages gm ON ug.GroupID = gm.GroupID
          AND gm.IsDeleted = 0
          AND gm.SenderID != @UserID
        LEFT JOIN GroupMessageReads gmr ON ug.GroupID = gmr.GroupID AND gmr.UserID = @UserID
        WHERE gm.MessageID IS NOT NULL
          AND (gmr.LastReadAt IS NULL OR gm.CreatedAt > gmr.LastReadAt)
        GROUP BY ug.GroupID
      )
      SELECT
        ISNULL(SUM(UnreadCount), 0) AS TotalUnread,
        (
          SELECT GroupID as groupId, UnreadCount as unreadCount
          FROM GroupUnreads
          FOR JSON PATH
        ) AS GroupsJson
      FROM GroupUnreads
    `);

  const row = result.recordset[0];
  return {
    totalUnread: row?.TotalUnread || 0,
    groups: row?.GroupsJson ? JSON.parse(row.GroupsJson) : []
  };
}

export async function markMessagesAsRead(userId: number, groupId: number) {
  const pool = await getPool();

  // Verify user is active in the group
  const checkRes = await pool.request()
    .input("UserID", sql.Int, userId)
    .input("GroupID", sql.Int, groupId)
    .query(`
      SELECT 1 FROM GroupMembers
      WHERE UserID = @UserID AND GroupID = @GroupID AND Status = 'Active'
    `);

  if (checkRes.recordset.length === 0) return false;

  await pool
    .request()
    .input("UserID", sql.Int, userId)
    .input("GroupID", sql.Int, groupId)
    .query(`
      IF EXISTS (SELECT 1 FROM GroupMessageReads WHERE GroupID = @GroupID AND UserID = @UserID)
      BEGIN
        UPDATE GroupMessageReads
        SET LastReadAt = GETDATE(), UpdatedAt = GETDATE()
        WHERE GroupID = @GroupID AND UserID = @UserID
      END
      ELSE
      BEGIN
        INSERT INTO GroupMessageReads (GroupID, UserID, LastReadAt, UpdatedAt)
        VALUES (@GroupID, @UserID, GETDATE(), GETDATE())
      END
    `);
  return true;
}

export async function createChallengeChatGroup(
  data: {
    groupName: string;
    skillLevel: string;
    description: string;
    averageExperience: number;
  },
  creatorId: number,
  memberIds: number[]
) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Insert PlayingGroup
    const groupResult = await transaction
      .request()
      .input("GroupName", sql.NVarChar(100), data.groupName)
      .input("CreatorID", sql.Int, creatorId)
      .input("SkillLevel", sql.NVarChar(30), data.skillLevel)
      .input("AverageExperience", sql.Decimal(5, 2), data.averageExperience)
      .input("Description", sql.NVarChar(255), data.description)
      .query(`
        INSERT INTO PlayingGroups (GroupName, CreatedBy, SkillLevel, AverageExperience, Status, Description, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.GroupID
        VALUES (@GroupName, @CreatorID, @SkillLevel, @AverageExperience, 'Active', @Description, GETDATE(), GETDATE())
      `);

    const groupId = groupResult.recordset[0].GroupID;

    // 2. Insert all members with role 'Member' (NO ONE has 'Leader' role!)
    for (const uId of memberIds) {
      await transaction
        .request()
        .input("GroupID", sql.Int, groupId)
        .input("UserID", sql.Int, uId)
        .query(`
          INSERT INTO GroupMembers (GroupID, UserID, RoleInGroup, JoinedAt, Status)
          VALUES (@GroupID, @UserID, 'Member', GETDATE(), 'Active')
        `);
    }

    await transaction.commit();
    return groupId;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
