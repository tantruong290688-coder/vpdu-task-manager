
$file = 'd:\Quan tri nhiem vu VPDU\vpdu-task-manager\src\pages\StaffPerformance.jsx'
$content = Get-Content $file -Raw

# Replace headers (using regex for Vietnamese chars)
$content = $content -replace '<th className="px-4 py-4 text-center">TB Ch. trì</th>', '<th className="px-4 py-4 text-center">.ã chốt</th>'
$content = $content -replace '<th className="px-4 py-4 text-center">TB Phối hợp</th>', '<th className="px-4 py-4 text-center">TB .iểm</th>'

# Replace cells
$content = $content -replace '\{staff\.stats\.avgPrimary\}', '{staff.stats.taskCount.total}'
$content = $content -replace '\{staff\.stats\.avgCollab\}', '{staff.displayScore}'

# Formula section
$content = $content -replace 'Nhiệm vụ chủ trì \(TB\)', 'Chất lượng công việc'
$content = $content -replace 'Nhiệm vụ phối hợp \(TB\)', 'Tiến độ thực hiện'

$content | Set-Content $file -Encoding UTF8
