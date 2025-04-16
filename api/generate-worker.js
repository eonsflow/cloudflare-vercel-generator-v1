const fs = require("fs");
const path = require("path");
const getRawBody = require("raw-body");

module.exports = async (req, res) => {
  let webAppUrl = "";

  try {
    const rawBody = await getRawBody(req);
    const body = JSON.parse(rawBody.toString("utf8"));
    webAppUrl = body.webAppUrl;
    console.log("✅ WebApp URL:", webAppUrl);
  } catch (err) {
    console.error("❌ Body 파싱 실패:", err);
    return res.status(500).json({ error: "Body 파싱 실패", detail: err.message });
  }

  const templatePath = path.resolve("template.html");
  const workerPath = path.resolve("worker-template.js");

  try {
    const htmlTemplate = fs.readFileSync(templatePath, "utf8");
    const workerScript = fs.readFileSync(workerPath, "utf8");

    console.log("ENV:", {
      CF_API_TOKEN: !!process.env.CF_API_TOKEN,
      CF_ACCOUNT_ID: !!process.env.CF_ACCOUNT_ID,
      CF_SUBDOMAIN: process.env.CF_SUBDOMAIN,
    });

    console.log("Template Paths:", {
      template: !!htmlTemplate,
      worker: !!workerScript,
    });

    const replaced = htmlTemplate
      .replace(/{{WEB_APP_URL}}/g, webAppUrl)
      .replace(/{{WORKER_SCRIPT}}/g, `<script>\n${workerScript}\n</script>`)
      .replace(/{{SCRIPT_VERSION}}/g, Date.now());

    res.setHeader("Content-Disposition", "attachment; filename=index.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(replaced);
  } catch (err) {
    console.error("❌ 템플릿 생성 실패:", err);
    return res.status(500).json({ error: "템플릿 생성 실패", detail: err.message });
  }
};
