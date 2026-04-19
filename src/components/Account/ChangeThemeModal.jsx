import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';
import ModalWrapper from './ModalWrapper';
import { Sun, Moon, Monitor, Check } from 'lucide-react';

const OPTIONS = [
  {
    value: 'light',
    label: 'Giao diện Sáng',
    desc: 'Nền trắng, phù hợp ban ngày',
    icon: Sun,
    bg: 'from-yellow-50 to-orange-50',
    iconColor: 'text-yellow-500',
    border: 'border-yellow-300',
  },
  {
    value: 'dark',
    label: 'Giao diện Tối',
    desc: 'Nền tối, dễ nhìn ban đêm',
    icon: Moon,
    bg: 'from-slate-800 to-slate-900',
    iconColor: 'text-blue-400',
    border: 'border-blue-500',
    dark: true,
  },
  {
    value: 'system',
    label: 'Theo hệ thống',
    desc: 'Tự động theo thiết bị/trình duyệt',
    icon: Monitor,
    bg: 'from-slate-50 to-slate-100',
    iconColor: 'text-slate-500',
    border: 'border-slate-400',
  },
];

export default function ChangeThemeModal({ onClose }) {
  const { theme, changeTheme } = useTheme();

  const handleSelect = (value) => {
    changeTheme(value);
    const labels = { light: 'Giao diện Sáng', dark: 'Giao diện Tối', system: 'Theo hệ thống' };
    toast.success(`Đã chuyển sang ${labels[value]}`);
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose} title="Đổi giao diện">
      <div className="space-y-3 pb-1">
        {OPTIONS.map(({ value, label, desc, icon: Icon, bg, iconColor, border, dark: isDark }) => {
          const isActive = theme === value;
          return (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              className={[
                'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all duration-150',
                'text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                isActive
                  ? `border-blue-500 bg-blue-50 dark:bg-blue-950/40 shadow-sm`
                  : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {/* Icon preview */}
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${bg} flex items-center justify-center shrink-0 shadow-inner`}>
                <Icon size={20} className={iconColor} strokeWidth={2} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-[14px] font-bold leading-tight ${isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                  {label}
                </p>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{desc}</p>
              </div>

              {/* Check indicator */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${isActive ? 'bg-blue-600 shadow-sm' : 'border-2 border-slate-200 dark:border-slate-600'}`}>
                {isActive && <Check size={11} strokeWidth={3} className="text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Preview bar */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center font-medium">
          Giao diện hiện tại:{' '}
          <span className="font-bold text-slate-600 dark:text-slate-300">
            {OPTIONS.find(o => o.value === theme)?.label}
          </span>
        </p>
      </div>
    </ModalWrapper>
  );
}
