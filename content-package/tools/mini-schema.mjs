// 의존성 없는 JSON Schema(draft-07) 부분집합 검증기.
// type/required/properties/items/enum/const/pattern/minLength/minItems/minimum만 지원한다.
// ajv 등 외부 패키지를 쓰지 않는 이유: 이 패키지의 "의존 패키지" 항목을 0으로 유지하고,
// 검증 로직 전체를 감사(audit)하기 쉽게 하기 위함(README_FOR_CLAUDE.md에 기록).

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function validateAgainstSchema(schema, value, path = '$') {
  const errors = [];

  function check(schema, value, path) {
    if (schema.const !== undefined) {
      if (value !== schema.const) errors.push(`${path}: const 위반 (기대값 ${JSON.stringify(schema.const)}, 실제 ${JSON.stringify(value)})`);
      return;
    }
    if (schema.enum) {
      if (!schema.enum.includes(value)) errors.push(`${path}: enum 위반 (허용값 ${JSON.stringify(schema.enum)}, 실제 ${JSON.stringify(value)})`);
      return;
    }
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const actual = typeOf(value);
      const normalized = actual === 'number' && Number.isInteger(value) ? ['number', 'integer'] : [actual];
      if (!types.some((t) => normalized.includes(t))) {
        errors.push(`${path}: type 위반 (기대 ${JSON.stringify(schema.type)}, 실제 ${actual})`);
        return;
      }
    }
    if (schema.pattern && typeof value === 'string') {
      if (!new RegExp(schema.pattern).test(value)) errors.push(`${path}: pattern 위반 (${schema.pattern})`);
    }
    if (schema.minLength !== undefined && typeof value === 'string' && value.length < schema.minLength) {
      errors.push(`${path}: minLength 위반 (>=${schema.minLength} 필요)`);
    }
    if (schema.minItems !== undefined && Array.isArray(value) && value.length < schema.minItems) {
      errors.push(`${path}: minItems 위반 (>=${schema.minItems} 필요)`);
    }
    if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
      errors.push(`${path}: minimum 위반 (>=${schema.minimum} 필요)`);
    }
    if (schema.type === 'object' || (value !== null && typeof value === 'object' && !Array.isArray(value) && schema.properties)) {
      for (const key of schema.required ?? []) {
        if (!(key in value)) errors.push(`${path}: 필수 필드 누락 '${key}'`);
      }
      for (const [key, subSchema] of Object.entries(schema.properties ?? {})) {
        if (key in value) check(subSchema, value[key], `${path}.${key}`);
      }
    }
    if (Array.isArray(value) && schema.items) {
      value.forEach((item, i) => check(schema.items, item, `${path}[${i}]`));
    }
    for (const cond of schema.allOf ?? []) {
      if (matches(cond.if, value)) check(cond.then, value, path);
    }
  }

  function matches(ifSchema, value) {
    if (!ifSchema?.properties) return false;
    return Object.entries(ifSchema.properties).every(([key, sub]) => {
      if (sub.const !== undefined) return value?.[key] === sub.const;
      return true;
    });
  }

  check(schema, value, path);
  return errors;
}
