import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const templatePath = path.resolve('./template.html');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { webAppUrl } = req.body;

  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com')) {
    return res.status(400).json({ error: '유효한 Web App URL을 입력해주세요.' });
  }

  const workerScript = `
addEventListener('fetch', event => {
  event.respondWith(
    fetch('${webAppUrl}', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
  );
});
`;

  try {
    const workerRes = await fetch(\`https://api.cloudflare.com/client/v4/accounts/\${process.env.CF_ACCOUNT_ID}/workers/scripts/worker_user_\${Date.now()}\`, {
      method: 'PUT',
      headers: {
        'Authorization': \`Bearer \${process.env.CF_API_TOKEN}\`,
        'Content-Type': 'application/javascript'
      },
      body: workerScript
    });

    const result = await workerRes.json();

    if (!result.success) {
      return res.status(500).json({ error: 'Cloudflare Worker 생성 실패', detail: result });
    }

    const cloudflareUrl = \`https://\${process.env.CF_SUBDOMAIN}.workers.dev\`;
    const encodedWebAppUrl = encodeURIComponent(webAppUrl);

    // 템플릿 읽기 및 모든 대상 치환
    const rawTemplate = fs.readFileSync(templatePath, 'utf8');
    const finalHtml = rawTemplate
      .replace(/__SHEET_URL__/g, webAppUrl)
      .replace(/__WORKER_URL__/g, cloudflareUrl)
      .replace(/https:\/\/script\.google\.com\/macros\/s\/[^"')]+/g, webAppUrl)
      .replace(/https:\/\/eonslab\.cuztoz\.workers\.dev/g, cloudflareUrl)
      .replace(/encodeURIComponent\("https:\/\/script\.google\.com\/macros\/s\/[^"')]+\)/g, \`"\${encodedWebAppUrl}"\`);

    res.setHeader('Content-Disposition', 'attachment; filename="자동설치파일.html"');
    res.setHeader('Content-Type', 'text/html');
    res.send(finalHtml);

  } catch (err) {
    console.error('❌ 에러 발생:', err);
    res.status(500).json({ error: '서버 오류 발생', detail: err.message });
  }
}
