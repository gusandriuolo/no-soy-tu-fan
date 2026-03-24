# 👋 No soy tu Fan

Una extensión de Chrome que identifica quién no te sigue en Instagram de forma rápida y sencilla.

## ✨ Características

- 🔍 **Análisis en tiempo real** - Muestra progreso mientras analiza
- 📊 **Resultados detallados** - Información completa de cada usuario
- 🎯 **Filtros avanzados** - Filtra por verificados, privados, con foto
- 💾 **Exporta datos** - Descarga como JSON, CSV o copia al portapapeles
- ⭐ **Whitelist** - Guarda usuarios para referencias futuras
- 🚀 **Sin dependencias** - Código limpio y sin librerías externas
- 🔒 **Privado** - Todo se procesa localmente en tu navegador

## 📋 Requisitos

- Google Chrome (versión 88+)
- Sesión iniciada en Instagram
- ~5-15 minutos dependiendo de tus seguidores

## 🚀 Instalación

### Paso 1: Clonar o descargar el repositorio

```bash
git clone https://github.com/gusandriuolo/no-soy-tu-fan.git
cd no-soy-tu-fan
```

### Paso 2: Cargar en Chrome

1. Abre Chrome y ve a **`chrome://extensions/`**
2. Activa el **"Modo de desarrollador"** (esquina superior derecha)
3. Haz clic en **"Cargar extensión sin empaquetar"**
4. Selecciona la carpeta del proyecto
5. ¡Listo! La extensión apareció en tu navegador

## 📖 Cómo usar

### Ejecutar análisis

1. Ve a **Instagram** y abre tu perfil
2. Haz clic en el icono de la extensión
3. Presiona **"▶️ ANALIZAR AHORA"**
4. Espera mientras se analiza (verás un progreso del 10% al 95%)
5. Los resultados aparecerán en una tabla con fotos de perfil

### Filtrar resultados

- **Todos/Guardados** - Cambia entre la lista completa y tus usuarios guardados
- **Verificados** - Muestra/oculta cuentas verificadas
- **Privados** - Muestra/oculta cuentas privadas
- **Con foto** - Muestra/oculta usuarios sin foto de perfil
- **Búsqueda** - Busca por nombre de usuario o nombre completo

### Guardar usuarios

Haz clic en la estrella (☆) al lado de cualquier usuario para guardarlo en tu lista personal. Los guardados aparecerán en la pestaña "⭐ Guardados".

### Exportar datos

- **📋 Copiar** - Copia todos los usernames al portapapeles
- **📄 JSON** - Descarga los datos en formato JSON
- **📊 CSV** - Descarga los datos en formato CSV para Excel

## 🏗️ Estructura del proyecto

```
no-soy-tu-fan/
├── manifest.json          # Configuración de la extensión
├── popup.html             # Interfaz del popup
├── popup.js               # Lógica y estado del popup
├── background.js          # Service Worker (lógica principal)
├── content.js             # Script inyectado en Instagram
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # Este archivo
```

### Archivos principales

**manifest.json** - Configuración de Chrome Extension v3 con permisos y recursos

**popup.js** - Aplicación vanilla JavaScript que maneja:
- Estado de la interfaz
- Filtros y búsqueda
- Exportación de datos
- Whitelist de usuarios

**background.js** - Service Worker que coordina:
- Orquestación del análisis
- Comunicación entre componentes
- Cálculo de resultados
- Almacenamiento en chrome.storage

**content.js** - Script inyectado en Instagram que:
- Extrae el ID del usuario desde el DOM
- Realiza requests a la GraphQL API de Instagram
- Filtra usuarios según si siguen de vuelta

## 🔧 Cómo funciona


1. Usuario abre Instagram y hace clic en la extensión
2. Content script extrae el user_id desde la página
3. Se solicita la lista de "seguidos" a Instagram GraphQL
4. Para cada usuario seguido, se verifica si sigue de vuelta
5. Los que no siguen se marcan como "unfollowers"
6. Resultados se guardan y se muestran en la interfaz


## 🔒 Privacidad y Seguridad

- ✅ Todo se procesa **en tu navegador local**
- ✅ **No se envía información** a servidores externos
- ✅ **No recolectamos datos personales**
- ✅ Código abierto para inspeccionar
- ✅ Implementa delays anti-bot para evitar bloqueos

## ⚠️ Limitaciones y Advertencias

- Instagram puede bloquear la extensión si hace demasiadas requests
- Los datos se obtienen en tiempo de ejecución (no se cacheaban historicamente)
- Requiere estar logeado en Instagram
- Cuentas privadas mostrarán los mismos datos públicos que Instagram revela

## 🛠️ Desarrollo

Para modificar el código:

1. Edita los archivos `.js` o `popup.html`
2. En `chrome://extensions/` haz clic en el botón **"Recargar"**
3. Los cambios aparecerán inmediatamente

No hay proceso de build. El código se ejecuta directamente.

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver `LICENSE` para más detalles.

## 🐛 Reportar problemas

Si encuentras algún error o tienes sugerencias:

1. Verifica que estés logeado en Instagram
2. Recarga la página de Instagram (F5)
3. Recarga la extensión en `chrome://extensions/`
4. Intenta el análisis nuevamente

Si el problema persiste, abre un issue en GitHub con:
- Navegador y versión
- Pasos para reproducir
- Captura de pantalla si es posible

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama con tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit los cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---
