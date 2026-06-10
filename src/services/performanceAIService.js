/**
 * Service for AI-driven performance analysis
 */

export const analyzeStaffPerformance = async (staffData, periodKey) => {
    const { full_name, role, stats, primaryTasks, collabTasks, job_description } = staffData;

    const taskSummary = [...primaryTasks, ...collabTasks].map(t => 
        `- [${t.code}] ${t.title} (${t.assignee_id === staffData.id ? 'Chủ trì' : 'Phối hợp'}): Điểm ${t.evaluation?.final_score || 'Chưa chốt'}, Hạn ${t.due_date}`
    ).join('\n');

    let jobDescriptionText = "Chưa có thông tin phân công chính thức.";
    if (job_description) {
        jobDescriptionText = `
- Chức danh chính thức: ${job_description.title || role}
- Phạm vi/Lĩnh vực phụ trách: ${job_description.scope || 'Chưa rõ'}
- Các nhiệm vụ chi tiết:
${Array.isArray(job_description.duties) ? job_description.duties.map(d => `  + ${d}`).join('\n') : '  + Chưa cấu hình'}`;
    }

    const prompt = `
Bạn là một chuyên gia quản trị nhân sự và cố vấn chiến lược cho lãnh đạo Văn phòng Cấp ủy (VPDU). 
Hãy phân tích báo cáo hiệu suất công việc và sự tuân thủ quy chế của cán bộ sau đây:

THÔNG TIN CHUNG:
- Họ tên: ${full_name}
- Chức vụ/Vai trò: ${role}
- Kỳ báo cáo: ${periodKey}

BẢN PHÂN CÔNG CHỨC NĂNG NHIỆM VỤ CHÍNH THỨC:
${jobDescriptionText}

CHỈ SỐ THỐNG KÊ HIỆU SUẤT TRONG KỲ:
- Điểm trung bình tổng hợp: ${staffData.displayScore}/100
- Điểm chất lượng trung bình: ${stats.avgQuality}/100
- Điểm tiến độ trung bình: ${stats.avgProgress}/100
- Chỉ số khối lượng công việc: ${stats.avgWorkload}/100
- Số nhiệm vụ chủ trì: ${stats.taskCount.primary}
- Số nhiệm vụ phối hợp: ${stats.taskCount.collab}

DANH SÁCH NHIỆM VỤ TIÊU BIỂU TRONG KỲ:
${taskSummary}

YÊU CẦU PHÂN TÍCH CHUYÊN SÂU:
Hãy đưa ra một bản đánh giá chuyên nghiệp, khách quan, mang tính xây dựng bám sát chức trách được giao của cán bộ. 
Kết quả trả về định dạng Markdown với các mục sau:
1. **Đánh giá tổng quan & Độ tuân thủ chức trách**: Tóm tắt ngắn gọn diện mạo hiệu suất trong kỳ. Cán bộ đã thực hiện đúng và đầy đủ các mảng công việc được phân công chính thức ở trên chưa? Có làm thêm việc gì ngoài luồng để hỗ trợ cơ quan không?
2. **Thế mạnh nổi bật**: Dựa trên dữ liệu và chức trách, cán bộ làm tốt nhất ở mảng nào?
3. **Điểm hạn chế cần cải thiện**: Các vấn đề tồn tại về chất lượng, tiến độ hoặc sự phân bổ công việc chưa cân đối với chức năng nhiệm vụ.
4. **Kiến nghị quản trị & Phân bổ công tác**: Đề xuất cụ thể cho lãnh đạo về việc giao việc có trúng vai trò hơn không, bồi dưỡng kỹ năng nào, hoặc khen thưởng/nhắc nhở cán bộ này thế nào.

Lưu ý: Văn phong trang trọng, chuẩn mực công sở Việt Nam. Nếu dữ liệu còn ít, hãy nhận xét thận trọng.
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
