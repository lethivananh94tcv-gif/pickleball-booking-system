import os
import json
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.services.forecast_service import ForecastModelManager
from app.services.decision_engine import AIDecisionEngine
from app.services.llm_client_manager import API_KEYS, generate_content_with_retry

router = APIRouter()

# Simple inter-service authentication
API_KEY_HEADER = Header(None, alias="X-Internal-API-Key")

def verify_api_key(x_internal_api_key: Optional[str] = API_KEY_HEADER):
    secret_key = os.getenv("AI_SERVICE_SECRET_KEY", "pcs_ai_secret_key_default")
    if x_internal_api_key != secret_key:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid internal API key")
    return x_internal_api_key

# Request / Response Schemas
class TrainRequest(BaseModel):
    bookings: List[Dict[str, Any]]

class PredictRequest(BaseModel):
    courtIds: List[int]
    targetDate: str
    historicalBookings: List[Dict[str, Any]]

class RecommendRequest(BaseModel):
    courtIds: List[int]
    targetDate: str
    historicalBookings: List[Dict[str, Any]]
    thresholdOccupancy: Optional[float] = 50.0
    basePrice: Optional[float] = 200000.0

@router.post("/forecast/train", dependencies=[Depends(verify_api_key)])
async def train_forecast_model(request: TrainRequest):
    try:
        result = ForecastModelManager.train_model(request.bookings)
        if result["status"] == "failed":
            raise HTTPException(status_code=400, detail=result["reason"])
        return result
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/forecast/predict", dependencies=[Depends(verify_api_key)])
async def predict_occupancy(request: PredictRequest):
    try:
        predictions = ForecastModelManager.predict_occupancy(
            court_ids=request.courtIds,
            target_date_str=request.targetDate,
            historical_bookings=request.historicalBookings
        )
        return {"predictions": predictions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/forecast/recommend-promotions", dependencies=[Depends(verify_api_key)])
async def recommend_promotions(request: RecommendRequest):
    try:
        print("FastAPI received thresholdOccupancy:", request.thresholdOccupancy)
        # Step 1: Predict occupancy
        predictions = ForecastModelManager.predict_occupancy(
            court_ids=request.courtIds,
            target_date_str=request.targetDate,
            historical_bookings=request.historicalBookings
        )
        
        # Step 2: Pass predictions to central Decision Engine
        raw_recommendations = AIDecisionEngine.optimize_promotions(
            predictions=predictions,
            # pyrefly: ignore [bad-argument-type]
            threshold_occupancy=request.thresholdOccupancy,
            # pyrefly: ignore [bad-argument-type]
            base_price=request.basePrice
        )
        
        # Step 3: Enhance recommendations with Gemini LLM
        final_recommendations = []
        for rec in raw_recommendations:
            hour = rec["HourStart"]
            discount = rec["SuggestedDiscount"]
            pred_rate = rec["PredictedRate"]
            expected_rate = rec["ExpectedOccupancyAfterPromo"]
            improvement = rec["ExpectedRevenueImprovement"]
            
            reasoning = f"Dự báo tỉ lệ lấp đầy khung giờ {hour}h:00 chỉ đạt {pred_rate}%. Đề xuất giảm giá {discount}% để tăng tỉ lệ lấp đầy lên {expected_rate}%."
            marketing_msg = f"🔥 Khuyến mãi đặt sân đặc biệt lúc {hour}h ngày {request.targetDate}: Giảm ngay {discount}%! Số lượng có hạn, đặt sân ngay!"
            
            # Call Gemini to refine marketing content if api key is configured
            if API_KEYS:
                try:
                    prompt = f"""
Bạn là chuyên gia marketing và tối ưu doanh thu cho câu lạc bộ Pickleball "Pickle Club".
Hệ thống AI của chúng tôi vừa phân tích và đưa ra dự báo:
- Ngày: {request.targetDate}
- Khung giờ: {hour}:00
- Tỷ lệ lấp đầy dự báo hiện tại: {pred_rate}%
- Ngưỡng tối thiểu mong muốn: {request.thresholdOccupancy}%
- Mức giảm giá đề xuất tối ưu: {discount}%
- Tỷ lệ lấp đầy kỳ vọng sau khi áp dụng: {expected_rate}%

Hãy viết 2 nội dung bằng tiếng Việt:
1. Lý do đề xuất (reasoning): Hãy giải thích ngắn gọn, thuyết phục cho ban quản trị câu lạc bộ (Admin) hiểu tại sao nên áp dụng mức giảm giá {discount}% cho khung giờ {hour}h vào ngày {request.targetDate}. Tập trung vào lợi ích kinh doanh, tối ưu hóa công suất sân và thu hút khách hàng.
2. Tin nhắn quảng cáo (marketingMessage): Viết một đoạn tin nhắn quảng cáo cực kỳ thu hút, hấp dẫn kèm emoji để gửi đến người chơi qua SMS/Zalo nhằm kích cầu họ đặt sân vào khung giờ {hour}h ngày {request.targetDate}.

Định dạng trả về DUY NHẤT là một đối tượng JSON hợp lệ dạng:
{{
  "reasoning": "...",
  "marketingMessage": "..."
}}
Lưu ý: Không bao gồm markdown code block (không có ```json ... ```), chỉ có chuỗi JSON nguyên bản.
"""
                    response = generate_content_with_retry(prompt, request_options={"timeout": 5.0})
                    clean_text = response.text.strip()
                    # Strip markdown markers if model included them anyway
                    if clean_text.startswith("```"):
                        lines = clean_text.split("\n")
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines[-1].startswith("```"):
                            lines = lines[:-1]
                        clean_text = "\n".join(lines).strip()
                        
                    data = json.loads(clean_text)
                    reasoning = data.get("reasoning", reasoning)
                    marketing_msg = data.get("marketingMessage", marketing_msg)
                except Exception as e:
                    print(f"Gemini generation error: {e}")
                    
            final_recommendations.append({
                "targetDate": request.targetDate,
                "targetHourRange": f"{hour:02d}:00-{(hour+1):02d}:00",
                "predictedRate": pred_rate,
                "suggestedDiscount": discount,
                "expectedOccupancyAfterPromo": expected_rate,
                "expectedRevenueImprovement": improvement,
                "reasoning": reasoning,
                "marketingMessage": marketing_msg
            })
            
        return {
            "targetDate": request.targetDate,
            "thresholdOccupancy": request.thresholdOccupancy,
            "recommendations": final_recommendations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
