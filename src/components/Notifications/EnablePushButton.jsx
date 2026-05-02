// ═══════════════════════════════════════════════════════════
// Component: EnablePushButton + IOSInstallGuide
// Nút bật/tắt thông báo push, kèm hướng dẫn iOS
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { Bell, BellOff, BellRing, Smartphone, X, CheckCircle, AlertCircle, Info, Download } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { usePWAInstall } from '../../hooks/usePWAInstall';
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
      {/* PWA Install Section (Desktop/Android) */}
      {isInstallable && (
        <div className="mt-4 p-5 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-3xl flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <Download className="text-blue-600 dark:text-blue-400 animate-bounce" size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-extrabold text-blue-900 dark:text-blue-300 text-[15px]">Cài đặt ứng dụng</h4>
            <p className="text-[12px] text-blue-700 dark:text-blue-400/80 mt-0.5 leading-relaxed">
              Cài đặt để có biểu tượng trên máy tính và trải nghiệm như phần mềm chuyên nghiệp.
            </p>
          </div>
          <button 
            onClick={installApp}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-[13px] shadow-lg shadow-blue-600/20 transition-all active:scale-95 shrink-0"
          >
            Cài ngay
          </button>
        </div>
      )}
    </div>
  );
}

// ── Enable Push Button ──────────────────────────────────
export default function EnablePushButton({ variant = 'default' }) {
  const {
    permission, isSubscribed, isLoading,
    isSupported, isIOS, isStandalone,
    error, subscribe, unsubscribe, sendTestNotification
  } = usePushNotifications();
  const { isInstallable, installApp } = usePWAInstall();

  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      console.log('--- Diagnostic ---');
      console.log('Public Key present:', !!import.meta.env.VITE_VAPID_PUBLIC_KEY);
      console.log('Subscription state:', isSubscribed);
      
      if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) {
        toast.error('Lỗi: Thiếu VAPID Public Key (VITE_VAPID_PUBLIC_KEY).');
        setIsTesting(false);
        return;
      }

      await sendTestNotification();
      toast.success('Đã gửi thông báo thử nghiệm!');
    } catch (err) {
      console.error('Test error:', err);
      toast.error('Gửi thử thất bại: ' + err.message);
    } finally {
      setIsTesting(false);
    }
  };

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
      <div className={`rounded-3xl border p-6 flex flex-col gap-6 shadow-sm transition-all
        ${isSubscribed
          ? 'bg-green-50/50 dark:bg-green-950/10 border-green-200/50 dark:border-green-800/30'
          : permission === 'denied'
            ? 'bg-red-50/50 dark:bg-red-950/10 border-red-200/50 dark:border-red-800/30'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none'
        }
      `}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm
            ${isSubscribed ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 
              permission === 'denied' ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 
              'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'}
          `}>
            {isSubscribed ? <BellRing size={28} /> : permission === 'denied' ? <AlertCircle size={28} /> : <Bell size={28} />}
          </div>
          <div className="flex-1">
            <h4 className="font-black text-[17px] text-slate-800 dark:text-white leading-tight">
              {isSubscribed ? 'Thông báo đẩy đã bật' : 
               permission === 'denied' ? 'Thông báo bị chặn' : 
               isIOS && !isStandalone ? 'Cần cài đặt PWA' : 'Chưa bật thông báo'}
            </h4>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {isSubscribed ? 'Bạn sẽ nhận được tin nhắn và nhiệm vụ mới ngay cả khi đóng ứng dụng.' : 
               permission === 'denied' ? 'Vui lòng cho phép trong cài đặt trình duyệt để tiếp tục.' :
               isIOS && !isStandalone ? 'Hãy thêm app vào màn hình chính để nhận thông báo.' : 'Đừng bỏ lỡ các cập nhật quan trọng từ VPĐU.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {permission !== 'denied' && (
            <button
              onClick={handleClick}
              disabled={isLoading}
              className={`flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black text-[15px] transition-all active:scale-95 shadow-lg
                ${isSubscribed
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                }
              `}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-3 border-current border-t-transparent rounded-full animate-spin" />
              ) : isSubscribed ? (
                <>
                  <BellOff size={20} />
                  <span>Tắt thông báo</span>
                </>
              ) : (
                <>
                  <BellRing size={20} className="animate-pulse" />
                  <span>Bật ngay bây giờ</span>
                </>
              )}
            </button>
          )}

          {isSubscribed && (
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-[15px] transition-all active:scale-95 shadow-lg shadow-amber-500/25"
            >
              {isTesting ? (
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Smartphone size={20} />
                  <span>Gửi thử nghiệm</span>
                </>
              )}
            </button>
          )}

          {permission === 'denied' && (
            <div className="sm:col-span-2 p-4 bg-red-100/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3">
              <Info size={18} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-800 dark:text-red-300 font-bold">
                Bạn đã chặn quyền thông báo. Hãy vào Cài đặt trình duyệt → Quyền → Thông báo → Chọn "Cho phép" cho trang web này.
              </p>
            </div>
          )}
        </div>

        {/* Diagnostic Info (Small) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/50">
          <details className="cursor-pointer group">
            <summary className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1 group-hover:text-blue-500 transition-colors">
              Kiểm tra thông số kỹ thuật
            </summary>
            <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-2 font-mono text-[10px] text-slate-500 dark:text-slate-400 break-all border border-slate-100 dark:border-slate-800">
              <p><span className="text-blue-500 font-bold">SW Status:</span> {isSupported ? 'Hỗ trợ' : 'Không hỗ trợ'}</p>
              <p><span className="text-blue-500 font-bold">VAPID Key:</span> {import.meta.env.VITE_VAPID_PUBLIC_KEY ? `${import.meta.env.VITE_VAPID_PUBLIC_KEY.substring(0, 15)}...` : 'MISSING'}</p>
              <p><span className="text-blue-500 font-bold">Browser:</span> {navigator.userAgent}</p>
              {error && <p className="text-red-500 font-bold">Lỗi: {error}</p>}
            </div>
          </details>
        </div>
      </div>

      {showIOSGuide && <IOSInstallGuide onClose={() => setShowIOSGuide(false)} />}
    </>
  );
}

export { IOSInstallGuide };
