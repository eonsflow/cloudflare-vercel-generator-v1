function extractKeywords(title) {
  if (!title || typeof title !== "string") return "";
  const stopwords = ["2025", "가이드", "하는법", "방법", "정리", "정보", "추천", "뉴스", "관련", "및", "에서", "으로", "에", "는", "이", "그", "를", "의", "한", "가", "도", "되", "수"];
  const words = title
    .replace(/<[^>]*>/g, '')
    .replace(/[^가-힣a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.toLowerCase())
    .filter(w => w.length >= 2 && !stopwords.includes(w));

  const uniqueWords = [...new Set(words)];
  return uniqueWords.length > 0 ? uniqueWords.slice(0, 5).join(",") : "";
}

async function fetchThumbnailFromItemUrl(itemUrl) {
  try {
    const res = await fetch(itemUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const imgMatch = html.match(/<img[^>]+src=["'](https?:\/\/[^"'>]+\.(jpg|jpeg|png|webp))["']/i);
    return imgMatch?.[1] || "";
  } catch {
    return "";
  }
}

async function extractFromRSS(rssHtml) {
  const isRSS = rssHtml.includes("<rss") || rssHtml.includes("<feed");

  if (isRSS) {
    const firstItem = rssHtml.match(/<item>([\s\S]*?)<\/item>/i)?.[1] || "";
    const rawTitle = firstItem.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
                   || firstItem.match(/<title>(.*?)<\/title>/)?.[1]
                   || "제목 없음";

    let thumbnail =
      firstItem.match(/<media:thumbnail[^>]+url=["'](https?:\/\/[^"']+)["']/i)?.[1] ||
      firstItem.match(/<media:content[^>]+url=["'](https?:\/\/[^"']+)["']/i)?.[1] ||
      firstItem.match(/<description[^>]*><!\[CDATA\[[\s\S]*?<img[^>]+src=["'](https?:\/\/[^"'>]+\.(jpg|jpeg|png|webp))["']/i)?.[1] ||
      firstItem.match(/<img[^>]+src=["'](https?:\/\/[^"'>]+\.(jpg|jpeg|png|webp))["']/i)?.[1] ||
      rssHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)["']/i)?.[1] ||
      "";

    if (!thumbnail) {
      const itemUrl = firstItem.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/)?.[1]
                   || firstItem.match(/<link>(.*?)<\/link>/)?.[1];
      if (itemUrl) {
        thumbnail = await fetchThumbnailFromItemUrl(itemUrl);
      }
    }

    const descriptionContent = firstItem.match(/<description(?:[^>]*)><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] || "";
    const type = descriptionContent.includes("youtube.com/embed") ? "youtube" : "card";
    const keyword = extractKeywords(rawTitle);
    const category = firstItem.match(/<category><!\[CDATA\[(.*?)\]\]><\/category>/)?.[1]
                   || firstItem.match(/<category>(.*?)<\/category>/)?.[1]
                   || "기타";

    return { rawTitle, keyword, thumbnail, category, type };
  }

  const titleMatch = rssHtml.match(/<h2[^>]*class=["']tit_post["'][^>]*>(.*?)<\/h2>/i)
    || rssHtml.match(/<title[^>]*>(.*?)<\/title>/i)
    || rssHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const rawTitle = titleMatch?.[1]?.trim() || "제목 없음";

  const catMatch = rssHtml.match(/<span[^>]*class=["']category["'][^>]*>(.*?)<\/span>/i)
    || rssHtml.match(/<category>(.*?)<\/category>/i);
  const category = catMatch?.[1]?.trim() || "기타";

  let type = "card";
  const embedCheck = rssHtml.includes("youtube.com/embed");
  if (embedCheck) type = "youtube";

  let thumbnail =
    rssHtml.match(/<media:thumbnail[^>]+url=["'](https?:\/\/[^"']+)["']/i)?.[1] ||
    rssHtml.match(/<media:content[^>]+url=["'](https?:\/\/[^"']+)["']/i)?.[1] ||
    rssHtml.match(/<description[^>]*><!\[CDATA\[[\s\S]*?<img[^>]+src=["'](https?:\/\/[^"'>]+\.(jpg|jpeg|png|webp))["']/i)?.[1] ||
    rssHtml.match(/<img[^>]+src=["'](https?:\/\/[^"'>]+\.(jpg|jpeg|png|webp))["']/i)?.[1] ||
    rssHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)["']/i)?.[1] ||
    "";

  let keyword = extractKeywords(rawTitle);
  const keywordFallbackRaw =
    rssHtml.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    rssHtml.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    rssHtml.match(/<p[^>]*>(.*?)<\/p>/is)?.[1];
  const fallbackKeyword = extractKeywords(keywordFallbackRaw || rawTitle);
  if (!keyword || keyword.split(",").length < 2 || fallbackKeyword.split(",").length > keyword.split(",").length) {
    keyword = fallbackKeyword;
  }

  return { rawTitle, keyword, thumbnail, category, type };
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("link");
  const gasUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response("❌ Missing 'link' parameter", {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const rssHtml = await res.text();

    const { rawTitle, keyword, thumbnail, category, type } = await extractFromRSS(rssHtml);

    const gasResponse = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "view",
        link: targetUrl,
        data: { rawTitle, keyword, thumbnail, category, type }
      })
    });

    const gasText = await gasResponse.text();

    return new Response(JSON.stringify({
      status: "✅ success",
      data: { thumbnail, keyword, type, category, rawTitle },
      gasResponse: gasText
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    return new Response("❌ 오류 발생: " + err.toString(), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
}
