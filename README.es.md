# Eyes on Alerts

**Extensión de [Eyes on Claude](https://github.com/dfadify-web/eyes-on-claude).** Avisos cuando Claude termina, te pide permiso, falla una herramienta o algo tarda demasiado: notificación del navegador, sonido y push al móvil con ntfy.

[English](README.md)

![Eyes on Alerts](docs/screenshot.png)

## Qué hace

- Corre en el servidor (arranca solo), así que avisa aunque la pestaña esté cerrada.
- Reglas: turno terminado (con duración), Claude te necesita, subagente terminado, error de herramienta, herramienta que tarda N min.
- Push al móvil con ntfy (tema aleatorio, cualquier servidor ntfy) con botón de prueba.
- Notificaciones del navegador y un aviso sonoro sintetizado.

Todo sale del stream real de Eyes on Claude (los transcripts de Claude Code): nada se inventa.

## Instalar

Requiere Eyes on Claude **v2.3+** y Node 18+.

```bash
npx -y github:dfadify-web/eyes-on-alerts
```

Abre Eyes on Claude → **Extensiones** → **Eyes on Alerts** (`http://localhost:7777/#ext/eyes-on-alerts`). Desinstalar: `npx -y github:dfadify-web/eyes-on-alerts --uninstall`.

Suelta: `node server.js` → `http://localhost:7782` (necesita Eyes on Claude en :7777).

## Push al móvil

1. Instala la app gratuita **ntfy** (Android / iOS).
2. Suscríbete al tema que muestra la extensión (se genera uno aleatorio).
3. Activa "Enviar avisos al móvil" y pulsa **Enviar prueba**.

Los avisos van al servidor ntfy que elijas (por defecto `https://ntfy.sh`, o el tuyo). Quien conozca el tema puede leerlos; solo llevan el título de la sesión y un texto corto. La configuración está en `~/.claude/eyes-on-claude/eyes-on-alerts.json`.

## Cómo funciona

Un servidor Node sin dependencias (`server.js`) sirve `public/` y reenvía el stream en vivo `/events` de Eyes on Claude; `plugin.js` además sigue ese stream en el servidor para lanzar los avisos. Solo escucha en 127.0.0.1.

MIT © dfadify-web
