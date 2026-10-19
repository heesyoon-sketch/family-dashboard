import type { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { resetAllProgress } from '@/lib/reset';
import { buildAdminCopy } from '@/lib/admin/adminCopy';

interface AdminSettingsPanelProps {
  familyInviteCode: string | null;
  generatingCode: boolean;
  copyInviteCode: () => void;
  generateInviteCode: () => void;
  currentPinInput: string;
  setCurrentPinInput: Dispatch<SetStateAction<string>>;
  newPinInput: string;
  setNewPinInput: Dispatch<SetStateAction<string>>;
  confirmPinInput: string;
  setConfirmPinInput: Dispatch<SetStateAction<string>>;
  pinChanging: boolean;
  handleChangePin: () => void;
  routinePenaltyEnabled: boolean;
  routinePenaltyPoints: number;
  routinePenaltyPointsInput: string;
  setRoutinePenaltyPointsInput: Dispatch<SetStateAction<string>>;
  saveRoutinePenaltyPoints: () => void;
  routinePenaltySaving: boolean;
  toggleRoutinePenalty: () => void;
  exportingSnapshot: boolean;
  exportFamilySnapshot: () => void;
  leavingFamily: boolean;
  deletingFamily: boolean;
  handleLeaveFamily: () => void;
  handleDeleteFamilyData: () => void;
}

export function AdminSettingsPanel({
  familyInviteCode,
  generatingCode,
  copyInviteCode,
  generateInviteCode,
  currentPinInput,
  setCurrentPinInput,
  newPinInput,
  setNewPinInput,
  confirmPinInput,
  setConfirmPinInput,
  pinChanging,
  routinePenaltyEnabled,
  routinePenaltyPoints,
  routinePenaltyPointsInput,
  setRoutinePenaltyPointsInput,
  saveRoutinePenaltyPoints,
  routinePenaltySaving,
  toggleRoutinePenalty,
  exportingSnapshot,
  exportFamilySnapshot,
  leavingFamily,
  deletingFamily,
  handleChangePin,
  handleLeaveFamily,
  handleDeleteFamilyData,
}: AdminSettingsPanelProps) {
  const { lang, setLang, t } = useLanguage();
  const adminCopy = buildAdminCopy(lang);

  return (
    <div className="space-y-4">
      {/* Family invitation */}
      <div className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-white">{adminCopy.familyInvitation}</h2>
            <p className="mt-1 text-sm leading-6 text-white/54">
              {adminCopy.familyInvitationHelp}
            </p>
          </div>
          <Icons.UsersRound className="shrink-0 text-[#4EEDB0]" size={20} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg border border-white/10 bg-[#111224] px-3">
            <span className="truncate text-lg font-black tracking-[0.22em] text-white sm:text-xl">
              {familyInviteCode ?? '------'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyInviteCode}
              disabled={!familyInviteCode}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#4EEDB0]/14 px-3 text-sm font-black text-[#4EEDB0] transition-colors hover:bg-[#4EEDB0]/20 disabled:cursor-not-allowed disabled:opacity-40"
              title={adminCopy.copyInviteCode}
            >
              <Icons.Copy size={16} />
              <span className="hidden sm:inline">{adminCopy.copyInviteCode}</span>
            </button>
            <button
              onClick={generateInviteCode}
              disabled={generatingCode}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/56 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
              title={familyInviteCode ? adminCopy.regenerateCode : adminCopy.generateCode}
            >
              <Icons.RefreshCw size={16} className={generatingCode ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        {!familyInviteCode && (
          <p className="mt-2 text-xs text-[#FFB830]">
            ↑ {adminCopy.noInviteCode}
          </p>
        )}
        <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-white/48">
          {adminCopy.parentOnlyAdmin}
        </p>
      </div>

      {/* Language */}
      <div className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Icons.Languages size={18} className="text-[#5B8EFF]" />
          <h2 className="text-base font-black text-white">{adminCopy.language}</h2>
        </div>
        <div className="inline-flex w-full rounded-lg border border-white/10 bg-[#111224] p-1 sm:w-auto">
          <button
            onClick={() => setLang('ko')}
            className={`h-9 flex-1 rounded-md px-4 text-sm font-black transition-colors sm:min-w-24 ${
              lang === 'ko' ? 'bg-[#5B8EFF] text-white' : 'text-white/50 hover:bg-white/[0.055] hover:text-white'
            }`}
          >
            {adminCopy.korean}
          </button>
          <button
            onClick={() => setLang('en')}
            className={`h-9 flex-1 rounded-md px-4 text-sm font-black transition-colors sm:min-w-24 ${
              lang === 'en' ? 'bg-[#5B8EFF] text-white' : 'text-white/50 hover:bg-white/[0.055] hover:text-white'
            }`}
          >
            {adminCopy.english}
          </button>
        </div>
      </div>

      {/* Routine deadline penalty, family-wide */}
      <div className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <Icons.AlarmClockMinus size={18} className="text-[#FF7BAC]" />
              <h2 className="text-base font-black text-white">{adminCopy.routinePenalty}</h2>
            </div>
            <p className="text-sm leading-6 text-white/54">{adminCopy.routinePenaltyHelp(routinePenaltyPoints)}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={routinePenaltyEnabled}
            aria-label={adminCopy.routinePenalty}
            onClick={toggleRoutinePenalty}
            disabled={routinePenaltySaving}
            className="inline-flex shrink-0 items-center gap-2 disabled:opacity-50"
          >
            <span className={`text-xs font-black ${routinePenaltyEnabled ? 'text-[#FF7BAC]' : 'text-white/40'}`}>
              {routinePenaltySaving ? '…' : routinePenaltyEnabled ? adminCopy.on : adminCopy.off}
            </span>
            <span className={`relative h-6 w-11 rounded-full transition-colors ${routinePenaltyEnabled ? 'bg-[#FF7BAC]' : 'bg-white/14'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${routinePenaltyEnabled ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
          </button>
        </div>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={e => { e.preventDefault(); saveRoutinePenaltyPoints(); }}
        >
          <label htmlFor="routine-penalty-points" className="shrink-0 text-sm font-bold text-white/70">
            {adminCopy.routinePenaltyPointsLabel}
          </label>
          <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-white/10 bg-[#111224] px-3 focus-within:border-[#4EEDB0] sm:max-w-40">
            <input
              id="routine-penalty-points"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={routinePenaltyPointsInput}
              onChange={e => setRoutinePenaltyPointsInput(e.target.value.replace(/\D/g, ''))}
              className="min-w-0 flex-1 bg-transparent text-right text-base font-black text-white outline-none"
            />
            <span className="ml-1.5 text-sm font-bold text-white/50">P</span>
          </div>
          <button
            type="submit"
            disabled={routinePenaltySaving || routinePenaltyPointsInput === String(routinePenaltyPoints)}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-[#4EEDB0] px-4 text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:cursor-not-allowed disabled:bg-white/[0.055] disabled:text-white/36"
          >
            {adminCopy.save}
          </button>
        </form>
      </div>

      {/* Change Admin PIN */}
      <div className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Icons.LockKeyhole size={18} className="text-[#FFB830]" />
          <h2 className="text-base font-black text-white">{t('change_admin_pin')}</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={currentPinInput}
            onChange={e => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
            placeholder={t('current_pin')}
            className="h-11 w-full rounded-lg border border-white/10 bg-[#111224] px-3 text-center text-lg font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
          />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={newPinInput}
            onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ''))}
            placeholder={t('new_pin')}
            className="h-11 w-full rounded-lg border border-white/10 bg-[#111224] px-3 text-center text-lg font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
          />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={confirmPinInput}
            onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
            placeholder={t('confirm_new_pin')}
            className="h-11 w-full rounded-lg border border-white/10 bg-[#111224] px-3 text-center text-lg font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleChangePin}
            disabled={pinChanging || !currentPinInput || !newPinInput || !confirmPinInput}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#4EEDB0] px-4 text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:cursor-not-allowed disabled:bg-white/[0.055] disabled:text-white/36 sm:w-auto"
          >
            {pinChanging ? '…' : t('change_pin_btn')}
          </button>
        </div>
      </div>

      {/* Progress Reset */}
      <div className="flex flex-col gap-3 rounded-lg border border-white/8 bg-[#14162A] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <Icons.RotateCcw size={17} className="text-[#FFB830]" />
            <h2 className="text-base font-black text-white">{t('reset_all_progress')}</h2>
          </div>
          <p className="text-sm leading-6 text-white/54">{t('reset_description')}</p>
        </div>
        <button
          onClick={async () => {
            if (!confirm(t('reset_confirm'))) return;
            await resetAllProgress();
            localStorage.removeItem('family_progress_reset_v1');
            toast.success(t('reset_success'));
            setTimeout(() => { location.href = '/'; }, 1000);
          }}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-[#FFB830]/30 bg-[#FFB830]/10 px-4 text-sm font-bold text-[#FFE0A0] transition-colors hover:bg-[#FFB830]/15"
        >
          {t('reset_full')}
        </button>
      </div>

      {/* Data export / trust */}
      <div className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Icons.ShieldCheck size={18} className="text-[#5B8EFF]" />
          <h2 className="text-base font-black text-white">{adminCopy.dataTrust}</h2>
        </div>
        <p className="text-sm leading-6 text-white/54">{adminCopy.dataTrustBody}</p>
        <button
          type="button"
          onClick={() => { void exportFamilySnapshot(); }}
          disabled={exportingSnapshot}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#5B8EFF]/35 bg-[#5B8EFF]/12 px-4 text-sm font-black text-[#B9CBFF] transition hover:bg-[#5B8EFF]/18 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
        >
          <Icons.Download size={16} />
          {exportingSnapshot ? adminCopy.exportingSnapshot : adminCopy.exportSnapshot}
        </button>
      </div>

      {/* Danger Zone — permanent family data deletion */}
      <div className="rounded-lg border border-[#FF7BAC]/22 bg-[#FF7BAC]/8 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Icons.TriangleAlert size={18} className="text-[#FF7BAC]" />
          <h2 className="text-base font-black text-[#FFD5E3]">{t('danger_zone')}</h2>
        </div>
        <p className="text-sm leading-6 text-white/62">{t('danger_zone_description')}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleLeaveFamily}
            disabled={leavingFamily || deletingFamily}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-[#FFB830]/30 bg-[#FFB830]/10 px-4 text-sm font-bold text-[#FFE0A0] transition-colors hover:bg-[#FFB830]/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {leavingFamily ? adminCopy.leavingFamily : adminCopy.leaveFamily}
          </button>
          <button
            onClick={handleDeleteFamilyData}
            disabled={deletingFamily || leavingFamily}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-[#FF7BAC]/35 bg-[#FF7BAC]/14 px-4 text-sm font-bold text-[#FFD5E3] transition-colors hover:bg-[#FF7BAC]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deletingFamily ? t('danger_zone_deleting') : t('danger_zone_button')}
          </button>
        </div>
      </div>
    </div>
  );
}
