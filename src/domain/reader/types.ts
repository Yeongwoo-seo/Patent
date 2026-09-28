import type { SubjectId } from '../types';

/**
 * 9장 통합 기본서·조문·개념서 리더의 최소 모델.
 * 18.2: TextbookParagraph(책·장·절·문단 ID, 의미 역할, 본문, 자산), ContentLink(출발/도착 ID,
 * 관계 종류, 원문 근거 위치), Annotation(원문 문단/범위, 메모·하이라이트, 생성·수정 이력).
 */
export type ParagraphRole =
  | 'principle'
  | 'exception'
  | 'requirement'
  | 'effect'
  | 'example'
  | 'formula'
  | 'figure'
  | 'narrative'
  /** 개념 정의 문단 (실제 기출 콘텐츠 base.blocks.block_type='definition' 등에서 옴). */
  | 'definition'
  /** 풀이/유도 과정의 한 단계 (block_type='derivation_step'). */
  | 'derivation_step'
  /** 판례 원문 발췌 (content_role='case_original_excerpt', 민법 패키지에서 처음 등장). */
  | 'case_excerpt';

export type TextbookParagraph = {
  id: string;
  subjectId: SubjectId;
  bookId: string;
  chapter: string;
  section: string;
  /** 같은 책 내 표시 순서. 화면 크기가 달라져도 이 값만으로 읽기 위치를 저장하지 않는다(9.1) — id가 영구 참조 키다. */
  paragraphIndex: number;
  role: ParagraphRole;
  text: string;
  assetIds: string[];
  isSynthetic: boolean;
};

export type ContentLinkRelation = 'supports' | 'derived_from' | 'related' | 'contradicts';

/** LearningItem <-> TextbookParagraph 등 콘텐츠 간 다대다 관계(4.1). */
export type ContentLink = {
  id: string;
  fromId: string;
  toId: string;
  relation: ContentLinkRelation;
  sourceLocation: string | null;
};

export type AnnotationKind = 'highlight' | 'note';

/** 9.1: 사용자 메모·형광펜은 원본 텍스트와 분리 저장한다. 자동 약점 강조와는 별도 엔터티(9.2). */
export type Annotation = {
  id: string;
  learnerId: string;
  paragraphId: string;
  kind: AnnotationKind;
  color: string | null;
  text: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};
