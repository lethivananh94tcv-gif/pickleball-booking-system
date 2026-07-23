import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/database/connection";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const resolvedParams = await params;
    const teamId = parseInt(resolvedParams.teamId, 10);
    if (isNaN(teamId)) {
      return NextResponse.json({ error: "TeamID không hợp lệ" }, { status: 400 });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input("TeamID", sql.Int, teamId)
      .query(`
        SELECT 
          a.AthleteID,
          a.FullName,
          a.Rating,
          a.Province,
          a.Gender,
          a.PhotoURL
        FROM TournamentRegistrations r
        INNER JOIN TournamentRegistrationAthletes a ON r.RegistrationID = a.RegistrationID
        WHERE r.TeamID = @TeamID AND r.RegistrationStatus IN ('Confirmed', 'Paid')
      `);
      
    return NextResponse.json(result.recordset);
  } catch (err: any) {
    console.error("Error fetching team members:", err);
    return NextResponse.json({ error: err.message || "Lỗi server" }, { status: 500 });
  }
}
