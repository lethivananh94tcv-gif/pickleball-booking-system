import { getPool } from "@/database/connection";
import { findBookingsByCoachUserId } from "../bookings.repository";

jest.mock("@/database/connection", () => ({
  getPool: jest.fn(),
  sql: {
    Int: "Int",
  },
}));

const mockedGetPool = getPool as jest.Mock;

function mockQuery(recordset: any[]) {
  const query = jest.fn().mockResolvedValue({ recordset });
  const input = jest.fn().mockReturnValue({ query });
  const request = jest.fn().mockReturnValue({ input });

  mockedGetPool.mockResolvedValue({ request });

  return { input, query, request };
}

function lastQueryText(query: jest.Mock) {
  return String(query.mock.calls[0][0]);
}

describe("bookings.repository.findBookingsByCoachUserId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps coach-only bookings when CourtID is NULL", async () => {
    const row = {
      BookingID: 101,
      BookingCode: "BK-101",
      CourtID: null,
      CourtName: null,
      Location: null,
      CoachScheduleID: 501,
      StartTime: "08:00",
      EndTime: "09:00",
      Status: "Confirmed",
    };
    const { query } = mockQuery([row]);

    const result = await findBookingsByCoachUserId(7);
    const sqlText = lastQueryText(query);

    expect(result).toEqual([row]);
    expect(sqlText).toContain("LEFT JOIN Courts c ON bd.CourtID = c.CourtID");
    expect(sqlText).toMatch(/OUTER APPLY\s*\([\s\S]*SELECT TOP 1[\s\S]*LEFT JOIN Courts c ON bd\.CourtID = c\.CourtID[\s\S]*ORDER BY bd\.StartTime ASC[\s\S]*\) mainDetail/);
  });

  it("returns court metadata for combo bookings without duplicating the booking row", async () => {
    const row = {
      BookingID: 202,
      BookingCode: "CB-202",
      CourtID: 3,
      CourtName: "Court 3",
      Location: "Main Hall",
      CoachScheduleID: 601,
      StartTime: "09:00",
      EndTime: "11:00",
      Status: "PendingPayment",
    };
    const { query } = mockQuery([row]);

    const result = await findBookingsByCoachUserId(8);
    const sqlText = lastQueryText(query);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      BookingID: 202,
      CourtID: 3,
      CourtName: "Court 3",
      Location: "Main Hall",
    });
    expect(sqlText).toContain("SELECT TOP 1");
    expect(sqlText).toContain("ORDER BY bd.StartTime ASC");
  });

  it("keeps the fields used by coach schedule buffer validation", async () => {
    const row = {
      BookingID: 303,
      CoachScheduleID: 701,
      BookingDate: "2030-01-01",
      StartTime: "10:00",
      EndTime: "12:00",
      Status: "Paid",
    };
    mockQuery([row]);

    const result = await findBookingsByCoachUserId(9);

    expect(result[0]).toMatchObject({
      BookingID: 303,
      CoachScheduleID: 701,
      StartTime: "10:00",
      EndTime: "12:00",
      Status: "Paid",
    });
  });
});
