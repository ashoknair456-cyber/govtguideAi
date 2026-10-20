import React from 'react';
import { 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export default function FreshnessIndicator({ 
  lastVerified, 
  officialSource, 
  officialUrl,
  compact = false 
}) {
  if (!lastVerified) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>Verification Pending</span>
      </div>
    );
  }

  // Calculate age of verification
  let daysAgo = 0;
  try {
    const verifiedDate = new Date(lastVerified);
    const today = new Date();
    daysAgo = Math.floor((today - verifiedDate) / (1000 * 60 * 60 * 24));
  } catch (e) {
    daysAgo = 0;
  }

  const isVeryFresh = daysAgo <= 45;
  const isAcceptable = daysAgo <= 120;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
        isVeryFresh 
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : isAcceptable
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}>
        <ShieldCheck className="w-3 h-3" />
        <span>{isVeryFresh ? 'Verified Fresh' : `Verified ${daysAgo}d ago`}</span>
      </span>
    );
  }

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isVeryFresh
        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
        : isAcceptable
        ? 'bg-blue-50/50 border-blue-200 text-blue-950'
        : 'bg-amber-50/50 border-amber-200 text-amber-950'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl mt-0.5 ${
            isVeryFresh ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wide uppercase">
                {isVeryFresh ? 'Official Verification: Current & Fresh' : 'Verified Information'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white font-bold border border-current opacity-80">
                Audited: {lastVerified}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Source authority: <strong className="text-slate-800">{officialSource || 'Central/State Government Department'}</strong>
            </p>
          </div>
        </div>

        {officialUrl && (
          <a
            href={officialUrl}
            target="_blank"
            rel="noreferrer"
            className="self-start sm:self-center px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm flex items-center gap-1.5 transition"
          >
            <span>Verify on Portal</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
          </a>
        )}
      </div>
    </div>
  );
}
