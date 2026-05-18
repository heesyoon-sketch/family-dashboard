import Link from 'next/link';
import { FamBitWordmark } from '@/components/FamBitLogo';

interface AdminPinGateProps {
  familyName: string | null;
  adminModeLabel: string;
  enterPinLabel: string;
  confirmLabel: string;
  backLabel: string;
  logoutLabel: string;
  cancelLabel: string;
  pin: string;
  setPin: (value: string) => void;
  error: string;
  adminPinHash: string | null | undefined;
  isParentAdmin: boolean;
  isFamilyOwner: boolean;
  onSubmit: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  onPinReset: () => void | Promise<void>;
  pinResetLoading: boolean;
  pinResetStep: 'idle' | 'otp_sent';
  setPinResetStep: (step: 'idle' | 'otp_sent') => void;
  authEmail: string | null;
  otpCode: string;
  setOtpCode: (code: string) => void;
  otpError: string;
  setOtpError: (error: string) => void;
  otpLoading: boolean;
  onOtpVerify: () => void | Promise<void>;
}

export function AdminPinGate({
  familyName,
  adminModeLabel,
  enterPinLabel,
  confirmLabel,
  backLabel,
  logoutLabel,
  cancelLabel,
  pin,
  setPin,
  error,
  adminPinHash,
  isParentAdmin,
  isFamilyOwner,
  onSubmit,
  onLogout,
  onPinReset,
  pinResetLoading,
  pinResetStep,
  setPinResetStep,
  authEmail,
  otpCode,
  setOtpCode,
  otpError,
  setOtpError,
  otpLoading,
  onOtpVerify,
}: AdminPinGateProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0D0E1C] px-4 py-8 text-white sm:px-6">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-44 border-b border-white/8 bg-[#111224]" />
      <div className="relative z-10 w-full max-w-md">
        <Link href="/home" aria-label="FamBit home" className="mx-auto mb-5 flex w-fit">
          <FamBitWordmark compact />
        </Link>
        <section className="rounded-lg border border-white/8 bg-[#14162A]/95 p-6 text-center shadow-2xl shadow-black/35 sm:p-7">
          <div className="mb-5 flex justify-center">
            <FamBitWordmark markSize={52} showText={false} />
          </div>
          <p className="mb-2 text-center text-xs font-black uppercase text-[#4EEDB0]">
            Admin protection
          </p>
          <h1 className="text-2xl font-black leading-tight text-white">
            {familyName ? `${adminModeLabel} - ${familyName}` : adminModeLabel}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/62">{enterPinLabel}</p>
          {isParentAdmin && adminPinHash === null && (
            <p className="mt-4 rounded-lg border border-[#4EEDB0]/35 bg-[#4EEDB0]/10 px-3 py-2 text-sm leading-5 text-[#4EEDB0]">
              No Admin PIN is set yet. Press confirm to continue and set one.
            </p>
          )}
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') void onSubmit(); }}
            placeholder="••••"
            className="mt-6 w-full rounded-lg border border-white/10 bg-[#111224] p-4 text-center text-2xl font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
            style={{ minHeight: 'var(--touch-target)' }}
          />
          {error && (
            <p className="mt-3 rounded-lg border border-[#FF7BAC]/35 bg-[#FF7BAC]/10 px-3 py-2 text-sm leading-5 text-[#FFB8CF]">
              {error}
            </p>
          )}
          <button
            onClick={() => { void onSubmit(); }}
            disabled={adminPinHash === undefined}
            className="mt-4 w-full rounded-lg bg-[#4EEDB0] p-4 font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:bg-white/[0.055] disabled:text-white/36"
            style={{ minHeight: 'var(--touch-target)' }}
          >
            {adminPinHash === undefined ? '…' : confirmLabel}
          </button>
          {!isParentAdmin && !isFamilyOwner && adminPinHash !== undefined && (
            <p className="mt-3 text-xs leading-5 text-white/42">
              부모 계정으로 로그인해야 관리자 설정을 변경할 수 있습니다.
            </p>
          )}
          {isFamilyOwner && adminPinHash !== null && adminPinHash !== undefined && (
            pinResetStep === 'idle' ? (
              <button
                onClick={() => { void onPinReset(); }}
                disabled={pinResetLoading}
                className="mt-4 text-sm font-bold text-[#5B8EFF] transition-colors hover:text-[#8EAFFF] disabled:opacity-50"
              >
                {pinResetLoading ? '인증 코드 발송 중…' : 'PIN을 잊으셨나요? 이메일로 초기화'}
              </button>
            ) : (
              <div className="mt-5 text-left">
                <p className="mb-3 text-center text-xs leading-5 text-white/48">
                  <span className="text-[#4EEDB0]">{authEmail}</span>로 발송된<br />
                  6자리 인증 코드를 입력하세요
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                  onKeyDown={e => e.key === 'Enter' && void onOtpVerify()}
                  placeholder="000000"
                  className="mb-2 w-full rounded-lg border border-white/10 bg-[#111224] p-4 text-center text-2xl font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
                  style={{ minHeight: 'var(--touch-target)' }}
                  autoFocus
                />
                {otpError && <p className="mb-2 text-center text-xs text-[#FFB8CF]">{otpError}</p>}
                <button
                  onClick={() => { void onOtpVerify(); }}
                  disabled={otpLoading || otpCode.length !== 6}
                  className="mb-2 w-full rounded-lg bg-[#4EEDB0] p-4 font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:bg-white/[0.055] disabled:text-white/36"
                  style={{ minHeight: 'var(--touch-target)' }}
                >
                  {otpLoading ? '확인 중…' : '코드 확인 및 PIN 초기화'}
                </button>
                <button
                  onClick={() => { setPinResetStep('idle'); setOtpCode(''); setOtpError(''); }}
                  className="w-full py-2 text-sm font-bold text-white/50 transition-colors hover:text-white"
                >
                  {cancelLabel}
                </button>
              </div>
            )
          )}
          <Link href="/" className="mt-5 block text-sm font-bold text-white/50 transition-colors hover:text-white">← {backLabel}</Link>
          <button
            onClick={() => { void onLogout(); }}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.045] p-3 text-sm font-bold text-[#FFB8CF] transition-colors hover:border-[#FF7BAC]/35 hover:bg-[#FF7BAC]/10"
          >
            {logoutLabel}
          </button>
        </section>
      </div>
    </main>
  );
}
