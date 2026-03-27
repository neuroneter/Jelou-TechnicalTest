# Jelou B2B Backoffice - Technical Assessment

Sistema compuesto por dos APIs (Customers y Orders) y un Lambda orquestador para gestionar pedidos B2B.

## Arquitectura

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Customers API   │◄────│   Orders API     │     │    MySQL     │
│  (puerto 3001)   │     │  (puerto 3002)   │────►│  (puerto 3306)│
└──────────────────┘     └──────────────────┘     └──────────────┘
        ▲                        ▲
        │                        │
        └────────┬───────────────┘
                 │
      ┌──────────────────────┐
      │  Lambda Orchestrator │
      │   (puerto 3003)      │
      └──────────────────────┘
```

## Estructura del Monorepo

```
/
├── customers-api/        # API de clientes (Express, puerto 3001)
│   ├── src/
│   ├── Dockerfile
│   ├── openapi.yaml
│   └── package.json
├── orders-api/           # API de órdenes y productos (Express, puerto 3002)
│   ├── src/
│   ├── Dockerfile
│   ├── openapi.yaml
│   └── package.json
├── lambda-orchestrator/  # Lambda orquestador (Serverless Framework)
│   ├── src/
│   ├── serverless.yml
│   └── package.json
├── db/
│   ├── schema.sql        # Esquema de base de datos
│   └── seed.sql          # Datos de ejemplo
├── docker-compose.yml
└── README.md
```

## Requisitos Previos

- Docker y Docker Compose
- Node.js 22+ (para Lambda local)
- npm

## Levantamiento Local con Docker Compose

### 1. Clonar el repositorio

```bash
git clone https://github.com/neuroneter/jelou-technicaltest.git
cd jelou-technicaltest
```

### 2. Construir y levantar los servicios

```bash
docker-compose build
docker-compose up -d
```

Esto levanta:
- **MySQL** en `localhost:3306` (con schema y seed automáticos)
- **Customers API** en `http://localhost:3001`
- **Orders API** en `http://localhost:3002`

### 3. Verificar que los servicios están corriendo

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### 4. Detener los servicios

```bash
docker-compose down
# Para eliminar también los datos de MySQL:
docker-compose down -v
```

## Variables de Entorno

### Customers API

| Variable | Default | Descripción |
|----------|---------|-------------|
| PORT | 3001 | Puerto del servidor |
| DB_HOST | localhost | Host de MySQL |
| DB_PORT | 3306 | Puerto de MySQL |
| DB_USER | root | Usuario de MySQL |
| DB_PASSWORD | rootpassword | Password de MySQL |
| DB_NAME | jelou_b2b | Nombre de la base de datos |
| JWT_SECRET | supersecretkey123 | Secret para JWT |
| SERVICE_TOKEN | internal-service-token-2024 | Token para comunicación inter-servicio |

### Orders API

Mismas variables que Customers API, más:

| Variable | Default | Descripción |
|----------|---------|-------------|
| CUSTOMERS_API_BASE | http://localhost:3001 | URL base de Customers API |

### Lambda Orchestrator

| Variable | Default | Descripción |
|----------|---------|-------------|
| CUSTOMERS_API_BASE | http://localhost:3001 | URL base de Customers API |
| ORDERS_API_BASE | http://localhost:3002 | URL base de Orders API |
| SERVICE_TOKEN | internal-service-token-2024 | Token para comunicación inter-servicio |
| JWT_SECRET | supersecretkey123 | Secret para JWT |

## Autenticación

Las APIs usan JWT para autenticación. Para obtener un token:

```bash
# Obtener token desde Customers API
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Obtener token desde Orders API
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

Usa el token devuelto en el header `Authorization: Bearer <token>` en las siguientes peticiones.

## Ejemplos cURL

### Customers API (puerto 3001)

```bash
# Obtener token
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# Crear cliente
curl -X POST http://localhost:3001/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "New Corp", "email": "new@corp.com", "phone": "+1-555-9999"}'

# Obtener cliente por ID
curl http://localhost:3001/customers/1 \
  -H "Authorization: Bearer $TOKEN"

# Listar clientes con búsqueda
curl "http://localhost:3001/customers?search=ACME&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Actualizar cliente
curl -X PUT http://localhost:3001/customers/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phone": "+1-555-0001"}'

# Eliminar cliente (soft-delete)
curl -X DELETE http://localhost:3001/customers/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Orders API (puerto 3002)

```bash
# Obtener token
TOKEN=$(curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# Crear producto
curl -X POST http://localhost:3002/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sku": "NEW-001", "name": "New Product", "price_cents": 99900, "stock": 50}'

# Listar productos
curl "http://localhost:3002/products?limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Actualizar stock/precio
curl -X PATCH http://localhost:3002/products/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"stock": 200, "price_cents": 59900}'

# Crear orden
curl -X POST http://localhost:3002/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customer_id": 1, "items": [{"product_id": 2, "qty": 3}]}'

# Obtener orden
curl http://localhost:3002/orders/1 \
  -H "Authorization: Bearer $TOKEN"

# Listar órdenes filtradas
curl "http://localhost:3002/orders?status=CREATED&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Confirmar orden (idempotente)
curl -X POST http://localhost:3002/orders/1/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Idempotency-Key: confirm-order-1-abc123"

# Cancelar orden
curl -X POST http://localhost:3002/orders/1/cancel \
  -H "Authorization: Bearer $TOKEN"
```

## Lambda Orchestrator

### Ejecución Local

```bash
cd lambda-orchestrator
npm install
npm run dev
```

El Lambda corre en `http://localhost:3003`.

### Invocar el Orquestador

```bash
curl -X POST http://localhost:3003/orchestrator/create-and-confirm-order \
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
# En otra terminal
ngrok http 3003
# Usa la URL generada para invocar desde cualquier lugar
```

### Deploy a AWS

```bash
cd lambda-orchestrator

# Configurar las URLs de las APIs desplegadas
export CUSTOMERS_API_BASE=https://tu-customers-api.com
export ORDERS_API_BASE=https://tu-orders-api.com

npx serverless deploy
```

## Base de Datos

### Tablas

- **customers** - Clientes B2B (soft-delete con `deleted_at`)
- **products** - Productos con SKU único, precio en centavos y stock
- **orders** - Órdenes con estados: CREATED, CONFIRMED, CANCELED
- **order_items** - Items de cada orden con precio unitario y subtotal
- **idempotency_keys** - Claves de idempotencia con expiración a 24h

### Migración y Seed manual

```bash
cd customers-api
cp .env.example .env
npm install
npm run migrate
npm run seed
```

## Documentación OpenAPI

Cada servicio incluye un archivo `openapi.yaml`:

- Customers API: `customers-api/openapi.yaml`
- Orders API: `orders-api/openapi.yaml`

Se pueden visualizar con cualquier visor Swagger/OpenAPI.

## Funcionalidades Clave

- **Autenticación JWT** en todos los endpoints
- **Comunicación inter-servicio** con SERVICE_TOKEN (Customers `/internal`)
- **Validación** con Zod en todos los inputs
- **SQL parametrizado** para prevención de inyección SQL
- **Transacciones** para creación de órdenes (stock + orden atómicos)
- **Idempotencia** en confirmación de órdenes con `X-Idempotency-Key`
- **Soft-delete** en clientes
- **Paginación cursor-based** en listados
- **Cancelación** con restauración de stock y regla de 10 minutos para confirmados
