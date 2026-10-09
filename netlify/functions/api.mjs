import serverless from "serverless-http";
import app from "../../backend/src/app.js";
import { connectToDatabase, ensureDefaultCategories } from "../../backend/src/config/db.js";

let ready;
let expressHandler;

function prepare() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }
  // Reuse the MongoDB connection across warm invocations.
  ready ??= connectToDatabase(process.env.MONGODB_URI)
    .then(ensureDefaultCategories)
    .catch((error) => {
      ready = undefined;
      throw error;
    });
  return ready;
}

// Translate a web Request into the event shape the Express adapter understands.
async function toEvent(req, context) {
  const url = new URL(req.url);
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.from(await req.arrayBuffer());
  return {
    httpMethod: req.method,
    path: url.pathname,
    rawQuery: url.search.slice(1),
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers: Object.fromEntries(req.headers),
    body: body?.length ? body.toString("base64") : undefined,
    isBase64Encoded: Boolean(body?.length),
    requestContext: { identity: { sourceIp: context.ip } }
  };
}

function toResponse(result) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(result.headers ?? {})) headers.set(name, String(value));
  for (const [name, values] of Object.entries(result.multiValueHeaders ?? {})) {
    for (const value of values) headers.append(name, String(value));
  }
  const body = result.body ? Buffer.from(result.body, result.isBase64Encoded ? "base64" : "utf8") : null;
  return new Response(result.statusCode === 204 || result.statusCode === 304 ? null : body, {
    status: result.statusCode,
    headers
  });
}

export default async (req, context) => {
  try {
    // The health check reports that the API is deployed, even if the database is unreachable.
    if (new URL(req.url).pathname !== "/api/health") await prepare();
  } catch (error) {
    console.error("Unable to start Retain API:", error);
    return Response.json(
      { message: "The service is temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
  expressHandler ??= serverless(app);
  return toResponse(await expressHandler(await toEvent(req, context), {}));
};

export const config = { path: "/api/*" };
