import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

import { getPool } from "../src/database/connection";

async function deleteTemporaryCoach() {
  const pool = await getPool();
  const transaction = pool.transaction();
  try {
    console.log("Starting deletion of UserID 1152 (Temporary Coach)...");
    await transaction.begin();

    // 1. Get CoachID
    const coachRes = await transaction.request()
      .input("UserID", 1152)
      .query("SELECT CoachID FROM Coaches WHERE UserID = @UserID");
    
    const coachId = coachRes.recordset[0]?.CoachID;
    console.log(`Found CoachID: ${coachId}`);

    if (coachId) {
      // 2. Delete reviews related to coach
      await transaction.request()
        .input("CoachID", coachId)
        .query("DELETE FROM Reviews WHERE CoachID = @CoachID");
      console.log("Deleted Reviews.");

      // 3. Delete coach income records
      await transaction.request()
        .input("CoachID", coachId)
        .query("DELETE FROM CoachIncome WHERE CoachID = @CoachID");
      console.log("Deleted CoachIncome.");

      // 4. Find bookings associated with this coach
      const bookingsRes = await transaction.request()
        .input("CoachID", coachId)
        .query("SELECT BookingID FROM BookingDetails WHERE CoachID = @CoachID");
      const bookingIds = bookingsRes.recordset.map((b: any) => b.BookingID);
      console.log(`Found booking IDs associated: ${bookingIds.join(", ")}`);

      if (bookingIds.length > 0) {
        // Delete related reviews for these bookings
        await transaction.request()
          .query(`DELETE FROM Reviews WHERE BookingID IN (${bookingIds.join(",")})`);
        
        // Delete related payments for these bookings
        await transaction.request()
          .query(`DELETE FROM Payments WHERE BookingID IN (${bookingIds.join(",")})`);

        // Delete booking details
        await transaction.request()
          .query(`DELETE FROM BookingDetails WHERE BookingID IN (${bookingIds.join(",")})`);

        // Delete main bookings
        await transaction.request()
          .query(`DELETE FROM Bookings WHERE BookingID IN (${bookingIds.join(",")})`);
        console.log("Deleted associated Bookings and details.");
      }

      // 5. Delete coach schedules
      await transaction.request()
        .input("CoachID", coachId)
        .query("DELETE FROM CoachSchedules WHERE CoachID = @CoachID");
      console.log("Deleted CoachSchedules.");

      // 6. Delete coach profile
      await transaction.request()
        .input("CoachID", coachId)
        .query("DELETE FROM Coaches WHERE CoachID = @CoachID");
      console.log("Deleted Coaches record.");
    }

    // 7. Clear UserID 1152 references in other tables
    await transaction.request().input("UserID", 1152).query("DELETE FROM Notifications WHERE UserID = @UserID");
    console.log("Deleted Notifications.");

    await transaction.request().input("UserID", 1152).query("DELETE FROM MatchingSuggestions WHERE UserID = @UserID OR SuggestedUserID = @UserID");
    console.log("Deleted MatchingSuggestions.");

    await transaction.request().input("UserID", 1152).query("DELETE FROM AIRecommendations WHERE UserID = @UserID");
    console.log("Deleted AIRecommendations.");

    await transaction.request().input("UserID", 1152).query("DELETE FROM PlayInvitations WHERE SenderID = @UserID OR ReceiverID = @UserID");
    console.log("Deleted PlayInvitations.");

    await transaction.request().input("UserID", 1152).query("UPDATE AuditLogs SET UserID = NULL WHERE UserID = @UserID");
    console.log("Cleared UserID references in AuditLogs.");

    await transaction.request().input("UserID", 1152).query("DELETE FROM PlayerProfiles WHERE UserID = @UserID");
    console.log("Deleted PlayerProfiles.");

    // 8. Delete from UserRoles
    await transaction.request()
      .input("UserID", 1152)
      .query("DELETE FROM UserRoles WHERE UserID = @UserID");
    console.log("Deleted UserRoles.");

    // 9. Delete from Users
    await transaction.request()
      .input("UserID", 1152)
      .query("DELETE FROM Users WHERE UserID = @UserID");
    console.log("Deleted Users record.");

    await transaction.commit();
    console.log("Successfully deleted Temporary Coach.");

  } catch (err) {
    console.error("Error during deletion, rolling back:", err);
    await transaction.rollback();
  } finally {
    process.exit(0);
  }
}

deleteTemporaryCoach();
