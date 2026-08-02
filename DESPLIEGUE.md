# Runbook de Despliegue — Supabase / Vercel

> Procedimiento operativo, no narrativo. Se sigue igual sin importar qué chat o agente lo ejecute.
> Ningún paso se marca hecho sin evidencia verificable (API de Vercel/Supabase, no memoria de un chat).

---

## Estado real de conexión por frente (verificado 2026-07-31 vía API; SASE Zero corregido 2026-08-02)

| Frente | Vercel | Supabase | Conectados entre sí | Listo para desplegar |
|---|---|---|---|---|
| Teacher OS | no existe | no existe | — | No: sin `ALCANCE.md` cerrado no se abre infraestructura |
| SASE Zero | `sase-light` (`prj_DTSGZfqdmvxb7KFZCKCkCt8Cbuc2`), deploy `READY`, dominios activos | **Desconocido/no verificable desde esta cuenta.** `app/.env` apunta a `VITE_SUPABASE_URL=https://nchofzlpswojqrigbbbk.supabase.co`, una ref que no aparece en `list_projects` de la cuenta conectada. `SASE-Light` (`plyjvvpkaafnkxmmqkbh`) **no es el proyecto correcto** — D-007 retirado confirma que el backend real vive en otra cuenta Supabase de Hugo, sin acceso desde este agente. No tratar `SASE-Light` como el Supabase de SASE Zero en ningún documento | **No — backend real sin acceso verificable.** Ver R-11 | **No hasta tener acceso a la cuenta correcta** |
| Nuevo Horizonte (incluye lo antes registrado como Proyecto Horizonte/CodeBrain, ver D-009) | no existe | no existe (a propósito, ver D-005) | — | No: D-005 aplaza Supabase/despliegue hasta cerrar migración v2. [PR #10](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/10) abierto con un hallazgo P2 de Codex sobre RAG bloquea el avance a los módulos 10–12. **No desplegar aunque el build esté verde** |

Vercel `sase-light` no tiene integración git enlazada (`framework: null`) — los deploys se hicieron por CLI, no por push automático. Cualquier deploy nuevo requiere `vercel deploy` manual desde `SASE-ZERO/` hasta que se decida enlazar el repo (fuera de alcance salvo que Hugo lo pida).

---

## Procedimiento estándar para conectar un frente (Vercel + Supabase)

Seguir en orden. Cada paso exige evidencia antes de pasar al siguiente.

1. **Confirmar que el frente tiene definición de terminado y build en verde.**
   Evidencia: `tsc --noEmit`, pruebas, `build` corridos en esa sesión (no citados de un reporte previo).
2. **Crear o identificar el proyecto Supabase.**
   `list_projects` → si no existe, `create_project`. Registrar el `project_id` en este archivo, no solo en memoria de chat.
3. **Verificar que el `.env` del repo apunta al proyecto Supabase correcto.**
   Comparar `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` del `.env` contra `get_project_url(project_id)`. Si no coincide, es evidencia de desalineación — se corrige antes de desplegar, no después.
4. **Crear o identificar el proyecto Vercel.**
   `list_projects` (con `teamId` de `list_teams`) → si no existe, se crea al desplegar por primera vez.
5. **Configurar variables de entorno en Vercel** con las mismas claves que el `.env` local: URL de Supabase + `publishable key` (`get_publishable_keys`). Nunca la `service_role` key en Vercel del lado cliente.
6. **Desplegar y verificar el `readyState: READY`** antes de declarar el frente desplegado. Un deploy `ERROR` o `BUILDING` no es evidencia de éxito.
7. **Registrar el resultado en la tabla de arriba** con IDs reales, no nombres aproximados.

---

## Regla de bloqueo

No se ejecuta el paso 4–6 (Vercel) para un frente cuyo `DECISIONES.md` tenga una decisión vigente que aplace el despliegue (caso Nuevo Horizonte, D-005). Un build verde no anula una decisión aprobada.

---

## Proyectos huérfanos (Vercel/Supabase sin frente asignado)

Ver R-10 en `RIESGOS.md`. Identificados por carpeta local — son proyectos previos e independientes, **no forman parte de los tres frentes del portafolio**. No se tocan, no se pausan, no se enlazan a ningún frente sin que Hugo lo pida explícitamente:

- Supabase: `FERIA` (↔ carpeta `Diagnostico-Colectivo`/`feria-alternativa`, no confirmado 1:1), `SASE` (`uvnetpnjinxzhggoqmwz`, INACTIVE — proyecto legacy, no confundir con el frente SASE Zero), `Laboratorio-digital-310` (INACTIVE), `SASE-Light` (`plyjvvpkaafnkxmmqkbh`, ACTIVE_HEALTHY — coincide por nombre con SASE Zero pero **no está confirmado como su backend**, ver R-11)
- Vercel con carpeta local confirmada: `stron-registro` (`Projects/stron-registro`), `laboratorio-digital-310` (`Projects/LAB310/Laboratorio-digital-310`), `modulos-math` (`Projects/modulos-math`), `diagnostico-colectivo` (`Projects/Diagnostico-Colectivo`)
- Vercel sin carpeta localizada en `Projects/` (revisar antes de asumir abandono): `sase-310-system`, `atemi-mx-v-3-0`, `laboratorio-digital-310-umsg`, `feria-alternativa`

Conclusión: ninguno de estos proyectos huérfanos es en realidad uno de los tres frentes con nombre distinto. Son trabajo previo legítimo fuera del alcance actual del Command Center.
