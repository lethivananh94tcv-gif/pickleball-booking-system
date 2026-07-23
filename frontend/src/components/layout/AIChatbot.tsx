"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { FiMessageCircle, FiX, FiSend, FiClock, FiUser } from "react-icons/fi";
import { sendChatbotMessage, CourtSlotSuggestion, CoachSuggestion } from "@/services/chatbotApi";
import styles from "./AIChatbot.module.css";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
  actionType?: string;
  suggestedSlots?: CourtSlotSuggestion[];
  suggestedCoaches?: CoachSuggestion[];
}

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState("");
  
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Helper to parse markdown links and bold formatting
  const renderMessageText = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Split by bold elements **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
        }
        
        // Split by markdown link elements [text](url)
        const linkParts = part.split(/(\[[^\]]+\]\([^)]+\))/g);
        return linkParts.map((lPart, lIdx) => {
          if (lPart.startsWith("[") && lPart.includes("](")) {
            const match = lPart.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (match) {
              const [, linkText, url] = match;
              if (url.startsWith("/")) {
                return (
                  <Link 
                    key={lIdx} 
                    href={url} 
                    onClick={() => setIsOpen(false)}
                    style={{ color: "#2563eb", textDecoration: "underline", fontWeight: "600" }}
                  >
                    {linkText}
                  </Link>
                );
              }
              return (
                <a 
                  key={lIdx} 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: "#2563eb", textDecoration: "underline", fontWeight: "600" }}
                >
                  {linkText}
                </a>
              );
            }
          }
          return lPart;
        });
      });

      return (
        <div key={idx} style={{ minHeight: line.trim() === "" ? "8px" : "auto", margin: "2px 0" }}>
          {formattedLine}
        </div>
      );
    });
  };

  // Generate conversationId on mount
  useEffect(() => {
    let id = "";
    if (typeof window !== "undefined") {
      id = localStorage.getItem("chatbot_conv_id") || "";
      if (!id) {
        id = "conv_" + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("chatbot_conv_id", id);
      }
    }
    setConversationId(id || "conv_default");
  }, []);

  // Initialize welcome message once on client side
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        sender: "bot",
        text: "Xin chào! Mình là Trợ lý ảo Pickle Club. Mình có thể giúp gì cho bạn hôm nay?",
        timestamp: new Date()
      }
    ]);
  }, []);

  // Scroll to bottom on updates
  useEffect(() => {
    if (isOpen) {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    // 1. Add User Message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: text.trim(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    // 2. Local Intercepts for system guides
    const query = text.trim();
    let isGuide = false;
    let botResponseText = "";
    let botActionType = "";

    if (query === "Hướng dẫn đặt sân trực tuyến" || query.toLowerCase().includes("làm thế nào để đặt sân")) {
      isGuide = true;
      botResponseText = `**Quy trình đặt sân trực tuyến cực kỳ đơn giản:**\n\n1. 🎾 **Bước 1**: Truy cập trang [Danh sách Sân](/courts) để tìm sân trống theo thời gian thực.\n2. 📅 **Bước 2**: Chọn sân và khung giờ chơi mong muốn (ví dụ: 17:00 - 19:00).\n3. 🛒 **Bước 3**: Nhấn **Đặt lịch**, hệ thống sẽ chuyển đến trang thanh toán.\n4. 💸 **Bước 4**: Nhập mã ưu đãi (nếu có), chọn phương thức thanh toán và nhấn **Xác nhận đặt** để hoàn tất.\n\n*Bạn có muốn chuyển sang trang đặt sân ngay bây giờ không?*`;
      botActionType = "GO_TO_COURTS";
    } else if (query === "Hướng dẫn đặt combo sân kèm Coach" || query.toLowerCase().includes("cách đặt combo")) {
      isGuide = true;
      botResponseText = `**Cách đặt Combo Sân + HLV giúp bạn tiết kiệm chi phí và tập luyện chuyên nghiệp:**\n\n1. 🤝 **Bước 1**: Truy cập trang [Đặt Combo](/combo).\n2. 👨‍🏫 **Bước 2**: Lựa chọn Huấn luyện viên (Coach) phù hợp với trình độ của bạn.\n3. 🎾 **Bước 3**: Lựa chọn sân tập mong muốn.\n4. ⏰ **Bước 4**: Chọn ngày học, giờ học và thời lượng buổi tập.\n5. 💳 **Bước 5**: Kiểm tra mức giá ưu đãi và tiến hành thanh toán.\n\n*Bạn có muốn xem trang đặt Combo ngay bây giờ không?*`;
      botActionType = "GO_TO_COMBO";
    } else if (query === "Hướng dẫn tìm bạn ghép cặp chơi" || query.toLowerCase().includes("ghép cặp")) {
      isGuide = true;
      botResponseText = `**Tính năng Ghép Cặp (Matching) giúp bạn tìm đối thủ và bạn chơi cùng trình độ dễ dàng:**\n\n1. 👥 **Bước 1**: Truy cập trang [Ghép cặp & Tìm người chơi](/matching).\n2. 🔍 **Bước 2**: Xem danh sách các bài đăng ghép cặp hiện có hoặc bấm **Tạo bài viết ghép cặp mới**.\n3. 📝 **Bước 3**: Nhập thông tin: Sân chơi, thời gian chơi, trình độ yêu cầu (Cơ bản/Trung bình/Khá) và số lượng người cần tuyển.\n4. 📢 **Bước 4**: Đăng bài và chờ những người chơi phù hợp nhấn tham gia!\n\n*Bạn có muốn xem danh sách ghép cặp ngay bây giờ không?*`;
      botActionType = "GO_TO_MATCHING";
    } else if (query === "Hướng dẫn hủy lịch và hoàn tiền" || query.toLowerCase().includes("hủy lịch") || query.toLowerCase().includes("hoàn tiền")) {
      isGuide = true;
      botResponseText = `**Chính sách hoàn tiền khi hủy lịch cực kỳ minh bạch và linh hoạt tại PickleClub:**\n\n- ⏱️ **Hủy trước 24 giờ**: Hoàn trả **100%** giá trị booking vào ví tài khoản của bạn.\n- ⏱️ **Hủy từ 12 - 24 giờ**: Hoàn trả **50%** giá trị booking vào ví tài khoản.\n- ⏱️ **Hủy dưới 12 giờ**: Rất tiếc, hệ thống không thể hỗ trợ hoàn phí.\n- 🔄 **Cách hủy**: Truy cập trang [Trang cá nhân](/profile) -> **Lịch sử đặt lịch** -> Chọn lịch muốn hủy -> Nhấn **Hủy đặt lịch** và chọn lý do.\n\n*Bạn có muốn đi tới Trang cá nhân để xem lịch đặt không?*`;
      botActionType = "GO_TO_PROFILE";
    }

    if (isGuide) {
      setTimeout(() => {
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: botResponseText,
          timestamp: new Date(),
          actionType: botActionType
        };
        setMessages(prev => [...prev, botMsg]);
        setIsTyping(false);
      }, 550);
      return;
    }

    try {
      // 3. Fetch local JWT token
      const token = typeof window !== "undefined" ? localStorage.getItem("pickleclub_token") : null;

      // 4. Call backend
      const response = await sendChatbotMessage(text.trim(), conversationId, token);
      
      // 5. Add Bot Message
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: response.message || "Không nhận được phản hồi từ AI.",
        timestamp: new Date(),
        actionType: response.actionType,
        suggestedSlots: response.suggestedSlots,
        suggestedCoaches: response.suggestedCoaches
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error("Chatbot API Error:", error);
      const errorMsg: Message = {
        id: `bot-err-${Date.now()}`,
        sender: "bot",
        text: "Xin lỗi, hiện tại hệ thống AI đang gặp sự cố. Bạn vui lòng thử lại sau.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  const quickSuggestions = [
    "Kiểm tra sân trống",
    "Đặt huấn luyện viên",
    "Giá thuê sân thế nào?",
    "Luật chơi Pickleball"
  ];

  return (
    <div className={styles.chatWrapper}>
      {/* Floating Bubble Button */}
      <button 
        className={styles.chatBubble} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Chat with AI Assistant"
      >
        {isOpen ? <FiX size={24} color="#ffffff" /> : <FiMessageCircle size={24} color="#ffffff" />}
      </button>

      {/* Chat Window Panel */}
      {isOpen && (
        <div className={styles.chatPanel}>
          {/* Header */}
          <div className={styles.chatHeader}>
            <div className={styles.headerTitleArea}>
              <div className={styles.avatar}>🤖</div>
              <div className={styles.headerText}>
                <span className={styles.headerName}>Trợ lý AI</span>
                <span className={styles.headerStatus}>
                  <span className={styles.statusDot}></span> Đang hoạt động
                </span>
              </div>
            </div>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)} aria-label="Close Chat">
              <FiX size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className={styles.messageArea}>
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`${styles.msg} ${msg.sender === "user" ? styles.userMsg : styles.botMsg}`}
                style={msg.id === "welcome" ? { maxWidth: "90%", padding: "0", background: "transparent", border: "none", boxShadow: "none" } : {}}
              >
                {msg.id === "welcome" ? (
                  <div className={styles.welcomeCard}>
                    <div className={styles.welcomeLogo}>🤖</div>
                    <h4 className={styles.welcomeTitle}>Trợ lý ảo PickleClub</h4>
                    <p className={styles.welcomeText}>
                      Chào mừng bạn đến với PickleClub! Mình có thể hỗ trợ giải đáp thắc mắc và hướng dẫn các thao tác hệ thống 24/7.
                    </p>
                    
                    <div className={styles.welcomeShortcuts}>
                      <Link href="/courts" onClick={() => setIsOpen(false)} className={styles.welcomeShortcut}>
                        <span>🎾</span> Đặt Sân
                      </Link>
                      <Link href="/coaches" onClick={() => setIsOpen(false)} className={styles.welcomeShortcut}>
                        <span>👨‍🏫</span> Đặt HLV
                      </Link>
                      <Link href="/combo" onClick={() => setIsOpen(false)} className={styles.welcomeShortcut}>
                        <span>🤝</span> Đặt Combo
                      </Link>
                      <Link href="/matching" onClick={() => setIsOpen(false)} className={styles.welcomeShortcut}>
                        <span>👥</span> Ghép Cặp
                      </Link>
                      <Link href="/promotions" onClick={() => setIsOpen(false)} className={styles.welcomeShortcut}>
                        <span>🏷️</span> Xem Ưu Đãi
                      </Link>
                      <Link href="/tournaments" onClick={() => setIsOpen(false)} className={styles.welcomeShortcut}>
                        <span>🏆</span> Giải Đấu
                      </Link>
                    </div>
                    
                    <div className={styles.guideSection}>
                      <div className={styles.guideHeader}>
                        <span>📖</span> Hướng dẫn thao tác nhanh:
                      </div>
                      <div className={styles.guideLinks}>
                        <button 
                          type="button" 
                          className={styles.guideLinkBtn} 
                          onClick={() => handleSendMessage("Hướng dẫn đặt sân trực tuyến")}
                          disabled={isTyping}
                        >
                          🔍 Làm thế nào để đặt sân?
                        </button>
                        <button 
                          type="button" 
                          className={styles.guideLinkBtn} 
                          onClick={() => handleSendMessage("Hướng dẫn đặt combo sân kèm Coach")}
                          disabled={isTyping}
                        >
                          🔍 Cách đặt Combo sân + Coach?
                        </button>
                        <button 
                          type="button" 
                          className={styles.guideLinkBtn} 
                          onClick={() => handleSendMessage("Hướng dẫn tìm bạn ghép cặp chơi")}
                          disabled={isTyping}
                        >
                          🔍 Làm thế nào để ghép cặp?
                        </button>
                        <button 
                          type="button" 
                          className={styles.guideLinkBtn} 
                          onClick={() => handleSendMessage("Hướng dẫn hủy lịch và hoàn tiền")}
                          disabled={isTyping}
                        >
                          🔍 Chính sách hoàn hủy lịch?
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>{renderMessageText(msg.text)}</div>
                )}

                {/* Login Required Action */}
                {msg.actionType === "LOGIN_REQUIRED" && (
                  <div style={{ marginTop: "10px", width: "100%" }}>
                    <Link 
                      href="/login" 
                      style={{ 
                        display: "block", 
                        background: "#3b82f6", 
                        color: "#ffffff", 
                        padding: "8px 12px", 
                        borderRadius: "8px", 
                        fontWeight: "bold", 
                        textDecoration: "none", 
                        textAlign: "center",
                        fontSize: "12px"
                      }}
                    >
                      Đăng nhập ngay
                    </Link>
                  </div>
                )}

                {/* Go To Matching Action */}
                {msg.actionType === "GO_TO_MATCHING" && (
                  <div style={{ marginTop: "10px", width: "100%" }}>
                    <Link 
                      href="/matching" 
                      onClick={() => setIsOpen(false)}
                      style={{ 
                        display: "block", 
                        background: "#22c55e", 
                        color: "#ffffff", 
                        padding: "8px 12px", 
                        borderRadius: "8px", 
                        fontWeight: "bold", 
                        textDecoration: "none", 
                        textAlign: "center",
                        fontSize: "12px"
                      }}
                    >
                      Tìm người chơi ngay
                    </Link>
                  </div>
                )}

                {/* Go To Courts Action */}
                {msg.actionType === "GO_TO_COURTS" && (
                  <div style={{ marginTop: "10px", width: "100%" }}>
                    <Link 
                      href="/courts" 
                      onClick={() => setIsOpen(false)}
                      style={{ 
                        display: "block", 
                        background: "#3b82f6", 
                        color: "#ffffff", 
                        padding: "8px 12px", 
                        borderRadius: "8px", 
                        fontWeight: "bold", 
                        textDecoration: "none", 
                        textAlign: "center",
                        fontSize: "12px"
                      }}
                    >
                      Xem danh sách Sân
                    </Link>
                  </div>
                )}

                {/* Go To Coaches Action */}
                {msg.actionType === "GO_TO_COACHES" && (
                  <div style={{ marginTop: "10px", width: "100%" }}>
                    <Link 
                      href="/coaches" 
                      onClick={() => setIsOpen(false)}
                      style={{ 
                        display: "block", 
                        background: "#3b82f6", 
                        color: "#ffffff", 
                        padding: "8px 12px", 
                        borderRadius: "8px", 
                        fontWeight: "bold", 
                        textDecoration: "none", 
                        textAlign: "center",
                        fontSize: "12px"
                      }}
                    >
                      Xem danh sách Coach
                    </Link>
                  </div>
                )}

                {/* Go To Tournaments Action */}
                {msg.actionType === "GO_TO_TOURNAMENTS" && (
                  <div style={{ marginTop: "10px", width: "100%" }}>
                    <Link 
                      href="/tournaments" 
                      onClick={() => setIsOpen(false)}
                      style={{ 
                        display: "block", 
                        background: "#ff9f1c", 
                        color: "#ffffff", 
                        padding: "8px 12px", 
                        borderRadius: "8px", 
                        fontWeight: "bold", 
                        textDecoration: "none", 
                        textAlign: "center",
                        fontSize: "12px"
                      }}
                    >
                      Xem các Giải đấu
                    </Link>
                  </div>
                )}

                {/* Go To Combo Action */}
                {msg.actionType === "GO_TO_COMBO" && (
                  <div style={{ marginTop: "10px", width: "100%" }}>
                    <Link 
                      href="/combo" 
                      onClick={() => setIsOpen(false)}
                      style={{ 
                        display: "block", 
                        background: "#6366f1", 
                        color: "#ffffff", 
                        padding: "8px 12px", 
                        borderRadius: "8px", 
                        fontWeight: "bold", 
                        textDecoration: "none", 
                        textAlign: "center",
                        fontSize: "12px",
                        boxShadow: "0 2px 6px rgba(99, 102, 241, 0.25)"
                      }}
                    >
                      Đặt Combo Sân + Coach ngay
                    </Link>
                  </div>
                )}

                {/* Go To Profile Action */}
                {msg.actionType === "GO_TO_PROFILE" && (
                  <div style={{ marginTop: "10px", width: "100%" }}>
                    <Link 
                      href="/profile" 
                      onClick={() => setIsOpen(false)}
                      style={{ 
                        display: "block", 
                        background: "#0f172a", 
                        color: "#ffffff", 
                        padding: "8px 12px", 
                        borderRadius: "8px", 
                        fontWeight: "bold", 
                        textDecoration: "none", 
                        textAlign: "center",
                        fontSize: "12px",
                        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.25)"
                      }}
                    >
                      Xem lịch sử đặt sân của tôi
                    </Link>
                  </div>
                )}

                {/* Court Suggestions */}
                {msg.suggestedSlots && msg.suggestedSlots.length > 0 && (
                  <div style={{ width: "100%" }}>
                    {msg.suggestedSlots.map((slot, idx) => (
                      <div key={`${slot.courtId || slot.coachId}-${idx}`} className={styles.courtCard}>
                        <div className={styles.courtCardTitle}>{slot.courtName || `HLV ${slot.coachName}`}</div>
                        <div className={styles.courtCardMeta}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <FiClock size={11} /> {slot.availableTime}
                          </span>
                          <span className={styles.courtCardPrice}>{slot.price.toLocaleString("vi-VN")}đ</span>
                        </div>
                        <button 
                          onClick={() => {
                            if (slot.coachName) {
                              handleSendMessage(`Đặt HLV ${slot.coachName} lúc ${slot.availableTime.split(" - ")[0]}`);
                            } else {
                              handleSendMessage(`Đặt sân ${slot.courtName} lúc ${slot.availableTime.split(" - ")[0]}`);
                            }
                          }} 
                          className={styles.bookBtn}
                        >
                          Chọn slot này
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Coach Suggestions */}
                {msg.suggestedCoaches && msg.suggestedCoaches.length > 0 && (
                  <div style={{ width: "100%" }}>
                    {msg.suggestedCoaches.map((coach, idx) => (
                      <div key={`${coach.coachId}-${idx}`} className={styles.courtCard}>
                        <div className={styles.courtCardTitle} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <FiUser size={12} /> Coach {coach.name}
                        </div>
                        <div className={styles.courtCardMeta}>
                          <span>Trình độ: {coach.skillLevel}</span>
                          <span className={styles.courtCardPrice}>{coach.hourlyRate.toLocaleString("vi-VN")}đ/h</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          Chuyên môn: {coach.specialization}
                        </div>
                        <button 
                          onClick={() => handleSendMessage(`Đặt HLV ${coach.name}`)} 
                          className={styles.bookBtn}
                        >
                          Chọn HLV này
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Booking Confirm Actions */}
                {(msg.actionType === "CONFIRM_COURT_BOOKING" || 
                  msg.actionType === "CONFIRM_COACH_BOOKING" ||
                  msg.actionType === "CONFIRM_CANCEL_COURT_BOOKING" ||
                  msg.actionType === "CONFIRM_CANCEL_COACH_BOOKING" ||
                  msg.actionType === "CONFIRM_RESCHEDULE_COURT_BOOKING" ||
                  msg.actionType === "CONFIRM_RESCHEDULE_COACH_BOOKING") && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px", width: "100%" }}>
                    <button 
                      onClick={() => handleSendMessage("Xác nhận")} 
                      style={{ 
                        flex: 1, 
                        background: "#22c55e", 
                        color: "#ffffff", 
                        border: "none", 
                        padding: "8px", 
                        borderRadius: "6px", 
                        fontWeight: "bold", 
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Xác nhận
                    </button>
                    <button 
                      onClick={() => handleSendMessage("Hủy")} 
                      style={{ 
                        flex: 1, 
                        background: "#ef4444", 
                        color: "#ffffff", 
                        border: "none", 
                        padding: "8px", 
                        borderRadius: "6px", 
                        fontWeight: "bold", 
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Hủy bỏ
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            {/* Typing Loader */}
            {isTyping && (
              <div className={styles.typingLoader}>
                <span className={styles.typingDot}></span>
                <span className={styles.typingDot}></span>
                <span className={styles.typingDot}></span>
              </div>
            )}
            
            <div ref={messageEndRef} />
          </div>

          {/* Quick suggestions chips */}
          <div className={styles.suggestionContainer}>
            {quickSuggestions.map((text, idx) => (
              <button 
                key={idx} 
                className={styles.suggestionChip}
                onClick={() => handleSendMessage(text)}
                disabled={isTyping}
              >
                {text}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form className={styles.inputArea} onSubmit={handleFormSubmit}>
            <input
              type="text"
              placeholder="Hỏi AI Trợ lý..."
              className={styles.input}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isTyping}
            />
            <button 
              type="submit" 
              className={styles.sendBtn}
              disabled={!inputText.trim() || isTyping}
              aria-label="Send Message"
            >
              <FiSend size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
