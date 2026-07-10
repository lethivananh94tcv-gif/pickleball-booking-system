import * as courtRepo from "../courts.repository";
import {
  createCourtSlot,
  generateCourtSlots,
  getAvailableCourts,
  getCourtById,
  updateCourtSlotStatus,
} from "../courts.service";

jest.mock("../courts.repository", () => ({
  findAllCourts: jest.fn(),
  findCourtById: jest.fn(),
  findAvailableCourts: jest.fn(),
  findCourtSlots: jest.fn(),
  createCourtSlot: jest.fn(),
  updateCourtSlotPrice: jest.fn(),
  findCourtSlotById: jest.fn(),
  updateCourtSlotStatus: jest.fn(),
  createCourtSlotsMany: jest.fn(),
}));

jest.mock("../../../utils/upload", () => ({
  validateAndSaveCourtFile: jest.fn(),
  deleteFile: jest.fn(),
}));

const mockedRepo = jest.mocked(courtRepo);

describe("courts.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCourtById", () => {
    it("returns court when court exists", async () => {
      mockedRepo.findCourtById.mockResolvedValue({
        CourtID: 1,
        CourtName: "Court A",
      } as any);

      const result = await getCourtById(1);

      expect(result.CourtID).toBe(1);
    });

    it("throws when court does not exist", async () => {
      mockedRepo.findCourtById.mockResolvedValue(null as any);

      await expect(getCourtById(404)).rejects.toThrow("Court not found");
    });
  });

  describe("getAvailableCourts", () => {
    it("requires both startTime and endTime when filtering by time", async () => {
      await expect(
        getAvailableCourts("2999-01-01", "08:00", "")
      ).rejects.toThrow("startTime");
      expect(mockedRepo.findAvailableCourts).not.toHaveBeenCalled();
    });

    it("delegates valid availability search to repository", async () => {
      mockedRepo.findAvailableCourts.mockResolvedValue([
        { CourtID: 1, CourtName: "Court A" },
      ] as any);

      const result = await getAvailableCourts("2999-01-01", "08:00", "09:00");

      expect(result).toHaveLength(1);
      expect(mockedRepo.findAvailableCourts).toHaveBeenCalledWith(
        "2999-01-01",
        "08:00",
        "09:00"
      );
    });
  });

  describe("createCourtSlot", () => {
    it("creates a new slot when there is no duplicate", async () => {
      mockedRepo.findCourtById.mockResolvedValue({
        CourtID: 1,
        Status: "Available",
      } as any);
      mockedRepo.findCourtSlots.mockResolvedValue(Object.assign([], { columns: {}, toTable: jest.fn() }));
      mockedRepo.createCourtSlot.mockResolvedValue({
        SlotID: 10,
        Status: "Available",
      } as any);

      const result = await createCourtSlot({
        courtId: 1,
        slotDate: "2999-01-01",
        startTime: "08:00",
        endTime: "09:00",
        price: 150000,
      });

      expect(result.SlotID).toBe(10);
      expect(mockedRepo.createCourtSlot).toHaveBeenCalled();
    });

    it("updates price when same available slot already exists", async () => {
      mockedRepo.findCourtById.mockResolvedValue({
        CourtID: 1,
        Status: "Available",
      } as any);
      mockedRepo.findCourtSlots.mockResolvedValue([
        {
          SlotID: 10,
          StartTime: "08:00:00",
          EndTime: "09:00:00",
          Status: "Available",
        },
      ] as any);
      mockedRepo.updateCourtSlotPrice.mockResolvedValue({
        SlotID: 10,
        Price: 180000,
      } as any);

      const result = await createCourtSlot({
        courtId: 1,
        slotDate: "2999-01-01",
        startTime: "08:00",
        endTime: "09:00",
        price: 180000,
      });

      expect(result.Price).toBe(180000);
      expect(mockedRepo.createCourtSlot).not.toHaveBeenCalled();
      expect(mockedRepo.updateCourtSlotPrice).toHaveBeenCalledWith(10, 180000);
    });

    it("rejects duplicate slot that is booked or holding", async () => {
      mockedRepo.findCourtById.mockResolvedValue({
        CourtID: 1,
        Status: "Available",
      } as any);
      mockedRepo.findCourtSlots.mockResolvedValue([
        {
          SlotID: 10,
          StartTime: "08:00:00",
          EndTime: "09:00:00",
          Status: "Booked",
        },
      ] as any);

      await expect(
        createCourtSlot({
          courtId: 1,
          slotDate: "2999-01-01",
          startTime: "08:00",
          endTime: "09:00",
          price: 180000,
        })
      ).rejects.toThrow();
      expect(mockedRepo.updateCourtSlotPrice).not.toHaveBeenCalled();
    });
  });

  describe("updateCourtSlotStatus", () => {
    it("rejects invalid status", async () => {
      await expect(updateCourtSlotStatus(1, "Booked")).rejects.toThrow();
      expect(mockedRepo.findCourtSlotById).not.toHaveBeenCalled();
    });

    it("updates status for manageable future slot", async () => {
      mockedRepo.findCourtSlotById.mockResolvedValue({
        SlotID: 1,
        SlotDate: "2999-01-01",
        Status: "Available",
      } as any);
      mockedRepo.updateCourtSlotStatus.mockResolvedValue({
        SlotID: 1,
        Status: "Maintenance",
      } as any);

      const result = await updateCourtSlotStatus(1, "Maintenance");

      expect(result.Status).toBe("Maintenance");
      expect(mockedRepo.updateCourtSlotStatus).toHaveBeenCalledWith(1, "Maintenance");
    });
  });

  describe("generateCourtSlots", () => {
    it("generates slots from open time to close time and skips overlaps", async () => {
      mockedRepo.findCourtById.mockResolvedValue({
        CourtID: 1,
        Status: "Available",
        OpenTime: "08:00",
        CloseTime: "11:00",
      } as any);
      mockedRepo.findCourtSlots.mockResolvedValue([
        {
          StartTime: "09:00",
          EndTime: "10:00",
          Status: "Available",
        },
      ] as any);
      mockedRepo.createCourtSlotsMany.mockImplementation(async (slots: any[]) => slots.length);

      const result = await generateCourtSlots({
        courtId: 1,
        slotDate: "2999-01-01",
        durationMinutes: 60,
        price: 150000,
      });

      expect(result.total).toBe(3);
      expect(result.created).toBe(2);
      expect(result.skipped).toBe(1);
      expect(mockedRepo.createCourtSlotsMany).toHaveBeenCalledWith([
        expect.objectContaining({ startTime: "08:00", endTime: "09:00" }),
        expect.objectContaining({ startTime: "10:00", endTime: "11:00" }),
      ]);
    });
  });
});
