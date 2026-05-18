import type { Lang } from '@/contexts/LanguageContext';

export function buildAdminCopy(lang: Lang) {
  return {
    tabs: {
      settings: lang === 'en' ? 'Settings' : '설정',
      family:   lang === 'en' ? 'Family' : '가족',
      tasks:    lang === 'en' ? 'Tasks' : '습관',
      store:    lang === 'en' ? 'Store' : '상점',
    },
    familyInvitation: lang === 'en' ? 'Family Invitation' : '가족 초대',
    familyInvitationHelp: lang === 'en'
      ? 'Share this code with a family member after they sign in with Google.'
      : '가족 구성원이 Google로 로그인한 뒤 이 코드를 입력하면 합류할 수 있습니다.',
    copyInviteCode: lang === 'en' ? 'Copy invitation code' : '초대 코드 복사',
    regenerateCode: lang === 'en' ? 'Regenerate code' : '초대 코드 다시 만들기',
    generateCode: lang === 'en' ? 'Generate code' : '초대 코드 만들기',
    noInviteCode: lang === 'en'
      ? 'No invitation code yet. Use refresh to generate one.'
      : '초대 코드가 없습니다. 새로고침 버튼으로 생성하세요.',
    language: lang === 'en' ? 'Language' : '언어 설정',
    korean: lang === 'en' ? 'Korean' : '한국어',
    english: lang === 'en' ? 'English' : '영어',
    leaveFamily: lang === 'en' ? 'Leave Family' : '가족 공간에서 나가기',
    leavingFamily: lang === 'en' ? 'Leaving...' : '나가는 중...',
    addMember: lang === 'en' ? 'Add member' : '멤버 추가',
    addMemberHelp: lang === 'en'
      ? 'Add a new profile. You can link a Google account to it later.'
      : '새 프로필을 추가합니다. 나중에 이 프로필에 Google 계정을 연결할 수 있습니다.',
    memberNamePlaceholder: lang === 'en' ? 'Name, e.g. Alex' : '이름 (예: 아람, 주원)',
    adding: lang === 'en' ? 'Adding...' : '추가 중...',
    add: lang === 'en' ? 'Add' : '추가하기',
    cancel: lang === 'en' ? 'Cancel' : '취소',
    uploadAvatar: lang === 'en' ? 'Upload profile photo' : '프로필 사진 업로드',
    moveUp: lang === 'en' ? 'Move up' : '위로 이동',
    moveDown: lang === 'en' ? 'Move down' : '아래로 이동',
    deleteProfile: lang === 'en' ? 'Delete profile' : '프로필 삭제',
    linked: lang === 'en' ? 'Account linked' : '계정 연결됨',
    notLinked: lang === 'en' ? 'No account' : '계정 없음',
    saleOff: lang === 'en' ? 'Sale off' : '세일 꺼짐',
    hidden: lang === 'en' ? 'Hidden' : '숨김',
    visible: lang === 'en' ? 'Visible' : '공개',
    soldOut: lang === 'en' ? 'Sold out' : '품절',
    inStock: lang === 'en' ? 'In stock' : '재고',
    saleLabel: lang === 'en' ? 'Sale label' : '세일 이유 또는 명칭',
    rewardHistory: lang === 'en' ? 'Purchase handling' : '보상 구매 처리함',
    refresh: lang === 'en' ? 'Refresh' : '새로고침',
    pending: lang === 'en' ? 'Pending' : '대기중',
    processed: lang === 'en' ? 'Processed' : '처리 완료',
    markProcessed: lang === 'en' ? 'Mark processed' : '처리 완료',
    processedAt: lang === 'en' ? 'Processed at' : '처리시간',
    processedBy: lang === 'en' ? 'Processed by' : '처리자',
    processorUnknown: lang === 'en' ? 'Admin' : '관리자',
    refunded: lang === 'en' ? 'Refunded' : '환불됨',
    refund: lang === 'en' ? 'Refund' : '환불',
    refundComplete: lang === 'en' ? 'Refund complete' : '환불 완료',
    processing: lang === 'en' ? 'Processing...' : '처리중…',
    noPurchases: lang === 'en' ? 'No purchases yet' : '아직 구매 내역이 없습니다',
    sharedPayment: lang === 'en' ? 'Shared payment' : '같이 결제',
    sharedWith: (a: string, ap: number, b: string, bp: number) =>
      lang === 'en'
        ? `${a} ${ap}pt + ${b} ${bp}pt`
        : `${a} ${ap}pt + ${b} ${bp}pt`,
    sharedBuyer: (a: string, b: string) =>
      lang === 'en' ? `${a} with ${b}` : `${a} · ${b} 공동 구매`,
    parentOnlyAdmin: lang === 'en'
      ? 'Admin controls are parent-only. Invite codes let someone join the family; they do not grant admin access.'
      : '관리자 기능은 부모 전용입니다. 초대 코드는 가족 참여만 허용하며 관리자 권한은 주지 않습니다.',
    dataTrust: lang === 'en' ? 'Data & Trust' : '데이터와 신뢰',
    dataTrustBody: lang === 'en'
      ? 'Export a snapshot before major changes, then act with confidence. Deletion stays permanent; exports stay on your device.'
      : '큰 변경 전에 스냅샷을 내려받아 더 안심하고 작업하세요. 삭제는 영구적이고, 내보낸 파일은 기기에만 저장됩니다.',
    exportSnapshot: lang === 'en' ? 'Export family snapshot' : '가족 스냅샷 내보내기',
    exportingSnapshot: lang === 'en' ? 'Exporting…' : '내보내는 중…',
    exportSnapshotDone: lang === 'en' ? 'Family snapshot downloaded' : '가족 스냅샷을 내려받았습니다',
    exportSnapshotFailed: lang === 'en' ? 'Could not export family snapshot' : '가족 스냅샷을 내보낼 수 없습니다',
  };
}

export type AdminCopy = ReturnType<typeof buildAdminCopy>;
