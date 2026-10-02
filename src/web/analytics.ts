export const analyticsId = 'G-2H9QEBQ64X';
export const analyticsSource = `https://www.googletagmanager.com/gtag/js?id=${analyticsId}`;
export const analyticsSetup = `window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${analyticsId}');`;
export const analyticsMarkup = `<script async src="${analyticsSource}"></script><script>${analyticsSetup}</script>`;
