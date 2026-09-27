import { openDB, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, type HoedokshilDB } from './schema';

let dbPromise: Promise<IDBPDatabase<HoedokshilDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<HoedokshilDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HoedokshilDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const attemptEvents = db.createObjectStore('attemptEvents', { keyPath: 'eventId' });
        attemptEvents.createIndex('byItem', 'itemId');
        attemptEvents.createIndex('byStudyDay', 'studyDay');
        attemptEvents.createIndex('byLearner', 'learnerId');

        const exposureEvents = db.createObjectStore('exposureEvents', { keyPath: 'eventId' });
        exposureEvents.createIndex('byItem', 'itemId');

        const reviewStates = db.createObjectStore('reviewStates', {
          keyPath: ['learnerId', 'itemId', 'learningEpoch'],
        });
        reviewStates.createIndex('byLearner', 'learnerId');
        reviewStates.createIndex('byDueStudyDay', 'dueStudyDay');

        const learningItems = db.createObjectStore('learningItems', { keyPath: 'id' });
        learningItems.createIndex('bySubject', 'subjectId');

        db.createObjectStore('gradingSpecs', { keyPath: 'id' });

        const durationRules = db.createObjectStore('durationRules', { keyPath: 'id' });
        durationRules.createIndex('bySubject', 'subjectId');

        const syncOutbox = db.createObjectStore('syncOutbox', { keyPath: 'outboxId' });
        syncOutbox.createIndex('byStatus', 'status');

        const timeSegments = db.createObjectStore('timeSegments', { keyPath: 'id' });
        timeSegments.createIndex('byDate', 'date');

        const plannerBlocks = db.createObjectStore('plannerBlocks', { keyPath: 'id' });
        plannerBlocks.createIndex('byDate', 'date');

        const dailyPlans = db.createObjectStore('dailyPlans', {
          keyPath: ['learnerId', 'studyDay', 'planVersion'],
        });
        dailyPlans.createIndex('byStudyDay', 'studyDay');
      },
    });
  }
  return dbPromise;
}

/**
 * 캐시된 연결을 닫고 초기화한다. 연결을 닫지 않고 초기화하면 이후
 * indexedDB.deleteDatabase 호출이 열린 커넥션 때문에 blocked 상태로 멈출 수 있다.
 * 테스트의 DB 초기화와, 설정 화면의 "로컬 데이터 초기화" 모두에서 사용한다.
 */
export async function closeDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}
