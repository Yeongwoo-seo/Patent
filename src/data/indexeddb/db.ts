import { openDB, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, type HoedokshilDB } from './schema';

let dbPromise: Promise<IDBPDatabase<HoedokshilDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<HoedokshilDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HoedokshilDB>(DB_NAME, DB_VERSION, {
      // 21.2: 서비스 워커/앱 갱신을 이유로 학습 DB를 삭제하지 않는다 — 기존 store는 그대로
      // 두고, oldVersion 기준으로 새로 필요한 store만 추가한다.
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
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
        }

        if (oldVersion < 2) {
          const textbookParagraphs = db.createObjectStore('textbookParagraphs', { keyPath: 'id' });
          textbookParagraphs.createIndex('bySubject', 'subjectId');

          const contentLinks = db.createObjectStore('contentLinks', { keyPath: 'id' });
          contentLinks.createIndex('byFrom', 'fromId');
          contentLinks.createIndex('byTo', 'toId');

          const annotations = db.createObjectStore('annotations', { keyPath: 'id' });
          annotations.createIndex('byParagraph', 'paragraphId');
        }

        if (oldVersion < 3) {
          db.createObjectStore('sourceAssets', { keyPath: 'id' });
          db.createObjectStore('choiceOptions', { keyPath: 'itemId' });
          db.createObjectStore('contentPackImports', { keyPath: 'id' });
        }

        if (oldVersion < 4) {
          const examQuestions = db.createObjectStore('examQuestions', { keyPath: 'id' });
          examQuestions.createIndex('bySubject', 'subjectId');

          const analysisUnits = db.createObjectStore('analysisUnits', { keyPath: 'id' });
          analysisUnits.createIndex('byQuestion', 'questionId');

          const evidenceLinks = db.createObjectStore('evidenceLinks', { keyPath: 'id' });
          evidenceLinks.createIndex('byAnalysisUnit', 'analysisUnitId');
          evidenceLinks.createIndex('byQuestion', 'questionId');

          const explanationSegments = db.createObjectStore('explanationSegments', { keyPath: 'id' });
          explanationSegments.createIndex('byQuestion', 'questionId');

          const formulas = db.createObjectStore('formulas', { keyPath: 'id' });
          formulas.createIndex('byBlock', 'blockId');

          const hints = db.createObjectStore('hints', { keyPath: 'id' });
          hints.createIndex('byQuestion', 'questionId');

          const reviewQuestions = db.createObjectStore('reviewQuestions', { keyPath: 'id' });
          reviewQuestions.createIndex('byQuestion', 'questionId');
        }
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
