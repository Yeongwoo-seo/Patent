import type { IDBPDatabase } from 'idb';
import type {
  AnalysisUnit,
  EvidenceLink,
  ExamHint,
  ExamQuestion,
  ExamReviewQuestion,
  ExplanationSegment,
  FormulaRecord,
} from '../../domain/exam/types';
import type { HoedokshilDB } from '../indexeddb/schema';
import { getDb } from '../indexeddb/db';

export async function getExamQuestion(id: string, db?: IDBPDatabase<HoedokshilDB>): Promise<ExamQuestion | undefined> {
  const database = db ?? (await getDb());
  return database.get('examQuestions', id);
}

export async function getAnalysisUnit(id: string, db?: IDBPDatabase<HoedokshilDB>): Promise<AnalysisUnit | undefined> {
  const database = db ?? (await getDb());
  return database.get('analysisUnits', id);
}

export async function getAnalysisUnitsForQuestion(
  questionId: string,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<AnalysisUnit[]> {
  const database = db ?? (await getDb());
  return database.getAllFromIndex('analysisUnits', 'byQuestion', questionId);
}

export async function getEvidenceLinksForAnalysisUnit(
  analysisUnitId: string,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<EvidenceLink[]> {
  const database = db ?? (await getDb());
  return database.getAllFromIndex('evidenceLinks', 'byAnalysisUnit', analysisUnitId);
}

export async function getExplanationSegmentsForQuestion(
  questionId: string,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<ExplanationSegment[]> {
  const database = db ?? (await getDb());
  return database.getAllFromIndex('explanationSegments', 'byQuestion', questionId);
}

export async function getExplanationSegment(
  id: string,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<ExplanationSegment | undefined> {
  const database = db ?? (await getDb());
  return database.get('explanationSegments', id);
}

export async function getFormulasForBlock(blockId: string, db?: IDBPDatabase<HoedokshilDB>): Promise<FormulaRecord[]> {
  const database = db ?? (await getDb());
  return database.getAllFromIndex('formulas', 'byBlock', blockId);
}

export async function getHintsForQuestion(questionId: string, db?: IDBPDatabase<HoedokshilDB>): Promise<ExamHint[]> {
  const database = db ?? (await getDb());
  return database.getAllFromIndex('hints', 'byQuestion', questionId);
}

export async function getReviewQuestionsForQuestion(
  questionId: string,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<ExamReviewQuestion[]> {
  const database = db ?? (await getDb());
  return database.getAllFromIndex('reviewQuestions', 'byQuestion', questionId);
}
