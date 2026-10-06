import { supabase } from '../lib/supabase';

// Header kèm Supabase access token để proxy AI xác thực (chống lạm dụng quota).
const aiHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
};

// Cấu hình danh sách lãnh đạo (Có thể chuyển sang env hoặc DB sau này)
export const LEADERSHIP_CONFIG = {
  biThu: ["Bí thư", "Đồng chí Bí thư", "đ/c Bí thư", "dc bi thu"],
  phoBiThuThuongTruc: ["Phó Bí thư Thường trực", "Phó Bí thư TT", "PBT TT"],
  phoBiThuChuTich: ["Chủ tịch UBND", "Chủ tịch Ủy ban nhân dân", "Chủ tịch xã", "Phó Bí thư, Chủ tịch UBND", "Phó Bí thư - Chủ tịch UBND"],
};

// Chuẩn hóa chuỗi (bỏ dấu tiếng Việt, đưa về chữ thường)
export const normalizeString = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
};

// Các từ khóa mặc định cho loại họp
const MEETING_TYPES = {
  THUONG_TRUC: ['thuong truc dang uy', 'ttdu', 'tt đu', 'hop thuong truc'],
  BAN_THUONG_VU: ['ban thuong vu', 'btv', 'hop ban thuong vu'],
  BAN_CHAP_HANH: ['ban chap hanh', 'bch', 'hoi nghi ban chap hanh', 'hop ban chap hanh']
};

/**
 * Lớp 1: Rule-based parser
 * Phân tích 1 cuộc họp dựa trên logic text matching
 */
export const analyzeEventRuleBased = (event) => {
  const content = normalizeString(event.content || '');
  const host = normalizeString(event.host || '');
  const attendees = normalizeString(event.attendees || '');
  const fullText = `${content} | ${host} | ${attendees}`;

  let isBiThu = false;
  let isPBT_TT = false;
  let isPBT_CT = false;
  let meetingType = 'Khác';
  let reliability = 'Cao';
  let determineSource = 'Theo từ khóa';
  let needsReview = false;

  // 1. Kiểm tra loại cuộc họp đặc biệt (Mặc định tính Bí thư và Phó Bí thư tham dự)
  // Ưu tiên kiểm tra Ban Chấp hành, sau đó đến Ban Thường vụ, cuối cùng là Thường trực
  // Vì các cuộc họp của cấp cao hơn có thể do cấp dưới chuẩn bị/chủ trì (VD: Hội nghị BTV do TTĐU chủ trì)
  if (MEETING_TYPES.BAN_CHAP_HANH.some(kw => fullText.includes(kw))) {
    meetingType = 'Ban Chấp hành';
    isBiThu = true;
    isPBT_TT = true;
    isPBT_CT = true;
    determineSource = 'Tự động theo loại họp';
  } else if (MEETING_TYPES.BAN_THUONG_VU.some(kw => fullText.includes(kw))) {
    meetingType = 'Ban Thường vụ';
    isBiThu = true;
    isPBT_TT = true;
    isPBT_CT = true;
    determineSource = 'Tự động theo loại họp';
  } else if (MEETING_TYPES.THUONG_TRUC.some(kw => fullText.includes(kw))) {
    meetingType = 'Thường trực';
    isBiThu = true;
    isPBT_TT = true;
    isPBT_CT = true;
    determineSource = 'Tự động theo loại họp';
  } else {
    // 2. Kiểm tra theo người chủ trì (Nếu Bí thư chủ trì thì chắc chắn có mặt)
    const checkMatch = (normalizedText, keywords) => {
      return keywords.some(kw => normalizedText.includes(normalizeString(kw)));
    };

    const checkMatchBiThu = (normalizedText) => {
      // Remove 'pho bi thu' to prevent false positive match for 'bi thu'
      const textWithoutPho = normalizedText.replace(/pho bi thu/g, '');
      return LEADERSHIP_CONFIG.biThu.some(kw => textWithoutPho.includes(normalizeString(kw)));
    };

    if (checkMatchBiThu(host)) isBiThu = true;
    if (checkMatch(host, LEADERSHIP_CONFIG.phoBiThuThuongTruc)) isPBT_TT = true;
    if (checkMatch(host, LEADERSHIP_CONFIG.phoBiThuChuTich)) isPBT_CT = true;

    // 3. Kiểm tra theo thành phần tham dự
    if (!isBiThu && checkMatchBiThu(fullText)) isBiThu = true;
    if (!isPBT_TT && checkMatch(fullText, LEADERSHIP_CONFIG.phoBiThuThuongTruc)) isPBT_TT = true;
    if (!isPBT_CT && checkMatch(fullText, LEADERSHIP_CONFIG.phoBiThuChuTich)) isPBT_CT = true;

    // Nếu không có bất kỳ ai và không rõ thành phần -> đưa vào danh sách rà soát
    if (!isBiThu && !isPBT_TT && !isPBT_CT && (!attendees || attendees.trim() === '')) {
      needsReview = true;
      reliability = 'Thấp';
      determineSource = 'Cần rà soát';
    }
  }

  // Fallback: Xử lý từ khóa "Phó Bí thư" chung nếu chưa match cụ thể TT hay CT
  if (!isPBT_TT && !isPBT_CT && (fullText.includes('pho bi thu') || fullText.includes('phó bí thư'))) {
    // Nếu chỉ ghi chung chung "Phó Bí thư", mặc định đánh dấu cho Phó Bí thư Thường trực
    isPBT_TT = true;
    needsReview = true;
    reliability = 'Trung bình';
  }

  return {
    ...event,
    analysis: {
      isBiThu,
      isPBT_TT,
      isPBT_CT,
      meetingType,
      reliability,
      determineSource,
      needsReview,
      note: needsReview ? 'Dữ liệu thành phần tham dự không rõ ràng, cần kiểm tra lại.' : ''
    }
  };
};

/**
 * Lớp 2: AI Parser (Sử dụng Google Gemini AI qua Proxy Vercel /api/ai-assistant)
 * Chỉ chạy với những trường hợp Rule-based đánh giá là độ tin cậy "Thấp" hoặc "Trung bình" (Cần rà soát)
 */
export const analyzeEventsAI = async (eventsToReview) => {
  if (!eventsToReview || eventsToReview.length === 0) return eventsToReview;

  try {
    const prompt = `Bạn là một trợ lý phân tích lịch công tác.
Tôi có một danh sách các sự kiện cần rà soát lại thành phần tham dự.
Hãy phân tích và cho tôi biết trong mỗi sự kiện, các đồng chí lãnh đạo sau có tham dự hay không:
- Bí thư Đảng ủy (BiThu)
- Phó Bí thư Thường trực (PBT_TT)
- Chủ tịch UBND (PBT_CT)

Luật:
1. Nếu là họp "Thường trực Đảng ủy", "Ban Thường vụ", "Ban Chấp hành", thì cả 3 đều có mặt.
2. Trả về kết quả ĐÚNG định dạng JSON array tương ứng với thứ tự đầu vào, không có markdown.
Định dạng JSON yêu cầu: [{"id": "id-su-kien", "isBiThu": true, "isPBT_TT": false, "isPBT_CT": true, "note": "Lý do ngắn gọn"}]

Dữ liệu đầu vào:
${JSON.stringify(eventsToReview.map(e => ({
  id: e.id,
  content: e.content,
  host: e.host,
  attendees: e.attendees,
  type: e.type
})))}`;

    const response = await fetch('/api/ai-assistant', {
      method: 'POST',
      headers: await aiHeaders(),
      body: JSON.stringify({
        prompt,
        temperature: 0.1,
        modelPriority: 'fast'
      })
    });

    if (!response.ok) {
      throw new Error('Lỗi kết nối AI phân tích lịch');
    }

    const data = await response.json();
    const text = data.text;
    
    // Parse JSON safely
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiResults = JSON.parse(jsonStr);

    // Merge AI results back to events
    return eventsToReview.map(event => {
      const aiMatch = Array.isArray(aiResults) ? aiResults.find(r => r.id === event.id) : null;
      if (aiMatch) {
        return {
          ...event,
          analysis: {
            ...event.analysis,
            isBiThu: Boolean(aiMatch.isBiThu),
            isPBT_TT: Boolean(aiMatch.isPBT_TT),
            isPBT_CT: Boolean(aiMatch.isPBT_CT),
            reliability: 'Cao (AI xác nhận)',
            determineSource: 'AI NLP',
            needsReview: false,
            note: aiMatch.note || 'AI đã phân tích dựa trên ngữ cảnh.'
          }
        };
      }
      return event;
    });

  } catch (error) {
    console.error("AI Analysis failed, fallback to rule-based", error);
    return eventsToReview; // Fallback to rule-based results if AI fails
  }
};

/**
 * Main Service Function: Chạy toàn bộ quy trình phân tích
 */
export const analyzeCalendarData = async (publishedEvents) => {
  // B1: Chạy Rule-based cho toàn bộ
  let results = publishedEvents.map(analyzeEventRuleBased);

  // B2: Lọc ra các events cần review bằng AI
  const eventsToReview = results.filter(e => e.analysis.needsReview);
  let usedAI = false;

  // Nếu có events cần review thì gọi AI qua proxy bảo mật
  if (eventsToReview.length > 0) {
    try {
      const aiAnalyzedEvents = await analyzeEventsAI(eventsToReview);
      
      // Gộp kết quả AI vào danh sách gốc
      results = results.map(r => {
        const aiUpdate = aiAnalyzedEvents.find(ai => ai.id === r.id);
        return aiUpdate || r;
      });
      usedAI = true;
    } catch (err) {
      console.warn("AI Reviewing events failed, using rule-based results only:", err);
    }
  }

  // Tính toán tổng hợp (Summary)
  const summary = {
    total: results.length,
    biThu: results.filter(r => r.analysis.isBiThu).length,
    pbt_tt: results.filter(r => r.analysis.isPBT_TT).length,
    pbt_ct: results.filter(r => r.analysis.isPBT_CT).length,
    thuongTruc: results.filter(r => r.analysis.meetingType === 'Thường trực').length,
    btv: results.filter(r => r.analysis.meetingType === 'Ban Thường vụ').length,
    bch: results.filter(r => r.analysis.meetingType === 'Ban Chấp hành').length,
    needsReview: results.filter(r => r.analysis.needsReview).length,
  };

  return {
    success: true,
    data: results,
    summary,
    usedAI
  };
};
