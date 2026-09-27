import type { SubjectGroup } from '../domain/types';

/**
 * 17.3: localStorage는 아주 작은 UI 설정에만 사용하고, 핵심 학습 데이터의 원본으로 쓰지 않는다.
 * 시간대/하루 경계/과목 가중치는 여기 해당하는 소규모 설정이다.
 */
export type AppSettings = {
  timeZone: string;
  dayBoundaryMinutes: number;
  settingsVersion: string;
  subjectGroupWeights: Record<SubjectGroup, number>;
};

const KEY = 'hoedokshil.settings.v1';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  // 11.3: 초기 시간대는 Australia/Sydney, 하루 경계는 00:00로 제안(설정에서 변경 가능).
  timeZone: 'Australia/Sydney',
  dayBoundaryMinutes: 0,
  settingsVersion: 'v1',
  // 12.4: 초기 대분류 가중치는 동일 비중.
  subjectGroupWeights: { civil_law: 1, ip_law: 1, science: 1 },
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 17.3: 브라우저 저장소는 백업이 아니다 — 실패해도 앱은 계속 동작해야 한다.
  }
}
