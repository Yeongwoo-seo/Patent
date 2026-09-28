import type { LearningItem } from '../types';

/**
 * IMPORT_RULES.md 1번을 코드로 구현한다.
 * - new: 기존에 없던 항목 -> 그대로 추가.
 * - unchanged: contentRevisionId·learningEpoch가 둘 다 같음 -> 아무것도 하지 않음.
 * - updated_same_epoch: learningEpoch는 같은데 contentRevisionId만 다름 -> "오탈자·서식"
 *   수준으로 간주해 콘텐츠는 갱신하되 ReviewState는 건드리지 않는다.
 * - new_epoch: 들어오는 learningEpoch가 기존보다 큼 -> 새 학습 버전. 콘텐츠를 갱신하고,
 *   기존 ReviewState/AttemptEvent는 이전 epoch 이력으로 그대로 둔 채 새 epoch는 첫 시도 때
 *   자연히 새 ReviewState로 시작한다(reduceReviewState의 newReviewState).
 * - epoch_conflict: 들어오는 learningEpoch가 기존보다 작음 -> 되돌리기(rollback)로 보이므로
 *   자동 적용하지 않고 사람이 볼 수 있게 남긴다(적용 시 스킵).
 */
export type LearningItemDiffKind = 'new' | 'unchanged' | 'updated_same_epoch' | 'new_epoch' | 'epoch_conflict';

export type LearningItemDiffEntry = {
  id: string;
  kind: LearningItemDiffKind;
  message: string;
};

export function diffLearningItems(existing: readonly LearningItem[], incoming: readonly LearningItem[]): LearningItemDiffEntry[] {
  const existingById = new Map(existing.map((i) => [i.id, i]));
  const entries: LearningItemDiffEntry[] = [];

  for (const item of incoming) {
    const prev = existingById.get(item.id);
    if (!prev) {
      entries.push({ id: item.id, kind: 'new', message: '새 학습 항목' });
      continue;
    }
    if (prev.contentRevisionId === item.contentRevisionId && prev.learningEpoch === item.learningEpoch) {
      entries.push({ id: item.id, kind: 'unchanged', message: '변경 없음' });
      continue;
    }
    if (item.learningEpoch > prev.learningEpoch) {
      entries.push({
        id: item.id,
        kind: 'new_epoch',
        message: `learningEpoch ${prev.learningEpoch} -> ${item.learningEpoch}: 기존 이력 보존, 새 버전 재확인 필요`,
      });
      continue;
    }
    if (item.learningEpoch === prev.learningEpoch) {
      entries.push({
        id: item.id,
        kind: 'updated_same_epoch',
        message: `contentRevisionId ${prev.contentRevisionId} -> ${item.contentRevisionId} (같은 학습 버전 유지)`,
      });
      continue;
    }
    entries.push({
      id: item.id,
      kind: 'epoch_conflict',
      message: `들어오는 learningEpoch(${item.learningEpoch})가 기존(${prev.learningEpoch})보다 낮음 - 적용하지 않음`,
    });
  }

  return entries;
}

/** 패키지에서 빠졌지만 기존 DB에는 있는 id. 삭제하지 않고 검토 대상으로만 보고한다(IMPORT_RULES.md 2번). */
export function findRemovedIds<T extends { id: string }>(existing: readonly T[], incoming: readonly T[]): string[] {
  const incomingIds = new Set(incoming.map((i) => i.id));
  return existing.filter((i) => !incomingIds.has(i.id)).map((i) => i.id);
}

export type SimpleDiffKind = 'new' | 'unchanged' | 'updated';
export type SimpleDiffEntry = { id: string; kind: SimpleDiffKind };

/**
 * learningEpoch 개념이 없는 부속 엔터티(GradingSpec, DurationRule, TextbookParagraph,
 * ContentLink, SourceAsset, ChoiceOptionSet)용 단순 diff. 내용이 완전히 같으면 unchanged,
 * 하나라도 다르면 updated로 본다. 이 엔터티들은 ReviewState와 직접 키로 엮여 있지 않으므로
 * (LearningItem을 통해서만 간접적으로 영향) 세밀한 epoch 분기가 필요 없다.
 */
export function diffById<T extends { id: string }>(existing: readonly T[], incoming: readonly T[]): SimpleDiffEntry[] {
  const existingById = new Map(existing.map((i) => [i.id, i]));
  return incoming.map((item) => {
    const prev = existingById.get(item.id);
    if (!prev) return { id: item.id, kind: 'new' as const };
    return { id: item.id, kind: JSON.stringify(prev) === JSON.stringify(item) ? ('unchanged' as const) : ('updated' as const) };
  });
}
