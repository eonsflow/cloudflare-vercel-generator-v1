import fetch from 'node-fetch';

const workerTemplate = `
addEventListener('fetch', event => {
  event.respondWith(
    fetch('__WEBAPP_URL__')
  )
})
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { webAppUrl } = req.body;

    if (!webAppUrl) {
      return res.status(400).json({ error: 'Missing Web App URL' });
    }

    const replacedScript = workerTemplate.replace(/__WEBAPP_URL__/g, webAppUrl);

    const cfRes = await fetch(
      \`https://api.cloudflare.com/client/v4/accounts/\${process.env.CF_ACCOUNT_ID}/workers/scripts/worker_user_\${Date.now()}\`,
      {
        method: 'PUT',
        headers: {
          'Authorization': \`Bearer \${process.env.CF_API_TOKEN}\`,
          'Content-Type': 'application/javascript',
        },
        body: replacedScript,
      }
    );

    const result = await cfRes.json();

    if (!cfRes.ok || !result.success) {
      console.error('❌ Cloudflare 응답 실패:', result);
      return res.status(500).json({ error: 'Cloudflare Worker 생성 실패', result });
    }

    res.status(200).json({ status: '✅ Worker 생성 완료', result });
  } catch (error) {
    console.error('❌ 서버 오류:', error);
    res.status(500).json({ error: '서버 오류 발생', detail: error.message });
  }
}
