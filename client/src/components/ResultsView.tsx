import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, ChevronUp, CheckCircle2, 
  Sparkles, Eye, Briefcase, FolderGit2, Cpu, Award, 
  Trash2, PlusCircle, Edit3, ArrowRight, CornerDownRight
} from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

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

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const checkProjectDiagnostics = (text: string) => {
  const hasMetrics = /[\d%#$]+/g.test(text);
  const hasImpact = /(impact|save|reduce|increase|optimize|improve|speed|revenue|cost|million)/i.test(text);
  const hasTechDecisions = /(due to|because|in order to|chose|leveraged|designed)/i.test(text);
  const hasUsers = /(users|active|customers|audience|clients)/i.test(text);
  return { hasMetrics, hasImpact, hasTechDecisions, hasUsers };
};

const getBulletTag = (text: string) => {
  const hasMetrics = /[\d%#$]+/g.test(text);
  const isPassive = /^(responsible for|assisted|helped|handled|worked on|participated|managed|led)/i.test(text.trim());
  if (hasMetrics) {
    return { label: '🟢 Strong metric', bg: 'bg-emerald-50 text-emerald-950 border border-emerald-250', desc: 'Well-quantified impact.' };
  }
  if (isPassive) {
    return { label: '❌ Generic', bg: 'bg-error/10 text-error border border-error/20', desc: 'Uses weak passive phrasing.' };
  }
  return { label: '✏️ Needs result', bg: 'bg-warning/10 text-warning border border-warning/20', desc: 'Good task detail but lacks outcome.' };
};

interface ResultsViewProps {
  data: RoastResponse;
  onResumeUpload: () => void;
}

const CollapsibleText: React.FC<{ text: string; maxLength?: number }> = ({ text, maxLength = 100 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (text.length <= maxLength) {
    return <p className="text-[14px] leading-relaxed">"{text}"</p>;
  }
  
  return (
    <div className="space-y-1">
      <p className="text-[14px] leading-relaxed text-left">
        "{isExpanded ? text : `${text.slice(0, maxLength)}...`}"
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="text-[12px] text-accent font-extrabold flex items-center gap-1 active:scale-[0.98] py-1 mt-1 cursor-pointer"
      >
        {isExpanded ? 'Collapse roast' : 'Expand roast'}
      </button>
    </div>
  );
};

export const ResultsView: React.FC<ResultsViewProps> = ({ data, onResumeUpload }) => {
  const fixWorkshopRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'heatmap' | 'debate'>('overview');
  const [activeSection, setActiveSection] = useState<string>('Summary');
  const sectionsList = ['Summary', 'Skills', 'Projects', 'Experience', 'Achievements', 'Verdict'];

  const renderReactionBadge = (severity: 'SEVERE' | 'MODERATE' | 'PRAISE') => {
    if (severity === 'SEVERE') {
      return <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-error/10 text-error border border-error/20">🔥 SEVERE</span>;
    }
    if (severity === 'MODERATE') {
      return <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">⚠️ MODERATE</span>;
    }
    return <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/20">🟢 PRAISE</span>;
  };

  const getSummarySeverity = () => {
    if (data.score < 60) return 'SEVERE';
    if (data.score < 80) return 'MODERATE';
    return 'PRAISE';
  };

  const getSkillsSeverity = () => {
    if (data.skills.items.length === 0) return 'SEVERE';
    const lowSkills = data.skills.items.filter(s => s.rating <= 2).length;
    if (lowSkills >= 2) return 'SEVERE';
    if (lowSkills >= 1) return 'MODERATE';
    return 'PRAISE';
  };

  const getProjectsSeverity = () => {
    if (data.projects.items.length === 0) return 'SEVERE';
    let weakCount = 0;
    data.projects.items.forEach(item => {
      const diag = checkProjectDiagnostics(item.original);
      const scoreProj = (diag.hasMetrics ? 1 : 0) + (diag.hasImpact ? 1 : 0) + (diag.hasTechDecisions ? 1 : 0) + (diag.hasUsers ? 1 : 0);
      if (scoreProj < 2) weakCount++;
    });
    if (weakCount === data.projects.items.length) return 'SEVERE';
    if (weakCount > 0) return 'MODERATE';
    return 'PRAISE';
  };

  const getExperienceSeverity = () => {
    if (data.experience.items.length === 0) return 'SEVERE';
    let genericCount = 0;
    let strongCount = 0;
    data.experience.items.forEach(item => {
      const tag = getBulletTag(item.original);
      if (tag.label.includes('Generic')) genericCount++;
      if (tag.label.includes('Strong')) strongCount++;
    });
    if (genericCount >= 2) return 'SEVERE';
    if (genericCount >= 1 || strongCount < data.experience.items.length) return 'MODERATE';
    return 'PRAISE';
  };

  const getAchievementsSeverity = () => {
    const text = (data.resumeText || '').toLowerCase();
    const hasHighRank = /\b(1st|2nd|3rd|first|second|third|winner|won|champion|gold\s+medal|silver\s+medal|bronze\s+medal|rank\b|placement|rank\s*:\s*\d+)\b/i.test(text);
    const hasRunnerUp = /\b(runner-up|runner\s+up|runners-up|runners\s+up|runnerup|runnerups)\b/i.test(text);
    
    if (hasHighRank || hasRunnerUp) {
      return 'PRAISE';
    }
    
    if (data.score < 60) return 'SEVERE';
    if (data.score < 75) return 'MODERATE';
    return 'PRAISE';
  };

  const getVerdictSeverity = () => {
    if (data.score < 60) return 'SEVERE';
    if (data.score < 80) return 'MODERATE';
    return 'PRAISE';
  };

  const toggleActiveSection = (section: string) => {
    setActiveSection(prev => prev === section ? '' : section);
  };

  const handleProgressClick = (section: string) => {
    setActiveSection(section);
    setTimeout(() => {
      const element = document.getElementById(`section-${section.toLowerCase()}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [typingMessage, setTypingMessage] = useState('Recruiter is reading...');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const presetQuestions = [
    "Why did you rate my projects so low?",
    "How can I get my score above 80?",
    "Is my summary really that bad?",
    "Tell me how to fix my work experience bullets."
  ];

  const recruiterThoughts = [
    "Recruiter is sighing deeply...",
    "Recruiter is facepalming...",
    "Recruiter is taking a slow sip of cold coffee...",
    "Recruiter is drafting an automated rejection email...",
    "Recruiter is rolling their eyes...",
    "Recruiter is checking their watch..."
  ];

  const sendMessageToAPI = async (updatedMessages: typeof chatMessages) => {
    setIsLoadingChat(true);
    const interval = setInterval(() => {
      const randomMsg = recruiterThoughts[Math.floor(Math.random() * recruiterThoughts.length)];
      setTypingMessage(randomMsg);
    }, 2000);

    try {
      const response = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages,
          resumeText: data.resumeText,
          roastData: {
            score: data.score,
            firstImpression: data.firstImpression,
            experience: { critique: data.experience.critique },
            projects: { critique: data.projects.critique },
            skills: { critique: data.skills.critique },
            atsCompatibility: { rating: data.atsCompatibility.rating },
            whatRecruitersThink: data.whatRecruitersThink
          }
        }),
      });

      clearInterval(interval);

      if (!response.ok) {
        throw new Error('Server error');
      }

      const resJson = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: resJson.content }]);
    } catch (err: any) {
      clearInterval(interval);
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: "*(Sighs)* I don't even have the energy to respond to that. Try checking your server connection." }
      ]);
    } finally {
      setIsLoadingChat(false);
      setTypingMessage('Recruiter is reading...');
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    
    const newMessages = [...chatMessages, { role: 'user', content: userMsg } as const];
    setChatMessages(newMessages);
    
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    sendMessageToAPI(newMessages);
  };

  const handleSendPreset = (question: string) => {
    const newMessages = [...chatMessages, { role: 'user', content: question } as const];
    setChatMessages(newMessages);
    
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    sendMessageToAPI(newMessages);
  };



  const handleFixResumeClick = () => {
    setActiveTab('debate');
    setTimeout(() => {
      fixWorkshopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handleShowReceiptsClick = () => {
    setActiveTab('heatmap');
  };

  // Helper to categorize score text and mood based on score
  const getScoreVerdict = (score: number) => {
    if (score >= 85) {
      return { 
        label: "Interview material.", 
        mood: "📞 Interview", 
        stamp: "SHORTLIST", 
        stampColor: "border-success text-success bg-success/5", 
        verdict: "Kept reading", 
        caption: "Recoverable." 
      };
    }
    if (score >= 70) {
      return { 
        label: "Hesitated.", 
        mood: "😬 Hesitated", 
        stamp: "MAYBE", 
        stampColor: "border-warning text-warning bg-warning/5", 
        verdict: "Needs revision", 
        caption: "Recoverable." 
      };
    }
    if (score >= 55) {
      return { 
        label: "Direct to trash bin.", 
        mood: "🧐 Kept Reading", 
        stamp: "MAYBE", 
        stampColor: "border-warning text-warning bg-warning/5", 
        verdict: "Direct to trash bin.", 
        caption: "Recoverable." 
      };
    }
    return { 
      label: "Direct to trash bin.", 
      mood: "💀 Closed Tab", 
      stamp: "SKIPPED", 
      stampColor: "border-error text-error bg-error/5", 
      verdict: "Direct to trash bin.", 
      caption: "Recoverable." 
    };
  };

  const scoreInfo = getScoreVerdict(data.score);

  // Dynamic extraction from parsed resume data to avoid any hardcoded mock content
  const summaryText = data.improvedSummary.original || "Professional summary not found.";
  const summaryExplanation = data.improvedSummary.explanation || "Focus on metrics, not aspirations.";
  


  // Helper to parse fixes into structured Damage Report cards
  const parseFixes = (fixes: string[]) => {
    return fixes.map((fix) => {
      const text = fix.trim();
      let action: 'REMOVE' | 'ADD' | 'REWRITE' = 'REWRITE';
      let icon = <Edit3 className="w-4 h-4 text-accent" />;
      let title = text;
      let impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

      if (/^(remove|delete|scrap|drop)/i.test(text)) {
        action = 'REMOVE';
        icon = <Trash2 className="w-4 h-4 text-error" />;
        title = text.replace(/^(remove|delete|scrap|drop)\s+/i, '');
        impact = 'HIGH';
      } else if (/^(add|quantify|include|integrate|inject|utilize)/i.test(text)) {
        action = 'ADD';
        icon = <PlusCircle className="w-4 h-4 text-success" />;
        title = text.replace(/^(add|quantify|include|integrate|inject|utilize)\s+/i, '');
        impact = 'HIGH';
      } else if (/^(rewrite|focus|change|shift|improve|revamp)/i.test(text)) {
        action = 'REWRITE';
        icon = <Edit3 className="w-4 h-4 text-warning" />;
        title = text.replace(/^(rewrite|focus|change|shift|improve|revamp)\s+/i, '');
        impact = 'MEDIUM';
      }

      // Format clean visual title
      const words = title.split(' ');
      const titleText = words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');

      return {
        action,
        icon,
        title: titleText.replace(/[.,]/g, ''),
        explanation: text,
        impact
      };
    });
  };

  const parsedFixes = parseFixes(data.topFixes || []);

  const isMobile = useIsMobile();

  if (isMobile) {
    const currentSection = activeSection || 'Summary';
    
    return (
      <div className="w-full px-4 py-4 text-left flex flex-col gap-4 bg-bg selection:bg-accent/10 selection:text-accent overflow-x-hidden">
        
        {/* Title */}
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-neutral-900">
          <div className="space-y-0.5">
            <h1 className="font-heading font-extrabold text-[22px] tracking-tight text-primary">Resume Roast</h1>
            <p className="text-[12px] font-bold text-accent">Recruiter-grade criticism.</p>
          </div>
          <button
            onClick={onResumeUpload}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-primary hover:text-accent transition-all border border-neutral-900 bg-white rounded-xl shadow-subtle cursor-pointer active:scale-[0.98]"
          >
            New Victim →
          </button>
        </div>

        {/* TOP TAB BAR NAVIGATION */}
        <div className="w-full border-b border-neutral-200 pb-2 mb-2">
          <div className="grid grid-cols-3 gap-2 w-full">
            {(['overview', 'heatmap', 'debate'] as const).map((tab) => {
              const label = tab === 'overview' ? 'Overview' : (tab === 'heatmap' ? 'Flaws' : 'Debate');
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === 'heatmap' && !activeSection) {
                      setActiveSection('Summary');
                    }
                  }}
                  className={`py-2.5 px-1 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-150 flex items-center justify-center gap-1 active:scale-[0.98] border cursor-pointer ${
                    isActive 
                      ? 'text-white bg-neutral-900 border-neutral-900 shadow-sm' 
                      : 'text-secondary bg-white border-neutral-200 hover:text-primary'
                  }`}
                >
                  <span className="truncate">{label}</span>
                  {tab === 'heatmap' && (
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      isActive ? 'bg-accent text-white' : 'bg-error text-white animate-pulse'
                    }`}>
                      {data.topFixes.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content rendering */}
        <div className="w-full flex-grow">
          {activeTab === 'overview' && (
            <div className="w-full flex flex-col gap-4">
              
              {/* Score Card */}
              <div className="w-full bg-neutral-900 text-bg p-4 rounded-xl border border-neutral-900 shadow-sm flex items-center justify-between relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#FAF9F6_1px,transparent_1px)] bg-[size:10px_10px]" />
                
                <div className="absolute right-3 top-3 pointer-events-none rotate-[-6deg] z-10 opacity-90 select-none scale-75 origin-top-right">
                  <div className={`stamp-active font-heading font-black text-sm tracking-widest px-2.5 py-1 border-2 rounded uppercase text-center ${scoreInfo.stampColor}`}>
                    {scoreInfo.stamp}
                  </div>
                </div>

                <div className="flex items-center gap-4 z-10">
                  <div className="flex flex-col items-center justify-center bg-neutral-800 rounded-xl p-2 min-w-[64px]">
                    <span className="text-3xl font-black text-white tracking-tighter">{data.score}</span>
                    <span className="text-[9px] font-bold text-neutral-400 mt-0.5 border-t border-neutral-700/60 pt-0.5">/ 100</span>
                  </div>
                  
                  <div className="text-left space-y-0.5 pr-14">
                    <h2 className="text-[15px] font-bold text-white tracking-tight leading-tight">
                      {scoreInfo.verdict}
                    </h2>
                    <div className="flex items-center gap-1 text-[11px] text-neutral-300">
                      <span className="text-neutral-400">Recruiter mood:</span>
                      <span className="text-white font-extrabold">{scoreInfo.mood}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recruiter Reaction Card */}
              <div className="w-full bg-white p-4 rounded-xl border border-neutral-900 shadow-sm text-left flex flex-col gap-3">
                <span className="text-[12px] font-bold text-secondary uppercase tracking-widest block">Recruiter Reaction</span>
                <blockquote className="text-[16px] font-extrabold text-primary tracking-tight leading-relaxed italic">
                  "{data.whatRecruitersThink.quote || 'Your resume says everything except why you\'re useful.'}"
                </blockquote>
                
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-200 text-left">
                  <div>
                    <span className="text-[12px] font-bold text-secondary uppercase block">Scan Time</span>
                    <span className="text-[16px] font-black text-primary">
                      {data.score < 50 ? "2.4s" : (data.score < 75 ? "4.1s" : "6.8s")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[12px] font-bold text-secondary uppercase block">Memory</span>
                    <span className="text-[16px] font-black text-primary">
                      {Math.max(8, data.score - 45)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[12px] font-bold text-secondary uppercase block">Odds</span>
                    <span className={`text-[16px] font-black ${
                      data.score < 50 ? 'text-error' : (data.score < 75 ? 'text-warning' : 'text-success')
                    }`}>
                      {data.score < 50 ? "Terrible" : (data.score < 75 ? "Maybe" : "High")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Session Roasting Notes */}
              <div className="w-full bg-white p-4 rounded-xl border-2 border-neutral-900 border-l-[8px] border-l-accent shadow-sm flex flex-col gap-4">
                <h3 className="text-[16px] font-black text-primary uppercase tracking-tight text-left">
                  Session Roasting Notes
                </h3>
                <div className="flex flex-col gap-3">
                  <div className={`p-4 rounded-xl border-2 flex flex-col gap-1.5 text-left ${
                    data.firstImpression.severity === 'success' ? 'bg-success/[0.04] border-success/40' :
                    data.firstImpression.severity === 'warning' ? 'bg-warning/[0.04] border-warning/40' :
                    'bg-error/[0.04] border-error/40'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-black text-primary uppercase tracking-wider">First Impression</span>
                      <span className={`text-[12px] font-black px-1.5 py-0.5 rounded uppercase ${
                        data.firstImpression.severity === 'success' ? 'bg-success/20 text-success border border-success/30' :
                        data.firstImpression.severity === 'warning' ? 'bg-warning/20 text-warning border border-warning/30' :
                        'bg-error/20 text-error border border-error/30'
                      }`}>
                        {data.firstImpression.severity}
                      </span>
                    </div>
                    <p className="text-[16px] font-black text-neutral-900 leading-relaxed italic">
                      "{data.firstImpression.critique}"
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border-2 border-accent/40 bg-accent/[0.04] flex flex-col gap-1.5 text-left">
                    <span className="text-[12px] font-black text-primary uppercase tracking-wider block">Recruiter Mindset</span>
                    <p className="text-[16px] font-black text-neutral-900 leading-relaxed italic">
                      "{data.whatRecruitersThink.critique}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Recruiter Speedrun */}
              <div className="w-full bg-white p-4 rounded-xl border border-neutral-900 shadow-sm text-left">
                <h3 className="text-[16px] font-black text-primary flex items-center gap-2 mb-4">
                  <span className="w-2 h-3.5 bg-accent rounded-sm" />
                  Recruiter Speedrun
                </h3>
                
                <div className="flex flex-row gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
                  <div className="flex-shrink-0 w-[78vw] bg-neutral-50 p-4 rounded-xl border border-neutral-200 snap-center flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-success/15 text-success flex items-center justify-center font-extrabold text-xs border border-success flex-shrink-0">
                      ✓
                    </div>
                    <div>
                      <span className="text-[12px] font-bold text-secondary uppercase tracking-wider block">0 Seconds</span>
                      <h4 className="text-[14px] font-bold text-primary">Saw title</h4>
                      <p className="text-[12px] text-secondary leading-normal">Categorized candidate.</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 w-[78vw] bg-neutral-50 p-4 rounded-xl border border-neutral-200 snap-center flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-error/15 text-error flex items-center justify-center font-extrabold text-xs border border-error flex-shrink-0">
                      ✗
                    </div>
                    <div>
                      <span className="text-[12px] font-bold text-secondary uppercase tracking-wider block">2 Seconds</span>
                      <h4 className="text-[14px] font-bold text-primary text-error">Skipped summary</h4>
                      <p className="text-[12px] text-secondary leading-normal">Lost immediate attention.</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 w-[78vw] bg-neutral-50 p-4 rounded-xl border border-neutral-200 snap-center flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-success/15 text-success flex items-center justify-center font-extrabold text-xs border border-success flex-shrink-0">
                      ✓
                    </div>
                    <div>
                      <span className="text-[12px] font-bold text-secondary uppercase tracking-wider block">4 Seconds</span>
                      <h4 className="text-[14px] font-bold text-primary">Read core stack</h4>
                      <p className="text-[12px] text-secondary leading-normal">Identified raw skills.</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 w-[78vw] bg-neutral-50 p-4 rounded-xl border border-neutral-200 snap-center flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-error/15 text-error flex items-center justify-center font-extrabold text-xs border border-error flex-shrink-0">
                      ✗
                    </div>
                    <div>
                      <span className="text-[12px] font-bold text-secondary uppercase tracking-wider block">7 Seconds</span>
                      <h4 className="text-[14px] font-bold text-primary text-error">Tab closed</h4>
                      <p className="text-[12px] text-secondary leading-normal">Failed to seal follow-up.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Banner / CTA */}
              <div 
                onClick={() => {
                  setActiveTab('heatmap');
                  setActiveSection('Summary');
                }}
                className="bg-neutral-900 text-white p-6 rounded-xl border-2 border-neutral-900 shadow-sm flex flex-col gap-4 cursor-pointer relative overflow-hidden text-left active:scale-[0.98] transition-all"
              >
                <div className="absolute right-0 top-0 w-32 h-32 bg-accent/15 rounded-full blur-2xl -z-10" />
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-widest block bg-accent/20 px-2 py-0.5 rounded">Margin Notes Ready</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping" />
                  </div>
                  <h3 className="text-[16px] font-black tracking-tight text-white uppercase">Inspect Section-by-Section Critique</h3>
                  <p className="text-[12px] text-neutral-300 leading-relaxed">
                    See which bullet points are generic, which skills you must scrap, and read the brutal section-by-section breakdown.
                  </p>
                </div>
                <button className="w-full h-12 inline-flex items-center justify-center gap-1.5 px-4 text-xs font-black uppercase tracking-wider text-neutral-900 bg-white rounded-xl shadow-sm">
                  View Margin Notes →
                </button>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-2.5 mt-2">
                <button
                  onClick={handleFixResumeClick}
                  className="w-full h-12 bg-accent hover:bg-accent/90 text-white text-[15px] font-bold rounded-xl transition-all shadow-subtle flex items-center justify-center gap-2 cursor-pointer border border-accent active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4" />
                  Repair Resume Workshop
                </button>
                
                <button
                  onClick={handleShowReceiptsClick}
                  className="w-full h-12 bg-white text-neutral-900 hover:bg-neutral-900 hover:text-white text-[15px] font-black uppercase tracking-wider rounded-xl transition-all border-2 border-neutral-900 shadow-subtle flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  Inspect Roast Receipts →
                </button>
              </div>

            </div>
          )}

          {activeTab === 'heatmap' && (
            <div className="w-full flex flex-col gap-4">
              
              {/* Horizontal chips for sections */}
              <div className="w-full overflow-x-auto scrollbar-none flex gap-2 pb-2">
                <div className="flex gap-2 flex-nowrap">
                  {sectionsList.map((section) => {
                    const isActive = currentSection === section;
                    return (
                      <button
                        key={section}
                        onClick={() => setActiveSection(section)}
                        className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-150 flex-shrink-0 cursor-pointer active:scale-[0.98] border ${
                          isActive 
                            ? 'text-white bg-neutral-900 border-neutral-900 shadow-sm' 
                            : 'text-secondary bg-white border-neutral-200 hover:text-primary'
                        }`}
                      >
                        {section}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section Details - Story Card View */}
              {currentSection === 'Summary' && (
                <div className="w-full bg-white rounded-xl border border-neutral-900 shadow-sm p-4 flex flex-col gap-4 text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                    <h3 className="text-[18px] font-black text-primary uppercase">Summary & Pitch</h3>
                    {renderReactionBadge(getSummarySeverity())}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block">Original Text</span>
                      <CollapsibleText text={summaryText} />
                    </div>

                    <div className="flex justify-center text-secondary py-0.5">
                      <span className="text-lg">↓</span>
                    </div>

                    <div className={`p-4 rounded-xl border-2 flex gap-3 ${
                      getSummarySeverity() === 'SEVERE' ? 'bg-error/5 border-error/20' :
                      getSummarySeverity() === 'MODERATE' ? 'bg-amber-50/50 border-amber-900/10' :
                      'bg-emerald-50/55 border-emerald-950/10'
                    }`}>
                      <span className="text-base flex-shrink-0 mt-0.5">
                        {getSummarySeverity() === 'SEVERE' ? '🔥' : getSummarySeverity() === 'MODERATE' ? '⚠️' : '🟢'}
                      </span>
                      <div className="flex-grow">
                        <span className="text-[11px] font-bold uppercase tracking-wider block mb-1">Recruiter Reaction</span>
                        <p className="font-heading font-bold italic text-[16px] text-primary leading-relaxed">
                          {summaryExplanation}
                        </p>
                      </div>
                    </div>

                    {data.improvedSummary.improved && (
                      <>
                        <div className="flex justify-center text-secondary py-0.5">
                          <span className="text-lg">↓</span>
                        </div>

                        <div className="p-4 rounded-xl border border-neutral-900 bg-white text-primary leading-relaxed relative flex flex-col gap-1.5 shadow-subtle mt-1.5">
                          <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-neutral-900 text-white rounded text-[9px] font-bold tracking-widest uppercase">
                            ✨ Approved Rewrite
                          </span>
                          <p className="text-[14px] font-bold mt-1 leading-normal">
                            "{data.improvedSummary.improved}"
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {currentSection === 'Skills' && (
                <div className="w-full bg-white rounded-xl border border-neutral-900 shadow-sm p-4 flex flex-col gap-4 text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                    <h3 className="text-[18px] font-black text-primary uppercase">Skills & Utility</h3>
                    {renderReactionBadge(getSkillsSeverity())}
                  </div>

                  <div className={`p-4 rounded-xl border flex gap-3 ${
                    getSkillsSeverity() === 'SEVERE' ? 'bg-error/5 border-error/15' :
                    getSkillsSeverity() === 'MODERATE' ? 'bg-amber-50/70 border-amber-900/10' :
                    'bg-emerald-50/70 border-emerald-950/10'
                  }`}>
                    <span className="text-base flex-shrink-0">
                      {getSkillsSeverity() === 'SEVERE' ? '🔥' : getSkillsSeverity() === 'MODERATE' ? '⚠️' : '🟢'}
                    </span>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider block mb-1">Critique</span>
                      <p className="text-[14px] font-black text-primary leading-relaxed">
                        {data.skills.critique || "Filter general office utilities and list core engineering frameworks."}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="border border-neutral-200 rounded-xl bg-white p-4 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                        <span className="text-emerald-600 text-sm">✅</span>
                        <span className="text-[12px] font-bold text-primary uppercase tracking-wider">Keep & Highlight</span>
                      </div>
                      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                        {data.skills.items.filter(s => s.rating >= 3).length > 0 ? (
                          data.skills.items.filter(s => s.rating >= 3).map((skill, sIdx) => (
                            <div key={sIdx} className="p-3 rounded-lg bg-emerald-50/30 border border-emerald-100/60 text-left">
                              <div className="flex justify-between items-center">
                                <span className="text-[13px] font-bold text-emerald-955">{skill.name}</span>
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/50 px-1.5 py-0.5 rounded">{skill.rating}/5</span>
                              </div>
                              {skill.comment && <p className="text-[11px] text-emerald-800/80 mt-1">{skill.comment}</p>}
                            </div>
                          ))
                        ) : (
                          <p className="text-[12px] text-secondary italic">No high-rated skills detected.</p>
                        )}
                      </div>
                    </div>

                    <div className="border border-neutral-200 rounded-xl bg-white p-4 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                        <span className="text-error text-sm">❌</span>
                        <span className="text-[12px] font-bold text-primary uppercase tracking-wider">Scrap or De-emphasize</span>
                      </div>
                      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                        {data.skills.items.filter(s => s.rating < 3).length > 0 ? (
                          data.skills.items.filter(s => s.rating < 3).map((skill, sIdx) => (
                            <div key={sIdx} className="p-3 rounded-lg bg-amber-50/40 border border-amber-100/60 text-left">
                              <div className="flex justify-between items-center">
                                <span className="text-[13px] font-bold text-amber-955">{skill.name}</span>
                                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100/50 px-1.5 py-0.5 rounded">{skill.rating}/5</span>
                              </div>
                              {skill.comment && <p className="text-[11px] text-amber-800/80 mt-1">{skill.comment}</p>}
                            </div>
                          ))
                        ) : (
                          <p className="text-[12px] text-secondary italic">No weak skills flagged to scrap.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentSection === 'Projects' && (
                <div className="w-full flex flex-col gap-4">
                  <div className="bg-white rounded-xl border border-neutral-900 shadow-sm p-4 flex flex-col gap-3 text-left">
                    <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                      <h3 className="text-[18px] font-black text-primary uppercase">Projects Critique</h3>
                      {renderReactionBadge(getProjectsSeverity())}
                    </div>
                    
                    <div className={`p-4 rounded-xl border flex gap-3 ${
                      getProjectsSeverity() === 'SEVERE' ? 'bg-error/5 border-error/15' :
                      getProjectsSeverity() === 'MODERATE' ? 'bg-amber-50/70 border-amber-900/10' :
                      'bg-emerald-50/70 border-emerald-950/10'
                    }`}>
                      <span className="text-base flex-shrink-0">
                        {getProjectsSeverity() === 'SEVERE' ? '🔥' : getProjectsSeverity() === 'MODERATE' ? '⚠️' : '🟢'}
                      </span>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider block mb-1">Critique</span>
                        <p className="text-[14px] font-black text-primary leading-relaxed">{data.projects.critique}</p>
                      </div>
                    </div>
                  </div>

                  {data.projects.items.map((item, pIdx) => {
                    const diag = checkProjectDiagnostics(item.original);
                    const scoreProj = (diag.hasMetrics ? 1 : 0) + (diag.hasImpact ? 1 : 0) + (diag.hasTechDecisions ? 1 : 0) + (diag.hasUsers ? 1 : 0);
                    const projectItemSeverity = scoreProj < 2 ? 'SEVERE' : (scoreProj < 3 ? 'MODERATE' : 'PRAISE');

                    return (
                      <div key={pIdx} className="bg-white rounded-xl border border-neutral-900 shadow-sm p-4 flex flex-col gap-4 text-left">
                        <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                          <span className="text-[14px] font-bold text-primary">Project #{pIdx + 1}</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                            projectItemSeverity === 'SEVERE' ? 'bg-error/10 text-error' :
                            projectItemSeverity === 'MODERATE' ? 'bg-warning/10 text-warning' :
                            'bg-success/15 text-success'
                          }`}>
                            {projectItemSeverity}
                          </span>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex flex-col gap-1">
                            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block">Original text</span>
                            <CollapsibleText text={item.original} />
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block">Diagnostics Checklist</span>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className={`flex items-center gap-1.5 p-2 rounded border text-[11px] font-semibold ${
                                diag.hasMetrics ? 'bg-emerald-50/55 border-emerald-200 text-emerald-900' : 'bg-amber-50/30 border-amber-105 text-amber-900'
                              }`}>
                                <span>{diag.hasMetrics ? '✅' : '❌'}</span>
                                <span>Metrics</span>
                              </div>
                              <div className={`flex items-center gap-1.5 p-2 rounded border text-[11px] font-semibold ${
                                diag.hasImpact ? 'bg-emerald-50/55 border-emerald-200 text-emerald-900' : 'bg-amber-50/30 border-amber-105 text-amber-900'
                              }`}>
                                <span>{diag.hasImpact ? '✅' : '❌'}</span>
                                <span>Impact</span>
                              </div>
                              <div className={`flex items-center gap-1.5 p-2 rounded border text-[11px] font-semibold ${
                                diag.hasTechDecisions ? 'bg-emerald-50/55 border-emerald-200 text-emerald-900' : 'bg-amber-50/30 border-amber-105 text-amber-900'
                              }`}>
                                <span>{diag.hasTechDecisions ? '✅' : '❌'}</span>
                                <span>Tech decisions</span>
                              </div>
                              <div className={`flex items-center gap-1.5 p-2 rounded border text-[11px] font-semibold ${
                                diag.hasUsers ? 'bg-emerald-50/55 border-emerald-200 text-emerald-900' : 'bg-amber-50/30 border-amber-105 text-amber-900'
                              }`}>
                                <span>{diag.hasUsers ? '✅' : '❌'}</span>
                                <span>Users / Scale</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-center text-secondary py-0.5">
                            <span className="text-lg">↓</span>
                          </div>

                          <div className={`border p-4 rounded-xl text-left ${
                            projectItemSeverity === 'SEVERE' ? 'bg-error/5 border-error/10' :
                            projectItemSeverity === 'MODERATE' ? 'bg-accent/5 border-accent/15' :
                            'bg-success/5 border-success/15'
                          }`}>
                            <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${
                              projectItemSeverity === 'SEVERE' ? 'text-error' :
                              projectItemSeverity === 'MODERATE' ? 'text-accent' :
                              'text-success'
                            }`}>
                              {projectItemSeverity} CRITIQUE
                            </span>
                            <p className="font-heading font-bold italic text-[16px] text-primary leading-relaxed">
                              {item.explanation}
                            </p>
                          </div>

                          <div className="flex justify-center text-secondary py-0.5">
                            <span className="text-lg">↓</span>
                          </div>

                          <div className="p-4 rounded-xl border border-neutral-900 bg-white text-primary leading-relaxed relative flex flex-col gap-1.5 shadow-subtle mt-1.5">
                            <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-neutral-900 text-white rounded text-[9px] font-bold tracking-widest uppercase">
                              ✨ Recruiter's Rewrite
                            </span>
                            <p className="text-[14px] font-bold mt-1 leading-normal">
                              "{item.improved}"
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {currentSection === 'Experience' && (
                <div className="w-full flex flex-col gap-4">
                  <div className="bg-white rounded-xl border border-neutral-900 shadow-sm p-4 flex flex-col gap-3 text-left">
                    <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                      <h3 className="text-[18px] font-black text-primary uppercase">Experience Critique</h3>
                      {renderReactionBadge(getExperienceSeverity())}
                    </div>
                    
                    <div className={`p-4 rounded-xl border flex gap-3 ${
                      getExperienceSeverity() === 'SEVERE' ? 'bg-error/5 border-error/15' :
                      getExperienceSeverity() === 'MODERATE' ? 'bg-amber-50/70 border-amber-900/10' :
                      'bg-emerald-50/70 border-emerald-950/10'
                    }`}>
                      <span className="text-base flex-shrink-0">
                        {getExperienceSeverity() === 'SEVERE' ? '🔥' : getExperienceSeverity() === 'MODERATE' ? '⚠️' : '🟢'}
                      </span>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider block mb-1">Critique</span>
                        <p className="text-[14px] font-black text-primary leading-relaxed">{data.experience.critique}</p>
                      </div>
                    </div>
                  </div>

                  {data.experience.items.map((item, eIdx) => {
                    const tag = getBulletTag(item.original);
                    const expItemSeverity = tag.label.includes('Generic') ? 'SEVERE' : (tag.label.includes('Needs') ? 'MODERATE' : 'PRAISE');

                    return (
                      <div key={eIdx} className="bg-white rounded-xl border border-neutral-900 shadow-sm p-4 flex flex-col gap-4 text-left">
                        <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                          <span className="text-[14px] font-bold text-primary">Role Bullet #{eIdx + 1}</span>
                          <div className="flex gap-1.5">
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${tag.bg}`}>
                              {tag.label}
                            </span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                              expItemSeverity === 'SEVERE' ? 'bg-error/10 text-error' :
                              expItemSeverity === 'MODERATE' ? 'bg-warning/10 text-warning' :
                              'bg-success/15 text-success'
                            }`}>
                              {expItemSeverity}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex flex-col gap-1">
                            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block">Original Bullet</span>
                            <CollapsibleText text={item.original} />
                          </div>

                          <div className="flex justify-center text-secondary py-0.5">
                            <span className="text-lg">↓</span>
                          </div>

                          <div className={`border p-4 rounded-xl text-left ${
                            expItemSeverity === 'SEVERE' ? 'bg-error/5 border-error/10' :
                            expItemSeverity === 'MODERATE' ? 'bg-accent/5 border-accent/15' :
                            'bg-success/5 border-success/15'
                          }`}>
                            <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${
                              expItemSeverity === 'SEVERE' ? 'text-error' :
                              expItemSeverity === 'MODERATE' ? 'text-accent' :
                              'text-success'
                            }`}>
                              {expItemSeverity} OBSERVATION
                            </span>
                            <p className="font-heading font-bold italic text-[16px] text-primary leading-relaxed">
                              {item.explanation}
                            </p>
                          </div>

                          <div className="flex justify-center text-secondary py-0.5">
                            <span className="text-lg">↓</span>
                          </div>

                          <div className="p-4 rounded-xl border border-neutral-900 bg-white text-primary leading-relaxed relative flex flex-col gap-1.5 shadow-subtle mt-1.5">
                            <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-neutral-900 text-white rounded text-[9px] font-bold tracking-widest uppercase">
                              ✨ Recruiter's Rewrite
                            </span>
                            <p className="text-[14px] font-bold mt-1 leading-normal">
                              "{item.improved}"
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {currentSection === 'Achievements' && (
                <div className="w-full bg-white rounded-xl border border-neutral-900 shadow-sm p-4 flex flex-col gap-4 text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                    <h3 className="text-[18px] font-black text-primary uppercase">Achievements</h3>
                    {renderReactionBadge(getAchievementsSeverity())}
                  </div>

                  {getAchievementsSeverity() === 'PRAISE' ? (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-950/10 text-emerald-900 space-y-2 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🏆</span>
                        <h4 className="text-[14px] font-bold">PRAISE: Standout Details Detected</h4>
                      </div>
                      <p className="text-[12px] leading-relaxed">
                        The accomplishments mentioned here instantly catch a recruiter's eye. There is evidence of actual standout accolades or high-quality project outcomes. Keep these up front and center.
                      </p>
                    </div>
                  ) : getAchievementsSeverity() === 'MODERATE' ? (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-900/20 text-amber-900 space-y-2 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⚠️</span>
                        <h4 className="text-[14px] font-bold text-amber-955">MODERATE: Decent but weak</h4>
                      </div>
                      <p className="text-[12px] leading-relaxed">
                        Your accomplishments are acceptable, but they lack clear competitive context or exceptional performance indicators. Emphasize actual outcomes to elevate these to standouts.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-error/5 border border-error/15 text-error-950 space-y-2 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔥</span>
                        <h4 className="text-[14px] font-bold text-error">SEVERE: Participation Isn't Achievement</h4>
                      </div>
                      <p className="text-[12px] leading-relaxed">
                        Your milestones lack clear evidence of standout accolades or exceptional performance. Recruiter feedback: "We see many people who 'worked on' things, but very few who actually achieved standout results." Try to re-phrase your achievements to show competitive context or organizational scale.
                      </p>
                    </div>
                  )}

                  <div className="border border-neutral-200 rounded-xl bg-white p-4 space-y-3">
                    <span className="text-[12px] font-bold text-secondary uppercase tracking-widest block">Accolade Verification Guidelines</span>
                    <ul className="space-y-2.5">
                      <li className="flex gap-2 text-[12px] text-secondary leading-normal">
                        <span className="text-accent font-bold">•</span>
                        <span><strong>Avoid 'Vapor Accolades':</strong> Never list generic certificates (e.g. 'Completed SQL course') under achievements. High-performing resumes list raw competitive rankings, patents, or dollar/percentage savings.</span>
                      </li>
                      <li className="flex gap-2 text-[12px] text-secondary leading-normal">
                        <span className="text-accent font-bold">•</span>
                        <span><strong>Link to Evidence:</strong> If you built a project that had 5,000+ stars on GitHub or was used by a company, state the raw scale directly.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {currentSection === 'Verdict' && (
                <div className="w-full flex flex-col gap-4 text-left">
                  <div className="bg-white p-4 rounded-xl border border-neutral-900 shadow-sm space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                      <h4 className="text-[14px] font-bold text-primary uppercase tracking-wide">Recruiter Assessment</h4>
                      {renderReactionBadge(getVerdictSeverity())}
                    </div>
                    
                    <p className="font-heading font-bold italic text-[16px] text-primary leading-relaxed">
                      {data.score >= 85 
                        ? "Excellent structure and strong credentials. With minor tweaks to wording, you are ready to apply."
                        : data.score >= 70
                          ? "Reasonable base, but key impact indicators are missing. Fix the flagged items before submitting."
                          : "Critical issues found. A recruiter will likely skip this within 7 seconds. Extensive revision needed."
                      }
                    </p>
                    
                    <p className="text-[12px] text-secondary leading-relaxed">
                      {data.whatRecruitersThink.critique}
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-neutral-250 flex items-center gap-4 justify-between">
                    <div className="space-y-1">
                      <h4 className="text-[12px] font-bold text-secondary uppercase tracking-widest">Candidate Resume Score</h4>
                      <p className="text-[11px] text-secondary leading-normal">Formatting, keywords, and metric density scan.</p>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="relative w-12 h-12 rounded-full border-2 border-neutral-200 flex items-center justify-center font-black text-md text-primary bg-neutral-50 shadow-inner">
                        {data.score}
                      </div>
                      <div className="text-left">
                        <span className="text-[9px] font-bold text-secondary uppercase block">Verdict</span>
                        <span className="text-[12px] font-black text-primary">{scoreInfo.verdict}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="text-[12px] font-bold text-secondary uppercase tracking-widest">Top 3 Critical Fixes</h4>
                    <div className="flex flex-col gap-3">
                      {parsedFixes.slice(0, 3).map((fix, fIdx) => (
                        <div key={fIdx} className="p-4 rounded-xl border border-neutral-900 bg-white flex items-start gap-3 shadow-subtle">
                          <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-200 text-primary flex-shrink-0">
                            {fix.icon}
                          </div>
                          <div className="space-y-1.5 flex-grow">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                fix.action === 'REMOVE' ? 'bg-error/10 text-error' :
                                fix.action === 'ADD' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                              }`}>
                                {fix.action}
                              </span>
                              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${
                                fix.impact === 'HIGH' ? 'bg-error text-white' :
                                fix.impact === 'MEDIUM' ? 'bg-warning text-white' : 'bg-secondary text-white'
                              }`}>
                                {fix.impact} IMPACT
                              </span>
                            </div>
                            <p className="text-[12px] text-primary leading-normal font-medium">
                              {fix.explanation}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-center pt-2">
                    <button
                      onClick={handleFixResumeClick}
                      className="w-full h-12 bg-neutral-900 text-white hover:bg-neutral-800 text-[14px] font-bold uppercase tracking-wider rounded-xl shadow-subtle transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                    >
                      <span>Repair Resume Workshop</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'debate' && (
            <div className="w-full flex flex-col gap-5 pb-24 text-left">
              
              {/* Debate Recruiter Chat widget */}
              <div className="w-full bg-white p-4 rounded-xl border border-neutral-900 shadow-sm flex flex-col gap-4">
                <div className="space-y-1">
                  <h3 className="text-[16px] font-black text-primary flex items-center gap-2">
                    <span className="w-2 h-3.5 rounded bg-accent" />
                    Debate the Recruiter
                  </h3>
                  <p className="text-[12px] text-secondary">
                    Argue your score, justify projects, or ask how to fix specific details.
                  </p>
                </div>

                <div className="border border-neutral-900 rounded-xl bg-neutral-50/50 p-3 h-[320px] overflow-y-auto flex flex-col gap-3 relative scrollbar-none text-left">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4 text-secondary space-y-1.5">
                      <span className="text-xl">💬</span>
                      <p className="text-[12px] font-bold">Conversation started.</p>
                      <p className="text-[11px] max-w-[200px]">Ask a question or pick a prompt below.</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex gap-2.5 max-w-[88%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-6.5 h-6.5 rounded-full bg-neutral-900 border border-neutral-900 flex items-center justify-center font-bold text-[9px] text-white flex-shrink-0">
                            ✍️
                          </div>
                        )}
                        <div
                          className={`p-3 rounded-xl border text-[12px] leading-relaxed shadow-sm ${
                            msg.role === 'user'
                              ? 'bg-white border-neutral-900 text-primary rounded-tr-none'
                              : 'bg-neutral-950 border-neutral-950 text-white rounded-tl-none font-medium'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}

                  {isLoadingChat && (
                    <div className="flex gap-2.5 self-start items-center max-w-[88%] animate-pulse">
                      <div className="w-6.5 h-6.5 rounded-full bg-neutral-900 flex items-center justify-center font-bold text-[9px] text-white flex-shrink-0 animate-spin">
                        ⏳
                      </div>
                      <div className="p-3 bg-neutral-900/10 border border-dashed border-neutral-300 text-secondary text-[11px] rounded-xl rounded-tl-none">
                        {typingMessage}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="flex flex-row gap-2 overflow-x-auto pb-2 scrollbar-none flex-nowrap">
                  {presetQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      disabled={isLoadingChat}
                      onClick={() => handleSendPreset(q)}
                      className="text-[11px] font-bold px-3 py-2 rounded-full border border-neutral-200 hover:border-neutral-900 bg-white text-secondary hover:text-primary transition-all disabled:opacity-50 flex-shrink-0 cursor-pointer active:scale-[0.98]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Upgrade Stacked */}
              <div className="bg-white p-4 rounded-xl border border-neutral-900 shadow-sm space-y-4">
                <h3 className="text-[16px] font-bold text-primary flex items-center gap-2">
                  <span className="w-2 h-3.5 bg-success rounded-sm" />
                  Summary Upgrade
                </h3>
                <div className="flex flex-col gap-3">
                  <div className="border border-error bg-error/5 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-error uppercase bg-error/10 border border-error/20 px-1.5 py-0.5 rounded tracking-wider self-start">Original</span>
                      <p className="text-[12px] text-secondary mt-2.5 leading-relaxed italic">
                        "{data.improvedSummary.original}"
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-center text-secondary py-1">
                    <span className="text-lg">↓</span>
                  </div>

                  <div className="border border-success bg-success/5 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-success uppercase bg-success/10 border border-success/20 px-1.5 py-0.5 rounded tracking-wider self-start">Improved</span>
                      <p className="text-[12px] text-primary font-bold mt-2.5 leading-relaxed">
                        "{data.improvedSummary.improved}"
                      </p>
                    </div>
                    <div className="text-[11px] text-secondary mt-2.5 pt-2 border-t border-success/10">
                      <span className="font-extrabold text-success">Why:</span> {data.improvedSummary.explanation}
                    </div>
                  </div>
                </div>
              </div>

              {/* Upgrades Carousel */}
              <div className="bg-white p-4 rounded-xl border border-neutral-900 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[16px] font-bold text-primary flex items-center gap-2">
                    <span className="w-2 h-3.5 bg-success rounded-sm" />
                    Bullet Upgrade Carousel
                  </h3>
                  <span className="text-[11px] text-secondary font-semibold">Swipe cards →</span>
                </div>
                
                <div className="flex flex-row overflow-x-auto snap-x snap-mandatory flex-nowrap gap-4 pb-2 scrollbar-none">
                  {[...data.experience.items, ...data.projects.items].map((item, idx) => (
                    <div key={idx} className="flex-shrink-0 w-[82vw] snap-center border border-neutral-900 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="px-4 py-2 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
                          <span className="text-[11px] font-extrabold text-primary">Upgrade #{idx + 1}</span>
                        </div>

                        <div className="flex flex-col">
                          <div className="p-4 bg-error/5 flex flex-col justify-center border-b border-neutral-100 text-left">
                            <span className="text-[9px] font-bold text-error uppercase bg-error/10 border border-error/20 px-1.5 py-0.5 rounded tracking-wider self-start">Original</span>
                            <p className="text-[12px] text-secondary mt-2 leading-relaxed">
                              "{item.original}"
                            </p>
                          </div>

                          <div className="p-4 bg-success/5 flex flex-col justify-center text-left">
                            <span className="text-[9px] font-bold text-success uppercase bg-success/10 border border-success/20 px-1.5 py-0.5 rounded tracking-wider self-start">Rewrite</span>
                            <p className="text-[12px] text-primary font-bold mt-2 leading-relaxed">
                              "{item.improved}"
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-neutral-50 border-t border-neutral-200 text-[11px] text-secondary flex items-start gap-1.5 leading-relaxed text-left">
                        <CornerDownRight className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-extrabold text-primary">Why:</span> {item.explanation}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formatting Directives */}
              <div className="bg-white p-4 rounded-xl border border-neutral-900 shadow-sm space-y-4">
                <h3 className="text-[16px] font-bold text-primary flex items-center gap-2">
                  <span className="w-2 h-3.5 bg-success rounded-sm" />
                  Formatting Directives
                </h3>
                <ul className="flex flex-col gap-3 pl-1">
                  <li className="flex items-start gap-2 text-[12px] text-secondary">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <span>Stick to a single-column layout. Two columns look nice but break older ATS readers completely.</span>
                  </li>
                  <li className="flex items-start gap-2 text-[12px] text-secondary">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <span>Use standard fonts (Inter, Arial, Georgia, Calibri). Custom fonts sometimes scan as garbage text.</span>
                  </li>
                  <li className="flex items-start gap-2 text-[12px] text-secondary">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <span>Use simple headers: 'Work Experience', 'Projects', 'Skills'. Avoid creative section names.</span>
                  </li>
                  <li className="flex items-start gap-2 text-[12px] text-secondary">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <span>Ensure your contact info is actual text, not embedded inside a graphic image.</span>
                  </li>
                </ul>
              </div>

              {/* Floating/Sticky Debate Input */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-neutral-200 z-45 flex justify-center shadow-lg">
                <form onSubmit={handleSendMessage} className="w-full max-w-md flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Argue your case..."
                    disabled={isLoadingChat}
                    className="flex-grow h-12 px-3 bg-white border border-neutral-900 rounded-xl text-[14px] text-primary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 placeholder:text-neutral-400"
                  />
                  <button
                    type="submit"
                    disabled={isLoadingChat || !chatInput.trim()}
                    className="h-12 px-5 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl transition-all shadow-subtle border border-primary flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                  >
                    Send
                  </button>
                </form>
              </div>

            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1500px] mx-auto px-10 py-4 text-left">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end mb-12 border-b border-neutral-900 pb-4">
        <div className="space-y-0.5">
          <h1 className="font-heading font-extrabold text-2xl tracking-tight text-primary">Resume Roast</h1>
          <p className="text-sm font-medium text-accent">Recruiter-grade criticism.</p>
        </div>
        <button
          onClick={onResumeUpload}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-primary hover:text-accent transition-all border border-neutral-900 hover:border-neutral-900 bg-white rounded-medium shadow-subtle cursor-pointer"
        >
          New Victim →
        </button>
      </div>

      {/* TAB BAR NAVIGATION */}
      <div className="flex justify-center sm:justify-start border-b border-neutral-200 mb-8 pb-1">
        <div className="flex p-1 bg-neutral-100/80 rounded-large border border-neutral-200 gap-1.5 shadow-inner">
          {(['overview', 'heatmap', 'debate'] as const).map((tab) => {
            const label = tab === 'overview' ? 'Overview' : (tab === 'heatmap' ? 'Roast Receipts' : 'Debate & Rehab');
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-5 text-xs font-black uppercase tracking-wider relative transition-all duration-200 rounded-medium cursor-pointer flex items-center gap-2 ${
                  isActive 
                    ? 'text-white bg-neutral-900 shadow-subtle scale-[1.02]' 
                    : 'text-secondary hover:text-primary hover:bg-neutral-200/50'
                }`}
              >
                {label}
                {tab === 'heatmap' && (
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                    isActive ? 'bg-accent text-white' : 'bg-error text-white animate-pulse'
                  }`}>
                    {data.topFixes.length} Flaws 🔥
                  </span>
                )}
                {tab === 'debate' && (
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full transition-colors ${
                    isActive ? 'bg-neutral-800 text-neutral-100' : 'bg-neutral-200 text-neutral-800'
                  }`}>
                    Rehab
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview-top"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="w-full"
          >
            {/* TOP GRID: Score Card & Damage Report */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 mb-12">
        
        {/* Score Card (Subtle Dark Texture, High-Contrast) */}
        <div className="lg:col-span-3 bg-neutral-900 text-bg p-8 rounded-large border-2 border-neutral-900 shadow-subtle flex flex-col items-center justify-between text-center min-h-[420px] relative overflow-hidden">
          {/* Subtle noise pattern inside card */}
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#FAF9F6_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <div className="w-full relative z-10">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-4">Final Score</span>
            
            {/* Circular Ring and Large Stacked Score */}
            <div className="relative w-40 h-40 mx-auto flex items-center justify-center mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="72"
                  className="stroke-neutral-800 fill-none"
                  strokeWidth="2"
                />
                <motion.circle
                  cx="80"
                  cy="80"
                  r="72"
                  className="stroke-accent fill-none"
                  strokeWidth="3.5"
                  strokeDasharray={452}
                  initial={{ strokeDashoffset: 452 }}
                  animate={{ strokeDashoffset: 452 - (452 * data.score) / 100 }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center leading-none">
                <span className="text-6xl font-black text-white tracking-tighter">{data.score}</span>
                <span className="text-[11px] font-bold text-neutral-400 mt-1 border-t border-neutral-800 pt-1">/ 100</span>
              </div>
            </div>

            <h2 className="text-lg font-bold text-white tracking-tight mb-2">
              {scoreInfo.verdict}
            </h2>
            
            <p className="text-[10px] text-neutral-400 italic block mb-4">
              {scoreInfo.caption}
            </p>
            
            {/* Recruiter Mood */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-300">
              <span className="text-neutral-400">Recruiter mood:</span>
              <span className="text-white font-bold">{scoreInfo.mood}</span>
            </div>

            {/* Diagnostics counters */}
            <div className="w-full mt-4 pt-4 border-t border-neutral-800 text-left space-y-2">
              <span className="text-[9px] font-black text-neutral-400 uppercase tracking-wider block">Session Diagnostics</span>
              <div className="flex justify-between items-center text-xs text-neutral-300">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-error" /> ATS Alerts:</span>
                <span className="font-extrabold text-white">{data.atsCompatibility.issues.length}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-neutral-300">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-warning" /> Weak Spots:</span>
                <span className="font-extrabold text-white">{data.topFixes.length}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="w-full space-y-2 mt-6 relative z-10">
            <button
              onClick={handleFixResumeClick}
              className="w-full py-3 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-medium transition-all shadow-subtle flex items-center justify-center gap-2 cursor-pointer border border-accent"
            >
              <Sparkles className="w-4 h-4" />
              Repair Resume
            </button>
            <button
              onClick={handleShowReceiptsClick}
              className="w-full py-3 bg-white text-neutral-900 hover:bg-neutral-900 hover:text-white text-xs font-black uppercase tracking-wider rounded-medium transition-all border-2 border-neutral-900 shadow-subtle flex items-center justify-center gap-1 cursor-pointer"
            >
              Inspect Roast Receipts →
            </button>
          </div>
        </div>

        {/* Right Column: Recruiter Session Details (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
           
           {/* Recruiter Reaction Card */}
           <div className="bg-white p-8 rounded-large border border-neutral-900 shadow-subtle relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-8 min-h-[190px] text-left">
              {/* Stamp overlay */}
              <div className="absolute right-[5%] top-[15%] pointer-events-none rotate-[-8deg] z-10 opacity-90 select-none">
                <div className={`stamp-active font-heading font-black text-2xl tracking-widest px-4 py-1.5 border-4 rounded uppercase text-center ${scoreInfo.stampColor}`}>
                  {scoreInfo.stamp}
                </div>
              </div>
              <div className="max-w-2xl relative z-10">
                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-3">Recruiter Reaction</span>
                <blockquote className="text-lg sm:text-xl font-extrabold text-primary tracking-tight leading-relaxed italic mb-4">
                  "{data.whatRecruitersThink.quote || 'Your resume says everything except why you\'re useful.'}"
                </blockquote>
                <div className="flex flex-wrap gap-6 pt-3 border-t border-neutral-200">
                  <div>
                    <span className="text-[9px] font-bold text-secondary uppercase block">Scan Time</span>
                    <span className="text-base font-black text-primary">
                      {data.score < 50 ? "2.4s" : (data.score < 75 ? "4.1s" : "6.8s")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-secondary uppercase block">Memory Score</span>
                    <span className="text-base font-black text-primary">
                      {Math.max(8, data.score - 45)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-secondary uppercase block">Interview Odds</span>
                    <span className={`text-base font-black ${
                      data.score < 50 ? 'text-error' : (data.score < 75 ? 'text-warning' : 'text-success')
                    }`}>
                      {data.score < 50 ? "Terrible" : (data.score < 75 ? "Maybe" : "High")}
                    </span>
                  </div>
                </div>
              </div>
           </div>

           {/* Recruiter Session Notes */}
           <div className="bg-white p-8 rounded-large border-2 border-neutral-900 border-l-[12px] border-l-accent shadow-subtle space-y-4">
             <h3 className="text-lg font-black text-primary uppercase tracking-tight text-left">
               Session Roasting Notes
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className={`p-5 rounded-medium border-2 space-y-2 text-left transition-all ${
                 data.firstImpression.severity === 'success' ? 'bg-success/[0.04] border-success/40 shadow-[0_0_10px_rgba(16,185,129,0.03)]' :
                 data.firstImpression.severity === 'warning' ? 'bg-warning/[0.04] border-warning/40 shadow-[0_0_10px_rgba(245,158,11,0.03)]' :
                 'bg-error/[0.04] border-error/40 shadow-[0_0_10px_rgba(239,68,68,0.03)]'
               }`}>
                 <div className="flex items-center gap-2">
                   <span className="text-xs font-black text-primary uppercase tracking-wider">First Impression</span>
                   <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                     data.firstImpression.severity === 'success' ? 'bg-success/20 text-success border-2 border-success/30' :
                     data.firstImpression.severity === 'warning' ? 'bg-warning/20 text-warning border-2 border-warning/30' :
                     'bg-error/20 text-error border-2 border-error/30'
                   }`}>
                     {data.firstImpression.severity}
                   </span>
                 </div>
                 <p className="text-sm sm:text-base font-black text-neutral-900 leading-relaxed italic">
                   "{data.firstImpression.critique}"
                 </p>
               </div>

               <div className="p-5 rounded-medium border-2 border-accent/40 bg-accent/[0.04] shadow-[0_0_10px_rgba(237,98,44,0.03)] space-y-2 text-left transition-all">
                 <span className="text-xs font-black text-primary uppercase tracking-wider block">Recruiter Mindset</span>
                 <p className="text-sm sm:text-base font-black text-neutral-900 leading-relaxed italic">
                   "{data.whatRecruitersThink.critique}"
                 </p>
               </div>
             </div>
           </div>

           {/* Recruiter Speedrun */}
           <div className="bg-white p-8 rounded-large border border-neutral-900 shadow-subtle text-left">
             <h3 className="text-base font-black text-primary flex items-center gap-2 mb-8">
               <span className="w-2.5 h-4 bg-accent rounded-sm" />
               Recruiter Speedrun
             </h3>
             
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
               <div className="hidden md:block absolute top-[18px] left-[6%] right-[6%] h-0.5 bg-neutral-200 -z-10" />

               {/* 0s */}
               <div className="flex md:flex-col items-start gap-4 md:gap-0">
                 <div className="w-9 h-9 rounded-full bg-success/15 text-success flex items-center justify-center font-extrabold text-xs border border-success md:mb-4 flex-shrink-0">
                   ✓
                 </div>
                 <div>
                   <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">0 Seconds</span>
                   <h4 className="text-sm font-bold text-primary">Saw title</h4>
                   <p className="text-[11px] text-secondary leading-normal">Categorized candidate.</p>
                 </div>
               </div>

               {/* 2s */}
               <div className="flex md:flex-col items-start gap-4 md:gap-0">
                 <div className="w-9 h-9 rounded-full bg-error/15 text-error flex items-center justify-center font-extrabold text-xs border border-error md:mb-4 flex-shrink-0">
                   ✗
                 </div>
                 <div>
                   <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">2 Seconds</span>
                   <h4 className="text-sm font-bold text-primary text-error">Skipped summary</h4>
                   <p className="text-[11px] text-secondary leading-normal">Lost immediate attention.</p>
                 </div>
               </div>

               {/* 4s */}
               <div className="flex md:flex-col items-start gap-4 md:gap-0">
                 <div className="w-9 h-9 rounded-full bg-success/15 text-success flex items-center justify-center font-extrabold text-xs border border-success md:mb-4 flex-shrink-0">
                   ✓
                 </div>
                 <div>
                   <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">4 Seconds</span>
                   <h4 className="text-sm font-bold text-primary">Read core stack</h4>
                   <p className="text-[11px] text-secondary leading-normal">Identified raw skills.</p>
                 </div>
               </div>

               {/* 7s */}
               <div className="flex md:flex-col items-start gap-4 md:gap-0">
                 <div className="w-9 h-9 rounded-full bg-error/15 text-error flex items-center justify-center font-extrabold text-xs border border-error md:mb-4 flex-shrink-0">
                   ✗
                 </div>
                 <div>
                   <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">7 Seconds</span>
                   <h4 className="text-sm font-bold text-primary text-error">Tab closed</h4>
                   <p className="text-[11px] text-secondary leading-normal">Failed to seal follow-up.</p>
                 </div>
               </div>
             </div>
           </div>

            {/* Section Critique CTA Banner */}
            <motion.div 
              whileHover={{ y: -2 }}
              onClick={() => setActiveTab('heatmap')}
              className="bg-neutral-900 text-white p-8 rounded-large border-2 border-neutral-900 shadow-subtle flex flex-col md:flex-row justify-between items-start md:items-center gap-6 cursor-pointer group transition-all relative overflow-hidden text-left"
            >
              {/* Background soft orange light effect */}
              <div className="absolute right-0 top-0 w-64 h-64 bg-accent/15 rounded-full blur-3xl -z-10" />
              
              <div className="space-y-1.5 text-left max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-accent uppercase tracking-widest block bg-accent/20 px-2 py-0.5 rounded">Margin Notes Ready</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping" />
                </div>
                <h3 className="text-lg font-black tracking-tight text-white uppercase">Inspect Section-by-Section Critique</h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  We annotated your resume exactly like a recruiter. See which bullet points are generic, which skills you must scrap, and read the brutal section-by-section breakdown.
                </p>
              </div>
              
              <div className="flex-shrink-0 w-full md:w-auto">
                <span className="inline-flex items-center justify-center gap-1.5 px-5 py-3 text-xs font-black uppercase tracking-wider text-neutral-900 bg-white hover:bg-neutral-100 rounded-medium shadow-sm transition-all group-hover:translate-x-1.5">
                  View Margin Notes →
                </span>
              </div>
            </motion.div>
         </div>

      </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* MIDDLE GRID: Section-by-Section Review vertical timeline */}
      <AnimatePresence mode="wait">
        {activeTab === 'heatmap' && (
          <motion.div
            key="heatmap-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-[900px] mx-auto"
          >
            {/* Header and Subtitle */}
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl font-black text-primary tracking-tight">Your Resume Under Review</h2>
              <p className="text-sm text-secondary font-medium">We highlighted what works. We roasted what doesn't.</p>
            </div>

            {/* Horizontal progress navigation track */}
            <div className="flex justify-center mb-10">
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 bg-neutral-100/50 p-2 rounded-full border border-neutral-200 shadow-subtle max-w-full overflow-x-auto">
                {sectionsList.map((section, idx) => {
                  const isActive = activeSection === section;
                  const isPast = sectionsList.indexOf(activeSection) >= idx;
                  return (
                    <React.Fragment key={section}>
                      {idx > 0 && <span className="text-neutral-300 text-xs font-bold select-none">→</span>}
                      <button
                        onClick={() => handleProgressClick(section)}
                        className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-250 py-1 px-3 rounded-full cursor-pointer whitespace-nowrap focus:outline-none ${
                          isActive 
                            ? 'bg-neutral-900 text-white shadow-sm scale-105' 
                            : isPast 
                              ? 'text-primary hover:text-accent' 
                              : 'text-secondary hover:text-primary'
                        }`}
                      >
                        {section}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Vertical timeline connected by dashed line */}
            <div className="relative border-l border-dashed border-neutral-300 ml-6 pl-10 space-y-8 py-2">
              {sectionsList.map((section, idx) => {
                const isActive = activeSection === section;
                
                // Get matching icon, title, badge, and content for each section
                let icon = <Eye className="w-4.5 h-4.5" />;
                let title = "";
                let badge = null;
                let content = null;

                if (section === 'Summary') {
                  const severity = getSummarySeverity();
                  icon = <Eye className="w-4.5 h-4.5" />;
                  title = "Summary & Pitch";
                  badge = renderReactionBadge(severity);
                  
                  content = (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">Original Text</span>
                        <div className="p-4 rounded-medium border border-neutral-200 bg-white/70 text-xs italic text-secondary leading-relaxed">
                          "{summaryText}"
                        </div>
                      </div>

                      <div className={`p-4 rounded-medium border flex gap-3 ${
                        severity === 'SEVERE' ? 'bg-error/5 border-error/15' :
                        severity === 'MODERATE' ? 'bg-amber-50/70 border-amber-900/10' :
                        'bg-emerald-50/70 border-emerald-950/10'
                      }`}>
                        <span className="text-base flex-shrink-0">
                          {severity === 'SEVERE' ? '🔥' : severity === 'MODERATE' ? '⚠️' : '🟢'}
                        </span>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">
                            {severity} Recruiter Reaction
                          </span>
                          <p className="font-heading font-bold italic text-lg sm:text-xl text-primary leading-relaxed">
                            {summaryExplanation}
                          </p>
                        </div>
                      </div>

                      {data.improvedSummary.improved && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">Recruiter-Approved Alternative</span>
                          <div className="p-4 rounded-medium border border-neutral-900 bg-white text-xs font-semibold text-primary leading-relaxed relative">
                            <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-neutral-900 text-white rounded text-[8px] font-bold tracking-widest uppercase">
                              ✨ Re-pitched Pitch
                            </span>
                            "{data.improvedSummary.improved}"
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } 
                else if (section === 'Skills') {
                  const severity = getSkillsSeverity();
                  icon = <Cpu className="w-4.5 h-4.5" />;
                  title = "Skills & Utility";
                  badge = renderReactionBadge(severity);
                  
                  content = (
                    <div className="space-y-5">
                      <div className={`p-4 rounded-medium border flex gap-3 ${
                        severity === 'SEVERE' ? 'bg-error/5 border-error/15' :
                        severity === 'MODERATE' ? 'bg-amber-50/70 border-amber-900/10' :
                        'bg-emerald-50/70 border-emerald-950/10'
                      }`}>
                        <span className="text-base flex-shrink-0">
                          {severity === 'SEVERE' ? '🔥' : severity === 'MODERATE' ? '⚠️' : '🟢'}
                        </span>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">
                            {severity} Critique
                          </span>
                          <p className="text-sm font-black text-primary leading-relaxed">{data.skills.critique || "Filter general office utilities and list core engineering frameworks."}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-neutral-200 rounded-medium bg-white p-4 space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                            <span className="text-emerald-600">✅</span>
                            <span className="text-xs font-bold text-primary uppercase tracking-wider">Keep & Highlight</span>
                          </div>
                          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                            {data.skills.items.filter(s => s.rating >= 3).length > 0 ? (
                              data.skills.items.filter(s => s.rating >= 3).map((skill, sIdx) => (
                                <div key={sIdx} className="p-2 rounded bg-emerald-50/30 border border-emerald-100/60 text-left">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-emerald-950">{skill.name}</span>
                                    <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100/50 px-1.5 py-0.5 rounded">{skill.rating}/5</span>
                                  </div>
                                  {skill.comment && <p className="text-[10px] text-emerald-800/80 mt-1">{skill.comment}</p>}
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-secondary italic">No high-rated skills detected.</p>
                            )}
                          </div>
                        </div>

                        <div className="border border-neutral-200 rounded-medium bg-white p-4 space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                            <span className="text-error">❌</span>
                            <span className="text-xs font-bold text-primary uppercase tracking-wider">Scrap or De-emphasize</span>
                          </div>
                          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                            {data.skills.items.filter(s => s.rating < 3).length > 0 ? (
                              data.skills.items.filter(s => s.rating < 3).map((skill, sIdx) => (
                                <div key={sIdx} className="p-2 rounded bg-amber-50/40 border border-amber-100/60 text-left">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-amber-955">{skill.name}</span>
                                    <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100/50 px-1.5 py-0.5 rounded">{skill.rating}/5</span>
                                  </div>
                                  {skill.comment && <p className="text-[10px] text-amber-800/80 mt-1">{skill.comment}</p>}
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-secondary italic">No weak skills flagged to scrap.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } 
                else if (section === 'Projects') {
                  const severity = getProjectsSeverity();
                  icon = <FolderGit2 className="w-4.5 h-4.5" />;
                  title = "Projects & Proof of Work";
                  badge = renderReactionBadge(severity);
                  
                  content = (
                    <div className="space-y-6">
                      <div className={`p-4 rounded-medium border flex gap-3 ${
                        severity === 'SEVERE' ? 'bg-error/5 border-error/15' :
                        severity === 'MODERATE' ? 'bg-amber-50/70 border-amber-900/10' :
                        'bg-emerald-50/70 border-emerald-950/10'
                      }`}>
                        <span className="text-base flex-shrink-0">
                          {severity === 'SEVERE' ? '🔥' : severity === 'MODERATE' ? '⚠️' : '🟢'}
                        </span>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">
                            {severity} Critique
                          </span>
                          <p className="text-sm font-black text-primary leading-relaxed">{data.projects.critique}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {data.projects.items.map((item, pIdx) => {
                          const diag = checkProjectDiagnostics(item.original);
                          const scoreProj = (diag.hasMetrics ? 1 : 0) + (diag.hasImpact ? 1 : 0) + (diag.hasTechDecisions ? 1 : 0) + (diag.hasUsers ? 1 : 0);
                          const projectItemSeverity = scoreProj < 2 ? 'SEVERE' : (scoreProj < 3 ? 'MODERATE' : 'PRAISE');

                          return (
                            <div key={pIdx} className="border border-neutral-200 rounded-medium bg-white overflow-hidden text-left">
                              <div className="bg-neutral-50 px-4 py-2.5 border-b border-neutral-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-primary">Project #{pIdx + 1}</span>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                  projectItemSeverity === 'SEVERE' ? 'bg-error/10 text-error' :
                                  projectItemSeverity === 'MODERATE' ? 'bg-warning/10 text-warning' :
                                  'bg-success/15 text-success'
                                }`}>
                                  {projectItemSeverity}
                                </span>
                              </div>

                              <div className="p-4 space-y-4">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-secondary uppercase tracking-wider block">Original text</span>
                                  <p className="text-xs italic text-secondary leading-relaxed">"{item.original}"</p>
                                </div>

                                <div className="space-y-1.5">
                                  <span className="text-[9px] font-bold text-secondary uppercase tracking-wider block">Diagnostics Checklist</span>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                    <div className={`flex items-center gap-1.5 p-1.5 rounded border text-[10px] font-semibold ${
                                      diag.hasMetrics ? 'bg-emerald-50/55 border-emerald-200 text-emerald-900' : 'bg-amber-50/30 border-amber-100 text-amber-900'
                                    }`}>
                                      <span>{diag.hasMetrics ? '✅' : '❌'}</span>
                                      <span>Metrics</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 p-1.5 rounded border text-[10px] font-semibold ${
                                      diag.hasImpact ? 'bg-emerald-50/55 border-emerald-200 text-emerald-900' : 'bg-amber-50/30 border-amber-100 text-amber-900'
                                    }`}>
                                      <span>{diag.hasImpact ? '✅' : '❌'}</span>
                                      <span>Impact</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 p-1.5 rounded border text-[10px] font-semibold ${
                                      diag.hasTechDecisions ? 'bg-emerald-50/55 border-emerald-200 text-emerald-900' : 'bg-amber-50/30 border-amber-100 text-amber-900'
                                    }`}>
                                      <span>{diag.hasTechDecisions ? '✅' : '❌'}</span>
                                      <span>Tech decisions</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 p-1.5 rounded border text-[10px] font-semibold ${
                                      diag.hasUsers ? 'bg-emerald-50/55 border-emerald-200 text-emerald-900' : 'bg-amber-50/30 border-amber-100 text-amber-900'
                                    }`}>
                                      <span>{diag.hasUsers ? '✅' : '❌'}</span>
                                      <span>Users / Scale</span>
                                    </div>
                                  </div>
                                </div>

                                <div className={`border p-3 rounded text-left ${
                                  projectItemSeverity === 'SEVERE' ? 'bg-error/5 border-error/10' :
                                  projectItemSeverity === 'MODERATE' ? 'bg-accent/5 border-accent/15' :
                                  'bg-success/5 border-success/15'
                                }`}>
                                  <span className={`text-[9px] font-bold uppercase tracking-wider block mb-1 ${
                                    projectItemSeverity === 'SEVERE' ? 'text-error' :
                                    projectItemSeverity === 'MODERATE' ? 'text-accent' :
                                    'text-success'
                                  }`}>
                                    {projectItemSeverity} CRITIQUE
                                  </span>
                                  <p className="font-heading font-bold italic text-base sm:text-lg text-primary leading-relaxed">
                                    {item.explanation}
                                  </p>
                                </div>

                                <div className="space-y-1 bg-emerald-50/10 border border-emerald-600/10 p-3.5 rounded-medium">
                                  <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest block">Recruiter's rewrite recommendation</span>
                                  <p className="text-xs font-semibold text-emerald-950 mt-1 leading-normal">"{item.improved}"</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                } 
                else if (section === 'Experience') {
                  const severity = getExperienceSeverity();
                  icon = <Briefcase className="w-4.5 h-4.5" />;
                  title = "Experience & Impact";
                  badge = renderReactionBadge(severity);
                  
                  content = (
                    <div className="space-y-6">
                      <div className={`p-4 rounded-medium border flex gap-3 ${
                        severity === 'SEVERE' ? 'bg-error/5 border-error/15' :
                        severity === 'MODERATE' ? 'bg-amber-50/70 border-amber-900/10' :
                        'bg-emerald-50/70 border-emerald-950/10'
                      }`}>
                        <span className="text-base flex-shrink-0">
                          {severity === 'SEVERE' ? '🔥' : severity === 'MODERATE' ? '⚠️' : '🟢'}
                        </span>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">
                            {severity} Critique
                          </span>
                          <p className="text-sm font-black text-primary leading-relaxed">{data.experience.critique}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {data.experience.items.map((item, eIdx) => {
                          const tag = getBulletTag(item.original);
                          const expItemSeverity = tag.label.includes('Generic') ? 'SEVERE' : (tag.label.includes('Needs') ? 'MODERATE' : 'PRAISE');

                          return (
                            <div key={eIdx} className="border border-neutral-200 rounded-medium bg-white overflow-hidden text-left">
                              <div className="bg-neutral-50 px-4 py-2.5 border-b border-neutral-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-primary">Role Bullet #{eIdx + 1}</span>
                                <div className="flex gap-2">
                                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${tag.bg}`}>
                                    {tag.label}
                                  </span>
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                    expItemSeverity === 'SEVERE' ? 'bg-error/10 text-error' :
                                    expItemSeverity === 'MODERATE' ? 'bg-warning/10 text-warning' :
                                    'bg-success/15 text-success'
                                  }`}>
                                    {expItemSeverity}
                                  </span>
                                </div>
                              </div>

                              <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-secondary uppercase tracking-wider block">Original Bullet</span>
                                    <div className="p-3 bg-neutral-50/20 border border-neutral-200 text-xs italic text-secondary leading-relaxed rounded">
                                      "{item.original}"
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-secondary uppercase tracking-wider block">Recruiter Critique</span>
                                    <div className={`p-3 border rounded ${
                                      expItemSeverity === 'SEVERE' ? 'bg-error/5 border-error/10' :
                                      expItemSeverity === 'MODERATE' ? 'bg-accent/5 border-accent/15' :
                                      'bg-success/5 border-success/15'
                                    }`}>
                                      <span className={`text-[9px] font-bold uppercase block mb-1 ${
                                        expItemSeverity === 'SEVERE' ? 'text-error' :
                                        expItemSeverity === 'MODERATE' ? 'text-accent' :
                                        'text-success'
                                      }`}>
                                        {expItemSeverity} OBSERVATION:
                                      </span>
                                      <p className="font-heading font-bold italic text-base sm:text-lg text-primary leading-relaxed">
                                        {item.explanation}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1 bg-emerald-50/10 border border-emerald-600/10 p-3.5 rounded-medium">
                                  <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest block">Recruiter's rewrite recommendation</span>
                                  <p className="text-xs font-semibold text-emerald-950 mt-1 leading-normal">"{item.improved}"</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                } 
                else if (section === 'Achievements') {
                  const severity = getAchievementsSeverity();
                  icon = <Award className="w-4.5 h-4.5" />;
                  title = "Achievements & Accolades";
                  badge = renderReactionBadge(severity);
                  
                  content = (
                    <div className="space-y-4">
                      {severity === 'PRAISE' ? (
                        <div className="p-5 rounded-medium bg-emerald-50 border border-emerald-950/10 text-emerald-900 space-y-2 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🏆</span>
                            <h4 className="text-sm font-bold">PRAISE: Standout Details Detected</h4>
                          </div>
                          <p className="text-xs leading-relaxed">
                            The accomplishments mentioned here instantly catch a recruiter's eye. There is evidence of actual standout accolades or high-quality project outcomes. Keep these up front and center.
                          </p>
                        </div>
                      ) : severity === 'MODERATE' ? (
                        <div className="p-5 rounded-medium bg-amber-50 border border-amber-900/20 text-amber-900 space-y-2 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">⚠️</span>
                            <h4 className="text-sm font-bold text-amber-955">MODERATE: Decent but weak</h4>
                          </div>
                          <p className="text-xs leading-relaxed">
                            Your accomplishments are acceptable, but they lack clear competitive context or exceptional performance indicators. Emphasize actual outcomes to elevate these to standouts.
                          </p>
                        </div>
                      ) : (
                        <div className="p-5 rounded-medium bg-error/5 border border-error/15 text-error-950 space-y-2 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🔥</span>
                            <h4 className="text-sm font-bold text-error">SEVERE: Participation Isn't Achievement</h4>
                          </div>
                          <p className="text-xs leading-relaxed">
                            Your milestones lack clear evidence of standout accolades or exceptional performance. Recruiter feedback: "We see many people who 'worked on' things, but very few who actually achieved standout results." Try to re-phrase your achievements to show competitive context or organizational scale.
                          </p>
                        </div>
                      )}

                      <div className="border border-neutral-200 rounded-medium bg-white p-4 space-y-3">
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">Accolade Verification Guidelines</span>
                        <ul className="space-y-2">
                          <li className="flex gap-2 text-xs text-secondary leading-normal">
                            <span className="text-accent font-bold">•</span>
                            <span><strong>Avoid 'Vapor Accolades':</strong> Never list generic certificates (e.g. 'Completed SQL course') under achievements. High-performing resumes list raw competitive rankings, patents, or dollar/percentage savings.</span>
                          </li>
                          <li className="flex gap-2 text-xs text-secondary leading-normal">
                            <span className="text-accent font-bold">•</span>
                            <span><strong>Link to Evidence:</strong> If you built a project that had 5,000+ stars on GitHub or was used by a company, state the raw scale directly.</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  );
                } 
                else if (section === 'Verdict') {
                  const severity = getVerdictSeverity();
                  icon = <CheckCircle2 className="w-4.5 h-4.5" />;
                  title = "Recruiter's Final Verdict";
                  badge = renderReactionBadge(severity);
                  
                  content = (
                    <div className="space-y-6">
                      <div className="p-5 rounded-medium border border-neutral-900 bg-white shadow-subtle space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-bold text-primary uppercase tracking-wide">Recruiter Assessment</h4>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                            severity === 'SEVERE' ? 'bg-error/10 text-error border border-error/20' :
                            severity === 'MODERATE' ? 'bg-warning/10 text-warning border border-warning/20' :
                            'bg-success/15 text-success border border-success/20'
                          }`}>
                            {severity} RECOMMENDATION
                          </span>
                        </div>
                        <p className="font-heading font-bold italic text-lg sm:text-xl text-primary leading-relaxed">
                          {data.score >= 85 
                            ? "Excellent structure and strong credentials. With minor tweaks to wording, you are ready to apply."
                            : data.score >= 70
                              ? "Reasonable base, but key impact indicators are missing. Fix the flagged items before submitting."
                              : "Critical issues found. A recruiter will likely skip this within 7 seconds. Extensive revision needed."
                          }
                        </p>
                        <p className="text-xs text-secondary leading-relaxed">
                          {data.whatRecruitersThink.critique}
                        </p>
                      </div>

                      <div className="border border-neutral-200 rounded-medium bg-white p-5 flex flex-col sm:flex-row items-center gap-6 justify-between">
                        <div className="space-y-1 text-center sm:text-left">
                          <h4 className="text-xs font-bold text-secondary uppercase tracking-widest">Candidate Resume Score</h4>
                          <p className="text-xs text-secondary font-medium">Calculated by scanning formatting, keywords, and metric density.</p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="relative w-16 h-16 rounded-full border-4 border-neutral-200 flex items-center justify-center font-black text-xl text-primary bg-neutral-50 shadow-inner">
                            {data.score}
                            <svg className="absolute -inset-[4px] w-[72px] h-[72px] transform -rotate-90">
                              <circle 
                                cx="36" 
                                cy="36" 
                                r="32" 
                                className="stroke-accent fill-transparent" 
                                strokeWidth="4" 
                                strokeDasharray={2 * Math.PI * 32}
                                strokeDashoffset={2 * Math.PI * 32 * (1 - data.score / 100)}
                              />
                            </svg>
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] font-bold text-secondary uppercase block">Verdict</span>
                            <span className="text-sm font-black text-primary">{scoreInfo.verdict}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-secondary uppercase tracking-widest">Top 3 Critical Fixes</h4>
                        <div className="grid grid-cols-1 gap-3">
                          {parsedFixes.slice(0, 3).map((fix, fIdx) => (
                            <div key={fIdx} className="p-4 rounded-medium border border-neutral-900/60 bg-white flex items-start gap-4 shadow-subtle text-left">
                              <div className="p-2.5 rounded-medium bg-neutral-50 border border-neutral-200 text-primary flex-shrink-0">
                                {fix.icon}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                    fix.action === 'REMOVE' ? 'bg-error/10 text-error' :
                                    fix.action === 'ADD' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                                  }`}>
                                    {fix.action}
                                  </span>
                                  <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${
                                    fix.impact === 'HIGH' ? 'bg-error text-white' :
                                    fix.impact === 'MEDIUM' ? 'bg-warning text-white' : 'bg-secondary text-white'
                                  }`}>
                                    {fix.impact} IMPACT
                                  </span>
                                </div>
                                <p className="text-xs text-primary leading-normal font-medium">
                                  {fix.explanation}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-center pt-2">
                        <button
                          onClick={handleFixResumeClick}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-bold uppercase tracking-widest rounded-medium shadow-subtle transition-all transform hover:-translate-y-0.5 cursor-pointer focus:outline-none"
                        >
                          <span>Repair Resume Workshop</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={section} className="relative group">
                    {/* Absolute positioned numbered timeline dot */}
                    <button
                      onClick={() => handleProgressClick(section)}
                      className={`absolute -left-[52px] top-6 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 z-10 text-[10px] font-bold cursor-pointer focus:outline-none ${
                        isActive 
                          ? 'border-accent bg-accent text-white scale-110 shadow-sm' 
                          : 'border-neutral-300 bg-white text-secondary hover:border-neutral-500 hover:text-primary'
                      }`}
                    >
                      {idx + 1}
                    </button>

                    {/* The Card Element */}
                    <div 
                      id={`section-${section.toLowerCase()}`}
                      className={`bg-white rounded-large border transition-all duration-300 shadow-subtle overflow-hidden text-left ${
                        isActive 
                          ? 'border-neutral-900 ring-1 ring-neutral-900/10' 
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <button
                        onClick={() => toggleActiveSection(section)}
                        className="w-full flex justify-between items-center p-6 text-left hover:bg-neutral-50/50 transition-colors focus:outline-none"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded-medium border transition-colors ${
                            isActive ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-neutral-50 border-neutral-200 text-secondary'
                          }`}>
                            {icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Section {idx + 1}</span>
                              {badge}
                            </div>
                            <h3 className="text-base font-black text-primary tracking-tight mt-0.5">{title}</h3>
                          </div>
                        </div>
                        <div>
                          {isActive ? <ChevronUp className="w-5 h-5 text-secondary" /> : <ChevronDown className="w-5 h-5 text-secondary" />}
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isActive && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                          >
                            <div className="px-6 pb-6 pt-2 border-t border-neutral-200 bg-neutral-50/10 space-y-6 text-left">
                              {content}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DEBATE THE RECRUITER (Interactive Q&A Chat) */}
      <AnimatePresence mode="wait">
        {activeTab === 'debate' && (
          <motion.div
            key="debate-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="w-full"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 items-start">
              
              {/* Column 1: Debate the Recruiter (5 cols) */}
              <div className="lg:col-span-5 bg-white p-8 rounded-large border border-neutral-900 shadow-subtle flex flex-col gap-6">
                <div className="space-y-1 text-left">
                  <h3 className="text-lg font-black text-primary flex items-center gap-2">
                    <span className="w-2.5 h-4.5 rounded bg-accent" />
                    Debate the Recruiter
                  </h3>
                  <p className="text-xs text-secondary">
                    Argue about your score, justify your work achievements, or ask how to fix specific parts of your resume.
                  </p>
                </div>

                {/* Chat message display area */}
                <div className="border border-neutral-900 rounded-medium bg-neutral-50/50 p-4 h-[500px] overflow-y-auto flex flex-col gap-4 relative">
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-secondary space-y-2">
              <span className="text-2xl">💬</span>
              <p className="text-xs font-bold">Conversation started.</p>
              <p className="text-[11px] max-w-sm">Ask a question below or choose a quick prompt to begin your debate.</p>
            </div>
          ) : (
            chatMessages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-neutral-900 border border-neutral-900 flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0">
                    ✍️
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-medium border text-xs leading-relaxed shadow-subtle ${
                    msg.role === 'user'
                      ? 'bg-white border-neutral-900 text-primary rounded-tr-none'
                      : 'bg-neutral-950 border-neutral-950 text-white rounded-tl-none font-medium'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {/* Typing/Loading indicator */}
          {isLoadingChat && (
            <div className="flex gap-3 self-start items-center max-w-[85%]">
              <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0 animate-spin">
                ⏳
              </div>
              <div className="p-3 bg-neutral-900/10 border border-dashed border-neutral-300 text-secondary text-[11px] rounded-medium rounded-tl-none animate-pulse">
                {typingMessage}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="flex flex-wrap gap-2">
          {presetQuestions.map((q, idx) => (
            <button
              key={idx}
              disabled={isLoadingChat}
              onClick={() => handleSendPreset(q)}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full border border-neutral-200 hover:border-neutral-900 bg-white text-secondary hover:text-primary transition-all disabled:opacity-50 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type your defense here (e.g., 'But I built the whole frontend in React from scratch!')"
            disabled={isLoadingChat}
            className="flex-grow p-3 bg-white border border-neutral-900 rounded-medium text-xs text-primary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 placeholder:text-neutral-400"
          />
          <button
            type="submit"
            disabled={isLoadingChat || !chatInput.trim()}
            className="px-6 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-medium transition-all shadow-subtle border border-primary flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            Send
          </button>
        </form>
      </div>

      {/* Column 2: Rehabilitation Workshop (7 cols) */}
      <div ref={fixWorkshopRef} className="lg:col-span-7 space-y-6">
        
        {/* Rehabilitation Header */}
        <div className="bg-white p-8 rounded-large border border-neutral-900 shadow-subtle text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-success/30 bg-success/10 shadow-subtle mb-4">
            <Sparkles className="w-3.5 h-3.5 text-success" />
            <span className="text-xs font-semibold text-success uppercase">Rehabilitation Enabled</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-primary mb-2 font-heading">
            Resume Rehabilitation
          </h2>
          <p className="text-xs text-secondary">
            We've converted your summary text and critical bullets into result-driven value propositions.
          </p>
        </div>

            {/* Summary Rewrite Section */}
            <div className="bg-white p-8 rounded-large border border-neutral-900 shadow-subtle mb-6 space-y-6">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <span className="w-2.5 h-4 bg-success" />
                Summary Upgrade
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
                <div className="lg:col-span-5 border border-error bg-error/5 rounded-medium p-5 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <span className="text-[9px] font-bold text-error uppercase bg-error/10 border border-error/20 px-2 py-0.5 rounded tracking-wider">Original</span>
                    <p className="text-xs text-secondary mt-3 leading-relaxed italic">
                      "{data.improvedSummary.original}"
                    </p>
                  </div>
                </div>
                
                {/* Arrow column */}
                <div className="lg:col-span-1 flex items-center justify-center">
                  <ArrowRight className="w-6 h-6 text-secondary rotate-90 lg:rotate-0" />
                </div>

                <div className="lg:col-span-5 border border-success bg-success/5 rounded-medium p-5 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <span className="text-[9px] font-bold text-success uppercase bg-success/10 border border-success/20 px-2 py-0.5 rounded tracking-wider">Improved</span>
                    <p className="text-xs text-primary font-bold mt-3 leading-relaxed">
                      "{data.improvedSummary.improved}"
                    </p>
                  </div>
                  <div className="text-[10px] text-secondary mt-3 pt-2 border-t border-success/10">
                    <span className="font-extrabold text-success">Why this wins:</span> {data.improvedSummary.explanation}
                  </div>
                </div>
              </div>
            </div>

            {/* Bullet point rewrites */}
            <div className="bg-white p-8 rounded-large border border-neutral-900 shadow-subtle mb-6 space-y-6">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <span className="w-2.5 h-4 bg-success" />
                Bullet Upgrade List
              </h3>
              <div className="space-y-6">
                {[...data.experience.items, ...data.projects.items].map((item, idx) => (
                  <div key={idx} className="border border-neutral-900 rounded-medium overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-11 items-center bg-white">
                      
                      <div className="lg:col-span-5 p-5 bg-error/5 min-h-[120px] flex flex-col justify-center">
                        <span className="text-[9px] font-bold text-error uppercase bg-error/10 border border-error/20 px-1.5 py-0.5 rounded tracking-wider self-start">Original</span>
                        <p className="text-xs text-secondary mt-2.5 leading-relaxed">
                          "{item.original}"
                        </p>
                      </div>

                      <div className="lg:col-span-1 flex items-center justify-center p-3 border-y lg:border-y-0 border-neutral-200">
                        <ArrowRight className="w-5 h-5 text-secondary rotate-90 lg:rotate-0" />
                      </div>

                      <div className="lg:col-span-5 p-5 bg-success/5 min-h-[120px] flex flex-col justify-center">
                        <span className="text-[9px] font-bold text-success uppercase bg-success/10 border border-success/20 px-1.5 py-0.5 rounded tracking-wider self-start">Rewrite</span>
                        <p className="text-xs text-primary font-bold mt-2.5 leading-relaxed">
                          "{item.improved}"
                        </p>
                      </div>

                    </div>
                    <div className="p-4 bg-neutral-50 border-t border-neutral-200 text-xs text-secondary flex items-start gap-2 leading-relaxed">
                      <CornerDownRight className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-extrabold text-primary">Why this wins:</span> {item.explanation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Layout directives */}
            <div className="bg-white p-8 rounded-large border border-neutral-900 shadow-subtle mb-12 space-y-4">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <span className="w-2.5 h-4 bg-success" />
                Formatting Directives
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2">
                <li className="flex items-start gap-2.5 text-xs sm:text-sm text-secondary">
                  <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Stick to a single-column layout. Two columns look nice but break older ATS readers completely.</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs sm:text-sm text-secondary">
                  <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Use standard font types (Inter, Arial, Georgia, Calibri). Custom geometric fonts sometimes render as garbage text in scanners.</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs sm:text-sm text-secondary">
                  <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Use simple headers: 'Work Experience', 'Projects', 'Skills', 'Education'. Avoid creative section names like 'Professional Stacks'.</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs sm:text-sm text-secondary">
                  <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Ensure your contact info is actual text and not embedded in an image.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  </div>
);
};
