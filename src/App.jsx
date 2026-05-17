import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense, useState, useEffect, Component } from 'react';
import GlobalSearchModal from './components/GlobalSearch/GlobalSearchModal';

import MainLayout from './layouts/MainLayout';

// ── Lazy Load Pages ──────────────────────────────────────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Login = lazy(() => import('./pages/Login'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const Logs = lazy(() => import('./pages/Logs'));
const Admin = lazy(() => import('./pages/Admin'));
const TodoPage = lazy(() => import('./pages/TodoPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const Schedules = lazy(() => import('./pages/Schedules'));
const ScheduleDetail = lazy(() => import('./pages/ScheduleDetail'));
const StaffPerformance = lazy(() => import('./pages/StaffPerformance'));

// ── Loading Fallback ─────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-[400px] flex flex-col items-center justify-center p-8">
    <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4" />
    <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Đang tải dữ liệu...</p>
  </div>
);

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Đăng ký Service Worker + xử lý update + Offline Sync
  useEffect(() => {
    // Shortcuts listener
    const handleShortcuts = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcuts);

    // 1. Service Worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[SW] Registered:', reg.scope);
          // Xử lý SW mới đang chờ → kích hoạt ngay
          const activateNewSW = (worker) => {
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'activated') {
                if (!sessionStorage.getItem('sw_reloaded')) {
                  sessionStorage.setItem('sw_reloaded', '1');
                  window.location.reload();
                }
              }
            });
            worker.postMessage({ type: 'SKIP_WAITING' });
          };
          if (reg.waiting) activateNewSW(reg.waiting);
          reg.addEventListener('updatefound', () => activateNewSW(reg.installing));
        })
        .catch((err) => console.error('[SW] Registration failed:', err));
    }

    // 2. Online/Offline handling
    const handleOnline = () => {
      toast.success('Đã kết nối mạng. Đang đồng bộ dữ liệu mới...', { icon: '🌐', duration: 4000 });
      // Tự động reload các tab đang mở hoặc trigger refetch qua event nếu cần
      // Ở đây ta có thể phát một custom event để các component tự refetch
      window.dispatchEvent(new CustomEvent('app-sync-data'));
    };

    const handleOffline = () => {
      toast.error('Mất kết nối mạng. Bạn đang ở chế độ ngoại tuyến.', { icon: '📶', duration: 5000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleShortcuts);
    };
  }, []);

  return (
    <Router>
      <Toaster position="top-right" />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          
          {/* Alias cho /dashboard để tránh lỗi link cũ/bookmark */}
          <Route path="/dashboard" element={<Navigate to="/" replace />} />

          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="tasks" element={
              <ErrorBoundary>
                <Tasks />
              </ErrorBoundary>
            } />
            <Route path="schedules" element={
              <ErrorBoundary>
                <Schedules />
              </ErrorBoundary>
            } />
            <Route path="schedules/:id" element={
              <ErrorBoundary>
                <ScheduleDetail />
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
            <Route path="logs"          element={<ErrorBoundary><Logs /></ErrorBoundary>} />
            <Route path="admin"         element={<ErrorBoundary><Admin /></ErrorBoundary>} />
            <Route path="todo"          element={<ErrorBoundary><TodoPage /></ErrorBoundary>} />
            <Route path="notifications" element={
              <ErrorBoundary>
                <NotificationsPage />
              </ErrorBoundary>
            } />
            <Route path="performance" element={
              <ErrorBoundary>
                <StaffPerformance />
              </ErrorBoundary>
            } />
          </Route>
        </Routes>
      </Suspense>
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </Router>
  );
}

export default App;
