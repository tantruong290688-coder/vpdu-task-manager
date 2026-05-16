/**
 * Gemini AI Service using direct REST API (v1)
 * This avoids SDK version issues (like 404 on v1beta)
 */

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;

/**
 * Generates a checklist for a task based on its title and description.
 * @param {string} title 
 * @param {string} description 
 * @returns {Promise<string[]>} Array of checklist item strings
 */
export const generateTaskChecklist = async (title, description) => {
    if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
    }

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

    const payload = {
        contents: [
            {
                parts: [
                    { text: prompt }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.2,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
        }
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API Error:", errorData);
            throw new Error(`AI Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textOutput) {
            throw new Error("AI returned empty response.");
        }
        
        // Parse JSON output
        try {
            let cleanText = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
            const checklist = JSON.parse(cleanText);
            if (Array.isArray(checklist)) {
                return checklist;
            }
        } catch (parseError) {
            console.error("Failed to parse Gemini output as JSON:", textOutput);
            const fallbackList = textOutput
                .split('\n')
                .map(line => line.replace(/^[-*0-9.]+\s*/, '').trim())
                .filter(line => line.length > 0);
            return fallbackList.length > 0 ? fallbackList : ["Cần thực hiện bước 1", "Cần thực hiện bước 2"];
        }
        
    } catch (error) {
        console.error("Error generating checklist:", error);
        throw error;
    }
};
