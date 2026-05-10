import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { MessageProvider } from './context/MessageContext.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── TanStack Query Client ────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,       // 2 phút: dữ liệu còn "tươi", không refetch
      gcTime: 10 * 60 * 1000,         // 10 phút: giữ cache trong memory
      retry: 1,                        // Thử lại 1 lần khi lỗi
      refetchOnWindowFocus: true,      // Refetch khi người dùng quay lại tab
      refetchOnReconnect: true,        // Refetch khi có mạng trở lại
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <MessageProvider>
            <App />
          </MessageProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
