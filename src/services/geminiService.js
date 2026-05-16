/**
 * Gemini AI Service calling Vercel Serverless Proxy
 */

export const generateTaskChecklist = async (title, description) => {
    const prompt = `
Bạn là một trợ lý quản lý dự án chuyên nghiệp.
Hãy phân rã công việc sau đây thành một danh sách các công việc con (checklist) cụ thể, rõ ràng và có thể hành động được.

Tiêu đề công việc: ${title || "Không có tiêu đề"}
Mô tả công việc: ${description || "Không có mô tả"}

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
