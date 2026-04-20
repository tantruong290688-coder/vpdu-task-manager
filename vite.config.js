import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Middleware to run Vercel Serverless Functions locally via Vite
const apiPlugin = (env) => ({
  name: 'api-plugin',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url.startsWith('/api/')) {
        // Load env into process.env for the serverless function
        Object.assign(process.env, env);

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            if (body) req.body = JSON.parse(body);
          } catch (e) {
            req.body = {};
          }
          
          res.status = (code) => { res.statusCode = code; return res; };
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          };

          try {
            const urlPath = req.url.split('?')[0];
            const filePath = path.join(process.cwd(), urlPath + '.js');
            
            if (fs.existsSync(filePath)) {
              import('url').then(async (urlModule) => {
                const fileUrl = urlModule.pathToFileURL(filePath);
                fileUrl.searchParams.set('t', Date.now());
                const module = await import(fileUrl.href);
                await module.default(req, res);
              }).catch(e => {
                console.error('Import Error:', e);
                res.status(500).json({ error: e.message });
              });
            } else {
              res.status(404).json({ error: 'API endpoint not found' });
            }
          } catch (e) {
            console.error('API Middleware Error:', e);
            res.status(500).json({ error: e.message });
          }
        });
      } else {
        next();
      }
    });
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), apiPlugin(env)],
    build: {
      chunkSizeWarningLimit: 1500
    }
  };
})
