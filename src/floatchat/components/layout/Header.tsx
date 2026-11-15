import React from 'react';
import { Search, Bell } from 'lucide-react';

interface HeaderProps {
  pageTitle?: string;
  pageSubtitle?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenImportModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle = 'Explore ARGO Observations',
  pageSubtitle = 'Visualize floats, profiles and ocean conditions across the Indian Ocean.',
  searchQuery,
  onSearchChange,
}) => {
  return (
    <header className="w-full flex items-center justify-between gap-4 py-1 select-none">
      {/* Title & Subtitle */}
      <div>
        <h2 className="text-xl lg:text-[22px] font-bold text-[#0F2238] tracking-tight">
          {pageTitle}
        </h2>
        <p className="text-xs text-[#64748B] font-medium mt-0.5">
          {pageSubtitle}
        </p>
      </div>

      {/* Right Controls: Search Pill, Bell, Avatar */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Search Pill */}
        <div className="relative w-64 md:w-72 lg:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search float ID (e.g., 2903456)"
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#E2EEF5] rounded-full text-[#0F2238] placeholder-[#94A3B8] shadow-xs focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all"
          />
        </div>

        {/* Bell Notification with subtle indicator */}
        <button
          className="p-2 text-[#64748B] hover:text-[#0F2238] hover:bg-white rounded-full transition-colors relative"
          title="ARGO Ingestion Status: Nominal (All GDAC links active)"
        >
          <Bell className="w-5 h-5" />
          <span className="w-2 h-2 rounded-full bg-[#0284C7] absolute top-1.5 right-1.5 ring-2 ring-[#EEF6FA]" />
        </button>

        {/* Ocean Avatar (Sunlit Indian Ocean Horizon) */}
        <div 
          className="w-9 h-9 rounded-full overflow-hidden border border-[#CBDCE7] shadow-xs shrink-0 cursor-pointer"
          title="Ocean Data Explorer"
        >
          <svg viewBox="0 0 36 36" className="w-full h-full object-cover">
            <defs>
              <linearGradient id="oceanSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7DD3FC" />
                <stop offset="50%" stopColor="#BAE6FD" />
                <stop offset="52%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0369A1" />
              </linearGradient>
              <linearGradient id="sunGlow" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="100%" stopColor="#FDE047" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect width="36" height="36" fill="url(#oceanSky)" />
            <circle cx="18" cy="18" r="8" fill="url(#sunGlow)" opacity="0.6" />
            <path d="M0 19 Q 9 17.5, 18 19 T 36 19 L 36 36 L 0 36 Z" fill="#0284C7" />
            <path d="M0 24 Q 9 22.5, 18 24 T 36 24 L 36 36 L 0 36 Z" fill="#0369A1" />
            <path d="M0 29 Q 9 27.5, 18 29 T 36 29 L 36 36 L 0 36 Z" fill="#0C4A6E" />
          </svg>
        </div>
      </div>
    </header>
  );
};

