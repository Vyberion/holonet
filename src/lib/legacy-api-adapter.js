function toHeadersObject(headers) {
  const object = {};
  headers.forEach((value, key) => {
    object[key.toLowerCase()] = value;
  });
  if (!object.host) {
    object.host = new URL(headers.get("origin") || "http://localhost").host || "localhost";
  }
  return object;
}

function canonicalRedirectLocation(location) {
  const value = String(location || "/");
  return value
    .replace(/^\/index\.html(?=([?#]|$))/, "/")
    .replace(/^\/(.+?)\.html(?=([?#]|$))/, "/$1");
}

async function readLegacyBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return undefined;

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const buffer = Buffer.from(await request.arrayBuffer());
    return buffer.length ? buffer : undefined;
  }

  const text = await request.text();
  if (!text) return "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

function createLegacyResponse() {
  let statusCode = 200;
  const headers = new Headers();
  let responseBody = "";

  const legacy = {
    status(code) {
      statusCode = code;
      return legacy;
    },
    setHeader(name, value) {
      if (Array.isArray(value)) {
        headers.delete(name);
        value.forEach(item => headers.append(name, item));
        return legacy;
      }

      headers.set(name, value);
      return legacy;
    },
    redirect(statusOrUrl, maybeUrl) {
      const status = typeof statusOrUrl === "number" ? statusOrUrl : 302;
      const location = typeof statusOrUrl === "number" ? maybeUrl : statusOrUrl;
      statusCode = status;
      headers.set("Location", canonicalRedirectLocation(location));
      return legacy;
    },
    json(payload) {
      headers.set("Content-Type", "application/json; charset=utf-8");
      responseBody = JSON.stringify(payload);
      return legacy;
    },
    send(payload) {
      responseBody = typeof payload === "string" ? payload : String(payload ?? "");
      return legacy;
    },
    end(payload) {
      if (payload !== undefined) {
        responseBody = typeof payload === "string" ? payload : String(payload ?? "");
      }
      return legacy;
    },
    toResponse() {
      return new Response(responseBody || "", { status: statusCode, headers });
    }
  };

  return legacy;
}

export async function executeLegacyHandler(handler, request) {
  const url = new URL(request.url);
  const legacyReq = {
    method: request.method,
    url: request.url,
    headers: toHeadersObject(request.headers),
    body: await readLegacyBody(request),
    query: Object.fromEntries(url.searchParams.entries())
  };
  const legacyRes = createLegacyResponse();

  await handler(legacyReq, legacyRes);

  return legacyRes.toResponse();
}
