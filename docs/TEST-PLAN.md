# Plan de Pruebas - Jelou B2B Backoffice

## Prerequisitos

1. Levantar el sistema completo:
   ```bash
   docker-compose up -d          # MySQL + Customers API + Orders API
   cd lambda-orchestrator && npm run dev  # Lambda Orchestrator
   ```

2. Verificar health checks:
   - http://localhost:3001/health
   - http://localhost:3002/health
   - http://localhost:3003/orchestrator/health

3. Acceder a Swagger UI para ejecutar las pruebas:
   - **Customers API**: http://localhost:3001/api-docs
   - **Orders API**: http://localhost:3002/api-docs

---

## Fase 1: Autenticación

### Test 1.1 — Obtener token JWT (Customers API)
- **Endpoint**: `POST /auth/login`
- **Swagger**: Customers API → `/auth/login` → Try it out
- **Body**:
  ```json
  { "username": "admin", "password": "admin123" }
  ```
- **Resultado esperado**: Status `200`, respuesta con `token` y `expiresIn: "24h"`
- **Nota**: Copiar el token para usarlo en las siguientes pruebas. En Swagger, hacer click en el botón "Authorize" (candado) y pegar: `Bearer <token>`

### Test 1.2 — Obtener token JWT (Orders API)
- **Endpoint**: `POST /auth/login`
- **Swagger**: Orders API → `/auth/login` → Try it out
- **Body**: mismo que 1.1
- **Resultado esperado**: Status `200` con token
- **Nota**: Autorizar en Swagger de Orders API con este token

---

## Fase 2: Customers API (CRUD)

### Test 2.1 — Listar clientes del seed
- **Endpoint**: `GET /customers`
- **Swagger**: Customers API → `/customers` (GET) → Try it out → Execute
- **Resultado esperado**: Status `200`, array con 5 clientes (ACME Corp, Globex Inc, Initech LLC, Umbrella Corp, Stark Industries)

### Test 2.2 — Buscar cliente por nombre
- **Endpoint**: `GET /customers?search=ACME`
- **Swagger**: Ingresar "ACME" en el campo `search`
- **Resultado esperado**: Status `200`, solo ACME Corp en los resultados

### Test 2.3 — Obtener cliente por ID
- **Endpoint**: `GET /customers/1`
- **Swagger**: Customers API → `/customers/{id}` (GET) → id: 1
- **Resultado esperado**: Status `200`, datos de ACME Corp

### Test 2.4 — Crear nuevo cliente
- **Endpoint**: `POST /customers`
- **Body**:
  ```json
  {
    "name": "Test Company",
    "email": "test@company.com",
    "phone": "+1-555-9999"
  }
  ```
- **Resultado esperado**: Status `201`, cliente creado con id asignado

### Test 2.5 — Crear cliente con email duplicado
- **Endpoint**: `POST /customers`
- **Body**: mismo email que Test 2.4
- **Resultado esperado**: Status `409`, error de email duplicado

### Test 2.6 — Actualizar cliente
- **Endpoint**: `PUT /customers/6` (id del cliente creado en 2.4)
- **Body**:
  ```json
  {
    "name": "Test Company Updated",
    "phone": "+1-555-0000"
  }
  ```
- **Resultado esperado**: Status `200`, datos actualizados

### Test 2.7 — Soft-delete cliente
- **Endpoint**: `DELETE /customers/6`
- **Resultado esperado**: Status `204`
- **Verificación**: `GET /customers/6` debe devolver `404`

### Test 2.8 — Acceso sin autenticación
- **Endpoint**: `GET /customers` (sin token en Authorization)
- **Swagger**: Remover la autorización (click Authorize → Logout)
- **Resultado esperado**: Status `401`, error "Missing or invalid Authorization header"

---

## Fase 3: Products API (CRUD)

### Test 3.1 — Listar productos del seed
- **Endpoint**: `GET /products`
- **Swagger**: Orders API → `/products` (GET) → Execute
- **Resultado esperado**: Status `200`, array con 6 productos

### Test 3.2 — Buscar producto
- **Endpoint**: `GET /products?search=Widget`
- **Resultado esperado**: Status `200`, productos que contienen "Widget"

### Test 3.3 — Obtener producto por ID
- **Endpoint**: `GET /products/1`
- **Resultado esperado**: Status `200`, Standard Widget con price_cents: 49900, stock: 100

### Test 3.4 — Crear nuevo producto
- **Endpoint**: `POST /products`
- **Body**:
  ```json
  {
    "sku": "TEST-001",
    "name": "Test Product",
    "price_cents": 99900,
    "stock": 25
  }
  ```
- **Resultado esperado**: Status `201`, producto creado

### Test 3.5 — Crear producto con SKU duplicado
- **Endpoint**: `POST /products`
- **Body**: mismo SKU que Test 3.4
- **Resultado esperado**: Status `409`, error de SKU duplicado

### Test 3.6 — Actualizar stock de producto
- **Endpoint**: `PATCH /products/7` (id del producto creado en 3.4)
- **Body**:
  ```json
  { "stock": 50, "price_cents": 89900 }
  ```
- **Resultado esperado**: Status `200`, stock y precio actualizados

---

## Fase 4: Orders API (Flujo de Pedidos)

### Test 4.1 — Crear orden válida
- **Endpoint**: `POST /orders`
- **Body**:
  ```json
  {
    "customer_id": 1,
    "items": [
      { "product_id": 1, "qty": 2 },
      { "product_id": 3, "qty": 5 }
    ]
  }
  ```
- **Resultado esperado**: Status `201`
  - Status: `CREATED`
  - total_cents calculado: (2 × 49900) + (5 × 29900) = 249300
  - Items con unit_price_cents y subtotal_cents
- **Verificar**: `GET /products/1` debe mostrar stock reducido en 2

### Test 4.2 — Crear orden con cliente inexistente
- **Endpoint**: `POST /orders`
- **Body**:
  ```json
  {
    "customer_id": 9999,
    "items": [{ "product_id": 1, "qty": 1 }]
  }
  ```
- **Resultado esperado**: Status `404`, error "Customer not found"

### Test 4.3 — Crear orden con stock insuficiente
- **Endpoint**: `POST /orders`
- **Body**:
  ```json
  {
    "customer_id": 1,
    "items": [{ "product_id": 4, "qty": 9999 }]
  }
  ```
- **Resultado esperado**: Status `400`, error "Insufficient stock"

### Test 4.4 — Obtener orden con items
- **Endpoint**: `GET /orders/{id}` (id de la orden creada en 4.1)
- **Resultado esperado**: Status `200`, orden con array de items

### Test 4.5 — Listar órdenes con filtros
- **Endpoint**: `GET /orders?status=CREATED`
- **Resultado esperado**: Status `200`, solo órdenes con status CREATED

---

## Fase 5: Confirmación Idempotente

### Test 5.1 — Confirmar orden (primera vez)
- **Endpoint**: `POST /orders/{id}/confirm`
- **Headers**: `X-Idempotency-Key: test-key-001`
- **Swagger**: Orders API → `/orders/{id}/confirm` → Agregar header X-Idempotency-Key
- **Resultado esperado**: Status `200`, orden con status `CONFIRMED`

### Test 5.2 — Confirmar orden (retry con misma key - idempotencia)
- **Endpoint**: `POST /orders/{id}/confirm` (mismo id y misma key)
- **Headers**: `X-Idempotency-Key: test-key-001`
- **Resultado esperado**: Status `200`, **misma respuesta exacta** que Test 5.1
- **Validar**: Los datos devueltos son idénticos (cached response)

### Test 5.3 — Confirmar sin X-Idempotency-Key
- **Endpoint**: `POST /orders/{id}/confirm` (sin header)
- **Resultado esperado**: Status `400`, error "X-Idempotency-Key header is required"

### Test 5.4 — Confirmar orden ya cancelada
- Crear y cancelar una orden primero, luego intentar confirmarla
- **Resultado esperado**: Status `400`, error "Cannot confirm order with status CANCELED"

---

## Fase 6: Cancelación de Órdenes

### Test 6.1 — Cancelar orden en estado CREATED
1. Crear nueva orden: `POST /orders` con items válidos
2. Cancelar: `POST /orders/{id}/cancel`
- **Resultado esperado**: Status `200`, status `CANCELED`
- **Verificar**: Stock de productos debe restaurarse (GET /products/{id})

### Test 6.2 — Cancelar orden CONFIRMED dentro de 10 minutos
1. Crear orden → Confirmar → Cancelar inmediatamente
- **Resultado esperado**: Status `200`, status `CANCELED`, stock restaurado

### Test 6.3 — Cancelar orden CONFIRMED después de 10 minutos
- (Esta prueba requiere esperar 10 min o modificar created_at en DB)
- **Resultado esperado**: Status `400`, error "Cannot cancel a confirmed order after 10 minutes"

### Test 6.4 — Cancelar orden ya cancelada
- Cancelar una orden que ya fue cancelada
- **Resultado esperado**: Status `200`, mensaje "Order already canceled"

---

## Fase 7: Lambda Orquestador

### Test 7.1 — Flujo completo create-and-confirm
- **Endpoint**: `POST http://localhost:3003/orchestrator/create-and-confirm-order`
- **Body**:
  ```json
  {
    "customer_id": 1,
    "items": [{ "product_id": 2, "qty": 3 }],
    "idempotency_key": "plan-test-001",
    "correlation_id": "req-plan-001"
  }
  ```
- **Resultado esperado**: Status `201`
  ```json
  {
    "success": true,
    "correlationId": "req-plan-001",
    "data": {
      "customer": { "id": 1, "name": "ACME Corp", ... },
      "order": { "status": "CONFIRMED", "total_cents": 389700, "items": [...] }
    }
  }
  ```

### Test 7.2 — Orquestador con cliente inexistente
- **Body**:
  ```json
  {
    "customer_id": 9999,
    "items": [{ "product_id": 1, "qty": 1 }],
    "idempotency_key": "plan-test-002",
    "correlation_id": "req-plan-002"
  }
  ```
- **Resultado esperado**: Status `404`, error "Customer 9999 not found"

### Test 7.3 — Orquestador sin idempotency_key
- **Body** sin campo `idempotency_key`
- **Resultado esperado**: Status `400`, error "idempotency_key is required"

### Test 7.4 — Orquestador sin items
- **Body**:
  ```json
  {
    "customer_id": 1,
    "items": [],
    "idempotency_key": "plan-test-003"
  }
  ```
- **Resultado esperado**: Status `400`, error de validación

### Test 7.5 — Health check del orquestador
- **Endpoint**: `GET http://localhost:3003/orchestrator/health`
- **Resultado esperado**: Status `200`, JSON con status "ok"

---

## Fase 8: Comunicación Inter-Servicio

### Test 8.1 — Endpoint interno de Customers
- **Endpoint**: `GET /internal/customers/1`
- **Headers**: `Authorization: Bearer internal-service-token-2024`
- **Resultado esperado**: Status `200`, datos del cliente

### Test 8.2 — Endpoint interno sin SERVICE_TOKEN
- **Endpoint**: `GET /internal/customers/1`
- **Headers**: Sin Authorization o con token JWT normal
- **Resultado esperado**: Status `403`, acceso denegado

---

## Resumen de Resultados

| Fase | Tests | Descripción |
|------|-------|-------------|
| 1 | 1.1 - 1.2 | Autenticación JWT |
| 2 | 2.1 - 2.8 | CRUD Customers |
| 3 | 3.1 - 3.6 | CRUD Products |
| 4 | 4.1 - 4.5 | Creación de Orders |
| 5 | 5.1 - 5.4 | Idempotencia |
| 6 | 6.1 - 6.4 | Cancelación |
| 7 | 7.1 - 7.5 | Lambda Orchestrator |
| 8 | 8.1 - 8.2 | Inter-Service Auth |
| **Total** | **29 tests** | |

## URLs de acceso

| Servicio | URL |
|----------|-----|
| Customers API - Swagger | http://localhost:3001/api-docs |
| Orders API - Swagger | http://localhost:3002/api-docs |
| Lambda Orchestrator | http://localhost:3003/orchestrator |
| Portal principal | http://localhost:3003 |
