/**
 * Gemini AI Service with Smart Retry and Detailed Logging
 */

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// List of model endpoints to try in order
const MODEL_ENDPOINTS = [
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
    "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent"
];

/**
 * Generates a checklist for a task based on its title and description.
 */
export const generateTaskChecklist = async (title, description) => {
    if (!apiKey) {
        throw new Error("Gemini API key is not configured in environment variables.");
    }

    const prompt = `
Bạn là một trợ lý quản lý dự án chuyên nghiệp.
Hãy phân rã công việc sau đây thành một danh sách các công việc con (checklist) cụ thể, rõ ràng và có thể hành động được.

Tiêu đề công việc: ${title || "Không có tiêu đề"}
Mô tả công việc: ${description || "Không có mô tả"}

Yêu cầu định dạng đầu ra:
Trả về CHỈ một mảng JSON các chuỗi (strings), mỗi chuỗi là một mục trong checklist. Số lượng từ 3 đến 7 mục.
Không trả về bất kỳ văn bản nào khác ngoài mảng JSON.
    `.trim();

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
    };

    let lastError = null;

    // Try each endpoint until one works
    for (const url of MODEL_ENDPOINTS) {
        try {
            console.log(`[AI Debug] Attempting endpoint: ${url}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textOutput) {
                    try {
                        let cleanText = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
                        const checklist = JSON.parse(cleanText);
                        if (Array.isArray(checklist)) return checklist;
                    } catch (e) {
                        const list = textOutput.split('\n').map(l => l.replace(/^[-*0-9.]+\s*/, '').trim()).filter(l => l.length > 0);
                        if (list.length > 0) return list;
                    }
                }
            } else {
                const err = await response.json();
                lastError = err.error?.message || response.statusText;
                console.warn(`[AI Debug] Endpoint failed: ${url} - ${lastError}`);
            }
        } catch (e) {
            lastError = e.message;
            console.warn(`[AI Debug] Network error for ${url}: ${e.message}`);
        }
    }

    throw new Error(`Google AI từ chối: ${lastError}. Vui lòng kiểm tra quyền hạn của API Key hoặc thử tài khoản Gmail khác.`);
};
