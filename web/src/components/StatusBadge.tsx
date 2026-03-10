interface StatusBadgeProps {
  status: 'normal' | 'dirty' | 'error';
}

const defaultConfig = { label: '未知', className: 'bg-gray-100 text-gray-800' };

const statusConfig: Record<string, { label: string; className: string }> = {
  normal: { label: '正常', className: 'bg-green-100 text-green-800' },
  dirty: { label: '有变更', className: 'bg-yellow-100 text-yellow-800' },
  error: { label: '异常', className: 'bg-red-100 text-red-800' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? defaultConfig;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.className ?? defaultConfig.className}`}>
      {config?.label ?? defaultConfig.label}
    </span>
  );
}
