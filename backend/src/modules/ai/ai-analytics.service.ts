import * as aiRepo from "./ai-analytics.repository";
import { getPool, sql } from "@/database/connection";

const AI_SERVICE_BASE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
const AI_SERVICE_SECRET_KEY = process.env.AI_SERVICE_SECRET_KEY || "pcs_ai_secret_key_default";

/**
 * Helper to call the Python AI Service.
 */
async function callAIService(endpoint: string, payload: any): Promise<any> {
  const url = `${AI_SERVICE_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-API-Key": AI_SERVICE_SECRET_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Service request to ${endpoint} failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Retrain the Python AI model using all valid historical bookings.
 */
export async function retrainAIModel(): Promise<any> {
  const startTime = Date.now();
  const bookings = await aiRepo.getHistoricalBookings();

  try {
    const result = await callAIService("/api/ai/forecast/train", { bookings });
    const latency = Date.now() - startTime;
    
    // Log success
    await aiRepo.logAIRequest(
      "train",
      latency,
      JSON.stringify({ bookingsCount: bookings.length }),
      JSON.stringify(result)
    );

    return result;
  } catch (error: any) {
    const latency = Date.now() - startTime;
    await aiRepo.logAIRequest(
      "train_failed",
      latency,
      JSON.stringify({ bookingsCount: bookings.length }),
      JSON.stringify({ error: error.message })
    );
    throw error;
  }
}

/**
 * Generate predictions and recommendations for a target date and save to DB.
 */
export async function generateForecastsAndPromotions(
  targetDate: string,
  thresholdOccupancy: number = 50.0,
  basePrice: number = 200000.0
): Promise<any> {
  const startTime = Date.now();
  const courtIds = await aiRepo.getAllCourtIds();
  const historicalBookings = await aiRepo.getHistoricalBookings();

  if (courtIds.length === 0) {
    throw new Error("No active courts found for forecasting.");
  }

  try {
    // 1. Fetch occupancy predictions
    const predResult = await callAIService("/api/ai/forecast/predict", {
      courtIds,
      targetDate,
      historicalBookings,
    });

    const predictions = predResult.predictions || [];
    const modelVersion = predResult.modelVersion || "model_v_latest";

    // Format and save forecasts
    const forecastsToSave = predictions.map((p: any) => ({
      CourtID: p.CourtID,
      ForecastDate: targetDate,
      HourStart: p.HourStart,
      PredictedRate: p.PredictedRate,
      ModelVersion: modelVersion,
    }));
    await aiRepo.saveOccupancyForecasts(forecastsToSave);

    // 2. Fetch promotion recommendations
    const promoResult = await callAIService("/api/ai/forecast/recommend-promotions", {
      courtIds,
      targetDate,
      historicalBookings,
      thresholdOccupancy,
      basePrice,
    });

    const recommendations = promoResult.recommendations || [];

    // Format and save promotion suggestions
    const recsToSave = recommendations.map((r: any) => ({
      TargetDate: targetDate,
      TargetHourRange: r.targetHourRange,
      SuggestedDiscount: r.suggestedDiscount,
      Reasoning: r.reasoning,
      MarketingMessage: r.marketingMessage,
    }));
    await aiRepo.savePromotionRecommendations(recsToSave, targetDate);

    const latency = Date.now() - startTime;
    await aiRepo.logAIRequest(
      "generate_analytics",
      latency,
      JSON.stringify({ targetDate, thresholdOccupancy, basePrice }),
      JSON.stringify({ forecastsSavedCount: forecastsToSave.length, recsSavedCount: recsToSave.length })
    );

    return {
      forecastsSaved: forecastsToSave.length,
      recommendationsSaved: recsToSave.length,
      modelVersion,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    await aiRepo.logAIRequest(
      "generate_analytics_failed",
      latency,
      JSON.stringify({ targetDate, thresholdOccupancy, basePrice }),
      JSON.stringify({ error: error.message })
    );
    throw error;
  }
}

/**
 * Evaluate prediction accuracy against actual booking records for past days.
 */
export async function auditForecastAccuracy(): Promise<any> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const maxDateStr = yesterday.toISOString().split("T")[0];

  const unevaluated = await aiRepo.getUnevaluatedForecasts(maxDateStr);
  let evaluatedCount = 0;
  let totalError = 0;

  for (const f of unevaluated) {
    // Check actual occupancy (100% if booked, 0% if empty)
    const actualRate = await aiRepo.checkActualSlotOccupied(f.CourtID, f.ForecastDate, f.HourStart);
    const forecastError = Math.abs(actualRate - f.PredictedRate);

    // Save evaluation to model logs
    await aiRepo.logAIRequest(
      `evaluation_${f.ForecastID}`,
      0, // internal action
      JSON.stringify({ ForecastID: f.ForecastID, CourtID: f.CourtID, Date: f.ForecastDate, PredictedRate: f.PredictedRate }),
      JSON.stringify({ ActualRate: actualRate, Error: forecastError }),
      actualRate,
      forecastError
    );

    totalError += forecastError;
    evaluatedCount++;
  }

  const averageError = evaluatedCount > 0 ? totalError / evaluatedCount : 0;
  return {
    evaluatedCount,
    averageError: parseFloat(averageError.toFixed(2)),
  };
}

// Global variable tracking last execution timestamp for cron rate limiting
let lastCronRunTimestamp = Date.now();

/**
 * Cron Job executed via server main interval loop.
 * Performs retraining, generates forecasts for the next 7 days, and runs accuracy audits.
 */
export async function runAICronJob(force: boolean = false): Promise<void> {
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Enforce 24 hour interval unless forced
  if (!force && now - lastCronRunTimestamp < TWENTY_FOUR_HOURS) {
    return;
  }
  
  lastCronRunTimestamp = now;
  console.log("[AI Cron] Starting AI automated retraining and analytics updates...");

  try {
    // 1. Model Retraining
    await retrainAIModel();
    console.log("[AI Cron] Model successfully retrained.");

    // 2. Generate predictions and promotions for the next 7 days
    for (let i = 0; i <= 7; i++) {
      const target = new Date();
      target.setDate(target.getDate() + i);
      const targetStr = target.toISOString().split("T")[0];
      await generateForecastsAndPromotions(targetStr);
    }
    console.log("[AI Cron] Forecasts and recommendations generated for next 7 days.");

    // 3. Run audit against yesterday's results
    const auditRes = await auditForecastAccuracy();
    console.log(`[AI Cron] Forecast audit completed. Evaluated slots: ${auditRes.evaluatedCount}, Avg Error: ${auditRes.averageError}%`);
  } catch (error: any) {
    console.error("[AI Cron] Error running automated AI cron task:", error.message);
  }
}

/**
 * Fetch accuracy performance stats over time.
 */
export async function getAccuracyMetricsSummary(): Promise<any> {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT 
      CONVERT(VARCHAR(10), CreatedAt, 120) AS EvaluationDate,
      AVG(LatencyMs) AS AvgLatency,
      COUNT(*) AS TotalSlotsAudited,
      AVG(ActualRate) AS AvgActualOccupancy,
      AVG(ForecastError) AS MeanAbsoluteError
    FROM AIModelLogs
    WHERE RequestType LIKE 'evaluation_%'
    GROUP BY CONVERT(VARCHAR(10), CreatedAt, 120)
    ORDER BY EvaluationDate DESC
  `);
  
  return result.recordset;
}

/**
 * Automatically activates scheduled (Inactive) promotions when their StartDate is reached,
 * and expires them when EndDate is exceeded.
 */
export async function runPromotionsStatusScheduler(): Promise<void> {
  const pool = await getPool();
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const todayStr = today.toISOString().split("T")[0];

  // 1. Activate scheduled promotions
  const activateRes = await pool.request()
    .input("Today", sql.Date, todayStr)
    .query(`
      UPDATE Promotions
      SET Status = 'Active'
      WHERE Status = 'Inactive' AND StartDate <= @Today AND TargetDate IS NOT NULL
    `);

  // 2. Expire old active promotions
  const expireRes = await pool.request()
    .input("Today", sql.Date, todayStr)
    .query(`
      UPDATE Promotions
      SET Status = 'Expired'
      WHERE Status = 'Active' AND EndDate < @Today AND TargetDate IS NOT NULL
    `);

  if (activateRes.rowsAffected[0] > 0 || expireRes.rowsAffected[0] > 0) {
    console.log(`[AI Promotion Scheduler] Activated: ${activateRes.rowsAffected[0]} vouchers, Expired: ${expireRes.rowsAffected[0]} vouchers.`);
  }
}
