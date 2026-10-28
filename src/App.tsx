import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Shield, CheckCircle2, ListTodo, Plus, Trash2, Globe, CircleDashed, X, Search, AlertOctagon, Lock, Unlock, Clock, Calendar, Target, Info, Settings, BarChart2 } from 'lucide-react';
import { useChromeStorage } from './hooks/useChromeStorage';
import { cn } from './lib/utils';
import { MotionConfig, motion, AnimatePresence } from 'motion/react';

type Tab = 'timer' | 'tasks' | 'blocker' | 'settings' | 'stats';

type Task = {
  id: string;
  title: string;
  completed: boolean;
  durationMinutes: number;
  scheduledTime?: string;
  isLocked: boolean;
  lockLevel?: 'none' | 'strict' | 'commitment';
};

type LegacyToastTone = 'success' | 'error' | 'info';
type LegacyToast = { id: number; message: string; tone: LegacyToastTone };
type LegacyToastAction = (message: string, tone?: LegacyToastTone) => void;

const LegacyToastContext = React.createContext<LegacyToastAction | null>(null);

function LegacyToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<LegacyToast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismissToast = (id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((items) => items.filter((item) => item.id !== id));
  };

  const showToast = React.useCallback<LegacyToastAction>((message, tone = 'info') => {
    const id = ++nextId.current;
    setToasts((items) => [...items, { id, message, tone }]);
    timers.current.set(id, window.setTimeout(() => dismissToast(id), 4500));
  }, []);

  useEffect(
    () => () => timers.current.forEach((timer) => window.clearTimeout(timer)),
    [],
  );

  return (
    <LegacyToastContext.Provider value={showToast}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-center gap-2" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl border bg-neutral-900 px-4 py-3 text-xs shadow-xl",
              toast.tone === 'error' ? "border-red-500/60 text-red-100" :
                toast.tone === 'success' ? "border-emerald-500/60 text-emerald-100" :
                  "border-blue-500/60 text-blue-100"
            )}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              className="shrink-0 rounded px-2 py-1 font-semibold text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </LegacyToastContext.Provider>
  );
}

function useLegacyToast(): LegacyToastAction {
  const showToast = React.useContext(LegacyToastContext);
  if (!showToast) throw new Error('useLegacyToast must be used inside LegacyToastProvider.');
  return showToast;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <LegacyToastProvider>
        <AppContent />
      </LegacyToastProvider>
    </MotionConfig>
  );
}

function AppContent() {
  const showToast = useLegacyToast();
  const [activeTab, setActiveTab] = useState<Tab>('timer');
  const [isBlockedPage, setIsBlockedPage] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [blockedUrl, setBlockedUrl] = useState('');

  const [isActive] = useChromeStorage('timer_isActive', false);
  const [lockLevel] = useChromeStorage<'none'|'strict'|'commitment'>('timer_lockLevel', 'none');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('blocked') === 'true') {
      setIsBlockedPage(true);
      setBlockedUrl(params.get('url') || '');
    } else if (params.get('onboarding') === 'true') {
      setIsOnboarding(true);
    }
  }, []);

  // Force into timer tab if locked session is active
  useEffect(() => {
    if (isActive && lockLevel !== 'none') {
      setActiveTab('timer');
    }
  }, [isActive, lockLevel]);

  const isFullScreenLock = isActive && lockLevel !== 'none';

  // Enforce fullscreen if user presses escape
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (isFullScreenLock && !document.fullscreenElement) {
        // User exited fullscreen during a lock, immediately re-request it
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFullScreenLock]);

  const [temptationLog] = useChromeStorage<{domain: string, timestamp: number}[]>('temptationLog', []);
  const todayStart = new Date().setHours(0,0,0,0);
  const todayAttempts = temptationLog.filter(log => log.timestamp >= todayStart).length;

  const closeBlockedTab = () => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.getCurrent) {
      showToast('Close this tab using your browser controls.', 'info');
      return;
    }
    chrome.tabs.getCurrent((tab) => {
      if (typeof tab?.id !== 'number') {
        showToast('This page is not in a closable browser tab.', 'info');
        return;
      }
      chrome.tabs.remove(tab.id, () => {
        if (chrome.runtime.lastError) {
          showToast('The blocked tab could not be closed. Close it from your browser.', 'error');
        }
      });
    });
  };

  if (isBlockedPage) {
    return (
      <div className="w-full min-h-screen sm:w-[400px] sm:h-[600px] sm:min-h-0 mx-auto bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 font-sans sm:shadow-2xl sm:border sm:border-red-900/50 relative overflow-hidden">
        {/* Pulsing aversive background */}
        <motion.div 
          animate={{ opacity: [0.1, 0.3, 0.1] }} 
          transition={{ repeat: Infinity, duration: 2 }} 
          className="absolute inset-0 bg-red-500 pointer-events-none" 
        />
        
        <motion.div 
          initial={{ scale: 0.8, opacity: 0, x: -10 }}
          animate={{ scale: 1, opacity: 1, x: [0, -10, 10, -10, 10, 0] }}
          transition={{ duration: 0.5, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }}
          className="flex flex-col items-center text-center gap-6 relative z-10"
        >
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl shadow-red-500/20 ring-2 ring-red-500/50">
              <img src="/icon.png" alt="FocusGate Blocked" className="w-full h-full object-cover grayscale opacity-90" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center border-2 border-neutral-950">
              <AlertOctagon className="w-4 h-4 text-neutral-950" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-red-500 tracking-tight uppercase">Blocked</h1>
            <p className="text-neutral-300 max-w-[250px] mx-auto text-sm font-medium">
              This page is blocked by your current FocusGate rules.
            </p>
          </div>

          {blockedUrl && (
            <div className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-300 font-mono truncate max-w-full">
              {blockedUrl}
            </div>
          )}

          {todayAttempts > 0 && (
            <div className="text-xs font-semibold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full">
              Attempt {todayAttempts} today
            </div>
          )}

          <button 
            type="button"
            onClick={closeBlockedTab}
            className="px-8 py-4 mt-2 bg-red-500 text-neutral-950 font-black rounded-xl hover:bg-red-400 transition-colors uppercase tracking-wider text-lg"
          >
            Close Tab
          </button>
        </motion.div>
      </div>
    );
  }

  if (isOnboarding) {
    return <OnboardingView onComplete={() => {
      setActiveTab('timer');
      setIsOnboarding(false);
    }} />;
  }

  return (
    <div className={cn(
      "w-full mx-auto bg-neutral-950 text-neutral-100 flex flex-col font-sans relative transition-all duration-500 overflow-hidden",
      isFullScreenLock
        ? "h-screen w-full sm:w-full sm:h-screen sm:border-0 fixed inset-0 z-50"
        : "min-h-screen sm:w-[400px] sm:h-[600px] sm:min-h-0 sm:shadow-2xl sm:border sm:border-neutral-800"
    )}>
      {!isFullScreenLock && (
        <header className="p-4 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="FocusGate Logo" className="w-8 h-8 rounded-xl object-cover shadow-sm" />
            <h1 className="text-lg font-semibold tracking-wide text-neutral-200">FocusGate</h1>
          </div>
        </header>
      )}
      
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          {activeTab === 'timer' && <TimerView key="timer" isFullScreenLock={isFullScreenLock} />}
          {activeTab === 'tasks' && <TasksView key="tasks" onStartTask={() => setActiveTab('timer')} />}
          {activeTab === 'blocker' && <BlockerView key="blocker" />}
          {activeTab === 'stats' && <StatsView key="stats" />}
          {activeTab === 'settings' && <SettingsView key="settings" />}
        </AnimatePresence>
      </main>
      
      {!isFullScreenLock && (
        <nav className="border-t border-neutral-800/80 bg-neutral-950 p-2 sm:p-3 z-10 shrink-0">
          <div className="flex items-center justify-around max-w-sm mx-auto">
            <NavItem active={activeTab === 'timer'} onClick={() => setActiveTab('timer')} icon={<Play />} label="Focus" />
            <NavItem active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<ListTodo />} label="Tasks" />
            <NavItem active={activeTab === 'blocker'} onClick={() => setActiveTab('blocker')} icon={<Shield />} label="Rules" />
            <NavItem active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart2 />} label="Stats" />
            <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Settings" />
          </div>
        </nav>
      )}
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 w-16 h-14 rounded-xl transition-all duration-300",
        active ? "text-emerald-400" : "text-neutral-500 hover:text-neutral-300"
      )}
      aria-current={active ? 'page' : undefined}
    >
      <div className={cn(
        "[&>svg]:w-5 [&>svg]:h-5 transition-transform duration-300",
        active ? "transform scale-110" : ""
      )}>
        {icon}
      </div>
      <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      {active && (
        <motion.div layoutId="nav-indicator" className="absolute bottom-1 w-8 h-0.5 rounded-full bg-emerald-500/50" />
      )}
    </button>
  );
}

function TimerView({ isFullScreenLock }: { isFullScreenLock: boolean; key?: string }) {
  const [timeLeft, setTimeLeft] = useChromeStorage('timer_timeLeft', 25 * 60);
  const [totalTime, setTotalTime] = useChromeStorage('timer_totalTime', 25 * 60);
  const [isActive, setIsActive] = useChromeStorage('timer_isActive', false);
  const [timerMode, setTimerMode] = useChromeStorage<'work'|'break'>('timer_mode', 'work');
  const [lockLevel, setLockLevel] = useChromeStorage<'none'|'strict'|'commitment'>('timer_lockLevel', 'none');
  const [activeTaskId, setActiveTaskId] = useChromeStorage('timer_activeTaskId', '');
  const [tasks, setTasks] = useChromeStorage<Task[]>('tasks', []);
  const [password] = useChromeStorage('app_password_hash', '');
  
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showPasswordUnlock, setShowPasswordUnlock] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [quitInput, setQuitInput] = useState('');

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // If the active task was deleted or marked as completed from another tab, end the session
    if (activeTaskId && isActive) {
      const task = tasks.find(t => t.id === activeTaskId);
      if (!task || task.completed) {
        endSession();
      }
    }
  }, [tasks, activeTaskId, isActive]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      if (timerMode === 'work') {
        setTimerMode('break');
        setTimeLeft(5 * 60);
        setTotalTime(5 * 60);
        if (activeTaskId) {
          setTasks((prev: Task[]) => prev.map((t: Task) => t.id === activeTaskId ? { ...t, completed: true } : t));
          setActiveTaskId('');
        }
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      } else {
        setIsActive(false);
        setTimerMode('work');
        setTimeLeft(25 * 60);
        setTotalTime(25 * 60);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, setTimeLeft, setIsActive, activeTaskId, setTasks, setActiveTaskId, timerMode, setTimerMode, setTotalTime]);

  const startSession = () => {
    setTotalTime(timeLeft);
    setIsActive(true);
    if (lockLevel !== 'none' && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const endSession = () => {
    setIsActive(false);
    setTimerMode('work');
    setActiveTaskId('');
    setTimeLeft(25 * 60);
    setTotalTime(25 * 60);
    setShowQuitConfirm(false);
    setShowPasswordUnlock(false);
    setQuitInput('');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleQuitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quitInput === 'I GIVE UP') {
      endSession();
    }
  };

  const handleEndEarlyClick = () => {
    if (timerMode === 'break') {
      endSession();
      return;
    }
    if (lockLevel === 'commitment') return;
    if (lockLevel === 'strict') {
      if (password) setShowPasswordUnlock(true);
      else setShowQuitConfirm(true);
    } else {
      endSession();
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  const safeTotal = totalTime > 0 ? totalTime : (25 * 60);
  const progress = ((safeTotal - timeLeft) / safeTotal) * 100;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex flex-col items-center justify-center p-6 flex-1 gap-8 relative"
    >
      <div className="relative w-64 h-64 flex items-center justify-center shrink-0">
        <svg className="absolute w-full h-full transform -rotate-90">
          <circle 
            cx="128" cy="128" r="120" 
            className="stroke-neutral-800" 
            strokeWidth="6" 
            fill="transparent" 
          />
          <circle 
            cx="128" cy="128" r="120" 
            className={cn(
              "transition-all duration-1000 ease-linear",
              isActive ? (timerMode === 'break' ? "stroke-blue-400" : (lockLevel !== 'none' ? "stroke-red-500" : "stroke-emerald-400")) : "stroke-neutral-600"
            )} 
            strokeWidth="6" 
            strokeDasharray={2 * Math.PI * 120}
            strokeDashoffset={2 * Math.PI * 120 * (1 - Math.max(0, Math.min(100, progress)) / 100)}
            strokeLinecap="round"
            fill="transparent" 
          />
        </svg>
        <div className="flex flex-col items-center z-10">
          <span className={cn(
            "text-6xl font-extralight tracking-tight font-mono transition-colors",
            isActive ? (timerMode === 'break' ? "text-blue-400" : (lockLevel !== 'none' ? "text-red-400" : "text-emerald-400")) : "text-neutral-100"
          )}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
          <span className="text-sm font-medium text-neutral-500 mt-2 tracking-widest uppercase flex items-center gap-1.5">
            {activeTask ? (
              <span className="text-neutral-300 max-w-[150px] truncate" title={activeTask.title}>{activeTask.title}</span>
            ) : (
              (lockLevel !== 'none' && isActive && timerMode === 'work') ? <><Lock className="w-3.5 h-3.5" /> {lockLevel === 'commitment' ? 'Commitment Mode' : 'Strict Mode'}</> : (timerMode === 'break' ? 'Break Time' : 'Focus Mode')
            )}
          </span>
        </div>
      </div>

      {!isActive && !activeTaskId && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 w-full max-w-[260px]"
        >
          <div className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
            <span className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" /> Duration
            </span>
            <div className="flex items-center gap-2">
              <input 
                type="number"
                min="1"
                max="999"
                value={Math.floor(timeLeft / 60)} 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  const mins = isNaN(val) ? 1 : Math.max(1, val);
                  setTimeLeft(mins * 60);
                  setTotalTime(mins * 60);
                }}
                className="bg-neutral-950 border border-neutral-700 rounded-lg text-sm p-1.5 focus:outline-none focus:border-emerald-500 w-20 text-center"
              />
              <span className="text-xs text-neutral-500">min</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-semibold flex items-center gap-2">
                {lockLevel !== 'none' ? <Lock className="w-4 h-4 text-red-400" /> : <Unlock className="w-4 h-4 text-emerald-400" />} Lock Level
              </span>
              <span className="text-xs text-neutral-400 mt-1 leading-relaxed">
                {lockLevel === 'none' ? 'Standard blocking.' : lockLevel === 'strict' ? 'Ending early needs your password. Fullscreen adds friction; extension removal remains possible.' : 'No stop action is available; the session ends when its timer does.'}
              </span>
            </div>
            <select
              value={lockLevel}
              onChange={e => {
                const val = e.target.value as any;
                if (val === 'strict' && !password) {
                  setShowSetPasswordModal(true);
                  setLockLevel('none');
                } else {
                  setLockLevel(val);
                }
              }}
              className="bg-neutral-950 border border-neutral-700 rounded-lg text-xs p-1 focus:outline-none focus:border-red-500 max-w-[80px]"
            >
              <option value="none">None</option>
              <option value="strict">Strict</option>
              <option value="commitment">Commit</option>
            </select>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col items-center gap-4 w-full px-4 max-w-[260px]">
        {!isActive ? (
          <button 
            onClick={startSession}
            className="w-full bg-emerald-500 text-neutral-950 font-bold py-4 rounded-xl hover:bg-emerald-400 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            Start Session
          </button>
        ) : (
          lockLevel !== 'commitment' && (
            <button 
              onClick={handleEndEarlyClick}
              className="w-full bg-neutral-900 border border-neutral-800 text-neutral-400 font-semibold py-4 rounded-xl hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Square className="w-4 h-4" />
              {timerMode === 'break' ? 'Skip Break' : (lockLevel === 'strict' ? 'End Session Early' : 'Stop Session')}
            </button>
          )
        )}
      </div>

      <AnimatePresence>
        {showSetPasswordModal && (
          <SetPasswordModal 
            onSuccess={() => {
              setShowSetPasswordModal(false);
              setLockLevel('strict');
            }}
            onCancel={() => setShowSetPasswordModal(false)}
          />
        )}
        {showPasswordUnlock && (
          <PasswordModal expectedPassword={password}
            onSuccess={endSession} 
            onCancel={() => setShowPasswordUnlock(false)} 
            title="Unlock Session" 
          />
        )}
        {showQuitConfirm && !showPasswordUnlock && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-neutral-950/95 backdrop-blur-md z-20 flex flex-col items-center justify-center p-6"
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-xs shadow-2xl flex flex-col gap-4">
              <div className="space-y-2 text-center">
                <AlertOctagon className="w-8 h-8 text-red-500 mx-auto" />
                <h3 className="text-lg font-bold text-neutral-100">Are you sure?</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Deep focus is strict. To end your session early, type <strong className="text-red-400">I GIVE UP</strong> below.
                </p>
              </div>
              <form onSubmit={handleQuitSubmit} className="flex flex-col gap-3">
                <input 
                  type="text" 
                  value={quitInput}
                  onChange={(e) => setQuitInput(e.target.value)}
                  placeholder="Type I GIVE UP" 
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-sm text-center font-mono focus:outline-none focus:border-red-500/50 transition-all"
                />
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => { setShowQuitConfirm(false); setQuitInput(''); }}
                    className="flex-1 py-2 text-xs font-semibold text-neutral-400 hover:text-neutral-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={quitInput !== 'I GIVE UP'}
                    className="flex-1 py-2 text-xs font-bold bg-red-500/10 text-red-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500/20 transition-all"
                  >
                    Confirm Quit
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TasksView({ onStartTask }: { onStartTask: () => void; key?: string }) {
  const showToast = useLegacyToast();
  const [tasks, setTasks] = useChromeStorage<Task[]>('tasks', []);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(25);
  const [scheduledTime, setScheduledTime] = useState('');
  const [lockLevel, setLockLevel] = useState<'none'|'strict'|'commitment'>('none');
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);

  // Timer state for launching
  const [isActive, setIsActive] = useChromeStorage('timer_isActive', false);
  const [, setTimeLeft] = useChromeStorage('timer_timeLeft', 25 * 60);
  const [, setTotalTime] = useChromeStorage('timer_totalTime', 25 * 60);
  const [timerLockLevel, setTimerLockLevel] = useChromeStorage<'none'|'strict'|'commitment'>('timer_lockLevel', 'none');
  const [activeTaskId, setActiveTaskId] = useChromeStorage('timer_activeTaskId', '');

  const [password] = useChromeStorage('app_password_hash', '');
  const [verifyAction, setVerifyAction] = useState<{type: 'toggle' | 'delete', id: string} | null>(null);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setTasks([...tasks, { 
      id: Date.now().toString(), 
      title: title.trim(), 
      completed: false,
      durationMinutes: duration,
      scheduledTime: scheduledTime,
      lockLevel: lockLevel,
      isLocked: lockLevel !== 'none' // fallback for older versions
    }]);
    setTitle('');
    setDuration(25);
    setScheduledTime('');
    setLockLevel('none');
    setShowForm(false);
  };

  const startTask = (task: Task) => {
    if (isActive) {
      showToast('End the current focus session before starting another task.', 'error');
      return;
    }
    const totalSeconds = task.durationMinutes * 60;
    setTimeLeft(totalSeconds);
    setTotalTime(totalSeconds);
    let ll = (task as any).lockLevel || (task.isLocked ? 'strict' : 'none');
    if (ll === 'strict' && !password) {
      showToast('This task needs a password for Strict mode. It will start without a lock; set a password in Settings to use Strict.', 'info');
      ll = 'none';
    }
    setTimerLockLevel(ll);
    setActiveTaskId(task.id);
    setIsActive(true);
    
    if (ll !== 'none' && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    onStartTask();
  };

  const executeTaskAction = (action: {type: 'toggle' | 'delete', id: string}) => {
    if (action.type === 'toggle') {
      setTasks(tasks.map(t => t.id === action.id ? { ...t, completed: !t.completed } : t));
    } else {
      setTasks(tasks.filter(t => t.id !== action.id));
    }
    setVerifyAction(null);
  };

  const toggleTask = (id: string) => {
    if (isActive && activeTaskId === id) {
      if (timerLockLevel === 'commitment') {
        showToast('Finish the active commitment session before completing this task.', 'info');
        return;
      }
      if (timerLockLevel === 'strict' && password) {
        setVerifyAction({ type: 'toggle', id });
        return;
      }
    }
    executeTaskAction({ type: 'toggle', id });
  };

  const deleteTask = (id: string) => {
    if (isActive && activeTaskId === id) {
      if (timerLockLevel === 'commitment') {
        showToast('Finish the active commitment session before deleting this task.', 'info');
        return;
      }
      if (timerLockLevel === 'strict' && password) {
        setVerifyAction({ type: 'delete', id });
        return;
      }
    }
    executeTaskAction({ type: 'delete', id });
  };

  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex flex-col flex-1 p-4 gap-4"
    >
      {showForm ? (
        <form onSubmit={addTask} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4 shrink-0 shadow-lg">
            <input
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you working on?" 
              aria-label="Task name"
              aria-describedby={!title.trim() ? "task-title-help" : undefined}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
            autoFocus
          />
          {!title.trim() && <p id="task-title-help" className="text-xs text-neutral-300">Enter a task name to enable Save Task.</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-300 font-bold uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3"/> Duration (min)</label>
              <input 
                type="number"
                min="1"
                max="999"
                value={duration} 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setDuration(isNaN(val) ? 1 : Math.max(1, val));
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-300 font-bold uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3 h-3"/> Time (opt)</label>
              <input 
                type="time" 
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]"
              />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-800">
            <div className="flex flex-col">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                {lockLevel !== 'none' ? <Lock className="w-4 h-4 text-red-400"/> : <Unlock className="w-4 h-4 text-emerald-400"/>}
                Lock Level
              </span>
              <span className="text-xs text-neutral-300 mt-1 leading-relaxed">
                {lockLevel === 'none' ? 'Standard blocking.' : lockLevel === 'strict' ? 'Ending early needs your password. Fullscreen adds friction; extension removal remains possible.' : 'No stop action is available; the session ends when its timer does.'}
              </span>
            </div>
            <select
              value={lockLevel}
              onChange={e => {
                const val = e.target.value as any;
                if (val === 'strict' && !password) {
                  setShowSetPasswordModal(true);
                  setLockLevel('none');
                } else {
                  setLockLevel(val);
                }
              }}
              className="bg-neutral-900 border border-neutral-700 rounded-lg text-xs p-1 focus:outline-none focus:border-red-500 max-w-[80px]"
            >
              <option value="none">None</option>
              <option value="strict">Strict</option>
              <option value="commitment">Commit</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 text-sm font-semibold text-neutral-400 hover:text-neutral-200 transition-colors">Cancel</button>
            <button type="submit" disabled={!title.trim()} className="flex-1 py-2 text-sm font-semibold bg-emerald-500 text-neutral-950 rounded-lg hover:bg-emerald-400 disabled:opacity-50 transition-all">Save Task</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="w-full py-4 border border-dashed border-neutral-700 rounded-xl text-neutral-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all flex items-center justify-center gap-2 font-semibold shrink-0">
          <Plus className="w-5 h-5" />
          Create New Task
        </button>
      )}

      <div className="flex-1 overflow-y-auto space-y-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-neutral-500 gap-3">
            <Target className="w-10 h-10 stroke-[1.5]" />
            <p className="text-sm">No tasks for today. Plan your focus session.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTasks.map(task => (
              <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onStart={() => startTask(task)} isDeleteLocked={isActive && activeTaskId === task.id && timerLockLevel === 'commitment'} />
            ))}
            
            {completedTasks.length > 0 && (
              <div className="pt-4 border-t border-neutral-800/50 space-y-3">
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-1">Completed</p>
                {completedTasks.map(task => (
                  <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onStart={() => startTask(task)} isDeleteLocked={isActive && activeTaskId === task.id && timerLockLevel === 'commitment'} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <AnimatePresence>
        {showSetPasswordModal && (
          <SetPasswordModal 
            onSuccess={() => {
              setShowSetPasswordModal(false);
              setLockLevel('strict');
            }}
            onCancel={() => setShowSetPasswordModal(false)}
          />
        )}
        {verifyAction && (
          <PasswordModal
            expectedPassword={password}
            onSuccess={() => executeTaskAction(verifyAction)}
            onCancel={() => setVerifyAction(null)}
            title={verifyAction.type === 'delete' ? 'Delete Active Task' : 'Complete Active Task'}
            friction={true}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TaskItem({ task, onToggle, onDelete, onStart, isDeleteLocked }: { task: Task; onToggle: (id: string) => void; onDelete: (id: string) => void; onStart: () => void; isDeleteLocked: boolean; key?: string }) {
  const ll = (task as any).lockLevel || (task.isLocked ? 'strict' : 'none');
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group flex items-center justify-between p-3 rounded-xl border transition-all",
        task.completed 
          ? "bg-neutral-950/50 border-transparent" 
          : "bg-neutral-900 border-neutral-800/80 hover:border-neutral-700"
      )}
    >
      <div className="flex items-center gap-3 overflow-hidden flex-1">
        <button 
          type="button"
          onClick={() => onToggle(task.id)}
          aria-label={task.completed ? `Reopen ${task.title}` : `Mark ${task.title} complete`}
          aria-pressed={task.completed}
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all",
            task.completed 
              ? "bg-emerald-500 border-emerald-500 text-neutral-950" 
              : "border-neutral-600 hover:border-emerald-500/50 bg-transparent text-transparent"
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
        </button>
        <div className="flex flex-col overflow-hidden">
          <span className={cn("text-sm truncate font-semibold transition-all", task.completed ? "text-neutral-400 line-through" : "text-neutral-200")}>
            {task.title}
          </span>
          <div className="flex items-center gap-2 text-xs text-neutral-400 uppercase font-bold tracking-wider mt-0.5">
            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3"/> {task.durationMinutes}m</span>
            {task.scheduledTime && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3"/> {task.scheduledTime}</span>}
            {ll !== 'none' ? <Lock className="w-3 h-3 text-red-400" /> : <Unlock className="w-3 h-3 text-emerald-400" />}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0">
        {!task.completed && (
          <button type="button" onClick={onStart} className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors" title="Start Focus Session" aria-label={`Start ${task.title}`}>
            <Play className="w-4 h-4 fill-current" />
          </button>
        )}
        {isDeleteLocked ? (
          <button type="button" disabled className="p-2 text-neutral-500 rounded-lg cursor-not-allowed" title="Finish the active commitment session before deleting this task." aria-label={`Delete ${task.title} is unavailable until its commitment session ends`}>
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={() => onDelete(task.id)} className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Task" aria-label={`Delete ${task.title}`}>
            <Trash2 className="w-4 h-4" />
                    </button>
        )}
      </div>
    </motion.div>
  );
}

function BlockerView({ key }: { key?: string }) {
  const showToast = useLegacyToast();
  const [activeTab, setActiveTab] = useState<'sites' | 'whitelist' | 'keywords' | 'schedules'>('sites');

  const [sites, setSites] = useChromeStorage<string[]>('blockedSites', []);
  const [newSite, setNewSite] = useState('');

  const [whitelistedUrls, setWhitelistedUrls] = useChromeStorage<string[]>('whitelistedUrls', []);
  const [newWhitelistUrl, setNewWhitelistUrl] = useState('');

  const [keywords, setKeywords] = useChromeStorage<string[]>('blockedKeywords', []);
  const [newKeyword, setNewKeyword] = useState('');

  const [schedules, setSchedules] = useChromeStorage<any[]>('schedules', []);
  const [password] = useChromeStorage('app_password_hash', '');
  const [standaloneUntil] = useChromeStorage('standaloneUntil', 0);
  const [standaloneMode] = useChromeStorage('standaloneMode', false);
  const [isSessionActive] = useChromeStorage('timer_isActive', false);
  const isStandaloneActive = (standaloneMode && standaloneUntil === 0) || standaloneUntil > Date.now();
  const [verifyAction, setVerifyAction] = useState<{ type: string; payload?: any } | null>(null);

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [newScheduleStart, setNewScheduleStart] = useState('09:00');
  const [newScheduleEnd, setNewScheduleEnd] = useState('17:00');
  const [newScheduleDays, setNewScheduleDays] = useState<number[]>([1,2,3,4,5]);

  const requestAction = (type: string, payload?: any) => {
    let lessensRestrictions = false;
    
    if (['remove_site', 'remove_keyword', 'delete_schedule', 'add_whitelist'].includes(type)) {
      lessensRestrictions = true;
    } else if (type === 'toggle_schedule') {
      const schedule = schedules.find(s => s.id === payload.id);
      if (schedule && schedule.isActive) lessensRestrictions = true;
    }

    if (isStandaloneActive && lessensRestrictions) {
      showToast('Rule removals are paused while Standalone Block is active.', 'info');
      return;
    }
    
    if (password && lessensRestrictions) {
      setVerifyAction({ type, payload });
    } else {
      executeAction({ type, payload });
    }
  };

  const executeAction = (action: { type: string; payload?: any }) => {
    if (action.type === 'delete_schedule') {
      setSchedules(schedules.filter(s => s.id !== action.payload.id));
    } else if (action.type === 'add_schedule') {
      setSchedules([...schedules, action.payload.schedule]);
    } else if (action.type === 'toggle_schedule') {
      setSchedules(schedules.map(s => s.id === action.payload.id ? { ...s, isActive: !s.isActive } : s));
    } else if (action.type === 'add_site') {
      const site = action.payload.site;
      const cleanSite = site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      if (cleanSite && !sites.includes(cleanSite)) {
        setSites([...sites, cleanSite]);
      }
      setNewSite('');
    } else if (action.type === 'remove_site') {
      setSites(sites.filter(s => s !== action.payload.site));
    } else if (action.type === 'add_whitelist') {
      const wUrl = action.payload.wUrl;
      if (wUrl && !whitelistedUrls.includes(wUrl)) {
        setWhitelistedUrls([...whitelistedUrls, wUrl]);
      }
      setNewWhitelistUrl('');
    } else if (action.type === 'remove_whitelist') {
      setWhitelistedUrls(whitelistedUrls.filter(u => u !== action.payload.wUrl));
    } else if (action.type === 'add_keyword') {
      const addedKeywords = Array.isArray(action.payload.kws)
        ? action.payload.kws
        : action.payload.kw
          ? [action.payload.kw]
          : [];
      if (addedKeywords.length) {
        setKeywords([...new Set([...keywords, ...addedKeywords])]);
      }
      setNewKeyword('');
    } else if (action.type === 'remove_keyword') {
      setKeywords(keywords.filter(k => k !== action.payload.kw));
    }
    setVerifyAction(null);
  };

  const addSite = (e: React.FormEvent) => {
    e.preventDefault();
    const site = newSite.trim().toLowerCase();
    if (!site) return;
    requestAction('add_site', { site });
  };

  const addKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const kws = [...new Set(
      newKeyword
        .split(/[,\n]+/)
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean),
    )];
    if (!kws.length) {
      showToast('Enter at least one keyword.', 'error');
      return;
    }
    requestAction('add_keyword', { kws });
  };

  const addWhitelist = (e: React.FormEvent) => {
    e.preventDefault();
    const wUrl = newWhitelistUrl.trim();
    if (!wUrl) return;
    requestAction('add_whitelist', { wUrl });
  };

  const addSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (newScheduleDays.length === 0) return;

    requestAction('add_schedule', {
      schedule: {
        id: Date.now().toString(),
        isActive: true,
        startTime: newScheduleStart,
        endTime: newScheduleEnd,
        days: newScheduleDays,
        sites,
        keywords
      }
    });
    setShowScheduleForm(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex flex-col flex-1 p-4 gap-4"
    >
      <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-1 shrink-0">
        <button
          onClick={() => setActiveTab('sites')}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
            activeTab === 'sites' ? "bg-neutral-800 text-emerald-400" : "text-neutral-500 hover:text-neutral-300"
          )}
        >
          Websites
        </button>
        <button
          onClick={() => setActiveTab('whitelist')}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
            activeTab === 'whitelist' ? "bg-neutral-800 text-emerald-400" : "text-neutral-500 hover:text-neutral-300"
          )}
        >
          Exceptions
        </button>
        <button
          onClick={() => setActiveTab('keywords')}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
            activeTab === 'keywords' ? "bg-neutral-800 text-emerald-400" : "text-neutral-500 hover:text-neutral-300"
          )}
        >
          Filters
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
            activeTab === 'schedules' ? "bg-neutral-800 text-emerald-400" : "text-neutral-500 hover:text-neutral-300"
          )}
        >
          Schedules
        </button>
      </div>

          {isStandaloneActive && (
        <p role="status" className="text-xs text-neutral-300">
          Actions that reduce blocking are paused while Standalone Block is active.
        </p>
      )}

      {activeTab === 'sites' ? (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3 shrink-0">
            <Globe className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-emerald-400">Blocked Sites</h3>
              <p className="text-xs text-emerald-500/80 leading-relaxed">
                Sites listed here are blocked when your FocusGate rules are active. Embedded content on other sites may remain available.
              </p>
            </div>
          </div>

          <form onSubmit={addSite} className="flex gap-2 shrink-0">
            <input 
              type="text" 
              value={newSite}
              onChange={(e) => setNewSite(e.target.value)}
              placeholder="e.g. twitter.com" 
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-neutral-400"
            />
            <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 px-4 py-2 rounded-xl transition-all shadow-sm text-sm font-semibold">
              Add
            </button>
          </form>

          <div className="flex-1 overflow-y-auto bg-neutral-900/50 rounded-xl border border-neutral-800 p-2">
            {sites.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-neutral-500 gap-2">
                <Globe className="w-8 h-8 stroke-[1.5]" />
                <p className="text-xs">No sites blocked yet.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sites.map(site => (
                  <div key={site} className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-800 transition-all group">
                    <span className="text-sm text-neutral-300 truncate font-mono">{site}</span>
                    {!isStandaloneActive && (<button 
                      type="button"
                      onClick={() => requestAction('remove_site', { site })}
                      aria-label={`Remove blocked site ${site}`}
                      className="text-neutral-400 hover:text-red-400 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'whitelist' ? (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-start gap-3 shrink-0">
            <Unlock className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-purple-400">Exceptions</h3>
              <p className="text-xs text-purple-500/80 leading-relaxed">
                URLs listed here are excluded from matching site blocks. For example, add a specific video URL to allow it while blocking its site.
              </p>
            </div>
          </div>

          <form onSubmit={addWhitelist} className="flex gap-2 shrink-0">
            <input 
              type="text" 
              value={newWhitelistUrl}
              onChange={(e) => setNewWhitelistUrl(e.target.value)}
              placeholder="e.g. youtube.com/watch?v=123" 
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-neutral-400"
            />
            <button type="submit" className="bg-purple-500 hover:bg-purple-400 text-neutral-950 px-4 py-2 rounded-xl transition-all shadow-sm text-sm font-semibold">
              Add
            </button>
          </form>

          <div className="flex-1 overflow-y-auto bg-neutral-900/50 rounded-xl border border-neutral-800 p-2">
            {whitelistedUrls.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-neutral-500 gap-2">
                <Unlock className="w-8 h-8 stroke-[1.5]" />
                <p className="text-xs">No exceptions added yet.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {whitelistedUrls.map(wUrl => (
                  <div key={wUrl} className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-800 transition-all group">
                    <span className="text-sm text-neutral-300 truncate font-mono">{wUrl}</span>
                    {!isStandaloneActive && (<button 
                      type="button"
                      onClick={() => requestAction('remove_whitelist', { wUrl })}
                      aria-label={`Remove exception ${wUrl}`}
                      className="text-neutral-400 hover:text-red-400 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'keywords' ? (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3 shrink-0">
            <Search className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-blue-400">Keyword Filters</h3>
              <p className="text-xs text-blue-500/80 leading-relaxed">
                Matching keywords are filtered on supported searches and pages while FocusGate blocking is active.
              </p>
            </div>
          </div>

          <form onSubmit={addKeyword} className="flex gap-2 shrink-0">
            <input 
              type="text" 
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g. funny shorts, #gaming" 
              aria-label="Keywords to filter"
              aria-describedby="keyword-entry-help"
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-neutral-400"
            />
            <button type="submit" className="bg-blue-500 hover:bg-blue-400 text-neutral-950 px-4 py-2 rounded-xl transition-all shadow-sm text-sm font-semibold">
              Add
            </button>
          </form>
          <p id="keyword-entry-help" className="text-xs text-neutral-300">
            Separate multiple keywords with commas or new lines.
          </p>

          <div className="flex-1 overflow-y-auto bg-neutral-900/50 rounded-xl border border-neutral-800 p-2 flex flex-wrap gap-2 content-start">
            {keywords.length === 0 ? (
              <div className="w-full flex flex-col items-center justify-center h-32 text-neutral-500 gap-2">
                <Search className="w-8 h-8 stroke-[1.5]" />
                <p className="text-xs">No keywords blocked yet.</p>
              </div>
            ) : (
              keywords.map(kw => (
                <div key={kw} className="inline-flex items-center gap-1.5 bg-neutral-800 border border-neutral-700 px-3 py-1.5 rounded-full group">
                  <span className="text-xs text-neutral-300">{kw}</span>
                  {!isStandaloneActive && (<button 
                      type="button"
                      onClick={() => requestAction('remove_keyword', { kw })}
                      aria-label={`Remove keyword ${kw}`}
                    className="text-neutral-300 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>)}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-start gap-3 shrink-0">
            <Calendar className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-purple-400">Scheduled Blocks</h3>
              <p className="text-xs text-purple-500/80 leading-relaxed">
                Each schedule uses the sites and keywords saved with it during its active days and hours.
              </p>
            </div>
          </div>
          
          {!showScheduleForm ? (
            <button 
              onClick={() => setShowScheduleForm(true)}
              className="w-full py-4 border border-dashed border-neutral-700 rounded-xl text-neutral-400 hover:text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-2 font-semibold shrink-0"
            >
              <Plus className="w-5 h-5" />
              Add Custom Schedule
            </button>
          ) : (
            <form onSubmit={addSchedule} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">Start Time</label>
                  <input type="time" value={newScheduleStart} onChange={e => setNewScheduleStart(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1 text-sm focus:border-purple-500 outline-none" />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">End Time</label>
                  <input type="time" value={newScheduleEnd} onChange={e => setNewScheduleEnd(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1 text-sm focus:border-purple-500 outline-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">Days of Week</label>
                <div className="flex gap-1 justify-between">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <button type="button" key={idx} aria-pressed={newScheduleDays.includes(idx)} aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][idx]} onClick={() => setNewScheduleDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])} className={cn("w-8 h-8 rounded-md text-xs font-semibold flex items-center justify-center transition-colors", newScheduleDays.includes(idx) ? "bg-purple-500 text-neutral-950" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700")}>
                      {day}
                    </button>
                  ))}
                </div>
                {newScheduleDays.length === 0 && <p id="schedule-days-help" className="text-xs text-neutral-300">Choose at least one day to save the schedule.</p>}
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setShowScheduleForm(false)} className="flex-1 py-2 text-sm font-semibold text-neutral-400 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={newScheduleDays.length === 0} className="flex-1 py-2 text-sm font-semibold text-neutral-950 bg-purple-500 rounded-lg hover:bg-purple-400 transition-colors disabled:opacity-50">
                  Save Schedule
                </button>
              </div>
            </form>
          )}
          
          <div className="flex-1 overflow-y-auto space-y-3">
            {schedules.map(schedule => (
              <div key={schedule.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span className="font-semibold text-sm">
                        {schedule.startTime} - {schedule.endTime}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-300 font-medium pl-6">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].filter((_, i) => schedule.days.includes(i)).join(' ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      disabled={isStandaloneActive && schedule.isActive}
                      onClick={() => requestAction('toggle_schedule', { id: schedule.id })}
                      className={cn(
                        "w-10 h-5 rounded-full transition-colors relative",
                        schedule.isActive ? "bg-purple-500" : "bg-neutral-800"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                        schedule.isActive ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </button>
                    {!isStandaloneActive && (<button onClick={() => requestAction('delete_schedule', { id: schedule.id })} className="text-neutral-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>)}
                  </div>
                </div>
                <div className="text-xs text-neutral-300 font-medium">
                  Applies the sites and keywords saved with this schedule.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <AnimatePresence>
        {verifyAction && (
          <PasswordModal expectedPassword={password} 
            onSuccess={() => executeAction(verifyAction)} 
            onCancel={() => setVerifyAction(null)} 
            friction={verifyAction === 'remove_password' && (isStandaloneActive || isSessionActive)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}


function HowToUse() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-neutral-100">How to Use FocusGate</h3>
        </div>
        <div className={cn("text-neutral-500 transition-transform duration-300", isOpen && "rotate-180")}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 text-xs text-neutral-400 leading-relaxed space-y-4 border-t border-neutral-800/50 mt-2 pt-4">
              <div>
                <h4 className="text-emerald-400 font-semibold mb-1 text-sm">1. Focus Sessions & Tasks</h4>
                <p>Start a timed focus session from the <strong>Focus</strong> tab. Add goals in <strong>Tasks</strong> and link a task to a session to keep it visible while you work.</p>
              </div>
              <div>
                <h4 className="text-emerald-400 font-semibold mb-1 text-sm">2. Rules (Website Blocking)</h4>
                <p>Add sites, URL exceptions, and keywords in <strong>Rules</strong>. Matching entries are blocked according to your active schedules, focus sessions, or standalone block.</p>
              </div>
              <div>
                <h4 className="text-emerald-400 font-semibold mb-1 text-sm">3. Security Password</h4>
                <p>Set a password from 20 to 28 characters in <strong>Settings</strong>. FocusGate asks for it before selected rule changes or ending a Strict session early. Store it safely; there is no reset option.</p>
              </div>
              <div>
                <h4 className="text-emerald-400 font-semibold mb-1 text-sm">4. Standalone Block</h4>
                <p>Use <strong>Standalone Block</strong> to apply selected restrictions without a focus timer. Choose a duration up to 1000 hours or no limit; restrictions stay active until the block ends.</p>
              </div>
              <div>
                <h4 className="text-emerald-400 font-semibold mb-1 text-sm">5. Daily Allowances</h4>
                <p>Set daily time or cooldown limits for a site. When a limit is reached, FocusGate blocks that site until its daily reset.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsView({ key }: { key?: string }) {
  const showToast = useLegacyToast();
  const [password, setPassword] = useChromeStorage('app_password_hash', '');
  const [standaloneUntil, setStandaloneUntil] = useChromeStorage('standaloneUntil', 0);
  const [standaloneMode, setStandaloneMode] = useChromeStorage('standaloneMode', false);
  const [isSessionActive] = useChromeStorage('timer_isActive', false);
  const isStandaloneActive = (standaloneMode && standaloneUntil === 0) || standaloneUntil > Date.now();
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordAcknowledged, setPasswordAcknowledged] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  const [standaloneDurationHours, setStandaloneDurationHours] = useState('1');
  const [standaloneUnlimited, setStandaloneUnlimited] = useState(false);
  const [standaloneError, setStandaloneError] = useState('');

  const [allowances, setAllowances] = useChromeStorage<Record<string, any>>('dailyAllowances', {});
  const [newAllowanceType, setNewAllowanceType] = useState('time');
  const [newAllowanceSite, setNewAllowanceSite] = useState('');
  const [newAllowanceLimit, setNewAllowanceLimit] = useState(60);

  // Password Verification State
  const [verifyAction, setVerifyAction] = useState<'remove_password' | {type: 'remove_allowance', site: string} | {type: 'add_allowance', site: string, aType: string, limit: number} | null>(null);

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length >= 20 && newPassword.length <= 28) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(newPassword));
      const hashed = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      setPassword(hashed);
      setNewPassword('');
      setPasswordAcknowledged(false);
      setPasswordError('');
      setShowPasswordSetup(false);
    }
  };

  const handleAction = (action: 'remove_password' | {type: 'remove_allowance', site: string} | {type: 'add_allowance', site: string, aType: string, limit: number}) => {
    let lessensRestrictions = false;
    if (action === 'remove_password' || (typeof action === 'object' && action.type === 'add_allowance')) {
      lessensRestrictions = true;
    }

    if (action === 'remove_password' && (isSessionActive || isStandaloneActive)) {
      showToast('Password removal is disabled while a focus session or standalone block is active.', 'error');
      return;
    }

    if (isStandaloneActive && lessensRestrictions && action !== 'remove_password') return; 

    if (password && lessensRestrictions) {
      setVerifyAction(action);
    } else {
      executeAction(action);
    }
  };

  const executeAction = (action: 'remove_password' | {type: 'remove_allowance', site: string} | {type: 'add_allowance', site: string, aType: string, limit: number}) => {
    if (action === 'remove_password') {
      setPassword('');
    } else if (action && typeof action === 'object') {
      if (action.type === 'remove_allowance') {
        const newAllowances = { ...allowances };
        delete newAllowances[action.site];
        setAllowances(newAllowances);
      } else if (action.type === 'add_allowance') {
        setAllowances({ ...allowances, [action.site]: { type: action.aType, limit: action.limit } });
        setNewAllowanceSite('');
      }
    }
    setVerifyAction(null);
  };

  const startStandalone = () => {
    if (isStandaloneActive) return;

    if (standaloneUnlimited) {
      setStandaloneMode(true);
      setStandaloneUntil(0);
      return;
    }

    const hours = Number(standaloneDurationHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 1000) {
      setStandaloneError('Enter a duration greater than 0 and no more than 1000 hours.');
      return;
    }

    setStandaloneError('');
    setStandaloneMode(false);
    setStandaloneUntil(Date.now() + hours * 60 * 60 * 1000);
  };

  const addAllowance = (e: React.FormEvent) => {
    e.preventDefault();
    const site = newAllowanceSite.trim().toLowerCase();
    if (!site) return;
    
    const cleanSite = site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    
    if (cleanSite) {
      handleAction({ type: 'add_allowance', site: cleanSite, aType: newAllowanceType, limit: newAllowanceLimit });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex flex-col flex-1 p-4 gap-4 overflow-y-auto"
    >
      <div className="flex flex-col gap-4">

        <HowToUse />

        
        {/* Password Security */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-neutral-100">Security Password</h3>
            </div>
            {password ? (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">Enabled</span>
            ) : (
              <span className="text-xs font-bold text-neutral-500 bg-neutral-800 px-2 py-1 rounded-md">Disabled</span>
            )}
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            A password confirms selected rule changes, ending a Strict session early, or disabling Standalone Block.
          </p>
          
          {password ? (
            <>
              <button
                type="button"
                onClick={() => handleAction('remove_password')}
                disabled={isSessionActive || isStandaloneActive}
                aria-describedby={isSessionActive || isStandaloneActive ? "remove-password-help" : undefined}
                className={cn("mt-2 py-2 text-sm font-semibold text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50")}
              >
                Remove Password
              </button>
              {(isSessionActive || isStandaloneActive) && (
                <p id="remove-password-help" className="text-xs text-neutral-300">
                  Password removal is disabled while a focus session or standalone block is active.
                </p>
              )}
            </>
          ) : (
            showPasswordSetup ? (
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newPassword}
                    onChange={e => {
                      setNewPassword(e.target.value);
                      setPasswordError('');
                    }}
                    placeholder="Enter 20-28 char password"
                    maxLength={28}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <button 
                    type="button" 
                    onClick={() => {
                      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
                      let pass = '';
                      for(let i = 0; i < 24; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
                      setNewPassword(pass);
                    }}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Generate
                  </button>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="settings-password-ack"
                    className="mt-1"
                    checked={passwordAcknowledged}
                    onChange={(event) => {
                      setPasswordAcknowledged(event.target.checked);
                      setPasswordError('');
                    }}
                  />
                  <label htmlFor="settings-password-ack" className="text-xs text-neutral-300">
                    Store this password safely; it has no reset option.
                  </label>
                </div>
                {passwordError && <p role="alert" className="text-sm text-red-300">{passwordError}</p>}
                <p className="text-xs text-neutral-300">Use 20 to 28 characters.</p>
                <button 
                  type="button"
                  onClick={(e) => {
                    if (!passwordAcknowledged) {
                      setPasswordError('Confirm that you stored the password safely.');
                      return;
                    }
                    if (newPassword.length < 20 || newPassword.length > 28) {
                      setPasswordError('Use a password from 20 to 28 characters.');
                      return;
                    }
                    setPasswordError('');
                    handleSavePassword(e as any);
                  }}
                  disabled={newPassword.length < 20 || newPassword.length > 28} 
                  className="bg-emerald-500 text-neutral-950 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50 transition-colors"
                >
                  Save Password
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setShowPasswordSetup(false);
                    setPasswordAcknowledged(false);
                    setPasswordError('');
                  }}
                  className="text-neutral-500 hover:text-neutral-300 text-xs text-center mt-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setShowPasswordSetup(true)} className="mt-2 py-2 text-sm font-semibold text-neutral-300 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors">
                Setup Password
              </button>
            )
          )}
        </div>
        
        {/* Standalone Mode */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-neutral-100">Standalone Block</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
             Block the sites you choose for up to 1000 hours or choose no limit. Restrictions stay in place while the block is active.
          </p>

          {isStandaloneActive ? (
            <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between">
               <span className="text-sm font-semibold text-blue-400">{standaloneMode ? 'Status:' : 'Active Until:'}</span>
              <span className="text-sm font-mono text-blue-300">
                 {standaloneMode
                   ? 'No limit'
                   : new Date(standaloneUntil).toLocaleString([], {
                       dateStyle: 'short',
                       timeStyle: 'short',
                     })}
              </span>
            </div>
          ) : (
             <div className="flex flex-col gap-3 mt-2">
               <div className="flex items-center gap-2">
                 <label htmlFor="standalone-duration" className="sr-only">Standalone duration in hours</label>
                 <input
                   id="standalone-duration"
                   type="number"
                   min="0.01"
                   max="1000"
                   step="0.01"
                   value={standaloneDurationHours}
                   onChange={(e) => {
                     setStandaloneDurationHours(e.target.value);
                     setStandaloneError('');
                   }}
                   disabled={standaloneUnlimited}
                   className="w-24 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                   aria-invalid={Boolean(standaloneError)}
                   aria-describedby={standaloneError ? "standalone-duration-help standalone-duration-error" : "standalone-duration-help"}
                 />
                 <span className="text-sm text-neutral-400">hours</span>
                 <button
                   type="button"
                   onClick={() => setStandaloneUnlimited(!standaloneUnlimited)}
                   className={cn(
                     "ml-auto px-3 py-2 rounded-lg text-sm font-semibold border transition-colors",
                     standaloneUnlimited
                       ? "bg-blue-500/15 border-blue-500/50 text-blue-300"
                       : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                   )}
                   aria-pressed={standaloneUnlimited}
                 >
                   No limit
                 </button>
               </div>
               <p id="standalone-duration-help" className="text-xs text-neutral-300">
                 Enter any duration from 0.01 to 1000 hours.
               </p>
               {standaloneError && <p id="standalone-duration-error" role="alert" className="text-sm text-red-300">{standaloneError}</p>}
              <button 
                onClick={startStandalone}
                className="bg-blue-500 hover:bg-blue-400 text-neutral-950 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
              >
                Start
              </button>
            </div>
          )}
        </div>

        {/* Daily Allowances */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-neutral-100">Daily Allowances</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Set daily time limits for specific distracting websites.
          </p>

          <form onSubmit={addAllowance} className="flex flex-col gap-2 mt-2">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newAllowanceSite}
                onChange={e => setNewAllowanceSite(e.target.value)}
                placeholder="e.g. reddit.com"
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              />
              <select value={newAllowanceType} onChange={e => setNewAllowanceType(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 text-sm focus:outline-none focus:border-purple-500">
                <option value="time">Time</option>
                <option value="interval">Wait</option>
              </select>
              <select
                value={newAllowanceLimit}
                onChange={e => setNewAllowanceLimit(parseInt(e.target.value))}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 text-xs focus:outline-none focus:border-purple-500"
              >
                <option value={15}>15m</option>
                <option value={30}>30m</option>
                <option value={60}>1h</option>
                <option value={120}>2h</option>
              </select>
            </div>
            <button type="submit" disabled={!newAllowanceSite.trim()} className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
              Add Limit
            </button>
          </form>

          {Object.entries(allowances).length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {isStandaloneActive && (
                <p role="status" className="text-xs text-neutral-300">
                  Removing daily limits is paused while Standalone Block is active.
                </p>
              )}
              {Object.entries(allowances).map(([site, limit]) => (
                <div key={site} className="flex items-center justify-between p-2 bg-neutral-950 rounded-lg border border-neutral-800 group">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{site}</span>
                    <span className="text-xs text-neutral-300">{typeof limit === 'number' ? limit + ' min / day' : limit.type === 'interval' ? limit.limit + ' min cooldown' : limit.limit + ' min'}</span>
                  </div>
                  {!isStandaloneActive && (<button 
                    type="button"
                    onClick={() => handleAction({ type: 'remove_allowance', site })}
                    aria-label={`Remove daily limit for ${site}`}
                    className="text-neutral-300 hover:text-red-400 transition-all p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    </button>)}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <AnimatePresence>
        {verifyAction && (
          <PasswordModal expectedPassword={password} 
            onSuccess={() => executeAction(verifyAction)} 
            onCancel={() => setVerifyAction(null)} 
            friction={verifyAction === 'remove_password' && (isStandaloneActive || isSessionActive)}
          />
        )}
      </AnimatePresence>

    </motion.div>
  );
}

function StatsView({ key }: { key?: string }) {
  const [history] = useChromeStorage<{id: string, startTime: number, duration: number, status: string, elapsed?: number}[]>('sessionHistory', []);
  const [temptationLog] = useChromeStorage<{domain: string, timestamp: number}[]>('temptationLog', []);
  
  const todayStart = new Date().setHours(0,0,0,0);
  const todaySessions = history.filter(s => s.startTime >= todayStart);
  const todayAttemptLogs = temptationLog.filter(log => log.timestamp >= todayStart);
  const todayAttempts = todayAttemptLogs.length;
  const attemptsByDomain = todayAttemptLogs.reduce<Record<string, number>>((counts, log) => {
    counts[log.domain] = (counts[log.domain] || 0) + 1;
    return counts;
  }, {});
  
  const totalFocusTime = todaySessions
    .filter(s => s.status === 'completed')
    .reduce((acc, curr) => acc + curr.duration, 0);
    
  const abandonedSessions = todaySessions.filter(s => s.status === 'abandoned').length;
  const completedSessions = todaySessions.filter(s => s.status === 'completed').length;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex flex-col flex-1 p-4 gap-4 overflow-y-auto"
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-1 items-center justify-center text-center">
        <span className="text-sm font-semibold text-neutral-400">Today's Focus Time</span>
        <span className="text-4xl font-light font-mono text-emerald-400">
          {Math.floor(totalFocusTime / 3600)}h {Math.floor((totalFocusTime % 3600) / 60)}m
        </span>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col items-center">
          <span className="text-2xl font-light text-neutral-200">{completedSessions}</span>
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Completed</span>
        </div>
        <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col items-center">
          <span className="text-2xl font-light text-red-400">{abandonedSessions}</span>
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Abandoned</span>
        </div>
        <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col items-center">
          <span className="text-2xl font-light text-orange-400">{todayAttempts}</span>
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Blocks</span>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-neutral-400 mb-3 px-1">Session History</h3>
        <div className="flex flex-col gap-2">
          {history.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-4">No sessions recorded yet.</p>
          ) : (
            [...history].reverse().slice(0, 10).map(session => (
              <div key={session.id} className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{new Date(session.startTime).toLocaleDateString()}</span>
                  <span className="text-xs text-neutral-500 font-mono">
                    {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-neutral-400">
                    {Math.floor((session.elapsed || session.duration) / 60)}m
                  </span>
                  <span className={cn(
                    "text-xs uppercase font-bold px-2 py-1 rounded",
                    session.status === 'completed' ? "bg-emerald-500/10 text-emerald-400" :
                    session.status === 'abandoned' ? "bg-red-500/10 text-red-400" :
                    "bg-blue-500/10 text-blue-400"
                  )}>
                    {session.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {todayAttemptLogs.length > 0 && (
        <div className="mt-4 mb-8">
          <h3 className="text-sm font-semibold text-neutral-400 mb-3 px-1">Today's Block Attempts</h3>
          <div className="flex flex-col gap-2">
            {Object.entries(attemptsByDomain)
              .sort(([, countA], [, countB]) => countB - countA)
              .map(([domain, count]) => (
                <div key={domain} className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-orange-400 truncate pr-4">{domain}</span>
                  <span className="text-xs text-neutral-500 font-mono whitespace-nowrap">
                    blocked {count} {count === 1 ? 'time' : 'times'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function OnboardingView({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [password, setPassword] = useChromeStorage('app_password_hash', '');
  const [newPassword, setNewPassword] = useState('');
  const [passwordAcknowledged, setPasswordAcknowledged] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [sites, setSites] = useChromeStorage<string[]>('blockedSites', []);
  const [newSite, setNewSite] = useState('');

  const nextStep = () => setStep(s => Math.min(s + 1, 3));

  const handleSavePassword = async () => {
    if (newPassword.length >= 20 && newPassword.length <= 28) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(newPassword));
      const hashed = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      setPassword(hashed);
      setPasswordAcknowledged(false);
      setPasswordError('');
      nextStep();
    }
  };

  const handleAddSite = (e: React.FormEvent) => {
    e.preventDefault();
    const site = newSite.trim().toLowerCase();
    const cleanSite = site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    if (cleanSite && !sites.includes(cleanSite)) {
      setSites([...sites, cleanSite]);
    }
    setNewSite('');
  };

  return (
    <div className="w-full min-h-screen sm:w-[400px] sm:h-[600px] sm:min-h-0 mx-auto bg-neutral-950 text-neutral-100 flex flex-col p-6 font-sans sm:shadow-2xl sm:border sm:border-neutral-800 relative">
      <div className="flex-1 flex flex-col">
        {/* Progress dots */}
        <div className="flex gap-2 justify-center mb-8 mt-4">
          {[1,2,3].map(i => (
            <div key={i} className={cn("w-2 h-2 rounded-full", step >= i ? "bg-emerald-500" : "bg-neutral-800")} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="flex flex-col gap-6 items-center text-center mt-8">
              <div className="w-24 h-24 rounded-3xl overflow-hidden mb-6 shadow-2xl shadow-blue-500/10 ring-1 ring-white/10 mx-auto">
                <img src="/icon.png" alt="FocusGate" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-2xl font-bold">Welcome to FocusGate</h1>
              <p className="text-neutral-400 text-sm leading-relaxed max-w-[280px]">
                Take control of your digital environment. Let's set up your first focus rule. What site distracts you the most?
              </p>
              
              <form onSubmit={handleAddSite} className="w-full mt-4 flex gap-2">
                <input 
                  type="text" 
                  value={newSite}
                  onChange={e => setNewSite(e.target.value)}
                  placeholder="e.g. reddit.com"
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                />
                <button type="submit" className="bg-emerald-500 text-neutral-950 px-4 rounded-lg font-bold">Add</button>
              </form>

              {sites.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {sites.map(s => (
                    <span key={s} className="bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full text-xs font-mono">{s}</span>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="flex flex-col gap-6 items-center text-center mt-8">
              <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-4">
                <Lock className="w-10 h-10 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold">Secure Your Settings</h1>
              <p className="text-neutral-400 text-sm leading-relaxed max-w-[280px]">
                Set a password from 20 to 28 characters to confirm selected rule changes or end a Strict session early.
              </p>
              
              <div className="w-full mt-4 flex flex-col gap-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newPassword}
                    onChange={e => {
                      setNewPassword(e.target.value);
                      setPasswordError('');
                    }}
                    onCopy={e => e.preventDefault()}
                    onPaste={e => e.preventDefault()}
                    onCut={e => e.preventDefault()}
                    placeholder="20-28 chars"
                    maxLength={28}
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button 
                    onClick={() => {
                      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
                      let pass = '';
                      for(let i = 0; i < 24; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
                      setNewPassword(pass);
                    }}
                    className="bg-neutral-800 text-neutral-300 px-3 rounded-lg text-xs font-bold"
                  >
                    Gen
                  </button>
                </div>
                
                <div className="flex items-start gap-2 text-left bg-neutral-900/50 p-3 rounded-lg border border-neutral-800">
                  <input
                    type="checkbox"
                    id="onboard_ack"
                    className="mt-1"
                    checked={passwordAcknowledged}
                    onChange={(event) => {
                      setPasswordAcknowledged(event.target.checked);
                      setPasswordError('');
                    }}
                  />
                  <label htmlFor="onboard_ack" className="text-xs text-neutral-300 leading-tight">
                    Store this password safely; it has no reset option.
                  </label>
                </div>
                {passwordError && <p role="alert" className="text-sm text-red-300">{passwordError}</p>}
                <p className="text-xs text-neutral-300">Use 20 to 28 characters.</p>
                
                <button 
                  type="button"
                  onClick={() => {
                    if (!passwordAcknowledged) {
                      setPasswordError('Confirm that you stored the password safely.');
                      return;
                    }
                    if (newPassword.length < 20 || newPassword.length > 28) {
                      setPasswordError('Use a password from 20 to 28 characters.');
                      return;
                    }
                    handleSavePassword();
                  }} 
                  disabled={newPassword.length < 20 || newPassword.length > 28} 
                  className="bg-blue-500 text-neutral-950 py-3 rounded-lg font-bold disabled:opacity-50 transition-opacity"
                >
                  Save Password
                </button>
                <button type="button" onClick={nextStep} className="text-neutral-300 text-xs font-semibold hover:text-neutral-100 mt-2">
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="flex flex-col gap-6 items-center text-center mt-8">
              <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20 mb-4">
                <Target className="w-10 h-10 text-purple-400" />
              </div>
              <h1 className="text-2xl font-bold">You're All Set!</h1>
              <p className="text-neutral-400 text-sm leading-relaxed max-w-[280px]">
                Tip: Use <kbd className="bg-neutral-800 px-2 py-1 rounded font-mono text-xs mx-1">Alt+Shift+F</kbd> to quickly start or stop a focus session from anywhere.
              </p>
              
              <button onClick={onComplete} className="w-full bg-purple-500 text-neutral-950 py-4 rounded-xl font-bold text-lg mt-8 hover:bg-purple-400 transition-colors">
                Open FocusGate
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-auto pt-6 flex justify-between">
        {step < 3 ? (
          <button onClick={nextStep} className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 py-3 rounded-xl font-bold hover:bg-neutral-800 transition-colors">
            {step === 1 && sites.length === 0 ? "Skip" : "Continue"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SetPasswordModal({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
  const [password, setPassword] = useChromeStorage('app_password_hash', '');
  const [newPassword, setNewPassword] = useState('');
  const [passwordAcknowledged, setPasswordAcknowledged] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleSavePassword = async () => {
    if (newPassword.length >= 20 && newPassword.length <= 28) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(newPassword));
      const hashed = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      setPassword(hashed);
      setPasswordAcknowledged(false);
      setPasswordError('');
      onSuccess();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-neutral-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6"
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-xs shadow-2xl flex flex-col gap-4">
        <div className="space-y-2 text-center">
          <Lock className="w-8 h-8 text-blue-400 mx-auto" />
          <h3 className="text-lg font-bold text-neutral-100">Set a Password</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Strict mode requires a password from 20 to 28 characters. Store it safely; it has no reset option.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newPassword}
              onChange={e => {
                setNewPassword(e.target.value);
                setPasswordError('');
              }}
              onCopy={e => e.preventDefault()}
              onPaste={e => e.preventDefault()}
              onCut={e => e.preventDefault()}
              placeholder="20-28 chars"
              maxLength={28}
              className="flex-1 w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-3 text-center text-sm font-mono focus:outline-none focus:border-blue-500 transition-all"
            />
            <button 
              onClick={() => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
                let pass = '';
                for(let i = 0; i < 24; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
                setNewPassword(pass);
              }}
              className="bg-neutral-800 text-neutral-300 px-3 rounded-lg text-xs font-bold"
            >
              Gen
            </button>
          </div>
          
          <div className="flex items-start gap-2 text-left bg-neutral-950 p-3 rounded-lg border border-neutral-800">
            <input
              type="checkbox"
              id="set_pwd_ack"
              className="mt-1 shrink-0"
              checked={passwordAcknowledged}
              onChange={(event) => {
                setPasswordAcknowledged(event.target.checked);
                setPasswordError('');
              }}
            />
            <label htmlFor="set_pwd_ack" className="text-xs text-neutral-300 leading-tight">
              Store this password safely; it has no reset option.
            </label>
          </div>
          {passwordError && <p role="alert" className="text-sm text-red-300">{passwordError}</p>}
          <p className="text-xs text-neutral-300">Use 20 to 28 characters.</p>

          <div className="flex gap-2 mt-2">
            <button 
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 text-sm font-semibold text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={() => {
                if (!passwordAcknowledged) {
                  setPasswordError('Confirm that you stored the password safely.');
                  return;
                }
                if (newPassword.length < 20 || newPassword.length > 28) {
                  setPasswordError('Use a password from 20 to 28 characters.');
                  return;
                }
                handleSavePassword();
              }} 
              disabled={newPassword.length < 20 || newPassword.length > 28} 
              className="flex-1 py-2 text-sm font-bold bg-blue-500 text-neutral-950 rounded-lg disabled:opacity-50 transition-all"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function PasswordModal({ onSuccess, onCancel, title = "Enter Password", friction = false, expectedPassword }: { onSuccess: () => void, onCancel: () => void, title?: string, friction?: boolean, expectedPassword?: string }) {
  const [frictionDelay, setFrictionDelay] = useState(friction ? 15 : 0);
  
  useEffect(() => {
    if (frictionDelay > 0) {
      const timer = setInterval(() => setFrictionDelay(d => d - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [frictionDelay]);

  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
    const hashed = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (hashed === expectedPassword) {
      onSuccess();
    } else {
      setError(true);
      setInput('');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-neutral-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6"
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-xs shadow-2xl flex flex-col gap-4">
        <div className="space-y-2 text-center">
          <Lock className="w-8 h-8 text-emerald-400 mx-auto" />
          <h3 className="text-lg font-bold text-neutral-100">{title}</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            This action is protected.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input 
            type="password" 
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            onCopy={e => e.preventDefault()}
            onPaste={e => e.preventDefault()}
            onCut={e => e.preventDefault()}
            placeholder="Password" 
            className={cn(
              "w-full bg-neutral-950 border rounded-lg px-4 py-3 text-center text-sm font-mono focus:outline-none transition-all",
              error ? "border-red-500 text-red-400" : "border-neutral-800 focus:border-emerald-500 text-neutral-100"
            )}
            autoFocus
          />
          {error && <p className="text-xs text-red-400 text-center font-semibold">Incorrect Password</p>}
          <div className="flex gap-2 mt-2">
            <button 
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 text-sm font-semibold text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={input.length < 20 || frictionDelay > 0}
              className="flex-1 py-2 text-sm font-bold bg-emerald-500 text-neutral-950 rounded-lg disabled:opacity-50 transition-all"
            >
              {frictionDelay > 0 ? `Wait ${frictionDelay}s` : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
