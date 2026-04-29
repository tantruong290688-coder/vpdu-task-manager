import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { useEffect, Component } from 'react';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Evaluations from './pages/Evaluations';
import ResetPasswordPage from './pages/ResetPasswordPage';
import Logs from './pages/Logs';
import Admin from './pages/Admin';
import TodoPage from './pages/TodoPage';
import NotificationsPage from './pages/NotificationsPage';

// ── Error Boundary: bắt mọi lỗi render để không bị màn hình trắng ──
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-4 text-3xl">
            ⚠️
          </div>
          <h2 className="text-[18px] font-extrabold text-slate-800 dark:text-white mb-2">
            Có lỗi xảy ra
          </h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-6 text-center max-w-sm">
            {this.state.error?.message || 'Lỗi không xác định'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.history.back(); }}
            className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-[13px] hover:bg-blue-700 transition-colors"
          >
            ← Quay lại
          </button>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-5 py-2 text-blue-600 font-semibold text-[13px] hover:underline"
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  // Đăng ký Service Worker + xử lý update
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Registered:', reg.scope);

        // Xử lý SW mới đang chờ → kích hoạt ngay
        const activateNewSW = (worker) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated') {
              // Reload để dùng SW mới (chỉ reload 1 lần)
              const key = 'sw_reload_' + Date.now();
              if (!sessionStorage.getItem('sw_reloaded')) {
                sessionStorage.setItem('sw_reloaded', '1');
                window.location.reload();
              }
            }
          });
          worker.postMessage({ type: 'SKIP_WAITING' });
        };

        if (reg.waiting) {
          activateNewSW(reg.waiting);
        }
        reg.addEventListener('updatefound', () => {
          activateNewSW(reg.installing);
        });
      })
      .catch((err) => console.error('[SW] Registration failed:', err));
  }, []);

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={
            <ErrorBoundary>
              <Tasks />
            </ErrorBoundary>
          } />
          <Route path="all-tasks" element={
            <ErrorBoundary>
              <Tasks />
            </ErrorBoundary>
          } />
          <Route path="my-tasks" element={
            <ErrorBoundary>
              <Tasks />
            </ErrorBoundary>
          } />
          <Route path="evaluations"   element={<Evaluations />} />
          <Route path="logs"          element={<Logs />} />
          <Route path="admin"         element={<Admin />} />
          <Route path="todo"          element={<TodoPage />} />
          <Route path="notifications" element={
            <ErrorBoundary>
              <NotificationsPage />
            </ErrorBoundary>
          } />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
