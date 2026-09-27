export type ElProps = Record<string, unknown> & { text?: string; style?: string };

/**
 * document.createElement + 속성 대입 헬퍼.
 * `style`은 CSSStyleDeclaration에 문자열을 직접 대입할 수 없으므로(strict mode에서 TypeError)
 * cssText로 별도 처리한다.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { text, style, ...rest } = props;
  Object.assign(node, rest);
  if (style) node.style.cssText = style;
  if (text) node.textContent = text;
  for (const c of children) node.append(c);
  return node;
}
