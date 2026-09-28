<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <b>Español</b> ·
  <a href="README.pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn">
    <img src="docs/readme_hero.es.jpg" alt="X Article → PDF — instálalo gratis desde Chrome Web Store">
  </a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn"><img src="https://img.shields.io/badge/Chrome%20Web%20Store-Agregar%20a%20Chrome-2563eb?style=for-the-badge&amp;logo=googlechrome&amp;logoColor=white" alt="Agregar a Chrome — Chrome Web Store"></a>
</p>

<p align="center">
  <b><a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn">Instalar desde Chrome Web Store</a></b><br>
  Gratis · sin clonar, sin compilar, sin modo de desarrollador · se actualiza solo · también funciona en Edge
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-38bdf8?style=flat-square&amp;logo=googlechrome&amp;logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Browser-Chrome%20%26%20Edge-60a5fa?style=flat-square&amp;logo=googlechrome&amp;logoColor=white" alt="Chrome y Edge">
  <img src="https://img.shields.io/badge/License-MIT-94a3b8?style=flat-square" alt="Licencia MIT">
</p>

# X Article → PDF

Exporta un **Artículo** o un **hilo** de X (Twitter) a un PDF que conserva el formato: texto
seleccionable y buscable, imágenes en resolución original, directo a tus descargas.
Sin cuadro de diálogo de impresión y sin abrir pestañas nuevas.

También puedes exportar un HTML autónomo con todas las imágenes incluidas, para guardarlo offline.

## Funciones

![Resumen de funciones de X Article → PDF](docs/features.es.svg)

## Uso

### Extensión de Chrome (recomendado)

1. Instálala desde **[Chrome Web Store](https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn)** (Edge también puede instalarla desde ahí)
2. Abre cualquier Artículo o hilo de X
3. Haz clic en el botón **PDF** de la barra de acciones de la publicación (junto a guardar y compartir) — **solo aparece en los Artículos de X**

![El botón de exportar a PDF en la barra de acciones, junto a guardar y compartir](docs/shot_pdf_button.png)

- **Clic izquierdo** = exportar PDF (se genera en segundo plano y aparece en tus descargas)
- **Clic derecho** = exportar HTML autónomo (imágenes incluidas como data URI, se abre sin conexión)
- El ícono de la extensión en la barra del navegador hace lo mismo que el clic izquierdo

> **Hilos:** después de instalar, **recarga la página una vez** antes de exportar. El interceptor de
> red solo captura las solicitudes que se hacen después de instalarse, y la solicitud `TweetDetail` de
> la página actual ya se envió. Si no se capturó nada, la extensión extrae el contenido del DOM y te
> lo avisa.

### Cargar desde el código fuente (desarrolladores)

Solo hace falta si quieres modificar el código o probar una versión que todavía no está en la tienda:
`chrome://extensions` → activa el **Modo de desarrollador** → **Cargar descomprimida** → elige la
carpeta de este repositorio. Para el uso normal, instálala desde la tienda: se actualiza sola.

### Markdown → editor de Artículos de X

Abre `x.com/compose/articles/edit/<id>` y verás un ícono nuevo **a la izquierda de Preview**. Pega tu
Markdown tal cual en el cuerpo del artículo y haz clic en el ícono: el texto se convierte, en el mismo
lugar, al formato propio de los Artículos de X (títulos / listas / citas / bloques de código / negrita
y cursiva / enlaces). No hay ventana de confirmación; si algo sale mal, presiona **Ctrl+Z**, que usa el
historial de edición del propio editor.

![La barra del editor de Artículos con el ícono rojo de importar Markdown a la izquierda de Preview](docs/shot_md_toolbar.png)

Lo que un Artículo de X no puede mostrar se simplifica, para no perder texto: las tablas pasan a ser
párrafos simples como `A | 1`, las líneas divisorias a una línea `— — —` y las imágenes a enlaces (X
exige subir las imágenes con su propio cargador).

**X no admite bloques de código**: probado en el editor real, tanto los bloques ```` ``` ```` como el
código en línea `` ` `` quedan como texto normal (el texto se conserva, solo se pierde el estilo).
Funcionan bien: tres niveles de título, listas ordenadas y con viñetas (también anidadas), citas,
negrita, cursiva y enlaces.

### Userscript / bookmarklet

Arrastra `x-article-exporter.user.js` a Tampermonkey, o pega todo el contenido de `bookmarklet.txt` en
la URL de un marcador.

Estas dos formas **no tienen el backend de la extensión**, así que el PDF no está disponible: después de
2.5 s se descarga en su lugar un HTML autónomo. El bookmarklet además se inyecta demasiado tarde para
interceptar la red, así que en los hilos solo puede extraer el contenido del DOM.

## Notas técnicas

Los detalles de implementación (las tres restricciones clave, las dos rutas de extracción, cómo se
genera el PDF y los problemas conocidos) están en el [README en inglés](README.md). Se mantienen en un
solo idioma para que no queden versiones desactualizadas.

## Privacidad

**No recopila ningún dato.** Sin cuenta, sin servidor, sin analíticas, sin código remoto. Todas las
exportaciones y archivos se generan localmente en tu navegador. Para qué sirve cada permiso (`debugger`
/ `downloads` / `storage`) se explica en [PRIVACY.md](PRIVACY.md).

## Proyectos relacionados

La idea de "simular un pegado para usar el propio cargador del editor" se separó después en dos
extensiones independientes y sin permisos:

- [csdn-md-importer](https://github.com/wangsen2020/csdn-md-importer) — Markdown al editor de CSDN en un clic, con subida automática de imágenes
- [zhihu-md-importer](https://github.com/wangsen2020/zhihu-md-importer) — Markdown a las columnas de Zhihu en un clic, con subida automática de imágenes

Este repositorio se enfoca en hacer bien una sola cosa en X: exportar Artículos e hilos, e importar
Markdown al editor de Artículos de X.

## Licencia

MIT
