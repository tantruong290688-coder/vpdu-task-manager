import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { rawText, currentWeek, currentYear, userRole } = req.body;
  const apiKey = process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key is not configured.' });
  }

  if (!rawText) {
    return res.status(400).json({ error: 'No text provided' });
  }

  // Danh sách models để dự phòng
  const candidateModels = [
    "gemini-3.1-flash",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ];

  const systemPrompt = `Bạn là trợ lý AI chuyên phân tích lịch công tác cho Văn phòng Đảng ủy cấp xã.
Nhiệm vụ của bạn là bóc tách sự kiện từ văn bản thô (giấy mời, thông báo, kế hoạch) và chuyển thành dữ liệu JSON.

HƯỚNG DẪN QUAN TRỌNG:
1. NẾU SỰ KIỆN KÉO DÀI NHIỀU NGÀY: Bạn PHẢI tách thành nhiều đối tượng JSON riêng biệt, mỗi đối tượng tương ứng với 1 ngày.
   - Ví dụ: "Từ ngày 20 đến 22/5" -> Phải tạo 3 dòng cho ngày 20, 21, 22.
   - Nếu văn bản không nói rõ nội dung của các ngày ở giữa, hãy điền content: "Tiếp tục tham dự theo chương trình/kế hoạch".
2. TÍNH TOÁN TUẦN/NĂM:
   - Dựa vào ngày bóc tách được (ví dụ 20/05/2026), hãy tự tính toán \`week_number\` (số tuần trong năm) và \`year\`. Nếu văn bản không có năm, dùng currentYear: ${currentYear}.
   - Ghi chú: Tuần bắt đầu từ Thứ Hai.
3. CHUẨN HÓA DỮ LIỆU:
   - \`work_time\`: Chuẩn hóa về định dạng HHhMM (ví dụ: "7h30", "14h00"). Nếu là "Cả ngày", để "Cả ngày". Nếu không có, để trống "".
   - \`work_date\`: Chuẩn hóa về DD/MM/YYYY.
   - \`weekday\`: Bắt buộc là một trong: "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật".
   - \`session\`: "Sáng", "Chiều", hoặc "Cả ngày". Tự suy luận từ giờ (trước 12h là Sáng).
4. QUY TẮC CHỦ TRÌ (CHAIR) VÀ THAM DỰ:
   - "Bí thư Đảng ủy" hoặc "Đ/c Hoàng Anh Ngọc" -> chair: "Đ/c Bí thư"
   - "Phó Bí thư Thường trực Đảng ủy" hoặc "Đ/c Lê Thị Hồng Hải" -> chair: "Đ/c Phó Bí thư"
   - "Phó Bí thư Đảng ủy, Chủ tịch UBND" -> chair: "Phó Bí thư"
   - "Thường trực Đảng ủy" -> chair: "TTĐU", leader_attendees: ["Đ/c Bí thư", "Đ/c Phó Bí thư"]
   - NẾU văn bản ghi "Đại diện Thường trực" hoặc "Đại diện lãnh đạo", thì KHÔNG gán cứng \`chair\`, mà gán \`requires_assignment\`: true, \`assignment_note\`: "Cần phân công đại diện".
5. LOẠI HÌNH (type): "Hội nghị", "Họp", "Làm việc", "Kiểm tra", "Tiếp dân", "Nghỉ", "Khác".

CẤU TRÚC JSON BẮT BUỘC (Trả về MẢNG các object, không kèm Markdown code block):
[
  {
    "week_number": <number>,
    "year": <number>,
    "work_date": "DD/MM/YYYY",
    "weekday": "Thứ...",
    "work_time": "HHhMM",
    "session": "Sáng/Chiều/Cả ngày",
    "content": "Nội dung...",
    "chair": "...",
    "participants": "...",
    "location": "...",
    "preparation": "...",
    "type": "Hội nghị",
    "leader_attendees": ["...", "..."],
    "requires_assignment": <boolean>,
    "assignment_note": "...",
    "source_excerpt": "Trích đoạn ngắn văn bản gốc làm căn cứ",
    "original_date_range": "Nếu sự kiện kéo dài, ghi khoảng thời gian gốc ở đây",
    "ai_confidence": <number từ 0 đến 1, nếu chắc chắn thì 0.9 - 1>
  }
]
CHỈ TRẢ VỀ JSON, KHÔNG CÓ BẤT KỲ VĂN BẢN NÀO KHÁC.`;

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + "\n\n=== VĂN BẢN CẦN PHÂN TÍCH ===\n" + rawText }] }
        ]
      });

      const responseText = result.response.text();
      // Chắc chắn trả về mảng JSON
      const parsedJSON = JSON.parse(responseText);

      return res.status(200).json({ 
        success: true, 
        data: parsedJSON, 
        model: modelName 
      });

    } catch (error) {
      console.error(`[AI-Parse] Attempt with ${modelName} failed:`, error.message);
      lastError = error;
      
      // Lỗi syntax parsing JSON
      if (error instanceof SyntaxError) {
        // AI không trả về chuẩn JSON, thử model khác
        continue;
      }
      
      if (error.status && error.status !== 404 && error.status !== 503) {
        break; // Lỗi 401 hoặc lỗi nghiêm trọng không cần thử model khác
      }
    }
  }

  return res.status(500).json({ 
    success: false,
    error: 'Hệ thống AI chưa phân tích được văn bản, vui lòng thử lại sau ít phút.',
    details: lastError?.message
  });
}
