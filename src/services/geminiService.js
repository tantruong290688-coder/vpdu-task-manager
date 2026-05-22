/**
 * Gemini AI Service calling Vercel Serverless Proxy
 */

export const generateTaskChecklist = async (title, description, aiContext = '', fileData = '', mimeType = '') => {
    const contextInstruction = aiContext ? `\nDưới đây là tài liệu nguồn/bối cảnh đi kèm (quan trọng để trích xuất checklist):\n"""\n${aiContext}\n"""\nHãy phân tích kỹ tài liệu trên để đưa ra các bước công việc phù hợp.` : '';

    const prompt = `
Bạn là một trợ lý quản lý dự án chuyên nghiệp.
Hãy phân rã công việc sau đây thành một danh sách các công việc con (checklist) cụ thể, rõ ràng và có thể hành động được.

Tiêu đề công việc: ${title || "Không có tiêu đề"}
Mô tả công việc: ${description || "Không có mô tả"}${contextInstruction}

Yêu cầu định dạng đầu ra:
Trả về CHỈ một mảng JSON các chuỗi (strings), mỗi chuỗi là một mục trong checklist. Số lượng từ 3 đến 7 mục.
Không trả về bất kỳ văn bản nào khác ngoài mảng JSON. Không dùng markdown block.
Ví dụ: ["Bước 1", "Bước 2", "Bước 3"]
    `.trim();

    try {
        // Gọi tới API Proxy trên Vercel thay vì gọi trực tiếp tới Google từ Browser
        const response = await fetch('/api/ai-assistant', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, fileData, mimeType })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Lỗi hệ thống AI');
        }

        const data = await response.json();
        const textOutput = data.text;

        if (!textOutput) {
            throw new Error("AI không trả về nội dung.");
        }
        
        try {
            let cleanText = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
            const checklist = JSON.parse(cleanText);
            if (Array.isArray(checklist)) {
                return checklist;
            }
        } catch (parseError) {
            const fallbackList = textOutput
                .split('\n')
                .map(line => line.replace(/^[-*0-9.]+\s*/, '').trim())
                .filter(line => line.length > 0);
            return fallbackList.length > 0 ? fallbackList : ["Thực hiện nhiệm vụ", "Kiểm tra kết quả"];
        }
        
    } catch (error) {
        console.error("Error generating checklist via proxy:", error);
        throw error;
    }
};

/**
 * AI Service: Phân tích văn bản nguồn để điền tự động form (Autofill)
 */
export const analyzeTaskContext = async (title, description, context, fileData = '', mimeType = '') => {
    const prompt = `
Bạn là một trợ lý ảo quản lý dự án xuất sắc. 
Hãy phân tích nội dung công việc dưới đây (bao gồm Tiêu đề hiện tại, Mô tả, Văn bản nguồn/Bối cảnh, hoặc tệp đính kèm) để tự động phân loại, trích xuất thông tin quan trọng và tự động đề xuất tiêu đề nhiệm vụ chuẩn xác.

Tiêu đề hiện tại: ${title || "Chưa nhập"}
Nội dung/Mô tả: ${description || "Chưa nhập"}
Văn bản nguồn/Bối cảnh: ${context || "Không có"}

YÊU CẦU:
Trả về CHỈ một đối tượng JSON với các khóa (keys) chính xác như sau, không có bất kỳ văn bản nào khác bao quanh:
{
  "title": "...", // TÊN NHIỆM VỤ / CÔNG VIỆC: Hãy dựa trên Văn bản nguồn/Bối cảnh (nếu có), Tệp đính kèm (nếu có), Nội dung/Mô tả, hoặc Tiêu đề hiện tại để tóm tắt thành một tiêu đề nhiệm vụ ngắn gọn, chuyên nghiệp theo dạng TRÍCH YẾU nội dung công văn hành chính Việt Nam. LƯU Ý: Đi thẳng vào nội dung công việc, TUYỆT ĐỐI KHÔNG sử dụng các tiền tố như "V/v", "Về việc", "Về", "Công văn về việc", v.v. ở đầu câu. Hãy bắt đầu trực tiếp bằng các động từ hành động hoặc cụm từ tóm tắt nhiệm vụ chính (Ví dụ: "Tổ chức hội nghị sơ kết...", "Báo cáo tiến độ...", "Triển khai kế hoạch...", "Giải quyết đơn thư...", "Tham mưu xây dựng văn bản..."). Bảo đảm phản ánh đúng và bao quát nội dung cốt lõi của công văn/tài liệu được cung cấp. Nếu không thể trích xuất được thông tin ý nghĩa từ văn bản nguồn hoặc tệp đính kèm, hãy giữ nguyên tiêu đề hiện tại nhưng loại bỏ hoàn toàn tiền tố "V/v" nếu có ở đầu.
  "taskGroup": "...", // CHỌN 1 trong các tùy chọn: 'Tham mưu - tổng hợp', 'Theo dõi, đôn đốc', 'Soạn thảo, thẩm định văn bản', 'Hội nghị - giao ban', 'Văn thư - lưu trữ', 'Kế toán - tài chính', 'Hành chính - quản trị', 'Hậu cần - lễ tân', 'Nhiệm vụ đột xuất/khác' (nếu không rõ, chọn 'Nhiệm vụ đột xuất/khác')
  "workArea": "...", // CHỌN 1 trong các tùy chọn: 'Tổng hợp chung', 'Công tác xây dựng Đảng', 'Chính quyền', 'Kinh tế', 'Văn hóa - Xã hội', 'Nội chính', 'Tuyên giáo', 'Dân vận', 'Trung tâm chính trị', 'Kiểm tra, giám sát', 'Quốc phòng - an ninh', 'Tôn giáo', 'Phòng, chống tham nhũng/THTK, CLP', 'Văn thư - lưu trữ', 'Tài chính - tài sản', 'CNTT - chuyển đổi số', 'Hành chính - quản trị', 'Hội nghị - hậu cần', 'Đối thoại' (nếu không rõ, chọn 'Tổng hợp chung')
  "priority": "...", // CHỌN 1 trong các tùy chọn: 'high', 'normal', 'low'. ('high' nếu khẩn cấp, có hạn gấp; 'low' nếu là việc phụ).
  "dueDate": "...", // TRÍCH XUẤT ngày tháng (hạn hoàn thành) nếu có trong văn bản, định dạng YYYY-MM-DD. Nếu văn bản viết "hoàn thành trong ngày 25/11", hãy chuyển thành 2026-11-25 (giả sử năm hiện tại là 2026). Nếu không có, trả về giá trị null (không phải chuỗi "null").
  "taskType": "..." // CHỌN 1 trong các tùy chọn: 'Thường xuyên', 'Đột xuất', 'Định kỳ'.
}
    `.trim();

    try {
        const response = await fetch('/api/ai-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, temperature: 0.2, fileData, mimeType }) // Temp thấp để output JSON chính xác
        });

        if (!response.ok) throw new Error('Lỗi kết nối AI Autofill');

        const data = await response.json();
        let cleanText = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (error) {
        console.error("Error analyzing task context:", error);
        throw error;
    }
};

/**
 * AI Service: Dự báo rủi ro trễ hạn (Risk Prediction)
 */
export const predictTaskRisk = async (taskDetails) => {
    // ── BỘ NHỚ ĐỆM CACHING TRÌNH DUYỆT ──
    const taskId = taskDetails.id;
    const cacheKey = `task_risk_cache_${taskId}`;
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (taskId) {
        try {
            const cachedValue = localStorage.getItem(cacheKey);
            if (cachedValue) {
                const parsed = JSON.parse(cachedValue);
                // Kiểm tra 3 điều kiện: 
                // 1. Cùng ngày hôm nay
                // 2. Trùng khớp tiến độ (%)
                // 3. Trùng khớp số lượng checklists
                const isSameDay = parsed.lastUpdated === todayStr;
                const isSameProgress = parsed.progress === taskDetails.progress;
                const isSameChecklists = 
                    parsed.totalChecklists === taskDetails.totalChecklists && 
                    parsed.completedChecklists === taskDetails.completedChecklists;

                if (isSameDay && isSameProgress && isSameChecklists) {
                    console.log(`[AI-Risk-Cache] Truy xuất thành công từ bộ nhớ đệm cho nhiệm vụ ${taskId}`);
                    return {
                        riskLevel: parsed.riskLevel,
                        reason: parsed.reason,
                        advice: parsed.advice,
                        isFromCache: true
                    };
                }
            }
        } catch (cacheErr) {
            console.warn('[AI-Risk-Cache] Lỗi đọc bộ nhớ đệm:', cacheErr);
        }
    }

    const prompt = `
Bạn là chuyên gia phân tích rủi ro dự án.
Dưới đây là thông tin hiện tại của một nhiệm vụ đang thực hiện:

Tên nhiệm vụ: ${taskDetails.title}
Ngày bắt đầu: ${taskDetails.startDate}
Hạn hoàn thành: ${taskDetails.dueDate}
Tiến độ hiện tại: ${taskDetails.progress}%
Tổng số checklist: ${taskDetails.totalChecklists}
Số checklist đã xong: ${taskDetails.completedChecklists}
Phần trăm thời gian đã trôi qua: ${taskDetails.elapsedTimePercent}%

YÊU CẦU:
Hãy phân tích rủi ro trễ hạn của nhiệm vụ này.
Trả về CHỈ một đối tượng JSON với các khóa sau, không có văn bản nào khác:
{
  "riskLevel": "...", // Chỉ được chọn: "Thấp", "Trung bình", hoặc "Cao"
  "reason": "...", // Giải thích ngắn gọn (1-2 câu) TẠI SAO lại đánh giá rủi ro ở mức đó dựa trên tiến độ và thời gian đã trôi qua.
  "advice": "..." // Đưa ra 1 lời khuyên thực tế (1-2 câu) cho Lãnh đạo hoặc Người thực hiện để khắc phục rủi ro hoặc duy trì phong độ.
}
    `.trim();

    try {
        const response = await fetch('/api/ai-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, temperature: 0.7 })
        });

        if (!response.ok) throw new Error('Lỗi kết nối AI Risk Prediction');

        const data = await response.json();
        let cleanText = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanText);

        // Lưu kết quả mới vào bộ nhớ đệm
        if (taskId) {
            try {
                const cachePayload = {
                    riskLevel: result.riskLevel,
                    reason: result.reason,
                    advice: result.advice,
                    progress: taskDetails.progress,
                    totalChecklists: taskDetails.totalChecklists,
                    completedChecklists: taskDetails.completedChecklists,
                    lastUpdated: todayStr
                };
                localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
                console.log(`[AI-Risk-Cache] Đã lưu mới kết quả phân tích vào bộ nhớ đệm cho nhiệm vụ ${taskId}`);
            } catch (cacheErr) {
                console.warn('[AI-Risk-Cache] Lỗi ghi bộ nhớ đệm:', cacheErr);
            }
        }

        return result;
    } catch (error) {
        console.error("Error predicting task risk:", error);
        throw error;
    }
};
