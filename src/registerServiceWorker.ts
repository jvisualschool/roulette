export function registerServiceWorker() {
  // 로컬 호스트에서는 서비스 워커 등록을 건너뜁니다 (개발 편의성 및 에러 방지)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // 빌드 시 public-url 설정에 따라 경로가 달라질 수 있으므로 유연하게 대처
      const swUrl = './service-worker.js';
      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => console.log('service worker registered', reg.scope))
        .catch((err) => console.error('service worker registration failed', err));
    });
  }
}
