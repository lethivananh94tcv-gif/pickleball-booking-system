import * as repo from "./player-matching.repository";

// Helper to convert DB Time format to minutes since midnight
function timeToMinutes(timeVal: any): number | null {
  if (!timeVal) return null;
  
  let timeStr = "";
  if (typeof timeVal === 'string') {
    timeStr = timeVal;
  } else if (timeVal instanceof Date) {
    // If SQL driver returns Date object for TIME columns
    const hrs = timeVal.getUTCHours();
    const mins = timeVal.getUTCMinutes();
    return hrs * 60 + mins;
  } else if (typeof timeVal === 'object' && timeVal.toISOString) {
    const d = new Date(timeVal.toISOString());
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  } else {
    timeStr = String(timeVal);
  }

  // Expecting format like "18:00" or "18:00:00"
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const hrs = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  if (isNaN(hrs) || isNaN(mins)) return null;
  return hrs * 60 + mins;
}

// Map SkillLevel string to number
function skillToNumber(level: string): number {
  const normalized = String(level || "").toLowerCase().trim();
  if (normalized.includes("novice")) return 2;
  if (normalized.includes("advanced intermediate")) return 4;
  if (normalized.includes("intermediate")) return 3;
  if (normalized.includes("expert")) return 6;
  if (normalized.includes("advanced")) return 5;
  if (normalized.includes("professional")) return 7;
  if (normalized.includes("beginner")) return 1;
  return 1;
}

// 1. Calculate Role Score
export function calculateRoleScore(roleA: string, roleB: string): number {
  const rA = String(roleA || "").toLowerCase();
  const rB = String(roleB || "").toLowerCase();

  if ((rA === "attacker" && rB === "defender") || (rA === "defender" && rB === "attacker")) {
    return 100;
  }
  if (rA === "all-rounder" || rB === "all-rounder") {
    return 75;
  }
  if (rA === rB && rA !== "") {
    return 30;
  }
  return 0;
}

// 2. Calculate Skill Score
export function calculateSkillScore(skillA: string, skillB: string): number {
  const valA = skillToNumber(skillA);
  const valB = skillToNumber(skillB);
  const diff = Math.abs(valA - valB);
  // 7-level scale: diff=0 → 100, diff=1 → 85, diff=2 → 70, ..., diff=6 → 10
  return Math.max(10, 100 - diff * 15);
}

// 3. Calculate Experience Score
export function calculateExperienceScore(expA: number, expB: number): number {
  const diff = Math.abs(expA - expB);
  return Math.max(0, 100 - diff * 10);
}

// 4. Calculate Schedule Score
export function calculateScheduleScore(
  startA: any,
  endA: any,
  startB: any,
  endB: any
): number {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);

  if (sA === null || eA === null || sB === null || eB === null) {
    return 0;
  }

  const overlapStart = Math.max(sA, sB);
  const overlapEnd = Math.min(eA, eB);
  const overlapMins = Math.max(0, overlapEnd - overlapStart);

  if (overlapMins >= 90) return 100;
  if (overlapMins >= 60) return 70;
  return 0;
}

export async function getPlayerProfile(userId: number) {
  return repo.findProfileByUserId(userId);
}

export async function savePlayerProfile(userId: number, data: repo.PlayerProfileData) {
  const existing = await repo.findProfileByUserId(userId);
  if (existing) {
    return repo.updateProfile(userId, data);
  } else {
    return repo.createProfile(userId, data);
  }
}

export async function findSuitableTeammates(userId: number) {
  const userProfile = await repo.findProfileByUserId(userId);
  if (!userProfile || !userProfile.AvailableStartTime || !userProfile.AvailableEndTime) {
    throw new Error("Vui lòng hoàn thiện lịch rảnh trước khi tìm đồng đội.");
  }

  const candidates = await repo.findAllMatchingProfiles(userId);
  
  const scoredCandidates = candidates.map(candidate => {
    const roleScore = calculateRoleScore(userProfile.PlayingRole, candidate.PlayingRole);
    const skillScore = calculateSkillScore(userProfile.SkillLevel, candidate.SkillLevel);
    const experienceScore = calculateExperienceScore(userProfile.ExperienceYears, candidate.ExperienceYears);
    const scheduleScore = calculateScheduleScore(
      userProfile.AvailableStartTime,
      userProfile.AvailableEndTime,
      candidate.AvailableStartTime,
      candidate.AvailableEndTime
    );

    const matchingScore = roleScore * 0.40 + skillScore * 0.25 + experienceScore * 0.20 + scheduleScore * 0.15;

    return {
      profile: candidate,
      scores: {
        roleScore,
        skillScore,
        experienceScore,
        scheduleScore
      },
      matchingScore: parseFloat(matchingScore.toFixed(1)),
      isGroup: false
    };
  });

  const recruitingGroups = await repo.findOpenRecruitingGroups(userId);
  const scoredGroups = recruitingGroups.map((g: any) => {
    const skillScore = calculateSkillScore(userProfile.SkillLevel, g.SkillLevel || "Intermediate");
    const experienceScore = calculateExperienceScore(userProfile.ExperienceYears, g.AverageExperience || 1);
    const scheduleScore = 85;
    const roleScore = 95;
    const matchingScore = roleScore * 0.40 + skillScore * 0.25 + experienceScore * 0.20 + scheduleScore * 0.15;

    return {
      profile: {
        PlayerProfileID: `group-${g.GroupID}`,
        UserID: g.CreatorID,
        FullName: g.GroupName,
        SkillLevel: g.SkillLevel || "Intermediate",
        ExperienceYears: g.AverageExperience || 1,
        PlayingRole: `👥 Nhóm (${g.CurrentPlayers}/${g.MaxPlayers} thành viên)`,
        PlayStyle: g.Description || "Nhóm đang tuyển thêm đồng đội cùng chơi Pickleball",
        AvailableStartTime: "06:00",
        AvailableEndTime: "22:00",
        AvatarURL: g.CreatorAvatar || null,
        IsGroup: true,
        GroupID: g.GroupID,
        CurrentPlayers: g.CurrentPlayers,
        MaxPlayers: g.MaxPlayers,
        CreatorID: g.CreatorID,
        CreatorName: g.CreatorName || "Trưởng nhóm"
      },
      scores: {
        roleScore,
        skillScore,
        experienceScore,
        scheduleScore
      },
      matchingScore: parseFloat(matchingScore.toFixed(1)),
      isGroup: true
    };
  });

  const allResults = [...scoredCandidates, ...scoredGroups];
  allResults.sort((a, b) => b.matchingScore - a.matchingScore);

  // Async log/save suggested match in background for analytics (if required)
  for (const match of allResults.slice(0, 5)) {
    if (match.matchingScore >= 50 && !match.isGroup) {
      await repo.createPlayerMatch(userId, match.profile.UserID, match.matchingScore, "Teammate").catch(() => {});
    }
  }

  return allResults;
}

export async function getUserActiveGroups(userId: number) {
  const groups = await repo.findUserGroups(userId);
  return Promise.all(
    (groups || []).map(async (g: any) => {
      const details = await getGroupDetails(g.GroupID);
      return {
        ...g,
        members: details?.members || []
      };
    })
  );
}

import { getGroupDetails, countActiveGroupMembers } from "../playgroups/playgroups.repository";

interface TeamMetrics {
  avgSkill: number;
  avgExp: number;
  avgRating: number;
  startTime: string | null;
  endTime: string | null;
}

async function calculateTeamMetrics(groupId: number): Promise<TeamMetrics> {
  const group = await getGroupDetails(groupId);
  if (!group || !group.members || group.members.length === 0) {
    return { avgSkill: 1, avgExp: 0, avgRating: 5.0, startTime: null, endTime: null };
  }

  const members = group.members;
  let totalSkill = 0;
  let totalExp = 0;
  let totalRating = 0;

  let commonStart: number | null = null;
  let commonEnd: number | null = null;

  // Find leader first to set baseline schedule
  const leader = members.find((m: any) => m.RoleInGroup === 'Leader');
  if (leader) {
    commonStart = timeToMinutes(leader.AvailableStartTime);
    commonEnd = timeToMinutes(leader.AvailableEndTime);
  }

  members.forEach((m: any) => {
    totalSkill += skillToNumber(m.SkillLevel || "Beginner");
    totalExp += m.ExperienceYears || 0;
    // Default matching rating to 5.0 if not defined/no profile
    totalRating += m.Rating !== undefined && m.Rating !== null ? parseFloat(m.Rating) : 5.0;

    // Intersect schedule
    const mStart = timeToMinutes(m.AvailableStartTime);
    const mEnd = timeToMinutes(m.AvailableEndTime);

    if (mStart !== null && mEnd !== null) {
      if (commonStart === null) {
        commonStart = mStart;
        commonEnd = mEnd;
      } else {
        commonStart = Math.max(commonStart, mStart);
        commonEnd = Math.min(commonEnd!, mEnd);
      }
    }
  });

  // Revert intersection if invalid
  if (commonStart !== null && commonEnd !== null && commonStart >= commonEnd) {
    if (leader) {
      commonStart = timeToMinutes(leader.AvailableStartTime);
      commonEnd = timeToMinutes(leader.AvailableEndTime);
    } else {
      commonStart = null;
      commonEnd = null;
    }
  }

  const count = members.length;
  
  // Format common start/end back to "HH:mm" strings
  const formatTime = (mins: number | null): string | null => {
    if (mins === null) return null;
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  return {
    avgSkill: totalSkill / count,
    avgExp: totalExp / count,
    avgRating: totalRating / count,
    startTime: formatTime(commonStart),
    endTime: formatTime(commonEnd)
  };
}

export async function findSuitableOpponents(userId: number, groupId: number) {
  // Validate group exists and user is member
  const groupA = await getGroupDetails(groupId);
  if (!groupA) {
    throw new Error("Không tìm thấy nhóm chơi của bạn.");
  }

  const isMember = groupA.members.some((m: any) => m.UserID === userId);
  if (!isMember) {
    throw new Error("Bạn không thuộc nhóm chơi này.");
  }

  const activeCountA = await countActiveGroupMembers(groupId);
  if (activeCountA < 2) {
    throw new Error("Nhóm của bạn cần có ít nhất 2 thành viên đang hoạt động để tìm đối thủ.");
  }

  const metricsA = await calculateTeamMetrics(groupId);
  const otherGroupIds = await repo.findAllOtherActiveGroups(groupId, userId);

  const scoredOpponents = await Promise.all(otherGroupIds.map(async (otherId) => {
    const groupB = await getGroupDetails(otherId);
    if (!groupB) return null;

    const activeCountB = await countActiveGroupMembers(otherId);
    if (activeCountB < 2) return null;

    const metricsB = await calculateTeamMetrics(otherId);

    // Ensure groupB has the most up-to-date average experience calculated from active members
    groupB.AverageExperience = parseFloat(metricsB.avgExp.toFixed(1));

    // Similarity calculations
    const skillSimilarity = Math.max(0, 100 - Math.abs(metricsA.avgSkill - metricsB.avgSkill) * 25);
    const experienceSimilarity = Math.max(0, 100 - Math.abs(metricsA.avgExp - metricsB.avgExp) * 10);
    const ratingSimilarity = Math.max(0, 100 - Math.abs(metricsA.avgRating - metricsB.avgRating) * 20);
    const scheduleScore = calculateScheduleScore(
      metricsA.startTime,
      metricsA.endTime,
      metricsB.startTime,
      metricsB.endTime
    );

    // OpponentScore = (SkillSimilarity * 0.40) + (ExperienceSimilarity * 0.35) + (RatingSimilarity * 0.15) + (ScheduleScore * 0.10)
    const opponentScore = (skillSimilarity * 0.40) + (experienceSimilarity * 0.35) + (ratingSimilarity * 0.15) + (scheduleScore * 0.10);

    return {
      group: groupB,
      scores: {
        skillSimilarity,
        experienceSimilarity,
        ratingSimilarity,
        scheduleScore
      },
      opponentScore: parseFloat(opponentScore.toFixed(1))
    };
  }));

  // Filter out nulls and sort descending
  const results = scoredOpponents.filter(Boolean) as any[];
  results.sort((a, b) => b.opponentScore - a.opponentScore);

  return results;
}
