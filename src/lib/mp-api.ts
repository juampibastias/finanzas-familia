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
  operation_type: string; // money_transfer | regular_payment | recurring_payment | account_fund | ...
  payment_method_id: string;
  payment_type_id: string;
  status: string;
  status_detail: string;
  currency_id: string;
  description: string;
  transaction_amount: number;
  point_of_interaction?: {
    type: string;       // INSTORE | CHECKOUT | PSP_TRANSFER | SUBSCRIPTIONS | CREDITS
    sub_type?: string;
  };
  // When user is the RECEIVER (income): collector_id at root, payer as object
  collector_id?: number;
  payer?: { id: string | number; email?: string };
  // When user is the PAYER (expense): payer_id at root, collector as object
  payer_id?: number;
  collector?: { id: number };
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
  // User info lives on mercadolibre.com; payments on mercadopago.com
  const base = path.startsWith("/users") ? "https://api.mercadolibre.com" : MP_API;
  const url = new URL(`${base}${path}`);
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

// Maps description keywords → category name hint
const KEYWORD_RULES: { keywords: string[]; hint: string }[] = [
  { keywords: ["supermercado", "coto", "carrefour", "walmart", "disco ", "jumbo", "vea ", "dia "], hint: "Supermercado" },
  { keywords: ["farmacia", "drogueria", "farmacity"], hint: "Salud" },
  { keywords: ["restaurant", "sushi", "pizza", "burger", "mcdonald", "starbucks", "cafeter", "rappi", "pedidos ya", "pedidosya", "mostaza"], hint: "Restaurantes" },
  { keywords: ["combustible", "nafta", "shell ", "ypf", "axion", "petrobras", "peaje"], hint: "Transporte" },
  { keywords: ["uber", "cabify", "remis", "taxi ", "colectivo", "subte", "tren ", "sube "], hint: "Transporte" },
  { keywords: ["netflix", "spotify", "disney", "amazon prime", "hbo ", "turnesco", "deezer", "apple tv", "paramount"], hint: "Entretenimiento" },
  { keywords: ["movistar", "claro ", "personal ", "telecom", "fibertel", "cablevision", "arnet", "flow "], hint: "Telecomunicaciones" },
  { keywords: ["edenor", "edesur", "metrogas", "aysa", "epec", "ecogas", "luz ", "gas "], hint: "Servicios" },
  { keywords: ["alquiler", "expensas", "consorcio"], hint: "Vivienda" },
  { keywords: ["mercado credito", "cuotas de mercado", "prestamo", "préstamo", "credito personal", "crédito personal"], hint: "Préstamos" },
  { keywords: ["sueldo", "salario", "haberes", "honorarios", "liquidacion", "liquidación"], hint: "Sueldo" },
  { keywords: ["veterinari"], hint: "Mascotas" },
  { keywords: ["colegio", "escuela", "universidad", "instituto", "academia", "jardin"], hint: "Educación" },
  { keywords: ["gimnasio", " gym"], hint: "Deporte" },
  { keywords: ["seguro ", "seguros"], hint: "Seguros" },
];

// Maps hint → fragments that might appear in category names (for fuzzy matching)
export const HINT_FRAGMENTS: Record<string, string[]> = {
  "Supermercado":       ["supermercado", "alimentacion", "comida", "mercado", "compra"],
  "Salud":              ["salud", "medico", "medic", "farmacia", "hospital", "clinica"],
  "Restaurantes":       ["restaurant", "gastronomia", "comida", "delivery", "almuerzo", "cena"],
  "Transporte":         ["transporte", "viaje", "auto", "combustible", "nafta", "movilidad"],
  "Entretenimiento":    ["entretenimiento", "ocio", "suscripcion", "streaming", "digital", "cultura"],
  "Telecomunicaciones": ["telecom", "servicio", "telefon", "celular", "internet", "cable", "comunicacion"],
  "Servicios":          ["servicio", "hogar", "utilidad", "expensa", "luz", "gas", "agua"],
  "Vivienda":           ["vivienda", "alquiler", "hogar", "casa", "expensa", "consorcio", "inmueble"],
  "Préstamos":          ["prestamo", "credito", "deuda", "financ", "cuota"],
  "Compras":            ["compra", "comercio", "gasto", "varios", "otros", "general"],
  "Sueldo":             ["sueldo", "salario", "ingreso", "trabajo", "honorario", "laboral", "renta"],
  "Transferencias":     ["transferencia", "varios", "otros", "envio"],
  "Depositos":          ["deposito", "ingreso", "recarga", "carga", "saldo"],
  "Suscripciones":      ["suscripcion", "streaming", "digital", "entretenimiento", "servicio"],
  "Mascotas":           ["mascota", "veterinari", "animal"],
  "Educación":          ["educacion", "colegio", "escuela", "estudio", "formacion"],
  "Deporte":            ["deporte", "gimnasio", "fitness", "gym"],
  "Seguros":            ["seguro", "poliza"],
};

/**
 * Guess a category hint from a description + MP operation metadata.
 * Returns only a hint string — the actual category KIND is determined by
 * whether the user is collector (income) or payer (expense) in mp-sync.
 */
export function guessCategory(
  description: string,
  operationType?: string,
  poiType?: string,
): { hint: string } | null {
  // High-confidence rules from operation metadata
  if (operationType === "money_transfer") return { hint: "Transferencias" };
  if (operationType === "account_fund") return { hint: "Depositos" };
  if (poiType === "INSTORE") return { hint: "Compras" };
  if (operationType === "recurring_payment") return { hint: "Suscripciones" };
  if (poiType === "CREDITS") return { hint: "Préstamos" };

  const lower = description.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { hint: rule.hint };
    }
  }
  return null;
}

/**
 * Generate a meaningful description when MP sends a generic one.
 */
export function buildDescription(
  rawDescription: string,
  operationType: string,
  txType: "income" | "expense",
): string {
  const genericWords = ["varios", "pago", "cobro", ""];
  const isGeneric = genericWords.includes(rawDescription.trim().toLowerCase());
  if (!isGeneric) return rawDescription.trim();

  switch (operationType) {
    case "money_transfer":
      return txType === "income" ? "Transferencia recibida" : "Transferencia enviada";
    case "account_fund":
      return "Recarga de cuenta MP";
    case "recurring_payment":
      return "Pago suscripción";
    case "regular_payment":
      return txType === "income" ? "Cobro MP" : "Pago MP";
    default:
      return txType === "income" ? "Cobro MP" : "Pago MP";
  }
}
