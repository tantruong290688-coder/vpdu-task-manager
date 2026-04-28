// ═══════════════════════════════════════════════════════════
// Component: EnablePushButton + IOSInstallGuide
// Nút bật/tắt thông báo push, kèm hướng dẫn iOS
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { Bell, BellOff, BellRing, Smartphone, X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import toast from 'react-hot-toast';

// ── iOS Install Guide ───────────────────────────────────
function IOSInstallGuide({ onClose }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Smartphone size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-extrabold text-slate-800 dark:text-white text-[15px]">
              Cài app lên màn hình chính
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[13px] text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          Để nhận thông báo trên <strong>iPhone/iPad</strong>, bạn cần cài ứng dụng vào Màn hình chính:
        </p>

        <ol className="space-y-3 mb-6">
          {[
            { step: '1', text: 'Bấm nút Chia sẻ (□↑) ở thanh dưới Safari' },
            { step: '2', text: 'Chọn "Thêm vào Màn hình Chính"' },
            { step: '3', text: 'Bấm "Thêm" để xác nhận' },
            { step: '4', text: 'Mở lại app từ màn hình chính và bật thông báo' },
          ].map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </span>
              <span className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{text}</span>
            </li>
          ))}
        </ol>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4">
          <p className="text-[12px] text-amber-800 dark:text-amber-300 font-medium flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            Yêu cầu iOS/iPadOS 16.4 trở lên và phải mở từ Safari
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-[14px]"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
}

// ── Enable Push Button ──────────────────────────────────
export default function EnablePushButton({ variant = 'default' }) {
  const {
    permission, isSubscribed, isLoading,
    isSupported, isIOS, isStandalone,
    error, subscribe, unsubscribe,
  } = usePushNotifications();

  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const handleClick = async () => {
    // iOS chưa cài PWA
    if (isIOS && !isStandalone) {
      setShowIOSGuide(true);
      return;
    }

    // Không hỗ trợ push
    if (!isSupported) {
      toast.error('Trình duyệt không hỗ trợ thông báo đẩy');
      return;
    }

    if (isSubscribed) {
      // Tắt thông báo
      await unsubscribe();
      toast.success('Đã tắt thông báo');
    } else {
      // Bật thông báo
      const success = await subscribe();
      if (success) {
        toast.success('Đã bật thông báo!');
      } else if (permission === 'denied') {
        toast.error('Vui lòng bật lại quyền thông báo trong cài đặt trình duyệt');
      }
    }
  };

  // ── Compact variant (dùng trong dropdown) ──────────────
  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleClick}
          disabled={isLoading}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all w-full
            ${isSubscribed
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
              : permission === 'denied'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
            }
          `}
        >
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isSubscribed ? (
            <BellRing size={14} />
          ) : (
            <Bell size={14} />
          )}
          {isLoading
            ? 'Đang xử lý...'
            : isSubscribed
              ? 'Thông báo: Đã bật'
              : permission === 'denied'
                ? 'Thông báo bị chặn'
                : isIOS && !isStandalone
                  ? 'Cài app để bật thông báo'
                  : 'Bật thông báo'}
        </button>
        {showIOSGuide && <IOSInstallGuide onClose={() => setShowIOSGuide(false)} />}
      </>
    );
  }

  // ── Full card variant (dùng trong trang Notifications) ─
  return (
    <>
      <div className={`rounded-2xl border p-4 sm:p-5 flex items-center gap-4 transition-all
        ${isSubscribed
          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
          : permission === 'denied'
            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
            : 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border-amber-200 dark:border-amber-800'
        }
      `}>
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0
          ${isSubscribed ? 'bg-green-100 dark:bg-green-900/30' : permission === 'denied' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}
        `}>
          {isSubscribed
            ? <CheckCircle size={22} className="text-green-600 dark:text-green-400" />
            : permission === 'denied'
              ? <AlertCircle size={22} className="text-red-600 dark:text-red-400" />
              : <Bell size={22} className="text-amber-600 dark:text-amber-400" />
          }
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-[14px] ${
            isSubscribed ? 'text-green-800 dark:text-green-300' :
            permission === 'denied' ? 'text-red-800 dark:text-red-300' :
            'text-amber-800 dark:text-amber-300'
          }`}>
            {isSubscribed
              ? 'Thông báo đẩy đã được bật'
              : permission === 'denied'
                ? 'Thông báo đẩy bị chặn'
                : isIOS && !isStandalone
                  ? 'Cần cài app để bật thông báo'
                  : 'Chưa bật thông báo đẩy'}
          </p>
          <p className="text-[12px] mt-0.5 text-slate-600 dark:text-slate-400 leading-relaxed">
            {isSubscribed
              ? 'Bạn sẽ nhận thông báo kể cả khi không mở app.'
              : permission === 'denied'
                ? 'Vào cài đặt trình duyệt → Thông báo → Cho phép trang này.'
                : isIOS && !isStandalone
                  ? 'iOS yêu cầu cài PWA vào Màn hình chính trước.'
                  : 'Bật để nhận thông báo nhiệm vụ & tin nhắn dù không mở app.'}
          </p>
          {error && (
            <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">{error}</p>
          )}
        </div>

        {/* Button */}
        {permission !== 'denied' && (
          <button
            onClick={handleClick}
            disabled={isLoading}
            className={`shrink-0 px-4 py-2.5 rounded-xl font-bold text-[13px] transition-all disabled:opacity-50 flex items-center gap-2
              ${isSubscribed
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-[0_4px_12px_rgba(217,119,6,0.3)]'
              }
            `}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isSubscribed ? (
              <BellOff size={15} />
            ) : (
              <Bell size={15} />
            )}
            {isLoading ? 'Đang xử lý...' : isSubscribed ? 'Tắt' : isIOS && !isStandalone ? 'Hướng dẫn' : 'Bật ngay'}
          </button>
        )}
      </div>

      {showIOSGuide && <IOSInstallGuide onClose={() => setShowIOSGuide(false)} />}
    </>
  );
}

export { IOSInstallGuide };
