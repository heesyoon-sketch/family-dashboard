import type { ComponentType } from 'react';
import Link from 'next/link';
import * as Icons from 'lucide-react';
import { AuthProfileAvatar } from '@/components/AuthProfileAvatar';
import { FamBitWordmark } from '@/components/FamBitLogo';
import type { User } from '@/lib/db';

export type AdminTabKey = 'settings' | 'family' | 'tasks' | 'store';

interface AdminHeaderProps {
  familyName: string | null;
  settingsLabel: string;
  adminModeLabel: string;
  feedbackLabel: string;
  feedbackSubtitle: string;
  backLabel: string;
  authProfile: { email: string | null; avatarUrl: string | null };
}

export function AdminHeader({
  familyName,
  settingsLabel,
  adminModeLabel,
  feedbackLabel,
  feedbackSubtitle,
  backLabel,
  authProfile,
}: AdminHeaderProps) {
  return (
    <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 pb-3 pt-5">
      <div className="flex min-w-0 items-center gap-3">
        <FamBitWordmark
          compact
          markSize={32}
          textClassName="hidden text-lg font-black text-white sm:inline"
        />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-[#4EEDB0]">{settingsLabel}</p>
          <h1 className="min-w-0 truncate text-xl font-black sm:text-2xl">
            {familyName ? `${adminModeLabel} - ${familyName}` : adminModeLabel}
          </h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <a
          href="https://forms.gle/KgxsBSBHwkdrwdTz7"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={feedbackLabel}
          title={feedbackSubtitle}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[#4EEDB0]/30 bg-[#4EEDB0]/10 px-3 text-sm font-black text-[#4EEDB0] transition-colors hover:border-[#4EEDB0]/60 hover:bg-[#4EEDB0]/16 sm:px-4"
        >
          <Icons.MessageCircleHeart size={16} />
          <span className="hidden sm:inline">{feedbackLabel}</span>
        </a>
        <Link href="/" className="whitespace-nowrap text-sm font-bold text-white/54 transition-colors hover:text-white">← {backLabel}</Link>
        <AuthProfileAvatar email={authProfile.email} avatarUrl={authProfile.avatarUrl} size={32} />
      </div>
    </div>
  );
}

interface AdminTabBarProps {
  activeTab: AdminTabKey;
  labels: Record<AdminTabKey, string>;
  selectedUser: User | null;
  sortedUsers: User[];
  onSelectTab: (tab: AdminTabKey) => void;
  loadTasks: (user: User) => void | Promise<void>;
}

export function AdminTabBar({
  activeTab,
  labels,
  selectedUser,
  sortedUsers,
  onSelectTab,
  loadTasks,
}: AdminTabBarProps) {
  const tabs: Array<{ key: AdminTabKey; label: string; icon: ComponentType<{ size?: number; className?: string }> }> = [
    { key: 'settings', label: labels.settings, icon: Icons.Settings2 },
    { key: 'family', label: labels.family, icon: Icons.UsersRound },
    { key: 'tasks', label: labels.tasks, icon: Icons.ListChecks },
    { key: 'store', label: labels.store, icon: Icons.Store },
  ];

  return (
    <div className="sticky top-0 z-40 border-b border-white/8 bg-[#0D0E1C]/95 backdrop-blur">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex gap-1 overflow-x-auto py-2" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(tab => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  onSelectTab(tab.key);
                  const hasSelectedUser = selectedUser
                    ? sortedUsers.some(u => u.id === selectedUser.id)
                    : false;
                  if (tab.key === 'tasks' && !hasSelectedUser && sortedUsers[0]) {
                    void loadTasks(sortedUsers[0]);
                  }
                }}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-black transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#4EEDB0] text-[#07120E]'
                    : 'text-white/54 hover:bg-white/[0.055] hover:text-white'
                }`}
              >
                <TabIcon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
