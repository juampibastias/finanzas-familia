const MP_API = "https://api.mercadopago.com";
const MP_AUTH = "https://auth.mercadopago.com";

export interface MPTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
}

export interface MPUserInfo {
  id: number;
  nickname: string;
  email: string;
  first_name: string;
  last_name: string;
  country_id: string;
}

export interface MPPayment {
  id: number;
  date_created: string;
  date_approved: string | null;
  money_release_date: string | null;
  operation_type: string;
  payment_method_id: string;
  payment_type_id: string;
  status: string;
  status_detail: string;
  currency_id: string;
  description: string;
  transaction_amount: number;
  net_received_amount: number;
  total_paid_amount: number;
  payer: { id: number; email: string; first_name?: string; last_name?: string };
  collector_id: number;
}

export interface MPPaymentSearchResult {
  results: MPPayment[];
  paging: { total: number; limit: number; offset: number };
}

function mpAuthUrl(): string {
  return MP_AUTH;
}

export function buildOAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(`${mpAuthUrl()}/authorization`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

export async function exchangeCode(code: string, redirectUri: string): Promise<MPTokenResponse> {
  const res = await fetch(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MP token exchange failed (${res.status}): ${txt}`);
  }
  return res.json() as Promise<MPTokenResponse>;
}

export async function refreshToken(rt: string): Promise<MPTokenResponse> {
  const res = await fetch(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: rt,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`MP refresh failed (${res.status})`);
  return res.json() as Promise<MPTokenResponse>;
}

export async function mpGet<T>(path: string, accessToken: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${MP_API}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MP GET ${path} failed (${res.status}): ${txt}`);
  }
  return res.json() as Promise<T>;
}

export function encodeState(userId: string, accountId: string): string {
  return Buffer.from(JSON.stringify({ userId, accountId, ts: Date.now() })).toString("base64url");
}

export function decodeState(state: string): { userId: string; accountId: string; ts: number } | null {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      userId: string;
      accountId: string;
      ts: number;
    };
  } catch {
    return null;
  }
}

// Auto-categorization keyword rules (keyword → category name hint)
const CATEGORY_RULES: { keywords: string[]; hint: string; kind: "income" | "expense" }[] = [
  { keywords: ["supermercado", "super", "coto", "carrefour", "walmart", "disco", "jumbo", "vea", "dia"], hint: "Supermercado", kind: "expense" },
  { keywords: ["farmacia", "drogueria", "farmacity"], hint: "Salud", kind: "expense" },
  { keywords: ["restaurant", "sushi", "pizza", "burger", "mcdonald", "starbucks", "cafeter", "resto", "bar "], hint: "Restaurantes", kind: "expense" },
  { keywords: ["combustible", "nafta", "shell", "ypf", "axion", "petrobras"], hint: "Transporte", kind: "expense" },
  { keywords: ["uber", "cabify", "remis", "taxi", "colectivo", "subte", "tren"], hint: "Transporte", kind: "expense" },
  { keywords: ["netflix", "spotify", "disney", "amazon", "hbo", "suscripcion", "streaming"], hint: "Entretenimiento", kind: "expense" },
  { keywords: ["edenor", "edesur", "metrogas", "aysa", "fibertel", "claro", "movistar", "personal", "telecom"], hint: "Servicios", kind: "expense" },
  { keywords: ["alquiler", "expensas"], hint: "Vivienda", kind: "expense" },
  { keywords: ["sueldo", "salario", "haberes", "honorarios"], hint: "Sueldo", kind: "income" },
  { keywords: ["transferencia de", "dinero de", "recibiste de", "te envió"], hint: "Transferencias", kind: "income" },
  { keywords: ["transferencia a", "enviaste a", "enviaste dinero", "le enviaste"], hint: "Transferencias", kind: "expense" },
];

export function guessCategory(description: string): { hint: string; kind: "income" | "expense" } | null {
  const lower = description.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { hint: rule.hint, kind: rule.kind };
    }
  }
  return null;
}
