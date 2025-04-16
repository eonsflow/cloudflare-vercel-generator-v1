
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const templatePath = path.resolve('./template.html');
const workerTemplatePath = path.resolve('./worker-template.js');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { webAppUrl } = req.body;

  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com')) {
    return res.status(400).json({ error: '유효한 Web App URL을 입력해주세요.' });
  }

  const CF_API_TOKEN = process.env.CF_API_TOKEN;
  const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;

  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    return res.status(500).json({ error: 'Cloudflare API 환경변수가 누락되었습니다.' });
  }

  const workerScriptTemplate = fs.readFileSync(workerTemplatePath, 'utf8');
  const replacedScript = workerScriptTemplate.replace(/__WEBAPP_URL__/g, webAppUrl);

  const workerName = 'worker_user_' + Date.now();

  try {
    const workerRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${workerName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/javascript'
      },
      body: replacedScript
    });

    const result = await workerRes.json();

    if (!result.success) {
      return res.status(500).json({ error: 'Cloudflare Worker 생성 실패', detail: result });
    }

    const cloudflareUrl = `https://${workerName}.${process.env.CF_SUBDOMAIN}.workers.dev`;
    const encodedWebAppUrl = encodeURIComponent(webAppUrl);

    const rawTemplate = fs.readFileSync(templatePath, 'utf8');
    const finalHtml = rawTemplate
      .replace(/__SHEET_URL__/g, webAppUrl)
      .replace(/__WORKER_URL__/g, cloudflareUrl)
      .replace(/https:\/\/script\.google\.com\/macros\/s\/[^"')]+/g, webAppUrl)
      .replace(/https:\/\/eonslab\.cuztoz\.workers\.dev/g, cloudflareUrl)
      .replace(/encodeURIComponent\("https:\/\/script\.google\.com\/macros\/s\/[^"')]+\)/g, `"${encodedWebAppUrl}"`);

    res.setHeader('Content-Disposition', 'attachment; filename="자동설치파일.html"');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(finalHtml);

  } catch (err) {
    console.error('❌ 서버 에러:', err);
    res.status(500).json({ error: '서버 오류 발생', detail: err.message });
  }
}
