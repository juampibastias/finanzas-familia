# Finanzas Familia

App de gestión financiera familiar para 2 usuarios (Juan + Julieta). Next.js 15 + MongoDB + NextAuth v5.

## Setup local (paso a paso)

### 1. Pre-requisitos

- Node.js >= 20 LTS
- Cuenta en MongoDB Atlas (free tier M0 alcanza)
- Cuenta en Vercel (para deploy)
- Cuenta en GitHub

### 2. Instalar dependencias

```bash
cd C:\Users\juanp\Documents\finanzas-familia
npm install
```

### 3. Crear cluster Mongo

1. Entrar a https://cloud.mongodb.com → New Project → "Finanzas Familia"
2. Build a Database → M0 free → región `us-east-1` (N. Virginia) — colocated con Vercel
3. **Database Access** → Add new database user:
   - Username: `finanzas_app`
   - Password: generar y guardar
   - Built-in role: **Read and write to any database** (lo restringiremos al crear la db)
4. **Network Access** → Add IP → `0.0.0.0/0` (necesario para Vercel free tier)
5. Connect → Drivers → copiar connection string

### 4. Configurar `.env.local`

```bash
cp .env.local.template .env.local
```

Editar `.env.local`:

- `MONGODB_URI`: pegar la connection string, reemplazar `<password>` por la real, agregar el nombre de la db (`/finanzas-familia`) antes del `?`
- `NEXTAUTH_SECRET`: generar con `openssl rand -base64 32` (o `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` si no tenés openssl)
- `NEXTAUTH_URL`: `http://localhost:3000` para dev

### 5. Seed inicial

```bash
npm run seed
```

Crea los 2 usuarios + cuentas + categorías base. Reportá si tira error de conexión.

Credenciales seed:
- `juan@finanzas.app` / `Cambiar2026!`
- `julieta@finanzas.app` / `Cambiar2026!`

Al primer login te redirige a `/cambiar-password`.

### 6. Correr en dev

```bash
npm run dev
```

Abrir http://localhost:3000

## Deploy en Vercel

### 1. Crear repo en GitHub

```bash
git init
git add .
git commit -m "feat: initial commit"
gh repo create finanzas-familia --private --source=. --remote=origin --push
# o manualmente:
# git remote add origin https://github.com/USER/finanzas-familia.git
# git push -u origin main
```

### 2. Importar en Vercel

1. https://vercel.com/new → seleccionar el repo
2. **Environment Variables**: cargar las 3 (MONGODB_URI, NEXTAUTH_SECRET, NEXTAUTH_URL — esta última será la URL de Vercel)
3. Deploy

### 3. Seed productivo

Apuntar local a la db de prod y correr `npm run seed`:

```bash
MONGODB_URI="..." NEXTAUTH_SECRET="..." NEXTAUTH_URL="https://..." npm run seed
```

### 4. Tag v1.0.0

```bash
git tag -a v1.0.0 -m "MVP completo"
git push origin v1.0.0
```

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Correr build prod local |
| `npm run lint` | Lint con eslint |
| `npm run typecheck` | TypeScript check sin emitir |
| `npm run seed` | Seed inicial de la DB |

## Estructura

```
src/
├── app/                  # App Router
│   ├── (app)/            # Rutas protegidas con sidebar layout
│   │   ├── cuentas/
│   │   ├── movimientos/
│   │   ├── pagos/
│   │   ├── presupuesto/
│   │   └── config/
│   ├── api/              # Route handlers
│   ├── login/
│   └── cambiar-password/
├── components/
│   └── ui/               # shadcn components
├── lib/
│   ├── models/           # Mongoose schemas
│   ├── db.ts
│   ├── format.ts
│   └── utils.ts
└── auth.ts               # NextAuth v5 config
scripts/
└── seed.ts
```

## Stack

- **Next.js 15** App Router + TypeScript estricto
- **MongoDB** + Mongoose 8
- **NextAuth v5** (Credentials + bcryptjs)
- **Tailwind + shadcn/ui**
- **Recharts** para gráficos
- **date-fns** locale es-AR
- **sonner** para toasts
- **zod** para validación

## Notas

- Registro deshabilitado; usuarios se crean por seed.
- `mustChangePassword: true` fuerza cambio al primer login.
- Todos los amounts en ARS sin decimales.
- Network access 0.0.0.0/0 en Mongo es necesario para Vercel free tier (no expone passwords; auth sigue activa).
