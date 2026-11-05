export default {
  async fetch(request) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="cdn-site-verification" content="8lWxcOfLZZTKoL"/>
  <title>Site Verification</title>
</head>
<body>
  <h1>Site Verified</h1>
  <p>This page is served by a Cloudflare Worker.</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
        "cache-control": "no-store",
      },
    });
  },
};