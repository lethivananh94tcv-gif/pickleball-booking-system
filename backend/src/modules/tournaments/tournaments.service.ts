// ============================================================
// tournaments.service.ts
// Business Logic Layer for the Tournament module
// ============================================================

import * as tournamentRepo from "./tournaments.repository";
import { calculateAge, validateDUPR, getNextPowerOfTwo, shuffleTeams } from "./tournaments.utils";
import { TOURNAMENT_STATUS, DIVISION_STATUS, MATCH_STATUS } from "./tournaments.constants";
import { createAuditLog } from "@/modules/logs/logs.service";
import { createNotification } from "@/modules/notifications/notifications.service";
import type { 
  CreateTournamentInput, 
  UpdateTournamentInput, 
  CreateDivisionInput, 
  UpdateDivisionInput, 
  Tournament, 
  TournamentDivision 
} from "./tournaments.type";
import { getPool, sql } from "@/database/connection";
import { createPayosTournamentPaymentLink } from "../payments/gateways/payos.gateway";

// ─── CENTRALIZED STATE TRANSITION SERVICE ─────────────────────

/**
 * Recompute & update Division status based on matches and registration
 */
export async function recomputeDivisionStatus(divisionId: number): Promise<string> {
  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) return "Draft";

  if (division.Status === DIVISION_STATUS.DRAFT || division.Status === DIVISION_STATUS.CANCELLED) {
    return division.Status;
  }

  const pool = await getPool();
  const matchesRes = await pool.request()
    .input("DivisionID", sql.Int, divisionId)
    .query("SELECT MatchID, MatchStatus, GroupName, KnockoutRound, CourtID, ScheduledStart FROM TournamentMatches WHERE DivisionID = @DivisionID");

  const matches = matchesRes.recordset;

  let newStatus = division.Status;

  if (matches.length === 0) {
    if (division.Status === DIVISION_STATUS.OPEN || division.Status === DIVISION_STATUS.REGISTRATION_CLOSED) {
      newStatus = division.Status;
    }
  } else {
    const hasKnockoutMatches = matches.some(m => m.GroupName === "Knockout" || (m.KnockoutRound && m.KnockoutRound !== ""));
    const groupMatches = matches.filter(m => m.GroupName && m.GroupName !== "Knockout");
    
    const allMatchesCompleted = matches.every(m => 
      m.MatchStatus === MATCH_STATUS.COMPLETED || 
      m.MatchStatus === MATCH_STATUS.FORFEIT || 
      m.MatchStatus === MATCH_STATUS.BYE_COMPLETED
    );
    const anyInProgressOrCompleted = matches.some(m => 
      m.MatchStatus === MATCH_STATUS.IN_PROGRESS || 
      m.MatchStatus === MATCH_STATUS.COMPLETED || 
      m.MatchStatus === MATCH_STATUS.FORFEIT
    );
    const hasAllocatedCourts = matches.some(m => m.CourtID !== null || m.ScheduledStart !== null);

    if (division.BracketType === "RoundRobin" || division.BracketType === "SingleElimination") {
      if (allMatchesCompleted) {
        newStatus = DIVISION_STATUS.COMPLETED;
      } else if (anyInProgressOrCompleted) {
        newStatus = DIVISION_STATUS.ONGOING;
      } else if (hasAllocatedCourts) {
        newStatus = DIVISION_STATUS.SCHEDULED;
      } else {
        newStatus = DIVISION_STATUS.DRAW_GENERATED;
      }
    } else if (division.BracketType === "GroupKnockout") {
      if (hasKnockoutMatches) {
        const knockoutMatches = matches.filter(m => m.GroupName === "Knockout" || (m.KnockoutRound && m.KnockoutRound !== ""));
        const allKnockoutCompleted = knockoutMatches.every(m => 
          m.MatchStatus === MATCH_STATUS.COMPLETED || 
          m.MatchStatus === MATCH_STATUS.FORFEIT || 
          m.MatchStatus === MATCH_STATUS.BYE_COMPLETED
        );
        if (allKnockoutCompleted) {
          newStatus = DIVISION_STATUS.COMPLETED;
        } else {
          newStatus = DIVISION_STATUS.KNOCKOUT_STAGE;
        }
      } else {
        const allGroupCompleted = groupMatches.length > 0 && groupMatches.every(m => 
          m.MatchStatus === MATCH_STATUS.COMPLETED || 
          m.MatchStatus === MATCH_STATUS.FORFEIT || 
          m.MatchStatus === MATCH_STATUS.BYE_COMPLETED
        );
        if (allGroupCompleted) {
          newStatus = DIVISION_STATUS.GROUP_COMPLETED;
        } else if (anyInProgressOrCompleted) {
          newStatus = DIVISION_STATUS.ONGOING;
        } else if (hasAllocatedCourts) {
          newStatus = DIVISION_STATUS.SCHEDULED;
        } else {
          newStatus = DIVISION_STATUS.DRAW_GENERATED;
        }
      }
    }
  }


  if (newStatus !== division.Status) {
    await tournamentRepo.updateDivisionStatus(divisionId, newStatus);
  }

  return newStatus;
}

/**
 * Recompute & update Tournament status based on all divisions status
 */
export async function recomputeTournamentStatus(tournamentId: number): Promise<string> {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) return "Draft";

  if (tournament.Status === TOURNAMENT_STATUS.DRAFT || tournament.Status === TOURNAMENT_STATUS.CANCELLED) {
    return tournament.Status;
  }

  const divisions = await tournamentRepo.findDivisionsByTournamentId(tournamentId);
  const activeDivisions = divisions.filter(d => d.Status !== DIVISION_STATUS.CANCELLED);

  if (activeDivisions.length === 0) return tournament.Status;

  let newStatus = tournament.Status;

  const allCompleted = activeDivisions.every(d => d.Status === DIVISION_STATUS.COMPLETED);
  const anyOngoing = activeDivisions.some(d => 
    d.Status === DIVISION_STATUS.ONGOING ||
    d.Status === DIVISION_STATUS.GROUP_COMPLETED ||
    d.Status === DIVISION_STATUS.KNOCKOUT_STAGE
  );
  const anyScheduled = activeDivisions.some(d => d.Status === DIVISION_STATUS.SCHEDULED);
  const anyOpen = activeDivisions.some(d => d.Status === DIVISION_STATUS.OPEN);
  const allRegClosed = activeDivisions.every(d => d.Status === DIVISION_STATUS.REGISTRATION_CLOSED);

  if (allCompleted) {
    newStatus = TOURNAMENT_STATUS.COMPLETED;
  } else if (anyOngoing) {
    newStatus = TOURNAMENT_STATUS.ONGOING;
  } else if (anyScheduled) {
    newStatus = TOURNAMENT_STATUS.SCHEDULED;
  } else if (allRegClosed) {
    newStatus = TOURNAMENT_STATUS.REGISTRATION_CLOSED;
  } else if (anyOpen) {
    newStatus = TOURNAMENT_STATUS.OPEN;
  }

  if (newStatus !== tournament.Status) {
    await tournamentRepo.updateTournamentStatus(tournamentId, newStatus);
  }

  return newStatus;
}

/**
 * Transition Tournament status with validation
 */
export async function transitionTournamentStatus(tournamentId: number, targetStatus: string, options?: { adminOverride?: boolean }) {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });

  if (options?.adminOverride) {
    const updated = await tournamentRepo.updateTournamentStatus(tournamentId, targetStatus);
    return updated;
  }

  const validTransitions: Record<string, string[]> = {
    [TOURNAMENT_STATUS.DRAFT]: [TOURNAMENT_STATUS.OPEN, TOURNAMENT_STATUS.CANCELLED],
    [TOURNAMENT_STATUS.OPEN]: [TOURNAMENT_STATUS.REGISTRATION_CLOSED, TOURNAMENT_STATUS.CANCELLED],
    [TOURNAMENT_STATUS.REGISTRATION_CLOSED]: [TOURNAMENT_STATUS.SCHEDULED, TOURNAMENT_STATUS.ONGOING, TOURNAMENT_STATUS.CANCELLED],
    [TOURNAMENT_STATUS.SCHEDULED]: [TOURNAMENT_STATUS.ONGOING, TOURNAMENT_STATUS.CANCELLED],
    [TOURNAMENT_STATUS.ONGOING]: [TOURNAMENT_STATUS.COMPLETED, TOURNAMENT_STATUS.CANCELLED],
    [TOURNAMENT_STATUS.COMPLETED]: [],
    [TOURNAMENT_STATUS.CANCELLED]: [],
  };

  const allowed = validTransitions[tournament.Status] || [];
  if (!allowed.includes(targetStatus)) {
    throw Object.assign(new Error(`Không thể chuyển trạng thái giải đấu từ ${tournament.Status} sang ${targetStatus}`), { statusCode: 400 });
  }

  const updated = await tournamentRepo.updateTournamentStatus(tournamentId, targetStatus);
  return updated;
}

/**
 * Transition Division status with validation
 */
export async function transitionDivisionStatus(divisionId: number, targetStatus: string, options?: { adminOverride?: boolean }) {
  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });

  if (options?.adminOverride) {
    const updated = await tournamentRepo.updateDivisionStatus(divisionId, targetStatus);
    await recomputeTournamentStatus(division.TournamentID);
    return updated;
  }

  const validTransitions: Record<string, string[]> = {
    [DIVISION_STATUS.DRAFT]: [DIVISION_STATUS.OPEN, DIVISION_STATUS.CANCELLED],
    [DIVISION_STATUS.OPEN]: [DIVISION_STATUS.REGISTRATION_CLOSED, DIVISION_STATUS.CANCELLED],
    [DIVISION_STATUS.REGISTRATION_CLOSED]: [DIVISION_STATUS.DRAW_GENERATED, DIVISION_STATUS.CANCELLED],
    [DIVISION_STATUS.DRAW_GENERATED]: [DIVISION_STATUS.SCHEDULED, DIVISION_STATUS.ONGOING, DIVISION_STATUS.CANCELLED],
    [DIVISION_STATUS.SCHEDULED]: [DIVISION_STATUS.ONGOING, DIVISION_STATUS.CANCELLED],
    [DIVISION_STATUS.ONGOING]: [DIVISION_STATUS.GROUP_COMPLETED, DIVISION_STATUS.COMPLETED, DIVISION_STATUS.CANCELLED],
    [DIVISION_STATUS.GROUP_COMPLETED]: [DIVISION_STATUS.KNOCKOUT_STAGE, DIVISION_STATUS.COMPLETED, DIVISION_STATUS.CANCELLED],
    [DIVISION_STATUS.KNOCKOUT_STAGE]: [DIVISION_STATUS.COMPLETED, DIVISION_STATUS.CANCELLED],
    [DIVISION_STATUS.COMPLETED]: [],
    [DIVISION_STATUS.CANCELLED]: [],
  };

  const allowed = validTransitions[division.Status] || [];
  if (!allowed.includes(targetStatus)) {
    throw Object.assign(new Error(`Không thể chuyển trạng thái nội dung thi đấu từ ${division.Status} sang ${targetStatus}`), { statusCode: 400 });
  }

  const updated = await tournamentRepo.updateDivisionStatus(divisionId, targetStatus);
  await recomputeTournamentStatus(division.TournamentID);
  return updated;
}

export async function setMatchReady(matchId: number, userId: number) {
  const match = await tournamentRepo.findMatchDetail(matchId);
  if (!match) throw Object.assign(new Error("Không tìm thấy trận đấu"), { statusCode: 404 });

  if (match.MatchStatus !== MATCH_STATUS.SCHEDULED) {
    throw Object.assign(new Error(`Không thể chuyển trạng thái trận đấu từ ${match.MatchStatus} sang Ready. Chỉ chấp nhận các trận đang Lập lịch (Scheduled).`), { statusCode: 400 });
  }

  if (!match.TeamAID || !match.TeamBID) {
    throw Object.assign(new Error("Không thể chuyển trận đấu sang Ready khi chưa xác định đầy đủ hai đội thi đấu"), { statusCode: 400 });
  }

  if (match.ScoreText === "BYE" || match.MatchStatus === MATCH_STATUS.BYE_COMPLETED) {
    throw Object.assign(new Error("Không thể chuyển trận đấu miễn thi đấu (BYE) sang Ready"), { statusCode: 400 });
  }

  const updated = await tournamentRepo.updateMatchStatus(matchId, MATCH_STATUS.READY);
  return updated;
}

/**
 * Start Match (InProgress)
 */
export async function startMatch(
  matchId: number,
  userId: number,
  userRole: string,
  adminOverride?: boolean,
  reason?: string
) {
  const match = await tournamentRepo.findMatchDetail(matchId);
  if (!match) throw Object.assign(new Error("Không tìm thấy trận đấu"), { statusCode: 404 });

  // terminal statuses check
  if ([MATCH_STATUS.COMPLETED, MATCH_STATUS.CANCELLED, MATCH_STATUS.FORFEIT, MATCH_STATUS.BYE_COMPLETED].includes(match.MatchStatus as any)) {
    throw Object.assign(new Error(`Không thể bắt đầu trận đấu đang ở trạng thái ${match.MatchStatus}`), { statusCode: 400 });
  }

  // missing teams check
  if (!match.TeamAID || !match.TeamBID) {
    throw Object.assign(new Error("Không thể bắt đầu trận đấu khi chưa xác định đầy đủ hai đội thi đấu"), { statusCode: 400 });
  }

  if (match.MatchStatus === MATCH_STATUS.SCHEDULED) {
    if (!adminOverride || userRole !== "Admin") {
      throw Object.assign(new Error("Trận đấu đang ở trạng thái Lập lịch (Scheduled) và chưa Sẵn sàng (Ready). Cần quyền Admin ghi đè (adminOverride = true) để bắt đầu."), { statusCode: 400 });
    }

    // Write override start log
    const oldStatus = match.MatchStatus;
    const newStatus = MATCH_STATUS.IN_PROGRESS;
    const actionReason = reason || "Không có lý do cụ thể";
    const desc = `OVERRIDE_START: user=${userId}, role=${userRole}, match=${matchId}, from=${oldStatus} to=${newStatus}, Reason=${actionReason}`;
    
    await createAuditLog({
      userId,
      actionName: "ADMIN_OVERRIDE_START_MATCH",
      tableName: "TournamentMatches",
      entityId: matchId,
      description: desc.slice(0, 490),
    });
  } else if (match.MatchStatus !== MATCH_STATUS.READY) {
    if (match.MatchStatus !== MATCH_STATUS.IN_PROGRESS) {
      throw Object.assign(new Error(`Không thể chuyển trận đấu từ trạng thái ${match.MatchStatus} sang InProgress`), { statusCode: 400 });
    }
  }

  const updated = await tournamentRepo.updateMatchStatus(matchId, MATCH_STATUS.IN_PROGRESS);
  
  await recomputeDivisionStatus(match.DivisionID);
  await recomputeTournamentStatus(match.TournamentID);

  return updated;
}
// ─── TOURNAMENTS ─────────────────────────────────────────────

/**
 * Get all tournaments with filters
 */
export async function getAllTournaments(filters: {
  status?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}) {
  return tournamentRepo.findTournaments(filters);
}

/**
 * Get tournament details by ID
 */
export async function getTournamentById(id: number) {
  const tournament = await tournamentRepo.findTournamentById(id);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  const divisions = await tournamentRepo.findDivisionsByTournamentId(id);
  return {
    ...tournament,
    divisions,
  };
}

/**
 * Create a new tournament (Admin only, validation handled in controller)
 */
export async function createTournament(data: CreateTournamentInput, createdBy: number) {
  // Check if code is duplicate
  const existing = await tournamentRepo.findTournamentByCode(data.tournamentCode);
  if (existing) {
    throw Object.assign(new Error("Mã giải đấu đã tồn tại"), { statusCode: 409 });
  }

  const tournament = await tournamentRepo.createTournament({ ...data, createdBy });

  // Write audit log
  await createAuditLog({
    userId: createdBy,
    actionName: "CREATE_TOURNAMENT",
    tableName: "Tournaments",
    entityId: tournament.TournamentID,
    description: `Admin tạo giải đấu mới: ${tournament.TournamentName} (Mã: ${tournament.TournamentCode})`,
  });

  return tournament;
}

/**
 * Update tournament details
 */
export async function updateTournament(id: number, data: UpdateTournamentInput, userId: number) {
  const tournament = await tournamentRepo.findTournamentById(id);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  // Validate date relationship on update
  const mergedRegStart = data.registrationStart ? new Date(data.registrationStart) : new Date(tournament.RegistrationStart);
  const mergedRegEnd = data.registrationEnd ? new Date(data.registrationEnd) : new Date(tournament.RegistrationEnd);
  const mergedTourStart = data.tournamentStart ? new Date(data.tournamentStart) : new Date(tournament.TournamentStart);
  const mergedTourEnd = data.tournamentEnd ? new Date(data.tournamentEnd) : new Date(tournament.TournamentEnd);

  if (mergedRegStart >= mergedRegEnd) {
    throw Object.assign(new Error("Ngày bắt đầu đăng ký phải trước ngày kết thúc đăng ký"), { statusCode: 400 });
  }
  if (mergedRegEnd > mergedTourStart) {
    throw Object.assign(new Error("Ngày kết thúc đăng ký phải trước hoặc bằng ngày bắt đầu giải đấu"), { statusCode: 400 });
  }
  if (mergedTourStart >= mergedTourEnd) {
    throw Object.assign(new Error("Ngày bắt đầu giải đấu phải trước ngày kết thúc giải đấu"), { statusCode: 400 });
  }

  // Chặn cập nhật ngày về quá khứ
  const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const todayStr = `${nowVN.getFullYear()}-${String(nowVN.getMonth() + 1).padStart(2, "0")}-${String(nowVN.getDate()).padStart(2, "0")}`;

  if (data.registrationStart) {
    const regStartStr = data.registrationStart.split("T")[0];
    if (regStartStr < todayStr) {
      throw Object.assign(new Error("Ngày bắt đầu đăng ký không được ở quá khứ"), { statusCode: 400 });
    }
  }

  if (data.tournamentStart) {
    const tourStartStr = data.tournamentStart.split("T")[0];
    if (tourStartStr < todayStr) {
      throw Object.assign(new Error("Ngày bắt đầu giải đấu không được ở quá khứ"), { statusCode: 400 });
    }
  }

  // BR-T01 / BR-T37: Không cho sửa nếu đã Completed hoặc Cancelled, trừ khi chỉ ẩn/hiện giải đấu (isHidden)
  const isOnlyHiding = data.isHidden !== undefined && Object.keys(data).filter(k => k !== "isHidden" && k !== "adminOverride").length === 0;
  if (!isOnlyHiding && (tournament.Status === TOURNAMENT_STATUS.COMPLETED || tournament.Status === TOURNAMENT_STATUS.CANCELLED)) {
    throw Object.assign(
      new Error(`Không thể cập nhật giải đấu ở trạng thái ${tournament.Status}`),
      { statusCode: 400 }
    );
  }

  // Không cho sửa ngày nếu đã Ongoing
  if (tournament.Status === TOURNAMENT_STATUS.ONGOING) {
    const isRegStartChanged = data.registrationStart && new Date(data.registrationStart).getTime() !== new Date(tournament.RegistrationStart).getTime();
    const isRegEndChanged = data.registrationEnd && new Date(data.registrationEnd).getTime() !== new Date(tournament.RegistrationEnd).getTime();
    const isTourStartChanged = data.tournamentStart && new Date(data.tournamentStart).getTime() !== new Date(tournament.TournamentStart).getTime();
    const isTourEndChanged = data.tournamentEnd && new Date(data.tournamentEnd).getTime() !== new Date(tournament.TournamentEnd).getTime();

    if (isRegStartChanged || isRegEndChanged || isTourStartChanged || isTourEndChanged) {
      throw Object.assign(
        new Error("Không thể thay đổi ngày khi giải đấu đang diễn ra (Ongoing)"),
        { statusCode: 400 }
      );
    }
  }

  // Khóa thông tin quan trọng sát giờ G
  if (process.env.ENABLE_STRICT_VALIDATIONS === "true") {
    const hoursToStart = (new Date(tournament.TournamentStart).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursToStart > 0 && hoursToStart < 24) {
      const isNameChanged = data.tournamentName && data.tournamentName !== tournament.TournamentName;
      const isLocationChanged = data.location && data.location !== tournament.Location;
      const isStartChanged = data.tournamentStart && new Date(data.tournamentStart).getTime() !== new Date(tournament.TournamentStart).getTime();
      const isEndChanged = data.tournamentEnd && new Date(data.tournamentEnd).getTime() !== new Date(tournament.TournamentEnd).getTime();

      const isModifyingCriticalFields = isNameChanged || isLocationChanged || isStartChanged || isEndChanged;

      if (isModifyingCriticalFields && !data.adminOverride) {
        throw Object.assign(
          new Error("Không thể thay đổi tên giải đấu, địa điểm hoặc thời gian trong vòng 24 giờ trước khi giải đấu bắt đầu. Cần quyền Admin ghi đè (adminOverride = true) để tiếp tục."),
          { statusCode: 400 }
        );
      }
    }
  }

  const updatedTournament = await tournamentRepo.updateTournament(id, data);

  // Write audit log
  await createAuditLog({
    userId,
    actionName: "UPDATE_TOURNAMENT",
    tableName: "Tournaments",
    entityId: id,
    description: `Admin cập nhật thông tin giải đấu ID: ${id}`,
  });

  return updatedTournament;
}

/**
 * Clean up matches for a division
 */
export async function resetDivisionMatches(divisionId: number): Promise<void> {
  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) return;
  await tournamentRepo.deleteDivisionMatches(divisionId);
  await tournamentRepo.updateDivisionStatus(divisionId, DIVISION_STATUS.REGISTRATION_CLOSED);
  await recomputeTournamentStatus(division.TournamentID);
}

/**
 * Publish tournament (Draft -> Open)
 */
export async function publishTournament(id: number, userId: number) {
  const tournament = await tournamentRepo.findTournamentById(id);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  if (tournament.Status !== TOURNAMENT_STATUS.DRAFT) {
    throw Object.assign(
      new Error("Chỉ có thể công bố giải đấu đang ở trạng thái nháp (Draft)"),
      { statusCode: 400 }
    );
  }

  const published = await tournamentRepo.updateTournamentStatus(id, TOURNAMENT_STATUS.OPEN);
  
  // Mở các division Draft -> Open
  await tournamentRepo.updateAllDivisionsStatusInTournament(id, DIVISION_STATUS.DRAFT, DIVISION_STATUS.OPEN);

  // Write audit log
  await createAuditLog({
    userId,
    actionName: "PUBLISH_TOURNAMENT",
    tableName: "Tournaments",
    entityId: id,
    description: `Admin công bố giải đấu ID: ${id}`,
  });

  // Notify players (broadly or system-wide)
  // In a real system, you can pull active users and send them notifications.
  // For simplicity, we write a system notification log.
  try {
    const pool = await getPool();
    const activeUsers = await pool.request().query("SELECT UserID FROM Users WHERE Status = 'Active'");
    for (const u of activeUsers.recordset) {
      void createNotification({
        userId: u.UserID,
        title: "Giải đấu mới sắp diễn ra!",
        message: `Giải đấu ${published.TournamentName} vừa được công bố. Đăng ký tham gia ngay!`,
        notificationType: "System"
      });
    }
  } catch (err) {
    console.error("Failed to notify users about new tournament:", err);
  }

  return published;
}

/**
 * Close Registration (Open -> RegistrationClosed)
 */
export async function closeRegistration(id: number, userId: number) {
  const tournament = await tournamentRepo.findTournamentById(id);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  if (tournament.Status !== TOURNAMENT_STATUS.OPEN) {
    throw Object.assign(
      new Error("Chỉ có thể đóng đăng ký khi giải đấu đang mở (Open)"),
      { statusCode: 400 }
    );
  }

  const closed = await tournamentRepo.updateTournamentStatus(id, TOURNAMENT_STATUS.REGISTRATION_CLOSED);

  // Đóng các division Open -> RegistrationClosed
  await tournamentRepo.updateAllDivisionsStatusInTournament(id, DIVISION_STATUS.OPEN, DIVISION_STATUS.REGISTRATION_CLOSED);

  // Write audit log
  await createAuditLog({
    userId,
    actionName: "CLOSE_REGISTRATION",
    tableName: "Tournaments",
    entityId: id,
    description: `Admin đóng đăng ký giải đấu ID: ${id}`,
  });

  return closed;
}

/**
 * Cancel Tournament
 */
export async function cancelTournament(id: number, userId: number) {
  const tournament = await tournamentRepo.findTournamentById(id);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  if (tournament.Status === TOURNAMENT_STATUS.COMPLETED || tournament.Status === TOURNAMENT_STATUS.CANCELLED) {
    throw Object.assign(
      new Error(`Giải đấu đã ở trạng thái ${tournament.Status}, không thể hủy`),
      { statusCode: 400 }
    );
  }

  const cancelled = await tournamentRepo.updateTournamentStatus(id, TOURNAMENT_STATUS.CANCELLED);

  // Hủy các division thuộc giải
  await tournamentRepo.updateAllDivisionsStatusInTournament(id, DIVISION_STATUS.DRAFT, DIVISION_STATUS.CANCELLED);
  await tournamentRepo.updateAllDivisionsStatusInTournament(id, DIVISION_STATUS.OPEN, DIVISION_STATUS.CANCELLED);
  await tournamentRepo.updateAllDivisionsStatusInTournament(id, DIVISION_STATUS.REGISTRATION_CLOSED, DIVISION_STATUS.CANCELLED);
  await tournamentRepo.updateAllDivisionsStatusInTournament(id, DIVISION_STATUS.DRAW_GENERATED, DIVISION_STATUS.CANCELLED);
  await tournamentRepo.updateAllDivisionsStatusInTournament(id, DIVISION_STATUS.SCHEDULED, DIVISION_STATUS.CANCELLED);

  // Write audit log
  await createAuditLog({
    userId,
    actionName: "CANCEL_TOURNAMENT",
    tableName: "Tournaments",
    entityId: id,
    description: `Admin hủy giải đấu ID: ${id}`,
  });

  // Notify registered players
  try {
    const pool = await getPool();
    const registeredPlayers = await pool.request()
      .input("TournamentID", sql.Int, id)
      .query(`
        SELECT DISTINCT UserID 
        FROM TournamentTeamMembers 
        WHERE TournamentID = @TournamentID AND JoinStatus = 'Accepted'
      `);
      
    for (const r of registeredPlayers.recordset) {
      void createNotification({
        userId: r.UserID,
        title: "Thông báo hủy giải đấu",
        message: `Giải đấu ${cancelled.TournamentName} đã bị hủy bỏ bởi ban tổ chức.`,
        notificationType: "System"
      });
    }
  } catch (err) {
    console.error("Failed to notify users about tournament cancellation:", err);
  }

  return cancelled;
}

/**
 * Delete Tournament (only if Status is Draft)
 */
export async function deleteTournament(id: number, userId: number) {
  const tournament = await tournamentRepo.findTournamentById(id);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  if (tournament.Status !== TOURNAMENT_STATUS.DRAFT) {
    throw Object.assign(
      new Error("Chỉ được phép xóa giải đấu ở trạng thái Nháp (Draft). Các giải đấu khác vui lòng thực hiện Hủy giải."),
      { statusCode: 400 }
    );
  }

  const success = await tournamentRepo.softDeleteTournament(id);
  if (!success) {
    throw Object.assign(new Error("Không thể xóa giải đấu"), { statusCode: 500 });
  }

  // Write audit log
  await createAuditLog({
    userId,
    actionName: "DELETE_TOURNAMENT",
    tableName: "Tournaments",
    entityId: id,
    description: `Admin xóa giải đấu ID: ${id} (Trạng thái Nháp)`,
  });

  return { success: true };
}

// ─── DIVISIONS ───────────────────────────────────────────────

/**
 * Get divisions lists for a tournament
 */
export async function getDivisionsByTournamentId(tournamentId: number) {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }
  return tournamentRepo.findDivisionsByTournamentId(tournamentId);
}

/**
 * Create a new tournament division
 */
export async function createDivision(tournamentId: number, data: CreateDivisionInput, userId: number) {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  if (tournament.Status !== TOURNAMENT_STATUS.DRAFT && tournament.Status !== TOURNAMENT_STATUS.OPEN) {
    throw Object.assign(
      new Error("Chỉ có thể thêm nội dung khi giải đấu ở trạng thái nháp (Draft) hoặc mở đăng ký (Open)"),
      { statusCode: 400 }
    );
  }

  if (data.minDUPR !== undefined && data.minDUPR !== null &&
      data.maxDUPR !== undefined && data.maxDUPR !== null &&
      data.minDUPR > data.maxDUPR) {
    throw Object.assign(new Error("DUPR tối thiểu không được lớn hơn DUPR tối đa"), { statusCode: 400 });
  }

  // Auto set TeamSize and GenderRequirement based on CompetitionFormat (BR-T07/08/09/10/11)
  let teamSize = 1;
  let genderRequirement = "Mixed";

  switch (data.competitionFormat) {
    case "MenSingles":
      teamSize = 1;
      genderRequirement = "MaleOnly";
      break;
    case "WomenSingles":
      teamSize = 1;
      genderRequirement = "FemaleOnly";
      break;
    case "MenDoubles":
      teamSize = 2;
      genderRequirement = "MaleOnly";
      break;
    case "WomenDoubles":
      teamSize = 2;
      genderRequirement = "FemaleOnly";
      break;
    case "MixedDoubles":
      teamSize = 2;
      genderRequirement = "Mixed";
      break;
  }

  const division = await tournamentRepo.createDivision(tournamentId, {
    ...data,
    teamSize,
    genderRequirement,
  });

  // Nếu giải đấu đã được công bố (Status là Open), tự động chuyển Division sang Open để mở đăng ký
  if (tournament.Status === TOURNAMENT_STATUS.OPEN) {
    await tournamentRepo.updateDivisionStatus(division.DivisionID, DIVISION_STATUS.OPEN);
    division.Status = DIVISION_STATUS.OPEN;
  }

  // Write audit log
  await createAuditLog({
    userId,
    actionName: "CREATE_DIVISION",
    tableName: "TournamentDivisions",
    entityId: division.DivisionID,
    description: `Admin tạo nội dung thi đấu mới: ${division.DivisionName} cho giải ID: ${tournamentId}`,
  });

  return division;
}

/**
 * Get division details
 */
export async function getDivisionById(divisionId: number) {
  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
  }
  return division;
}

/**
 * Update tournament division details
 */
export async function updateDivision(divisionId: number, data: UpdateDivisionInput, userId: number) {
  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
  }

  // BR-T26: Không cho sửa DUPR, AgeGroup, Format... nếu Division đã Ongoing
  if (division.Status === DIVISION_STATUS.ONGOING || division.Status === DIVISION_STATUS.COMPLETED) {
    throw Object.assign(
      new Error("Không thể thay đổi nội dung thi đấu khi giải đấu đang diễn ra hoặc đã kết thúc"),
      { statusCode: 400 }
    );
  }

  const updated = await tournamentRepo.updateDivision(divisionId, data);

  // Write audit log
  await createAuditLog({
    userId,
    actionName: "UPDATE_DIVISION",
    tableName: "TournamentDivisions",
    entityId: divisionId,
    description: `Admin cập nhật nội dung thi đấu ID: ${divisionId}`,
  });

  return updated;
}

// ─── PLAYER REGISTRATIONS & INVITATIONS ──────────────────────

/**
 * Validates player for division requirements (gender, age, DUPR, duplicates)
 */
export async function validatePlayerForDivision(userId: number, division: TournamentDivision) {
  const player = await tournamentRepo.findUserPlayerProfile(userId);
  if (!player) {
    throw Object.assign(new Error(`Tài khoản ID ${userId} không tồn tại hoặc không hoạt động`), { statusCode: 404 });
  }

  if (!player.DUPR) {
    throw Object.assign(new Error(`Người chơi ${player.FullName} chưa thiết lập profile vận động viên (DUPR)`), { statusCode: 400 });
  }

  // 1. Gender Validation (BR-T09/T10/T11)
  if (division.GenderRequirement === "MaleOnly" && player.Gender !== "Male") {
    throw Object.assign(new Error(`Nội dung này yêu cầu vận động viên Nam (Người chơi: ${player.FullName} - ${player.Gender})`), { statusCode: 400 });
  }
  if (division.GenderRequirement === "FemaleOnly" && player.Gender !== "Female") {
    throw Object.assign(new Error(`Nội dung này yêu cầu vận động viên Nữ (Người chơi: ${player.FullName} - ${player.Gender})`), { statusCode: 400 });
  }

  // 2. Age Group Validation (BR-T12/T13/T14)
  if (division.AgeGroup !== "Open") {
    if (!player.DateOfBirth) {
      throw Object.assign(new Error(`Vận động viên ${player.FullName} chưa cập nhật ngày sinh để xác thực nhóm tuổi`), { statusCode: 400 });
    }
    const age = calculateAge(player.DateOfBirth);
    
    if (division.AgeGroup === "Youth" && age >= 18) {
      throw Object.assign(new Error(`Người chơi đã ${age} tuổi, vượt quá độ tuổi Thanh thiếu niên (dưới 18 tuổi)`), { statusCode: 400 });
    }
    if (division.AgeGroup === "Senior50" && age < 50) {
      throw Object.assign(new Error(`Người chơi mới ${age} tuổi, yêu cầu trên 50 tuổi`), { statusCode: 400 });
    }
    if (division.AgeGroup === "Senior60" && age < 60) {
      throw Object.assign(new Error(`Người chơi mới ${age} tuổi, yêu cầu trên 60 tuổi`), { statusCode: 400 });
    }

    // Min/Max age limits
    if (division.MinAge !== null && division.MinAge !== undefined && age < division.MinAge) {
      throw Object.assign(new Error(`Người chơi mới ${age} tuổi, nhỏ hơn độ tuổi tối thiểu ${division.MinAge}`), { statusCode: 400 });
    }
  if (division.MaxAge !== null && division.MaxAge !== undefined && age > division.MaxAge) {
    throw Object.assign(new Error(`Người chơi đã ${age} tuổi, lớn hơn độ tuổi tối đa ${division.MaxAge}`), { statusCode: 400 });
  }
}

  // 3. DUPR Validation
  const isDuprValid = validateDUPR(player.DUPR, division.MinDUPR, division.MaxDUPR);
  if (!isDuprValid) {
    throw Object.assign(new Error(`Điểm DUPR của ${player.FullName} (${player.DUPR}) không nằm trong giới hạn cho phép (${division.MinDUPR ?? 0} - ${division.MaxDUPR ?? 8.0})`), { statusCode: 400 });
  }

  return player;
}
export function validateManualAthlete(ath: any, division: TournamentDivision) {
  // 1. Gender Validation
  if (division.GenderRequirement === "MaleOnly" && ath.gender !== "Male") {
    throw Object.assign(new Error(`Vận động viên ${ath.fullName} không đúng giới tính yêu cầu (Nam)`), { statusCode: 400 });
  }
  if (division.GenderRequirement === "FemaleOnly" && ath.gender !== "Female") {
    throw Object.assign(new Error(`Vận động viên ${ath.fullName} không đúng giới tính yêu cầu (Nữ)`), { statusCode: 400 });
  }

  // 2. Age Group Validation
  if (division.AgeGroup !== "Open") {
    const age = calculateAge(ath.dateOfBirth);
    if (division.AgeGroup === "Youth" && age >= 18) {
      throw Object.assign(new Error(`Vận động viên ${ath.fullName} đã ${age} tuổi, vượt quá độ tuổi Youth (<18)`), { statusCode: 400 });
    }
    if (division.AgeGroup === "Senior50" && age < 50) {
      throw Object.assign(new Error(`Vận động viên ${ath.fullName} mới ${age} tuổi, chưa đạt độ tuổi Senior 50+`), { statusCode: 400 });
    }
    if (division.AgeGroup === "Senior60" && age < 60) {
      throw Object.assign(new Error(`Vận động viên ${ath.fullName} mới ${age} tuổi, chưa đạt độ tuổi Senior 60+`), { statusCode: 400 });
    }
    if (division.MinAge !== null && division.MinAge !== undefined && age < division.MinAge) {
      throw Object.assign(new Error(`Vận động viên ${ath.fullName} mới ${age} tuổi, nhỏ hơn độ tuổi tối thiểu ${division.MinAge}`), { statusCode: 400 });
    }
    if (division.MaxAge !== null && division.MaxAge !== undefined && age > division.MaxAge) {
      throw Object.assign(new Error(`Vận động viên ${ath.fullName} đã ${age} tuổi, lớn hơn độ tuổi tối đa ${division.MaxAge}`), { statusCode: 400 });
    }
  }

  // 3. DUPR Validation
  const isDuprValid = validateDUPR(Number(ath.rating), division.MinDUPR, division.MaxDUPR);
  if (!isDuprValid) {
    throw Object.assign(
      new Error(`Điểm DUPR của ${ath.fullName} (${ath.rating}) không nằm trong giới hạn cho phép (${division.MinDUPR ?? 0} - ${division.MaxDUPR ?? 8.0})`),
      { statusCode: 400 }
    );
  }
}

/**
 * Register singles tournament division
 */
export async function registerSingles(
  tournamentId: number,
  divisionId: number,
  userId: number,
  data: { athletes: any[] }
) {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
  }

  // BR-T04: Chỉ cho đăng ký khi Division status là Open
  if (division.Status !== DIVISION_STATUS.OPEN) {
    throw Object.assign(new Error("Nội dung thi đấu chưa mở đăng ký hoặc đã đóng"), { statusCode: 400 });
  }

  // BR-T05: Hạn đăng ký
  if (new Date() > new Date(tournament.RegistrationEnd)) {
    throw Object.assign(new Error("Đã quá hạn đăng ký giải đấu này"), { statusCode: 400 });
  }

  // BR-T06: Max teams
  const currentTeams = await tournamentRepo.countActiveRegistrationsInDivision(divisionId);
  if (currentTeams >= division.MaxTeams) {
    throw Object.assign(new Error("Nội dung thi đấu này đã đủ số lượng đội tối đa"), { statusCode: 400 });
  }

  // Validate player duplicate registration
  const activeTeam = await tournamentRepo.findUserActiveTeamInDivision(divisionId, userId);
  if (activeTeam) {
    throw Object.assign(new Error(`Bạn đã tham gia một đội thi đấu khác ở nội dung này rồi.`), { statusCode: 409 });
  }

  // Validate athlete input
  const athlete = data.athletes?.[0];
  if (!athlete) {
    throw Object.assign(new Error("Thiếu thông tin vận động viên đăng ký"), { statusCode: 400 });
  }
  validateManualAthlete(athlete, division);

  // Execute transaction to create Team + TeamMember + Registration + Athletes Snapshot
  const registration = await tournamentRepo.registerManualAthletesTransaction({
    tournamentId,
    divisionId,
    userId,
    teamName: athlete.fullName,
    fee: division.RegistrationFee,
    athletes: data.athletes,
  });

  // Create notification
  void createNotification({
    userId,
    title: "Đăng ký giải đấu thành công",
    message: `Bạn đã đăng ký thành công nội dung ${division.DivisionName} của giải ${tournament.TournamentName}.`,
    notificationType: "System",
  });

  return { registration };
}

/**
 * Register doubles division
 */
export async function registerDoubles(
  tournamentId: number,
  divisionId: number,
  userId: number,
  body: {
    partnerOption: "ExistingPartner" | "SuggestOnly" | "AutoMatch" | "ManualForm";
    teamName?: string;
    partnerEmailOrPhone?: string;
    athletes?: any[];
  }
) {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
  }

  if (division.Status !== DIVISION_STATUS.OPEN) {
    throw Object.assign(new Error("Nội dung thi đấu chưa mở đăng ký hoặc đã đóng"), { statusCode: 400 });
  }

  if (new Date() > new Date(tournament.RegistrationEnd)) {
    throw Object.assign(new Error("Đã quá hạn đăng ký giải đấu này"), { statusCode: 400 });
  }

  const currentTeams = await tournamentRepo.countActiveRegistrationsInDivision(divisionId);
  if (currentTeams >= division.MaxTeams) {
    throw Object.assign(new Error("Nội dung thi đấu này đã đủ số lượng đội tối đa"), { statusCode: 400 });
  }

  const creator = await validatePlayerForDivision(userId, division);

  if (body.partnerOption === "ManualForm") {
    if (!body.athletes || body.athletes.length !== 2) {
      throw Object.assign(new Error("Vui lòng cung cấp đầy đủ thông tin của 2 vận động viên"), { statusCode: 400 });
    }

    // Validate both athletes eligibility
    for (const ath of body.athletes) {
      validateManualAthlete(ath, division);
    }

    // Validate gender requirements for MixedDoubles
    if (division.CompetitionFormat === "MixedDoubles") {
      const genders = body.athletes.map(a => a.gender);
      if (!genders.includes("Male") || !genders.includes("Female")) {
        throw Object.assign(new Error("Nội dung Đôi Nam Nữ yêu cầu đúng một vận động viên Nam và một vận động viên Nữ"), { statusCode: 400 });
      }
    }

    // Execute direct manual registration transaction
    const registration = await tournamentRepo.registerManualAthletesTransaction({
      tournamentId,
      divisionId,
      userId,
      teamName: body.teamName || `Team_${userId}`,
      fee: division.RegistrationFee,
      athletes: body.athletes,
    });

    return { registration };
  }

  // Check if player already has an active partner request
  const existingRequest = await tournamentRepo.findPartnerRequestByRequester(divisionId, userId);
  if (existingRequest) {
    if (existingRequest.RequestStatus === "WaitingBothConfirm") {
      return {
        message: "Bạn đang trong hàng chờ xác nhận ghép cặp của hệ thống.",
        request: existingRequest,
      };
    }
    if (body.partnerOption === "SuggestOnly" && existingRequest.MatchingMode === "SuggestOnly") {
      const suggestions = await findSuggestedPartners(divisionId, userId);
      return {
        message: "Yêu cầu tìm kiếm đồng đội của bạn đã được ghi nhận trước đó.",
        request: existingRequest,
        suggestedPartners: suggestions,
      };
    }
    if (body.partnerOption === "AutoMatch" && existingRequest.MatchingMode === "AutoMatch") {
      return {
        message: "Bạn đang trong hàng chờ tự động ghép cặp của hệ thống.",
        request: existingRequest,
      };
    }
  }

  if (body.partnerOption === "ExistingPartner") {
    if (!body.partnerEmailOrPhone) {
      throw Object.assign(new Error("Email hoặc số điện thoại của đồng đội là bắt buộc"), { statusCode: 400 });
    }

    const partner = await tournamentRepo.findUserByEmailOrPhone(body.partnerEmailOrPhone);
    if (!partner) {
      throw Object.assign(new Error("Không tìm thấy đồng đội trong hệ thống hoặc tài khoản không hoạt động"), { statusCode: 404 });
    }

    if (partner.UserID === userId) {
      throw Object.assign(new Error("Không thể tự đăng ký ghép đôi với chính mình"), { statusCode: 400 });
    }

    const partnerProfile = await validatePlayerForDivision(partner.UserID, division);

    if (division.CompetitionFormat === "MixedDoubles") {
      const creatorGender = creator.Gender;
      const partnerGender = partnerProfile.Gender;
      if (creatorGender === partnerGender) {
        throw Object.assign(new Error("Nội dung Đôi Nam Nữ yêu cầu một vận động viên Nam và một vận động viên Nữ"), { statusCode: 400 });
      }
    }

    const invitation = await tournamentRepo.registerDoublesExistingPartnerTransaction({
      tournamentId,
      divisionId,
      userId,
      partnerId: partner.UserID,
    });

    void createNotification({
      userId: partner.UserID,
      title: "Lời mời tham gia giải đấu",
      message: `${creator.FullName} đã gửi lời mời tham gia cùng đội trong giải đấu ${tournament.TournamentName} (${division.DivisionName}).`,
      notificationType: "System",
    });

    return {
      message: "Gửi lời mời ghép cặp thành công. Đợi đồng đội đồng ý để hoàn tất đăng ký đội.",
      invitation,
    };
  }

  if (body.partnerOption === "SuggestOnly") {
    const request = await tournamentRepo.createPartnerRequest({
      tournamentId,
      divisionId,
      requesterId: userId,
      matchingMode: "SuggestOnly",
      preferredDUPRMin: division.MinDUPR,
      preferredDUPRMax: division.MaxDUPR,
      preferredGender: division.GenderRequirement === "Mixed" ? (creator.Gender === "Male" ? "Female" : "Male") : (division.GenderRequirement === "MaleOnly" ? "Male" : "Female"),
      requestStatus: "LookingForPartner",
    });

    const suggestions = await findSuggestedPartners(divisionId, userId);
    return {
      message: "Đã tạo yêu cầu gợi ý đồng đội. Dưới đây là danh sách những người chơi phù hợp.",
      request,
      suggestedPartners: suggestions,
    };
  }

  if (body.partnerOption === "AutoMatch") {
    return autoMatchPartner(tournamentId, divisionId, userId);
  }

  throw Object.assign(new Error("Lựa chọn ghép cặp không hợp lệ"), { statusCode: 400 });
}
/**
 * Respond to partner invitation (Accept or Decline)
 */
export async function respondInvitation(invitationId: number, userId: number, action: "Accepted" | "Declined") {
  const invitation = await tournamentRepo.findInvitationById(invitationId);
  if (!invitation) {
    throw Object.assign(new Error("Không tìm thấy lời mời thi đấu"), { statusCode: 404 });
  }

  if (invitation.ReceiverID !== userId) {
    throw Object.assign(new Error("Bạn không có quyền thực hiện hành động này"), { statusCode: 403 });
  }

  if (invitation.InvitationStatus !== "Pending") {
    throw Object.assign(new Error(`Lời mời này đã được xử lý hoặc đã hết hạn (Trạng thái: ${invitation.InvitationStatus})`), { statusCode: 400 });
  }

  // Check expiration (BR-T24: 48 hours)
  if (new Date() > new Date(invitation.ExpiredAt)) {
    // Optionally update status to Expired
    const pool = await getPool();
    await pool.request()
      .input("InvitationID", sql.Int, invitationId)
      .query("UPDATE TournamentTeamInvitations SET InvitationStatus = 'Expired' WHERE InvitationID = @InvitationID");
    throw Object.assign(new Error("Lời mời ghép cặp đã quá hạn 48 giờ"), { statusCode: 400 });
  }

  const division = await tournamentRepo.findDivisionById(invitation.DivisionID);
  if (!division) {
    throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
  }

  const tournament = await tournamentRepo.findTournamentById(invitation.TournamentID);

  if (action === "Accepted") {
    // Check if player already registered/joined elsewhere in this division
    const activeTeam = await tournamentRepo.findUserActiveTeamInDivision(invitation.DivisionID, userId);
    if (activeTeam && activeTeam.TeamID !== invitation.TeamID) {
      throw Object.assign(new Error("Bạn đã tham gia vào một đội khác trong nội dung này"), { statusCode: 409 });
    }

    // Check if maxTeams exceeded
    const currentTeams = await tournamentRepo.countActiveRegistrationsInDivision(invitation.DivisionID);
    if (currentTeams >= division.MaxTeams) {
      throw Object.assign(new Error("Nội dung thi đấu này đã đủ số lượng đội tối đa, không thể đồng ý lời mời"), { statusCode: 400 });
    }
  }

  const result = await tournamentRepo.respondInvitationTransaction({
    invitationId,
    teamId: invitation.TeamID,
    divisionId: invitation.DivisionID,
    tournamentId: invitation.TournamentID,
    userId,
    partnerId: invitation.SenderID,
    action,
  });

  // Notify sender
  const responder = await tournamentRepo.findUserPlayerProfile(userId);
  const actionText = action === "Accepted" ? "đồng ý" : "từ chối";
  
  void createNotification({
    userId: invitation.SenderID,
    title: `Đồng đội đã ${actionText} lời mời`,
    message: `${responder?.FullName || "Đồng đội"} đã ${actionText} lời mời ghép đội tham gia giải đấu ${tournament?.TournamentName || ""}.`,
    notificationType: "System",
  });

  return {
    status: action,
    registration: result.registration,
  };
}

/**
 * Fetch suggested partners based on division rules
 */
export async function findSuggestedPartners(divisionId: number, userId: number) {
  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
  }

  const player = await tournamentRepo.findUserPlayerProfile(userId);
  if (!player || !player.DUPR) {
    throw Object.assign(new Error("Vui lòng cập nhật profile vận động viên (DUPR)"), { statusCode: 400 });
  }

  // Calculate age group boundaries for SQL query
  let minBirthDate: Date | null = null;
  let maxBirthDate: Date | null = null;
  const today = new Date();

  if (division.AgeGroup === "Youth") {
    maxBirthDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  } else if (division.AgeGroup === "Senior50") {
    minBirthDate = new Date(today.getFullYear() - 50, today.getMonth(), today.getDate());
  } else if (division.AgeGroup === "Senior60") {
    minBirthDate = new Date(today.getFullYear() - 60, today.getMonth(), today.getDate());
  }

  if (division.MinAge !== null && division.MinAge !== undefined) {
    const minDate = new Date(today.getFullYear() - division.MinAge, today.getMonth(), today.getDate());
    if (!minBirthDate || minDate < minBirthDate) {
      minBirthDate = minDate;
    }
  }
  if (division.MaxAge !== null && division.MaxAge !== undefined) {
    const maxDate = new Date(today.getFullYear() - division.MaxAge, today.getMonth(), today.getDate());
    if (!maxBirthDate || maxDate > maxBirthDate) {
      maxBirthDate = maxDate;
    }
  }

  const list = await tournamentRepo.findSuggestedPartnersQuery({
    requesterId: userId,
    divisionId,
    genderReq: division.GenderRequirement,
    requesterGender: player.Gender || "Male",
    minDUPR: division.MinDUPR,
    maxDUPR: division.MaxDUPR,
    minBirthDate,
    maxBirthDate,
    requesterDUPR: Number(player.DUPR),
  });

  // Limit to 10
  return list.slice(0, 10);
}

/**
 * Core Algorithm: Auto Matching partner matching calculations
 */
export async function autoMatchPartner(tournamentId: number, divisionId: number, userId: number) {
  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
  }

  const requester = await tournamentRepo.findUserPlayerProfile(userId);
  if (!requester || !requester.DUPR) {
    throw Object.assign(new Error("Vui lòng cập nhật profile vận động viên (DUPR)"), { statusCode: 400 });
  }

  // 1. Check if requester has a pending request
  const existing = await tournamentRepo.findPartnerRequestByRequester(divisionId, userId);
  if (existing) {
    if (existing.RequestStatus === "WaitingBothConfirm") {
      return {
        status: "WaitingBothConfirm",
        message: "Bạn đã có đối tác ghép cặp tự động. Đợi cả hai đồng ý.",
      };
    }
    return {
      status: "LookingForPartner",
      request: existing,
      message: "Bạn đang trong hàng chờ ghép cặp tự động của nội dung này.",
    };
  }

  // 2. Query other players who are looking for partner in this division
  const lookingRequests = await tournamentRepo.findActivePartnerRequests(divisionId);

  // Filter candidates locally for precise checks
  const candidates = lookingRequests.filter(c => {
    // Exclude self
    if (c.RequesterID === userId) return false;

    // Check Gender requirements (BR-T09/T10/T11)
    if (division.GenderRequirement === "MaleOnly" && c.Gender !== "Male") return false;
    if (division.GenderRequirement === "FemaleOnly" && c.Gender !== "Female") return false;
    if (division.GenderRequirement === "Mixed" && c.Gender === requester.Gender) return false;

    // Check Age requirements (BR-T13/T14)
    if (division.AgeGroup !== "Open") {
      if (!c.DateOfBirth) return false;
      const age = calculateAge(c.DateOfBirth);
      if (division.AgeGroup === "Youth" && age >= 18) return false;
      if (division.AgeGroup === "Senior50" && age < 50) return false;
      if (division.AgeGroup === "Senior60" && age < 60) return false;
      if (division.MinAge !== null && division.MinAge !== undefined && age < division.MinAge) return false;
      if (division.MaxAge !== null && division.MaxAge !== undefined && age > division.MaxAge) return false;
    }

    // Check DUPR boundaries (BR-T12)
    const duprVal = Number(c.DUPR);
    if (division.MinDUPR !== null && division.MinDUPR !== undefined && duprVal < division.MinDUPR) return false;
    if (division.MaxDUPR !== null && division.MaxDUPR !== undefined && duprVal > division.MaxDUPR) return false;

    return true;
  });

  if (candidates.length > 0) {
    // Sort by absolute DUPR difference to requester (BR-T22: Prefer closest DUPR)
    candidates.sort((x, y) => {
      const diffX = Math.abs(Number(x.DUPR) - Number(requester.DUPR));
      const diffY = Math.abs(Number(y.DUPR) - Number(requester.DUPR));
      return diffX - diffY;
    });

    const bestMatch = candidates[0];

    // Create request for requester in 'WaitingBothConfirm' status
    const reqA = await tournamentRepo.createPartnerRequest({
      tournamentId,
      divisionId,
      requesterId: userId,
      matchingMode: "AutoMatch",
      preferredDUPRMin: division.MinDUPR,
      preferredDUPRMax: division.MaxDUPR,
      preferredGender: division.GenderRequirement === "Mixed" ? (requester.Gender === "Male" ? "Female" : "Male") : (division.GenderRequirement === "MaleOnly" ? "Male" : "Female"),
      requestStatus: "WaitingBothConfirm",
    });

    // Run transaction: create Team (status: PendingMemberConfirm), add A & B (Pending), create 2 invitations
    const matchResult = await tournamentRepo.createAutoMatchTeamTransaction({
      tournamentId,
      divisionId,
      userAId: userId,
      userBId: bestMatch.RequesterID,
      requestAId: reqA.RequestID,
      requestBId: bestMatch.RequestID,
    });

    // Notify both users (BR-T22: both confirm)
    void createNotification({
      userId: userId,
      title: "Hệ thống đã tự động ghép cặp!",
      message: `Đã ghép cặp tự động thành công với ${bestMatch.FullName}. Vui lòng xác nhận lời mời ghép cặp.`,
      notificationType: "System",
    });

    void createNotification({
      userId: bestMatch.RequesterID,
      title: "Hệ thống đã tự động ghép cặp!",
      message: `Đã ghép cặp tự động thành công với ${requester.FullName}. Vui lòng xác nhận lời mời ghép cặp.`,
      notificationType: "System",
    });

    return {
      status: "Matched",
      message: `Ghép cặp tự động thành công với ${bestMatch.FullName}! Đợi cả hai đồng ý lời mời.`,
      teamId: matchResult.teamId,
      partner: bestMatch,
    };
  }

  // No candidates found -> Enter looking list
  const request = await tournamentRepo.createPartnerRequest({
    tournamentId,
    divisionId,
    requesterId: userId,
    matchingMode: "AutoMatch",
    preferredDUPRMin: division.MinDUPR,
    preferredDUPRMax: division.MaxDUPR,
    preferredGender: division.GenderRequirement === "Mixed" ? (requester.Gender === "Male" ? "Female" : "Male") : (division.GenderRequirement === "MaleOnly" ? "Male" : "Female"),
    requestStatus: "LookingForPartner",
  });

  return {
    status: "LookingForPartner",
    message: "Hệ thống chưa tìm thấy đồng đội phù hợp ngay lập tức. Đã đưa bạn vào hàng chờ ghép cặp tự động.",
    request,
  };
}

/**
 * Create tournament registration payment
 */
export async function createTournamentPayment(
  registrationId: number,
  paymentMethod: "VNPay" | "Momo" | "PayOS" | "BankTransfer" | "Mock",
  userId: number
) {
  const records = await tournamentRepo.findRegistrationForPayment(registrationId);
  if (records.length === 0) {
    throw Object.assign(new Error("Không tìm thấy thông tin đăng ký"), { statusCode: 404 });
  }

  // Verification checks:
  const first = records[0];

  // 1. Verify user ownership (must be a team member)
  const isMember = records.some(r => r.UserID === userId && r.JoinStatus === "Accepted");
  if (!isMember) {
    throw Object.assign(new Error("Bạn không có quyền thanh toán cho đăng ký này"), { statusCode: 403 });
  }

  // 2. BR-T23: Verify all members have accepted
  const pendingMembers = records.filter(r => r.JoinStatus !== "Accepted");
  if (pendingMembers.length > 0) {
    throw Object.assign(
      new Error("Không thể thanh toán: Đợi tất cả thành viên trong đội đồng ý lời mời ghép cặp"),
      { statusCode: 400 }
    );
  }

  // 3. Status checks
  if (first.RegistrationStatus === "Paid" || first.RegistrationStatus === "Confirmed") {
    throw Object.assign(new Error("Đơn đăng ký này đã được thanh toán trước đó"), { statusCode: 400 });
  }

  if (first.TournamentStatus === "Cancelled") {
    throw Object.assign(new Error("Giải đấu đã bị hủy bỏ"), { statusCode: 400 });
  }

  // Date Check
  if (new Date() > new Date(first.RegistrationEnd)) {
    throw Object.assign(new Error("Thời gian đăng ký giải đấu đã kết thúc"), { statusCode: 400 });
  }

  const fee = Number(first.RegistrationFee);

  // If fee is 0: Confirm immediately
  if (fee === 0) {
    const payment = await tournamentRepo.createTournamentPayment({
      registrationId,
      amount: 0,
      paymentMethod,
      paymentStatus: "Paid",
    });

    const result = await tournamentRepo.confirmPaymentTransaction({
      paymentId: payment.TournamentPaymentID,
      transactionCode: `FREE-${registrationId}-${Date.now().toString().slice(-4)}`,
      gatewayResponse: "Free registration",
    });

    // Notify all members of team
    for (const r of records) {
      void createNotification({
        userId: r.UserID,
        title: "Đăng ký giải đấu hoàn tất!",
        message: `Đội của bạn đã được xác nhận đăng ký nội dung ${first.DivisionName} của giải ${first.TournamentName}.`,
        notificationType: "System",
      });
    }

    return {
      status: "Paid",
      payment: result.payment,
      registration: result.registration,
    };
  }

  // For positive fee:
  if (paymentMethod === "Mock") {
    throw Object.assign(new Error("Phương thức thanh toán thử nghiệm (Mock) đã bị vô hiệu hóa. Vui lòng thanh toán thật qua VietQR / PayOS."), { statusCode: 400 });
  }

  // Gateway payment: create Pending
  const payment = await tournamentRepo.createTournamentPayment({
    registrationId,
    amount: fee,
    paymentMethod,
    paymentStatus: "Pending",
  });

  const paymentCode = `PAY-TOURNAMENT-${payment.TournamentPaymentID}-${Date.now().toString().slice(-4)}`;

  let checkoutUrl = "";
  if (paymentMethod === "PayOS") {
    const payosResult = await createPayosTournamentPaymentLink({
      paymentId: payment.TournamentPaymentID,
      amount: fee,
      paymentCode,
      registrationId,
    });

    if (!payosResult.success || !payosResult.checkoutUrl) {
      throw Object.assign(
        new Error(`Không thể tạo liên kết thanh toán PayOS: ${payosResult.errorMessage ?? "Lỗi không xác định"}`),
        { statusCode: 502 }
      );
    }
    checkoutUrl = payosResult.checkoutUrl;

    const pool = await getPool();
    await pool.request()
      .input("PaymentID", sql.Int, payment.TournamentPaymentID)
      .input("Code", sql.NVarChar(255), paymentCode)
      .input("GatewayResponse", sql.NVarChar(sql.MAX), payosResult.rawResponse)
      .query("UPDATE TournamentPayments SET TransactionCode = @Code, GatewayResponse = @GatewayResponse WHERE TournamentPaymentID = @PaymentID");
  } else {
    // Fallback or other methods
    checkoutUrl = `/checkout/tournament?paymentId=${payment.TournamentPaymentID}&code=${paymentCode}&amount=${fee}`;
    const pool = await getPool();
    await pool.request()
      .input("PaymentID", sql.Int, payment.TournamentPaymentID)
      .input("Code", sql.NVarChar(255), paymentCode)
      .query("UPDATE TournamentPayments SET TransactionCode = @Code WHERE TournamentPaymentID = @PaymentID");
  }

  return {
    status: "Pending",
    paymentId: payment.TournamentPaymentID,
    checkoutUrl,
    amount: fee,
  };
}

/**
 * Handle payment gateway callback/webhook
 */
export async function handleTournamentPaymentWebhook(params: {
  paymentId: number;
  transactionCode: string;
  gatewayResponse: string;
  success: boolean;
}) {
  const payment = await tournamentRepo.findPaymentById(params.paymentId);
  if (!payment) {
    throw Object.assign(new Error("Không tìm thấy thông tin giao dịch thanh toán"), { statusCode: 404 });
  }

  if (payment.PaymentStatus === "Paid") {
    return { status: "Paid", message: "Giao dịch đã được xử lý trước đó." };
  }

  if (params.success) {
    const pool = await getPool();
    const regResult = await pool.request()
      .input("RegistrationID", sql.Int, payment.RegistrationID)
      .query(`
        SELECT RegistrationStatus, PaymentStatus, 
               CASE WHEN PaymentExpiredAt IS NOT NULL AND PaymentExpiredAt < GETDATE() THEN 1 ELSE 0 END AS IsExpired 
        FROM TournamentRegistrations 
        WHERE RegistrationID = @RegistrationID
      `);
    
    const registration = regResult.recordset[0];
    if (!registration) {
      throw Object.assign(new Error("Không tìm thấy đơn đăng ký giải đấu liên kết"), { statusCode: 404 });
    }

    const isExpired = registration.IsExpired === 1;
    
    if (registration.RegistrationStatus === "Cancelled" || registration.RegistrationStatus === "Rejected" || isExpired) {
      // Nếu đã bị hủy hoặc hết hạn thanh toán, ghi nhận tiền (Paid) nhưng không confirm đăng ký
      await pool.request()
        .input("PaymentID", sql.Int, params.paymentId)
        .input("TransactionCode", sql.NVarChar(255), params.transactionCode)
        .input("GatewayResponse", sql.NVarChar(sql.MAX), params.gatewayResponse)
        .query(`
          UPDATE TournamentPayments 
          SET PaymentStatus = 'Paid', TransactionCode = @TransactionCode, GatewayResponse = @GatewayResponse, PaidAt = GETDATE() 
          WHERE TournamentPaymentID = @PaymentID
        `);

      if (!["Cancelled", "Rejected"].includes(registration.RegistrationStatus)) {
        await pool.request()
          .input("RegistrationID", sql.Int, payment.RegistrationID)
          .query(`
            UPDATE TournamentRegistrations
            SET RegistrationStatus = 'Cancelled', PaymentStatus = 'Failed'
            WHERE RegistrationID = @RegistrationID;

            UPDATE TournamentTeams
            SET TeamStatus = 'Withdrawn'
            WHERE TeamID = (SELECT TeamID FROM TournamentRegistrations WHERE RegistrationID = @RegistrationID);
          `);
      }

      return { 
        status: "LatePayment", 
        message: "Thanh toán trễ (Quá thời hạn 10 phút). Đơn đăng ký đã bị hủy. Cần đối soát hoàn tiền." 
      };
    }

    const result = await tournamentRepo.confirmPaymentTransaction({
      paymentId: params.paymentId,
      transactionCode: params.transactionCode,
      gatewayResponse: params.gatewayResponse,
    });

    // Notify members
    const records = await tournamentRepo.findRegistrationForPayment(payment.RegistrationID);
    if (records.length > 0) {
      const first = records[0];
      for (const r of records) {
        void createNotification({
          userId: r.UserID,
          title: "Xác nhận đăng ký giải đấu",
          message: `Thanh toán lệ phí hoàn tất! Đội của bạn đã được xác nhận đăng ký nội dung ${first.DivisionName} của giải ${first.TournamentName}.`,
          notificationType: "System",
        });
      }
    }

    return { status: "Paid", registration: result.registration };
  } else {
    const pool = await getPool();
    await pool.request()
      .input("PaymentID", sql.Int, params.paymentId)
      .query("UPDATE TournamentPayments SET PaymentStatus = 'Failed' WHERE TournamentPaymentID = @PaymentID");
      
    return { status: "Failed", message: "Giao dịch thanh toán thất bại" };
  }
}

// ─── BRACKETS & SCHEDULE GENERATION ──────────────────────────

/**
 * Generate Single Elimination bracket for a division (Admin only)
 */
export async function generateBracket(tournamentId: number, divisionId: number, userId: number, randomize: boolean = false) {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
  }

  if (division.BracketType !== "SingleElimination") {
    throw Object.assign(new Error("Nội dung thi đấu này không áp dụng thể thức loại trực tiếp (SingleElimination)"), { statusCode: 400 });
  }

  const existingMatches = await tournamentRepo.getDivisionMatches(divisionId);
  const hasStarted = existingMatches.some(m => ["Ready", "InProgress", "Completed"].includes(m.MatchStatus));
  if (hasStarted) {
    throw Object.assign(new Error("Không thể tạo lại nhánh đấu sau khi giải đấu đã bắt đầu hoặc có trận đấu kết thúc"), { statusCode: 400 });
  }

  // 1. Get confirmed teams
  const confirmedTeams = await tournamentRepo.findConfirmedTeamsInDivision(divisionId);
  if (confirmedTeams.length < 2) {
    throw Object.assign(new Error(`Số lượng đội tham gia phải từ 2 trở lên (Hiện tại: ${confirmedTeams.length})`), { statusCode: 400 });
  }

  // 2. Compute power of two padding (e.g. 5 teams -> P = 8)
  const P = getNextPowerOfTwo(confirmedTeams.length);
  const R = Math.log2(P); // Total rounds

  // Shuffle teams for random seeding or use as sorted seeds
  const shuffledTeams = randomize ? shuffleTeams(confirmedTeams) : [...confirmedTeams];

  // 3. Create matches in memory
  // Match index 1 is Final (parent of index 2 & 3). Leaves are indices P/2 to P - 1.
  const matchesMap: Record<number, any> = {};

  for (let i = 1; i < P; i++) {
    const parentIndex = i > 1 ? Math.floor(i / 2) : null;
    const nextMatchSlot = i > 1 ? (i % 2 === 0 ? "TeamA" : "TeamB") : null;
    const roundNo = R - Math.floor(Math.log2(i));
    
    const diff = R - roundNo;
    let knockoutRound = `Vòng ${roundNo}`;
    if (diff === 0) knockoutRound = "Chung kết";
    else if (diff === 1) knockoutRound = "Bán kết";
    else if (diff === 2) knockoutRound = "Tứ kết";
    else if (diff === 3) knockoutRound = "Vòng 1/8";
    else if (diff === 4) knockoutRound = "Vòng 1/16";

    // Calculate sequence number of match in this round
    const startOfRound = Math.pow(2, Math.floor(Math.log2(i)));
    const matchNo = i - startOfRound + 1;

    matchesMap[i] = {
      memIndex: i,
      parentIndex,
      NextMatchSlot: nextMatchSlot,
      TournamentID: tournamentId,
      DivisionID: divisionId,
      RoundNo: roundNo,
      MatchNo: matchNo,
      GroupName: "Knockout",
      KnockoutRound: knockoutRound,
      TeamAID: null,
      TeamBID: null,
      WinnerTeamID: null,
      MatchStatus: "Scheduled",
      ScoreText: null,
    };
  }

  // Third Place match logic
  if (P >= 4 && (division.EnableThirdPlace !== false && (division as any).EnableThirdPlace !== 0)) {
    matchesMap[P] = {
      memIndex: P,
      parentIndex: null,
      NextMatchSlot: null,
      TournamentID: tournamentId,
      DivisionID: divisionId,
      RoundNo: R,
      MatchNo: 2,
      GroupName: "Knockout",
      KnockoutRound: "Tranh hạng 3",
      TeamAID: null,
      TeamBID: null,
      WinnerTeamID: null,
      MatchStatus: "Scheduled",
      ScoreText: null,
    };
  }

  // 4. Distribute teams to Leaf slots (indices P/2 to P - 1)
  const leavesCount = P / 2;
  const byesCount = P - shuffledTeams.length;
  let teamIndex = 0;

  for (let k = 0; k < leavesCount; k++) {
    const leafIndex = leavesCount + k;
    if (k < byesCount) {
      if (teamIndex < shuffledTeams.length) {
        matchesMap[leafIndex].TeamAID = shuffledTeams[teamIndex++].TeamID;
      }
      matchesMap[leafIndex].TeamBID = null;
    } else {
      if (teamIndex < shuffledTeams.length) {
        matchesMap[leafIndex].TeamAID = shuffledTeams[teamIndex++].TeamID;
      }
      if (teamIndex < shuffledTeams.length) {
        matchesMap[leafIndex].TeamBID = shuffledTeams[teamIndex++].TeamID;
      }
    }
  }

  // 5. Pre-resolve BYE matches (from leaves up to Final)
  // Leaf index goes from P-1 down to P/2. If one slot has a team and the other is empty (BYE):
  // Set WinnerTeamID, MatchStatus = Completed, ScoreText = BYE, and copy to parent
  for (let i = P - 1; i >= P / 2; i--) {
    const m = matchesMap[i];
    if (m.TeamAID && !m.TeamBID) {
      m.WinnerTeamID = m.TeamAID;
      m.MatchStatus = MATCH_STATUS.BYE_COMPLETED;
      m.ScoreText = "BYE";

      // Copy winner to parent match in memory
      if (m.parentIndex) {
        const parent = matchesMap[m.parentIndex];
        if (m.NextMatchSlot === "TeamA") {
          parent.TeamAID = m.WinnerTeamID;
        } else {
          parent.TeamBID = m.WinnerTeamID;
        }
      }
    } else if (!m.TeamAID && m.TeamBID) {
      m.WinnerTeamID = m.TeamBID;
      m.MatchStatus = MATCH_STATUS.BYE_COMPLETED;
      m.ScoreText = "BYE";

      if (m.parentIndex) {
        const parent = matchesMap[m.parentIndex];
        if (m.NextMatchSlot === "TeamA") {
          parent.TeamAID = m.WinnerTeamID;
        } else {
          parent.TeamBID = m.WinnerTeamID;
        }
      }
    } else if (!m.TeamAID && !m.TeamBID) {
      // In case no teams in both slots, marked as cancelled
      m.MatchStatus = "Cancelled";
      m.ScoreText = "No participants";
    }
  }

  // Prepare flat list ordered 1, 2, 3... (Parents first, so they get inserted first and have db ids ready for children NextMatchID)
  const matchesList: any[] = [];
  for (let i = 1; i < P; i++) {
    if (matchesMap[i]) matchesList.push(matchesMap[i]);
  }
  if (matchesMap[P]) {
    matchesList.push(matchesMap[P]);
  }

  // 6. Save matches into database via transaction
  await tournamentRepo.saveBracketMatchesTransaction(divisionId, matchesList, "SingleElimination");
  // Update division status
  await tournamentRepo.updateDivisionStatus(divisionId, DIVISION_STATUS.DRAW_GENERATED);
  await applyDefaultRoundScheduleConfig(tournamentId, divisionId, userId);

  // Recompute tournament status
  await recomputeTournamentStatus(tournamentId);
  // Write audit log
  await createAuditLog({
    userId,
    actionName: "GENERATE_BRACKET",
    tableName: "TournamentDivisions",
    entityId: divisionId,
    description: `Admin khởi tạo nhánh thi đấu loại trực tiếp (Size: ${P}, Đội: ${confirmedTeams.length}) cho division ID: ${divisionId}`,
  });

  return getDivisionMatches(divisionId);
}

/**
 * Generate Round Robin schedule for a division (Admin only)
 */
export async function generateRoundRobinMatches(tournamentId: number, divisionId: number, userId: number, randomize: boolean = false) {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
  }

  if (tournament.Status === TOURNAMENT_STATUS.OPEN) {
    throw Object.assign(new Error("Không thể sinh lịch thi đấu khi giải đấu đang ở trạng thái mở đăng ký (Open). Hãy đóng đăng ký trước."), { statusCode: 400 });
  }

  if (division.Status !== DIVISION_STATUS.REGISTRATION_CLOSED && division.Status !== DIVISION_STATUS.DRAW_GENERATED) {
    throw Object.assign(new Error(`Không thể sinh lịch thi đấu khi nội dung ở trạng thái ${division.Status}. Cần ở trạng thái RegistrationClosed`), { statusCode: 400 });
  }

  if (division.BracketType !== "RoundRobin") {
    throw Object.assign(new Error("Nội dung thi đấu này không áp dụng thể thức đấu vòng tròn (RoundRobin)"), { statusCode: 400 });
  }

  const existingMatches = await tournamentRepo.getDivisionMatches(divisionId);
  const hasStarted = existingMatches.some(m => ["Ready", "InProgress", "Completed"].includes(m.MatchStatus));
  if (hasStarted) {
    throw Object.assign(new Error("Không thể sinh lại lịch thi đấu sau khi giải đấu đã có trận đấu sẵn sàng, đang diễn ra hoặc đã kết thúc"), { statusCode: 400 });
  }

  const confirmedTeams = await tournamentRepo.findConfirmedTeamsInDivision(divisionId);
  if (confirmedTeams.length < 2) {
    throw Object.assign(new Error(`Số lượng đội tham gia phải từ 2 trở lên (Hiện tại: ${confirmedTeams.length})`), { statusCode: 400 });
  }

  const matchesList: any[] = [];
  let matchNo = 1;

  const numTeams = confirmedTeams.length;
  const isOdd = numTeams % 2 !== 0;
  const roundTeams = randomize ? shuffleTeams(confirmedTeams) : [...confirmedTeams];
  if (isOdd) {
    roundTeams.push(null);
  }

  const totalRounds = roundTeams.length - 1;
  const halfSize = roundTeams.length / 2;

  for (let round = 0; round < totalRounds; round++) {
    for (let i = 0; i < halfSize; i++) {
      const teamA = roundTeams[i];
      const teamB = roundTeams[roundTeams.length - 1 - i];
      
      if (teamA !== null && teamB !== null) {
        matchesList.push({
          memIndex: matchNo, // dummy memory index
          TournamentID: tournamentId,
          DivisionID: divisionId,
          RoundNo: round + 1,
          MatchNo: matchNo,
          GroupName: "Vòng Bảng",
          TeamAID: teamA.TeamID,
          TeamBID: teamB.TeamID,
          WinnerTeamID: null,
          MatchStatus: "Scheduled",
          ScoreText: null,
          NextMatchSlot: null,
        });
        matchNo++;
      }
    }
    
    // Rotate the array for the next round (keep the first team fixed)
    const lastTeam = roundTeams.pop();
    roundTeams.splice(1, 0, lastTeam);
  }

  await tournamentRepo.saveBracketMatchesTransaction(divisionId, matchesList, "RoundRobin");

  await tournamentRepo.updateDivisionStatus(divisionId, DIVISION_STATUS.DRAW_GENERATED);
  await applyDefaultRoundScheduleConfig(tournamentId, divisionId, userId);
  await recomputeTournamentStatus(tournamentId);

  // Write audit log
  await createAuditLog({
    userId,
    actionName: "GENERATE_SCHEDULE",
    tableName: "TournamentDivisions",
    entityId: divisionId,
    description: `Admin tạo lịch đấu vòng tròn (${matchesList.length} trận, Đội: ${confirmedTeams.length}) cho division ID: ${divisionId}`,
  });

  return getDivisionMatches(divisionId);
}

/**
 * Generate Group Stage Matches (Round Robin inside multiple groups)
 * Balanced using Snake Draft by average team athlete DUPR rating.
 */
export async function generateGroupKnockoutMatches(
  tournamentId: number,
  divisionId: number,
  groupCount: number,
  userId: number,
  randomize: boolean = false
): Promise<any[]> {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) {
    throw Object.assign(new Error("Tournament not found"), { statusCode: 404 });
  }

  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Division not found"), { statusCode: 404 });
  }

  if (tournament.Status === TOURNAMENT_STATUS.OPEN) {
    throw Object.assign(new Error("Không thể sinh lịch thi đấu khi giải đấu đang ở trạng thái mở đăng ký (Open). Hãy đóng đăng ký trước."), { statusCode: 400 });
  }

  if (division.Status !== DIVISION_STATUS.REGISTRATION_CLOSED && division.Status !== DIVISION_STATUS.DRAW_GENERATED) {
    throw Object.assign(new Error(`Không thể sinh lịch thi đấu khi nội dung ở trạng thái ${division.Status}. Cần ở trạng thái RegistrationClosed`), { statusCode: 400 });
  }

  if (division.BracketType !== "GroupKnockout") {
    throw Object.assign(new Error("Nội dung thi đấu này không áp dụng thể thức Vòng bảng + Loại trực tiếp (GroupKnockout)"), { statusCode: 400 });
  }

  if (!groupCount || groupCount < 2) {
    throw Object.assign(new Error("Số lượng bảng đấu phải từ 2 trở lên"), { statusCode: 400 });
  }

  const existingMatches = await tournamentRepo.getDivisionMatches(divisionId);
  const hasStarted = existingMatches.some(m => ["Ready", "InProgress", "Completed"].includes(m.MatchStatus));
  if (hasStarted) {
    throw Object.assign(new Error("Không thể tạo lại lịch đấu sau khi giải đấu đã bắt đầu hoặc có trận đấu kết thúc"), { statusCode: 400 });
  }

  // 1. Get confirmed teams with their average ratings
  const pool = await getPool();
  const teamsRes = await pool.request()
    .input("DivisionID", sql.Int, divisionId)
    .query(`
      SELECT 
        t.TeamID,
        t.TeamName,
        AVG(ISNULL(a.Rating, 0.0)) AS AvgRating
      FROM TournamentTeams t
      INNER JOIN TournamentRegistrations r ON t.TeamID = r.TeamID
      LEFT JOIN TournamentRegistrationAthletes a ON r.RegistrationID = a.RegistrationID
      WHERE r.DivisionID = @DivisionID AND r.RegistrationStatus = 'Confirmed'
      GROUP BY t.TeamID, t.TeamName
      ORDER BY AVG(ISNULL(a.Rating, 0.0)) DESC, t.TeamID ASC
    `);

  const confirmedTeams = randomize ? shuffleTeams(teamsRes.recordset) : teamsRes.recordset;
  if (confirmedTeams.length < groupCount) {
    throw Object.assign(new Error(`Số lượng đội tham gia (${confirmedTeams.length}) phải lớn hơn hoặc bằng số lượng bảng đấu (${groupCount})`), { statusCode: 400 });
  }

  // 2. Snake Draft Seeding distribution
  const groups: any[][] = Array.from({ length: groupCount }, () => []);
  for (let i = 0; i < confirmedTeams.length; i++) {
    const round = Math.floor(i / groupCount);
    const isForward = round % 2 === 0;
    const groupIdx = isForward ? (i % groupCount) : (groupCount - 1 - (i % groupCount));
    groups[groupIdx].push(confirmedTeams[i]);
  }

  // Helper to construct group name (A, B, C...)
  const getGroupName = (index: number): string => {
    if (index < 26) {
      return `Bảng ${String.fromCharCode(65 + index)}`;
    }
    return `Bảng ${index + 1}`;
  };

  // 3. Generate matches list
  const matchesList: any[] = [];
  let matchNo = 1;

  for (let g = 0; g < groupCount; g++) {
    const groupTeams = groups[g];
    const groupName = getGroupName(g);

    const numTeams = groupTeams.length;
    const isOdd = numTeams % 2 !== 0;
    const roundTeams = [...groupTeams];
    if (isOdd) {
      roundTeams.push(null);
    }

    const totalRounds = roundTeams.length - 1;
    const halfSize = roundTeams.length / 2;

    for (let round = 0; round < totalRounds; round++) {
      for (let i = 0; i < halfSize; i++) {
        const teamA = roundTeams[i];
        const teamB = roundTeams[roundTeams.length - 1 - i];
        
        if (teamA !== null && teamB !== null) {
          matchesList.push({
            memIndex: matchNo,
            parentIndex: null,
            NextMatchSlot: null,
            TournamentID: tournamentId,
            DivisionID: divisionId,
            RoundNo: round + 1,
            MatchNo: matchNo,
            GroupName: groupName,
            TeamAID: teamA.TeamID,
            TeamBID: teamB.TeamID,
            WinnerTeamID: null,
            MatchStatus: "Scheduled",
            ScoreText: null,
          });
          matchNo++;
        }
      }
      
      const lastTeam = roundTeams.pop();
      roundTeams.splice(1, 0, lastTeam);
    }
  }

  // Save matches and init standings
  await tournamentRepo.saveBracketMatchesTransaction(divisionId, matchesList, "GroupKnockout");

  // Update division status & recompute tournament status
  await tournamentRepo.updateDivisionStatus(divisionId, DIVISION_STATUS.DRAW_GENERATED);
  await applyDefaultRoundScheduleConfig(tournamentId, divisionId, userId);
  await recomputeTournamentStatus(tournamentId);

  // Write audit log
  await createAuditLog({
    userId,
    actionName: "GENERATE_SCHEDULE",
    tableName: "TournamentDivisions",
    entityId: divisionId,
    description: `Admin tạo lịch vòng bảng (${matchesList.length} trận, ${groupCount} bảng, Đội: ${confirmedTeams.length}) cho division ID: ${divisionId}`,
  });

  return getDivisionMatches(divisionId);
}

/**
 * Generate Single Elimination Knockout stage matches from finished Group stage.
 * Takes Top 1 and Top 2 of each group, pairs them cross-over, and generates a bracket.
 */
export async function generateGroupKnockoutBracket(
  tournamentId: number,
  divisionId: number,
  userId: number,
  randomize: boolean = false
): Promise<any[]> {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) {
    throw Object.assign(new Error("Tournament not found"), { statusCode: 404 });
  }

  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Division not found"), { statusCode: 404 });
  }

  if (division.Status !== DIVISION_STATUS.GROUP_COMPLETED) {
    throw Object.assign(new Error(`Chỉ có thể tạo nhánh loại trực tiếp khi vòng bảng đã hoàn tất (GroupCompleted). Trạng thái hiện tại: ${division.Status}`), { statusCode: 400 });
  }

  if (division.BracketType !== "GroupKnockout") {
    throw Object.assign(new Error("Nội dung thi đấu này không phải thể thức Vòng bảng + Loại trực tiếp"), { statusCode: 400 });
  }

  const matches = await tournamentRepo.getDivisionMatches(divisionId);
  if (matches.length === 0) {
    throw Object.assign(new Error("Chưa có lịch đấu vòng bảng nào được tạo"), { statusCode: 400 });
  }

  // Verify all round robin matches are completed
  const groupMatches = matches.filter(m => m.GroupName && m.GroupName.startsWith("Bảng"));
  const hasIncomplete = groupMatches.some(m => m.MatchStatus !== "Completed");
  if (hasIncomplete) {
    throw Object.assign(new Error("Tất cả các trận đấu vòng bảng phải hoàn thành trước khi tạo nhánh loại trực tiếp"), { statusCode: 400 });
  }

  // Check if knockout matches already exist
  const knockoutExists = matches.some(m => m.GroupName === "Knockout" || !m.GroupName);
  if (knockoutExists) {
    throw Object.assign(new Error("Nhánh đấu loại trực tiếp đã được tạo trước đó"), { statusCode: 400 });
  }

  // 1. Get standings to determine qualified teams (Nhất / Nhì mỗi bảng)
  const pool = await getPool();
  const standingsRes = await pool.request()
    .input("DivisionID", sql.Int, divisionId)
    .query(`
      SELECT s.*, t.TeamName
      FROM TournamentStandings s
      INNER JOIN TournamentTeams t ON s.TeamID = t.TeamID
      WHERE s.DivisionID = @DivisionID
      ORDER BY s.GroupName ASC, s.RankNo ASC
    `);

  const standings = standingsRes.recordset;
  if (standings.length === 0) {
    throw Object.assign(new Error("Không tìm thấy bảng xếp hạng vòng bảng"), { statusCode: 400 });
  }

  // Group standings by GroupName
  const standingsByGroup: Record<string, any[]> = {};
  for (const row of standings) {
    const gn = row.GroupName || "Không xác định";
    if (!standingsByGroup[gn]) {
      standingsByGroup[gn] = [];
    }
    standingsByGroup[gn].push(row);
  }

  // For each group, pick Nhất (1st) and Nhì (2nd)
  const sortedGroupNames = Object.keys(standingsByGroup).sort();
  const qualifiedTeams: { groupName: string; rank: 1 | 2; TeamID: number; TeamName: string }[] = [];

  for (const gn of sortedGroupNames) {
    const list = standingsByGroup[gn];
    if (list.length > 0) {
      qualifiedTeams.push({ groupName: gn, rank: 1, TeamID: list[0].TeamID, TeamName: list[0].TeamName });
    }
    if (list.length > 1) {
      qualifiedTeams.push({ groupName: gn, rank: 2, TeamID: list[1].TeamID, TeamName: list[1].TeamName });
    }
  }

  if (qualifiedTeams.length < 2) {
    throw Object.assign(new Error("Không đủ số đội vượt qua vòng bảng để tạo nhánh đấu"), { statusCode: 400 });
  }

  // 2. Build cross-over pairings with optional derangement random seeding
  const pairedTeams: any[] = [];
  if (randomize) {
    const rank1s = sortedGroupNames.map(gn => qualifiedTeams.find(t => t.groupName === gn && t.rank === 1)).filter(Boolean) as any[];
    const rank2s = sortedGroupNames.map(gn => qualifiedTeams.find(t => t.groupName === gn && t.rank === 2)).filter(Boolean) as any[];

    let shuffledRank2s = [...rank2s];
    let attempts = 0;
    let valid = false;

    while (!valid && attempts < 1000) {
      shuffledRank2s = shuffleTeams(rank2s);
      valid = true;
      for (let i = 0; i < rank1s.length; i++) {
        if (i < shuffledRank2s.length && rank1s[i].groupName === shuffledRank2s[i].groupName) {
          valid = false;
          break;
        }
      }
      attempts++;
    }

    for (let i = 0; i < rank1s.length; i++) {
      pairedTeams.push(rank1s[i]);
      if (i < shuffledRank2s.length) {
        pairedTeams.push(shuffledRank2s[i]);
      }
    }
  } else {
    const M = sortedGroupNames.length;
    for (let i = 0; i < M; i++) {
      const firstGroup = sortedGroupNames[i];
      const secondGroup = sortedGroupNames[(i + 1) % M];

      const team1st = qualifiedTeams.find(t => t.groupName === firstGroup && t.rank === 1);
      const team2nd = qualifiedTeams.find(t => t.groupName === secondGroup && t.rank === 2);

      if (team1st) pairedTeams.push(team1st);
      if (team2nd) pairedTeams.push(team2nd);
    }
  }

  // 3. Compute power of 2 bracket size for qualified teams
  const numTeams = pairedTeams.length;
  const P = getNextPowerOfTwo(numTeams);
  const R = Math.log2(P);

  const matchesMap: Record<number, any> = {};

  // Build the tree (Final = 1, Semi-final = 2, 3...)
  for (let i = 1; i < P; i++) {
    const parentIndex = i > 1 ? Math.floor(i / 2) : null;
    const nextMatchSlot = i > 1 ? (i % 2 === 0 ? "TeamA" : "TeamB") : null;
    const roundNo = R - Math.floor(Math.log2(i));
    
    const startOfRound = Math.pow(2, Math.floor(Math.log2(i)));
    const matchNo = i - startOfRound + 1;

    let knockoutRound = `Vòng ${roundNo}`;
    if (roundNo === R) knockoutRound = "Chung kết";
    else if (roundNo === R - 1) knockoutRound = "Bán kết";
    else if (roundNo === R - 2) knockoutRound = "Tứ kết";
    else if (roundNo === R - 3) knockoutRound = "Vòng 1/16";

    matchesMap[i] = {
      memIndex: i,
      parentIndex,
      NextMatchSlot: nextMatchSlot,
      TournamentID: tournamentId,
      DivisionID: divisionId,
      RoundNo: roundNo,
      MatchNo: matchNo,
      GroupName: "Knockout",
      KnockoutRound: knockoutRound,
      TeamAID: null,
      TeamBID: null,
      WinnerTeamID: null,
      MatchStatus: "Scheduled",
      ScoreText: null,
    };
  }
  
  // Third Place match logic
  if (P >= 4 && (division.EnableThirdPlace !== false && division.EnableThirdPlace !== 0)) {
    matchesMap[P] = {
      memIndex: P,
      parentIndex: null, // Custom resolution required on semifinals completion
      NextMatchSlot: null,
      TournamentID: tournamentId,
      DivisionID: divisionId,
      RoundNo: R, // Same round number as Final
      MatchNo: 2, // Final is match 1, Third place is match 2
      GroupName: "Knockout",
      KnockoutRound: "Tranh hạng 3",
      TeamAID: null,
      TeamBID: null,
      WinnerTeamID: null,
      MatchStatus: "Scheduled",
      ScoreText: null,
    };
  }

  // Distribute qualified teams to leaf nodes
  const leavesCount = P / 2;
  const byesCount = P - pairedTeams.length;
  let teamIdx = 0;

  for (let k = 0; k < leavesCount; k++) {
    const leafIndex = leavesCount + k;
    if (k < byesCount) {
      if (teamIdx < pairedTeams.length) {
        matchesMap[leafIndex].TeamAID = pairedTeams[teamIdx++].TeamID;
      }
      matchesMap[leafIndex].TeamBID = null;
    } else {
      if (teamIdx < pairedTeams.length) {
        matchesMap[leafIndex].TeamAID = pairedTeams[teamIdx++].TeamID;
      }
      if (teamIdx < pairedTeams.length) {
        matchesMap[leafIndex].TeamBID = pairedTeams[teamIdx++].TeamID;
      }
    }
  }

  // Pre-resolve BYE matches for the knockout leaves
  for (let i = P - 1; i >= P / 2; i--) {
    const m = matchesMap[i];
    if (m.TeamAID && !m.TeamBID) {
      m.WinnerTeamID = m.TeamAID;
      m.MatchStatus = MATCH_STATUS.BYE_COMPLETED;
      m.ScoreText = "BYE";

      if (m.parentIndex) {
        const parent = matchesMap[m.parentIndex];
        if (m.NextMatchSlot === "TeamA") {
          parent.TeamAID = m.WinnerTeamID;
        } else {
          parent.TeamBID = m.WinnerTeamID;
        }
      }
    } else if (!m.TeamAID && m.TeamBID) {
      m.WinnerTeamID = m.TeamBID;
      m.MatchStatus = MATCH_STATUS.BYE_COMPLETED;
      m.ScoreText = "BYE";

      if (m.parentIndex) {
        const parent = matchesMap[m.parentIndex];
        if (m.NextMatchSlot === "TeamA") {
          parent.TeamAID = m.WinnerTeamID;
        } else {
          parent.TeamBID = m.WinnerTeamID;
        }
      }
    } else if (!m.TeamAID && !m.TeamBID) {
      m.MatchStatus = "Cancelled";
      m.ScoreText = "No participants";
    }
  }

  // Prepare insertion list sequentially (parents first)
  const matchesList: any[] = [];
  for (let i = 1; i < P; i++) {
    if (matchesMap[i]) matchesList.push(matchesMap[i]);
  }
  if (matchesMap[P]) {
    matchesList.push(matchesMap[P]);
  }

  // Save the new knockout matches without deleting the group stage matches!
  await tournamentRepo.saveKnockoutMatchesTransaction(divisionId, matchesList);

  await tournamentRepo.updateDivisionStatus(divisionId, DIVISION_STATUS.KNOCKOUT_STAGE);
  await applyDefaultRoundScheduleConfig(tournamentId, divisionId, userId);
  await recomputeTournamentStatus(tournamentId);

  // Write audit log
  await createAuditLog({
    userId,
    actionName: "GENERATE_SCHEDULE",
    tableName: "TournamentDivisions",
    entityId: divisionId,
    description: `Admin tạo nhánh đấu loại trực tiếp SE từ vòng bảng (Số đội: ${numTeams}) cho division ID: ${divisionId}`,
  });

  return getDivisionMatches(divisionId);
}

/**
 * Fetch matches for a division
 */
export async function getDivisionMatches(divisionId: number) {
  return tournamentRepo.getDivisionMatches(divisionId);
}

/**
 * Fetch standings for a division
 */
export async function getDivisionStandings(divisionId: number) {
  return tournamentRepo.getDivisionStandings(divisionId);
}

/**
 * Automatically assign courts and slots for a division's matches (Admin only)
 */
export async function allocateDivisionSchedule(
  tournamentId: number,
  divisionId: number,
  body: {
    courtIds: number[];
    startDateTime: string;
    endDateTime?: string;
    matchDurationMinutes: number;
    breakMinutes: number;
    minRestMinutes?: number;
    dailyStartHour?: string;
    dailyEndHour?: string;
    roundNo?: number;
  },
  userId: number
) {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  if (new Date(body.startDateTime).getTime() < Date.now() - 15 * 60 * 1000) {
    throw Object.assign(new Error("Thời gian bắt đầu xếp lịch không thể ở quá khứ"), { statusCode: 400 });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Thực hiện khóa dòng dữ liệu của nội dung thi đấu bằng NOWAIT lock
    const lockRes = await new sql.Request(transaction)
      .input("DivisionID", sql.Int, divisionId)
      .query(`SELECT DivisionID, Status FROM TournamentDivisions WITH (UPDLOCK, NOWAIT) WHERE DivisionID = @DivisionID`);
    
    const division = lockRes.recordset[0];
    if (!division) {
      throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
    }
    const originalStatus = division.Status;

    const allowedStatuses = [
      DIVISION_STATUS.DRAW_GENERATED,
      DIVISION_STATUS.SCHEDULED,
      DIVISION_STATUS.ONGOING,
      DIVISION_STATUS.GROUP_COMPLETED,
      DIVISION_STATUS.KNOCKOUT_STAGE
    ];
    if (!allowedStatuses.includes(division.Status as any)) {
      throw Object.assign(new Error(`Chỉ có thể xếp sân & giờ khi nội dung ở các trạng thái bốc thăm hoặc đang thi đấu (Trạng thái hiện tại: ${division.Status})`), { statusCode: 400 });
    }

    const matches = await tournamentRepo.getDivisionMatches(divisionId);
    if (matches.length === 0) {
      throw Object.assign(new Error("Nội dung thi đấu này chưa khởi tạo sơ đồ nhánh / lịch thi đấu"), { statusCode: 400 });
    }

    const activeCourtsRes = await new sql.Request(transaction)
      .query(`SELECT CourtID FROM Courts WHERE CourtID IN (${body.courtIds.join(",")}) AND Status != 'Inactive'`);
    const activeCourtIds = activeCourtsRes.recordset.map((c: any) => c.CourtID);

    if (activeCourtIds.length === 0) {
      throw Object.assign(new Error("Không tìm thấy sân đấu nào đang hoạt động để xếp lịch"), { statusCode: 400 });
    }

    const schedules: any[] = [];
    const courtBusyIntervals: Record<number, Array<{ start: Date; end: Date }>> = {};

    // Dựng lịch bận của sân dựa trên Bookings
    const bookingsRes = await new sql.Request(transaction)
      .query(`
        SELECT d.CourtID, 
               CONVERT(VARCHAR(10), d.BookingDate, 120) AS BookingDateStr,
               CONVERT(VARCHAR(8), d.StartTime, 108) AS StartTimeStr, 
               CONVERT(VARCHAR(8), d.EndTime, 108) AS EndTimeStr 
        FROM BookingDetails d
        INNER JOIN Bookings b ON d.BookingID = b.BookingID
        WHERE b.Status IN ('PendingPayment', 'Paid', 'Confirmed', 'CheckedIn')
          AND d.CourtID IN (${activeCourtIds.join(",")})
      `);
    for (const b of bookingsRes.recordset) {
      if (!courtBusyIntervals[b.CourtID]) courtBusyIntervals[b.CourtID] = [];
      const startStr = `${b.BookingDateStr}T${b.StartTimeStr}`;
      const endStr = `${b.BookingDateStr}T${b.EndTimeStr}`;
      courtBusyIntervals[b.CourtID].push({ start: new Date(startStr), end: new Date(endStr) });
    }

    // Dựng lịch bận của sân từ các giải đấu / nội dung khác
    const blocksRes = await new sql.Request(transaction)
      .query(`
        SELECT CourtID, 
               CONVERT(VARCHAR(19), DATEADD(hour, 7, StartDateTime), 120) AS StartTimeStr, 
               CONVERT(VARCHAR(19), DATEADD(hour, 7, EndDateTime), 120) AS EndTimeStr 
        FROM TournamentCourtBlocks
        WHERE Status = 'Active' 
          AND CourtID IN (${activeCourtIds.join(",")})
          AND DivisionID != ${divisionId}
      `);
    for (const bl of blocksRes.recordset) {
      if (!courtBusyIntervals[bl.CourtID]) courtBusyIntervals[bl.CourtID] = [];
      const startStr = bl.StartTimeStr.replace(" ", "T");
      const endStr = bl.EndTimeStr.replace(" ", "T");
      courtBusyIntervals[bl.CourtID].push({ start: new Date(startStr), end: new Date(endStr) });
    }

    // TẢI THÀNH VIÊN ĐỘI ĐỂ THEO DÕI BẬN THEO PLAYER ID
    const allTeamMembersRes = await new sql.Request(transaction)
      .query(`
        SELECT TeamID, UserID 
        FROM TournamentTeamMembers 
        WHERE JoinStatus = 'Accepted' AND UserID IS NOT NULL
      `);
    const allTeamToPlayersMap: Record<number, number[]> = {};
    for (const tm of allTeamMembersRes.recordset) {
      if (!allTeamToPlayersMap[tm.TeamID]) allTeamToPlayersMap[tm.TeamID] = [];
      allTeamToPlayersMap[tm.TeamID].push(tm.UserID);
    }

    const allAthletesRes = await new sql.Request(transaction)
      .query(`
        SELECT TeamID, UserID 
        FROM TournamentRegistrationAthletes 
        WHERE UserID IS NOT NULL
      `);
    for (const ath of allAthletesRes.recordset) {
      if (!allTeamToPlayersMap[ath.TeamID]) allTeamToPlayersMap[ath.TeamID] = [];
      if (!allTeamToPlayersMap[ath.TeamID].includes(ath.UserID)) {
        allTeamToPlayersMap[ath.TeamID].push(ath.UserID);
      }
    }

    // TẢI LỊCH BẬN CỦA TỪNG VĐV CÁ NHÂN TỪ CÁC TRẬN ĐẤU ĐÃ XẾP LỊCH
    const playerBusyIntervals: Record<number, Array<{ start: Date; end: Date }>> = {};
    const otherMatchesRes = await new sql.Request(transaction)
      .query(`
        SELECT m.TeamAID, m.TeamBID, 
               CONVERT(VARCHAR(19), DATEADD(hour, 7, m.ScheduledStart), 120) AS StartTimeStr, 
               CONVERT(VARCHAR(19), DATEADD(hour, 7, m.ScheduledEnd), 120) AS EndTimeStr 
        FROM TournamentMatches m
        WHERE m.ScheduledStart IS NOT NULL 
          AND m.ScheduledEnd IS NOT NULL
          AND m.MatchStatus NOT IN ('Completed', 'Cancelled')
      `);
    
    for (const m of otherMatchesRes.recordset) {
      const start = new Date(m.StartTimeStr.replace(" ", "T"));
      const end = new Date(m.EndTimeStr.replace(" ", "T"));
      const teamIds = [m.TeamAID, m.TeamBID].filter(Boolean) as number[];
      for (const teamId of teamIds) {
        const playerIds = allTeamToPlayersMap[teamId] || [];
        for (const pId of playerIds) {
          if (!playerBusyIntervals[pId]) playerBusyIntervals[pId] = [];
          playerBusyIntervals[pId].push({ start, end });
        }
      }
    }

    let activeMatches = matches.filter(
      (m) =>
        (m.MatchStatus === "Scheduled" || m.MatchStatus === "NotStarted") &&
        m.TeamAID &&
        m.TeamBID
    );

    if (body.roundNo !== undefined && body.roundNo > 0) {
      activeMatches = activeMatches.filter(m => m.RoundNo === body.roundNo);
    }

    activeMatches.sort((a, b) => {
      if (a.RoundNo !== b.RoundNo) {
        return (a.RoundNo || 0) - (b.RoundNo || 0);
      }
      return (a.MatchNo || 0) - (b.MatchNo || 0);
    });

    const startDateTimeVal = new Date(body.startDateTime);
    if (isNaN(startDateTimeVal.getTime())) {
      throw Object.assign(new Error("Thời gian bắt đầu không hợp lệ"), { statusCode: 400 });
    }

    // Thời gian giới hạn tối đa là ngày kết thúc giải đấu
    const tournamentEndVal = new Date(tournament.TournamentEnd);
    tournamentEndVal.setHours(23, 59, 59, 999);

    let maxMatchesPerDay = 999;
    if (body.endDateTime) {
      const endDateTimeVal = new Date(body.endDateTime);
      if (!isNaN(endDateTimeVal.getTime()) && endDateTimeVal > startDateTimeVal) {
        const msPerDay = 1000 * 60 * 60 * 24;
        const startDay = new Date(startDateTimeVal.getFullYear(), startDateTimeVal.getMonth(), startDateTimeVal.getDate());
        const endDay = new Date(endDateTimeVal.getFullYear(), endDateTimeVal.getMonth(), endDateTimeVal.getDate());
        const numDays = Math.round((endDay.getTime() - startDay.getTime()) / msPerDay) + 1;
        
        const matchesCount: Record<number, number> = {};
        for (const m of activeMatches) {
          if (m.TeamAID) matchesCount[m.TeamAID] = (matchesCount[m.TeamAID] || 0) + 1;
          if (m.TeamBID) matchesCount[m.TeamBID] = (matchesCount[m.TeamBID] || 0) + 1;
        }
        const maxMatchesInTournament = Math.max(0, ...Object.values(matchesCount));
        
        if (numDays > 0 && maxMatchesInTournament > 0) {
          maxMatchesPerDay = Math.ceil(maxMatchesInTournament / numDays);
        }
      }
    }

    const teamMatchesPerDay: Record<number, Record<string, number>> = {};
    const matchDuration = body.matchDurationMinutes || 60;
    const breakDuration = body.breakMinutes !== undefined ? body.breakMinutes : 10;
    const teamRestMinutes = body.minRestMinutes !== undefined ? body.minRestMinutes : 30;

    let dailyStartFloat = 7.0;
    let dailyEndFloat = 22.0;
    if (body.dailyStartHour) {
      const parts = body.dailyStartHour.split(":");
      if (parts.length >= 2) dailyStartFloat = parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60;
    }
    if (body.dailyEndHour) {
      const parts = body.dailyEndHour.split(":");
      if (parts.length >= 2) dailyEndFloat = parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60;
    }

    for (const match of activeMatches) {
      let scheduled = false;
      let currentTime = new Date(startDateTimeVal);

      while (!scheduled) {
        const currentHourFloat = currentTime.getHours() + currentTime.getMinutes() / 60;
        const endTime = new Date(currentTime.getTime() + matchDuration * 60 * 1000);
        const endHourFloat = endTime.getHours() + endTime.getMinutes() / 60;

        // KIỂM TRA GIỚI HẠN THỜI GIAN TOURNAMENT END
        if (endTime > tournamentEndVal) {
          throw Object.assign(
            new Error(`Không thể xếp lịch cho trận đấu MatchID: ${match.MatchID}. Thời gian thi đấu dự kiến (${endTime.toLocaleString("vi-VN")}) vượt quá thời gian kết thúc giải đấu (${tournamentEndVal.toLocaleString("vi-VN")}). Vui lòng bổ sung thêm sân đấu hoặc kéo dài thời hạn giải đấu.`), 
            { statusCode: 400 }
          );
        }

        if (endHourFloat > dailyEndFloat || currentHourFloat < dailyStartFloat) {
          if (endHourFloat > dailyEndFloat) {
            currentTime.setDate(currentTime.getDate() + 1);
          }
          currentTime.setHours(Math.floor(dailyStartFloat), Math.round((dailyStartFloat % 1) * 60), 0, 0);
          continue;
        }

        const currentDateString = currentTime.toISOString().split('T')[0];
        let limitReached = false;
        if (match.TeamAID) {
          const tAMatches = (teamMatchesPerDay[match.TeamAID] && teamMatchesPerDay[match.TeamAID][currentDateString]) || 0;
          if (tAMatches >= maxMatchesPerDay) limitReached = true;
        }
        if (match.TeamBID) {
          const tBMatches = (teamMatchesPerDay[match.TeamBID] && teamMatchesPerDay[match.TeamBID][currentDateString]) || 0;
          if (tBMatches >= maxMatchesPerDay) limitReached = true;
        }

        if (limitReached) {
          currentTime.setDate(currentTime.getDate() + 1);
          currentTime.setHours(Math.floor(dailyStartFloat), Math.round((dailyStartFloat % 1) * 60), 0, 0);
          continue;
        }

        for (const courtId of activeCourtIds) {
          let overlap = false;

          // 1. Kiểm tra bận sân
          const cIntervals = courtBusyIntervals[courtId] || [];
          for (const interval of cIntervals) {
            if (currentTime < interval.end && endTime > interval.start) {
              overlap = true;
              break;
            }
          }
          if (overlap) continue;

          // 2. Kiểm tra bận các cầu thủ Team A (theo PlayerID cá nhân chéo toàn giải)
          if (match.TeamAID) {
            const playerIds = allTeamToPlayersMap[match.TeamAID] || [];
            for (const pId of playerIds) {
              const pIntervals = playerBusyIntervals[pId] || [];
              for (const interval of pIntervals) {
                const matchEnd = new Date(interval.end.getTime() - breakDuration * 60 * 1000);
                const restEnd = new Date(matchEnd.getTime() + teamRestMinutes * 60 * 1000);
                if (currentTime < restEnd && endTime > interval.start) {
                  overlap = true;
                  break;
                }
              }
              if (overlap) break;
            }
          }
          if (overlap) continue;

          // 3. Kiểm tra bận các cầu thủ Team B (theo PlayerID cá nhân chéo toàn giải)
          if (match.TeamBID) {
            const playerIds = allTeamToPlayersMap[match.TeamBID] || [];
            for (const pId of playerIds) {
              const pIntervals = playerBusyIntervals[pId] || [];
              for (const interval of pIntervals) {
                const matchEnd = new Date(interval.end.getTime() - breakDuration * 60 * 1000);
                const restEnd = new Date(matchEnd.getTime() + teamRestMinutes * 60 * 1000);
                if (currentTime < restEnd && endTime > interval.start) {
                  overlap = true;
                  break;
                }
              }
              if (overlap) break;
            }
          }
          if (overlap) continue;

          // Tìm thấy slot! 
          const blockEnd = new Date(endTime.getTime() + breakDuration * 60 * 1000);
          
          if (!courtBusyIntervals[courtId]) courtBusyIntervals[courtId] = [];
          courtBusyIntervals[courtId].push({ start: currentTime, end: blockEnd });

          if (match.TeamAID) {
            const playerIds = allTeamToPlayersMap[match.TeamAID] || [];
            for (const pId of playerIds) {
              if (!playerBusyIntervals[pId]) playerBusyIntervals[pId] = [];
              playerBusyIntervals[pId].push({ start: currentTime, end: blockEnd });
            }
            if (!teamMatchesPerDay[match.TeamAID]) teamMatchesPerDay[match.TeamAID] = {};
            teamMatchesPerDay[match.TeamAID][currentDateString] = (teamMatchesPerDay[match.TeamAID][currentDateString] || 0) + 1;
          }

          if (match.TeamBID) {
            const playerIds = allTeamToPlayersMap[match.TeamBID] || [];
            for (const pId of playerIds) {
              if (!playerBusyIntervals[pId]) playerBusyIntervals[pId] = [];
              playerBusyIntervals[pId].push({ start: currentTime, end: blockEnd });
            }
            if (!teamMatchesPerDay[match.TeamBID]) teamMatchesPerDay[match.TeamBID] = {};
            teamMatchesPerDay[match.TeamBID][currentDateString] = (teamMatchesPerDay[match.TeamBID][currentDateString] || 0) + 1;
          }

          schedules.push({
            matchId: match.MatchID,
            courtId,
            scheduledStart: currentTime,
            scheduledEnd: endTime,
            tournamentId,
          });

          scheduled = true;
          break; 
        }

        if (!scheduled) {
          currentTime = new Date(currentTime.getTime() + 10 * 60 * 1000);
        }
      }
    }

    if (schedules.length > 0) {
      await new sql.Request(transaction)
        .input("DivisionID", sql.Int, divisionId)
        .query(`
          DELETE b FROM TournamentCourtBlocks b
          INNER JOIN TournamentMatches m ON b.MatchID = m.MatchID
          WHERE b.DivisionID = @DivisionID AND m.MatchStatus NOT IN ('Completed', 'InProgress')
        `);

      for (const sch of schedules) {
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

      await new sql.Request(transaction)
        .input("DivisionID", sql.Int, divisionId)
        .input("Status", sql.NVarChar(50), DIVISION_STATUS.SCHEDULED)
        .query(`UPDATE TournamentDivisions SET Status = @Status, UpdatedAt = GETDATE() WHERE DivisionID = @DivisionID`);

      await recomputeTournamentStatus(tournamentId);
    }

    await transaction.commit();

    await createAuditLog({
      userId,
      actionName: "ALLOCATE_COURTS",
      tableName: "TournamentDivisions",
      entityId: divisionId,
      description: `Admin tự động phân bổ lịch đấu/sân đấu cho ${schedules.length} trận đấu thuộc division ID: ${divisionId}`,
    });

    return getDivisionMatches(divisionId);
  } catch (error: any) {
    await transaction.rollback();
    if (error.number === 1222) {
      throw Object.assign(new Error("Tiến trình xếp lịch tự động cho nội dung này đang được thực hiện bởi Admin khác. Vui lòng thử lại sau"), { statusCode: 409 });
    }
    throw error;
  }
}

/**
 * Report sets and scores for a match, updating standings or advancing bracket
 */
export async function reportMatchScore(
  matchId: number,
  body: {
    sets: Array<{ setNo: number; teamAScore: number; teamBScore: number }>;
    adminOverride?: boolean;
    reason?: string;
  },
  user: { userId: number; role: string }
) {
  // 1. Fetch match details
  const match = await tournamentRepo.findMatchDetail(matchId);
  if (!match) {
    throw Object.assign(new Error("Không tìm thấy trận đấu"), { statusCode: 404 });
  }

  if (match.MatchStatus === "Cancelled") {
    throw Object.assign(new Error("Không thể báo cáo tỷ số cho trận đấu đã hủy"), { statusCode: 400 });
  }

  // Admin/Staff nhập điểm chính thức
  if (user.role !== "Admin" && user.role !== "Staff") {
    throw Object.assign(new Error("Chỉ Admin hoặc Staff mới có quyền nhập điểm chính thức cho trận đấu"), { statusCode: 403 });
  }

  const isCompleted = match.MatchStatus === MATCH_STATUS.COMPLETED;
  const isReadyOrInProgress = match.MatchStatus === MATCH_STATUS.READY || match.MatchStatus === MATCH_STATUS.IN_PROGRESS;

  if (isCompleted || !isReadyOrInProgress) {
    if (!body.adminOverride || user.role !== "Admin") {
      const errMsg = isCompleted 
        ? "Trận đấu đã hoàn thành. Chỉ Admin mới có quyền cập nhật lại kết quả bằng quyền ghi đè (adminOverride = true)."
        : `Trận đấu đang ở trạng thái ${match.MatchStatus}. Chỉ có thể nhập điểm khi trận đấu ở trạng thái Ready/InProgress hoặc khi Admin bật override (adminOverride = true).`;
      throw Object.assign(new Error(errMsg), { statusCode: 400 });
    }
  }

  // 1.5. Strict validations based on time
  if (process.env.ENABLE_STRICT_VALIDATIONS === "true") {
    // Chặn báo cáo điểm trước giờ thi đấu dự kiến
    if (match.ScheduledStart) {
      const scheduledStart = new Date(match.ScheduledStart);
      const now = new Date();
      if (now < scheduledStart) {
        if (!body.adminOverride || user.role !== "Admin") {
          throw Object.assign(
            new Error("Không thể báo cáo tỷ số trước thời gian bắt đầu dự kiến của trận đấu. Cần quyền Admin ghi đè (adminOverride = true) để tiếp tục."),
            { statusCode: 400 }
          );
        }
      }
    }

    // Khóa sửa kết quả sau 24 giờ
    if (isCompleted && match.UpdatedAt) {
      const lastUpdate = new Date(match.UpdatedAt);
      const hoursSinceLastUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastUpdate >= 24) {
        if (!body.adminOverride || user.role !== "Admin") {
          throw Object.assign(
            new Error("Trận đấu đã hoàn thành quá 24 giờ. Chỉ Admin mới có quyền cập nhật lại kết quả bằng quyền ghi đè (adminOverride = true)."),
            { statusCode: 400 }
          );
        }
        if (!body.reason || body.reason.trim() === "") {
          throw Object.assign(
            new Error("Yêu cầu nhập lý do cập nhật khi ghi đè kết quả trận đấu đã hoàn thành trên 24 giờ."),
            { statusCode: 400 }
          );
        }
      }
    }
  }

  if (!match.TeamAID || !match.TeamBID) {
    throw Object.assign(new Error("Trận đấu chưa đủ cặp đội đấu"), { statusCode: 400 });
  }

  // 3. Process set wins to determine the winner
  let teamASetsWon = 0;
  let teamBSetsWon = 0;

  for (const set of body.sets) {
    if (set.teamAScore === set.teamBScore) {
      throw Object.assign(new Error(`Tỷ số set ${set.setNo} không thể bằng nhau (phải phân định thắng thua set)`), { statusCode: 400 });
    }
    
    // Pickleball score validation (Standard 11, 15, 21 and win by 2)
    const maxScore = Math.max(set.teamAScore, set.teamBScore);
    const diff = Math.abs(set.teamAScore - set.teamBScore);
    
    if (maxScore < 11) {
      throw Object.assign(new Error(`Tỷ số set ${set.setNo} không hợp lệ: Điểm thắng tối thiểu phải là 11 theo luật Pickleball`), { statusCode: 400 });
    }
    
    // Win by 2 rule (unless it's a hard cap rule, but generally Pickleball requires win by 2)
    if (diff < 2) {
      throw Object.assign(new Error(`Tỷ số set ${set.setNo} không hợp lệ: Phải thắng cách biệt ít nhất 2 điểm (win-by-two)`), { statusCode: 400 });
    }
    if (set.teamAScore > set.teamBScore) {
      teamASetsWon++;
    } else {
      teamBSetsWon++;
    }
  }

  if (teamASetsWon === teamBSetsWon) {
    throw Object.assign(new Error("Kết quả tổng hợp trận đấu không thể hòa"), { statusCode: 400 });
  }

  const winnerTeamId = teamASetsWon > teamBSetsWon ? match.TeamAID : match.TeamBID;
  const scoreText = `${teamASetsWon}-${teamBSetsWon} (${body.sets.map(s => `${s.teamAScore}-${s.teamBScore}`).join(", ")})`;

  // 4. Save score transaction
  const updatedMatch = await tournamentRepo.saveMatchScoreTransaction({
    matchId,
    winnerTeamId,
    scoreText,
    sets: body.sets,
  });

  // 5. Recalculate standings ONLY if RoundRobin or Group stage of GroupKnockout (GroupName starts with "Bảng")
  if (match.BracketType === "RoundRobin" || (match.BracketType === "GroupKnockout" && match.GroupName && match.GroupName.startsWith("Bảng"))) {
    await tournamentRepo.updateRoundRobinStandingsTransaction(match.DivisionID);
  }

  // Recompute division & tournament status
  await recomputeDivisionStatus(match.DivisionID);
  await recomputeTournamentStatus(match.TournamentID);

  // Write audit log
  if (body.adminOverride) {
    const oldScoreJson = match.ScoreJson || null;
    const newScoreJson = JSON.stringify(body.sets);
    const reason = (body as any).actionReason || (body as any).reason || "Không có lý do cụ thể";
    const desc = `OVERRIDE_SCORE: user=${user.userId}, role=${user.role}, match=${matchId}, from=${match.MatchStatus} to=Completed. OldScore=${oldScoreJson}, NewScore=${newScoreJson}, Reason=${reason}`;
    
    await createAuditLog({
      userId: user.userId,
      actionName: "ADMIN_OVERRIDE_SCORE",
      tableName: "TournamentMatches",
      entityId: matchId,
      description: desc.slice(0, 490),
    });
  } else {
    await createAuditLog({
      userId: user.userId,
      actionName: "REPORT_MATCH_SCORE",
      tableName: "TournamentMatches",
      entityId: matchId,
      description: `Báo cáo tỷ số trận ID: ${matchId} (KQ: ${scoreText}) bởi user ID: ${user.userId}`,
    });
  }  // Notify team members
  void createNotification({
    userId: user.userId, // trigger notification to system if needed or we notify the leader of both teams
    title: "Kết quả trận đấu đã được cập nhật",
    message: `Trận đấu ${match.DivisionName} của giải ${match.TournamentName} đã hoàn tất với tỷ số ${scoreText}.`,
    notificationType: "System",
  });

  return updatedMatch;
}

/**
 * Lấy danh sách đăng ký của một nội dung giải đấu kèm thông tin vận động viên
 */
export async function getDivisionRegistrations(divisionId: number) {
  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
  }

  const rawRows = await tournamentRepo.getDivisionRegistrations(divisionId);
  
  // Nhóm các hàng theo RegistrationID vì mỗi hàng đại diện cho 1 vận động viên
  const registrationsMap: { [key: number]: any } = {};

  for (const row of rawRows) {
    if (!registrationsMap[row.RegistrationID]) {
      registrationsMap[row.RegistrationID] = {
        registrationId: row.RegistrationID,
        registrationStatus: row.RegistrationStatus,
        paymentStatus: row.PaymentStatus,
        registeredAt: row.RegisteredAt,
        confirmedAt: row.ConfirmedAt,
        cccdVerified: row.CccdVerified,
        isCheckedIn: row.IsCheckedIn,
        isCertificateSent: row.IsCertificateSent,
        certificateSentAt: row.CertificateSentAt,
        certificatePdfUrl: row.CertificatePdfUrl,
        teamName: row.TeamName,
        teamCode: row.TeamCode,
        refundStatus: row.RefundStatus,
        refundCode: row.RefundCode,
        athletes: []
      };
    }

    if (row.AthleteID) {
      registrationsMap[row.RegistrationID].athletes.push({
        athleteId: row.AthleteID,
        athleteNo: row.AthleteNo,
        fullName: row.FullName,
        phoneNumber: row.PhoneNumber,
        rating: row.Rating,
        province: row.Province,
        gender: row.Gender,
        dateOfBirth: row.DateOfBirth,
        photoUrl: row.PhotoURL,
        cccdUrl: row.CccdURL,
        email: row.Email,
        note: row.Note
      });
    }
  }

  return Object.values(registrationsMap);
}

/**
 * Thực hiện hành động Duyệt CCCD, Check-in hoặc Từ chối hồ sơ giải đấu
 */
export async function updateRegistrationAction(
  registrationId: number,
  body: { action: "verify" | "checkin" | "reject"; value?: any },
  userId: number
) {
  // Check if registration exists
  const pool = await getPool();
  const regResult = await pool.request()
    .input("RegistrationID", sql.Int, registrationId)
    .query("SELECT RegistrationStatus, PaymentStatus, RegisteredBy, TournamentID, DivisionID FROM TournamentRegistrations WHERE RegistrationID = @RegistrationID");
  
  const registration = regResult.recordset[0];
  if (!registration) {
    throw Object.assign(new Error("Không tìm thấy đơn đăng ký giải đấu"), { statusCode: 404 });
  }

  if (body.action === "reject") {
    if (["Cancelled", "Rejected"].includes(registration.RegistrationStatus)) {
      throw Object.assign(
        new Error("Đơn đăng ký đã ở trạng thái hủy hoặc từ chối trước đó."),
        { statusCode: 400 }
      );
    }

    // Check if there is a paid payment
    const paymentResult = await pool.request()
      .input("RegistrationID", sql.Int, registrationId)
      .query("SELECT TOP 1 * FROM TournamentPayments WHERE RegistrationID = @RegistrationID AND PaymentStatus = 'Paid'");
    const payment = paymentResult.recordset[0];

    const namesResult = await pool.request()
      .input("TournamentID", sql.Int, registration.TournamentID)
      .input("DivisionID", sql.Int, registration.DivisionID)
      .query(`
        SELECT t.TournamentName, d.DivisionName 
        FROM Tournaments t, TournamentDivisions d
        WHERE t.TournamentID = @TournamentID AND d.DivisionID = @DivisionID
      `);
    const names = namesResult.recordset[0] || {};

    let updated;
    if (payment) {
      // Create Refund record instead of immediate rejection
      const { createRefundRecord } = await import("../refunds/refunds.repository");
      
      // Generate RefundCode
      const now = new Date();
      const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const yy = String(vn.getUTCFullYear()).slice(-2);
      const mm = pad(vn.getUTCMonth() + 1);
      const dd = pad(vn.getUTCDate());
      const refundCode = `RF-T-${yy}${mm}${dd}-${registrationId}`;

      const reasonStr = typeof body.value === "string" ? body.value : "Từ chối hồ sơ giải đấu";

      await createRefundRecord({
        registrationId,
        tournamentPaymentId: payment.TournamentPaymentID,
        refundCode,
        refundAmount: Number(payment.Amount),
        refundMethod: "PayOSManual",
        reason: reasonStr,
        createdBy: userId,
      });

      updated = {
        RegistrationID: registrationId,
        RegistrationStatus: registration.RegistrationStatus,
        PaymentStatus: registration.PaymentStatus,
        RefundStatus: "Requested",
        RefundCode: refundCode,
      };

      // Notify user via in-app system notification
      void createNotification({
        userId: registration.RegisteredBy,
        title: "Yêu cầu từ chối & hoàn tiền giải đấu",
        message: `Đăng ký nội dung ${names.DivisionName || ""} của giải ${names.TournamentName || ""} đang được gửi yêu cầu từ chối & hoàn tiền.`,
        notificationType: "System",
      });

      // Fetch user email to send notification email
      try {
        const userRes = await pool.request()
          .input("UserID", sql.Int, registration.RegisteredBy)
          .query("SELECT Email, FullName FROM Users WHERE UserID = @UserID");
        const user = userRes.recordset[0];
        if (user && user.Email) {
          const { sendNotificationEmail } = await import("../../utils/mail");
          void sendNotificationEmail({
            to: user.Email,
            fullName: user.FullName || "Vận động viên",
            type: "Giải đấu",
            subject: `Hồ sơ đăng ký giải đấu bị yêu cầu từ chối - ${names.TournamentName || ""}`,
            title: "Yêu cầu từ chối & hoàn tiền đăng ký",
            message: `Hồ sơ đăng ký nội dung <strong>${names.DivisionName || ""}</strong> của giải đấu <strong>${names.TournamentName || ""}</strong> đã bị yêu cầu từ chối bởi Ban tổ chức do thông tin không chính xác.<br/><br/>Yêu cầu hoàn tiền lệ phí <strong>${Number(payment.Amount).toLocaleString("vi-VN")} ₫</strong> đã được tạo và gửi lên cấp Quản trị (Admin) phê duyệt.<br/><br/>Sau khi Admin thực hiện chuyển khoản hoàn tiền thành công, đơn đăng ký của bạn sẽ chính thức bị hủy bỏ và giải phóng suất thi đấu.`,
          });
        }
      } catch (mailErr: any) {
        console.error("[Mail] Failed to send rejection email:", mailErr.message);
      }

      // Write audit log
      await createAuditLog({
        userId,
        actionName: "REQUEST_TOURNAMENT_REFUND",
        tableName: "TournamentRegistrations",
        entityId: registrationId,
        description: `Yêu cầu từ chối & hoàn tiền đăng ký giải đấu ID: ${registrationId} bởi user ID: ${userId}`,
      });
    } else {
      // No successful payment found. Reject immediately.
      updated = await tournamentRepo.rejectRegistration(registrationId);

      // Notify user via in-app system notification
      void createNotification({
        userId: registration.RegisteredBy,
        title: "Hồ sơ đăng ký giải đấu bị từ chối",
        message: `Đăng ký nội dung ${names.DivisionName || ""} của giải ${names.TournamentName || ""} đã bị từ chối.`,
        notificationType: "System",
      });

      // Write audit log
      await createAuditLog({
        userId,
        actionName: "REJECT_TOURNAMENT_REGISTRATION",
        tableName: "TournamentRegistrations",
        entityId: registrationId,
        description: `Từ chối đăng ký giải đấu ID: ${registrationId} (Chưa thanh toán) bởi user ID: ${userId}`,
      });
    }

    return updated;
  }

  const isEligible = registration.RegistrationStatus === "Confirmed" && registration.PaymentStatus === "Paid";
  if (!isEligible) {
    throw Object.assign(
      new Error("Đơn đăng ký chưa được hoàn tất thanh toán và xác nhận. Không thể thực hiện thao tác duyệt hoặc check-in."),
      { statusCode: 400 }
    );
  }

  const field = body.action === "verify" ? "CccdVerified" : "IsCheckedIn";
  const updated = await tournamentRepo.updateRegistrationAction(registrationId, field, !!body.value);

  // Write audit log
  await createAuditLog({
    userId,
    actionName: body.action === "verify" ? "VERIFY_ATHLETE_CCCD" : "TOURNAMENT_CHECK_IN",
    tableName: "TournamentRegistrations",
    entityId: registrationId,
    description: `Thực hiện ${body.action === "verify" ? "Duyệt CCCD" : "Điểm danh (Check-in)"} cho đăng ký ID: ${registrationId} với giá trị: ${body.value} bởi user ID: ${userId}`,
  });

  return updated;
}

/**
 * Trigger background release of expired tournament registrations (10 minutes)
 * and trigger notifications + audit logs.
 */
export async function releaseExpiredTournamentRegistrations() {
  const expiredList = await tournamentRepo.repoReleaseExpiredRegistrations();

  for (const r of expiredList) {
    // Notify user
    void createNotification({
      userId: r.RegisteredBy,
      title: "Hủy đăng ký giải đấu",
      message: `Đăng ký nội dung ${r.DivisionName} của giải ${r.TournamentName} đã bị tự động hủy do quá hạn thanh toán 10 phút.`,
      notificationType: "System",
    });

    // Write audit log
    void createAuditLog({
      userId: null,
      actionName: "AUTO_CANCEL_TOURNAMENT_REGISTRATION_EXPIRED",
      tableName: "TournamentRegistrations",
      entityId: r.RegistrationID,
      description: `Tự động hủy đăng ký giải đấu do quá hạn thanh toán 10 phút. Đơn đăng ký ID: ${r.RegistrationID}, Nội dung: ${r.DivisionName}, Giải đấu: ${r.TournamentName}`,
    });
  }

  return {
    releasedCount: expiredList.length,
  };
}

/**
 * Lấy đăng ký của user hiện tại cho giải đấu để hiển thị/thanh toán lại
 */
export async function getMyRegistrationForTournament(tournamentId: number, userId: number): Promise<any[]> {
  const list = await tournamentRepo.repoGetMyRegistrationForTournament(tournamentId, userId);
  
  let needsReload = false;
  for (const reg of list) {
    if (reg.PaymentStatus === "Unpaid") {
      try {
        const latestPayment = await tournamentRepo.getLatestPendingPaymentByRegistration(reg.RegistrationID);
        if (latestPayment && latestPayment.PaymentStatus === "Pending") {
          const { getPayosPaymentInfo } = await import("../payments/gateways/payos.gateway");
          const payosInfo = await getPayosPaymentInfo(latestPayment.TournamentPaymentID) as any;
          if (payosInfo && payosInfo.status === "PAID") {
            console.info(`[Auto Sync] Tournament registration ${reg.RegistrationID} was PAID on PayOS! Updating db...`);
            await handleTournamentPaymentWebhook({
              paymentId: latestPayment.TournamentPaymentID,
              transactionCode: payosInfo.transactions?.[0]?.reference || String(latestPayment.TournamentPaymentID),
              gatewayResponse: JSON.stringify(payosInfo),
              success: true,
            });
            needsReload = true;
          }
        }
      } catch (err: any) {
        console.warn(`[Auto Sync] Failed to sync status for registration ${reg.RegistrationID}:`, err.message);
      }
    }
  }

  const finalList = needsReload 
    ? await tournamentRepo.repoGetMyRegistrationForTournament(tournamentId, userId)
    : list;

  for (const reg of finalList) {
    if (reg.PaymentExpiredAt) {
      // DB stores local time via GETDATE(), but mssql driver treats it as UTC.
      // We must subtract 7 hours to get the real UTC time.
      const realUtcTime = new Date(reg.PaymentExpiredAt).getTime() - 7 * 60 * 60 * 1000;
      reg.PaymentExpiredAt = new Date(realUtcTime).toISOString();
    }
  }
  return finalList;
}

/**
 * Cập nhật cột mốc thời gian (ScheduledStart) cho các vòng đấu của một nội dung
 */
export async function updateRoundMilestones(
  tournamentId: number,
  divisionId: number,
  milestones: Array<{ roundNo: number; roundName?: string; scheduledStart: string; courtId?: number }>,
  userId: number
): Promise<void> {
  const tournament = await tournamentRepo.findTournamentById(tournamentId);
  if (!tournament) {
    throw Object.assign(new Error("Không tìm thấy giải đấu"), { statusCode: 404 });
  }

  const division = await tournamentRepo.findDivisionById(divisionId);
  if (!division) {
    throw Object.assign(new Error("Không tìm thấy nội dung thi đấu"), { statusCode: 404 });
  }

  const pool = await getPool();
  
  for (const m of milestones) {
    const hasRoundName = !!m.roundName;
    const hasCourtId = m.courtId !== undefined && m.courtId > 0;
    
    let query = "";
    if (hasRoundName) {
      query = `UPDATE TournamentMatches 
               SET ScheduledStart = @scheduledStart
                   ${hasCourtId ? ", CourtID = @courtId" : ""} 
               WHERE DivisionID = @divisionId 
                 AND RoundNo = @roundNo 
                 AND (KnockoutRound = @roundName OR KnockoutRound IS NULL)`;
    } else {
      query = `UPDATE TournamentMatches 
               SET ScheduledStart = @scheduledStart
                   ${hasCourtId ? ", CourtID = @courtId" : ""} 
               WHERE DivisionID = @divisionId 
                 AND RoundNo = @roundNo`;
    }

    const request = pool.request()
      .input("divisionId", sql.Int, divisionId)
      .input("roundNo", sql.Int, m.roundNo)
      .input("scheduledStart", sql.DateTime, new Date(m.scheduledStart));

    if (hasRoundName) {
      request.input("roundName", sql.NVarChar, m.roundName);
    }
    if (hasCourtId) {
      request.input("courtId", sql.Int, m.courtId);
    }

    await request.query(query);
  }

  // Ghi AuditLog
  await createAuditLog({
    userId,
    actionName: "UPDATE_ROUND_MILESTONES",
    tableName: "TournamentMatches",
    entityId: divisionId,
    description: `Admin cập nhật cột mốc thời gian cho ${milestones.length} vòng đấu của nội dung ID: ${divisionId}`,
  });
}

export async function applyDefaultRoundScheduleConfig(tournamentId: number, divisionId: number, userId: number) {
  const division = await tournamentRepo.findDivisionById(divisionId);
  if (division && (division as any).RoundScheduleConfig) {
    try {
      const config = JSON.parse((division as any).RoundScheduleConfig);
      if (Array.isArray(config) && config.length > 0) {
        await updateRoundMilestones(tournamentId, divisionId, config, userId);
      }
    } catch (e) {
      console.error("Error applying pre-configured round milestones", e);
    }
  }
}

/**
 * Gửi email chứng nhận giải đấu cho đội đăng ký
 */
export async function sendCertificateEmail(registrationId: number, rankOverride: string, userId: number) {
  const registrationRows = await tournamentRepo.getRegistrationForCertificate(registrationId);
  if (!registrationRows || registrationRows.length === 0) {
    throw Object.assign(new Error("Không tìm thấy thông tin đăng ký hoặc thành viên đội hợp lệ"), { statusCode: 404 });
  }

  const firstRow = registrationRows[0];
  if (firstRow.RegistrationStatus !== "Confirmed") {
    throw Object.assign(new Error("Đơn đăng ký phải ở trạng thái đã duyệt (Confirmed) mới được gửi chứng chỉ"), { statusCode: 400 });
  }

  // Resolve rank
  let rankValue: number | null = null;
  if (rankOverride === "1") rankValue = 1;
  else if (rankOverride === "2") rankValue = 2;
  else if (rankOverride === "3") rankValue = 3;
  else if (rankOverride === "none") rankValue = null;
  else { // "auto"
    if (firstRow.BracketType === "RoundRobin") {
      const standings = await tournamentRepo.getDivisionStandings(firstRow.DivisionID);
      const sorted = [...standings].sort((a, b) => (a.RankNo || 99) - (b.RankNo || 99));
      const idx = sorted.findIndex(s => s.TeamID === firstRow.TeamID);
      if (idx >= 0 && idx < 3) {
        rankValue = idx + 1;
      } else {
        rankValue = null;
      }
    } else {
      const matches = await tournamentRepo.getDivisionMatches(firstRow.DivisionID);
      const finalMatch = matches.find((m: any) => m.KnockoutRound === "Chung kết");
      const thirdMatch = matches.find((m: any) => m.KnockoutRound === "Tranh hạng 3");
      if (finalMatch && finalMatch.WinnerTeamID) {
        if (finalMatch.WinnerTeamID === firstRow.TeamID) {
          rankValue = 1;
        } else if (finalMatch.TeamAID === firstRow.TeamID || finalMatch.TeamBID === firstRow.TeamID) {
          rankValue = 2;
        }
      }
      if (thirdMatch && thirdMatch.WinnerTeamID && thirdMatch.WinnerTeamID === firstRow.TeamID) {
        rankValue = 3;
      }
    }
  }

  // Resolve visual properties based on rank
  const isChampion = rankValue === 1;
  const isRunnerUp = rankValue === 2;
  const isThird = rankValue === 3;

  let rankLabel = "Chứng nhận hoàn thành giải đấu";
  let badgeIcon = "🎁";
  let rewardText = "Hộp quà lưu niệm BTC & Huy hiệu lưu niệm";

  // Parse Prize Info
  const getPrizeText = (place: number, prizeInfo?: string) => {
    if (!prizeInfo) {
      if (place === 1) return "20.000.000 VNĐ";
      if (place === 2) return "10.000.000 VNĐ";
      return "5.000.000 VNĐ";
    }
    const info = prizeInfo.toLowerCase();
    if (place === 1) {
      const m = info.match(/(nhất|vô địch|champion|1st)[:\-\s]+([\d\.,\s]+(vnđ|vnd|đ|đồng|triệu)?)/i);
      return m ? m[2].trim().toUpperCase() : "20.000.000 VNĐ";
    } else if (place === 2) {
      const m = info.match(/(nhì|á quân|runner|2nd)[:\-\s]+([\d\.,\s]+(vnđ|vnd|đ|đồng|triệu)?)/i);
      return m ? m[2].trim().toUpperCase() : "10.000.000 VNĐ";
    } else {
      const m = info.match(/(ba|hạng ba|third|3rd)[:\-\s]+([\d\.,\s]+(vnđ|vnd|đ|đồng|triệu)?)/i);
      return m ? m[2].trim().toUpperCase() : "5.000.000 VNĐ";
    }
  };

  if (isChampion) {
    rankLabel = "Giải Vô Địch (Hạng 1)";
    badgeIcon = "🏆";
    rewardText = `CÚP VÔ ĐỊCH, Huy chương Vàng & Tiền thưởng ${getPrizeText(1, firstRow.PrizeInfo)}`;
  } else if (isRunnerUp) {
    rankLabel = "Giải Á Quân (Hạng 2)";
    badgeIcon = "🥈";
    rewardText = `Huy chương Bạc & Tiền thưởng ${getPrizeText(2, firstRow.PrizeInfo)}`;
  } else if (isThird) {
    rankLabel = "Đồng Giải Ba (Hạng 3)";
    badgeIcon = "🥉";
    rewardText = `Huy chương Đồng & Tiền thưởng ${getPrizeText(3, firstRow.PrizeInfo)}`;
  }

  // Gửi email cho từng thành viên
  const { sendTournamentCertificateEmail } = await import("../../utils/mail");
  for (const athlete of registrationRows) {
    if (athlete.Email) {
      await sendTournamentCertificateEmail(athlete.Email, {
        recipientName: athlete.FullName,
        tournamentName: athlete.TournamentName,
        divisionName: athlete.DivisionName,
        teamCode: athlete.TeamCode,
        rankLabel,
        badgeIcon,
        rewardText,
        certificateUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/tournaments/${athlete.TournamentID}?certRegId=${athlete.RegistrationID}`,
        certificatePdfUrl: athlete.CertificatePdfUrl || null
      });
    }
  }

  // Cập nhật database
  await tournamentRepo.updateCertificateSent(registrationId);

  // Ghi AuditLog
  await createAuditLog({
    userId,
    actionName: "SEND_CERTIFICATE_EMAIL",
    tableName: "TournamentRegistrations",
    entityId: registrationId,
    description: `Gửi email chứng chỉ giải đấu cho đội: ${firstRow.TeamName} (Mã đội: ${firstRow.TeamCode}), Hạng: ${rankLabel}`,
  });

  return { success: true };
}

/**
 * Cập nhật đường dẫn file PDF chứng chỉ giải đấu
 */
export async function updateCertificatePdfUrl(registrationId: number, pdfUrl: string | null, userId: number) {
  await tournamentRepo.updateCertificatePdfUrl(registrationId, pdfUrl);

  await createAuditLog({
    userId,
    actionName: "UPDATE_CERTIFICATE_PDF_URL",
    tableName: "TournamentRegistrations",
    entityId: registrationId,
    description: `Cập nhật đường dẫn file PDF chứng chỉ cho đơn đăng ký ID: ${registrationId} thành: ${pdfUrl || "Trống"}`,
  });
}


