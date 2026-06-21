import React, { useEffect, useState } from 'react';
import { X, Calendar, FileText, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HistoryItem {
  id: string;
  name: string;
  email: string;
  score: number;
  resume_pdf: string;
  created_at: string;
  is_mock?: boolean;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && token) {
      fetchHistory();
    }
  }, [isOpen, token]);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API}/api/user/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve history');
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err: any) {
      setError(err.message || 'Something went wrong fetching your history.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-neutral-200/80 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h3 className="text-lg font-bold text-primary font-heading">Roast History</h3>
            <p className="text-xs text-secondary mt-0.5">Your past submissions and scores</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-neutral-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-xs text-secondary font-medium animate-pulse">Retrieving your roasts...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <AlertCircle className="w-10 h-10 text-error mb-3" />
              <p className="text-sm font-semibold text-primary">Could not load history</p>
              <p className="text-xs text-secondary mt-1 max-w-xs">{error}</p>
              <button 
                onClick={fetchHistory}
                className="mt-4 px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-bold hover:bg-neutral-800 transition-all"
              >
                Try Again
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <FileText className="w-12 h-12 text-neutral-300 mb-3" />
              <p className="text-sm font-semibold text-primary">No roasts yet</p>
              <p className="text-xs text-secondary mt-1 max-w-xs">Upload your first resume to see it here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => {
                const date = new Date(item.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div 
                    key={item.id}
                    className="p-4 rounded-xl border border-neutral-150 bg-neutral-50/50 hover:bg-neutral-50 transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Score Badge */}
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-white border border-neutral-200 shadow-sm flex-shrink-0">
                        <span className="text-[10px] font-extrabold uppercase text-secondary tracking-wider leading-none mb-0.5">Score</span>
                        <span className={`text-base font-black font-heading leading-none ${
                          item.score >= 80 ? 'text-success' : item.score >= 60 ? 'text-warning' : 'text-error'
                        }`}>
                          {item.score}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-primary truncate">{item.name}</p>
                          {item.is_mock && (
                            <span className="text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
                              ⚠️ System Fallback
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-secondary mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {date}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {item.resume_pdf && (
                      <a 
                        href={item.resume_pdf}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-bold text-secondary bg-white hover:text-primary hover:border-neutral-300 hover:shadow-sm transition-all flex-shrink-0"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Resume</span>
                        <ExternalLink className="w-3 h-3 text-secondary/60" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
