import React from 'react';
import { 
  Map, 
  MessageSquare, 
  BarChart2, 
  Layers, 
  Clock, 
  Bookmark, 
  Info, 
  Settings 
} from 'lucide-react';

export type NavTab = 'explore' | 'chat' | 'analytics' | 'floats' | 'history' | 'queries' | 'about' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  stats?: {
    totalFloats: number;
    activeFloats: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
}) => {
  const primaryNavItems = [
    { id: 'explore' as NavTab, label: 'Explore Map', icon: Map },
    { id: 'chat' as NavTab, label: 'Ask FloatChat', icon: MessageSquare },
    { id: 'analytics' as NavTab, label: 'Analytics', icon: BarChart2 },
    { id: 'floats' as NavTab, label: 'Float Profiles', icon: Layers },
    { id: 'history' as NavTab, label: 'Query History', icon: Clock },
    { id: 'queries' as NavTab, label: 'Saved Queries', icon: Bookmark },
  ];

  const secondaryNavItems = [
    { id: 'about' as NavTab, label: 'About', icon: Info },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-[300px] bg-white rounded-3xl border border-[#E2EEF5] shadow-xs flex flex-col justify-between overflow-hidden shrink-0 select-none relative">
      {/* Top FloatChat Pastel Blue Branding Card */}
      <div className="relative w-full h-[98px] rounded-t-3xl overflow-hidden shrink-0 select-none bg-[#D4EBF5] border-b border-[#CBE5F2]">
        {/* Layered ocean-wave vector artwork */}
        <svg
          viewBox="0 0 300 98"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="brandPastelBlueBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#DDF1FA" />
              <stop offset="45%" stopColor="#D0ECF7" />
              <stop offset="100%" stopColor="#BFE2F2" />
            </linearGradient>

            <linearGradient id="paleCyanWave" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E6F6FC" />
              <stop offset="100%" stopColor="#F0FAFE" />
            </linearGradient>

            {/* Right diagonal translucent wave swoosh */}
            <linearGradient id="rightDiagonalWave" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A8DEF2" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#C8ECFA" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#EAF7FD" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Base Pastel Blue Background Fill */}
          <rect width="300" height="98" fill="url(#brandPastelBlueBg)" />

          {/* Right-side curved diagonal wave transition swooping up into top right corner */}
          <path
            d="M195 98 C 230 78, 260 48, 300 12 L 300 98 Z"
            fill="url(#rightDiagonalWave)"
          />
          <path
            d="M215 98 C 245 80, 270 54, 300 24 L 300 98 Z"
            fill="#D6EEF9"
            opacity="0.5"
          />

          {/* Wave Layer 1: Soft Cyan/Blue wave flowing along lower section */}
          <path
            d="M0 64 C 40 76, 85 86, 140 82 C 190 78, 240 84, 300 88 L 300 98 L 0 98 Z"
            fill="url(#paleCyanWave)"
            opacity="0.95"
          />

          {/* Wave Layer 2: Main pastel blue flowing wave contour */}
          <path
            d="M0 0 L 300 0 L 300 62 C 260 66, 210 56, 160 68 C 110 80, 55 78, 0 62 Z"
            fill="url(#brandPastelBlueBg)"
          />

          {/* Wave Layer 3: Pure white flowing bottom wave transitioning into sidebar */}
          <path
            d="M0 76 C 45 85, 95 88, 155 78 C 210 68, 255 74, 300 84 L 300 98 L 0 98 Z"
            fill="#FFFFFF"
          />
        </svg>

        {/* Branding Logo & Text Content */}
        <div className="relative z-10 p-5 pt-4 flex items-center gap-3">
          {/* FloatChat ocean-wave logo */}
          <div className="w-8 h-8 shrink-0 flex items-center justify-center">
            <svg
              viewBox="0 0 32 30"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full text-[#0284C7]"
            >
              {/* Top ocean crest / float dome */}
              <path
                d="M10.5 12 C 10.5 6.5, 21.5 6.5, 21.5 12"
                stroke="#0284C7"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M14 9.5 C 14 8, 18 8, 18 9.5"
                stroke="#0EA5E9"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              {/* Wave 1 */}
              <path
                d="M3.5 16.5 C 7.5 13, 12.5 13, 16.5 16.5 C 20.5 20, 25.5 20, 29.5 16.5"
                stroke="#0284C7"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Wave 2 */}
              <path
                d="M3.5 21.5 C 7.5 18, 12.5 18, 16.5 21.5 C 20.5 25, 25.5 25, 29.5 21.5"
                stroke="#0369A1"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Brand Name & Tagline */}
          <div>
            <h1 className="text-[20px] font-bold text-[#0F2238] tracking-tight leading-none">
              FloatChat
            </h1>
            <span className="text-[8.5px] font-bold text-[#0369A1] tracking-[0.14em] uppercase mt-1 block">
              ARGO DATA EXPLORER
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-4 pt-2.5 pb-1 space-y-1 overflow-y-auto">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-[#E1F5F0] text-[#0D5C52] font-semibold shadow-2xs'
                  : 'text-[#475569] hover:bg-[#F3F9FC] hover:text-[#0F2238]'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-[#0D5C52]' : 'text-[#64748B]'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="pt-3 pb-1 border-t border-slate-100 my-2 space-y-1">
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#E1F5F0] text-[#0D5C52] font-semibold shadow-2xs'
                    : 'text-[#475569] hover:bg-[#F3F9FC] hover:text-[#0F2238]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#0D5C52]' : 'text-[#64748B]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Marine Coral & Fish Illustration (Exact Match from Reference) */}
      <div className="relative w-full h-24 overflow-hidden pointer-events-none mt-2">
        <svg viewBox="0 0 300 96" fill="none" className="w-full h-full object-cover">
          {/* Layered ocean wave base */}
          <path d="M0 60 Q 75 48, 150 58 T 300 52 L 300 96 L 0 96 Z" fill="#E6F5F8" />
          <path d="M0 68 Q 75 58, 150 66 T 300 62 L 300 96 L 0 96 Z" fill="#D2EFF5" />
          <path d="M0 76 Q 75 68, 150 74 T 300 70 L 300 96 L 0 96 Z" fill="#BFE8F0" />

          {/* Seaweed & Coral Silhouettes (Teal/Turquoise) */}
          <path d="M16 96 C 18 78, 14 65, 20 54 C 24 62, 26 75, 24 96" fill="#88D4E2" />
          <path d="M28 96 C 30 72, 38 60, 34 48 C 40 58, 38 78, 36 96" fill="#69C7D8" />
          <path d="M40 96 C 44 82, 50 70, 56 64 C 54 76, 50 86, 48 96" fill="#58BFD2" />
          
          <path d="M88 96 C 90 80, 96 72, 100 66 C 98 78, 96 88, 94 96" fill="#88D4E2" />
          <path d="M104 96 C 106 75, 114 68, 110 60 C 116 70, 112 85, 110 96" fill="#69C7D8" />

          {/* Swimming Little Fish (Soft Cyan) */}
          <g fill="#7CCEDC" opacity="0.85">
            {/* Fish 1 */}
            <path d="M175 48 C 179 45, 187 45, 191 48 C 187 51, 179 51, 175 48 Z" />
            <polygon points="175,48 171,44 171,52" />
            
            {/* Fish 2 (smaller) */}
            <path d="M148 56 C 151 54, 157 54, 160 56 C 157 58, 151 58, 148 56 Z" />
            <polygon points="148,56 145,53 145,59" />
          </g>
        </svg>
      </div>
    </aside>
  );
};
