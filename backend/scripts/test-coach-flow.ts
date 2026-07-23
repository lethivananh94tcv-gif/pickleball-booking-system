import { getPool } from "../src/database/connection";
import {
  getMyCoachProfile,
  updateMyProfile,
  updateMyExpertise,
  updateMyFee,
  createMySchedule,
  getMySchedules,
  getScheduleOptions,
  getMyIncome
} from "../src/modules/coaches/coaches.service";

async function runCoachFlowTest() {
  console.log("=== STARTING COACH FLOW TEST ===");
  try {
    const pool = await getPool();
    const userId = 1152; // Our created temp.coach@gmail.com

    // 1. Get profile
    console.log("\n1. Testing getMyCoachProfile...");
    const profile = await getMyCoachProfile(userId);
    console.log("SUCCESS. Profile:", {
      CoachID: profile.CoachID,
      FullName: profile.FullName,
      Status: profile.Status,
      SkillLevel: profile.SkillLevel,
      HourlyRate: profile.HourlyRate
    });

    // 2. Update profile
    console.log("\n2. Testing updateMyProfile...");
    const updatedProfile = await updateMyProfile(userId, {
      biography: "This is a tested biography for coach.",
      specialization: "Singles and Doubles Expert",
      experienceYears: 6
    });
    console.log("SUCCESS. Profile updated:", updatedProfile);

    // 3. Update expertise
    console.log("\n3. Testing updateMyExpertise...");
    const updatedExpertise = await updateMyExpertise(userId, {
      skillLevel: "Professional",
      specialization: "Advanced Tactics and Spin Serve",
      experienceYears: 7
    });
    console.log("SUCCESS. Expertise updated:", updatedExpertise);

    // 4. Update teaching fee
    console.log("\n4. Testing updateMyFee...");
    const updatedFee = await updateMyFee(userId, {
      hourlyRate: 350000
    });
    console.log("SUCCESS. Fee updated:", updatedFee);

    // 5. Create schedule slot
    // Let's create a future slot (e.g. next Monday)
    console.log("\n5. Testing createMySchedule...");
    const workingDate = "2026-07-20";
    // Check if slot exists already to avoid duplication errors
    const schedulesBefore = await getMySchedules(userId);
    const hasExistingSlot = schedulesBefore.some(s => s.WorkingDate.startsWith(workingDate) && s.StartTime === "09:00");
    
    if (hasExistingSlot) {
      console.log(`Slot at ${workingDate} 09:00-10:00 already exists, skipping creation.`);
    } else {
      const scheduleResult = await createMySchedule(userId, {
        workingDate,
        startTime: "09:00",
        endTime: "10:00"
      });
      console.log("SUCCESS. Created schedules count:", scheduleResult);
    }

    // 6. Get schedules
    console.log("\n6. Testing getMySchedules...");
    const schedules = await getMySchedules(userId);
    console.log("SUCCESS. Total active schedules found:", schedules.length);
    if (schedules.length > 0) {
      console.log("First schedule slot:", {
        CoachScheduleID: schedules[0].CoachScheduleID,
        WorkingDate: schedules[0].WorkingDate,
        StartTime: schedules[0].StartTime,
        EndTime: schedules[0].EndTime,
        Status: schedules[0].Status
      });
    }

    // 7. Get schedule options
    console.log("\n7. Testing getScheduleOptions...");
    const options = await getScheduleOptions(userId, workingDate);
    console.log("SUCCESS. Schedule options for date", workingDate, ":", {
      date: options.date,
      startTimesCount: options.startTimes.length,
      occupiedHours: options.occupiedHours
    });

    // 8. Get income
    console.log("\n8. Testing getMyIncome...");
    const income = await getMyIncome(userId);
    console.log("SUCCESS. Income summary:", income.summary);

    console.log("\n=== COACH FLOW TEST COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("\n❌ COACH FLOW TEST FAILED:", error);
  }
  process.exit(0);
}

runCoachFlowTest();
