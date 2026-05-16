/**
 * Gemini AI Service with Multi-Format Fallback
 */

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Trying even more varied formats
const MODEL_ENDPOINTS = [
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1beta/gemini-1.5-flash:generateContent", // Format without 'models/' prefix
    "https://generativelanguage.googleapis.com/v1/gemini-1.5-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
];

export const generateTaskChecklist = async (title, description) => {
    if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
    }

    const prompt = `
Bạn là một trợ lý quản lý dự án chuyên nghiệp.
Hãy phân rã công việc sau đây thành một danh sách các công việc con (checklist) cụ thể, rõ ràng và có thể hành động được.
Tiêu đề công việc: ${title || "Không có tiêu đề"}
Mô tả công việc: ${description || "Không có mô tả"}
Trả về CHỈ một mảng JSON các chuỗi.
    `.trim();

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
    };

    let lastError = "";
    let lastStatusCode = 0;

    for (const url of MODEL_ENDPOINTS) {
        try {
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
                    let cleanText = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
                    return JSON.parse(cleanText);
                }
            } else {
                const err = await response.json();
                lastError = err.error?.message || response.statusText;
                lastStatusCode = response.status;
                console.warn(`[AI Debug] Failed ${url}: ${lastStatusCode} - ${lastError}`);
            }
        } catch (e) {
            lastError = e.message;
        }
    }

    throw new Error(`Google từ chối (${lastStatusCode}): ${lastError}. Hãy kiểm tra xem bạn có thể chat được tại aistudio.google.com với Key này không.`);
};
