export const processMonthlyCostData = (logs: any[]) => {
  const monthlyData: Record<string, number> = {};

  logs.forEach(log => {
    // Tạo key dạng "T1/24", "T2/24"
    const date = new Date(log.created_at);
    const key = `T${date.getMonth() + 1}`; 
    
    if (!monthlyData[key]) {
      monthlyData[key] = 0;
    }
    monthlyData[key] += log.cost || 0;
  });

  const chartData = Object.keys(monthlyData).map(key => ({
    value: monthlyData[key],
    label: key,
    frontColor: '#4F46E5',
    topLabelComponent: () => null,
  }));

  return chartData;
};

export const processCategoryCostData = (logs: any[]) => {
  const categoryData: Record<string, number> = {};

  logs.forEach(log => {
    const categoryName = log.service_rules?.part_name || 'Chi phí khác';
    
    if (!categoryData[categoryName]) {
      categoryData[categoryName] = 0;
    }
    categoryData[categoryName] += log.cost || 0;
  });

  // Màu sắc ngẫu nhiên
  const colors = ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

  const chartData = Object.keys(categoryData).map((key, index) => ({
    value: categoryData[key],
    text: '',
    color: colors[index % colors.length],
    legend: key, // Tên chú thích
  }));

  return chartData;
};