import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Family Habit Dashboard',
  description: 'Privacy Policy for Family Habit Dashboard.',
};

const collectedItems = [
  'Name and email address provided through Google Login',
  'Family member names entered by the user',
  'Habit, task, completion, streak, XP, level, coin, and reward records',
  'Family invitation and family-based membership information',
];

const collectedItemsKo = [
  'Google 로그인을 통해 제공되는 이름 및 이메일 주소',
  '사용자가 입력한 가족 구성원 이름',
  '습관, 과제, 완료 이력, 연속 달성 기록, XP, 레벨, 코인 및 리워드 기록',
  '가족 초대 및 가족 단위 멤버십 정보',
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#232831] bg-[#0f131b] p-5 sm:p-6">
      <h2 className="mb-3 text-lg font-bold text-white sm:text-xl">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-[#c8ccd4] sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#141821] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#4f9cff]">
              Family Habit Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Privacy Policy / 개인정보 처리방침
            </h1>
            <p className="mt-3 text-sm text-[#8a8f99]">
              Effective date: April 24, 2026 / 시행일: 2026년 4월 24일
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-[#4f9cff] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#3d8bed]"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-8 rounded-2xl border border-[#2d3545] bg-[#0b0d12] p-5 text-sm leading-7 text-[#c8ccd4] sm:p-6 sm:text-base">
          <p>
            This Privacy Policy explains how Family Habit Dashboard collects,
            uses, stores, and protects personal information. It is prepared to
            provide transparent notice to users, including users in the Republic
            of Korea, and to support app store privacy disclosure requirements.
          </p>
          <p className="mt-3">
            본 개인정보 처리방침은 Family Habit Dashboard가 개인정보를
            수집, 이용, 보관 및 보호하는 방법을 설명합니다. 본 방침은
            대한민국 이용자를 포함한 모든 이용자에게 개인정보 처리에 관한
            사항을 투명하게 고지하고, 앱 스토어 개인정보 공개 요건을
            충족하기 위해 마련되었습니다.
          </p>
        </div>

        <div className="space-y-5">
          <Section title="1. Data Controller / 개인정보처리자">
            <p>
              The data controller responsible for this service is Heesik Yoon
              (Hee).
            </p>
            <p>
              본 서비스의 개인정보처리자는 Heesik Yoon (Hee)입니다.
            </p>
            <dl className="grid gap-2 rounded-xl bg-[#141821] p-4">
              <div>
                <dt className="font-semibold text-white">Service Name</dt>
                <dd>Family Habit Dashboard</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">Contact Email</dt>
                <dd>
                  <a className="text-[#4f9cff] underline" href="mailto:heesyoon@gmail.com">
                    heesyoon@gmail.com
                  </a>
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="2. Personal Information Collected / 수집하는 개인정보 항목">
            <p>
              Family Habit Dashboard collects the minimum personal information
              necessary to provide the service.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              {collectedItems.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              Family Habit Dashboard는 서비스 제공에 필요한 최소한의
              개인정보를 수집합니다.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              {collectedItemsKo.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>

          <Section title="3. Purpose of Processing / 개인정보 처리 목적">
            <p>
              Personal information is processed for service delivery, user
              identification, family-based data isolation, habit tracking,
              reward management, and account-related support.
            </p>
            <p>
              개인정보는 서비스 제공, 이용자 식별, 가족 단위 데이터 분리,
              습관 관리, 리워드 관리 및 계정 관련 지원을 위해 처리됩니다.
              수집된 개인정보는 위 목적 범위를 초과하여 이용되지 않습니다.
            </p>
          </Section>

          <Section title="4. Retention and Destruction / 보유 및 파기">
            <p>
              Personal information is retained while the user account or family
              workspace remains active. When a user account is deleted or a
              family workspace is dissolved, related personal information is
              permanently destroyed without undue delay, unless retention is
              required by applicable law.
            </p>
            <p>
              개인정보는 이용자 계정 또는 가족 워크스페이스가 활성 상태인
              동안 보유됩니다. 이용자 계정이 삭제되거나 가족 워크스페이스가
              해산되는 경우, 관련 개인정보는 관련 법령상 보존 의무가 있는
              경우를 제외하고 지체 없이 영구 파기됩니다.
            </p>
          </Section>

          <Section title="5. Processors and Infrastructure / 처리위탁 및 인프라">
            <p>
              The service uses trusted third-party infrastructure providers only
              as necessary to operate the application.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Supabase: database, authentication, and backend services</li>
              <li>Vercel: application hosting and deployment</li>
            </ul>
            <p>
              본 서비스는 애플리케이션 운영에 필요한 범위에서 다음 외부
              인프라 제공업체를 이용합니다.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Supabase: 데이터베이스, 인증 및 백엔드 서비스</li>
              <li>Vercel: 애플리케이션 호스팅 및 배포</li>
            </ul>
          </Section>

          <Section title="6. Third-Party Disclosure / 제3자 제공">
            <p>
              Family Habit Dashboard does not sell personal information and does
              not disclose personal information to third parties except where
              necessary for service operation, required by law, or requested by
              the user.
            </p>
            <p>
              Family Habit Dashboard는 개인정보를 판매하지 않으며, 서비스
              운영에 필요한 경우, 법령상 요구되는 경우 또는 이용자의 요청이
              있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.
            </p>
          </Section>

          <Section title="7. User Rights / 이용자의 권리">
            <p>
              Users may request access to, correction of, deletion of, or
              suspension of processing of their personal information at any time.
              Requests may be made through the service admin settings or by
              email.
            </p>
            <p>
              이용자는 언제든지 본인의 개인정보에 대한 열람, 정정, 삭제 또는
              처리정지를 요청할 수 있습니다. 이러한 요청은 서비스의 관리자
              설정 또는 이메일을 통해 할 수 있습니다.
            </p>
            <p>
              Contact:{' '}
              <a className="text-[#4f9cff] underline" href="mailto:heesyoon@gmail.com">
                heesyoon@gmail.com
              </a>
            </p>
          </Section>

          <Section title="8. Security Measures / 안전성 확보 조치">
            <p>
              The service uses Google authentication, Supabase authentication,
              database row-level security, family-based data isolation, and
              access controls to reduce unauthorized access to personal
              information.
            </p>
            <p>
              본 서비스는 Google 인증, Supabase 인증, 데이터베이스 Row Level
              Security, 가족 단위 데이터 분리 및 접근 제어를 통해 개인정보에
              대한 무단 접근을 줄이기 위한 보호 조치를 적용합니다.
            </p>
          </Section>

          <Section title="9. Children and Family Use / 아동 및 가족 이용">
            <p>
              The service is intended for family habit management. Family member
              names and child-related habit records may be entered by a parent
              or guardian. Parents or guardians may access, correct, or delete
              such information through admin settings or by email request.
            </p>
            <p>
              본 서비스는 가족의 습관 관리를 목적으로 합니다. 가족 구성원
              이름 및 자녀 관련 습관 기록은 부모 또는 보호자가 입력할 수
              있습니다. 부모 또는 보호자는 관리자 설정 또는 이메일 요청을
              통해 해당 정보를 열람, 정정 또는 삭제할 수 있습니다.
            </p>
          </Section>

          <Section title="10. Changes to This Policy / 처리방침 변경">
            <p>
              This Privacy Policy may be updated to reflect changes in the
              service, legal requirements, or operational practices. Material
              changes will be made available through this page.
            </p>
            <p>
              본 개인정보 처리방침은 서비스 변경, 법령상 요구사항 또는 운영
              방식의 변경을 반영하기 위해 개정될 수 있습니다. 중요한 변경
              사항은 본 페이지를 통해 고지됩니다.
            </p>
          </Section>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-[#2d3545] bg-[#0b0d12] px-5 py-3 text-sm font-bold text-white transition-colors hover:border-[#4f9cff]"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
