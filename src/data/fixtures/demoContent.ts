/**
 * 20.6 데모 데이터 — 아홉 세부 과목의 도메인 엔진/UI를 검증하기 위한 테스트용 가상 자료.
 *
 * 절대 규칙:
 * - 실재 사건번호, 실제 기출 연도, 실제 조문 번호/정답을 사용하지 않는다.
 * - 모든 항목은 isSynthetic=true이며 화면에 "테스트용 가상 자료"로 노출한다.
 * - 법률 항목의 LegalValidity.verification은 'unverified'로 두고, 근거 없는 학습용 설명은
 *   whyEvidenceType='pedagogical_inference' 또는 'unavailable'로 명시한다.
 */
import type {
  DurationRule,
  GradingSpec,
  LearningItem,
  LegalValidity,
} from '../../domain/types';
import type { ContentLink, TextbookParagraph } from '../../domain/reader/types';

const SYN = '(테스트용 가상 자료) ';

function unverifiedValidity(overrides: Partial<LegalValidity> = {}): LegalValidity {
  return {
    referenceDate: null,
    effectiveFrom: null,
    effectiveTo: null,
    applicationConditions: [],
    transitionalProvisionRefs: [],
    sourceRefs: [],
    verification: 'unverified',
    verifiedAt: null,
    verifiedBy: null,
    ...overrides,
  };
}

export const demoLearningItems: LearningItem[] = [
  // ---- 민법: 선지, 판례 법리 (5장) ----
  {
    id: 'demo-civil-statement-1',
    subjectId: 'civil',
    kind: 'legal_statement',
    sourceContentId: 'demo-civil-mcq-1',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['civil-총칙-신의칙'],
    relatedItemIds: [],
    requiredAssetIds: [],
    availableContexts: ['micro', 'audio'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-civil-statement-1-spec',
    verification: 'unverified',
    isSynthetic: true,
    prompt: SYN + '가상 판례에서 갑은 신의칙 위반을 이유로 항변할 수 있다고 본다.',
  },
  {
    id: 'demo-civil-statement-2',
    subjectId: 'civil',
    kind: 'legal_statement',
    sourceContentId: 'demo-civil-mcq-1',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['civil-총칙-신의칙'],
    relatedItemIds: ['demo-civil-statement-1'],
    requiredAssetIds: [],
    availableContexts: ['micro'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-civil-statement-2-spec',
    verification: 'unverified',
    isSynthetic: true,
    prompt: SYN + '위 사례에서 사실관계가 달라져 을이 먼저 의무를 이행했다면 결론이 달라진다.',
  },

  // ---- 특허법: 조문·절차·기간 (6장) ----
  {
    id: 'demo-patent-procedure-1',
    subjectId: 'patent',
    kind: 'procedure',
    sourceContentId: 'demo-patent-src-1',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['patent-출원-심사청구'],
    relatedItemIds: [],
    requiredAssetIds: [],
    availableContexts: ['micro', 'focused'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-patent-procedure-1-spec',
    verification: 'unverified',
    isSynthetic: true,
    prompt: SYN + '가상 특허법상 출원인은 출원일로부터 정해진 기간 내에 심사청구를 하지 않으면 취하 간주된다.',
  },
  {
    id: 'demo-patent-duration-1',
    subjectId: 'patent',
    kind: 'duration',
    sourceContentId: 'demo-patent-src-2',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['patent-기간-심사청구'],
    relatedItemIds: [],
    requiredAssetIds: [],
    availableContexts: ['micro', 'focused'],
    canStandaloneOX: false,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-patent-duration-1-spec',
    verification: 'unverified',
    isSynthetic: true,
    prompt: SYN + '가상 특허법 제99조: 심사청구 기간의 기산점과 기간을 고르시오.',
  },

  // ---- 실용신안법: 특허와 나란히, 별도 이력 (6.2) ----
  {
    id: 'demo-utility-duration-1',
    subjectId: 'utility',
    kind: 'duration',
    sourceContentId: 'demo-utility-src-1',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['utility-기간-심사청구'],
    relatedItemIds: ['demo-patent-duration-1'],
    requiredAssetIds: [],
    availableContexts: ['micro', 'focused'],
    canStandaloneOX: false,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-utility-duration-1-spec',
    verification: 'unverified',
    isSynthetic: true,
    prompt:
      SYN +
      '가상 실용신안법 제77조: 특허법 관련 규정을 준용하되 기간이 다르게 정해진 경우를 고르시오. (특허 항목과 정답·이력을 공유하지 않음)',
  },

  // ---- 상표법: 표장 이미지 연결 (6.3) ----
  {
    id: 'demo-trademark-case-1',
    subjectId: 'trademark',
    kind: 'case_application',
    sourceContentId: 'demo-trademark-src-1',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['trademark-식별력'],
    relatedItemIds: [],
    requiredAssetIds: ['demo-asset-trademark-mark-1'],
    availableContexts: ['focused'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-trademark-case-1-spec',
    verification: 'unverified',
    isSynthetic: true,
    prompt: SYN + '표장 이미지(자산 누락됨 — 정상 풀이 가능 상태 아님)를 보고 식별력 여부를 판단한다.',
  },

  // ---- 디자인보호법: 도면+사실관계, 요건/기간 (6.1, 6.3) ----
  {
    id: 'demo-design-procedure-1',
    subjectId: 'design',
    kind: 'procedure',
    sourceContentId: 'demo-design-src-1',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['design-등록요건'],
    relatedItemIds: [],
    requiredAssetIds: [],
    availableContexts: ['micro', 'focused'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-design-procedure-1-spec',
    verification: 'unverified',
    isSynthetic: true,
    prompt: SYN + '가상 디자인보호법상 신규성 상실의 예외를 주장할 수 있는 기간을 고르시오.',
  },

  // ---- 물리: 공식 회상 vs 독립 계산 풀이를 분리 (8.2) ----
  {
    id: 'demo-physics-formula-recall-1',
    subjectId: 'physics',
    kind: 'formula_recall',
    sourceContentId: 'demo-physics-src-1',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['physics-역학-뉴턴법칙'],
    relatedItemIds: ['demo-physics-independent-1'],
    requiredAssetIds: [],
    availableContexts: ['micro'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-physics-formula-recall-1-spec',
    verification: 'verified',
    isSynthetic: true,
    prompt: SYN + 'F=ma에서 가속도 a의 단위는 m/s^2이다.',
  },
  {
    id: 'demo-physics-independent-1',
    subjectId: 'physics',
    kind: 'independent_problem',
    sourceContentId: 'demo-physics-src-2',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['physics-역학-뉴턴법칙'],
    relatedItemIds: ['demo-physics-formula-recall-1'],
    requiredAssetIds: [],
    availableContexts: ['focused'],
    canStandaloneOX: false,
    requiresIndependentSolve: true,
    gradingSpecId: 'demo-physics-independent-1-spec',
    verification: 'verified',
    isSynthetic: true,
    prompt: SYN + '질량 2kg 물체에 10N의 힘이 작용할 때 가속도(m/s^2)를 계산하시오.',
  },

  // ---- 화학: 개념형/계산형 분리 (8.3) ----
  {
    id: 'demo-chemistry-concept-1',
    subjectId: 'chemistry',
    kind: 'concept_ox',
    sourceContentId: 'demo-chemistry-src-1',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['chemistry-몰농도'],
    relatedItemIds: ['demo-chemistry-independent-1'],
    requiredAssetIds: [],
    availableContexts: ['micro'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-chemistry-concept-1-spec',
    verification: 'verified',
    isSynthetic: true,
    prompt: SYN + '몰농도(M)는 용액 1L에 녹아있는 용질의 몰수이다.',
  },
  {
    id: 'demo-chemistry-independent-1',
    subjectId: 'chemistry',
    kind: 'independent_problem',
    sourceContentId: 'demo-chemistry-src-2',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['chemistry-몰농도'],
    relatedItemIds: ['demo-chemistry-concept-1'],
    requiredAssetIds: [],
    availableContexts: ['focused'],
    canStandaloneOX: false,
    requiresIndependentSolve: true,
    gradingSpecId: 'demo-chemistry-independent-1-spec',
    verification: 'verified',
    isSynthetic: true,
    prompt: SYN + '0.5mol의 NaOH를 물에 녹여 2L 용액을 만들었다. 몰농도(mol/L)를 구하시오.',
  },

  // ---- 생물: 용어 암기와 자료 해석 분리 (8.4) ----
  {
    id: 'demo-biology-concept-1',
    subjectId: 'biology',
    kind: 'concept_ox',
    sourceContentId: 'demo-biology-src-1',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['biology-세포호흡'],
    relatedItemIds: ['demo-biology-sequence-1'],
    requiredAssetIds: [],
    availableContexts: ['micro'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-biology-concept-1-spec',
    verification: 'verified',
    isSynthetic: true,
    prompt: SYN + '미토콘드리아는 세포호흡을 통해 ATP를 생성하는 구조이다.',
  },
  {
    id: 'demo-biology-sequence-1',
    subjectId: 'biology',
    kind: 'independent_problem',
    sourceContentId: 'demo-biology-src-2',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['biology-세포호흡'],
    relatedItemIds: ['demo-biology-concept-1'],
    requiredAssetIds: [],
    availableContexts: ['focused'],
    canStandaloneOX: false,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-biology-sequence-1-spec',
    verification: 'verified',
    isSynthetic: true,
    prompt: SYN + '해당과정 -> 피루브산 산화 -> TCA회로 -> 전자전달계 순서로 배열하시오.',
  },

  // ---- 지구과학: 그림/그래프 해석과 계산 분리 (8.5) ----
  {
    id: 'demo-earth-diagram-1',
    subjectId: 'earth_science',
    kind: 'diagram_interpretation',
    sourceContentId: 'demo-earth-src-1',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: ['earth-지구시스템-판구조론'],
    relatedItemIds: [],
    requiredAssetIds: ['demo-asset-earth-plate-map-1'],
    availableContexts: ['focused'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: 'demo-earth-diagram-1-spec',
    verification: 'unverified',
    isSynthetic: true,
    prompt: SYN + '지도(자산 누락됨)에서 두 판의 상대 운동 방향을 보고 경계 유형을 판단한다.',
  },
];

export const demoGradingSpecs: GradingSpec[] = [
  { id: 'demo-civil-statement-1-spec', kind: 'ox', correctOxValue: 'X', verification: 'unverified', contentRevisionId: 'rev-1' },
  { id: 'demo-civil-statement-2-spec', kind: 'ox', correctOxValue: 'O', verification: 'unverified', contentRevisionId: 'rev-1' },
  { id: 'demo-patent-procedure-1-spec', kind: 'ox', correctOxValue: 'O', verification: 'unverified', contentRevisionId: 'rev-1' },
  {
    id: 'demo-patent-duration-1-spec',
    kind: 'choice',
    correctOptionIds: ['opt-3yr-from-filing'],
    verification: 'unverified',
    contentRevisionId: 'rev-1',
  },
  {
    id: 'demo-utility-duration-1-spec',
    kind: 'choice',
    correctOptionIds: ['opt-different-from-patent'],
    verification: 'unverified',
    contentRevisionId: 'rev-1',
  },
  { id: 'demo-trademark-case-1-spec', kind: 'ox', verification: 'needs_review', contentRevisionId: 'rev-1' },
  { id: 'demo-design-procedure-1-spec', kind: 'choice', correctOptionIds: ['opt-6m'], verification: 'unverified', contentRevisionId: 'rev-1' },
  { id: 'demo-physics-formula-recall-1-spec', kind: 'ox', correctOxValue: 'O', verification: 'verified', contentRevisionId: 'rev-1' },
  {
    id: 'demo-physics-independent-1-spec',
    kind: 'numeric',
    numericExpected: 5,
    numericAbsoluteTolerance: 0.01,
    expectedUnit: 'm/s^2',
    verification: 'verified',
    contentRevisionId: 'rev-1',
  },
  { id: 'demo-chemistry-concept-1-spec', kind: 'ox', correctOxValue: 'O', verification: 'verified', contentRevisionId: 'rev-1' },
  {
    id: 'demo-chemistry-independent-1-spec',
    kind: 'numeric',
    numericExpected: 0.25,
    numericAbsoluteTolerance: 0.005,
    expectedUnit: 'mol/L',
    verification: 'verified',
    contentRevisionId: 'rev-1',
  },
  { id: 'demo-biology-concept-1-spec', kind: 'ox', correctOxValue: 'O', verification: 'verified', contentRevisionId: 'rev-1' },
  {
    id: 'demo-biology-sequence-1-spec',
    kind: 'sequence',
    correctSequence: ['glycolysis', 'pyruvate_oxidation', 'tca_cycle', 'etc'],
    verification: 'verified',
    contentRevisionId: 'rev-1',
  },
  { id: 'demo-earth-diagram-1-spec', kind: 'choice', correctOptionIds: ['opt-divergent'], verification: 'needs_review', contentRevisionId: 'rev-1' },
];

/** choice형 데모 문항의 선택지 표시용 텍스트(정답 집합은 demoGradingSpecs에 있음). */
export const demoChoiceOptions: Record<string, { id: string; label: string }[]> = {
  'demo-patent-duration-1': [
    { id: 'opt-3yr-from-filing', label: '출원일로부터 3년' },
    { id: 'opt-5yr-from-filing', label: '출원일로부터 5년' },
    { id: 'opt-1yr-from-registration', label: '등록일로부터 1년' },
  ],
  'demo-utility-duration-1': [
    { id: 'opt-different-from-patent', label: '특허와 다른 기간이 별도로 정해진다(가상)' },
    { id: 'opt-same-as-patent', label: '특허와 완전히 동일한 기간이 그대로 적용된다' },
  ],
  'demo-design-procedure-1': [
    { id: 'opt-6m', label: '공개일로부터 6개월' },
    { id: 'opt-12m', label: '공개일로부터 12개월' },
  ],
  'demo-trademark-case-1': [],
  'demo-earth-diagram-1': [
    { id: 'opt-divergent', label: '발산 경계' },
    { id: 'opt-convergent', label: '수렴 경계' },
    { id: 'opt-transform', label: '보존 경계' },
  ],
};

/** 6.4 기간 암기 카드 예시 — 특허/실용신안 이력 분리를 보여주기 위한 테스트용 자료 */
export const demoDurationRules: DurationRule[] = [
  {
    id: 'demo-duration-patent-examination-request',
    subjectId: 'patent',
    topicId: 'patent-기간-심사청구',
    actor: '출원인 또는 이해관계인',
    action: '심사청구',
    durationValue: 3,
    durationUnit: 'year',
    startTrigger: '가상 특허출원일',
    clockType: 'absolute_limit',
    secondaryLimit: null,
    exceptions: ['(테스트용 가상 자료) 특정 조약 우선권 주장 시 별도 기산 — 실제 근거 미확보'],
    extensionRule: null,
    legalEffect: '기간 내 심사청구가 없으면 해당 출원은 취하된 것으로 본다(가상 규정).',
    sourceRefs: [],
    validity: unverifiedValidity(),
    whyExplanation: '학습상 이해를 돕기 위한 가상의 취지 설명이며 실제 입법이유가 아니다.',
    whyEvidenceType: 'pedagogical_inference',
  },
  {
    id: 'demo-duration-utility-examination-request',
    subjectId: 'utility',
    topicId: 'utility-기간-심사청구',
    actor: '출원인 또는 이해관계인',
    action: '심사청구',
    durationValue: 3,
    durationUnit: 'year',
    startTrigger: '가상 실용신안출원일',
    clockType: 'absolute_limit',
    secondaryLimit: null,
    exceptions: [],
    extensionRule: null,
    legalEffect: '기간 내 심사청구가 없으면 해당 출원은 취하된 것으로 본다(가상 규정, 특허와 별도 검증 필요).',
    sourceRefs: [],
    validity: unverifiedValidity(),
    whyExplanation: null,
    whyEvidenceType: 'unavailable',
  },
];

/**
 * 9장 리더 최소 구현용 기본서 문단 — 일부 과목(민법·특허·물리)에만 대표로 넣었다.
 * 나머지 과목의 문단은 이번 세션 범위 밖이다(KNOWN_LIMITATIONS.md).
 */
export const demoTextbookParagraphs: TextbookParagraph[] = [
  {
    id: 'demo-para-civil-1',
    subjectId: 'civil',
    bookId: 'demo-civil-basic-book',
    chapter: '총칙',
    section: '신의성실의 원칙',
    paragraphIndex: 1,
    role: 'principle',
    text:
      SYN +
      '신의칙은 권리 행사와 의무 이행이 서로의 신뢰를 저버리지 않는 방식으로 이루어져야 한다는 원칙이다(가상 설명). ' +
      '판례는 사실관계에 따라 신의칙 위반 여부를 개별적으로 판단하며, 하나의 결론을 모든 사안에 그대로 적용하지 않는다.',
    assetIds: [],
    isSynthetic: true,
  },
  {
    id: 'demo-para-patent-1',
    subjectId: 'patent',
    bookId: 'demo-ip-basic-book',
    chapter: '출원·심사',
    section: '심사청구 기간',
    paragraphIndex: 1,
    role: 'requirement',
    text:
      SYN +
      '가상 특허법상 심사청구는 출원일로부터 일정 기간 내에 해야 하며, 기간 내 청구가 없으면 해당 출원은 취하된 것으로 본다. ' +
      '실용신안은 별도 규정을 두므로 특허의 기간을 그대로 적용하지 않는다.',
    assetIds: [],
    isSynthetic: true,
  },
  {
    id: 'demo-para-physics-1',
    subjectId: 'physics',
    bookId: 'demo-science-basic-book',
    chapter: '역학',
    section: '뉴턴의 운동 법칙',
    paragraphIndex: 1,
    role: 'formula',
    text:
      SYN +
      'F=ma는 물체에 작용하는 알짜힘(F)이 질량(m)과 가속도(a)의 곱과 같다는 뉴턴 제2법칙이다. ' +
      '단위는 힘(N), 질량(kg), 가속도(m/s^2)를 사용하며, 알짜힘이 0이면 가속도도 0이다(관성의 법칙과 연결).',
    assetIds: [],
    isSynthetic: true,
  },
];

/** 9.2: 문제 <-> 문단 양방향 연결. relation은 "이 학습 항목이 이 문단에 근거해 판단된다"는 뜻으로 통일한다. */
export const demoContentLinks: ContentLink[] = [
  { id: 'link-civil-1', fromId: 'demo-civil-statement-1', toId: 'demo-para-civil-1', relation: 'derived_from', sourceLocation: '문단 1문장' },
  { id: 'link-civil-2', fromId: 'demo-civil-statement-2', toId: 'demo-para-civil-1', relation: 'derived_from', sourceLocation: '문단 2문장' },
  { id: 'link-patent-1', fromId: 'demo-patent-duration-1', toId: 'demo-para-patent-1', relation: 'derived_from', sourceLocation: '문단 1문장' },
  { id: 'link-patent-2', fromId: 'demo-patent-procedure-1', toId: 'demo-para-patent-1', relation: 'derived_from', sourceLocation: '문단 1문장' },
  { id: 'link-physics-1', fromId: 'demo-physics-formula-recall-1', toId: 'demo-para-physics-1', relation: 'derived_from', sourceLocation: '문단 1문장' },
  { id: 'link-physics-2', fromId: 'demo-physics-independent-1', toId: 'demo-para-physics-1', relation: 'derived_from', sourceLocation: '문단 1문장' },
];
