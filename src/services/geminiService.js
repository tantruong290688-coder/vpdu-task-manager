import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Gen AI SDK
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

let genAI = null;
if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
} else {
    console.warn("VITE_GEMINI_API_KEY is missing. AI features will not work.");
}

/**
 * Generates a checklist for a task based on its title and description.
 * @param {string} title 
 * @param {string} description 
 * @returns {Promise<string[]>} Array of checklist item strings
 */
export const generateTaskChecklist = async (title, description) => {
    if (!genAI) {
        throw new Error("Gemini API key is not configured.");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const prompt = `
Bạn là một trợ lý quản lý dự án chuyên nghiệp.
Hãy phân rã công việc sau đây thành một danh sách các công việc con (checklist) cụ thể, rõ ràng và có thể hành động được.

Tiêu đề công việc: ${title || "Không có tiêu đề"}
Mô tả công việc: ${description || "Không có mô tả"}

Yêu cầu định dạng đầu ra:
Trả về CHỈ một mảng JSON các chuỗi (strings), mỗi chuỗi là một mục trong checklist. Số lượng từ 3 đến 7 mục.
Không trả về bất kỳ văn bản nào khác ngoài mảng JSON. Không dùng markdown block như \`\`\`json.
Ví dụ: ["Bước 1", "Bước 2", "Bước 3"]
    `.trim();

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textOutput = response.text();
        
        // Cố gắng parse JSON từ response
        try {
            // Remove potential markdown formatting if the model disobeys instructions
            let cleanText = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
            const checklist = JSON.parse(cleanText);
            if (Array.isArray(checklist)) {
                return checklist;
            }
        } catch (parseError) {
            console.error("Failed to parse Gemini output as JSON:", textOutput);
            // Fallback: split by newlines if it returned a list instead of JSON
            const fallbackList = textOutput
                .split('\n')
                .map(line => line.replace(/^[-*0-9.]+\s*/, '').trim())
                .filter(line => line.length > 0);
            if (fallbackList.length > 0) {
                return fallbackList;
            }
            throw new Error("Invalid format returned by AI.");
        }
        
    } catch (error) {
        console.error("Error generating checklist:", error);
        throw error;
    }
};
