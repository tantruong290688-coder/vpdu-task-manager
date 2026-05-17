/**
 * Service for AI-driven performance analysis
 */

export const analyzeStaffPerformance = async (staffData, periodKey) => {
    const { full_name, role, stats, primaryTasks, collabTasks } = staffData;

    const taskSummary = [...primaryTasks, ...collabTasks].map(t => 
        `- [${t.code}] ${t.title} (${t.assignee_id === staffData.id ? 'Chủ trì' : 'Phối hợp'}): Điểm ${t.evaluation?.final_score || 'Chưa chốt'}, Hạn ${t.due_date}`
    ).join('\n');

    const prompt = `
Bạn là một chuyên gia quản trị nhân sự và cố vấn chiến lược cho lãnh đạo Văn phòng Cấp ủy. 
Hãy phân tích báo cáo hiệu suất công việc của cán bộ sau đây:

THÔNG TIN CHUNG:
- Họ tên: ${full_name}
- Chức vụ/Vai trò: ${role}
- Kỳ báo cáo: ${periodKey}

CHỈ SỐ THỐNG KÊ:
- Điểm trung bình tổng hợp: ${staffData.displayScore}/100
- Điểm chất lượng trung bình: ${stats.avgQuality}/100
- Điểm tiến độ trung bình: ${stats.avgProgress}/100
- Chỉ số khối lượng công việc: ${stats.avgWorkload}/100
- Số nhiệm vụ chủ trì: ${stats.taskCount.primary}
- Số nhiệm vụ phối hợp: ${stats.taskCount.collab}

DANH SÁCH NHIỆM VỤ TIÊU BIỂU TRONG KỲ:
${taskSummary}

YÊU CẦU PHÂN TÍCH:
Hãy đưa ra một bản đánh giá chuyên nghiệp, khách quan và mang tính xây dựng. 
Kết quả trả về định dạng Markdown với các mục sau:
1. **Đánh giá tổng quan**: Tóm tắt ngắn gọn diện mạo hiệu suất trong kỳ.
2. **Thế mạnh nổi bật**: Dựa trên dữ liệu, cán bộ này làm tốt nhất ở mảng nào?
3. **Điểm cần cải thiện**: Các vấn đề tồn tại về chất lượng, tiến độ hoặc kỹ năng.
4. **Kiến nghị quản trị**: Đề xuất cụ thể cho lãnh đạo về việc giao việc, bồi dưỡng hoặc khen thưởng/nhắc nhở cán bộ này.

Lưu ý: Văn phong trang trọng, chuẩn mực công sở. Nếu dữ liệu còn ít, hãy nhận xét thận trọng.
    `.trim();

    try {
        const response = await fetch('/api/ai-assistant', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Lỗi hệ thống AI');
        }

        const data = await response.json();
        return data.text;
    } catch (error) {
        console.error("Error analyzing performance via AI:", error);
        throw error;
    }
};
