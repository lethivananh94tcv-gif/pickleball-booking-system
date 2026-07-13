import os
import json
from google import genai
from google.genai import types
from app.models.player_models import (
    PlayerProfileData,
    TeammateMatchRequest,
    TeammateMatchResponse,
    TeammateMatchResult,
    LLMTeammateResponse,
    OpponentMatchRequest,
    OpponentMatchResponse,
    OpponentMatchResult,
    OpponentTeamData,
    LLMOpponentResponse
)

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-2.5-flash")

print(f"GEMINI_API_KEY exists: {bool(API_KEY)}")
print(f"MODEL_NAME: {MODEL_NAME}")

client = None
if API_KEY:
    try:
        client = genai.Client(api_key=API_KEY)
    except Exception as e:
        print(f"Error configuring Gemini for Player Scoring: {e}")


def get_keyword_overlap_score_py(styleA: str, goalA: str, styleB: str, goalB: str) -> float:
    textA = f"{styleA} {goalA}".lower().strip()
    textB = f"{styleB} {goalB}".lower().strip()

    if not styleA.strip() and not goalA.strip() and not styleB.strip() and not goalB.strip():
        return 40.0
    if not (styleA.strip() or goalA.strip()) or not (styleB.strip() or goalB.strip()):
        return 40.0

    stop_words = {"và", "để", "thích", "tìm", "chơi", "cùng", "nhau", "cơ", "bản", "cho", "của", "với", "trong", "các", "có"}
    
    wordsA = [w.strip() for w in textA.split() if w.strip()]
    wordsA = [w for w in wordsA if len(w) > 1 and w not in stop_words]
    wordsB = [w.strip() for w in textB.split() if w.strip()]
    wordsB = [w for w in wordsB if len(w) > 1 and w not in stop_words]

    setA = set(wordsA)
    match_count = sum(1 for w in wordsB if w in setA)

    if match_count > 0:
        return float(min(100, 50 + match_count * 10))
    return 50.0

async def analyze_and_score_teammates(request: TeammateMatchRequest) -> TeammateMatchResponse:
    has_desc_user = bool(request.user.playStyle.strip()) or bool(request.user.goal.strip())
    has_desc_candidates = any(bool(c.playStyle.strip()) or bool(c.goal.strip()) for c in request.candidates)
    
    if not client or not API_KEY or not (has_desc_user and has_desc_candidates):
        reason = "GEMINI_API_KEY missing" if not API_KEY else ("No playStyle or goal description in profiles" if not (has_desc_user and has_desc_candidates) else "Model not configured")
        print(f"fallbackReason: {reason}")
        return handle_teammate_fallback(request, reason)

    candidates_text = ""
    for c in request.candidates:
        candidates_text += f"- Player ID {c.playerId}: Name: {c.name}. PlayStyle: '{c.playStyle}'. Goal: '{c.goal}'.\n"

    prompt = f"""
Bạn là một chuyên gia ghép cặp cho Pickle Club. Hãy phân tích và so sánh phong cách chơi (Play Style) và mục tiêu (Goal) của User với từng ứng viên (Candidates) để đánh giá độ tương hợp ngữ nghĩa.

User Profile:
- Name: {request.user.name}
- PlayStyle: '{request.user.playStyle}'
- Goal: '{request.user.goal}'

Candidates:
{candidates_text}

Nhiệm vụ:
1. So sánh chi tiết PlayStyle và Goal của User với từng Candidate.
2. Trả về điểm tương hợp ngữ nghĩa `semanticScore` (0-100) cho từng Candidate. Điểm cao nếu phong cách chơi bổ trợ cho nhau (vd: công bù thủ, một người bám lưới một người cuối sân) hoặc cùng chung mục tiêu tập luyện/thi đấu.
3. Trả về danh sách 2-3 lý do phù hợp bằng tiếng Việt (`reasons`) cho mỗi candidate.
Lưu ý quan trọng: Chỉ đánh giá các ID có trong danh sách candidates ở trên. Không được tự ý thêm hoặc đổi ID.
"""

    print("Gemini call started")
    try:
        response = await client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=LLMTeammateResponse
            )
        )
        print("Gemini call success")
        # pyrefly: ignore [bad-argument-type]
        llm_result = json.loads(response.text)
        llm_response = LLMTeammateResponse(**llm_result)
        eval_dict = {ev.playerId: ev for ev in llm_response.results}
        
        results = []
        for candidate in request.candidates:
            eval_data = eval_dict.get(candidate.playerId)
            if eval_data:
                sem_score = eval_data.semanticScore
                reasons = eval_data.reasons
            else:
                sem_score = 50.0
                reasons = ["Phù hợp với các tiêu chí matching cơ bản"]

            final_score = (
                0.30 * candidate.skillComp +
                0.25 * candidate.roleComp +
                0.20 * candidate.schedOverlap +
                0.10 * candidate.expSim +
                0.15 * sem_score
            )
            
            results.append(TeammateMatchResult(
                # pyrefly: ignore [deprecated]
                player=PlayerProfileData(**candidate.dict()),
                score=round(final_score, 1),
                reasons=reasons
            ))
            
        results.sort(key=lambda x: x.score or 0.0, reverse=True)
        return TeammateMatchResponse(
            success=True,
            fallback=False,
            results=results
        )
    except Exception as e:
        err_msg = str(e)
        print(f"Gemini call failed: {err_msg}")
        print(f"fallbackReason: {err_msg}")
        return handle_teammate_fallback(request, err_msg)

def handle_teammate_fallback(request: TeammateMatchRequest, reason: str) -> TeammateMatchResponse:
    results = []
    for candidate in request.candidates:
        sem_score = get_keyword_overlap_score_py(
            request.user.playStyle,
            request.user.goal,
            candidate.playStyle,
            candidate.goal
        )
        final_score = (
            0.30 * candidate.skillComp +
            0.25 * candidate.roleComp +
            0.20 * candidate.schedOverlap +
            0.10 * candidate.expSim +
            0.15 * sem_score
        )
        
        reasons = []
        if candidate.skillComp >= 75: reasons.append("Trình độ phù hợp dễ phối hợp")
        if candidate.roleComp >= 90: reasons.append("Vai trò thi đấu bổ trợ tốt cho nhau")
        if candidate.schedOverlap >= 75: reasons.append("Có khung giờ rảnh trùng nhau")
        if candidate.expSim >= 75: reasons.append("Số năm kinh nghiệm tương đương")
        
        missing_desc = not request.user.playStyle.strip() or not request.user.goal.strip() or not candidate.playStyle.strip() or not candidate.goal.strip()
        if missing_desc:
            reasons.append("Lưu ý: Dữ liệu mô tả phong cách chơi hoặc mục tiêu còn thiếu")
        elif sem_score >= 70:
            reasons.append("Phong cách chơi và mục tiêu có sự tương hợp tốt")

        if not reasons:
            reasons = ["Phù hợp với các tiêu chí matching cơ bản"]

        results.append(TeammateMatchResult(
            player=PlayerProfileData(**candidate.dict()),
            score=round(final_score, 1),
            reasons=reasons
        ))
        
    results.sort(key=lambda x: x.score or 0.0, reverse=True)
    return TeammateMatchResponse(
        success=True,
        fallback=True,
        fallbackReason=reason,
        results=results
    )

async def analyze_and_score_opponents(request: OpponentMatchRequest) -> OpponentMatchResponse:
    my_style = " ".join([p.playStyle for p in request.myTeam.players])
    my_goal = " ".join([p.goal for p in request.myTeam.players])
    
    has_desc_my = bool(my_style.strip()) or bool(my_goal.strip())
    has_desc_opp = any(
        any(bool(p.playStyle.strip()) or bool(p.goal.strip()) for p in ot.players)
        for ot in request.opponentTeams
    )

    if not client or not API_KEY or not (has_desc_my and has_desc_opp):
        reason = "GEMINI_API_KEY missing" if not API_KEY else ("No playStyle or goal description in profiles" if not (has_desc_my and has_desc_opp) else "Model not configured")
        print(f"fallbackReason: {reason}")
        return handle_opponent_fallback(request, reason)

    opponent_teams_text = ""
    for ot in request.opponentTeams:
        players_desc = ", ".join([f"{p.name} (Lối chơi: '{p.playStyle}', Mục tiêu: '{p.goal}')" for p in ot.players])
        opponent_teams_text += f"- Team ID {ot.opponentTeamId}: {players_desc}\n"

    my_team_desc = ", ".join([f"{p.name} (Lối chơi: '{p.playStyle}', Mục tiêu: '{p.goal}')" for p in request.myTeam.players])

    prompt = f"""
Bạn là một chuyên gia ghép cặp thi đấu Pickleball. Hãy phân tích và so sánh phong cách chơi (Play Style) và mục tiêu (Goal) của Đội Mình (My Team) với từng Đội Đối Thủ (Opponent Teams) để đánh giá độ tương hợp thi đấu (semanticPlayStyleScore).

Đội Mình (My Team):
- {my_team_desc}

Danh sách các Đội Đối Thủ đề xuất:
{opponent_teams_text}

Nhiệm vụ:
1. So sánh phong cách chơi và mục tiêu thi đấu của Đội Mình với từng Đội Đối Thủ.
2. Cho điểm tương hợp ngữ nghĩa `semanticScore` (0-100). Điểm cao nếu lối chơi của hai đội hứa hẹn tạo ra trận đấu cân bằng, kịch tính (ví dụ: cả hai đội đều năng nổ, hoặc một đội kiểm soát gặp một đội tấn công nhanh) và mục tiêu thi đấu tương đồng (ví dụ: cùng muốn cọ xát thi đấu, hoặc cùng giao lưu vui vẻ).
3. Đưa ra 2-3 lý do phù hợp bằng tiếng Việt (`reasons`) cho mỗi đội đối thủ.
Lưu ý: Chỉ chọn các opponentTeamId trong danh sách trên. Không tự ý tạo hoặc sửa đổi ID.
"""

    print("Gemini call started")
    try:
        response = await client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=LLMOpponentResponse
            )
        )
        print("Gemini call success")
        # pyrefly: ignore [bad-argument-type]
        llm_result = json.loads(response.text)
        llm_response = LLMOpponentResponse(**llm_result)
        eval_dict = {ev.opponentTeamId: ev for ev in llm_response.results}

        results = []
        for ot in request.opponentTeams:
            eval_data = eval_dict.get(ot.opponentTeamId)
            if eval_data:
                sem_score = eval_data.semanticScore
                reasons = eval_data.reasons
            else:
                sem_score = 50.0
                reasons = ["Cặp đấu phù hợp theo tiêu chí cơ bản"]

            final_score = (
                0.40 * ot.powerBal +
                0.25 * ot.schedOverlap +
                0.15 * ot.goalComp +
                0.10 * ot.expBal +
                0.10 * sem_score
            )

            results.append(OpponentMatchResult(
                opponentTeam=OpponentTeamData(players=ot.players),
                opponentTeamId=ot.opponentTeamId,
                teamPower=ot.teamPower,
                score=round(final_score, 1),
                reasons=reasons
            ))

        results.sort(key=lambda x: x.score or 0.0, reverse=True)
        return OpponentMatchResponse(
            success=True,
            mode="opponent_team",
            fallback=False,
            myTeam=request.myTeam,
            results=results
        )
    except Exception as e:
        err_msg = str(e)
        print(f"Gemini call failed: {err_msg}")
        print(f"fallbackReason: {err_msg}")
        return handle_opponent_fallback(request, err_msg)

def handle_opponent_fallback(request: OpponentMatchRequest, reason: str) -> OpponentMatchResponse:
    results = []
    my_style = " ".join([p.playStyle for p in request.myTeam.players])
    my_goal = " ".join([p.goal for p in request.myTeam.players])

    for ot in request.opponentTeams:
        opp_style = " ".join([p.playStyle for p in ot.players])
        opp_goal = " ".join([p.goal for p in ot.players])

        sem_score = get_keyword_overlap_score_py(my_style, my_goal, opp_style, opp_goal)
        final_score = (
            0.40 * ot.powerBal +
            0.25 * ot.schedOverlap +
            0.15 * ot.goalComp +
            0.10 * ot.expBal +
            0.10 * sem_score
        )

        reasons = []
        if ot.powerBal >= 85: reasons.append("Sức mạnh hai đội rất cân bằng")
        if ot.expBal >= 80: reasons.append("Kinh nghiệm thi đấu tương đương")
        if ot.schedOverlap >= 75: reasons.append("Cả hai đội đều rảnh cùng khung giờ")
        
        missing_desc = not my_style.strip() or not my_goal.strip() or not opp_style.strip() or not opp_goal.strip()
        if missing_desc:
            reasons.append("Lưu ý: Dữ liệu mô tả phong cách chơi hoặc mục tiêu còn thiếu")
        elif sem_score >= 70:
            reasons.append("Phong cách chơi tạo ra trận đấu cạnh tranh tốt")

        if not reasons:
            reasons = ["Cặp đấu phù hợp theo tiêu chí cơ bản"]

        results.append(OpponentMatchResult(
            opponentTeam=OpponentTeamData(players=ot.players),
            opponentTeamId=ot.opponentTeamId,
            teamPower=ot.teamPower,
            score=round(final_score, 1),
            reasons=reasons
        ))

    results.sort(key=lambda x: x.score or 0.0, reverse=True)
    return OpponentMatchResponse(
        success=True,
        mode="opponent_team",
        fallback=True,
        fallbackReason=reason,
        myTeam=request.myTeam,
        results=results
    )
