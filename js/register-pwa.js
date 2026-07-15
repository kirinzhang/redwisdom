(function () {
    const isLocalPreview = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = 'manifest.webmanifest';
    document.head.appendChild(manifest);

    const theme = document.createElement('meta');
    theme.name = 'theme-color';
    theme.content = '#BC2D22';
    document.head.appendChild(theme);

    if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
        window.addEventListener('load', async () => {
            if (isLocalPreview) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(registration => registration.unregister()));
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.filter(key => key.startsWith('redwisdom-')).map(key => caches.delete(key)));
                }
                return;
            }
            await navigator.serviceWorker.register('sw.js?v=4');
        }, { once: true });
    }
})();
