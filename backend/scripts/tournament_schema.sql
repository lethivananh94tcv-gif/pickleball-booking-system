-- ============================================================
-- TOURNAMENT MODULE SCHEMAS
-- Target Database: PCS_SYSTEM_5 (MS SQL Server)
-- ============================================================

-- ------------------------------------------------------------
-- 1. TOURNAMENTS
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Tournaments')
BEGIN
    CREATE TABLE Tournaments (
        TournamentID INT IDENTITY(1,1) PRIMARY KEY,
        TournamentCode NVARCHAR(50) UNIQUE NOT NULL,
        TournamentName NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        Location NVARCHAR(255),
        RegistrationStart DATETIME NOT NULL,
        RegistrationEnd DATETIME NOT NULL,
        TournamentStart DATETIME NOT NULL,
        TournamentEnd DATETIME NOT NULL,
        Status NVARCHAR(50) DEFAULT 'Draft'
            CHECK (Status IN ('Draft', 'Open', 'Closed', 'Scheduling', 'Ongoing', 'Completed', 'Cancelled')),
        PrizeInfo NVARCHAR(MAX),
        Rules NVARCHAR(MAX),
        CreatedBy INT NOT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        IsDeleted BIT DEFAULT 0,

        FOREIGN KEY (CreatedBy) REFERENCES Users(UserID),
        CONSTRAINT CK_Tournament_RegistrationTime CHECK (RegistrationStart < RegistrationEnd),
        CONSTRAINT CK_Tournament_RegistrationEnd CHECK (RegistrationEnd <= TournamentStart),
        CONSTRAINT CK_Tournament_TournamentTime CHECK (TournamentStart < TournamentEnd)
    );
END

-- ------------------------------------------------------------
-- 2. TOURNAMENT_DIVISIONS
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentDivisions')
BEGIN
    CREATE TABLE TournamentDivisions (
        DivisionID INT IDENTITY(1,1) PRIMARY KEY,
        TournamentID INT NOT NULL,
        DivisionName NVARCHAR(255) NOT NULL,
        CompetitionFormat NVARCHAR(50) NOT NULL
            CHECK (CompetitionFormat IN ('MenSingles', 'WomenSingles', 'MenDoubles', 'WomenDoubles', 'MixedDoubles', 'Singles', 'Doubles', 'MixedDoubles')),
        TeamSize INT NOT NULL,
        GenderRequirement NVARCHAR(50) NOT NULL
            CHECK (GenderRequirement IN ('MaleOnly', 'FemaleOnly', 'Mixed')),
        SkillLevelName NVARCHAR(100),
        MinDUPR DECIMAL(4,2) NULL,
        MaxDUPR DECIMAL(4,2) NULL,
        AgeGroup NVARCHAR(50) NOT NULL
            CHECK (AgeGroup IN ('Youth', 'Open', 'Senior50', 'Senior60')),
        MinAge INT NULL,
        MaxAge INT NULL,
        MaxTeams INT NOT NULL,
        RegistrationFee DECIMAL(18,2) DEFAULT 0,
        BracketType NVARCHAR(50) NOT NULL
            CHECK (BracketType IN ('SingleElimination', 'RoundRobin', 'GroupKnockout')),
        Status NVARCHAR(50) DEFAULT 'Draft'
            CHECK (Status IN ('Draft', 'Open', 'Closed', 'Ongoing', 'Completed', 'Cancelled')),
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID)
    );
END

-- ------------------------------------------------------------
-- 3. TOURNAMENT_TEAMS
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentTeams')
BEGIN
    CREATE TABLE TournamentTeams (
        TeamID INT IDENTITY(1,1) PRIMARY KEY,
        TournamentID INT NOT NULL,
        DivisionID INT NOT NULL,
        TeamName NVARCHAR(255),
        TeamCode NVARCHAR(50),
        CreatedBy INT NOT NULL,
        TeamStatus NVARCHAR(50) DEFAULT 'Draft'
            CHECK (TeamStatus IN ('Draft', 'PendingMemberConfirm', 'LookingForPartner', 'AutoMatching', 'TeamConfirmed', 'PendingPayment', 'Registered', 'Rejected', 'Withdrawn', 'Eliminated', 'Winner')),
        SeedNo INT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID),
        FOREIGN KEY (DivisionID) REFERENCES TournamentDivisions(DivisionID),
        FOREIGN KEY (CreatedBy) REFERENCES Users(UserID)
    );
END

-- Unique index: TeamCode unique inside Tournament when not null
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_TournamentTeams_TeamCode' AND object_id = OBJECT_ID('TournamentTeams'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_TournamentTeams_TeamCode 
    ON TournamentTeams(TournamentID, TeamCode) 
    WHERE TeamCode IS NOT NULL;
END

-- ------------------------------------------------------------
-- 4. TOURNAMENT_TEAM_MEMBERS
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentTeamMembers')
BEGIN
    CREATE TABLE TournamentTeamMembers (
        TeamMemberID INT IDENTITY(1,1) PRIMARY KEY,
        TournamentID INT NOT NULL,
        DivisionID INT NOT NULL,
        TeamID INT NOT NULL,
        UserID INT NOT NULL,
        MemberRole NVARCHAR(50) DEFAULT 'Member'
            CHECK (MemberRole IN ('Leader', 'Member')),
        JoinStatus NVARCHAR(50) DEFAULT 'Pending'
            CHECK (JoinStatus IN ('Pending', 'Accepted', 'Declined', 'Removed')),
        JoinedAt DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID),
        FOREIGN KEY (DivisionID) REFERENCES TournamentDivisions(DivisionID),
        FOREIGN KEY (TeamID) REFERENCES TournamentTeams(TeamID),
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
    );
END

-- Unique filtered index: Player cannot be in more than one active team in the same division
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_TournamentTeamMembers_DivisionUser' AND object_id = OBJECT_ID('TournamentTeamMembers'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_TournamentTeamMembers_DivisionUser
    ON TournamentTeamMembers(DivisionID, UserID)
    WHERE JoinStatus IN ('Pending', 'Accepted');
END

-- ------------------------------------------------------------
-- 5. TOURNAMENT_REGISTRATIONS
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentRegistrations')
BEGIN
    CREATE TABLE TournamentRegistrations (
        RegistrationID INT IDENTITY(1,1) PRIMARY KEY,
        TournamentID INT NOT NULL,
        DivisionID INT NOT NULL,
        TeamID INT NOT NULL,
        RegisteredBy INT NOT NULL,
        RegistrationStatus NVARCHAR(50) DEFAULT 'PendingPayment'
            CHECK (RegistrationStatus IN ('PendingPayment', 'Paid', 'Confirmed', 'Waitlisted', 'Cancelled', 'Rejected')),
        PaymentStatus NVARCHAR(50) DEFAULT 'Unpaid'
            CHECK (PaymentStatus IN ('Unpaid', 'Paid', 'Failed', 'Refunded')),
        RegisteredAt DATETIME DEFAULT GETDATE(),
        ConfirmedAt DATETIME NULL,
        CccdVerified BIT DEFAULT 0,
        IsCheckedIn BIT DEFAULT 0,
        PaymentExpiredAt DATETIME NULL,

        FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID),
        FOREIGN KEY (DivisionID) REFERENCES TournamentDivisions(DivisionID),
        FOREIGN KEY (TeamID) REFERENCES TournamentTeams(TeamID),
        FOREIGN KEY (RegisteredBy) REFERENCES Users(UserID)
    );
END

-- Unique index: Unique team registration per division
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_TournamentRegistrations_DivisionTeam' AND object_id = OBJECT_ID('TournamentRegistrations'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_TournamentRegistrations_DivisionTeam
    ON TournamentRegistrations(DivisionID, TeamID);
END

-- ------------------------------------------------------------
-- 6. TOURNAMENT_PAYMENTS
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentPayments')
BEGIN
    CREATE TABLE TournamentPayments (
        TournamentPaymentID INT IDENTITY(1,1) PRIMARY KEY,
        RegistrationID INT NOT NULL,
        PaymentMethod NVARCHAR(50) NOT NULL
            CHECK (PaymentMethod IN ('PayOS', 'VNPay', 'Momo', 'Cash', 'BankTransfer', 'Mock')),
        TransactionCode NVARCHAR(255),
        Amount DECIMAL(18,2) NOT NULL CHECK (Amount >= 0),
        PaymentStatus NVARCHAR(50) DEFAULT 'Pending'
            CHECK (PaymentStatus IN ('Pending', 'Paid', 'Failed', 'Cancelled')),
        GatewayResponse NVARCHAR(MAX),
        PaidAt DATETIME NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (RegistrationID) REFERENCES TournamentRegistrations(RegistrationID)
    );
END

-- ------------------------------------------------------------
-- 7. TOURNAMENT_PARTNER_REQUESTS
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentPartnerRequests')
BEGIN
    CREATE TABLE TournamentPartnerRequests (
        RequestID INT IDENTITY(1,1) PRIMARY KEY,
        TournamentID INT NOT NULL,
        DivisionID INT NOT NULL,
        RequesterID INT NOT NULL,
        MatchingMode NVARCHAR(50) NOT NULL
            CHECK (MatchingMode IN ('SuggestOnly', 'AutoMatch')),
        PreferredDUPRMin DECIMAL(4,2) NULL,
        PreferredDUPRMax DECIMAL(4,2) NULL,
        PreferredGender NVARCHAR(50) NULL,
        RequestStatus NVARCHAR(50) DEFAULT 'LookingForPartner'
            CHECK (RequestStatus IN ('LookingForPartner', 'Suggested', 'AutoMatched', 'WaitingBothConfirm', 'TeamCreated', 'Cancelled', 'Expired')),
        MatchedUserID INT NULL,
        MatchedTeamID INT NULL,
        ExpiredAt DATETIME NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID),
        FOREIGN KEY (DivisionID) REFERENCES TournamentDivisions(DivisionID),
        FOREIGN KEY (RequesterID) REFERENCES Users(UserID),
        FOREIGN KEY (MatchedUserID) REFERENCES Users(UserID),
        FOREIGN KEY (MatchedTeamID) REFERENCES TournamentTeams(TeamID)
    );
END

-- ------------------------------------------------------------
-- 8. TOURNAMENT_TEAM_INVITATIONS
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentTeamInvitations')
BEGIN
    CREATE TABLE TournamentTeamInvitations (
        InvitationID INT IDENTITY(1,1) PRIMARY KEY,
        TournamentID INT NOT NULL,
        DivisionID INT NOT NULL,
        TeamID INT NOT NULL,
        SenderID INT NOT NULL,
        ReceiverID INT NOT NULL,
        InvitationStatus NVARCHAR(50) DEFAULT 'Pending'
            CHECK (InvitationStatus IN ('Pending', 'Accepted', 'Declined', 'Expired', 'Cancelled')),
        ExpiredAt DATETIME NOT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        RespondedAt DATETIME NULL,

        FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID),
        FOREIGN KEY (DivisionID) REFERENCES TournamentDivisions(DivisionID),
        FOREIGN KEY (TeamID) REFERENCES TournamentTeams(TeamID),
        FOREIGN KEY (SenderID) REFERENCES Users(UserID),
        FOREIGN KEY (ReceiverID) REFERENCES Users(UserID)
    );
END

-- ------------------------------------------------------------
-- 9. TOURNAMENT_MATCHES
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentMatches')
BEGIN
    CREATE TABLE TournamentMatches (
        MatchID INT IDENTITY(1,1) PRIMARY KEY,
        TournamentID INT NOT NULL,
        DivisionID INT NOT NULL,
        RoundNo INT NOT NULL CHECK (RoundNo >= 1),
        MatchNo INT NOT NULL CHECK (MatchNo >= 1),
        GroupName NVARCHAR(50) NULL,
        TeamAID INT NULL,
        TeamBID INT NULL,
        WinnerTeamID INT NULL,
        CourtID INT NULL,
        ScheduledStart DATETIME NULL,
        ScheduledEnd DATETIME NULL,
        MatchStatus NVARCHAR(50) DEFAULT 'Scheduled'
            CHECK (MatchStatus IN ('Scheduled', 'CheckInOpen', 'Ready', 'InProgress', 'Completed', 'Forfeit', 'Cancelled')),
        ScoreText NVARCHAR(255),
        NextMatchID INT NULL,
        NextMatchSlot NVARCHAR(10) NULL
            CHECK (NextMatchSlot IS NULL OR NextMatchSlot IN ('TeamA', 'TeamB')),
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID),
        FOREIGN KEY (DivisionID) REFERENCES TournamentDivisions(DivisionID),
        FOREIGN KEY (TeamAID) REFERENCES TournamentTeams(TeamID),
        FOREIGN KEY (TeamBID) REFERENCES TournamentTeams(TeamID),
        FOREIGN KEY (WinnerTeamID) REFERENCES TournamentTeams(TeamID),
        FOREIGN KEY (CourtID) REFERENCES Courts(CourtID),
        FOREIGN KEY (NextMatchID) REFERENCES TournamentMatches(MatchID)
    );
END

-- ------------------------------------------------------------
-- 10. TOURNAMENT_MATCH_SCORES
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentMatchScores')
BEGIN
    CREATE TABLE TournamentMatchScores (
        ScoreID INT IDENTITY(1,1) PRIMARY KEY,
        MatchID INT NOT NULL,
        SetNo INT NOT NULL CHECK (SetNo >= 1),
        TeamAScore INT NOT NULL CHECK (TeamAScore >= 0),
        TeamBScore INT NOT NULL CHECK (TeamBScore >= 0),
        CreatedAt DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (MatchID) REFERENCES TournamentMatches(MatchID)
    );
END

-- ------------------------------------------------------------
-- 11. TOURNAMENT_MATCH_CHECK_INS
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentMatchCheckIns')
BEGIN
    CREATE TABLE TournamentMatchCheckIns (
        CheckInID INT IDENTITY(1,1) PRIMARY KEY,
        MatchID INT NOT NULL,
        TeamID INT NOT NULL,
        CheckedInBy INT NOT NULL,
        CheckInTime DATETIME DEFAULT GETDATE(),
        CheckInStatus NVARCHAR(50) DEFAULT 'CheckedIn'
            CHECK (CheckInStatus IN ('CheckedIn', 'NoShow', 'Forfeit', 'Cancelled')),

        FOREIGN KEY (MatchID) REFERENCES TournamentMatches(MatchID),
        FOREIGN KEY (TeamID) REFERENCES TournamentTeams(TeamID),
        FOREIGN KEY (CheckedInBy) REFERENCES Users(UserID)
    );
END

-- ------------------------------------------------------------
-- 12. TOURNAMENT_STANDINGS
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentStandings')
BEGIN
    CREATE TABLE TournamentStandings (
        StandingID INT IDENTITY(1,1) PRIMARY KEY,
        TournamentID INT NOT NULL,
        DivisionID INT NOT NULL,
        TeamID INT NOT NULL,
        GroupName NVARCHAR(50) NULL,
        Played INT DEFAULT 0 CHECK (Played >= 0),
        Won INT DEFAULT 0 CHECK (Won >= 0),
        Lost INT DEFAULT 0 CHECK (Lost >= 0),
        PointsFor INT DEFAULT 0 CHECK (PointsFor >= 0),
        PointsAgainst INT DEFAULT 0 CHECK (PointsAgainst >= 0),
        PointDifference INT DEFAULT 0,
        RankNo INT NULL,

        FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID),
        FOREIGN KEY (DivisionID) REFERENCES TournamentDivisions(DivisionID),
        FOREIGN KEY (TeamID) REFERENCES TournamentTeams(TeamID)
    );
END

-- ------------------------------------------------------------
-- 13. TOURNAMENT_COURT_BLOCKS
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentCourtBlocks')
BEGIN
    CREATE TABLE TournamentCourtBlocks (
        BlockID INT IDENTITY(1,1) PRIMARY KEY,
        TournamentID INT NOT NULL,
        DivisionID INT NULL,
        MatchID INT NULL,
        CourtID INT NOT NULL,
        StartDateTime DATETIME NOT NULL,
        EndDateTime DATETIME NOT NULL,
        Reason NVARCHAR(255),
        Status NVARCHAR(50) DEFAULT 'Active'
            CHECK (Status IN ('Active', 'Inactive', 'Cancelled')),
        CreatedAt DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID),
        FOREIGN KEY (DivisionID) REFERENCES TournamentDivisions(DivisionID),
        FOREIGN KEY (MatchID) REFERENCES TournamentMatches(MatchID),
        FOREIGN KEY (CourtID) REFERENCES Courts(CourtID),
        CONSTRAINT CK_CourtBlock_Time CHECK (StartDateTime < EndDateTime)
    );
END

-- ------------------------------------------------------------
-- 14. TOURNAMENT_REGISTRATION_ATHLETES (Snapshot information)
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentRegistrationAthletes')
BEGIN
    CREATE TABLE TournamentRegistrationAthletes (
        AthleteID INT IDENTITY(1,1) PRIMARY KEY,
        RegistrationID INT NOT NULL,
        TournamentID INT NOT NULL,
        DivisionID INT NOT NULL,
        TeamID INT NOT NULL,
        UserID INT NULL,
        AthleteNo INT NOT NULL CHECK (AthleteNo IN (1, 2)),
        FullName NVARCHAR(255) NOT NULL,
        PhoneNumber NVARCHAR(20) NOT NULL,
        Rating DECIMAL(4,2) NOT NULL,
        Province NVARCHAR(100) NOT NULL,
        Gender NVARCHAR(20) NOT NULL CHECK (Gender IN ('Male', 'Female')),
        DateOfBirth DATE NOT NULL,
        PhotoURL NVARCHAR(500) NULL,
        CccdURL NVARCHAR(500) NULL,
        Note NVARCHAR(500) NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (RegistrationID) REFERENCES TournamentRegistrations(RegistrationID),
        FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID),
        FOREIGN KEY (DivisionID) REFERENCES TournamentDivisions(DivisionID),
        FOREIGN KEY (TeamID) REFERENCES TournamentTeams(TeamID),
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
    );
END

