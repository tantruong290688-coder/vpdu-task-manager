-- ============================================================
-- Migration: 039_profiles_job_description.sql
-- Mô tả: Thêm cột job_description và số hóa chức năng nhiệm vụ cho 8 cán bộ VPDU
-- ============================================================

-- 1. Bổ sung cột job_description dạng JSONB vào bảng profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_description JSONB DEFAULT NULL;

-- 2. Cập nhật dữ liệu phân công công tác chi tiết dựa trên tên cán bộ (full_name)

-- 2.1. Đ/c Bùi Tấn Trưởng - Chánh Văn phòng Đảng ủy
UPDATE public.profiles
SET job_description = '{
  "title": "Chánh Văn phòng Đảng ủy",
  "scope": "Điều hành chung Văn phòng, công tác tài chính, đối ngoại, chuẩn bị hội nghị và xử lý văn bản đi/đến",
  "fields_of_work": [
    "Tổng hợp chung",
    "Tài chính - tài sản",
    "Đối ngoại",
    "Tổ chức cán bộ",
    "Khen thưởng, kỷ luật"
  ],
  "duties": [
    "Điều hành chung toàn bộ hoạt động thuộc chức năng, nhiệm vụ của Văn phòng Đảng ủy",
    "Giúp Thường trực xây dựng và tổ chức thực hiện chương trình làm việc toàn khóa, hàng năm, định kỳ và đột xuất",
    "Chủ trì phối hợp xây dựng chương trình làm việc hàng tháng của BTV và chương trình giao ban hàng tuần của Thường trực",
    "Trực tiếp chỉ đạo chuẩn bị các hội nghị của Đảng ủy; thẩm định văn bản trước khi trình Hội nghị",
    "Trực tiếp theo dõi, tham mưu về công tác tài chính, công tác đối ngoại và là chủ tài khoản Đảng ủy",
    "Xử lý công văn đi, đến hàng ngày; ký thừa lệnh BTV đối với các loại công văn, thông báo theo thẩm quyền",
    "Ghi biên bản các kỳ họp Ban Chấp hành, Ban Thường vụ và Thường trực Đảng ủy"
  ]
}'::jsonb
WHERE full_name ILIKE '%Bùi Tấn Trưởng%' OR full_name ILIKE '%Bui Tan Truong%';

-- 2.2. Đ/c Nguyễn Đức Lợi - Phó Chánh Văn phòng Đảng ủy
UPDATE public.profiles
SET job_description = '{
  "title": "Phó Chánh Văn phòng Đảng ủy",
  "scope": "Tham mưu xây dựng Đảng, chính quyền, kinh tế, nội chính; xử lý đơn thư và tiếp công dân",
  "fields_of_work": [
    "Công tác xây dựng Đảng",
    "Chính quyền",
    "Kinh tế",
    "Nội chính",
    "Tôn giáo",
    "Giải quyết khiếu nại, tố cáo"
  ],
  "duties": [
    "Tham mưu lãnh đạo xây dựng Đảng, chính quyền, lĩnh vực kinh tế, nội chính; hoạt động của các chi, đảng bộ cơ sở",
    "Tiếp nhận và xử lý đơn thư gửi đến Đảng ủy, tham mưu, theo dõi và đôn đốc giải quyết đơn thư",
    "Phối hợp với các cơ quan chức năng tổ chức tiếp công dân theo quy định",
    "Trực tiếp biên soạn văn bản thuộc lĩnh vực phụ trách; rà soát việc thực hiện chương trình công tác của Đảng ủy xã",
    "Chuẩn bị các nội dung phục vụ kỳ họp, buổi làm việc của Đảng ủy, BTV và Thường trực Đảng ủy xã",
    "Thừa lệnh Thường trực ký các văn bản theo thẩm quyền; trực tiếp chỉ đạo bộ phận tổng hợp"
  ]
}'::jsonb
WHERE full_name ILIKE '%Nguyễn Đức Lợi%' OR full_name ILIKE '%Nguyen Duc Loi%';

-- 2.3. Đ/c Lê Công Hào - Phó Chánh Văn phòng Đảng ủy
UPDATE public.profiles
SET job_description = '{
  "title": "Phó Chánh Văn phòng Đảng ủy",
  "scope": "Cơ yếu - CNTT, bảo mật mạng, hành chính - quản trị, lễ tân, hậu cần, đối ngoại và đoàn thể xã hội",
  "fields_of_work": [
    "CNTT - chuyển đổi số",
    "Cơ yếu - bảo mật",
    "Hành chính - quản trị",
    "Hội nghị - hậu cần",
    "Tuyên giáo",
    "Dân vận",
    "Mặt trận - đoàn thể",
    "Văn hóa - Xã hội"
  ],
  "duties": [
    "Phụ trách Cơ yếu - CNTT, chuyển đổi số cơ quan Đảng, quản trị mạng nội bộ, chữ ký số và bảo mật thông tin",
    "Phụ trách Hành chính - quản trị, quản lý tài sản cơ quan, điều xe công tác và cơ sở vật chất trang thiết bị",
    "Chỉ đạo và theo dõi công tác lễ tân, hậu cần, tiếp khách phục vụ Đảng ủy, Thường trực và đón các đoàn công tác",
    "Giúp Chánh văn phòng theo dõi, tổng hợp và thẩm định mảng Tuyên giáo, Dân vận, Mặt trận và đoàn thể xã hội",
    "Trực tiếp biên soạn và chỉ đạo chuyên viên biên soạn các văn bản thuộc lĩnh vực phân công",
    "Giúp Chánh văn phòng thực hiện công tác kiểm tra, giám sát của Văn phòng"
  ]
}'::jsonb
WHERE full_name ILIKE '%Lê Công Hào%' OR full_name ILIKE '%Le Cong Hao%';

-- 2.4. Đ/c Nguyễn Thị Thanh Pháp - Chuyên viên tổng hợp, kiêm phụ trách Kế toán
UPDATE public.profiles
SET job_description = '{
  "title": "Chuyên viên tổng hợp, Kế toán",
  "scope": "Tham mưu Tuyên giáo, Dân vận, Mặt trận; phụ trách Kế toán tài chính Đảng",
  "fields_of_work": [
    "Tài chính - tài sản",
    "Tuyên giáo",
    "Dân vận",
    "Mặt trận - đoàn thể",
    "Văn hóa - Xã hội"
  ],
  "duties": [
    "Phân công theo dõi công tác Tuyên giáo, Dân vận, Mặt trận Tổ quốc và các đoàn thể chính trị - xã hội",
    "Soạn thảo văn bản thuộc lĩnh vực phụ trách; báo cáo định kỳ quý, 6 tháng, năm của Văn phòng Đảng ủy",
    "Tham mưu các chủ trương, chế độ quản lý, sử dụng tài chính, tài sản của Đảng bộ; đảm bảo kinh phí chi tiêu cơ quan",
    "Thực hiện công tác kế toán, thanh quyết toán, kiểm kê, báo cáo công khai tài chính trước cơ quan khối Đảng và cấp trên",
    "Tham mưu lập kế hoạch ngân sách hàng năm; hướng dẫn và kiểm tra thu nộp đảng phí của các tổ chức cơ sở đảng",
    "Phục vụ các hội nghị của Đảng ủy, BTV, Thường trực và các đoàn khách đến thăm và làm việc"
  ]
}'::jsonb
WHERE full_name ILIKE '%Nguyễn Thị Thanh Pháp%' OR full_name ILIKE '%Nguyen Thi Thanh Phap%';

-- 2.5. Đ/c Nguyễn Thị Hoài Thu - Chuyên viên tổng hợp, kiêm văn thư – lưu trữ
UPDATE public.profiles
SET job_description = '{
  "title": "Chuyên viên tổng hợp, Văn thư - Thủ quỹ",
  "scope": "Tham mưu nội chính, an ninh, tôn giáo, cán bộ; công tác văn thư lưu trữ, thủ quỹ",
  "fields_of_work": [
    "Văn thư - lưu trữ",
    "Nội chính",
    "Quốc phòng - an ninh",
    "Tôn giáo",
    "Tổ chức cán bộ",
    "Kiểm tra, giám sát",
    "Phòng, chống tham nhũng/THTK, CLP",
    "Tài chính - tài sản"
  ],
  "duties": [
    "Theo dõi công tác nội chính, quốc phòng, an ninh, tôn giáo; tổ chức cán bộ; kiểm tra giám sát; phòng chống tham nhũng",
    "Tiếp nhận, đăng ký văn bản đi/đến giấy và trên hệ thống Egov; chuyển lãnh đạo xử lý và đảm bảo bảo mật con dấu của Đảng",
    "Trực tiếp quản lý kho lưu trữ Đảng ủy; thu thập, chỉnh lý, sắp xếp tài liệu văn kiện Đảng phục vụ khai thác",
    "Phụ trách thủ quỹ cơ quan, chịu trách nhiệm quản lý tiền mặt, sổ sách, chứng từ liên quan và phối hợp với kế toán",
    "Hướng dẫn nghiệp vụ văn thư lưu trữ cho các cấp ủy cơ sở; quản lý máy photocopy và in ấn tài liệu",
    "Đề xuất mua văn phòng phẩm và chuẩn bị chế độ ăn giữa giờ phục vụ hội nghị; hỗ trợ phục vụ hội nghị"
  ]
}'::jsonb
WHERE full_name ILIKE '%Nguyễn Thị Hoài Thu%' OR full_name ILIKE '%Nguyen Thi Hoai Thu%';

-- 2.6. Đ/c Phạm Học Thuyết - Nhân viên tham mưu, tổng hợp và phụ trách văn phòng
UPDATE public.profiles
SET job_description = '{
  "title": "Nhân viên tham mưu, phụ trách Văn phòng",
  "scope": "Tham mưu xây dựng Đảng, chính quyền, kinh tế; phụ trách kỹ thuật hội họp, lịch công tác và ký số văn bản",
  "fields_of_work": [
    "Công tác xây dựng Đảng",
    "Chính quyền",
    "Kinh tế",
    "Hành chính - quản trị",
    "Hội nghị - hậu cần",
    "CNTT - chuyển đổi số"
  ],
  "duties": [
    "Tham mưu thực hiện báo cáo, thẩm định về: Xây dựng Đảng, hệ thống chính trị và lĩnh vực kinh tế thuộc UBND xã",
    "Theo dõi, tham mưu báo cáo công tác tuần, tháng, quý của Đảng ủy và xây dựng lịch công tác hàng tuần của Thường trực",
    "Phụ trách vận hành âm thanh, kỹ thuật họp trực tiếp/trực tuyến; setup ma két, băng rôn, khẩu hiệu các cuộc họp",
    "Thực hiện ký số văn bản điện tử, quét sao lưu văn bản và phát hành văn bản số lên hệ thống Egov và mạng nội bộ",
    "Tổng hợp đăng ký và kết quả thực hiện nhiệm vụ trọng tâm các chi bộ trực thuộc"
  ]
}'::jsonb
WHERE full_name ILIKE '%Phạm Học Thuyết%' OR full_name ILIKE '%Pham Hoc Thuyet%';

-- 2.7. Đ/c Phan Thị Linh - Nhân viên tạp vụ, văn thư Văn phòng
UPDATE public.profiles
SET job_description = '{
  "title": "Nhân viên tạp vụ, Hành chính hỗ trợ",
  "scope": "Phục vụ lễ tân nước họp, vệ sinh trụ sở và hỗ trợ văn thư phô tô, sắp tài liệu họp",
  "fields_of_work": [
    "Hành chính - quản trị",
    "Hội nghị - hậu cần",
    "Văn thư - lưu trữ"
  ],
  "duties": [
    "Chuẩn bị nước uống đảm bảo tại các hội trường họp, phòng họp BTV và Thường trực Đảng ủy",
    "Quét dọn, đảm bảo vệ sinh phòng làm việc của Thường trực, trụ sở, hội trường, phòng khách và khuôn viên cơ quan",
    "Đảm bảo nước uống phục vụ các buổi làm việc của Thường trực, các cuộc họp, hội nghị cơ quan Đảng ủy",
    "Phối hợp với văn phòng chuẩn bị chế độ (nước uống, ăn giữa giờ) phục vụ hội nghị theo quy định",
    "Tham gia phục vụ công tác văn thư, phô tô tài liệu, sắp xếp tài liệu phục vụ cuộc họp Đảng ủy, BTV, Thường trực"
  ]
}'::jsonb
WHERE full_name ILIKE '%Phan Thị Linh%' OR full_name ILIKE '%Phan Thi Linh%';

-- 2.8. Nhân viên lái xe
UPDATE public.profiles
SET job_description = '{
  "title": "Lái xe cơ quan",
  "scope": "Quản lý và sử dụng xe công, đưa đón Thường trực Đảng ủy và lãnh đạo đi công tác an toàn",
  "fields_of_work": [
    "Hành chính - quản trị",
    "Hội nghị - hậu cần"
  ],
  "duties": [
    "Quản lý và sử dụng xe ô tô công vụ phục vụ Thường trực Đảng ủy đi công tác an toàn, đúng giờ",
    "Đưa đón Bí thư, Phó Bí thư Đảng ủy và lãnh đạo khác theo sự phân công của văn phòng",
    "Bảo dưỡng, bảo trì và đảm bảo phương tiện xe công vụ luôn ở trạng thái vận hành tốt nhất"
  ]
}'::jsonb
WHERE role = 'staff' AND (full_name ILIKE '%lái xe%' OR full_name ILIKE '%lai xe%' OR full_name ILIKE '%tài xế%' OR full_name ILIKE '%tai xe%');
