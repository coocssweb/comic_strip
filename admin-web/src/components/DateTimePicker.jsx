import React, { useState, useEffect, useRef } from 'react';
import Toast from './Toast';
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { formatDateTimeInput } from '@utils/dateTime';

const DateTimePicker = ({ 
  value = '', 
  onChange, 
  placeholder = '选择截止日期', 
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // 用于控制当前日历视图展现的年月（翻页）
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  // 选中日期的各组成部分暂存状态，便于在点击“确定”前暂存
  const [selYear, setSelYear] = useState(null);
  const [selMonth, setSelMonth] = useState(null);
  const [selDay, setSelDay] = useState(null);
  const [selHour, setSelHour] = useState(23); // 暂存选中的小时，默认 23 点以兼容旧数据

  const containerRef = useRef(null);
  const hourListRef = useRef(null);
  const isInternalClickRef = useRef(false);

  // 浮层打开或选中小时变化时，自动将选中项滚动到可视区域
  useEffect(() => {
    if (isOpen && hourListRef.current && selHour !== null) {
      if (isInternalClickRef.current) {
        isInternalClickRef.current = false;
        return;
      }
      const timer = setTimeout(() => {
        if (!hourListRef.current) return;
        const activeEl = hourListRef.current.querySelector(`[data-hour="${selHour}"]`);
        if (activeEl) {
          activeEl.scrollIntoView({ block: 'nearest' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selHour]);

  // 解析外部值 YYYY-MM-DDTHH:mm
  const parseValue = (val) => {
    if (!val) return { year: null, month: null, day: null, hour: null };
    try {
      const parts = val.split('T');
      const datePart = parts[0];
      const timePart = parts[1] || '00:00';
      const [y, m, d] = datePart.split('-').map(Number);
      const [h] = timePart.split(':').map(Number);
      return { year: y, month: m - 1, day: d, hour: h };
    } catch (e) {
      console.error('Failed to parse DatePicker value:', val, e);
      return { year: null, month: null, day: null, hour: null };
    }
  };

  // 格式化输出为 YYYY-MM-DDTHH:mm，自动固定分钟为 00
  const formatValue = (y, m, d, h) => {
    return formatDateTimeInput(new Date(y, m, d, h, 0));
  };

  // 当外部 value 变化或打开弹窗时，初始化/同步内部状态
  useEffect(() => {
    if (value) {
      const parsed = parseValue(value);
      if (parsed.year !== null) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
        setSelYear(parsed.year);
        setSelMonth(parsed.month);
        setSelDay(parsed.day);
        setSelHour(parsed.hour !== null ? parsed.hour : 23);
        return;
      }
    }
    
    // 如果无初始值，默认置空并重置时间为默认值
    setViewYear(new Date().getFullYear());
    setViewMonth(new Date().getMonth());
    setSelYear(null);
    setSelMonth(null);
    setSelDay(null);
    setSelHour(23);
  }, [value, isOpen]);

  // 点击外部自动关闭
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  // 翻页查看上个月
  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  // 翻页查看下个月
  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // 判定某一日期是否属于过去的历史日期
  const isDateDisabled = (year, month, day) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cellDate = new Date(year, month, day);
    return cellDate < today;
  };

  // 获取月历天数表格排版 (周一到周日排列)
  const getCalendarDays = () => {
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // (0-6)
    const currentMonthDays = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days = [];

    // 周一到周日排列，偏移计算：周一为0，周二为1...周日为6
    const prevPaddingCount = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    // 1. 上月余部天数填充
    for (let i = prevPaddingCount - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      let y = viewYear;
      let m = viewMonth - 1;
      if (viewMonth === 0) {
        y = viewYear - 1;
        m = 11;
      }
      days.push({
        day: d,
        year: y,
        month: m,
        isCurrentMonth: false,
        disabled: true // 上月填充数据置灰且禁止点击
      });
    }

    // 2. 本月真实天数填充
    for (let i = 1; i <= currentMonthDays; i++) {
      days.push({
        day: i,
        year: viewYear,
        month: viewMonth,
        isCurrentMonth: true,
        disabled: isDateDisabled(viewYear, viewMonth, i)
      });
    }

    // 3. 下月首部天数填充，动态补全 35 或 42 格
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      let y = viewYear;
      let m = viewMonth + 1;
      if (viewMonth === 11) {
        y = viewYear + 1;
        m = 0;
      }
      days.push({
        day: i,
        year: y,
        month: m,
        isCurrentMonth: false,
        disabled: true // 下月填充数据置灰且禁止点击
      });
    }

    return days;
  };

  // 判定某一小时是否属于过去的历史小时
  const isHourDisabled = (h) => {
    if (selYear === null || selMonth === null || selDay === null) return true;
    const now = new Date();
    const isToday = now.getFullYear() === selYear && now.getMonth() === selMonth && now.getDate() === selDay;
    if (isToday) {
      return h < now.getHours();
    }
    return false;
  };

  // 选择日历网格中的有效日期
  const handleDateClick = (cell) => {
    if (cell.disabled) return;
    setSelYear(cell.year);
    setSelMonth(cell.month);
    setSelDay(cell.day);

    const now = new Date();
    const isToday = now.getFullYear() === cell.year && now.getMonth() === cell.month && now.getDate() === cell.day;
    if (isToday) {
      const currentHour = now.getHours();
      if (selHour === null || selHour < currentHour) {
        setSelHour(currentHour);
      }
    } else if (selHour === null) {
      setSelHour(23);
    }
  };

  // 确认并提交
  const handleConfirm = (e) => {
    e.stopPropagation();
    if (selYear === null || selMonth === null || selDay === null) {
      Toast.Warning('请先选择有效的截止日期！');
      return;
    }
    const formatted = formatValue(selYear, selMonth, selDay, selHour);
    onChange(formatted);
    setIsOpen(false);
  };

  // 清除截止日期
  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // 输入框展示中文格式化文本 (显示日期和小时)
  const getFormattedDisplay = () => {
    if (!value) return '';
    try {
      const parts = value.split('T');
      const datePart = parts[0];
      const timePart = parts[1] || '00:00';
      const [y, m, d] = datePart.split('-');
      const [h] = timePart.split(':');
      return `${y}年${Number(m)}月${Number(d)}日 ${Number(h)}时`;
    } catch (e) {
      return value;
    }
  };

  // 星期标题栏
  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <div ref={containerRef} className="relative w-full text-left">
      
      {/* 触发输入框 */}
      <div
        onClick={toggleDropdown}
        className={`flex min-h-10 w-full items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm transition-colors cursor-pointer select-none
          ${disabled ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-border cursor-not-allowed' : 'border-border text-foreground hover:border-[#5f6368] dark:hover:border-slate-400'}
          ${isOpen ? 'border-[#01875f] ring-1 ring-ring' : ''}`}
      >
        <div className="min-w-0 flex-1 pr-3">
          <span className={`block truncate ${value ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            {getFormattedDisplay() || placeholder}
          </span>
        </div>
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            className="shrink-0 text-xs font-medium text-primary hover:bg-primary/10 dark:hover:bg-primary/20 h-7 px-2"
          >
            清除
          </Button>
        )}
      </div>

      {/* 级联日期浮层面板 (DatePicker Popover) */}
      {isOpen && (
        <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 z-50 w-[380px] rounded-lg border border-border bg-card px-4 py-4 shadow-[0_2px_8px_rgba(60,64,67,0.18)] animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200 flex flex-col gap-3">
          
          {/* 双栏布局内容区 */}
          <div className="flex flex-row gap-2 select-none">
            
            {/* 左侧：月历视图 */}
            <div className="flex-1">
              
              {/* 月历导航标题栏 */}
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {viewYear} 年 {viewMonth + 1} 月
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handlePrevMonth}
                    className="text-xs font-medium h-7 px-2.5"
                  >
                    上月
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleNextMonth}
                    className="text-xs font-medium h-7 px-2.5"
                  >
                    下月
                  </Button>
                </div>
              </div>

              {/* 星期标题行 */}
              <div className="grid grid-cols-7 gap-1 text-center mb-2.5">
                {weekdays.map(d => (
                  <span key={d} className="text-[11px] font-medium text-muted-foreground uppercase">
                    {d}
                  </span>
                ))}
              </div>

              {/* 日历格子网格 */}
              <div className="grid grid-cols-7 gap-1.5">
                {getCalendarDays().map((cell, idx) => {
                  const isSelected = selYear === cell.year && selMonth === cell.month && selDay === cell.day;
                  const now = new Date();
                  const isToday = now.getFullYear() === cell.year && now.getMonth() === cell.month && now.getDate() === cell.day;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleDateClick(cell)}
                      className={`mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xs font-medium transition-colors
                        ${!cell.isCurrentMonth ? 'text-gray-300 dark:text-slate-600 opacity-30 pointer-events-none' : ''}
                        ${cell.disabled ? 'text-gray-300 dark:text-slate-600 bg-muted line-through pointer-events-none' : 'text-foreground hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary'}
                        ${isToday && !isSelected ? 'border border-primary text-primary' : ''}
                        ${isSelected ? 'bg-primary text-white hover:bg-primary/95' : ''}
                      `}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 中间分割线 */}
            <div className="w-[1px] bg-[#f1f3f4] dark:bg-border self-stretch my-1 mx-2"></div>

            {/* 右侧：小时选择面板 */}
            <div className="w-20 flex flex-col">
              <div className="text-[11px] font-medium text-muted-foreground text-center mb-3.5 uppercase">
                时间
              </div>
              <div ref={hourListRef} className="flex-1 overflow-y-auto max-h-[220px] pr-1 flex flex-col gap-1.5 text-center scrollbar-thin">
                {Array.from({ length: 24 }, (_, i) => i).map((h) => {
                  const isDisabled = isHourDisabled(h);
                  const isSelected = selHour === h;
                  return (
                    <Button
                      key={h}
                      type="button"
                      variant="ghost"
                      data-hour={h}
                      disabled={isDisabled}
                      onClick={() => {
                        isInternalClickRef.current = true;
                        setSelHour(h);
                      }}
                      className={cn(
                        "h-8 w-full text-sm font-medium rounded transition-colors",
                        isDisabled ? 'text-gray-400 dark:text-slate-500 line-through pointer-events-none' : 'text-foreground hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary',
                        isSelected && !isDisabled ? 'bg-primary text-white hover:bg-primary/95' : ''
                      )}
                    >
                      {String(h).padStart(2, '0')}:00
                    </Button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* 底部操作面板 */}
          <div className="flex items-center justify-between border-t border-[#f1f3f4] dark:border-border pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              className="text-xs font-medium h-8 px-3"
            >
              清除
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="text-xs font-medium h-8 px-3"
              >
                取消
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={handleConfirm}
                className="text-xs font-medium h-8 px-4"
              >
                确定
              </Button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default DateTimePicker;
