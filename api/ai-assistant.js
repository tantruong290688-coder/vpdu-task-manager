import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // Chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt } = req.body;
  const apiKey = process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key is not configured on Vercel' });
  }

  const candidateModels = [
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest"
  ];

  let lastError = null;
  
  for (const modelName of candidateModels) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return res.status(200).json({ text, model: modelName });
    } catch (error) {
      console.error(`Attempt with ${modelName} failed:`, error.message);
      lastError = error;
      // Nếu không phải lỗi 404 (ví dụ lỗi xác thực 401), thì không thử model khác
      if (error.status && error.status !== 404) {
        break;
      }
    }
  }

  return res.status(lastError?.status || 500).json({ 
    error: lastError?.message || 'Internal Server Error',
    details: lastError?.response?.data || null
  });
}
