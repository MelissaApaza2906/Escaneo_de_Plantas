---
name: Imágenes botánicas remotas
description: Comportamiento de fuentes de imágenes usadas por el catálogo botánico.
---

Las fichas pueden conservar la URL solicitada por el usuario como fuente principal, pero las imágenes remotas deben tener un respaldo real y un manejador de error para evitar tarjetas o banners vacíos cuando el proveedor no responde.

**Why:** Durante la comprobación visual, source.unsplash.com devolvió imágenes rotas aunque las URLs tenían el formato solicitado.

**How to apply:** Mantener la consulta principal visible en los datos del catálogo y usar un fallback visual en cada imagen remota importante, especialmente hero, tarjetas y detalles.