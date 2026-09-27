/** 로컬 모드 기본 학습자/기기 식별자. 19.6: 로그인 없이 로컬 사용 가능. */
export const LOCAL_LEARNER_ID = 'local';

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const DEVICE_ID_KEY = 'hoedokshil.deviceId';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

let deviceSequenceCounter = 0;
export function nextDeviceSequence(): number {
  deviceSequenceCounter += 1;
  return deviceSequenceCounter;
}

export const sessionId = uuid();

export function newCorrelationId(): string {
  return uuid();
}
