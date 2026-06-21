import { useState } from 'react';
import { LandingView } from './components/LandingView';
import { LoadingView } from './components/LoadingView';
import { ResultsView } from './components/ResultsView';
import { AuthView } from './components/AuthView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertCircle, LogOut, History, User } from 'lucide-react';
import { HistoryModal } from './components/HistoryModal';
import { useIsMobile } from './hooks/useIsMobile';

type Step = 'idle' | 'loading' | 'results';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface RoastResponse {
  score: number;
  firstImpression: {
    critique: string;
    severity: 'error' | 'warning' | 'success';
  };
  experience: {
    critique: string;
    items: Array<{
      original: string;
      improved: string;
      explanation: string;
    }>;
  };
  projects: {
    critique: string;
    items: Array<{
      original: string;
      improved: string;
      explanation: string;
    }>;
  };
  skills: {
    critique: string;
    items: Array<{
      name: string;
      rating: number;
      comment: string;
    }>;
  };
  atsCompatibility: {
    critique: string;
    rating: number;
    issues: string[];
  };
  whatRecruitersThink: {
    critique: string;
    quote: string;
  };
  topFixes: string[];
  improvedSummary: {
    original: string;
    improved: string;
    explanation: string;
  };
  resumeText?: string;
}

// ─── Inner app (has access to AuthContext) ───────────────────────────────────
function AppInner() {
  const { user, token, logout, isLoading } = useAuth();
  const isMobile = useIsMobile();
  const [step, setStep] = useState<Step>('idle');
  const [roastData, setRoastData] = useState<RoastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <img src="/rr_logo.png" alt="Resume Roast" className="h-10 w-auto animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  const handleFileUpload = async (file: File) => {
    setStep('loading');
    setError(null);

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const response = await fetch(`${API}/api/roast`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${response.status}`);
      }

      const data: RoastResponse = await response.json();
      setRoastData(data);
      setStep('results');
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to connect to the roast server. Ensure the backend is running.');
      setStep('idle');
    }
  };

  const handleReset = () => {
    setStep('idle');
    setRoastData(null);
    setError(null);
  };

  return (
    <div className={`${step === 'idle' ? 'h-screen' : 'min-h-screen'} bg-bg selection:bg-accent/10 selection:text-accent flex flex-col`}>

      {/* Top Bar */}
      <header className="w-full border-b border-neutral-200/60 bg-white/70 backdrop-blur-sm sticky top-0 z-50 flex-shrink-0">
        {isMobile ? (
          /* 📱 Mobile Header (64px) */
          <div className="h-16 px-4 flex items-center justify-between relative">
            <div className="flex items-center select-none">
              <img src="/rr_logo.png" alt="Resume Roast" className="h-8 w-auto" />
            </div>

            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-10 h-10 rounded-full border border-neutral-900 bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 active:scale-[0.98] transition-all cursor-pointer shadow-subtle overflow-hidden"
              title="Profile Menu"
            >
              <User className="w-5 h-5 text-primary" />
            </button>

            {/* Mobile Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute top-16 right-4 w-48 bg-white border border-neutral-900 rounded-xl shadow-lg p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col gap-2">
                <div className="px-2 py-1.5 border-b border-neutral-100 text-left">
                  <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">Account</p>
                  <p className="text-xs font-extrabold text-primary truncate mt-0.5">{user.name}</p>
                </div>
                <button
                  onClick={() => {
                    setIsHistoryOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-xs font-bold text-secondary hover:text-primary hover:bg-neutral-50 transition-all text-left cursor-pointer"
                >
                  <History className="w-4 h-4" /> History
                </button>
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-xs font-bold text-error hover:bg-error/5 transition-all text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          /* 🖥️ Desktop Header (Unchanged) */
          <div className="max-w-5xl mx-auto px-6 py-1 flex items-center justify-between">
            {/* Brand */}
            <div className="flex items-center select-none">
              <img src="/rr_logo.png" alt="Resume Roast" className="h-17 w-auto" />
            </div>

            {/* User + actions */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-secondary hidden sm:block">
                👋 <span className="font-semibold text-primary">{user.name}</span>
              </span>
              <button
                id="history-btn"
                title="Roast History"
                onClick={() => setIsHistoryOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-bold text-secondary hover:text-primary hover:border-neutral-300 hover:bg-neutral-50 transition-all"
              >
                <History className="w-3.5 h-3.5" /> History
              </button>
              <button
                id="logout-btn"
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-bold text-secondary hover:text-error hover:border-error/30 hover:bg-error/5 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col justify-center overflow-auto">
        {error && (
          <div className="max-w-xl mx-auto px-6 w-full">
            <div className="flex items-center gap-3 p-4 rounded-medium border border-error/20 bg-error/5 text-sm text-error mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Roasting Failed</p>
                <p className="text-xs text-error/80 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}

        {step === 'idle' && <LandingView onFileUpload={handleFileUpload} />}
        {step === 'loading' && <LoadingView />}
        {step === 'results' && roastData && (
          <ResultsView data={roastData} onResumeUpload={handleReset} />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-3 border-t border-neutral-200/50 bg-white/40 backdrop-blur-sm text-center text-xs text-secondary flex-shrink-0">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} Resume Roast. Roasted, not broken. Let's fix it.</p>
        </div>
      </footer>

      {/* History Modal */}
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
}

// ─── Root: wraps with AuthProvider ───────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
