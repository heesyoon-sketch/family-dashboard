import type { Dispatch, RefObject, SetStateAction } from 'react';
import Image from 'next/image';
import * as Icons from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { User, UserRole } from '@/lib/db';
import { withAvatarCache } from '@/lib/admin/adminHelpers';
import { buildAdminCopy } from '@/lib/admin/adminCopy';

interface AdminFamilyPanelProps {
  sortedUsers: User[];
  addingMember: boolean;
  setAddingMember: Dispatch<SetStateAction<boolean>>;
  newMemberName: string;
  setNewMemberName: Dispatch<SetStateAction<string>>;
  newMemberRole: UserRole;
  setNewMemberRole: Dispatch<SetStateAction<UserRole>>;
  isAddingMember: boolean;
  addMember: () => void;
  avatarInputRef: RefObject<HTMLInputElement | null>;
  handleAvatarUpload: (file: File | undefined) => void;
  editingUserId: string | null;
  editingName: string;
  setEditingName: Dispatch<SetStateAction<string>>;
  confirmEditName: (userId: string) => void;
  cancelEditName: () => void;
  avatarUploadingUserId: string | null;
  openAvatarUpload: (userId: string) => void;
  avatarVersion: number;
  currentAuthUserId: string | null;
  moveMember: (userId: string, direction: -1 | 1) => void;
  startEditName: (user: User) => void;
  removeMember: (userId: string) => void;
}

export function AdminFamilyPanel({
  sortedUsers,
  addingMember,
  setAddingMember,
  newMemberName,
  setNewMemberName,
  newMemberRole,
  setNewMemberRole,
  isAddingMember,
  addMember,
  avatarInputRef,
  handleAvatarUpload,
  editingUserId,
  editingName,
  setEditingName,
  confirmEditName,
  cancelEditName,
  avatarUploadingUserId,
  openAvatarUpload,
  avatarVersion,
  currentAuthUserId,
  moveMember,
  startEditName,
  removeMember,
}: AdminFamilyPanelProps) {
  const { lang, t } = useLanguage();
  const adminCopy = buildAdminCopy(lang);

  return (
    <section className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A1B2E] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <Icons.UsersRound size={18} className="text-[#5B8EFF]" />
            </span>
            <h2 className="text-base font-black text-white">{t('set_family_names')}</h2>
          </div>
          <p className="text-sm leading-6 text-white/54">
            {lang === 'en'
              ? 'Manage family members, roles, and order.'
              : '가족 멤버의 이름, 역할, 순서를 관리합니다.'}
          </p>
        </div>
        <button
          onClick={() => { setAddingMember(true); setNewMemberName(''); setNewMemberRole('CHILD'); }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4EEDB0] px-4 py-2.5 text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0]"
        >
          <Icons.UserPlus size={16} />
          {adminCopy.addMember}
        </button>
      </div>

      {/* Add member form */}
      {addingMember && (
        <div className="mb-4 space-y-3 rounded-lg border border-[#4EEDB0]/30 bg-[#111224] p-4">
          <p className="text-sm leading-6 text-white/54">{adminCopy.addMemberHelp}</p>
          <input
            type="text"
            value={newMemberName}
            onChange={e => setNewMemberName(e.target.value)}
            disabled={isAddingMember}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addMember();
              }
            }}
            placeholder={adminCopy.memberNamePlaceholder}
            autoFocus
            className="w-full rounded-lg border border-white/10 bg-[#1A1B2E] px-4 text-base font-bold text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
            style={{ minHeight: 'var(--touch-target)', fontSize: '16px' }}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNewMemberRole('PARENT')}
              disabled={isAddingMember}
              className={`min-h-11 rounded-lg text-sm font-black transition-colors ${
                newMemberRole === 'PARENT'
                  ? 'bg-[#5B8EFF] text-white'
                  : 'border border-white/8 bg-[#1A1B2E] text-white/54 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {t('parent_role')}
            </button>
            <button
              type="button"
              onClick={() => setNewMemberRole('CHILD')}
              disabled={isAddingMember}
              className={`min-h-11 rounded-lg text-sm font-black transition-colors ${
                newMemberRole === 'CHILD'
                  ? 'bg-[#FF7BAC] text-[#220610]'
                  : 'border border-white/8 bg-[#1A1B2E] text-white/54 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {t('child_role')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { void addMember(); }}
              disabled={isAddingMember || !newMemberName.trim()}
              className="min-h-[var(--touch-target)] rounded-lg bg-[#4EEDB0] text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:cursor-not-allowed disabled:bg-white/[0.055] disabled:text-white/36"
            >
              {isAddingMember ? adminCopy.adding : adminCopy.add}
            </button>
            <button
              type="button"
              onClick={() => setAddingMember(false)}
              disabled={isAddingMember}
              className="min-h-[var(--touch-target)] rounded-lg border border-white/10 bg-white/[0.045] text-sm font-bold text-white/54 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adminCopy.cancel}
            </button>
          </div>
        </div>
      )}

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { void handleAvatarUpload(e.target.files?.[0]); }}
      />

      <div className="space-y-2.5">
        {sortedUsers.map((u, index) => {
          const isEditing = editingUserId === u.id;
          const isParent = u.role === 'PARENT';
          const isLinked = Boolean(u.authUserId);
          return (
            <div
              key={u.id}
              className="rounded-lg border border-white/8 bg-[#1A1B2E] p-3 transition-colors sm:p-4"
            >
              {isEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') confirmEditName(u.id);
                      if (e.key === 'Escape') cancelEditName();
                    }}
                    autoFocus
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#4EEDB0] bg-[#111224] px-3 text-base font-bold text-white outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmEditName(u.id)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#4EEDB0]/18 text-[#4EEDB0] transition-colors hover:bg-[#4EEDB0]/26"
                      title={t('confirm')}
                    >
                      <Icons.Check size={18} />
                    </button>
                    <button
                      onClick={cancelEditName}
                      className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FF7BAC]/14 text-[#FFB8CF] transition-colors hover:bg-[#FF7BAC]/22"
                      title={adminCopy.cancel}
                    >
                      <Icons.X size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                  {/* Profile section: avatar + name + chips */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openAvatarUpload(u.id)}
                      disabled={avatarUploadingUserId === u.id}
                      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#111224] ring-2 ring-white/10 transition hover:ring-[#5B8EFF]/60 disabled:opacity-60"
                      title={adminCopy.uploadAvatar}
                    >
                      {u.avatarUrl ? (
                        <Image
                          src={withAvatarCache(u.avatarUrl, avatarVersion) ?? u.avatarUrl}
                          alt={u.name}
                          width={48}
                          height={48}
                          referrerPolicy="no-referrer"
                          className="h-12 w-12 object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-base font-black text-white/72">
                          {u.name.charAt(0)}
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 flex h-4 items-center justify-center bg-black/65 text-white">
                        {avatarUploadingUserId === u.id
                          ? <Icons.Loader2 size={10} className="animate-spin" />
                          : <Icons.Camera size={10} />}
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-black text-white sm:text-lg">{u.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${
                          isParent
                            ? 'bg-[#5B8EFF]/14 text-[#8EAFFF]'
                            : 'bg-[#FF7BAC]/14 text-[#FFB8CF]'
                        }`}>
                          {isParent ? <Icons.Shield size={11} /> : <Icons.Sparkles size={11} />}
                          {isParent ? t('parent_role') : t('child_role')}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${
                          isLinked
                            ? 'bg-[#4EEDB0]/14 text-[#4EEDB0]'
                            : 'bg-white/[0.06] text-white/45'
                        }`}>
                          {isLinked
                            ? <Icons.CheckCircle2 size={11} />
                            : <Icons.CircleDashed size={11} />}
                          {isLinked ? adminCopy.linked : adminCopy.notLinked}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex shrink-0 items-center justify-end gap-1.5">
                    <button
                      onClick={() => moveMember(u.id, -1)}
                      disabled={index === 0}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111224] text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                      title={adminCopy.moveUp}
                      aria-label={adminCopy.moveUp}
                    >
                      <Icons.ChevronUp size={17} />
                    </button>
                    <button
                      onClick={() => moveMember(u.id, 1)}
                      disabled={index === sortedUsers.length - 1}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111224] text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                      title={adminCopy.moveDown}
                      aria-label={adminCopy.moveDown}
                    >
                      <Icons.ChevronDown size={17} />
                    </button>
                    <button
                      onClick={() => startEditName(u)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.045] text-white/54 transition-colors hover:bg-white/[0.08] hover:text-white"
                      title={lang === 'en' ? 'Edit name' : '이름 수정'}
                      aria-label={lang === 'en' ? 'Edit name' : '이름 수정'}
                    >
                      <Icons.Pencil size={16} />
                    </button>
                    {!(u.authUserId && u.authUserId === currentAuthUserId) && (
                      <button
                        onClick={() => removeMember(u.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF7BAC]/14 text-[#FFB8CF] transition-colors hover:bg-[#FF7BAC]/22"
                        title={adminCopy.deleteProfile}
                        aria-label={adminCopy.deleteProfile}
                      >
                        <Icons.Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
