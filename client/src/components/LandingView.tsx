import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

interface LandingViewProps {
  onFileUpload: (file: File) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onFileUpload }) => {
  const isMobile = useIsMobile();
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const validateAndProcessFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5MB limit.');
      return;
    }
    setError(null);
    onFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // 📱 Mobile-Only View
  if (isMobile) {
    return (
      <div className="w-full flex-1 flex flex-col justify-center px-4 py-6 gap-6 bg-bg text-center">
        {/* Hero Section */}
        <div className="space-y-3">
          {/* Brand Label */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-neutral-900 bg-white shadow-subtle mx-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-bold text-primary">Constructive Sarcasm Powered</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-primary leading-tight font-heading">
            Upload your Resume.<br />
            <span className="text-accent">Get Roasted.</span>
          </h1>
          
          <p className="text-[14px] text-secondary leading-relaxed max-w-sm mx-auto font-normal">
            We read your resume like a recruiter with 87 tabs open. If it survives, you probably get interviews.
          </p>
        </div>

        {/* Upload Card */}
        <div className="w-full flex flex-col items-center">
          <div
            onClick={triggerFileInput}
            className="w-full p-8 rounded-xl border border-dashed border-neutral-900 bg-white shadow-subtle relative active:scale-[0.98] transition-all duration-150 cursor-pointer flex flex-col items-center justify-center min-h-[220px]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 rounded-full bg-neutral-50 border border-neutral-900 shadow-subtle transition-all">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-[15px] font-extrabold text-primary tracking-tight">
                  Tap to upload your PDF resume
                </p>
                <p className="text-xs text-accent font-semibold underline underline-offset-4">
                  browse your files
                </p>
              </div>
              <div className="text-[10px] text-secondary/80 flex items-center justify-center gap-1.5 pt-2 border-t border-neutral-200 w-full max-w-[180px]">
                <FileText className="w-3 h-3" />
                PDF format (Max 5MB)
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mt-3 flex items-center gap-2 text-xs text-error bg-error/5 border border-error/20 px-3 py-2.5 rounded-lg w-full animate-fade">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold text-left">{error}</span>
            </div>
          )}
        </div>

        {/* Features List as cards */}
        <div className="space-y-2 text-left">
          <div className="p-3 rounded-xl border border-neutral-200 bg-white flex items-center gap-3 shadow-subtle">
            <CheckCircle2 className="w-4 h-4 text-neutral-900 flex-shrink-0" />
            <span className="text-[12px] text-secondary font-semibold">Exposes your copy-pasted corporate buzzwords and filler skills</span>
          </div>
          <div className="p-3 rounded-xl border border-neutral-200 bg-white flex items-center gap-3 shadow-subtle">
            <CheckCircle2 className="w-4 h-4 text-neutral-900 flex-shrink-0" />
            <span className="text-[12px] text-secondary font-semibold">Rewrites your lazy bullet points with measurable impact</span>
          </div>
          <div className="p-3 rounded-xl border border-neutral-200 bg-white flex items-center gap-3 shadow-subtle">
            <CheckCircle2 className="w-4 h-4 text-neutral-900 flex-shrink-0" />
            <span className="text-[12px] text-secondary font-semibold">Simulates a tired recruiter sliding your resume to the trash</span>
          </div>
        </div>
      </div>
    );
  }

  // 🖥️ Desktop View (Unchanged)
  return (
    <div className="max-w-[1200px] mx-auto px-10 w-full flex-1 flex items-center py-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center w-full">
        
        {/* LEFT COLUMN: Headings & Features (7 cols) */}
        <div className="lg:col-span-7 space-y-8 text-left flex flex-col justify-center">
          
          {/* Brand Label */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-900 bg-white shadow-subtle self-start">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-semibold text-primary">Constructive Sarcasm Powered</span>
          </div>

          {/* Hero Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-primary leading-tight font-heading">
              Upload your Resume.<br />
              <span className="text-accent">Get Roasted.</span>
            </h1>
            <p className="text-base sm:text-lg text-secondary leading-relaxed max-w-xl font-normal">
              We read your resume like a recruiter with 87 tabs open. If it survives, you probably get interviews.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2.5 text-sm text-secondary font-medium">
              <CheckCircle2 className="w-4.5 h-4.5 text-neutral-900 flex-shrink-0" />
              <span>Exposes your copy-pasted corporate buzzwords and filler skills</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-secondary font-medium">
              <CheckCircle2 className="w-4.5 h-4.5 text-neutral-900 flex-shrink-0" />
              <span>Rewrites your lazy bullet points with measurable impact</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-secondary font-medium">
              <CheckCircle2 className="w-4.5 h-4.5 text-neutral-900 flex-shrink-0" />
              <span>Simulates a tired recruiter sliding your resume to the trash</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Drag & Drop Card (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center w-full">
          
          {/* Drag & Drop Area Box */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`w-full p-10 sm:p-14 rounded-large border border-dashed transition-all duration-200 cursor-pointer text-center bg-white shadow-subtle relative group flex flex-col items-center justify-center min-h-[300px]
              ${isDragActive 
                ? 'border-accent bg-accent/5' 
                : 'border-neutral-900 hover:border-accent'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 rounded-full bg-neutral-50 group-hover:bg-neutral-100 border border-neutral-900 shadow-subtle group-hover:scale-105 transition-all">
                <Upload className="w-6 h-6 text-primary group-hover:text-accent transition-colors" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm sm:text-base font-extrabold text-primary tracking-tight">
                  Drag & drop your PDF resume here
                </p>
                <p className="text-xs text-secondary">
                  or <span className="text-accent font-semibold underline underline-offset-4 group-hover:text-accent/80">browse your files</span>
                </p>
              </div>
              <div className="text-[10px] text-secondary/80 flex items-center justify-center gap-1.5 pt-2 border-t border-neutral-200 w-full max-w-[200px]">
                <FileText className="w-3.5 h-3.5" />
                PDF format (Max 5MB)
              </div>
            </div>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-xs text-error bg-error/5 border border-error/20 px-4 py-3 rounded-medium w-full animate-fade">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
