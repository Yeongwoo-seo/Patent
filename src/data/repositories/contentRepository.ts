import type { IDBPDatabase } from 'idb';
import { demoDurationRules, demoGradingSpecs, demoLearningItems } from '../fixtures/demoContent';
import type { GradingSpec, LearningItem, ReviewState, SubjectId } from '../../domain/types';
import type { HoedokshilDB } from '../indexeddb/schema';
import { getDb } from '../indexeddb/db';

/** 20.6: 데모는 운영 진도·실제 기출 통계와 섞이지 않는다. 최초 1회, 비어있을 때만 시딩한다. */
export async function seedDemoContentIfEmpty(db?: IDBPDatabase<HoedokshilDB>): Promise<void> {
  const database = db ?? (await getDb());
  const count = await database.count('learningItems');
  if (count > 0) return;

  const tx = database.transaction(['learningItems', 'gradingSpecs', 'durationRules'], 'readwrite');
  await Promise.all([
    ...demoLearningItems.map((item) => tx.objectStore('learningItems').put(item)),
    ...demoGradingSpecs.map((spec) => tx.objectStore('gradingSpecs').put(spec)),
    ...demoDurationRules.map((rule) => tx.objectStore('durationRules').put(rule)),
  ]);
  await tx.done;
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
