# Tres Manantiales · Administración de Campo

App de gestión para el establecimiento "Tres Manantiales": animales, stock de
alimentos y despensa, gastos fijos/variables, vehículos y bienes, sanidad
(medicamentos + veterinarios), y un panel de alertas.

Es un sitio **estático** (HTML + CSS + JS puro, sin frameworks ni build) que
usa **Supabase** como base de datos en la nube. Se deploya en **Vercel**.

```
tres-manantiales-app/
├── index.html
├── vercel.json
├── css/
│   └── styles.css
├── js/
│   ├── config.js            ← tus credenciales de Supabase (editar)
│   ├── config.example.js    ← plantilla de referencia
│   ├── supabase-client.js
│   └── app.js                ← toda la lógica (CRUD contra Supabase)
└── supabase/
    └── schema.sql             ← esquema de la base de datos
```

## 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto nuevo (plan free).
2. Andá a **SQL Editor > New query**, pegá el contenido de `supabase/schema.sql`
   y ejecutalo. Esto crea todas las tablas, los datos iniciales de propiedades
   y las políticas de acceso.
3. Andá a **Project Settings > API** y copiá:
   - **Project URL**
   - **anon public key**

## 2. Conectar la app a Supabase

Editá `js/config.js` y completá:

```js
window.SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
window.SUPABASE_ANON_KEY = "TU-ANON-KEY-PUBLICA";
```

> La `anon key` es pública por diseño (Supabase la protege con Row Level
> Security, ya configurado en `schema.sql`), así que es seguro subirla al
> repositorio. Si más adelante querés restringir el acceso (por ejemplo,
> pedir usuario y contraseña), activá **Supabase Auth** y ajustá las
> políticas RLS — dejamos la base preparada para ese cambio.

## 3. Subir el proyecto a GitHub

Desde esta carpeta:

```bash
git init
git add .
git commit -m "Tres Manantiales: app inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/tres-manantiales.git
git push -u origin main
```

(Creá antes el repositorio vacío en GitHub desde github.com/new — sin
README ni licencia, para que no choque con este `git push`.)

## 4. Deployar en Vercel

1. Entrá a [vercel.com](https://vercel.com) → **Add New… > Project**.
2. Importá el repositorio de GitHub recién creado.
3. Framework preset: **Other** (es HTML estático, no necesita build command
   ni output directory especiales — Vercel lo detecta solo).
4. Deploy. En un minuto tenés la URL pública (`tres-manantiales.vercel.app`
   o la que elijas).

Cada `git push` a `main` vuelve a deployar automáticamente.

## Notas

- Todos los "Dar de baja / Quitar" borran el registro en Supabase, no solo
  en pantalla — es una base de datos real y compartida entre quien acceda
  a la URL.
- Si en algún momento la app muestra "Error de conexión con Supabase",
  revisá que `js/config.js` tenga los valores correctos y que hayas
  corrido `supabase/schema.sql` sin errores.
- Ver la pestaña **Mejoras sugeridas** dentro de la app para el roadmap de
  próximos pasos (alertas por WhatsApp, roles de usuario, calendario de
  tareas, etc.).
