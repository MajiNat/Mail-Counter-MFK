import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mail,
  Flag,
  Copy,
  Trash2,
  CalendarDays,
  Sun,
  Moon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calculator,
  BarChart3,
  Archive,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────
type RowKey = 'Вх' | 'Дп' | 'Инфо' | 'Кц';
type DayType = '1 день' | '2 день';
type ActiveTab = 'calculator' | 'analytics' | 'archive';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface SavedData {
  entries: Record<RowKey, string>;
  times: Record<RowKey, string>;
}

interface ArchiveEntry {
  date: string;
  day: DayType;
  entries: Record<RowKey, string>;
  times: Record<RowKey, string>;
  totals: Record<RowKey, number>;
  grandTotal: number;
}

// ─── Constants ───────────────────────────────────────────────────
const ROWS: RowKey[] = ['Вх', 'Дп', 'Инфо', 'Кц'];

const ROW_CONFIG: Record<RowKey, { color: string; bgColor: string; borderColor: string; label: string }> = {
  'Вх': { color: '#00d4ff', bgColor: 'rgba(0, 212, 255, 0.1)', borderColor: '#00d4ff', label: 'ВХ' },
  'Дп': { color: '#ffd700', bgColor: 'rgba(255, 215, 0, 0.1)', borderColor: '#ffd700', label: 'ДП' },
  'Инфо': { color: '#00ff88', bgColor: 'rgba(0, 255, 136, 0.1)', borderColor: '#00ff88', label: 'ИНФО' },
  'Кц': { color: '#ff6b8a', bgColor: 'rgba(255, 107, 138, 0.1)', borderColor: '#ff6b8a', label: 'КЦ' },
};

const STORAGE_PREFIX = 'mail_counter_';

// ─── Helpers ─────────────────────────────────────────────────────
function getToday(): string {
  return new Date().toLocaleDateString('ru-RU');
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('ru-RU');
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('ru-RU');
}

function parseSum(text: string): number {
  if (!text.trim()) return 0;
  const parts = text.replace(/\+/g, ' ').trim().split(/\s+/);
  return parts.reduce((acc, p) => {
    const n = parseInt(p, 10);
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
}

function storageKey(date: string, day: DayType): string {
  return `${STORAGE_PREFIX}${date}_${day === '1 день' ? 'day1' : 'day2'}`;
}

function configKey(): string {
  return `${STORAGE_PREFIX}config`;
}

// ── Toast Component ─────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-toast-in flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl min-w-[280px] max-w-[380px] ${
            toast.type === 'success'
              ? 'border-green-500/30 bg-green-500/15 text-green-400'
              : toast.type === 'error'
              ? 'border-red-500/30 bg-red-500/15 text-red-400'
              : 'border-cyan-500/30 bg-cyan-500/15 text-cyan-400'
          }`}
          onClick={() => onDismiss(toast.id)}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : toast.type === 'error' ? (
            <XCircle className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────
export default function App() {
  const [day, setDay] = useState<DayType>('1 день');
  const [baseDate, setBaseDate] = useState<string>(getToday());
  const [entries, setEntries] = useState<Record<RowKey, string>>({
    Вх: '',
    Дп: '',
    Инфо: '',
    Кц: '',
  });
  const [times, setTimes] = useState<Record<RowKey, string>>({
    Вх: '',
    Дп: '',
    Инфо: '',
    Кц: '',
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('calculator');
  const [archiveData, setArchiveData] = useState<ArchiveEntry[]>([]);

  const toastIdRef = useRef(0);
  const autoPlusTimers = useRef<Record<RowKey, ReturnType<typeof setTimeout> | null>>({
    Вх: null,
    Дп: null,
    Инфо: null,
    Кц: null,
  });

  const currentDate = day === '1 день' ? baseDate : getTomorrow();

  // ─── Toast helpers ───────────────────────────────────────────
  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Totals ──────────────────────────────────────────────────
  const totals: Record<RowKey, number> = {
    Вх: parseSum(entries['Вх']),
    Дп: parseSum(entries['Дп']),
    Инфо: parseSum(entries['Инфо']),
    Кц: parseSum(entries['Кц']),
  };

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  // ─── Summary text ────────────────────────────────────────────
  const summaryText = day === '1 день'
    ? `Доброе утро! За ${currentDate} МФК БД:\n${ROWS.map((r) => `${r} - ${totals[r]};`).join('\n')}`
    : `За ${currentDate} МФК БД:\n${ROWS.map((r) => `${r} - ${totals[r]} (${times[r] || 'пусто'});`).join('\n')}`;

  // ─── Save to localStorage ────────────────────────────────────
  const save = useCallback(() => {
    try {
      const key = storageKey(currentDate, day);
      const data: SavedData = { entries, times };
      localStorage.setItem(key, JSON.stringify(data));

      // Save config
      localStorage.setItem(
        configKey(),
        JSON.stringify({ day, date: currentDate })
      );
    } catch {
      addToast('Ошибка сохранения', 'error');
    }
  }, [entries, times, currentDate, day, addToast]);

  // ─── Load from localStorage ──────────────────────────────────
  const load = useCallback(
    (date: string, d: DayType) => {
      try {
        const key = storageKey(date, d);
        const stored = localStorage.getItem(key);
        if (stored) {
          const data: SavedData = JSON.parse(stored);
          setEntries(data.entries);
          setTimes(data.times);
        } else {
          setEntries({ Вх: '', Дп: '', Инфо: '', Кц: '' });
          setTimes({ Вх: '', Дп: '', Инфо: '', Кц: '' });
        }
      } catch {
        setEntries({ Вх: '', Дп: '', Инфо: '', Кц: '' });
        setTimes({ Вх: '', Дп: '', Инфо: '', Кц: '' });
      }
    },
    []
  );

  // ─── Initial load ────────────────────────────────────────────
  useEffect(() => {
    const config = localStorage.getItem(configKey());
    if (config) {
      try {
        const { day: savedDay, date: savedDate } = JSON.parse(config);
        setDay(savedDay as DayType);
        setBaseDate(savedDate);
        load(savedDate, savedDay as DayType);
      } catch {
        setBaseDate(getToday());
        load(getToday(), '1 день');
      }
    } else {
      const today = getToday();
      const yesterday = getYesterday();
      const yesterdayDay2Key = storageKey(yesterday, '2 день');
      
      if (localStorage.getItem(yesterdayDay2Key)) {
        // Copy yesterday day2 to today day1
        try {
          const yesterdayData = JSON.parse(localStorage.getItem(yesterdayDay2Key) || '{}');
          const todayDay1Key = storageKey(today, '1 день');
          const todayData: SavedData = {
            entries: yesterdayData.entries || { Вх: '', Дп: '', Инфо: '', Кц: '' },
            times: { Вх: '', Дп: '', Инфо: '', Кц: '' },
          };
          localStorage.setItem(todayDay1Key, JSON.stringify(todayData));
          setDay('1 день');
          setBaseDate(today);
          load(today, '1 день');
        } catch {
          setBaseDate(today);
          load(today, '1 день');
        }
      } else {
        setBaseDate(today);
        load(today, '1 день');
      }
    }
    setIsLoaded(true);
  }, [load]);

  // ─── Auto-save ───────────────────────────────────────────────
  useEffect(() => {
    if (isLoaded) {
      save();
    }
  }, [entries, times, day, baseDate, isLoaded, save]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleEntryChange = useCallback((row: RowKey, value: string) => {
    setEntries((prev) => ({ ...prev, [row]: value }));
    
    // Clear existing timer for this row
    if (autoPlusTimers.current[row]) {
      clearTimeout(autoPlusTimers.current[row]!);
    }
    
    // Auto-add "+" after 1 second if value ends with a digit
    autoPlusTimers.current[row] = setTimeout(() => {
      setEntries((prev) => {
        const current = prev[row];
        if (current && !current.endsWith('+') && /\d$/.test(current)) {
          return { ...prev, [row]: current + '+' };
        }
        return prev;
      });
    }, 1000);
  }, []);

  const handleTimeChange = useCallback((row: RowKey, value: string) => {
    setTimes((prev) => ({ ...prev, [row]: value }));
  }, []);

  const handleDaySwitch = useCallback((d: DayType) => {
    setDay(d);
    const date = d === '1 день' ? baseDate : getTomorrow();
    load(date, d);
    addToast(`Переключено на ${d}`, 'info');
  }, [baseDate, load, addToast]);

const handleClearDay = useCallback(() => {
  const key = storageKey(currentDate, day);

  // удаляем только текущую запись
  localStorage.removeItem(key);

  setEntries({
    Вх: '',
    Дп: '',
    Инфо: '',
    Кц: '',
  });

  setTimes({
    Вх: '',
    Дп: '',
    Инфо: '',
    Кц: '',
  });

  const today = getToday();

  // =====================================
  // ЕСЛИ УДАЛЯЕМ 1 ДЕНЬ
  // =====================================

  if (day === '1 день') {
    // если дата сегодняшняя —
    // остаёмся на этом же 1 дне
    if (baseDate === today) {
      load(today, '1 день');

      addToast(
        'Данные текущего 1 дня удалены',
        'info'
      );

      return;
    }

    // если дата старая —
    // переключаемся на 2 день сегодняшней даты
    setBaseDate(today);
    setDay('2 день');

    load(today, '2 день');

    addToast(
      'Переключено на 2 день',
      'info'
    );

    return;
  }

  // =====================================
  // ЕСЛИ УДАЛЯЕМ 2 ДЕНЬ
  // =====================================

  // если дата старая (например спустя месяц)
  // начинаем новый цикл
  if (baseDate !== today) {
    setBaseDate(today);
    setDay('1 день');

    load(today, '1 день');

    addToast(
      'Начат новый цикл с 1 дня',
      'info'
    );

    return;
  }

  // если удаляем сегодняшний 2 день —
  // остаёмся на нем
  load(today, '2 день');

  addToast(
    'Данные текущего 2 дня удалены',
    'info'
  );
}, [addToast, day, currentDate, load, baseDate]);

  // ─── Archive functions ─────────────────────────────────────────
  const loadArchiveData = useCallback(() => {
    const archive: ArchiveEntry[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX) && !key.endsWith('_config')) {
        try {
          const data: SavedData = JSON.parse(localStorage.getItem(key) || '{}');
          const keyParts = key.replace(STORAGE_PREFIX, '').split('_');
          const date = keyParts[0];
          const dayType: DayType = keyParts[1] === 'day1' ? '1 день' : '2 день';
          const entryTotals: Record<RowKey, number> = {
            Вх: parseSum(data.entries?.['Вх'] || ''),
            Дп: parseSum(data.entries?.['Дп'] || ''),
            Инфо: parseSum(data.entries?.['Инфо'] || ''),
            Кц: parseSum(data.entries?.['Кц'] || ''),
          };
          archive.push({
            date,
            day: dayType,
            entries: data.entries || { Вх: '', Дп: '', Инфо: '', Кц: '' },
            times: data.times || { Вх: '', Дп: '', Инфо: '', Кц: '' },
            totals: entryTotals,
            grandTotal: Object.values(entryTotals).reduce((a, b) => a + b, 0),
          });
        } catch {
          // Skip invalid entries
        }
      }
    }
    // Sort by date descending
    archive.sort((a, b) => {
      const [d1, m1, y1] = a.date.split('.').map(Number);
      const [d2, m2, y2] = b.date.split('.').map(Number);
      const dateDiff = new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.day === '1 день' ? -1 : 1;
    });
    setArchiveData(archive);
  }, []);

  const deleteArchiveEntry = useCallback((date: string, dayType: DayType) => {
    const key = storageKey(date, dayType);
    localStorage.removeItem(key);
    loadArchiveData();
    addToast('Запись удалена из архива', 'info');
  }, [loadArchiveData, addToast]);

  const clearAllArchive = useCallback(() => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX) && !key.endsWith('_config')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    loadArchiveData();
    addToast('Архив очищен', 'info');
  }, [loadArchiveData, addToast]);

  // ─── Analytics functions ───────────────────────────────────────
  const getAnalyticsData = useCallback(() => {
    const stats: Record<string, { total: number; byRow: Record<RowKey, number> }> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX) && !key.endsWith('_config')) {
        try {
          const data: SavedData = JSON.parse(localStorage.getItem(key) || '{}');
          const keyParts = key.replace(STORAGE_PREFIX, '').split('_');
          const date = keyParts[0];
          
          if (!stats[date]) {
            stats[date] = { total: 0, byRow: { Вх: 0, Дп: 0, Инфо: 0, Кц: 0 } };
          }
          
          ROWS.forEach(row => {
            const val = parseSum(data.entries?.[row] || '');
            stats[date].byRow[row] += val;
            stats[date].total += val;
          });
        } catch {
          // Skip invalid entries
        }
      }
    }
    return stats;
  }, []);

  const copySummary = useCallback(() => {
    navigator.clipboard.writeText(summaryText).then(() => {
      addToast('Сводка скопирована!', 'success');
    }).catch(() => {
      addToast('Ошибка копирования', 'error');
    });
  }, [summaryText, addToast]);

  // ─── Input validation ────────────────────────────────────────
  const handleKeyDown = useCallback((row: RowKey, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Cancel auto-plus timer on Delete/Backspace so "+" doesn't get re-added
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (autoPlusTimers.current[row]) {
        clearTimeout(autoPlusTimers.current[row]!);
        autoPlusTimers.current[row] = null;
      }
      return;
    }
    const allowed = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (e.key === '+' || (e.key >= '0' && e.key <= '9')) return;
    e.preventDefault();
  }, []);

  const handleTimeKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', ':', '.', ','];
    if (allowed.includes(e.key)) return;
    if (e.key >= '0' && e.key <= '9') return;
    e.preventDefault();
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-pulse text-[#8b5cf6] text-xl font-medium">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? 'bg-[#0a0a0f] text-[#e6e6f0]' : 'bg-gray-50 text-gray-900'
    }`}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
        darkMode ? 'border-white/[0.06] bg-[#0a0a0f]/80' : 'border-gray-200 bg-white/80'
      }`}>
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] shadow-lg shadow-[#7c3aed]/25">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Подсчёт писем МФК БД</h1>
              <p className="text-xs text-[#6b7280]">Автоматизированная система учёта входящей почты</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                darkMode ? 'border-white/[0.06] bg-white/[0.02] text-[#fbbf24]' : 'border-gray-300 bg-gray-100 text-amber-600'
              } transition-all hover:opacity-80`}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            
            <nav className={`flex items-center gap-1 rounded-xl border p-1 ${
              darkMode ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-300 bg-gray-100'
            }`}>
              <button 
                onClick={() => { setActiveTab('calculator'); loadArchiveData(); }}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === 'calculator'
                    ? 'bg-[#5b4fd9] text-white shadow-lg'
                    : darkMode ? 'text-[#6b7280] hover:text-[#e6e6f0]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calculator className="h-4 w-4" />
                Калькулятор
              </button>
              <button 
                onClick={() => { setActiveTab('analytics'); loadArchiveData(); }}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-[#5b4fd9] text-white shadow-lg'
                    : darkMode ? 'text-[#6b7280] hover:text-[#e6e6f0]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                Аналитика
              </button>
              <button 
                onClick={() => { setActiveTab('archive'); loadArchiveData(); }}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === 'archive'
                    ? 'bg-[#5b4fd9] text-white shadow-lg'
                    : darkMode ? 'text-[#6b7280] hover:text-[#e6e6f0]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Archive className="h-4 w-4" />
                Архив
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Top Controls */}
        <div className={`mb-6 flex items-center justify-between rounded-2xl border p-4 ${
          darkMode ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-200 bg-white'
        }`}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-amber-800" />
              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Выберите дату</span>
            </div>
            <input
              type="date"
              value={currentDate.split('.').reverse().join('-')}
              onChange={(e) => {
                const [year, month, dayNum] = e.target.value.split('-');
                setBaseDate(`${dayNum}.${month}.${year}`);
              }}
              className={`w-[130px] rounded-xl border px-2 py-2 text-sm focus:border-[#8b5cf6]/50 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 ${
                darkMode 
                  ? 'border-white/[0.06] bg-[#1a1a25] text-[#e6e6f0] [&::-webkit-calendar-picker-indicator]:invert' 
                  : 'border-gray-300 bg-white text-gray-900'
              }`}
            />
            
            <div className="ml-4 flex items-center gap-2">
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Режим дня</span>
              <div className={`flex rounded-xl border p-1 ${
                darkMode ? 'border-white/[0.06] bg-[#1a1a25]' : 'border-gray-300 bg-gray-100'
              }`}>
                <button
                  onClick={() => handleDaySwitch('1 день')}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    day === '1 день'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25'
                      : darkMode 
                        ? 'text-[#6b7280] hover:text-[#e6e6f0]' 
                        : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  1 День
                </button>
                <button
                  onClick={() => handleDaySwitch('2 день')}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    day === '2 день'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                      : darkMode 
                        ? 'text-[#6b7280] hover:text-[#e6e6f0]' 
                        : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  2 День
                </button>
              </div>
            </div>
            
            {/* Grand Total in Header */}
            <div className="ml-6 flex items-center gap-3 rounded-xl border border-[#8b5cf6]/30 bg-gradient-to-r from-[#8b5cf6]/10 to-[#4f46e5]/10 px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[#8b5cf6]">Всего писем</span>
              <span
                className="text-2xl font-bold tabular-nums"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {grandTotal}
              </span>
            </div>
          </div>


        </div>

        {/* Calculator Tab */}
        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column - Input Rows */}
            <div className="lg:col-span-2 space-y-3">
              {ROWS.map((row) => {
                const config = ROW_CONFIG[row];
                return (
                  <div
                    key={row}
                    className={`group relative flex items-center gap-4 rounded-2xl border p-4 transition-all duration-300 ${
                      darkMode 
                        ? 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08]' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    style={{ borderLeft: `3px solid ${config.borderColor}` }}
                  >
                    {/* Label */}
                    <div
                      className="flex h-12 w-16 items-center justify-center rounded-xl font-mono text-lg font-bold tracking-wider"
                      style={{ color: config.color, backgroundColor: config.bgColor }}
                    >
                      {config.label}
                    </div>

                    {/* Input Field */}
                    <div className="relative flex-1">
                      <input
                        ref={(el) => {
                          if (el) {
                            el.addEventListener('wheel', (e) => {
                              e.preventDefault();
                              el.scrollLeft += (e as WheelEvent).deltaY;
                            }, { passive: false });
                          }
                        }}
                        type="text"
                        value={entries[row]}
                        onChange={(e) => handleEntryChange(row, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(row, e)}
                        placeholder=""
                        className={`w-full overflow-x-auto whitespace-nowrap rounded-xl border px-4 py-3 font-mono text-lg transition-all duration-200 focus:outline-none focus:ring-2 ${
                          darkMode 
                            ? 'border-white/[0.06] bg-[#1a1a25] text-[#e6e6f0] placeholder:text-[#4a4a5e] focus:bg-[#202030]' 
                            : 'border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white'
                        }`}
                        style={{ 
                          scrollbarWidth: 'none', 
                          msOverflowStyle: 'none',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = config.color;
                          e.target.style.boxShadow = `0 0 0 3px ${config.color}20`;
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = darkMode ? 'rgba(255,255,255,0.06)' : '#d1d5db';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>

                    {/* Time Input */}
                    <div className="flex items-center gap-2">
                      <Flag className="h-3.5 w-3.5" style={{ color: config.color }} />
                      <input
                        type="text"
                        value={times[row]}
                        onChange={(e) => handleTimeChange(row, e.target.value.replace(/[.,]/g, ':'))}
                        onKeyDown={handleTimeKeyDown}
                        placeholder="ЧЧ:ММ"
                        className={`rounded-lg border px-2 py-1.5 font-mono transition-all duration-200 placeholder:opacity-50 focus:outline-none focus:ring-2`}
                        style={{ 
                          width: '56px',
                          fontSize: '12px',
                          borderColor: `${config.color}40`,
                          backgroundColor: darkMode ? `${config.color}15` : `${config.color}08`,
                          color: config.color,
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = config.color;
                          e.target.style.boxShadow = `0 0 0 3px ${config.color}25`;
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = `${config.color}40`;
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>

                    {/* Total */}
                    <div
                      className={`flex w-20 items-center justify-center rounded-xl px-4 py-3 font-mono text-xl font-bold tabular-nums ${
                        darkMode ? 'bg-white/[0.04]' : 'bg-gray-100'
                      }`}
                      style={{ color: config.color }}
                    >
                      {totals[row]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column - Summary Panel */}
            <div className="space-y-4">
              {/* Summary Report */}
              <div className={`rounded-2xl border p-5 ${
                darkMode ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-200 bg-white'
              }`}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Готовый отчёт</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    day === '1 день' 
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>{day}</span>
                </div>

                <div
                  onClick={copySummary}
                  className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:border-[#8b5cf6]/30 ${
                    darkMode 
                      ? 'border-white/[0.06] bg-[#1a1a25] hover:bg-[#202030]' 
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <pre className={`flex-1 whitespace-pre-wrap break-words font-mono text-sm ${darkMode ? 'text-[#a0a0b0]' : 'text-gray-600'}`}>
                      {summaryText}
                    </pre>
                    <div className="ml-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#5b4fd9] opacity-0 transition-opacity group-hover:opacity-100">
                      <Copy className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <p className={`mt-3 text-center text-xs ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>
                    Кликните на поле выше для быстрого копирования текста
                  </p>
                </div>

                {/* Delete Day Button */}
                <div className="mt-4">
                  <button
                    onClick={handleClearDay}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-gradient-to-r from-red-600/20 to-red-700/20 px-4 py-3 text-sm font-medium text-red-400 transition-all hover:from-red-600/30 hover:to-red-700/30 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить все данные текущего дня
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className={`rounded-2xl border p-6 ${
              darkMode ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-200 bg-white'
            }`}>
              <div className="mb-6 flex items-center justify-between">
                <h2 className={`text-2xl font-bold ${darkMode ? 'text-[#e6e6f0]' : 'text-gray-900'}`}>
                  📊 Аналитика
                </h2>
              </div>
              
              {(() => {
                const stats = getAnalyticsData();
                const dates = Object.keys(stats).sort((a, b) => {
                  const [d1, m1, y1] = a.split('.').map(Number);
                  const [d2, m2, y2] = b.split('.').map(Number);
                  return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime();
                });
                
                if (dates.length === 0) {
                  return (
                    <div className={`py-12 text-center ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>
                      <BarChart3 className="mx-auto mb-4 h-16 w-16 opacity-50" />
                      <p>Нет данных для анализа</p>
                    </div>
                  );
                }
                
                // Calculate totals
                const totalAll = dates.reduce((sum, d) => sum + stats[d].total, 0);
                const rowTotals: Record<RowKey, number> = { Вх: 0, Дп: 0, Инфо: 0, Кц: 0 };
                dates.forEach(d => {
                  ROWS.forEach(r => { rowTotals[r] += stats[d].byRow[r]; });
                });
                
                // Find max value for chart scaling
                const maxVal = Math.max(...dates.map(d => stats[d].total), 1);
                
                return (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                      <div className={`rounded-xl p-4 ${darkMode ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
                        <p className={`text-xs ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>Всего писем</p>
                        <p className={`text-2xl font-bold ${darkMode ? 'text-[#8b5cf6]' : 'text-purple-600'}`}>{totalAll}</p>
                      </div>
                      {ROWS.map(row => (
                        <div key={row} className={`rounded-xl p-4 ${darkMode ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
                          <p className={`text-xs ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>{row}</p>
                          <p className="text-2xl font-bold" style={{ color: ROW_CONFIG[row].color }}>{rowTotals[row]}</p>
                        </div>
                      ))}
                    </div>
                    
                    {/* Stacked Vertical Bar Chart with Totals */}
                    <div className={`rounded-xl border p-4 ${darkMode ? 'border-white/[0.06] bg-[#0a0a0f]' : 'border-gray-200 bg-gray-50'}`}>
                      <h3 className={`mb-4 text-sm font-medium ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>
                        📈 Всего писем по дням
                      </h3>
                      <div className="flex items-end gap-3" style={{ height: '260px' }}>
                        {dates.slice(0, 14).map((date) => {
                          const dayStats = stats[date];
                          const totalHeight = maxVal > 0 ? (dayStats.total / maxVal) * 100 : 0;
                          return (
                            <div key={date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                              {/* Total label */}
                              <span className={`text-xs font-bold whitespace-nowrap ${darkMode ? 'text-[#8b5cf6]' : 'text-purple-600'}`}>
                                {dayStats.total}
                              </span>
                              {/* Stacked bar */}
                              <div className="w-full relative" style={{ height: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                <div 
                                  className="w-full rounded-t-lg overflow-hidden transition-all duration-300 group cursor-pointer"
                                  style={{ height: `${Math.max(totalHeight, 2)}%`, minHeight: dayStats.total > 0 ? '6px' : '0' }}
                                >
                                  {ROWS.map(row => {
                                    const rowHeight = dayStats.total > 0 ? (dayStats.byRow[row] / dayStats.total) * 100 : 0;
                                    return (
                                      <div
                                        key={row}
                                        className="transition-all duration-200 hover:opacity-80"
                                        style={{ 
                                          height: `${rowHeight}%`, 
                                          backgroundColor: ROW_CONFIG[row].color,
                                          minHeight: rowHeight > 0 ? '2px' : '0'
                                        }}
                                        title={`${row}: ${dayStats.byRow[row]}`}
                                      />
                                    );
                                  })}
                                </div>
                                {/* Tooltip on hover */}
                                <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 rounded-lg border p-2 text-xs opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 ${
                                  darkMode ? 'bg-[#1a1a25] border-white/10 text-[#e6e6f0]' : 'bg-white border-gray-300 text-gray-900 shadow-lg'
                                }`}>
                                  <div className={`font-bold mb-1 ${darkMode ? 'text-[#8b5cf6]' : 'text-purple-600'}`}>{date}</div>
                                  {ROWS.map(row => (
                                    <div key={row} className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: ROW_CONFIG[row].color }} />
                                      <span>{row}: <b>{dayStats.byRow[row]}</b></span>
                                    </div>
                                  ))}
                                  <div className={`mt-1 pt-1 border-t font-bold ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>Итого: {dayStats.total}</div>
                                </div>
                              </div>
                              {/* Date label */}
                              <span className={`text-[10px] whitespace-nowrap ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>
                                {date.slice(0, 5)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {/* Legend */}
                      <div className="mt-4 flex flex-wrap gap-4 justify-center">
                        {ROWS.map(row => (
                          <div key={row} className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: ROW_CONFIG[row].color }}
                            />
                            <span className={`text-xs ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>{row}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Table */}
                    <div className={`overflow-hidden rounded-xl border ${darkMode ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className={darkMode ? 'bg-white/[0.02]' : 'bg-gray-50'}>
                            <tr>
                              <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>Дата</th>
                              <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>Вх</th>
                              <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>Дп</th>
                              <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>Инфо</th>
                              <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>Кц</th>
                              <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>Итого</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${darkMode ? 'divide-white/[0.06]' : 'divide-gray-200'}`}>
                            {dates.map(date => (
                              <tr key={date} className={darkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}>
                                <td className={`px-4 py-3 text-sm font-medium ${darkMode ? 'text-[#e6e6f0]' : 'text-gray-900'}`}>{date}</td>
                                <td className="px-4 py-3 text-center text-sm" style={{ color: ROW_CONFIG['Вх'].color }}>{stats[date].byRow['Вх']}</td>
                                <td className="px-4 py-3 text-center text-sm" style={{ color: ROW_CONFIG['Дп'].color }}>{stats[date].byRow['Дп']}</td>
                                <td className="px-4 py-3 text-center text-sm" style={{ color: ROW_CONFIG['Инфо'].color }}>{stats[date].byRow['Инфо']}</td>
                                <td className="px-4 py-3 text-center text-sm" style={{ color: ROW_CONFIG['Кц'].color }}>{stats[date].byRow['Кц']}</td>
                                <td className={`px-4 py-3 text-right text-sm font-bold ${darkMode ? 'text-[#8b5cf6]' : 'text-purple-600'}`}>{stats[date].total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Archive Tab */}
        {activeTab === 'archive' && (
          <div className="space-y-4">
            <div className={`rounded-2xl border p-6 ${
              darkMode ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-200 bg-white'
            }`}>
              <div className="mb-6 flex items-center justify-between">
                <h2 className={`text-2xl font-bold ${darkMode ? 'text-[#e6e6f0]' : 'text-gray-900'}`}>
                  📁 Архив данных
                </h2>
                <button
                  onClick={clearAllArchive}
                  className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Очистить весь архив
                </button>
              </div>
              
              {archiveData.length === 0 ? (
                <div className={`py-12 text-center ${darkMode ? 'text-[#6b7280]' : 'text-gray-500'}`}>
                  <Archive className="mx-auto mb-4 h-16 w-16 opacity-50" />
                  <p>Архив пуст</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {archiveData.map((item, idx) => (
                    <div
                      key={`${item.date}_${item.day}_${idx}`}
                      className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
                        darkMode 
                          ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]' 
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`rounded-lg px-3 py-1 text-xs font-medium ${
                          item.day === '1 день' 
                            ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-400 border border-orange-500/30' 
                            : 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {item.day}
                        </div>
                        <span className={`font-medium ${darkMode ? 'text-[#e6e6f0]' : 'text-gray-900'}`}>{item.date}</span>
                        <div className="flex items-center gap-3">
                          {ROWS.map(row => (
                            <span key={row} className="text-sm" style={{ color: ROW_CONFIG[row].color }}>
                              {row}: {item.totals[row]}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-lg font-bold ${darkMode ? 'text-[#8b5cf6]' : 'text-purple-600'}`}>
                          {item.grandTotal}
                        </span>
                        <button
                          onClick={() => deleteArchiveEntry(item.date, item.day)}
                          className="rounded-lg p-2 text-red-400 transition-all hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Custom Styles */}
      <style>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-toast-in {
          animation: toast-in 0.3s ease-out;
        }
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4);
          }
          50% {
            box-shadow: 0 0 20px 5px rgba(139, 92, 246, 0.2);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
