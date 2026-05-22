import { useState } from 'react';
import toast from 'react-hot-toast';
import ModalWrapper from './ModalWrapper';
import { Type, Check } from 'lucide-react';

const OPTIONS = [
  {
    value: 'small',
    label: 'Cỡ chữ Nhỏ',
    desc: 'Hiển thị được nhiều nội dung hơn',
    scale: '0.92x',
    bg: 'from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900',
    iconColor: 'text-slate-500 dark:text-slate-400',
    border: 'border-slate-300',
    iconSize: 16,
  },
  {
    value: 'medium',
    label: 'Cỡ chữ Vừa',
    desc: 'Mặc định, cân đối hệ thống',
    scale: '1.00x',
    bg: 'from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30',
    iconColor: 'text-blue-500 dark:text-blue-400',
    border: 'border-blue-400',
    iconSize: 20,
  },
  {
    value: 'large',
    label: 'Cỡ chữ Lớn',
    desc: 'Dễ đọc hơn trên điện thoại',
    scale: '1.08x',
    bg: 'from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/30',
    iconColor: 'text-indigo-500 dark:text-indigo-400',
    border: 'border-indigo-400',
    iconSize: 24,
  },
  {
    value: 'xlarge',
    label: 'Cỡ chữ Rất lớn',
    desc: 'Phù hợp người cần chữ rõ hơn',
    scale: '1.16x',
    bg: 'from-violet-50 to-violet-100 dark:from-violet-950/30 dark:to-violet-900/30',
    iconColor: 'text-violet-500 dark:text-violet-400',
    border: 'border-violet-400',
    iconSize: 28,
  },
];

export default function ChangeFontSizeModal({ onClose }) {
  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem('mobile_font_size') || 'medium';
  });

  const handleSelect = (value) => {
    setFontSize(value);
    localStorage.setItem('mobile_font_size', value);
    document.documentElement.setAttribute('data-mobile-font-size', value);
    
    const labels = {
      small: 'Cỡ chữ Nhỏ',
      medium: 'Cỡ chữ Vừa (Mặc định)',
      large: 'Cỡ chữ Lớn',
      xlarge: 'Cỡ chữ Rất lớn'
    };
    
    toast.success(`Đã đổi cỡ chữ sang: ${labels[value]}`);
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose} title="Cỡ chữ điện thoại">
      <div className="space-y-3 pb-1">
        <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mb-3 leading-relaxed">
          * Thiết lập này chỉ áp dụng khi xem hệ thống trên thiết bị di động (màn hình dưới 768px).
        </p>

        {OPTIONS.map(({ value, label, desc, scale, bg, iconColor, iconSize }) => {
          const isActive = fontSize === value;
          return (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              className={[
                'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all duration-150',
                'text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                isActive
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 shadow-sm'
                  : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80',
              ].join(' ')}
            >
              {/* Icon preview */}
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${bg} flex items-center justify-center shrink-0 shadow-inner`}>
                <Type size={iconSize} className={iconColor} strokeWidth={2.5} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-[14px] font-bold leading-tight ${isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {label}
                  </p>
                  {isActive && (
                    <span className="text-[9px] font-black uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded-md tracking-wider shrink-0">
                      Đang dùng
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-snug">{desc}</p>
              </div>

              {/* Check indicator */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${isActive ? 'bg-blue-600 shadow-sm' : 'border-2 border-slate-200 dark:border-slate-700'}`}>
                {isActive && <Check size={11} strokeWidth={3} className="text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Preview indicator */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center font-semibold">
          Tỷ lệ hiện tại:{' '}
          <span className="font-extrabold text-blue-600 dark:text-blue-400">
            {OPTIONS.find(o => o.value === fontSize)?.scale} ({OPTIONS.find(o => o.value === fontSize)?.label.replace('Cỡ chữ ', '')})
          </span>
        </p>
      </div>
    </ModalWrapper>
  );
}
