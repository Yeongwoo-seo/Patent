import './styles.css';
import { getDb } from '../data/indexeddb/db';
import { seedDemoContentIfEmpty } from '../data/repositories/contentRepository';
import { loadSettings } from './settings';
import { renderToday } from '../features/today/renderToday';
import { renderStudy } from '../features/study/renderStudy';
import { renderLibrary } from '../features/library/renderLibrary';
import { renderRecords } from '../features/records/renderRecords';
import { renderSettings } from '../features/settings/renderSettings';

type Tab = 'today' | 'study' | 'library' | 'records' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: '오늘', icon: '☀' },
  { id: 'study', label: '학습', icon: '📘' },
  { id: 'library', label: '서재', icon: '📚' },
  { id: 'records', label: '기록', icon: '🗓' },
  { id: 'settings', label: '설정', icon: '⚙' },
];

async function bootstrap() {
  const appRoot = document.getElementById('app');
  if (!appRoot) throw new Error('missing #app root');

  const db = await getDb();
  await seedDemoContentIfEmpty(db);

  const main = document.createElement('div');
  main.className = 'app-main';
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';

  let currentTab: Tab = 'today';

  function renderNav() {
    nav.replaceChildren();
    for (const tab of TABS) {
      const btn = document.createElement('button');
      btn.setAttribute('aria-current', String(tab.id === currentTab));
      btn.innerHTML = `<span aria-hidden="true">${tab.icon}</span><span>${tab.label}</span>`;
      btn.onclick = () => {
        currentTab = tab.id;
        renderNav();
        void renderCurrentTab();
      };
      nav.append(btn);
    }
  }

  async function renderCurrentTab() {
    const settings = loadSettings();
    switch (currentTab) {
      case 'today':
        await renderToday(main, db, settings);
        break;
      case 'study':
        await renderStudy(main, db, settings);
        break;
      case 'library':
        await renderLibrary(main, db, settings);
        break;
      case 'records':
        await renderRecords(main, db, settings);
        break;
      case 'settings':
        renderSettings(main, db, () => void renderCurrentTab());
        break;
    }
  }

  appRoot.replaceChildren(main, nav);
  renderNav();
  await renderCurrentTab();

  registerServiceWorker();
}

function registerServiceWorker(): void {
  // 17.4: 업데이트는 prompt 방식으로 처리하고, 저장 중 강제로 skipWaiting하지 않는다.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    void import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({
        onNeedRefresh() {
          const banner = document.createElement('div');
          banner.className = 'card';
          banner.style.cssText = 'position:fixed;top:8px;left:8px;right:8px;z-index:20;';
          banner.textContent = '새 버전이 준비되었습니다. ';
          const btn = document.createElement('button');
          btn.className = 'btn btn-primary';
          btn.textContent = '지금 적용';
          btn.onclick = () => location.reload();
          banner.append(btn);
          document.body.append(banner);
        },
      });
    });
  }
}

void bootstrap();
