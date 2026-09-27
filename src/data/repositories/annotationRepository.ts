import type { IDBPDatabase } from 'idb';
import type { Annotation } from '../../domain/reader/types';
import type { HoedokshilDB } from '../indexeddb/schema';
import { getDb } from '../indexeddb/db';

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `ann-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getAnnotationsForParagraph(
  paragraphId: string,
  learnerId: string,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<Annotation[]> {
  const database = db ?? (await getDb());
  const all = await database.getAllFromIndex('annotations', 'byParagraph', paragraphId);
  return all.filter((a) => a.learnerId === learnerId);
}

/**
 * 9.1: 사용자 메모·형광펜은 원본 텍스트와 분리 저장한다.
 * 최소 구현: 학습자당 문단당 하이라이트 하나만 토글한다(같은 문단에 여러 색/구간의
 * 하이라이트를 지원하는 것은 이번 세션 범위 밖).
 */
export async function toggleHighlight(
  learnerId: string,
  paragraphId: string,
  now: () => Date,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<boolean> {
  const database = db ?? (await getDb());
  const existing = await getAnnotationsForParagraph(paragraphId, learnerId, database);
  const existingHighlight = existing.find((a) => a.kind === 'highlight');
  if (existingHighlight) {
    await database.delete('annotations', existingHighlight.id);
    return false;
  }
  const nowIso = now().toISOString();
  const annotation: Annotation = {
    id: newId(),
    learnerId,
    paragraphId,
    kind: 'highlight',
    color: '#fef08a',
    text: null,
    createdAtUtc: nowIso,
    updatedAtUtc: nowIso,
  };
  await database.put('annotations', annotation);
  return true;
}
