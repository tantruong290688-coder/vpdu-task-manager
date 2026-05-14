import { X, BookOpen, Star, Flag, CheckCircle, MousePointer2, Keyboard, Zap, Info, Calendar, TrendingUp, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function UserManualModal({ onClose }) {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      {/* Click outside overlay */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="relative bg-white dark:bg-[#0f172a] rounded-[32px] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
              <BookOpen size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Cẩm nang hướng dẫn sử dụng</h3>
              <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest mt-1">Dành cho vai trò: {isManager ? 'Manager / Quản lý' : 'Cán bộ / Nhân viên'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/30 dark:bg-transparent">
          <div className="max-w-4xl mx-auto space-y-12">
            
            {/* Introduction Section */}
            <section className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[11px] font-black uppercase tracking-widest">
                <Info size={14} /> Chương I: Tổng quan
              </div>
              <p className="text-[15px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                Chào mừng đồng chí đến với hệ thống **Quản trị Nhiệm vụ VPĐU xã Trà Bồng**. Với vai trò **Quản lý**, đồng chí đóng vai trò then chốt trong việc điều hành, giao việc và đánh giá kết quả để đảm bảo đơn vị hoàn thành tốt các chỉ tiêu nhiệm vụ được giao.
              </p>
            </section>

            {/* Main Functions Table */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-6 w-1.5 bg-blue-600 rounded-full"></div>
                <h4 className="text-[16px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Chương II: Hướng dẫn các chức năng chính</h4>
              </div>
              
              <div className="overflow-hidden rounded-[24px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4">Chức năng</th>
                      <th className="px-6 py-4">Thao tác chi tiết</th>
                      <th className="px-6 py-4">Mục đích & Lưu ý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-[13px]">
                    <GuideRow 
                      icon={Zap} iconColor="text-blue-500" label="Dashboard" 
                      action="Xem nhanh tổng quan số lượng nhiệm vụ: Đang làm, Quá hạn, Chờ đánh giá..."
                      note="Theo dõi tiến độ tổng thể. Click vào từng con số để xem danh sách chi tiết."
                    />
                    <GuideRow 
                      icon={Send} iconColor="text-indigo-500" label="Giao nhiệm vụ" 
                      action="Nhấn [+ Thêm nhiệm vụ] -> Nhập nội dung -> Chọn Người thực hiện chính & Người phối hợp."
                      note="Manager chỉ có quyền giao thêm người phối hợp cho cấp bậc Staff."
                    />
                    <GuideRow 
                      icon={Calendar} iconColor="text-orange-500" label="Lịch công tác" 
                      action="Chọn ngày -> Nhập nội dung làm việc -> Nhấn Lưu."
                      note="Quản lý lịch tuần của đơn vị. Có thể xuất file Excel để in ấn."
                    />
                    <GuideRow 
                      icon={Star} iconColor="text-amber-500" label="Đánh giá nhiệm vụ" 
                      action="Vào tab Đánh giá trong chi tiết nhiệm vụ -> Thực hiện 3 bước chấm điểm."
                      note="Đây là quyền hạn cao nhất. Manager có quyền chốt điểm cuối cùng."
                    />
                    <GuideRow 
                      icon={TrendingUp} iconColor="text-emerald-500" label="Hiệu suất cán bộ" 
                      action="Chọn kỳ (Tháng/Quý/Năm) -> Xem bảng xếp hạng và biểu đồ radar."
                      note="Dùng để đánh giá thi đua. Bạn có quyền nhập nhận xét & điều chỉnh điểm."
                    />
                  </tbody>
                </table>
              </div>
            </section>

            {/* Evaluation Flow Section */}
            <section className="bg-indigo-600 rounded-[40px] p-8 md:p-10 text-white shadow-xl shadow-indigo-200 dark:shadow-none space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-2xl font-black uppercase tracking-tight">Chương III: Quy trình Đánh giá 3 Lớp</h4>
                  <p className="text-indigo-100 font-medium opacity-80 mt-1">Trọng tâm để chốt kết quả thi đua cho cán bộ</p>
                </div>
                <div className="px-4 py-2 bg-white/20 rounded-2xl text-[12px] font-black uppercase tracking-widest backdrop-blur-md">MANAGER CORE FLOW</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <EvalStep 
                  step="01" title="Tự đề xuất" 
                  desc="Nếu đồng chí trực tiếp tham gia nhiệm vụ, hãy tự chấm điểm cho phần việc của mình."
                />
                <EvalStep 
                  step="02" title="Đánh giá cộng sự" 
                  desc="Nếu là Người thực hiện chính, hãy chấm điểm cho các nhân viên phối hợp cùng."
                />
                <EvalStep 
                  step="03" title="Phê duyệt cuối" 
                  desc="Xem xét điểm của mọi người và nhấn [Chốt điểm] để lưu chính thức vào hồ sơ."
                />
              </div>

              <div className="p-6 bg-white/10 rounded-[32px] border border-white/10 flex gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-amber-900 shrink-0">
                  <Zap size={20} />
                </div>
                <div className="space-y-1">
                  <p className="text-[13px] font-black uppercase tracking-widest">Công thức tự động</p>
                  <p className="text-[14px] font-medium leading-relaxed text-indigo-50">
                    Hệ thống tính điểm theo tỷ lệ: **Chất lượng (60%) + Tiến độ (30%) + Khối lượng (10%)**. Cán bộ chỉ cần chọn mức độ hoàn thành, hệ thống sẽ tự tính điểm chính xác.
                  </p>
                </div>
              </div>
            </section>

            {/* Tips & Shortcuts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-1.5 bg-amber-500 rounded-full"></div>
                  <h4 className="text-[16px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Chương IV: Mẹo & Phím tắt</h4>
                </div>
                <div className="space-y-3">
                  <ShortcutItem icon={Keyboard} keys="Ctrl + K" label="Tìm kiếm thông minh toàn hệ thống." />
                  <ShortcutItem icon={MousePointer2} keys="Click" label="Nhấn vào số trên Dashboard để lọc nhanh." />
                  <ShortcutItem icon={Zap} keys="Kanban" label="Chuyển sang chế độ thẻ để quản lý trực quan." />
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-1.5 bg-rose-500 rounded-full"></div>
                  <h4 className="text-[16px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Chương V: Giải mã ký hiệu</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <IconLegend icon={Flag} color="text-rose-500" label="Cờ rủi ro" desc="Cần kiểm tra ngay" />
                  <IconLegend icon={Star} color="text-amber-500" label="Nhiệm vụ trọng tâm" desc="Theo dõi đặc biệt" />
                </div>
              </section>
            </div>

            {/* Footer advice */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 flex items-start gap-4">
              <Info className="text-blue-500 shrink-0 mt-0.5" size={20} />
              <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium italic leading-relaxed">
                **Lời khuyên**: Hãy kiểm tra **Thông báo** đầu giờ sáng để cập nhật thay đổi. Cuối tuần, hãy dành 5 phút vào mục **Hiệu suất** để nắm bắt năng suất của cán bộ.
              </p>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between shrink-0">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">VPĐU xã Trà Bồng - Hệ thống Quản trị Nhiệm vụ v6.1</p>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 dark:bg-white dark:text-slate-900 text-white rounded-xl text-[13px] font-black hover:opacity-90 transition-all shadow-lg"
          >
            Đã rõ, đóng lại
          </button>
        </div>
      </div>
    </div>
  );
}

function GuideRow({ icon: Icon, iconColor, label, action, note }) {
  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${iconColor} group-hover:scale-110 transition-transform`}>
            <Icon size={16} />
          </div>
          <span className="font-black text-slate-800 dark:text-slate-100">{label}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-bold leading-relaxed">{action}</td>
      <td className="px-6 py-4 text-slate-400 dark:text-slate-500 font-medium italic">{note}</td>
    </tr>
  );
}

function EvalStep({ step, title, desc }) {
  return (
    <div className="bg-white/10 p-6 rounded-[32px] border border-white/10 space-y-3">
      <div className="w-10 h-10 rounded-2xl bg-white text-indigo-600 flex items-center justify-center font-black text-lg shadow-lg">{step}</div>
      <h5 className="text-[16px] font-black uppercase tracking-tight">{title}</h5>
      <p className="text-[13px] text-indigo-50/70 font-medium leading-relaxed">{desc}</p>
    </div>
  );
}

function ShortcutItem({ icon: Icon, keys, label }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[13px] font-black text-slate-800 dark:text-white uppercase">{keys}</span>
        </div>
        <p className="text-[12px] text-slate-400 font-medium">{label}</p>
      </div>
    </div>
  );
}

function IconLegend({ icon: Icon, color, label, desc }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <Icon className={`${color} shrink-0`} size={20} />
      <div>
        <p className="text-[13px] font-black text-slate-800 dark:text-white">{label}</p>
        <p className="text-[11px] text-slate-400 font-medium">{desc}</p>
      </div>
    </div>
  );
}
