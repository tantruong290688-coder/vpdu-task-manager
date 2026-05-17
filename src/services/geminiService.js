/**
 * Gemini AI Service calling Vercel Serverless Proxy
 */

export const generateTaskChecklist = async (title, description, aiContext = '') => {
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
            body: JSON.stringify({ prompt })
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
export const analyzeTaskContext = async (title, description, context) => {
    const prompt = `
Bạn là một trợ lý ảo quản lý dự án xuất sắc. 
Hãy phân tích nội dung công việc dưới đây để tự động phân loại và rút trích các thông tin quan trọng.

Tiêu đề: ${title || "Chưa nhập"}
Nội dung/Mô tả: ${description || "Chưa nhập"}
Văn bản nguồn/Bối cảnh: ${context || "Không có"}

YÊU CẦU:
Trả về CHỈ một đối tượng JSON với các khóa (keys) chính xác như sau, không có bất kỳ văn bản nào khác bao quanh:
{
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
            body: JSON.stringify({ prompt, temperature: 0.2 }) // Temp thấp để output JSON chính xác
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
        return JSON.parse(cleanText);
    } catch (error) {
        console.error("Error predicting task risk:", error);
        throw error;
    }
};
