import * as invitationRepo from "../play-invitations.repository";
import * as groupRepo from "../../playgroups/playgroups.repository";
import * as matchingRepo from "../../player-matching/player-matching.repository";
import {
  acceptInvitation,
  createPlayInvitation,
  rejectInvitation,
} from "../play-invitations.service";

jest.mock("../play-invitations.repository", () => ({
  createInvitation: jest.fn(),
  getInvitationById: jest.fn(),
  getReceivedInvitations: jest.fn(),
  getSentInvitations: jest.fn(),
  updateInvitationStatus: jest.fn(),
  checkPendingInvitation: jest.fn(),
  findPendingInvitationBetweenUsers: jest.fn(),
  acceptTeammateInvitationTx: jest.fn(),
  getPendingInvitationsCount: jest.fn(),
}));

jest.mock("../../playgroups/playgroups.repository", () => ({
  getGroupDetails: jest.fn(),
  checkUserInGroup: jest.fn(),
  addGroupMember: jest.fn(),
  countActiveGroupMembers: jest.fn(),
  checkGroupOverlap: jest.fn(),
  findActiveGroupBetweenPlayers: jest.fn(),
}));

jest.mock("../../player-matching/player-matching.repository", () => ({
  findProfileByUserId: jest.fn(),
  upsertPlayerMatch: jest.fn(),
}));

jest.mock("../../notifications/notifications.service", () => ({
  notifyPlayInvitationCreated: jest.fn(() => Promise.resolve()),
  notifyInvitationStatusChanged: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/database/connection", () => ({
  getPool: jest.fn(),
  sql: { Int: "Int" },
}));

const mockedInvRepo = jest.mocked(invitationRepo);
const mockedGroupRepo = jest.mocked(groupRepo);
const mockedMatchingRepo = jest.mocked(matchingRepo);

describe("play-invitations.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createPlayInvitation", () => {
    it("requires sender to have player profile", async () => {
      mockedMatchingRepo.findProfileByUserId.mockResolvedValue(null as any);

      await expect(
        createPlayInvitation(1, 2, null, null, "InviteToPlay", "Play together")
      ).rejects.toThrow();
      expect(mockedInvRepo.createInvitation).not.toHaveBeenCalled();
    });

    it("rejects invitation to self", async () => {
      mockedMatchingRepo.findProfileByUserId.mockResolvedValue({ UserID: 1 } as any);

      await expect(
        createPlayInvitation(1, 1, null, null, "InviteToPlay", "Play together")
      ).rejects.toThrow();
      expect(mockedInvRepo.createInvitation).not.toHaveBeenCalled();
    });

    it("rejects duplicate pending InviteToPlay invitation", async () => {
      mockedMatchingRepo.findProfileByUserId.mockResolvedValue({ UserID: 1 } as any);
      mockedInvRepo.findPendingInvitationBetweenUsers.mockResolvedValue({
        InvitationID: 9,
      } as any);

      await expect(
        createPlayInvitation(1, 2, null, null, "InviteToPlay", "Play together")
      ).rejects.toThrow();
      expect(mockedInvRepo.createInvitation).not.toHaveBeenCalled();
    });

    it("creates InviteToPlay invitation when validation passes", async () => {
      mockedMatchingRepo.findProfileByUserId.mockResolvedValue({ UserID: 1 } as any);
      mockedInvRepo.findPendingInvitationBetweenUsers.mockResolvedValue(null as any);
      mockedGroupRepo.findActiveGroupBetweenPlayers.mockResolvedValue(null as any);
      mockedInvRepo.createInvitation.mockResolvedValue(77 as any);
      mockedInvRepo.getInvitationById.mockResolvedValue({
        InvitationID: 77,
        SenderID: 1,
        ReceiverID: 2,
        Status: "Pending",
      } as any);

      const result = await createPlayInvitation(
        1,
        2,
        null,
        null,
        "InviteToPlay",
        "Play together"
      );

      expect(result.InvitationID).toBe(77);
      expect(mockedInvRepo.createInvitation).toHaveBeenCalledWith(
        1,
        2,
        null,
        "InviteToPlay",
        "Play together",
        undefined,
        undefined,
        undefined
      );
    });
  });

  describe("acceptInvitation", () => {
    it("rejects when current user is not receiver", async () => {
      mockedInvRepo.getInvitationById.mockResolvedValue({
        InvitationID: 1,
        SenderID: 1,
        ReceiverID: 2,
        Status: "Pending",
      } as any);

      await expect(acceptInvitation(1, 99)).rejects.toThrow();
      expect(mockedInvRepo.updateInvitationStatus).not.toHaveBeenCalled();
    });

    it("expires InviteToGroup when group is full", async () => {
      mockedInvRepo.getInvitationById.mockResolvedValue({
        InvitationID: 1,
        SenderID: 1,
        ReceiverID: 2,
        Status: "Pending",
        InvitationType: "InviteToGroup",
        GroupID: 3,
      } as any);
      mockedGroupRepo.getGroupDetails.mockResolvedValue({
        GroupID: 3,
        CurrentPlayers: 4,
        MaxPlayers: 4,
      } as any);

      await expect(acceptInvitation(1, 2)).rejects.toThrow();
      expect(mockedInvRepo.updateInvitationStatus).toHaveBeenCalledWith(1, "Expired");
    });

    it("accepts InviteToPlay and creates auto group in transaction", async () => {
      const invite = {
        InvitationID: 1,
        SenderID: 10,
        ReceiverID: 20,
        Status: "Pending",
        InvitationType: "InviteToPlay",
        GroupID: null,
      };

      mockedInvRepo.getInvitationById
        .mockResolvedValueOnce(invite as any)
        .mockResolvedValueOnce({ ...invite, Status: "Accepted" } as any);
      mockedGroupRepo.findActiveGroupBetweenPlayers
        .mockResolvedValueOnce(null as any)
        .mockResolvedValueOnce(33 as any);
      mockedMatchingRepo.findProfileByUserId
        .mockResolvedValueOnce({
          UserID: 10,
          FullName: "Sender",
          SkillLevel: "Beginner",
          ExperienceYears: 2,
        } as any)
        .mockResolvedValueOnce({
          UserID: 20,
          FullName: "Receiver",
          SkillLevel: "Intermediate",
          ExperienceYears: 4,
        } as any);
      mockedInvRepo.acceptTeammateInvitationTx.mockResolvedValue(33 as any);

      const result = await acceptInvitation(1, 20);

      expect(result.groupId).toBe(33);
      expect(mockedInvRepo.acceptTeammateInvitationTx).toHaveBeenCalledWith(
        1,
        10,
        20,
        expect.objectContaining({
          groupName: "Team Sender & Receiver",
          averageExperience: 3,
        }),
        "Teammate"
      );
    });
  });

  describe("rejectInvitation", () => {
    it("updates pending invitation to rejected", async () => {
      mockedInvRepo.getInvitationById
        .mockResolvedValueOnce({
          InvitationID: 1,
          SenderID: 10,
          ReceiverID: 20,
          Status: "Pending",
        } as any)
        .mockResolvedValueOnce({
          InvitationID: 1,
          Status: "Rejected",
        } as any);

      const result = await rejectInvitation(1, 20);

      expect(result.Status).toBe("Rejected");
      expect(mockedInvRepo.updateInvitationStatus).toHaveBeenCalledWith(1, "Rejected");
    });
  });
});
