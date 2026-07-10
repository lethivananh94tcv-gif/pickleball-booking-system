import * as matchingRepo from "../player-matching.repository";
import {
  calculateExperienceScore,
  calculateRoleScore,
  calculateScheduleScore,
  calculateSkillScore,
  findSuitableTeammates,
  savePlayerProfile,
} from "../player-matching.service";

jest.mock("../player-matching.repository", () => ({
  findProfileByUserId: jest.fn(),
  createProfile: jest.fn(),
  updateProfile: jest.fn(),
  findAllMatchingProfiles: jest.fn(),
  createPlayerMatch: jest.fn(),
  findUserGroups: jest.fn(),
  findAllOtherActiveGroups: jest.fn(),
}));

jest.mock("../../playgroups/playgroups.repository", () => ({
  getGroupDetails: jest.fn(),
  countActiveGroupMembers: jest.fn(),
}));

const mockedRepo = jest.mocked(matchingRepo);

describe("player-matching.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("score helpers", () => {
    it("gives highest role score for attacker and defender pair", () => {
      expect(calculateRoleScore("Attacker", "Defender")).toBe(100);
      expect(calculateRoleScore("Attacker", "Attacker")).toBe(30);
      expect(calculateRoleScore("All-Rounder", "Attacker")).toBe(75);
    });

    it("calculates skill and experience similarity", () => {
      expect(calculateSkillScore("Beginner", "Beginner")).toBe(100);
      expect(calculateSkillScore("Beginner", "Advanced")).toBe(50);
      expect(calculateExperienceScore(2, 2)).toBe(100);
      expect(calculateExperienceScore(2, 7)).toBe(50);
    });

    it("calculates schedule overlap score", () => {
      expect(calculateScheduleScore("18:00", "20:00", "18:30", "20:00")).toBe(100);
      expect(calculateScheduleScore("18:00", "19:00", "18:30", "19:30")).toBe(0);
      expect(calculateScheduleScore("18:00", "19:30", "18:30", "19:30")).toBe(70);
    });
  });

  describe("savePlayerProfile", () => {
    it("creates profile when user does not have one", async () => {
      mockedRepo.findProfileByUserId.mockResolvedValue(null as any);
      mockedRepo.createProfile.mockResolvedValue({ UserID: 1 } as any);

      await savePlayerProfile(1, { SkillLevel: "Beginner" } as any);

      expect(mockedRepo.createProfile).toHaveBeenCalledWith(1, {
        SkillLevel: "Beginner",
      });
      expect(mockedRepo.updateProfile).not.toHaveBeenCalled();
    });

    it("updates profile when user already has one", async () => {
      mockedRepo.findProfileByUserId.mockResolvedValue({ UserID: 1 } as any);
      mockedRepo.updateProfile.mockResolvedValue({ UserID: 1 } as any);

      await savePlayerProfile(1, { SkillLevel: "Intermediate" } as any);

      expect(mockedRepo.updateProfile).toHaveBeenCalledWith(1, {
        SkillLevel: "Intermediate",
      });
      expect(mockedRepo.createProfile).not.toHaveBeenCalled();
    });
  });

  describe("findSuitableTeammates", () => {
    it("requires user to complete available time before matching", async () => {
      mockedRepo.findProfileByUserId.mockResolvedValue({
        UserID: 1,
        AvailableStartTime: null,
        AvailableEndTime: null,
      } as any);

      await expect(findSuitableTeammates(1)).rejects.toThrow();
      expect(mockedRepo.findAllMatchingProfiles).not.toHaveBeenCalled();
    });

    it("sorts teammate candidates by matching score and records strong matches", async () => {
      mockedRepo.findProfileByUserId.mockResolvedValue({
        UserID: 1,
        PlayingRole: "Attacker",
        SkillLevel: "Beginner",
        ExperienceYears: 2,
        AvailableStartTime: "18:00",
        AvailableEndTime: "20:00",
      } as any);
      mockedRepo.findAllMatchingProfiles.mockResolvedValue([
        {
          UserID: 2,
          PlayingRole: "Defender",
          SkillLevel: "Beginner",
          ExperienceYears: 2,
          AvailableStartTime: "18:30",
          AvailableEndTime: "20:00",
        },
        {
          UserID: 3,
          PlayingRole: "Attacker",
          SkillLevel: "Advanced",
          ExperienceYears: 10,
          AvailableStartTime: "07:00",
          AvailableEndTime: "08:00",
        },
      ] as any);
      mockedRepo.createPlayerMatch.mockResolvedValue({} as any);

      const result = await findSuitableTeammates(1);

      expect(result[0].profile.UserID).toBe(2);
      expect(result[0].matchingScore).toBeGreaterThan(result[1].matchingScore);
      expect(mockedRepo.createPlayerMatch).toHaveBeenCalledWith(
        1,
        2,
        result[0].matchingScore,
        "Teammate"
      );
    });
  });
});
