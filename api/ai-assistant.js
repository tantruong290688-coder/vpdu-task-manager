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

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Sử dụng v1beta qua SDK để có độ tương thích cao nhất trên Server
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Vercel AI Proxy Error:', error);
    return res.status(error.status || 500).json({ 
      error: error.message || 'Internal Server Error',
      details: error.response?.data || null
    });
  }
}
