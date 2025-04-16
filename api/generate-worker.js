const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { webAppUrl } = body;

    if (!webAppUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing Web App URL' }),
      };
    }

    const scriptPath = path.join(__dirname, '../../worker-template.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    const replacedScript = scriptContent.replace(/__WEBAPP_URL__/g, webAppUrl);

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/workers/scripts/worker_user_${Date.now()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/javascript',
        'Authorization': `Bearer ${process.env.CF_API_TOKEN}`
      },
      body: replacedScript
    });

    const result = await response.json();

    if (result.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: '✅ Worker 생성 완료', result })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ status: '❌ Cloudflare 응답 실패', result })
      };
    }
  } catch (err) {
    console.error('❌ Netlify 함수 오류:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '서버 내부 오류 발생', detail: err.message })
    };
  }
};