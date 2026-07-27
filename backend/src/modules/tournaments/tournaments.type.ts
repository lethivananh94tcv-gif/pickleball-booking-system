// ============================================================
// tournaments.type.ts
// Type definitions for the Tournament module
// ============================================================

export interface Tournament {
  TournamentID: number;
  TournamentCode: string;
  TournamentName: string;
  Description?: string;
  Location?: string;
  RegistrationStart: string;
  RegistrationEnd: string;
  TournamentStart: string;
  TournamentEnd: string;
  Status: string;
  PrizeInfo?: string;
  Rules?: string;
  ImageURL?: string;
  OrganizerName?: string;
  CreatedBy: number;
  CreatedAt: string;
  UpdatedAt: string;
  IsDeleted: boolean;
}

export interface TournamentDivision {
  DivisionID: number;
  TournamentID: number;
  DivisionName: string;
  CompetitionFormat: string;
  TeamSize: number;
  GenderRequirement: string;
  SkillLevelName?: string;
  MinDUPR?: number;
  MaxDUPR?: number;
  AgeGroup: string;
  MinAge?: number;
  MaxAge?: number;
  MaxTeams: number;
  RegistrationFee: number;
  BracketType: string;
  EnableThirdPlace?: boolean | number;
  Status: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface TournamentTeam {
  TeamID: number;
  TournamentID: number;
  DivisionID: number;
  TeamName?: string;
  TeamCode?: string;
  CreatedBy: number;
  TeamStatus: string;
  SeedNo?: number;
  CreatedAt: string;
}

export interface TournamentTeamMember {
  TeamMemberID: number;
  TournamentID: number;
  DivisionID: number;
  TeamID: number;
  UserID: number;
  MemberRole: string;
  JoinStatus: string;
  JoinedAt: string;
}

export interface TournamentRegistration {
  RegistrationID: number;
  TournamentID: number;
  DivisionID: number;
  TeamID: number;
  RegisteredBy: number;
  RegistrationStatus: string;
  PaymentStatus: string;
  RegisteredAt: string;
  ConfirmedAt?: string;
}

export interface TournamentPayment {
  TournamentPaymentID: number;
  RegistrationID: number;
  PaymentMethod: string;
  TransactionCode?: string;
  Amount: number;
  PaymentStatus: string;
  GatewayResponse?: string;
  PaidAt?: string;
  CreatedAt: string;
}

export interface TournamentPartnerRequest {
  RequestID: number;
  TournamentID: number;
  DivisionID: number;
  RequesterID: number;
  MatchingMode: string;
  PreferredDUPRMin?: number;
  PreferredDUPRMax?: number;
  PreferredGender?: string;
  RequestStatus: string;
  MatchedUserID?: number;
  MatchedTeamID?: number;
  ExpiredAt?: string;
  CreatedAt: string;
}

export interface TournamentTeamInvitation {
  InvitationID: number;
  TournamentID: number;
  DivisionID: number;
  TeamID: number;
  SenderID: number;
  ReceiverID: number;
  InvitationStatus: string;
  ExpiredAt: string;
  CreatedAt: string;
  RespondedAt?: string;
}

export interface TournamentMatch {
  MatchID: number;
  TournamentID: number;
  DivisionID: number;
  RoundNo: number;
  MatchNo: number;
  GroupName?: string;
  KnockoutRound?: string;
  TeamAID?: number;
  TeamBID?: number;
  WinnerTeamID?: number;
  CourtID?: number;
  ScheduledStart?: string;
  ScheduledEnd?: string;
  MatchStatus: string;
  ScoreText?: string;
  ScoreJson?: string;
  TeamASetWon?: number;
  TeamBSetWon?: number;
  NextMatchID?: number;
  NextMatchSlot?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface TournamentMatchScore {
  ScoreID: number;
  MatchID: number;
  SetNo: number;
  TeamAScore: number;
  TeamBScore: number;
  CreatedAt: string;
}

export interface TournamentMatchCheckIn {
  CheckInID: number;
  MatchID: number;
  TeamID: number;
  CheckedInBy: number;
  CheckInTime: string;
  CheckInStatus: string;
}

export interface TournamentStanding {
  StandingID: number;
  TournamentID: number;
  DivisionID: number;
  TeamID: number;
  GroupName?: string;
  Played: number;
  Won: number;
  Lost: number;
  PointsFor: number;
  PointsAgainst: number;
  PointDifference: number;
  RankNo?: number;
}

export interface TournamentCourtBlock {
  BlockID: number;
  TournamentID: number;
  DivisionID?: number;
  MatchID?: number;
  CourtID: number;
  StartDateTime: string;
  EndDateTime: string;
  Reason?: string;
  Status: string;
  CreatedAt: string;
}

// ── DTOs ─────────────────────────────────────────────────────

export interface CreateTournamentInput {
  tournamentCode: string;
  tournamentName: string;
  description?: string;
  location?: string;
  registrationStart: string;
  registrationEnd: string;
  tournamentStart: string;
  tournamentEnd: string;
  prizeInfo?: string;
  rules?: string;
  imageURL?: string;
  organizerName?: string;
}

export interface UpdateTournamentInput {
  tournamentName?: string;
  description?: string;
  location?: string;
  registrationStart?: string;
  registrationEnd?: string;
  tournamentStart?: string;
  tournamentEnd?: string;
  prizeInfo?: string;
  rules?: string;
  imageURL?: string;
  organizerName?: string;
  adminOverride?: boolean;
  isHidden?: boolean;
}


export interface CreateDivisionInput {
  divisionName: string;
  competitionFormat: "MenSingles" | "WomenSingles" | "MenDoubles" | "WomenDoubles" | "MixedDoubles";
  skillLevelName?: string;
  minDUPR?: number | null;
  maxDUPR?: number | null;
  ageGroup: "Youth" | "Open" | "Senior50" | "Senior60";
  minAge?: number | null;
  maxAge?: number | null;
  maxTeams: number;
  registrationFee?: number;
  bracketType: "SingleElimination" | "RoundRobin" | "GroupKnockout";
  enableThirdPlace?: boolean;
  roundScheduleConfig?: string | null;
}

export interface UpdateDivisionInput {
  divisionName?: string;
  skillLevelName?: string;
  minDUPR?: number | null;
  maxDUPR?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  maxTeams?: number;
  registrationFee?: number;
  roundScheduleConfig?: string | null;
}
