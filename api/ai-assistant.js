import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

/* global process */

// Xác thực user qua Supabase access token (Bearer). Trả về user hoặc null.
async function verifyUser(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const url  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req, res) {
  // Chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Bắt buộc đăng nhập: chặn lạm dụng proxy AI / tiêu quota Gemini.
  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: vui lòng đăng nhập để sử dụng AI' });
  }

  const { prompt, fileData, mimeType, temperature = 0.4, maxOutputTokens } = req.body;
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

  let filePart = null;
  if (fileData) {
    try {
      const base64Data = fileData.includes(';base64,')
        ? fileData.split(';base64,')[1]
        : fileData;
      
      filePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || 'application/pdf'
        }
      };
    } catch (e) {
      console.error('Lỗi giải mã fileData:', e);
    }
  }

  let lastError = null;
  
  for (const modelName of candidateModels) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const generationConfig = {
        temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.4,
      };
      if (maxOutputTokens && Number.isFinite(Number(maxOutputTokens))) {
        generationConfig.maxOutputTokens = Number(maxOutputTokens);
      }
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig });

      let result;
      if (filePart) {
        result = await model.generateContent([prompt, filePart]);
      } else {
        result = await model.generateContent(prompt);
      }

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
