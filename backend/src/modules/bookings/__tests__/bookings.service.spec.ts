import * as bookingRepo from "../bookings.repository";
import * as bookingValidation from "../bookings.validation";
import {
  cancelBooking,
  createCoachBooking,
  createComboBooking,
  createCourtBooking,
  createTeamBooking,
  mockPayBooking,
} from "../bookings.service";
import { requestRefund } from "@/modules/refunds/refunds.service";
import { countActiveGroupMembers } from "../../playgroups/playgroups.repository";

jest.mock("../bookings.repository", () => ({
  findUserById: jest.fn(),
  getOrCreateWalkInGuestUser: jest.fn(),
  findCourtByIdForBooking: jest.fn(),
  findCoachByIdForBooking: jest.fn(),
  findAvailableCourtSlot: jest.fn(),
  findAvailableCoachSchedules: jest.fn(),
  findBookingWithPaymentById: jest.fn(),
  repoCreateCourtBooking: jest.fn(),
  repoCreateCoachBooking: jest.fn(),
  repoCreateComboBooking: jest.fn(),
  repoCancelBookingById: jest.fn(),
  repoCheckInBookingById: jest.fn(),
  repoMockPayBooking: jest.fn(),
  repoReleaseExpiredHoldings: jest.fn(),
  repoAutoCheckInExpired: jest.fn(),
  repoMarkCompletedExpiredCheckins: jest.fn(),
  findBookingsByUserId: jest.fn(),
  findBookingsByCoachUserId: jest.fn(),
  findBookingById: jest.fn(),
  findDailyBookingsForStaff: jest.fn(),
  repoCreateTeamBooking: jest.fn(),
}));

jest.mock("../bookings.validation", () => ({
  calculateHours: jest.fn(),
  validateBookingDate: jest.fn(),
  validateHoldingLimit: jest.fn(),
  validateCoachFeePerHour: jest.fn(),
}));

jest.mock("@/modules/refunds/refunds.service", () => ({
  requestRefund: jest.fn(),
  requestCoachCancelRefund: jest.fn(),
}));

jest.mock("@/modules/notifications/notifications.service", () => ({
  createNotification: jest.fn(),
}));

jest.mock("@/modules/systemlogs/systemlogs.service", () => ({
  createSystemLog: jest.fn(),
}));

jest.mock("@/utils/mail", () => ({
  sendBookingCreatedEmail: jest.fn(),
  sendPaymentSuccessEmail: jest.fn(),
  sendCoachAssignedEmail: jest.fn(),
  sendNoShowEmail: jest.fn(),
  sendPaymentExpiredEmail: jest.fn(),
}));

jest.mock("../../coaches/coaches.validation", () => ({
  isScheduleExpired: jest.fn(() => false),
}));

jest.mock("../../playgroups/playgroups.repository", () => ({
  countActiveGroupMembers: jest.fn(),
}));

jest.mock("@/utils/AppError", () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

const mockedRepo = jest.mocked(bookingRepo);
const mockedValidation = jest.mocked(bookingValidation);

describe("bookings.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedValidation.calculateHours.mockReturnValue(2);
    mockedValidation.validateBookingDate.mockImplementation(() => undefined);
    mockedValidation.validateHoldingLimit.mockResolvedValue(undefined);
    mockedValidation.validateCoachFeePerHour.mockImplementation(() => undefined);
  });

  describe("createCourtBooking", () => {
    it("creates a court booking when user, court and slot are valid", async () => {
      mockedRepo.findUserById.mockResolvedValue({ UserID: 1, Status: "Active" } as any);
      mockedRepo.findCourtByIdForBooking.mockResolvedValue({
        CourtID: 10,
        Status: "Available",
      } as any);
      mockedRepo.findAvailableCourtSlot.mockResolvedValue({
        SlotID: 20,
        Price: 150000,
      } as any);
      mockedRepo.repoCreateCourtBooking.mockResolvedValue({
        BookingID: 100,
        BookingCode: "BK100",
        TotalAmount: 150000,
      } as any);

      const result = await createCourtBooking({
        userId: 1,
        courtId: 10,
        bookingDate: "2999-01-01",
        startTime: "08:00",
        endTime: "09:00",
      });

      expect(result.BookingID).toBe(100);
      expect(mockedValidation.validateBookingDate).toHaveBeenCalledWith("2999-01-01", "08:00");
      expect(mockedValidation.validateHoldingLimit).toHaveBeenCalledWith(1);
      expect(mockedRepo.repoCreateCourtBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          courtId: 10,
          slotId: 20,
          courtFee: 150000,
        })
      );
    });

    it("rejects counter payment when requester is not staff/admin", async () => {
      await expect(
        createCourtBooking({
          userId: 1,
          userRoles: ["Player"],
          courtId: 10,
          bookingDate: "2999-01-01",
          startTime: "08:00",
          endTime: "09:00",
          paymentMethod: "Cash",
        })
      ).rejects.toThrow("Chi Staff/Admin moi duoc tao booking thanh toan tai quay");
      expect(mockedRepo.findUserById).not.toHaveBeenCalled();
    });

    it("rejects booking when no available slot exists", async () => {
      mockedRepo.findUserById.mockResolvedValue({ UserID: 1, Status: "Active" } as any);
      mockedRepo.findCourtByIdForBooking.mockResolvedValue({
        CourtID: 10,
        Status: "Available",
      } as any);
      mockedRepo.findAvailableCourtSlot.mockResolvedValue(null as any);

      await expect(
        createCourtBooking({
          userId: 1,
          courtId: 10,
          bookingDate: "2999-01-01",
          startTime: "08:00",
          endTime: "09:00",
        })
      ).rejects.toThrow("Khung gio nay da bi dat hoac khong co slot phu hop");
      expect(mockedRepo.repoCreateCourtBooking).not.toHaveBeenCalled();
    });
  });

  describe("createCoachBooking", () => {
    it("calculates coach fee and creates coach booking", async () => {
      mockedRepo.findUserById.mockResolvedValue({ UserID: 1, Status: "Active" } as any);
      mockedRepo.findCoachByIdForBooking.mockResolvedValue({
        CoachID: 5,
        Status: "Approved",
        HourlyRate: 200000,
      } as any);
      (mockedRepo.findAvailableCoachSchedules as jest.Mock).mockResolvedValue([
        { CoachScheduleID: 10, StartTime: "08:00", EndTime: "09:00" },
        { CoachScheduleID: 11, StartTime: "09:00", EndTime: "10:00" }
      ]);
      mockedRepo.repoCreateCoachBooking.mockResolvedValue({
        BookingID: 200,
        TotalAmount: 400000,
      } as any);

      const result = await createCoachBooking({
        userId: 1,
        coachId: 5,
        bookingDate: "2999-01-01",
        startTime: "08:00",
        endTime: "10:00",
      });

      expect(result.BookingID).toBe(200);
      expect(mockedValidation.calculateHours).toHaveBeenCalledWith("08:00", "10:00");
    expect(mockedRepo.repoCreateCoachBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        coachId: 5,
        coachScheduleIds: [10, 11],
        coachFeePerHour: 200000,
        totalCoachFee: 400000,
      })
    );
    });

    it("rejects coach booking when coach is not approved", async () => {
      mockedRepo.findUserById.mockResolvedValue({ UserID: 1, Status: "Active" } as any);
      mockedRepo.findCoachByIdForBooking.mockResolvedValue({
        CoachID: 5,
        Status: "Pending",
        HourlyRate: 200000,
      } as any);

      await expect(
        createCoachBooking({
          userId: 1,
          coachId: 5,
          bookingDate: "2999-01-01",
          startTime: "08:00",
          endTime: "10:00",
        })
      ).rejects.toThrow("HLV chua duoc duyet");
      expect(mockedRepo.repoCreateCoachBooking).not.toHaveBeenCalled();
    });

    it("rejects coach booking when returned schedules count does not match requested hours", async () => {
      mockedRepo.findUserById.mockResolvedValue({ UserID: 1, Status: "Active" } as any);
      mockedRepo.findCoachByIdForBooking.mockResolvedValue({
        CoachID: 5,
        Status: "Approved",
        HourlyRate: 200000,
      } as any);
      // Requested hours = 2, but only 1 slot returned (e.g. one slot is busy/unavailable)
      (mockedRepo.findAvailableCoachSchedules as jest.Mock).mockResolvedValue([
        { CoachScheduleID: 10, StartTime: "08:00", EndTime: "09:00" },
      ]);

      await expect(
        createCoachBooking({
          userId: 1,
          coachId: 5,
          bookingDate: "2999-01-01",
          startTime: "08:00",
          endTime: "10:00", // 2 hours
        })
      ).rejects.toThrow("HLV khong co du lich trong khung gio nay hoac vi pham buffer 15 phut (BR-46)");
      expect(mockedRepo.repoCreateCoachBooking).not.toHaveBeenCalled();
    });
  });

  describe("createComboBooking", () => {
    it("creates combo booking for 2 hours correctly", async () => {
      mockedRepo.findUserById.mockResolvedValue({ UserID: 1, Status: "Active" } as any);
      mockedRepo.findCourtByIdForBooking.mockResolvedValue({
        CourtID: 10,
        Status: "Available",
      } as any);
      mockedRepo.findAvailableCourtSlot.mockResolvedValue({
        SlotID: 20,
        Price: 150000,
      } as any);
      mockedRepo.findCoachByIdForBooking.mockResolvedValue({
        CoachID: 5,
        Status: "Approved",
        HourlyRate: 200000,
      } as any);
      (mockedRepo.findAvailableCoachSchedules as jest.Mock).mockResolvedValue([
        { CoachScheduleID: 10, StartTime: "08:00", EndTime: "09:00" },
        { CoachScheduleID: 11, StartTime: "09:00", EndTime: "10:00" }
      ]);
      mockedRepo.repoCreateComboBooking.mockResolvedValue({
        BookingID: 300,
        TotalAmount: 550000, // 150k + 400k
      } as any);

      const result = await createComboBooking({
        userId: 1,
        courtId: 10,
        coachId: 5,
        bookingDate: "2999-01-01",
        startTime: "08:00",
        endTime: "10:00", // 2 hours
      });

      expect(result.BookingID).toBe(300);
      expect(mockedRepo.repoCreateComboBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          courtId: 10,
          coachId: 5,
          coachScheduleIds: [10, 11],
          courtFee: 150000,
          coachFeePerHour: 200000,
          totalCoachFee: 400000,
        })
      );
    });

    it("rejects combo booking when returned schedules count does not match requested hours", async () => {
      mockedRepo.findUserById.mockResolvedValue({ UserID: 1, Status: "Active" } as any);
      mockedRepo.findCourtByIdForBooking.mockResolvedValue({
        CourtID: 10,
        Status: "Available",
      } as any);
      mockedRepo.findAvailableCourtSlot.mockResolvedValue({
        SlotID: 20,
        Price: 150000,
      } as any);
      mockedRepo.findCoachByIdForBooking.mockResolvedValue({
        CoachID: 5,
        Status: "Approved",
        HourlyRate: 200000,
      } as any);
      // Requested hours = 3, but only 2 slots returned
      (mockedRepo.findAvailableCoachSchedules as jest.Mock).mockResolvedValue([
        { CoachScheduleID: 10, StartTime: "08:00", EndTime: "09:00" },
        { CoachScheduleID: 11, StartTime: "09:00", EndTime: "10:00" }
      ]);
      mockedValidation.calculateHours.mockReturnValue(3);

      await expect(
        createComboBooking({
          userId: 1,
          courtId: 10,
          coachId: 5,
          bookingDate: "2999-01-01",
          startTime: "08:00",
          endTime: "11:00", // 3 hours
        })
      ).rejects.toThrow("HLV khong co du lich trong khung gio nay hoac vi pham buffer 15 phut (BR-46)");
      expect(mockedRepo.repoCreateComboBooking).not.toHaveBeenCalled();
    });
  });

  describe("createTeamBooking", () => {
    it("rejects team booking longer than two hours", async () => {
      await expect(
        createTeamBooking({
          userId: 1,
          groupId: 3,
          courtId: 10,
          bookingDate: "2999-01-01",
          startTime: "08:00",
          endTime: "11:00",
        })
      ).rejects.toThrow(/2/);
      expect(mockedRepo.repoCreateTeamBooking).not.toHaveBeenCalled();
    });

    it("rejects team booking when group has fewer than two active members", async () => {
      mockedRepo.findUserById.mockResolvedValue({ UserID: 1, Status: "Active" } as any);
      mockedRepo.findCourtByIdForBooking.mockResolvedValue({
        CourtID: 10,
        Status: "Available",
      } as any);
      jest.mocked(countActiveGroupMembers).mockResolvedValue(1);

      await expect(
        createTeamBooking({
          userId: 1,
          groupId: 3,
          courtId: 10,
          bookingDate: "2999-01-01",
          startTime: "08:00",
          endTime: "10:00",
        })
      ).rejects.toThrow();
      expect(mockedRepo.repoCreateTeamBooking).not.toHaveBeenCalled();
    });

    it("creates team booking when group has enough members", async () => {
      mockedRepo.findUserById.mockResolvedValue({ UserID: 1, Status: "Active" } as any);
      mockedRepo.findCourtByIdForBooking.mockResolvedValue({
        CourtID: 10,
        Status: "Available",
      } as any);
      jest.mocked(countActiveGroupMembers).mockResolvedValue(2);
      mockedRepo.repoCreateTeamBooking.mockResolvedValue({
        BookingID: 300,
        BookingType: "Team",
      } as any);

      const result = await createTeamBooking({
        userId: 1,
        groupId: 3,
        courtId: 10,
        bookingDate: "2999-01-01",
        startTime: "08:00",
        endTime: "10:00",
      });

      expect(result.BookingID).toBe(300);
      expect(mockedRepo.repoCreateTeamBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          groupId: 3,
          courtId: 10,
        })
      );
    });
  });

  describe("cancelBooking", () => {
    it("cancels pending payment booking without refund", async () => {
      mockedRepo.findBookingWithPaymentById.mockResolvedValue({
        BookingID: 1,
        BookingCode: "BK001",
        UserID: 1,
        Status: "PendingPayment",
      } as any);

      const result = await cancelBooking({
        bookingId: 1,
        userId: 1,
        userRoles: ["Player"],
      });

      expect(result.status).toBe("Cancelled");
      expect(result.refundAmount).toBe(0);
      expect(mockedRepo.repoCancelBookingById).toHaveBeenCalled();
      expect(requestRefund).not.toHaveBeenCalled();
    });
  });

  describe("mockPayBooking", () => {
    it("rejects payment when booking does not belong to user", async () => {
      mockedRepo.findBookingById.mockResolvedValue({
        BookingID: 1,
        UserID: 99,
        Status: "PendingPayment",
      } as any);

      await expect(mockPayBooking(1, 1, "VNPay")).rejects.toThrow(
        "Ban khong co quyen thanh toan booking nay"
      );
      expect(mockedRepo.repoMockPayBooking).not.toHaveBeenCalled();
    });
  });
});
