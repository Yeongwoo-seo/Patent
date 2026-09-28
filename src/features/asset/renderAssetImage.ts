import type { IDBPDatabase } from 'idb';
import { el } from '../../app/dom';
import { getSourceAsset, sourceAssetObjectUrl } from '../../data/repositories/contentRepository';
import type { HoedokshilDB } from '../../data/indexeddb/schema';

/**
 * SourceAsset(바이너리 이미지)을 컨테이너에 그린다. object URL은 이 함수가 만든 <img>가
 * DOM에서 사라질 때까지 유지해야 하므로, 아주 단순하게 페이지 생명주기 동안 revoke하지
 * 않는다(SPA 특성상 화면 전환이 잦아 정교한 해제 시점 관리는 이번 세션 범위 밖 - KNOWN_LIMITATIONS).
 */
export async function renderAssetImage(
  container: HTMLElement,
  assetId: string,
  db: IDBPDatabase<HoedokshilDB>,
  altText: string,
): Promise<void> {
  const asset = await getSourceAsset(assetId, db);
  if (!asset) {
    container.append(el('p', { className: 'muted', text: `이미지를 찾을 수 없음(${assetId})` }));
    return;
  }
  const url = sourceAssetObjectUrl(asset);
  if (!url) {
    container.append(el('p', { className: 'muted', text: '이미지 자산이 아직 업로드되지 않음' }));
    return;
  }
  container.append(
    el('img', {
      src: url,
      alt: altText,
      style: 'max-width:100%;border-radius:8px;border:1px solid var(--border);display:block;margin:8px 0;',
    }),
  );
}
