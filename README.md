# Invitacion de boda de Yasmin & Edgar - con panel de administracion

Proyecto completo con backend real (Node.js + Express + Postgres), para que todo -- RSVP, libro de firmas, fotos compartidas y mesas -- se guarde de verdad y se vea desde cualquier celular, no solo desde el tuyo.

## Estructura

- **`public/index.html`** -- la invitacion que ven los invitados. Trae:
  - Encabezado con accesos rapidos: Fecha, Lugar, Mesa de regalos, Confirmar, Fotos, Firmas
  - Mesa de regalos: link directo a Liverpool + cuenta bancaria con boton de copiar CLABE
  - RSVP conectado a la base de datos (funciona igual con invitados personalizados `?g=id` o con el link general)
  - Libro de firmas publico
  - Sistema de fotos compartidas (los invitados suben, todos las ven)
  - Pase de entrada con QR -- **el QR solo aparece despues de confirmar asistencia**, y muestra la mesa asignada si ya se las diste
- **`public/admin.html`** (`/admin.html`) -- el panel privado de Yasmin y Edgar, con login por contrasena:
  - Crear invitaciones personalizadas (nombre + numero de pases) -> genera link y QR, listo para WhatsApp
  - Gestion de mesas: crear mesas con capacidad, asignar cada invitado confirmado a una mesa, ver ocupacion
  - Ver, filtrar y exportar todas las confirmaciones (CSV)
  - Moderar el libro de firmas (borrar mensajes)
  - Moderar las fotos compartidas (borrar fotos)
- **`server.js` + `db.js`** -- el servidor y el esquema de base de datos (tablas: `guests`, `rsvp_anonimo`, `event_tables`, `guestbook`, `photos`).

## 1. Subir a GitHub

```
git init
git add .
git commit -m "Invitacion de Yasmin y Edgar"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

## 2. Desplegar en Render

1. Entra a render.com y crea una cuenta.
2. **New +** -> **Blueprint** -> conecta tu repositorio.
3. Render lee `render.yaml` y crea automaticamente el servidor web y una base de datos Postgres gratis.
4. Te pedira el valor de `ADMIN_PASSWORD` -- pon la contrasena que van a usar para entrar al panel.
5. **Apply** y espera unos minutos.

Tu invitacion quedara en `https://tu-app.onrender.com` y el panel en `https://tu-app.onrender.com/admin.html`.

> El plan gratis de Render "duerme" el servicio tras un rato sin visitas y tarda ~30-50 segundos en despertar la primera vez. Para una invitacion normalmente no es problema.

## 3. Usar el panel

1. Abre `/admin.html`, entra con tu `ADMIN_PASSWORD`.
2. **Mesas**: creelas primero (nombre + capacidad) si vas a usar la gestion de mesas.
3. **Invitados**: agrega cada invitado con su nombre y numero de pases -> te da el link y QR para mandarle. Cuando confirme, puedes asignarle una mesa desde el selector en su fila.
4. **Firmas** y **Fotos**: se llenan solas conforme los invitados las usan en la invitacion; solo entra a moderarlas (borrar lo que no quieras conservar) cuando quieras.
5. **Exportar CSV** te da un archivo con todos los invitados y su estatus, para Excel.

## 4. Poner la fecha y el lugar reales

Actualmente la invitacion dice "Por confirmar" en fecha y lugar (`public/index.html`, secciones `id="fecha"` e `id="lugar"`). En cuanto los tengas, mandamelos y te actualizo esas secciones, o editalas tu directo ahi.

## 5. Poner la cancion de fondo

El reproductor de musica esta listo pero vacio (`<audio id="bgm">` en `index.html`). Manda el archivo o link de la cancion y lo conecto, o pon tu el `src` directamente.

## 6. Desarrollo local (opcional)

```
npm install
cp .env.example .env
# edita .env con tu propia base de datos Postgres (local o gratis en neon.tech / supabase)
npm start
```

Abre `http://localhost:3000`.
