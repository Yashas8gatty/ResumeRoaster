import React, { useRef, useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';

interface RoastCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  score: number;
  quote: string;
  mood: string;
  fixes: string[];
  userName: string;
}

export const RoastCardModal: React.FC<RoastCardModalProps> = ({
  isOpen,
  onClose,
  score,
  quote,
  mood,
  fixes,
  userName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setImgSrc(null);
      return;
    }

    // A tiny timeout ensures the canvas element is fully mounted and fonts are ready to render.
    const timer = setTimeout(() => {
      drawCard();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, score, quote, mood, fixes, userName]);

  const drawCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set resolution (1200 x 630 px) for crisp social media sharing (OG) size
    canvas.width = 1200;
    canvas.height = 630;

    // Background
    ctx.fillStyle = '#0f0f10';
    ctx.fillRect(0, 0, 1200, 630);

    // Decorative grid pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let x = 0; x < 1200; x += 24) {
      for (let y = 0; y < 630; y += 24) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Draw bold outer border (accent Burnt Orange)
    ctx.strokeStyle = '#C66A3D'; // Accent color: Burnt orange
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, 1200 - 16, 630 - 16);

    // Inner thin border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, 1200 - 56, 630 - 56);

    // Brand Header: "RESUME ROAST"
    ctx.font = '900 38px "Geist", "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('RESUME ROAST', 60, 65);

    // Subtitle
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.fillStyle = '#C66A3D'; // Accent color
    ctx.fillText('OFFICIAL REJECTION DOSSIER & FLUX REPORT', 60, 115);

    // Candidate Name (Middle Top)
    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('CANDIDATE RECIPIENT:', 400, 65);

    ctx.font = '900 18px "Geist", "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(userName.toUpperCase(), 400, 88);

    // Score Circle (Left Side)
    const circleX = 220;
    const circleY = 320;
    const radius = 100;

    // Track Circle Background
    ctx.beginPath();
    ctx.arc(circleX, circleY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#1d1d1f';
    ctx.lineWidth = 14;
    ctx.stroke();

    // Score Circle Arc (Burnt Orange)
    ctx.beginPath();
    const scorePercent = score / 100;
    ctx.arc(circleX, circleY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * scorePercent));
    ctx.strokeStyle = '#C66A3D';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 85px "Geist", "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score.toString(), circleX, circleY - 12);

    // "/ 100" label
    ctx.font = 'bold 16px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('/ 100', circleX, circleY + 45);

    // Circle label
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('FINAL SCORE', circleX, circleY + 130);

    // Right Side: Recruiter Review & Quote
    const textX = 400;
    const textY = 200;
    const maxWidth = 740;

    // Label
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 14px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('RECRUITER FEEDBACK & CLINICAL OBSERVATIONS:', textX, textY - 40);

    // Quote text
    const cleanQuote = quote ? quote.replace(/^['"]|['"]$/g, '') : "Your resume says everything except why you're useful.";
    const quoteText = `"${cleanQuote}"`;
    ctx.font = 'italic 800 32px "Geist", "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';

    const wrapText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
      const words = text.split(' ');
      let line = '';
      let currentY = y;
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          context.fillText(line, x, currentY);
          line = words[n] + ' ';
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      context.fillText(line, x, currentY);
      return currentY + lineHeight;
    };

    const nextY = wrapText(ctx, quoteText, textX, textY, maxWidth, 44);

    // Recruiter Mood block
    ctx.font = 'bold 16px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('Recruiter Mood: ', textX, nextY + 16);

    ctx.font = '900 16px "Geist", "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(mood || 'Indifferent', textX + 135, nextY + 16);

    // Recommended Fixes
    if (fixes && fixes.length > 0) {
      ctx.font = 'bold 14px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText('CRITICAL EMERGENCY REMEDIES:', textX, nextY + 70);

      ctx.font = '500 16px "Inter", sans-serif';
      ctx.fillStyle = '#C66A3D';
      
      // Draw first fix
      const fix1 = fixes[0].length > 80 ? fixes[0].substring(0, 77) + '...' : fixes[0];
      ctx.fillText(`• ${fix1}`, textX, nextY + 105);

      if (fixes[1]) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        const fix2 = fixes[1].length > 80 ? fixes[1].substring(0, 77) + '...' : fixes[1];
        ctx.fillText(`• ${fix2}`, textX, nextY + 135);
      }
    }

    // Slanted Stamp (Top Right)
    let stampText = 'SKIPPED';
    let stampColor = '#B91C1C'; // Red
    if (score >= 80) {
      stampText = 'SHORTLIST';
      stampColor = '#2F855A'; // Green
    } else if (score >= 50) {
      stampText = 'MAYBE';
      stampColor = '#D97706'; // Amber
    }

    ctx.save();
    ctx.translate(1010, 100);
    ctx.rotate(10 * Math.PI / 180); // 10 degrees tilt
    
    // Stamp box
    ctx.strokeStyle = stampColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(-90, -30, 180, 60, 6);
    ctx.stroke();

    // Stamp background highlight
    ctx.fillStyle = `${stampColor}14`; // 8% opacity tint
    ctx.fill();

    // Stamp text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 24px "Geist", "Inter", sans-serif';
    ctx.fillStyle = stampColor;
    ctx.fillText(stampText, 0, 0);
    ctx.restore();

    // Bottom Decorative elements: Barcode & Link
    const barcodeX = 60;
    const barcodeY = 510;

    // Draw mock barcode stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    const barcodePattern = [2, 4, 1, 3, 5, 2, 1, 4, 3, 2, 5, 1, 2, 4, 1, 3, 2, 5, 4, 1, 2, 3];
    let curX = barcodeX;
    for (let w of barcodePattern) {
      ctx.fillRect(curX, barcodeY, w * 3, 40);
      curX += (w * 3) + 4;
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = '900 13px "Geist", "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillText('ROAST ID / SEC-8802A', barcodeX, 575);

    ctx.textAlign = 'right';
    ctx.font = '900 17px "Geist", "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('resumeroaster-in.vercel.app', 1140, 575);

    // Export generated canvas to image source state for cross-platform compatibility and mobile long-press saves
    const url = canvas.toDataURL('image/png');
    setImgSrc(url);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `my_resume_roast_${score}.png`;
    link.href = url;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-[#111111] border-2 border-neutral-800 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] sm:max-h-[95vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#151515]">
          <div>
            <h3 className="text-md font-black text-white uppercase tracking-tight">Your Roast Certificate</h3>
            <p className="text-[11px] text-neutral-400">Download a high-quality certificate of your resume roast.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas / Preview Area */}
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center bg-[#09090a] min-h-[220px] sm:min-h-[300px]">
          {/* Keep canvas element hidden but present in DOM so we can write to it */}
          <canvas
            ref={canvasRef}
            style={{ display: 'none' }}
          />

          {imgSrc ? (
            <>
              <img
                src={imgSrc}
                alt="Roast Certificate"
                className="w-full h-auto max-w-[800px] border border-neutral-800 rounded-lg shadow-lg bg-[#0f0f10] block select-none"
              />
              <p className="mt-3 text-[11px] text-[#C66A3D] font-bold text-center block sm:hidden">
                💡 Long-press the image to save/share directly on mobile!
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-8 h-8 border-3 border-[#C66A3D] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Generating Certificate...</p>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-5 border-t border-neutral-800 bg-[#151515]">
          <span className="text-[11px] text-neutral-400 text-center sm:text-left">
            High-resolution certificate download.
          </span>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-grow sm:flex-grow-0 px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white border border-neutral-800 hover:bg-neutral-800 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              className="flex-grow sm:flex-grow-0 px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-[#C66A3D] hover:bg-[#C66A3D]/90 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
