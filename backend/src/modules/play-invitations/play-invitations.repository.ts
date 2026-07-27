import { getPool, sql } from "@/database/connection";

function processInvitationMessage(row: any) {
  let message = row.Message || "";
  let ChallengeDate = null;
  let ChallengeStartTime = null;
  let ChallengeEndTime = null;

  if (message.includes("||{")) {
    const parts = message.split("||{");
    message = parts[0];
    try {
      const extra = JSON.parse("{" + parts[1]);
      ChallengeDate = extra.ChallengeDate || null;
      ChallengeStartTime = extra.ChallengeStartTime || null;
      ChallengeEndTime = extra.ChallengeEndTime || null;
      if (extra.Type) row.InvitationType = extra.Type;
    } catch(e) {}
  }
  
  return {
    ...row,
    Message: message,
    ChallengeDate,
    ChallengeStartTime,
    ChallengeEndTime
  };
}

export async function createInvitation(
  senderId: number,
  receiverId: number | null,
  groupId: number | null,
  invitationType: string,
  message: string,
  challengeDate?: string | null,
  challengeStartTime?: string | null,
  challengeEndTime?: string | null
) {
  let finalMessage = message;
  const extra: any = { Type: invitationType };
  if (challengeDate || challengeStartTime || challengeEndTime) {
    extra.ChallengeDate = challengeDate;
    extra.ChallengeStartTime = challengeStartTime ? challengeStartTime.substring(0, 5) : null;
    extra.ChallengeEndTime = challengeEndTime ? challengeEndTime.substring(0, 5) : null;
  }
  finalMessage += `||${JSON.stringify(extra)}`;
  if (finalMessage.length > 255) finalMessage = finalMessage.substring(0, 255);

  let dbInvitationType = 'Player';
  if (invitationType === 'InviteOpponent' || invitationType === 'InviteToGroup' || invitationType === 'RequestJoinGroup') {
    dbInvitationType = 'Group';
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input("SenderID", sql.Int, senderId)
    .input("ReceiverID", sql.Int, receiverId)
    .input("GroupID", sql.Int, groupId)
    .input("InvitationType", sql.NVarChar(30), dbInvitationType)
    .input("Message", sql.NVarChar(255), finalMessage)
    .query(`
      INSERT INTO PlayInvitations (
        SenderID, ReceiverID, GroupID, InvitationType, Message, Status, ExpiredAt, CreatedAt
      )
      OUTPUT INSERTED.InvitationID
      VALUES (
        @SenderID, @ReceiverID, @GroupID, @InvitationType, @Message, 'Pending', DATEADD(day, 7, GETDATE()), GETDATE()
      )
    `);
  return result.recordset[0].InvitationID;
}

export async function getReceivedInvitations(userId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT 
        i.InvitationID,
        i.SenderID,
        i.ReceiverID,
        i.GroupID,
        i.InvitationType,
        i.Message,
        i.Status,
        i.CreatedAt,
        u.FullName AS SenderName,
        u.Email AS SenderEmail,
        u.AvatarURL AS SenderAvatar,
        g.GroupName,
        (SELECT TOP 1 GroupName FROM PlayingGroups WHERE CreatedBy = i.ReceiverID AND Status IN ('Open', 'Active', 'Full') AND GroupName NOT LIKE '%Thách đấu%' AND (Description IS NULL OR Description NOT LIKE '%Box chat chung%') ORDER BY GroupID DESC) AS ReceiverGroupName,
        sp.SkillLevel AS SenderSkillLevel,
        sp.ExperienceYears AS SenderExperienceYears,
        CONVERT(VARCHAR(5), sp.AvailableStartTime, 108) AS SenderStartTime,
        CONVERT(VARCHAR(5), sp.AvailableEndTime, 108) AS SenderEndTime
      FROM PlayInvitations i
      INNER JOIN Users u ON i.SenderID = u.UserID
      LEFT JOIN PlayingGroups g ON i.GroupID = g.GroupID
      LEFT JOIN PlayerProfiles sp ON i.SenderID = sp.UserID
      WHERE i.ReceiverID = @UserID AND i.Status IN ('Pending', 'Accepted')
      ORDER BY i.InvitationID DESC
    `);
  return result.recordset.map(processInvitationMessage);
}

export async function getSentInvitations(userId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT 
        i.InvitationID,
        i.SenderID,
        i.ReceiverID,
        i.GroupID,
        i.InvitationType,
        i.Message,
        i.Status,
        i.CreatedAt,
        u.FullName AS ReceiverName,
        u.Email AS ReceiverEmail,
        u.AvatarURL AS ReceiverAvatar,
        g.GroupName,
        (SELECT TOP 1 GroupName FROM PlayingGroups WHERE CreatedBy = i.ReceiverID AND Status IN ('Open', 'Active', 'Full') AND GroupName NOT LIKE '%Thách đấu%' AND (Description IS NULL OR Description NOT LIKE '%Box chat chung%') ORDER BY GroupID DESC) AS ReceiverGroupName,
        rp.SkillLevel AS ReceiverSkillLevel,
        rp.ExperienceYears AS ReceiverExperienceYears,
        CONVERT(VARCHAR(5), rp.AvailableStartTime, 108) AS ReceiverStartTime,
        CONVERT(VARCHAR(5), rp.AvailableEndTime, 108) AS ReceiverEndTime
      FROM PlayInvitations i
      LEFT JOIN Users u ON i.ReceiverID = u.UserID
      LEFT JOIN PlayingGroups g ON i.GroupID = g.GroupID
      LEFT JOIN PlayerProfiles rp ON i.ReceiverID = rp.UserID
      WHERE i.SenderID = @UserID
      ORDER BY i.InvitationID DESC
    `);
  return result.recordset.map(processInvitationMessage);
}

export async function getInvitationById(invitationId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("InvitationID", sql.Int, invitationId)
    .query(`
      SELECT 
        i.InvitationID,
        i.SenderID,
        i.ReceiverID,
        i.GroupID,
        i.InvitationType,
        i.Message,
        i.Status,
        i.CreatedAt,
        g.GroupName
      FROM PlayInvitations i
      LEFT JOIN PlayingGroups g ON i.GroupID = g.GroupID
      WHERE i.InvitationID = @InvitationID
    `);
  const record = result.recordset[0];
  return record ? processInvitationMessage(record) : null;
}

export async function updateInvitationStatus(invitationId: number, status: string) {
  const pool = await getPool();
  await pool
    .request()
    .input("InvitationID", sql.Int, invitationId)
    .input("Status", sql.NVarChar(30), status)
    .query(`
      UPDATE PlayInvitations
      SET Status = @Status, RespondedAt = GETDATE()
      WHERE InvitationID = @InvitationID
    `);
}

export async function checkPendingInvitation(
  senderId: number,
  receiverId: number | null,
  groupId: number | null,
  invitationType: string
): Promise<boolean> {
  const pool = await getPool();
  const request = pool.request()
    .input("SenderID", sql.Int, senderId)
    .input("ReceiverID", sql.Int, receiverId)
    .input("TypeMatch", sql.NVarChar(50), `%"Type":"${invitationType}"%`);
    
  let query = `
    SELECT 1 FROM PlayInvitations
    WHERE SenderID = @SenderID AND ReceiverID = @ReceiverID AND Message LIKE @TypeMatch AND Status = 'Pending'
  `;
  
  if (groupId !== null) {
    query += ` AND GroupID = @GroupID`;
    request.input("GroupID", sql.Int, groupId);
  } else {
    query += ` AND GroupID IS NULL`;
  }
  
  const result = await request.query(query);
  return result.recordset.length > 0;
}

export async function findPendingInvitationBetweenUsers(
  user1Id: number,
  user2Id: number,
  invitationType: string
): Promise<any> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("U1", sql.Int, user1Id)
    .input("U2", sql.Int, user2Id)
    .input("TypeMatch", sql.NVarChar(50), `%"Type":"${invitationType}"%`)
    .query(`
      SELECT * FROM PlayInvitations
      WHERE (
        (SenderID = @U1 AND ReceiverID = @U2) OR
        (SenderID = @U2 AND ReceiverID = @U1)
      )
      AND Status = 'Pending'
      AND Message LIKE @TypeMatch
    `);
  return result.recordset[0] || null;
}

export async function acceptTeammateInvitationTx(
  invitationId: number,
  senderId: number,
  receiverId: number,
  groupData: {
    groupName: string;
    skillLevel: string;
    description: string;
    averageExperience: number;
  } | null,
  matchType: string
): Promise<number | null> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  
  try {
    await transaction.begin();
    
    // 1. Update current invitation status
    await transaction
      .request()
      .input("InvitationID", sql.Int, invitationId)
      .query(`
        UPDATE PlayInvitations
        SET Status = 'Accepted', RespondedAt = GETDATE()
        WHERE InvitationID = @InvitationID
      `);
      
    // 2. Cancel mutual pending invitations of type InviteToPlay
    await transaction
      .request()
      .input("S", sql.Int, senderId)
      .input("R", sql.Int, receiverId)
      .input("CurrentID", sql.Int, invitationId)
      .input("TypeMatch", sql.NVarChar(50), `%"Type":"InviteToPlay"%`)
      .query(`
        UPDATE PlayInvitations
        SET Status = 'Cancelled', RespondedAt = GETDATE()
        WHERE (
          (SenderID = @S AND ReceiverID = @R) OR
          (SenderID = @R AND ReceiverID = @S)
        )
        AND Status = 'Pending'
        AND Message LIKE @TypeMatch
        AND InvitationID <> @CurrentID
      `);

    // 4. Create playing group and members if groupData is provided
    let newGroupId: number | null = null;
    if (groupData) {
      const groupResult = await transaction
        .request()
        .input("GroupName", sql.NVarChar(100), groupData.groupName)
        .input("CreatorID", sql.Int, senderId)
        .input("SkillLevel", sql.NVarChar(30), groupData.skillLevel)
        .input("AverageExperience", sql.Decimal(5, 2), groupData.averageExperience)
        .input("Description", sql.NVarChar(255), groupData.description)
        .query(`
          INSERT INTO PlayingGroups (GroupName, CreatedBy, SkillLevel, AverageExperience, Status, Description, CreatedAt, UpdatedAt)
          OUTPUT INSERTED.GroupID
          VALUES (@GroupName, @CreatorID, @SkillLevel, @AverageExperience, 'Open', @Description, GETDATE(), GETDATE())
        `);
        
      newGroupId = groupResult.recordset[0].GroupID;

      // Add sender as Leader
      await transaction
        .request()
        .input("GroupID", sql.Int, newGroupId)
        .input("UserID", sql.Int, senderId)
        .query(`
          INSERT INTO GroupMembers (GroupID, UserID, RoleInGroup, JoinedAt, Status)
          VALUES (@GroupID, @UserID, 'Leader', GETDATE(), 'Active')
        `);

      // Add receiver as Member
      await transaction
        .request()
        .input("GroupID", sql.Int, newGroupId)
        .input("UserID", sql.Int, receiverId)
        .query(`
          INSERT INTO GroupMembers (GroupID, UserID, RoleInGroup, JoinedAt, Status)
          VALUES (@GroupID, @UserID, 'Member', GETDATE(), 'Active')
        `);
    }

    await transaction.commit();
    return newGroupId;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function getPendingInvitationsCount(userId: number): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT COUNT(*) AS Count
      FROM PlayInvitations
      WHERE ReceiverID = @UserID
        AND Status = 'Pending'
        AND ExpiredAt > GETDATE()
    `);
  return result.recordset[0]?.Count || 0;
}
