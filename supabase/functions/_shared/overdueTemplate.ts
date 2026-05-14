export type OverdueItem = { name: string; daysOverdue: number; type: 'review' | 'assignment' };

function row(name: string, daysOverdue: number, type: OverdueItem['type']): string {
  const color = type === 'review' ? '#3b82f6' : '#8b5cf6';
  const label = type === 'review' ? '🔁 Review' : '📋 Assignment';
  return `
<div style="border: 1px solid #e5e7eb; border-left: 4px solid ${color}; border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; background: white;">
  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <span style="font-size: 12px; color: ${color}; font-weight: 600; text-transform: uppercase;">${label}</span>
      <p style="margin: 4px 0 0 0; color: #1e3a5f; font-weight: 600; font-size: 15px;">${name}</p>
    </div>
    <span style="background: #fee2e2; color: #ef4444; font-size: 12px; font-weight: 700; padding: 1px 4px; border-radius: 12px; white-space: nowrap; align-self: center; display: flex; align-items: center; justify-content: center; height: 20px;">
      ${daysOverdue}d overdue
    </span>
  </div>
</div>`;
}

export function overdueHtml(studentName: string, items: OverdueItem[]): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8faff; padding: 40px 20px;">
  <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 30px;">
    <h1 style="color: white; font-size: 26px; margin: 0 0 8px 0;">You have missing assignments overdue</h1>
    <p style="color: rgba(255,255,255,0.9); font-size: 15px; margin: 0;">Don't fall behind on your learning!</p>
  </div>
  <div style="background: white; border-radius: 16px; padding: 32px; margin-bottom: 20px;">
    <h2 style="color: #1e3a5f; font-size: 20px; margin: 0 0 8px 0;">Hi ${studentName},</h2>
    <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      The following items are overdue. Log in and complete them to stay on track!
    </p>
    ${items.map((i) => row(i.name, i.daysOverdue, i.type)).join('')}
    <div style="background: #dbeafe; border-left: 4px solid #2563eb; border-radius: 8px; padding: 14px 16px; margin-top: 20px;">
      <p style="color: #1e40af; margin: 0; font-size: 14px;">⏰ The longer you wait, the harder it gets to remember. Complete your items today!</p>
    </div>
  </div>
  <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0;">Quest Learning</p>
</div>`;
}
