# Jelou B2B Backoffice - Prueba Técnica

> **Prueba Técnica – Senior Backend (Node.js + MySQL + Docker + Lambda)**

Sistema mínimo compuesto por dos APIs (Customers y Orders) y un Lambda orquestador para gestionar pedidos B2B. Las APIs operan sobre MySQL, están documentadas con OpenAPI 3.0 y se levantan con Docker Compose. El Lambda orquesta la creación y confirmación de pedidos, devolviendo un JSON consolidado.

---

## Arquitectura

```
                      ┌──────────────────────┐
                      │  Lambda Orchestrator │
                      │   (puerto 3003)      │
                      └──────────┬───────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
         ┌──────────────────┐     ┌──────────────────┐
         │  Customers API   │◄────│   Orders API     │
         │  (puerto 3001)   │     │  (puerto 3002)   │
         └────────┬─────────┘     └────────┬─────────┘
                  │                         │
                  └────────────┬────────────┘
                               ▼
                      ┌──────────────────┐
                      │      MySQL       │
                      │  (puerto 3306)   │
                      └──────────────────┘
```

## Estructura del Monorepo

```
/
├── customers-api/          # API de clientes (Express, puerto 3001)
│   ├── src/
│   │   ├── index.js        # Entry point + Swagger UI
│   │   ├── config/db.js    # Pool MySQL con retry
│   │   ├── middleware/
│   │   │   ├── auth.js     # JWT + SERVICE_TOKEN auth
│   │   │   └── validate.js # Validación Zod
│   │   ├── routes/
│   │   │   ├── auth.js     # POST /auth/login
│   │   │   ├── customers.js # CRUD clientes
│   │   │   └── internal.js # GET /internal/customers/:id
│   │   ├── migrate.js
│   │   └── seed.js
│   ├── Dockerfile
│   ├── .env.example
│   ├── openapi.yaml        # OpenAPI 3.0
│   └── package.json
├── orders-api/             # API de órdenes y productos (Express, puerto 3002)
│   ├── src/
│   │   ├── index.js        # Entry point + Swagger UI
│   │   ├── config/db.js    # Pool MySQL con retry
│   │   ├── middleware/
│   │   │   ├── auth.js     # JWT auth
│   │   │   └── validate.js # Validación Zod
│   │   ├── routes/
│   │   │   ├── auth.js     # POST /auth/login
│   │   │   ├── products.js # CRUD productos
│   │   │   └── orders.js   # Órdenes + confirm + cancel
│   │   ├── migrate.js
│   │   └── seed.js
│   ├── Dockerfile
│   ├── .env.example
│   ├── openapi.yaml        # OpenAPI 3.0
│   └── package.json
├── lambda-orchestrator/    # Lambda orquestador (Serverless Framework)
│   ├── src/
│   │   ├── handler.js      # Endpoints + landing pages
│   │   └── console.html    # Consola interactiva
│   ├── serverless.yml
│   ├── .env.example
│   └── package.json
├── db/
│   ├── schema.sql          # Esquema de base de datos (5 tablas)
│   └── seed.sql            # Datos de ejemplo (5 clientes, 6 productos)
├── docs/
│   └── TEST-PLAN.md        # Plan de pruebas (29 test cases)
├── docker-compose.yml
└── README.md
```

## Requisitos Previos

- **Docker Desktop** y Docker Compose
- **Node.js 22+** (para Lambda local)
- **npm**

---

## Levantamiento Local con Docker Compose

### 1. Clonar el repositorio

```bash
git clone https://github.com/neuroneter/jelou-technicaltest.git
cd jelou-technicaltest
```

### 2. Copiar archivos de entorno

```bash
cp customers-api/.env.example customers-api/.env
cp orders-api/.env.example orders-api/.env
cp lambda-orchestrator/.env.example lambda-orchestrator/.env
```

### 3. Construir y levantar los servicios

```bash
docker-compose build
docker-compose up -d
```

Esto levanta automáticamente:
- **MySQL 8.0** en `localhost:3306` (ejecuta `schema.sql` y `seed.sql` al iniciar)
- **Customers API** en `http://localhost:3001`
- **Orders API** en `http://localhost:3002`

![Docker Desktop - Containers corriendo](docs/docker-desktop.png)

### 4. Verificar que los servicios están corriendo

```bash
curl http://localhost:3001/health
# {"status":"ok","service":"customers-api","timestamp":"..."}

curl http://localhost:3002/health
# {"status":"ok","service":"orders-api","timestamp":"..."}
```

### 5. Detener los servicios

```bash
docker-compose down
# Para eliminar también los datos de MySQL:
docker-compose down -v
```

---

## Variables de Entorno

### Customers API (.env.example)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3001` | Puerto del servidor |
| `DB_HOST` | `localhost` | Host de MySQL |
| `DB_PORT` | `3306` | Puerto de MySQL |
| `DB_USER` | `root` | Usuario de MySQL |
| `DB_PASSWORD` | `rootpassword` | Contraseña de MySQL |
| `DB_NAME` | `jelou_b2b` | Nombre de la base de datos |
| `JWT_SECRET` | `supersecretkey123` | Secret para firmar tokens JWT |
| `SERVICE_TOKEN` | `internal-service-token-2024` | Token para comunicación inter-servicio |

### Orders API (.env.example)

Mismas variables que Customers API, más:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CUSTOMERS_API_BASE` | `http://localhost:3001` | URL base de Customers API |

### Lambda Orchestrator (.env.example)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CUSTOMERS_API_BASE` | `http://localhost:3001` | URL base de Customers API |
| `ORDERS_API_BASE` | `http://localhost:3002` | URL base de Orders API |
| `SERVICE_TOKEN` | `internal-service-token-2024` | Token para comunicación inter-servicio |
| `JWT_SECRET` | `supersecretkey123` | Secret para JWT |

---

## URLs Base

| Servicio | URL Local | Descripción |
|----------|-----------|-------------|
| Customers API | `http://localhost:3001` | API de clientes |
| Customers API - Swagger | `http://localhost:3001/api-docs` | Documentación interactiva |
| Orders API | `http://localhost:3002` | API de órdenes y productos |
| Orders API - Swagger | `http://localhost:3002/api-docs` | Documentación interactiva |
| Lambda Orchestrator | `http://localhost:3003` | Portal principal |
| Consola Interactiva | `http://localhost:3003/orchestrator/console` | UI para probar las APIs |
| Health - Customers | `http://localhost:3001/health` | Estado del servicio |
| Health - Orders | `http://localhost:3002/health` | Estado del servicio |
| Health - Orchestrator | `http://localhost:3003/orchestrator/health` | Estado del servicio |

---

## Autenticación

Las APIs usan **JWT** para autenticación. Para obtener un token:

```bash
# Token para Customers API
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Token para Orders API
curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

Usar el token en el header: `Authorization: Bearer <token>`

El endpoint `/internal/customers/:id` usa **SERVICE_TOKEN** en vez de JWT:
`Authorization: Bearer internal-service-token-2024`

---

## Ejemplos cURL

### Customers API (puerto 3001)

```bash
# Obtener token
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Crear cliente
curl -s -X POST http://localhost:3001/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "New Corp", "email": "new@corp.com", "phone": "+1-555-9999"}'

# Obtener cliente por ID
curl -s http://localhost:3001/customers/1 \
  -H "Authorization: Bearer $TOKEN"

# Listar clientes con búsqueda y paginación
curl -s "http://localhost:3001/customers?search=ACME&cursor=0&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Actualizar cliente
curl -s -X PUT http://localhost:3001/customers/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phone": "+1-555-0001"}'

# Eliminar cliente (soft-delete)
curl -s -X DELETE http://localhost:3001/customers/1 \
  -H "Authorization: Bearer $TOKEN"

# Endpoint interno (service-to-service)
curl -s http://localhost:3001/internal/customers/1 \
  -H "Authorization: Bearer internal-service-token-2024"
```

### Orders API - Productos (puerto 3002)

```bash
# Obtener token
TOKEN=$(curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Crear producto
curl -s -X POST http://localhost:3002/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sku": "NEW-001", "name": "New Product", "price_cents": 99900, "stock": 50}'

# Obtener producto por ID
curl -s http://localhost:3002/products/1 \
  -H "Authorization: Bearer $TOKEN"

# Listar productos con búsqueda
curl -s "http://localhost:3002/products?search=Widget&cursor=0&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Actualizar stock y precio
curl -s -X PATCH http://localhost:3002/products/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"stock": 200, "price_cents": 59900}'
```

### Orders API - Órdenes (puerto 3002)

```bash
# Crear orden (valida cliente, verifica stock, descuenta stock en transacción)
curl -s -X POST http://localhost:3002/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customer_id": 1, "items": [{"product_id": 2, "qty": 3}, {"product_id": 5, "qty": 10}]}'

# Obtener orden con items
curl -s http://localhost:3002/orders/1 \
  -H "Authorization: Bearer $TOKEN"

# Listar órdenes con filtros
curl -s "http://localhost:3002/orders?status=CREATED&cursor=0&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Confirmar orden (idempotente con X-Idempotency-Key)
curl -s -X POST http://localhost:3002/orders/1/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Idempotency-Key: confirm-order-1-abc123"

# Repetir confirmación con misma key (devuelve misma respuesta - idempotente)
curl -s -X POST http://localhost:3002/orders/1/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Idempotency-Key: confirm-order-1-abc123"

# Cancelar orden (restaura stock)
curl -s -X POST http://localhost:3002/orders/1/cancel \
  -H "Authorization: Bearer $TOKEN"
```

---

## Lambda Orquestador

### Ejecución Local

```bash
cd lambda-orchestrator
npm install
npm run dev
```

El Lambda corre en `http://localhost:3003` con serverless-offline.

> **Nota:** Asegúrate de que Docker Compose esté corriendo (Customers API en :3001 y Orders API en :3002) antes de usar el orquestador.

### Invocar el Orquestador

```bash
curl -s -X POST http://localhost:3003/orchestrator/create-and-confirm-order \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "items": [{"product_id": 2, "qty": 3}],
    "idempotency_key": "abc-123",
    "correlation_id": "req-789"
  }'
```

### Respuesta esperada (201)

```json
{
  "success": true,
  "correlationId": "req-789",
  "data": {
    "customer": {
      "id": 1,
      "name": "ACME Corp",
      "email": "ops@acme.com",
      "phone": "+1-555-0100"
    },
    "order": {
      "id": 1,
      "status": "CONFIRMED",
      "total_cents": 389700,
      "items": [
        {
          "product_id": 2,
          "qty": 3,
          "unit_price_cents": 129900,
          "subtotal_cents": 389700
        }
      ]
    }
  }
}
```

### Uso con ngrok (URL pública)

```bash
# En otra terminal, exponer el Lambda localmente
ngrok http 3003
# Usar la URL generada (ej: https://xxxx.ngrok.io) para invocar desde Postman/Insomnia
```

### Deploy a AWS

```bash
cd lambda-orchestrator

# Configurar las URLs de las APIs desplegadas
export CUSTOMERS_API_BASE=https://tu-customers-api.com
export ORDERS_API_BASE=https://tu-orders-api.com

# Deploy con Serverless Framework
node_modules/.bin/serverless deploy

# El comando devuelve la URL del endpoint desplegado en API Gateway
# Ejemplo: https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/orchestrator/create-and-confirm-order
```

Una vez desplegado, invocar con la URL de API Gateway:

```bash
curl -s -X POST https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/orchestrator/create-and-confirm-order \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "items": [{"product_id": 2, "qty": 3}],
    "idempotency_key": "abc-123",
    "correlation_id": "req-789"
  }'
```

---

## Scripts NPM

### Customers API

```bash
cd customers-api
npm start          # Iniciar servidor
npm run dev        # Modo desarrollo (watch)
npm run migrate    # Ejecutar schema.sql
npm run seed       # Cargar datos de ejemplo
npm test           # Ejecutar tests
```

### Orders API

```bash
cd orders-api
npm start          # Iniciar servidor
npm run dev        # Modo desarrollo (watch)
npm run migrate    # Ejecutar schema.sql
npm run seed       # Cargar datos de ejemplo
npm test           # Ejecutar tests
```

### Lambda Orchestrator

```bash
cd lambda-orchestrator
npm start          # Iniciar serverless-offline
npm run dev        # Modo desarrollo (puerto 3003)
npm run deploy     # Deploy a AWS
npm test           # Ejecutar tests
```

---

## Base de Datos

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `customers` | Clientes B2B (soft-delete con `deleted_at`, email único) |
| `products` | Productos con SKU único, precio en centavos (`price_cents`) y stock |
| `orders` | Órdenes con estados: `CREATED`, `CONFIRMED`, `CANCELED` |
| `order_items` | Items de cada orden con `unit_price_cents` y `subtotal_cents` |
| `idempotency_keys` | Claves de idempotencia con expiración a 24 horas |

### Migración y Seed manual

```bash
# Desde cualquiera de las dos APIs:
cd customers-api
cp .env.example .env
npm install
npm run migrate    # Crea las tablas
npm run seed       # Inserta datos de ejemplo
```

---

## Documentación OpenAPI 3.0

Cada servicio incluye un archivo `openapi.yaml` y un **Swagger UI** interactivo:

| Servicio | OpenAPI File | Swagger UI |
|----------|-------------|------------|
| Customers API | `customers-api/openapi.yaml` | `http://localhost:3001/api-docs` |
| Orders API | `orders-api/openapi.yaml` | `http://localhost:3002/api-docs` |

---

## Funcionalidades Clave

- **Autenticación JWT** en todos los endpoints protegidos
- **Comunicación inter-servicio** con `SERVICE_TOKEN` (endpoint `/internal/customers/:id`)
- **Validación de inputs** con Zod en todos los endpoints
- **SQL parametrizado** para prevención de inyección SQL
- **Transacciones MySQL** para creación de órdenes (stock + orden atómicos con `FOR UPDATE`)
- **Idempotencia** en confirmación de órdenes con header `X-Idempotency-Key`
- **Soft-delete** en clientes (campo `deleted_at`)
- **Paginación cursor-based** en todos los listados (`cursor`, `limit`, `hasMore`)
- **Cancelación de órdenes** con restauración de stock y regla de 10 minutos para confirmados
- **Swagger UI** integrado en ambas APIs (`/api-docs`)
- **Consola interactiva** para probar las APIs visualmente (`/orchestrator/console`)
- **Portal web** con plan de pruebas, información del candidato y especificación técnica
- **Health checks** con validación de conectividad a base de datos
- **Retry de conexión a DB** en el arranque de las APIs (10 intentos con backoff)

---

## Candidato

**Daniel Obed Ortega Hernández**
- **Cargo al que aspira:** Technical Project Manager – Implementations / Operations
- **País:** Bogotá, Colombia
- **WhatsApp:** [+57 300 405 1582](https://wa.me/573004051582)
- **Email:** ohernandez83@hotmail.com
