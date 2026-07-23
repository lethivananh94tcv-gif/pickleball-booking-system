import os
import sys
if hasattr(sys, 'set_int_max_str_digits'):
    sys.set_int_max_str_digits(100000)

import google.generativeai as genai
import json
import datetime
from dotenv import load_dotenv
from app.models.chatbot_models import ChatbotIntentResponse

from pathlib import Path

# Load dotenv from correct path
dotenv_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(dotenv_path=dotenv_path)

from app.services.llm_client_manager import API_KEYS, generate_content_with_retry


# Cấu trúc prompt mẫu cho việc phân tích intent
BASE_SYSTEM_PROMPT = """Bạn là một trợ lý AI thông minh cho Pickle Club - một hệ thống đặt lịch sân Pickleball và đặt lịch huấn luyện viên (coach).
Nhiệm vụ của bạn là phân tích tin nhắn của người dùng và trả về một JSON có cấu trúc chứa ý định (intent), dữ liệu trích xuất (parsedData), độ tự tin (confidence), các trường thông tin còn thiếu (missingFields), cờ check DB (needDatabaseCheck), canAnswerDirectly, và câu gợi ý trả lời trực tiếp (replyHint) nếu có.

Hãy tuyệt đối tuân thủ các quy tắc sau:
1. Bạn KHÔNG được tự bịa ra thông tin. Nếu người dùng hỏi một thông tin động (như sân trống lúc mấy giờ, coach nào đang rảnh, giá sân cụ thể bao nhiêu, lịch sử đặt sân, hủy đặt sân), bạn phải đặt intent phù hợp, set needDatabaseCheck = true, canAnswerDirectly = false, và để backend xử lý truy vấn DB thật. Bạn KHÔNG được tự sinh ra danh sách sân trống hay coach trống giả lập!
2. Đối với các câu hỏi tĩnh có thể tự trả lời dựa trên tri thức có sẵn trong KNOWLEDGE BASE dưới đây (ví dụ: chào hỏi, hỏi luật chơi Pickleball chung, cách hoạt động của câu lạc bộ, chính sách chung, bảng giá chung, chính sách hoàn tiền/hủy sân, tính toán giá cơ bản), bạn hãy trả lời trực tiếp một cách tự nhiên, ngắn gọn và thân thiện nhất bằng tiếng Việt. Khi tự trả lời trực tiếp, hãy set canAnswerDirectly = true, needDatabaseCheck = false, và điền câu trả lời vào replyHint.
3. Trích xuất chính xác các thông tin sau từ tin nhắn người dùng vào parsedData:
   - dateText: Từ miêu tả ngày thô (ví dụ: "ngày mai", "ngày 21", "thứ 7 tuần này").
   - date: Ngày chuẩn hóa định dạng YYYY-MM-DD (sử dụng Context được cung cấp bên dưới để quy đổi chính xác các mốc thời gian tương đối như 'hôm nay', 'ngày mai', 'ngày kia', 'thứ hai', 'chủ nhật').
   - startTimeText: Giờ bắt đầu thô (ví dụ: "5h chiều", "19h", "7 giờ sáng").
   - startTime: Giờ bắt đầu chuẩn hóa định dạng HH:MM.
   - durationMinutes: Thời lượng buổi đặt (mặc định 60 phút nếu không nói gì khác).
   - courtNameRaw: Tên sân thô người dùng nhắc tới (ví dụ: "champion", "sunrise", "arena").
   - coachNameRaw: Tên coach thô người dùng nhắc tới (ví dụ: "coach Nam", "thầy Huy", "Tú").
   - numberOfPeople: Số lượng người chơi hoặc học viên.
   - skillLevel: Trình độ người học (ví dụ: "beginner", "intermediate", "advanced").
   - learningGoal: Mục tiêu học (ví dụ: "giao bóng", "học đánh cơ bản").
   - budget: Ngân sách học/thuê tối đa.
   - needCourtTogether: Set là True nếu người dùng muốn đặt lịch học với coach nhưng muốn hệ thống kiểm tra cả sân trống tương ứng cùng giờ đó (luồng combo Sân + Coach).
   - originalMessage: Lưu tin nhắn gốc của người dùng.
4. Khi phân loại ý định của người dùng, hãy đối chiếu các ý định chi tiết được mô tả trong intents.json (thuộc KNOWLEDGE BASE) với danh sách Intent được hỗ trợ thực tế của IntentEnum dưới đây để trả về giá trị `intent` chính xác nhất:
   - find_available_court, find_busy_court, find_best_court, find_cheap_court, find_court_for_beginner, find_competition_court, find_maintenance_court, court_detail -> CHECK_COURT_AVAILABILITY hoặc ASK_PRICE
   - find_available_coach, find_busy_coach, find_best_coach, find_cheap_coach, find_beginner_coach, find_advanced_coach, coach_detail -> CHECK_COACH_AVAILABILITY hoặc ASK_COACH_PRICE hoặc ASK_COACH_INFO
   - book_court -> BOOK_COURT
   - book_coach -> BOOK_COACH
   - book_combo -> BOOK_COACH (set needCourtTogether = True trong parsedData)
   - my_booking -> ASK_BOOKING_HISTORY
   - cancel_booking -> CANCEL_BOOKING_HELP
   - refund_question -> ASK_POLICY hoặc CANCEL_BOOKING_HELP
   - check_payment -> ASK_PAYMENT
   - find_teammate, find_opponent, find_group, invite_player -> FIND_PLAYER hoặc FIND_OPPONENT_PAIR
5. Đối với các câu hỏi ngoài luồng, câu hỏi tán gẫu, tâm sự riêng tư của người dùng (ví dụ: "tôi cô đơn quá", "tôi buồn quá", "bạn là ai", "hôm nay ăn gì", v.v.): Bạn hãy trả lời một cách cực kỳ thông minh, thân thiện, hài hước và khéo léo để dẫn dắt, kết nối tâm trạng của họ quay về dịch vụ Pickleball hoặc đặt sân/huấn luyện viên của Pickle Club. Ví dụ: Nếu họ kêu cô đơn hoặc buồn, hãy động viên họ rằng "Đừng buồn/cô đơn nhé! Hãy vào website Pickle Club để ghép cặp (matching) tìm đồng đội đánh Pickleball giao lưu hoặc đặt sân làm vài séc cho đổ mồ hôi là hết buồn ngay!". Khi trả lời các câu này, bạn hãy set `intent` là `GREETING` hoặc `UNKNOWN`, set `canAnswerDirectly = true`, `needDatabaseCheck = false`, và điền câu trả lời khéo léo này vào `replyHint`.

Danh sách Intent:
- GREETING: Chào hỏi, chào mừng.
- HELP: Hỏi trợ giúp chung, các tính năng bot có thể làm.
- BOOK_COURT: Muốn đặt sân (ví dụ: "tôi muốn đặt sân lúc 5h chiều nay").
- CHECK_COURT_AVAILABILITY: Kiểm tra sân trống (ví dụ: "sân Champion ngày mai còn trống giờ nào không?").
- CONFIRM_COURT_BOOKING: Khi người dùng đồng ý/xác nhận đặt sân (ví dụ: "Xác nhận đặt sân", "Đồng ý đặt sân", "đặt sân đi bạn", "ok đặt sân", "xác nhận đặt").
- CONFIRM_COACH_BOOKING: Khi người dùng đồng ý/xác nhận đặt coach/combo (ví dụ: "Đồng ý đặt coach", "Xác nhận đặt coach", "xác nhận học").
- CONFIRM_BOOKING: Xác nhận chung (ví dụ: "Xác nhận", "Tôi đồng ý", "Đặt luôn đi", "ok").
- REJECT_SUGGESTION: Từ chối hoặc không đồng ý các gợi ý slot/coach của bot (ví dụ: "Không", "Hủy bỏ", "Không đồng ý", "Không lấy slot này").
- ASK_PRICE: Hỏi giá thuê sân.
- ASK_OPENING_HOURS: Hỏi giờ mở cửa/hoạt động.
- ASK_RULES: Hỏi luật chơi Pickleball hoặc kiến thức chung.
- ASK_BOOKING_HISTORY: Hỏi lịch sử đặt sân của họ.
- CANCEL_BOOKING_HELP: Hỏi cách hủy hoặc muốn hủy lịch sân.
- CONFIRM_CANCEL_BOOKING: Xác nhận hủy lịch sân.
- FIND_COACH: Tìm kiếm danh sách huấn luyện viên.
- CHECK_COACH_AVAILABILITY: Kiểm tra lịch rảnh của coach.
- BOOK_COACH: Muốn đặt lịch học với coach.
- CANCEL_COACH_BOOKING_HELP: Hỏi cách hủy hoặc muốn hủy lịch dạy của coach.
- CONFIRM_CANCEL_COACH_BOOKING: Xác nhận hủy lịch dạy.
- ASK_COACH_PRICE: Hỏi giá thuê coach.
- ASK_COACH_INFO: Hỏi thông tin chi tiết về coach nào đó.
- ASK_COACH_BOOKING_HISTORY: Hỏi lịch sử đặt học với coach của học viên.
- FIND_PLAYER: Tìm kiếm người chơi khác hoặc đồng đội để ghép cặp (ví dụ: "tìm đồng đội", "tìm bạn chơi cùng", "ghép cặp chơi").
- FIND_OPPONENT_PAIR: Tìm kiếm cặp đối thủ để giao lưu thi đấu (ví dụ: "tìm đối thủ", "tìm cặp đối thủ").
- UNKNOWN: Ý định không rõ ràng hoặc không hỗ trợ.
"""

def load_knowledge_base():
    base_dir = Path(__file__).resolve().parent.parent / 'knowledge'
    kb_str = "\n=== KNOWLEDGE BASE (THÔNG TIN CHI TIẾT VỀ DOANH NGHIỆP & CHÍNH SÁCH) ===\n"
    
    files_to_load = [
        ('company.json', 'Thông tin câu lạc bộ & Giờ mở cửa'),
        ('policies.json', 'Chính sách đặt chỗ & Chính sách hủy/hoàn tiền'),
        ('faq.json', 'Các câu hỏi thường gặp (FAQ)'),
        ('glossary.json', 'Thuật ngữ (Glossary)'),
        ('response_rules.json', 'Quy tắc ứng xử và quy định trả lời'),
        ('api_actions.json', 'Danh sách các API Actions hệ thống hỗ trợ'),
        ('intents.json', 'Danh sách ý định chi tiết (Intents)')
    ]
    
    # Đọc thêm system_prompt.txt nếu có
    sys_txt_path = base_dir / 'system_prompt.txt'
    if sys_txt_path.exists():
        try:
            with open(sys_txt_path, 'r', encoding='utf-8') as f:
                kb_str += f"\n[Quy định bắt buộc]:\n{f.read()}\n"
        except Exception as e:
            print(f"Error loading system_prompt.txt: {e}")
            
    for filename, title in files_to_load:
        file_path = base_dir / filename
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    kb_str += f"\n[{title}]:\n{json.dumps(data, ensure_ascii=False, indent=2)}\n"
            except Exception as e:
                print(f"Error loading {filename}: {e}")
                
    kb_str += "\n============================================\n"
    return kb_str

SYSTEM_PROMPT = BASE_SYSTEM_PROMPT + load_knowledge_base()

def pydantic_to_gemini_schema(model_class):
    schema_dict = model_class.model_json_schema()
    defs = schema_dict.get("$defs", {})
    
    from typing import Any
    def clean_schema(node: Any) -> Any:
        if not isinstance(node, dict):
            return node
        
        # Resolve reference
        if "$ref" in node:
            ref_name = node["$ref"].split("/")[-1]
            ref_schema = defs.get(ref_name, {})
            return clean_schema(ref_schema.copy())
        
        # Resolve anyOf (usually for Optional fields like anyOf: [type, null])
        if "anyOf" in node:
            sub_types = [x for x in node["anyOf"] if x.get("type") != "null"]
            if sub_types:
                sub_node = sub_types[0].copy()
                for k, v in node.items():
                    if k != "anyOf" and k not in sub_node:
                        sub_node[k] = v
                return clean_schema(sub_node)
            else:
                return {"type": "STRING"} # fallback
                
        type_map = {
            "string": "STRING",
            "integer": "INTEGER",
            "number": "NUMBER",
            "boolean": "BOOLEAN",
            "object": "OBJECT",
            "array": "ARRAY"
        }
        
        cleaned = {}
        
        if "type" in node:
            t = node["type"]
            cleaned["type"] = type_map.get(t, "STRING")
        elif "enum" in node:
            cleaned["type"] = "STRING"
            
        if "description" in node:
            cleaned["description"] = node["description"]
            
        if "enum" in node:
            cleaned["enum"] = node["enum"]
            
        if "properties" in node:
            cleaned["properties"] = {
                k: clean_schema(v) for k, v in node["properties"].items()
            }
            
        if "required" in node:
            props = node.get("properties", {})
            cleaned["required"] = [
                r for r in node["required"] 
                if r in props or "$ref" in props.get(r, {}) or "anyOf" in props.get(r, {})
            ]
            
        if "items" in node:
            cleaned["items"] = clean_schema(node["items"])
            
        return cleaned

    cleaned_schema = clean_schema(schema_dict)
    return cleaned_schema

CHATBOT_SCHEMA = pydantic_to_gemini_schema(ChatbotIntentResponse)

def analyze_user_intent(message: str) -> ChatbotIntentResponse:
    if not API_KEYS:
        # Fallback if key missing
        fallback_data = {
            "intent": "UNKNOWN",
            "parsedData": {
                "originalMessage": message,
                "durationMinutes": 60
            },
            "confidence": 0.0,
            "missingFields": [],
            "needDatabaseCheck": False,
            "canAnswerDirectly": True,
            "replyHint": "Xin lỗi, hệ thống phân tích AI chưa được cấu hình API Key. Bạn có thể đặt trực tiếp trên website!"
        }
        return ChatbotIntentResponse(**fallback_data)
    
    # Lấy ngày hiện tại ở múi giờ GMT+7 (Việt Nam)
    tz_vn = datetime.timezone(datetime.timedelta(hours=7))
    now_vn = datetime.datetime.now(tz_vn)
    current_date = now_vn.strftime("%Y-%m-%d")
    current_weekday = now_vn.strftime("%A")
    current_time = now_vn.strftime("%H:%M:%S")
    
    weekdays_vi = {
        "Monday": "Thứ Hai",
        "Tuesday": "Thứ Ba",
        "Wednesday": "Thứ Tư",
        "Thursday": "Thứ Năm",
        "Friday": "Thứ Sáu",
        "Saturday": "Thứ Bảy",
        "Sunday": "Chủ Nhật"
    }
    weekday_vi = weekdays_vi.get(current_weekday, current_weekday)
    context = f"Ngày hôm nay là: {current_date} ({weekday_vi}), giờ hiện tại là: {current_time}."

    # Sử dụng response_schema được làm sạch để ép Gemini trả về đúng format
    try:
        response = generate_content_with_retry(
            f"{SYSTEM_PROMPT}\n\nContext: {context}\n\nCâu của người dùng: '{message}'",
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=CHATBOT_SCHEMA
            )
        )
        
        # Parse chuỗi JSON trả về thành Pydantic Model
        result_json = json.loads(response.text)
        if 'parsedData' in result_json:
            if not result_json['parsedData'].get('originalMessage'):
                result_json['parsedData']['originalMessage'] = message
        else:
            result_json['parsedData'] = {"originalMessage": message, "durationMinutes": 60}
            
        return ChatbotIntentResponse(**result_json)
        
    except Exception as e:
        print(f"Error calling LLM: {e}")
        # Trả về message lỗi rõ ràng thay vì crash
        fallback_data = {
            "intent": "UNKNOWN",
            "parsedData": {
                "originalMessage": message,
                "durationMinutes": 60
            },
            "confidence": 0.0,
            "missingFields": [],
            "needDatabaseCheck": False,
            "canAnswerDirectly": True,
            "replyHint": "Xin lỗi, hệ thống phân tích AI đang gặp sự cố kết nối. Bạn có thể diễn đạt lại hoặc sử dụng đặt sân/HLV trực tiếp nhé!"
        }
        return ChatbotIntentResponse(**fallback_data)

