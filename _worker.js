export default {
  async fetch(request, env, ctx) {
    const ORIGIN_HOST = "autonomous-squirrel-minitormhs-b7d48f93.apps.mistral.run"; // 👈 REPLACE THIS
    const url = new URL(request.url);
    url.hostname = ORIGIN_HOST;

    // Create a new request to the origin, preserving headers (incl. Range)
    const originRequest = new Request(url.toString(), request);
    originRequest.headers.set("Host", ORIGIN_HOST); // Set correct Host header

    // Fetch from your download server
    const response = await fetch(originRequest);

    // Return the response to the client.
    // Using `response.body` (a ReadableStream) streams the file
    // without buffering it in the Worker's memory.
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  },
};