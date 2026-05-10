const period = '2026-Q2';
const tasks = [
  { id: '1', completed_at: '2026-05-10T08:02:27.581+00:00', evaluation_period: 'Quý' },
  { id: '2', due_date: '2026-05-08', evaluation_period: 'Quý' },
  { id: '3', due_date: '2026-04-15', evaluation_period: 'Tháng' }
];

const filteredTasks = tasks.filter(t => {
  if (!period) return true;
  if (t.evaluation_period === period) return true;

  const isYear = /^\d{4}$/.test(period);
  const isQuarter = /^\d{4}-Q[1-4]$/.test(period);
  const isMonth = /^\d{4}-\d{2}$/.test(period);

  const taskDate = t.completed_at || t.due_date;
  if (!taskDate && !t.evaluation_period) return false;

  let tYear, tMonth;
  if (t.evaluation_period && /^\d{4}-\d{2}$/.test(t.evaluation_period)) {
    [tYear, tMonth] = t.evaluation_period.split('-').map(Number);
  } else if (taskDate) {
    tYear = new Date(taskDate).getFullYear();
    tMonth = new Date(taskDate).getMonth() + 1;
  }

  if (!tYear || !tMonth) return false;

  if (isYear) {
    return tYear === parseInt(period) || (t.evaluation_period && t.evaluation_period.startsWith(period));
  }

  if (isQuarter) {
    const [pYear, pQ] = period.split('-Q');
    const quarter = Math.ceil(tMonth / 3);
    return tYear === parseInt(pYear) && quarter === parseInt(pQ);
  }

  if (isMonth) {
    return (tYear === parseInt(period.split('-')[0]) && tMonth === parseInt(period.split('-')[1])) || 
           (t.evaluation_period === period);
  }

  return false;
});

console.log('Filtered tasks length:', filteredTasks.length);
filteredTasks.forEach(t => console.log(`ID: ${t.id}, Year: ${new Date(t.completed_at || t.due_date).getFullYear()}, Month: ${new Date(t.completed_at || t.due_date).getMonth() + 1}`));
