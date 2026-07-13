import os
import json
from google import genai
from google.genai import types
from pathlib import Path
from dotenv import load_dotenv
from app.models.coach_models import CoachRecommendRequest, CoachRecommendResponse, LLMCoachResponse, CoachScoreResult, CoachIntent

# Load dotenv từ đường dẫn đúng
dotenv_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(dotenv_path=dotenv_path)

# Khởi tạo model Gemini nếu có key
API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-2.5-flash")
client = None
if API_KEY:
    try:
        client = genai.Client(api_key=API_KEY)
    except Exception as e:
        print(f"Error configuring Gemini for Coach Scoring: {e}")

SYSTEM_PROMPT = """Bạn là chuyên gia phân tích NLP của hệ thống Pickle Club.
Nhiệm vụ của bạn là nhận thông tin mong muốn của học viên (styleText) và danh sách các Huấn luyện viên ứng viên.
1. Phân tích styleText thành parsedIntent (mục tiêu, phong cách dạy, tránh...).
2. Với mỗi Coach trong danh sách, hãy đọc phần description và teachingStyle của họ, so sánh với parsedIntent.
3. Chấm một điểm semanticScore (0-100) thể hiện độ phù hợp về mặt ngữ nghĩa và phong cách.
4. Viết 2-3 lý do ngắn gọn (tiếng Việt) vì sao phù hợp.
Trọng tâm: CHỈ chấm semanticScore dựa trên văn bản mô tả phong cách và mục tiêu, không quan tâm đến giá hay lịch rảnh vì hệ thống đã tự tính riêng."""

async def analyze_and_score_coaches(request: CoachRecommendRequest) -> CoachRecommendResponse:
    # Gộp goals vào style_text nếu styleText trống để AI hoạt động
    style_text = request.styleText.strip()
    if not style_text and request.goals:
        style_text = ", ".join(request.goals)

    # Nếu không có styleText (không có yêu cầu phân tích phong cách), chạy fallback bình thường
    if not style_text:
        return handle_fallback(request, reason="No styleText provided for analysis")

    # Nếu chưa cấu hình model hoặc API key, trả về fallback thay vì crash
    if not API_KEY or not client:
        return handle_fallback(request, reason="GEMINI_API_KEY missing or model not initialized")

    # 2. Xây dựng prompt chứa danh sách ứng viên
    candidates_text = ""
    for c in request.candidates:
        candidates_text += f"- Coach ID {c.coachId}: {c.name}. Mô tả: {c.description}. Phong cách: {c.teachingStyle}. Chuyên môn: {c.expertise}.\n"

    user_prompt = f"""
    Yêu cầu của người dùng: '{style_text}'
    Các filter cứng hiện có: Level={request.level}, Mục tiêu={request.goals}

    Danh sách Coach:
    {candidates_text}
    """

    try:
        # Gọi LLM sử dụng Structured Output
        response = await client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=f"{SYSTEM_PROMPT}\n\n{user_prompt}",
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=LLMCoachResponse
            )
        )
        
        llm_result = json.loads(response.text)
        llm_response = LLMCoachResponse(**llm_result)

        # 3. Tính toán finalScore
        results = []
        eval_dict = {ev.coachId: ev for ev in llm_response.evaluations}

        for candidate in request.candidates:
            evaluation = eval_dict.get(candidate.coachId)
            if evaluation:
                semantic_score = evaluation.semanticScore
                reasons = evaluation.reasons
            else:
                semantic_score = 50.0 # Mặc định nếu LLM bỏ sót
                reasons = ["Phù hợp cơ bản với yêu cầu"]

            # Công thức tính final Match Score
            final_score = (
                0.45 * candidate.structuredScore +
                0.30 * semantic_score +
                0.15 * candidate.availabilityScore +
                0.10 * candidate.trustScore
            )

            # Xác định confidence
            confidence = "High" if final_score >= 80 else ("Medium" if final_score >= 60 else "Low")

            results.append(CoachScoreResult(
                coachId=candidate.coachId,
                matchScore=round(final_score, 1),
                score=round(final_score, 1),
                semanticScore=round(semantic_score, 1),
                confidence=confidence,
                reasons=reasons
            ))

        # Sắp xếp theo matchScore giảm dần
        results.sort(key=lambda x: x.matchScore, reverse=True)

        return CoachRecommendResponse(
            fallback=False,
            parsedIntent=llm_response.parsedIntent,
            results=results
        )

    except Exception as e:
        print(f"Error scoring coaches with LLM: {e}")
        return handle_fallback(request, reason=f"Gemini call failed: {str(e)}")


def handle_fallback(request: CoachRecommendRequest, reason: str = "") -> CoachRecommendResponse:
    results = []
    for candidate in request.candidates:
        semantic_score = 50.0 # Điểm trung bình cho fallback
        final_score = (
            0.45 * candidate.structuredScore +
            0.30 * semantic_score +
            0.15 * candidate.availabilityScore +
            0.10 * candidate.trustScore
        )
        results.append(CoachScoreResult(
            coachId=candidate.coachId,
            matchScore=round(final_score, 1),
            score=round(final_score, 1),
            semanticScore=semantic_score,
            confidence="Medium" if final_score >= 60 else "Low",
            reasons=["Phù hợp với các tiêu chí tìm kiếm cơ bản"]
        ))
    
    results.sort(key=lambda x: x.matchScore, reverse=True)

    return CoachRecommendResponse(
        fallback=True,
        fallbackReason=reason,
        parsedIntent=CoachIntent(
            level="",
            goals=[],
            teachingStyle=[],
            preferredTime=[],
            avoid=[],
            competitiveLevel=""
        ),
        results=results
    )
