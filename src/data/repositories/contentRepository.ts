import type { IDBPDatabase } from 'idb';
import {
  demoContentLinks,
  demoDurationRules,
  demoGradingSpecs,
  demoLearningItems,
  demoTextbookParagraphs,
} from '../fixtures/demoContent';
import type { GradingSpec, LearningItem, ReviewState, SubjectId } from '../../domain/types';
import type { ContentLink, TextbookParagraph } from '../../domain/reader/types';
import type { HoedokshilDB } from '../indexeddb/schema';
import { getDb } from '../indexeddb/db';

/**
 * 20.6: 데모는 운영 진도·실제 기출 통계와 섞이지 않는다. 각 store가 비어있을 때만 채운다
 * (store별로 독립 확인 — v1 이후 v2에서 새로 추가된 리더용 store만 있는 기존 설치도
 * 다음 실행에서 자동으로 채워지게 하기 위함. 21.2 "새 앱이 옛 콘텐츠·DB를 읽을 수 있는지"와
 * 같은 원칙).
 */
export async function seedDemoContentIfEmpty(db?: IDBPDatabase<HoedokshilDB>): Promise<void> {
  const database = db ?? (await getDb());

  if ((await database.count('learningItems')) === 0) {
    const tx = database.transaction(['learningItems', 'gradingSpecs', 'durationRules'], 'readwrite');
    await Promise.all([
      ...demoLearningItems.map((item) => tx.objectStore('learningItems').put(item)),
      ...demoGradingSpecs.map((spec) => tx.objectStore('gradingSpecs').put(spec)),
      ...demoDurationRules.map((rule) => tx.objectStore('durationRules').put(rule)),
    ]);
    await tx.done;
  }

  if ((await database.count('textbookParagraphs')) === 0) {
    const tx = database.transaction(['textbookParagraphs', 'contentLinks'], 'readwrite');
    await Promise.all([
      ...demoTextbookParagraphs.map((p) => tx.objectStore('textbookParagraphs').put(p)),
      ...demoContentLinks.map((l) => tx.objectStore('contentLinks').put(l)),
    ]);
    await tx.done;
  }
}

export async function getAllLearningItems(db?: IDBPDatabase<HoedokshilDB>): Promise<LearningItem[]> {
  const database = db ?? (await getDb());
  return database.getAll('learningItems');
}

export async function getLearningItemsBySubject(
  subjectId: SubjectId,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<LearningItem[]> {
  const database = db ?? (await getDb());
  return database.getAllFromIndex('learningItems', 'bySubject', subjectId);
}

export async function getGradingSpec(id: string, db?: IDBPDatabase<HoedokshilDB>): Promise<GradingSpec | undefined> {
  const database = db ?? (await getDb());
  return database.get('gradingSpecs', id);
}

export async function getReviewState(
  learnerId: string,
  itemId: string,
  learningEpoch: number,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<ReviewState | undefined> {
  const database = db ?? (await getDb());
  return database.get('reviewStates', [learnerId, itemId, learningEpoch]);
}

export async function getAllReviewStatesForLearner(
  learnerId: string,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<ReviewState[]> {
  const database = db ?? (await getDb());
  return database.getAllFromIndex('reviewStates', 'byLearner', learnerId);
}

export async function getAllTextbookParagraphs(db?: IDBPDatabase<HoedokshilDB>): Promise<TextbookParagraph[]> {
  const database = db ?? (await getDb());
  return database.getAll('textbookParagraphs');
}

export async function getTextbookParagraph(
  id: string,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<TextbookParagraph | undefined> {
  const database = db ?? (await getDb());
  return database.get('textbookParagraphs', id);
}

/**
 * 9.2 양방향 연결: ContentLink는 fromId/toId 중 어느 쪽이 문단이고 어느 쪽이 학습 항목인지
 * 방향을 구분하지 않고, 주어진 id의 반대편 id 목록을 반환한다(어느 쪽에서 조회하든 동작).
 */
async function getLinkedCounterpartIds(id: string, db: IDBPDatabase<HoedokshilDB>): Promise<string[]> {
  const [asFrom, asTo] = await Promise.all([
    db.getAllFromIndex('contentLinks', 'byFrom', id),
    db.getAllFromIndex('contentLinks', 'byTo', id),
  ]);
  const counterparts = new Set<string>();
  for (const link of asFrom) counterparts.add(link.toId);
  for (const link of asTo) counterparts.add(link.fromId);
  return [...counterparts];
}

export async function getLinkedParagraphIdsForItem(itemId: string, db?: IDBPDatabase<HoedokshilDB>): Promise<string[]> {
  const database = db ?? (await getDb());
  return getLinkedCounterpartIds(itemId, database);
}

export async function getLinkedItemIdsForParagraph(
  paragraphId: string,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<string[]> {
  const database = db ?? (await getDb());
  return getLinkedCounterpartIds(paragraphId, database);
}

export async function getContentLinks(db?: IDBPDatabase<HoedokshilDB>): Promise<ContentLink[]> {
  const database = db ?? (await getDb());
  return database.getAll('contentLinks');
}
