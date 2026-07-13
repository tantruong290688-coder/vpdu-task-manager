import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, Star, Flag, CheckCircle, MousePointer2, Keyboard, Zap, Info, Calendar, TrendingUp, Send, LayoutList, Layers, Bell, Smartphone, Users, Trash2, Shield, History, Eye, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function UserManualModal({ onClose }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isStaff = role === 'staff' || role === 'specialist';
  const isViewer = role === 'viewer';

  // Chặn cuộn trang khi mở modal
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
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
              <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                Dành cho vai trò: <span className="text-blue-600 dark:text-blue-400">
                  {isAdmin ? 'Quản trị viên (Admin)' : isManager ? 'Quản lý (Manager)' : isViewer ? 'Người theo dõi (Viewer)' : 'Cán bộ (Staff)'}
                </span>
              </p>
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
                {isAdmin ? (
                  <>Chào mừng đồng chí đến với hệ thống **Quản trị Nhiệm vụ VPĐU xã Trà Bồng**. Với vai trò **Quản trị viên (Admin)**, đồng chí nắm giữ quyền hạn tối cao để điều hành nhân sự, kiểm soát dữ liệu và đảm bảo hệ thống vận hành ổn định, an toàn.</>
                ) : isManager ? (
                  <>Chào mừng đồng chí đến với hệ thống **Quản trị Nhiệm vụ VPĐU xã Trà Bồng**. Với vai trò **Quản lý (Manager)**, đồng chí đóng vai trò then chốt trong việc điều hành, giao việc và đánh giá kết quả để đảm bảo đơn vị hoàn thành tốt các chỉ tiêu nhiệm vụ được giao.</>
                ) : isViewer ? (
                  <>Chào mừng đồng chí đến với hệ thống **Quản trị Nhiệm vụ VPĐU xã Trà Bồng**. Với vai trò **Người theo dõi (Viewer)**, hệ thống này cung cấp cho đồng chí góc nhìn tổng quan, phân tích số liệu thi đua và giám sát lịch trình công tác của toàn đơn vị nhằm mục đích tổng hợp báo cáo và hỗ trợ giám sát hành chính.</>
                ) : (
                  <>Chào mừng đồng chí đến với hệ thống **Quản trị Nhiệm vụ VPĐU xã Trà Bồng**. Với vai trò **Cán bộ (Staff/Specialist)**, hệ thống này là công cụ giúp đồng chí quản lý công việc cá nhân, báo cáo tiến độ và tự đề xuất kết quả thi đua một cách minh bạch, công bằng và hiệu quả.</>
                )}
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
                    {isAdmin ? (
                      <>
                        <GuideRow 
                          icon={Users} iconColor="text-purple-500" label="Quản lý nhân sự" 
                          action="Vào mục 'Quản trị hệ thống' -> Tạo tài khoản mới, đặt lại mật khẩu hoặc khóa/mở khóa tài khoản."
                          note="Đặc quyền Admin: Điều động nhân sự, kiểm soát toàn diện danh sách và quyền truy cập."
                        />
                        <GuideRow 
                          icon={Shield} iconColor="text-blue-500" label="Phân quyền (RBAC)" 
                          action="Sửa thông tin tài khoản -> Thay đổi Vai trò (Quản trị/Quản lý/Chuyên viên/Nhân viên/Người theo dõi)."
                          note="Admin có thể cấp quyền hạn phù hợp cho từng cán bộ và các lãnh đạo khác."
                        />
                        <GuideRow 
                          icon={Clock} iconColor="text-emerald-500" label="Heartbeat trực tuyến" 
                          action="Xem đèn tín hiệu trực tuyến (Online/Offline) và mốc thời gian hoạt động cuối cùng của từng cán bộ."
                          note="Dữ liệu được cập nhật tự động liên tục qua Realtime kết hợp Polling 15 giây."
                        />
                        <GuideRow 
                          icon={Eye} iconColor="text-indigo-500" label="Giám sát tiếp nhận" 
                          action="Vào mục 'Nhật ký thao tác' -> Tìm hành động 'Xem nhiệm vụ' của cán bộ."
                          note="Biết chính xác cán bộ đã mở xem nhiệm vụ vào lúc nào để kịp thời đôn đốc."
                        />
                        <GuideRow 
                          icon={History} iconColor="text-slate-500" label="Nhật ký thao tác" 
                          action="Theo dõi toàn bộ lịch sử thao tác của các thành viên. Có bộ lọc tìm kiếm và nhấp mã nhiệm vụ để xem nhanh."
                          note="Giúp minh bạch hóa quá trình làm việc, xác định trách nhiệm khi xảy ra sai sót."
                        />
                        <GuideRow 
                          icon={Trash2} iconColor="text-red-500" label="Bảo trì logs hệ thống" 
                          action="Nhấn [Xóa sạch log] tại trang Nhật ký thao tác để dọn dẹp các bản ghi lịch sử cũ."
                          note="Lưu ý: Chỉ dành cho Admin và không thể hoàn tác. Giúp nâng cao hiệu suất DB."
                        />
                        <GuideRow 
                          icon={Trash2} iconColor="text-rose-500" label="Dọn dẹp tin nhắn" 
                          action="Nhấn [Xóa sạch tin nhắn] trong trang Admin để giải phóng toàn bộ các cuộc hội thoại cũ."
                          note="Lưu ý: Đặc quyền Admin, không thể khôi phục. Chỉ dùng khi bảo trì hệ thống."
                        />
                        <GuideRow 
                          icon={Star} iconColor="text-amber-500" label="Chốt điểm thi đua" 
                          action="Vào tab 'Phê duyệt cuối' trong chi tiết đánh giá để phê duyệt và chốt điểm chính thức."
                          note="Admin có quyền tối cao điều chỉnh điểm và chốt kết quả thi đua cuối cùng."
                        />
                        <GuideRow 
                          icon={Calendar} iconColor="text-indigo-500" label="Lịch công tác tuần" 
                          action="Quản lý lịch tuần của đơn vị, tạo lịch làm việc mới và xuất bản in Excel chất lượng cao."
                          note="Admin và Manager có toàn quyền điều hành lịch biểu chung của đơn vị."
                        />
                        <GuideRow 
                          icon={TrendingUp} iconColor="text-purple-500" label="Phân tích Hiệu suất" 
                          action="Theo dõi biểu đồ radar năng lực đa chiều, bảng xếp hạng và nhập nhận xét thi đua đơn vị."
                          note="Cung cấp cái nhìn toàn diện để chốt đánh giá phân loại cán bộ hàng tháng/quý/năm."
                        />
                      </>
                    ) : isManager ? (
                      <>
                        <GuideRow 
                          icon={Zap} iconColor="text-blue-500" label="Tổng quan điều hành" 
                          action="Xem nhanh tổng quan số lượng nhiệm vụ: Đang làm, Quá hạn, Chờ đánh giá... nhấp vào số liệu để xem danh sách chi tiết."
                          note="Theo dõi sát sao tiến độ tổng thể của toàn đơn vị trên biểu đồ trực quan."
                        />
                        <GuideRow 
                          icon={Send} iconColor="text-indigo-500" label="Giao việc & Phối hợp" 
                          action="Nhấn [+ Thêm nhiệm vụ] -> Điền thông tin -> Chọn Người thực hiện chính (Staff/Specialist) và các thành viên phối hợp."
                          note="Manager có quyền điều động nhân sự, ấn định thời hạn và sửa đổi thông tin khi cần."
                        />
                        <GuideRow 
                          icon={Eye} iconColor="text-teal-500" label="Giám sát tiếp nhận" 
                          action="Kiểm tra trạng thái nhãn 'Đã xem' hiển thị bên cạnh tên cán bộ trong danh sách nhân sự của nhiệm vụ."
                          note="Giúp Manager biết chính xác cán bộ đã nhận được và đọc nội dung chỉ đạo hay chưa để đôn đốc."
                        />
                        <GuideRow 
                          icon={Calendar} iconColor="text-sky-500" label="Lịch công tác đơn vị" 
                          action="Quản lý lịch tuần chung của đơn vị, tạo lịch làm việc mới, sửa đổi chi tiết và xuất bản in Excel chất lượng cao."
                          note="Giúp duy trì lịch trình làm việc và giao ban của Đảng ủy luôn thông suốt và chuyên nghiệp."
                        />
                        <GuideRow 
                          icon={Star} iconColor="text-amber-500" label="Chốt điểm thi đua" 
                          action="Vào tab 'Phê duyệt cuối' trong chi tiết đánh giá để chấm điểm chi tiết (60% Chất lượng, 30% Tiến độ, 10% Khối lượng) kèm Điểm cộng/trừ."
                          note="Manager có quyền phê duyệt, điều chỉnh điểm tự đề xuất của cán bộ và chốt kết quả chính thức."
                        />
                        <GuideRow 
                          icon={TrendingUp} iconColor="text-violet-500" label="Nhận xét của Lãnh đạo" 
                          action="Vào mục Hiệu suất -> Chọn cán bộ -> Nhấn 'Đánh giá năng lực' để nhập nhận xét chất lượng định kỳ cho cán bộ."
                          note="Nội dung nhận xét sẽ lưu vào hồ sơ năng lực cá nhân của cán bộ làm cơ sở đánh giá xếp loại cuối năm."
                        />
                        <GuideRow 
                          icon={Layers} iconColor="text-purple-500" label="Cấu trúc công việc" 
                          action="Vào mục 'Quản lý danh mục' -> Tạo thêm Lĩnh vực công tác hoặc Nhóm nhiệm vụ để phân cấp quản lý."
                          note="Giúp tổ chức, phân loại khoa học các đầu việc theo khối lượng chuyên môn."
                        />
                      </>
                    ) : isViewer ? (
                      <>
                        <GuideRow 
                          icon={Zap} iconColor="text-blue-500" label="Dashboard tổng quan" 
                          action="Theo dõi số lượng và biểu đồ trạng thái nhiệm vụ của toàn đơn vị (Đang làm, Hoàn thành, Trễ hạn...)."
                          note="Viewer có giao diện thu gọn, tập trung hoàn toàn vào giám sát chỉ số hành chính mà không có quyền sửa đổi."
                        />
                        <GuideRow 
                          icon={TrendingUp} iconColor="text-purple-500" label="Phân tích hiệu suất" 
                          action="Xem bảng xếp hạng thi đua, điểm số tích lũy và biểu đồ radar năng lực đa chiều của cán bộ."
                          note="Phục vụ mục đích tổng hợp dữ liệu báo cáo, hỗ trợ nhận diện và đánh giá nhân sự."
                        />
                        <GuideRow 
                          icon={Calendar} iconColor="text-sky-500" label="Lịch công tác tuần" 
                          action="Xem lịch trình công tác tuần chung của toàn đơn vị và xuất bản in Excel chất lượng cao."
                          note="Viewer được xem lịch tuần chung của đơn vị để phục vụ công tác báo cáo nhưng không có quyền chỉnh sửa/điều phối."
                        />
                        <GuideRow 
                          icon={LayoutList} iconColor="text-indigo-500" label="Tra cứu nhiệm vụ" 
                          action="Xem danh sách chi tiết các nhiệm vụ của đơn vị để nắm bắt nội dung chuyên môn và tiến độ."
                          note="Viewer có quyền xem chi tiết tất cả các nhiệm vụ nhưng không được thực hiện cập nhật tiến độ."
                        />
                      </>
                    ) : (
                      <>
                        <GuideRow 
                          icon={LayoutList} iconColor="text-blue-500" label="Nhiệm vụ của tôi" 
                          action="Xem chi tiết các nhiệm vụ được phân công thực hiện chính (Main Assignee) hoặc phối hợp (Collaborator)."
                          note="Đây là bàn làm việc chính của cán bộ. Cần rà soát và kiểm tra danh sách này hàng ngày."
                        />
                        <GuideRow 
                          icon={TrendingUp} iconColor="text-indigo-500" label="Cập nhật tiến độ" 
                          action="Kéo thả Kanban hoặc nhấp biểu tượng [Check] trong chi tiết nhiệm vụ để cập nhật mức độ hoàn thành (%) thực tế."
                          note="Giúp Lãnh đạo nắm được khối lượng công việc cán bộ đang xử lý mà không cần báo cáo trực tiếp."
                        />
                        <GuideRow 
                          icon={Star} iconColor="text-amber-500" label="Tự đề xuất điểm" 
                          action="Khi nhiệm vụ đạt 100% hoàn thành, nhấp biểu tượng [Star] -> Tab Tự đề xuất -> Nhập điểm đề xuất và minh chứng."
                          note="Quyền lợi thi đua của cán bộ. Cần nhập đầy đủ mô tả sản phẩm để Lãnh đạo phê duyệt điểm cao."
                        />
                        <GuideRow 
                          icon={Layers} iconColor="text-emerald-500" label="To-do cá nhân" 
                          action="Nhấp [+] tại mục To-do để ghi chú các công việc vụn vặt, kế hoạch cá nhân hàng ngày."
                          note="Bảng ghi chú độc lập giúp nâng cao năng suất cá nhân mà không làm rối danh sách nhiệm vụ chung."
                        />
                        <GuideRow 
                          icon={Calendar} iconColor="text-sky-500" label="Tra cứu lịch tuần" 
                          action="Xem lịch trình công tác tuần của toàn đơn vị để sắp xếp thời gian làm việc cá nhân phù hợp."
                          note="Staff có quyền xem và tra cứu lịch tuần chung của Đảng ủy bất kỳ lúc nào."
                        />
                        <GuideRow 
                          icon={Bell} iconColor="text-rose-500" label="Nhận ý kiến chỉ đạo" 
                          action="Kiểm tra Chuông thông báo và đọc ý kiến chỉ đạo trực tiếp của Lãnh đạo/Admin trong hộp thoại bình luận nhiệm vụ."
                          note="Phản hồi nhanh chỉ đạo và cập nhật thông tin tương tác thời gian thực."
                        />
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Evaluation Flow Section */}
            <section className="bg-indigo-600 rounded-[40px] p-8 md:p-10 text-white shadow-xl shadow-indigo-200 dark:shadow-none space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-2xl font-black uppercase tracking-tight">Chương III: Quy trình Đánh giá</h4>
                  <p className="text-indigo-100 font-medium opacity-80 mt-1">
                    {(isAdmin || isManager) ? 'Dành cho vai trò Lãnh đạo / Quản trị' : isViewer ? 'Dành cho vai trò Người theo dõi' : 'Dành cho vai trò Cán bộ / Thực hiện'}
                  </p>
                </div>
                <div className="px-4 py-2 bg-white/20 rounded-2xl text-[12px] font-black uppercase tracking-widest backdrop-blur-md">
                  {(isAdmin || isManager) ? 'LEADERSHIP & ADMIN FLOW' : isViewer ? 'VIEWER OVERSIGHT FLOW' : 'STAFF CORE FLOW'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(isAdmin || isManager) ? (
                  <>
                    <EvalStep 
                      step="01" title="Giám sát Đề xuất" 
                      desc="Đôn đốc cán bộ báo cáo tiến độ và theo dõi điểm tự đề xuất của cán bộ chính & phối hợp."
                    />
                    <EvalStep 
                      step="02" title="Chấm điểm chi tiết" 
                      desc="Đánh giá chi tiết theo công thức: Chất lượng (60%) + Tiến độ (30%) + Khối lượng (10%) kèm Điểm cộng/trừ."
                    />
                    <EvalStep 
                      step="03" title="Chốt điểm & Lưu vết" 
                      desc="Nhập lý do điều chỉnh nếu thay đổi điểm so với đề xuất, nhấn [Chốt điểm]. Có quyền sửa đổi lại bất kỳ lúc nào."
                    />
                  </>
                ) : isViewer ? (
                  <>
                    <EvalStep 
                      step="01" title="Giám sát Chỉ số" 
                      desc="Theo dõi điểm thi đua và bảng xếp hạng năng suất làm việc của cán bộ toàn Đảng ủy."
                    />
                    <EvalStep 
                      step="02" title="Phân tích Radar" 
                      desc="Đọc hiểu biểu đồ radar năng lực đa chiều để nhận diện điểm mạnh/yếu của nhân sự."
                    />
                    <EvalStep 
                      step="03" title="Tổng hợp báo cáo" 
                      desc="Trích xuất và tổng hợp các số liệu thi đua thực tế phục vụ các buổi họp giao ban Đảng ủy."
                    />
                  </>
                ) : (
                  <>
                    <EvalStep 
                      step="01" title="Báo cáo hoàn thành" 
                      desc="Chuyển trạng thái nhiệm vụ sang 'Hoàn thành' khi đã xong toàn bộ các đầu việc."
                    />
                    <EvalStep 
                      step="02" title="Tự đề xuất điểm" 
                      desc="Nhập điểm tự đánh giá và mô tả chi tiết sản phẩm mình đã làm được."
                    />
                    <EvalStep 
                      step="03" title="Xem kết quả" 
                      desc="Nhận thông báo khi lãnh đạo chốt điểm và xem nhận xét phê chuẩn từ cấp trên."
                    />
                  </>
                )}
              </div>

              <div className="p-6 bg-white/10 rounded-[32px] border border-white/10 flex gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-amber-900 shrink-0">
                  <Zap size={20} />
                </div>
                <div className="space-y-1">
                  <p className="text-[13px] font-black uppercase tracking-widest">Ghi chú quan trọng</p>
                  <p className="text-[14px] font-medium leading-relaxed text-indigo-50">
                    {(isAdmin || isManager) ? (
                      <>Công thức tính điểm thi đua tự động: **Điểm chốt = (Chất lượng * 0.6) + (Tiến độ * 0.3) + (Khối lượng * 0.1) + Điểm cộng - Điểm trừ**. Lãnh đạo có quyền chốt điểm và thay đổi điểm bất cứ lúc nào khi có khiếu nại của cán bộ.</>
                    ) : isViewer ? (
                      <>Với quyền hạn **Viewer**, đồng chí có góc nhìn quan sát trung lập, không tham gia chấm điểm và không được xem chi tiết phiếu chấm điểm nội bộ để đảm bảo tính bảo mật và riêng tư của quy trình đánh giá.</>
                    ) : (
                      <>Khi tự đề xuất điểm, hãy đính kèm minh chứng hoặc mô tả kỹ sản phẩm đã làm. Điều này giúp lãnh đạo có cơ sở phê duyệt điểm cao cho đồng chí.</>
                    )}
                  </p>
                </div>
              </div>
            </section>

            {/* Tips & Shortcuts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-1.5 bg-amber-500 rounded-full"></div>
                  <h4 className="text-[16px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Chương IV: Mẹo & Tiện ích</h4>
                </div>
                <div className="space-y-3">
                  <ShortcutItem icon={Keyboard} keys="Ctrl + K" label="Tìm kiếm thông minh toàn hệ thống." />
                  <ShortcutItem icon={Smartphone} keys="PWA" label="Cài đặt hệ thống lên màn hình điện thoại như App." />
                  <ShortcutItem icon={Zap} keys="Kanban" label="Kéo thả thẻ nhiệm vụ để cập nhật trạng thái cực nhanh." />
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-1.5 bg-rose-500 rounded-full"></div>
                  <h4 className="text-[16px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Chương V: Giải mã ký hiệu</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <IconLegend icon={Flag} color="text-rose-500" label="Cờ rủi ro" desc="Cần ưu tiên xử lý ngay" />
                  <IconLegend icon={Info} color="text-blue-500" label="Chế độ xem" desc="Bảng, Kanban, Lịch" />
                </div>
              </section>
            </div>

            {/* Footer advice */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 flex items-start gap-4">
              <Info className="text-blue-500 shrink-0 mt-0.5" size={20} />
              <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium italic leading-relaxed">
                {isAdmin ? (
                  <>**Lời khuyên cho Admin**: Hãy rà soát **Nhật ký thao tác** cuối ngày để nắm bắt toàn diện biến động hệ thống. Định kỳ dọn dẹp các logs/tin nhắn cũ và giám sát Heartbeat trực tuyến để đôn đốc công việc cán bộ.</>
                ) : isManager ? (
                  <>**Lời khuyên cho Manager**: Hãy chú ý nhãn **Đã xem** để đôn đốc cán bộ tiếp nhận việc. Cuối tháng, hãy dành 5 phút vào mục **Hiệu suất** để chốt nhận xét định kỳ cho cán bộ của mình.</>
                ) : isViewer ? (
                  <>**Lời khuyên cho Viewer**: Hãy tận dụng biểu đồ radar năng lực trong mục **Hiệu suất** và theo dõi lịch công tác tuần để hỗ trợ tổng hợp báo cáo hành chính chính xác cho lãnh đạo Đảng ủy.</>
                ) : (
                  <>**Lời khuyên cho Staff**: Sự chủ động là chìa khóa. Việc cập nhật tiến độ thường xuyên và tự đề xuất điểm kèm minh chứng đầy đủ giúp bạn luôn có điểm thi đua tốt và được lãnh đạo đánh giá cao.</>
                )}
              </p>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 md:px-10 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">
            Hệ thống Quản trị Nhiệm vụ v6.2 — VPĐU xã Trà Bồng
          </p>
          <button 
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl text-[14px] font-black hover:opacity-90 transition-all shadow-xl hover:scale-105 active:scale-95"
          >
            Đã rõ, đóng lại
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function GuideRow({ icon: Icon, iconColor, label, action, note }) {
  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
      <td className="px-6 py-6 border-r border-slate-50 dark:border-slate-800/50 w-44">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${iconColor} group-hover:scale-110 transition-transform shadow-sm`}>
            <Icon size={18} />
          </div>
          <span className="font-black text-slate-800 dark:text-slate-100 leading-tight">{label}</span>
        </div>
      </td>
      <td className="px-6 py-6 text-slate-600 dark:text-slate-300 font-bold leading-relaxed border-r border-slate-50 dark:border-slate-800/50">
        {action}
      </td>
      <td className="px-6 py-6 text-slate-400 dark:text-slate-500 font-medium italic leading-relaxed">
        {note}
      </td>
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
