---
name: Imágenes botánicas remotas
description: Comportamiento de fuentes de imágenes usadas por el catálogo botánico.
---

Las fichas remotas necesitan un respaldo real y un manejador de error para evitar tarjetas o banners vacíos cuando el proveedor no responde. Dos problemas distintos se confirmaron con pedidos HTTP reales, no solo con inspección visual:

1. **source.unsplash.com está muerto, no solo "a veces roto"**: devuelve `503` para el 100% de los pedidos (era la vieja "Unsplash Source API", descontinuada). Se eliminó por completo — el campo `photo` de cada planta ahora arranca directo en el SVG placeholder (`wikiFallback`) en vez de una URL condenada a fallar.
2. **El fetch de imágenes de Wikipedia por planta, uno por uno en paralelo (`Promise.all` sin límite), dispara el rate limit de su API**: reproducido en vivo, solo ~10% de 58 pedidos simultáneos tuvieron éxito; el resto recibió texto plano ("too many requests") que revienta el `.json()` y cae al placeholder genérico en silencio. Esto —no una URL rota puntual— era la causa real de "algunas imágenes sí cargan, otras no" en la Galería. Se arregló agrupando los nombres científicos con el parámetro `titles=A|B|C` de MediaWiki (hasta 50 títulos por pedido) en vez de un `fetch` por planta — 118 pedidos pasan a ser ~3.

**How to apply:** mantener el placeholder SVG como estado inicial (nunca una URL externa sin verificar), agrupar cualquier lookup por lote a una API externa cuando se hace para muchas entradas a la vez en vez de disparar un fetch por entrada, y conservar un `onError` a una imagen de respaldo (Pexels) como última capa de defensa para fallos genuinos en tiempo de ejecución.