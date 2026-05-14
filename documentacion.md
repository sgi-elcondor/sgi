# Estructura del código (árbol de archivos)


## 1. Directorio /public 
(Frontend - Archivos Estáticos)

## 2. Directorio /src 
(Backend - Código del Servidor)

## 3. /src/config — Configuraciones de servicios
  ┌────────────────┬───────────────────────────────────────────────────────────┐
  │    Archivo     │                        Descripción                        │
  ├────────────────┼───────────────────────────────────────────────────────────┤
  │ supabase.js    │ Cliente de Supabase (base de datos PostgreSQL en la nube) │
  ├────────────────┼───────────────────────────────────────────────────────────┤
  │ firebase.js    │ Cliente de Firebase (autenticación)                       │
  ├────────────────┼───────────────────────────────────────────────────────────┤
  │ permissions.js │ Definición de qué roles tienen acceso a qué recursos      │
  └────────────────┴───────────────────────────────────────────────────────────┘

## 4.   /src/controllers — Lógica de negocio

  Cada controller maneja las operaciones CRUD de su módulo (uno por cada entidad del sistema). Reciben la petición HTTP, consultan la BD
   y devuelven la respuesta.

## 5. /src/routes — Definición de endpoints
  Cada archivo de rutas mapea URLs a su controller correspondiente. Por ejemplo GET /lotes → lotes.controller.js.

## 6. /src/middlewares — Funciones intermedias
  │        Archivo         │                             Descripción                              │
  ├────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ auth.middleware.js     │ Verifica que el usuario esté autenticado (valida token JWT/Firebase) │
  │ auth.middleware.js     │ Verifica que el usuario esté autenticado (valida token JWT/Firebase) │ 
  │ permisos.middleware.js │ Verifica que el usuario tenga permisos para la acción solicitada     │

This