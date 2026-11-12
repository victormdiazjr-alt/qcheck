# Cómo se trabaja en `qcheck` (salvaguardas pstack)

> Propuesta generada el 12 nov 2026. Solo agrega reglas de revisión. No cambia el código funcional.

## Modo por defecto: poteto-mode

Todo agente que trabaje aquí arranca en **poteto-mode** (skill `poteto-mode` del plugin pstack). Eso significa:

- Primero se dice en palabras propias la meta de Vik y el cambio más pequeño que la cumple.
- Se nombra la forma de los datos antes de escribir lógica.
- Se prefiere borrar a añadir (Laziness Protocol, Subtract Before You Add).
- Se prueba contra el artefacto real (Prove It Works), no contra un sustituto.

## Puerta de entrega (pstack de Lauren Tan / poteto)

Nada está terminado hasta que se prueba en la app o el sitio real, corriendo, con evidencia.

1. **Compilar, pasar el lint o tener CI en verde es un insumo, no el veredicto.** El veredicto sale de usar la app como la usa una persona.
2. **Evidencia o no pasó.** Cada entrega trae: qué se probó, contra qué instancia (local o URL), capturas o transcripción, y el `report.json` del smoke. Sin evidencia, la entrega se reporta como «sin verificar».
3. **Quien revisa no es quien escribió.** El cambio lo juzga otro agente u otra persona con la skill de verificación del proyecto, no el autor.
4. **Solo lectura por defecto contra lo que está en vivo.** Contra producción o un preview compartido solo se abren páginas (GET). Lo que escribe datos va contra una instancia local.
5. **Nada irreversible sin el sí de Vik:** push, PR, despliegue, migración remota, DNS, borrar datos o mensajes a clientes.

## Cómo se verifica este proyecto

Con la skill del proyecto: `.cursor/skills/verify-qcheck/SKILL.md`. Su mapa de funciones está en `.cursor/skills/verify-qcheck/features/`.

## Errores que se repiten: /correct

Cuando el mismo error de un agente pasa **dos veces**, no se escribe otra nota. Se propone con la skill `correct` un arreglo que lo haga imposible, en este orden: arquitectura, tipos, lint o chequeo de CI, prueba de comportamiento, y solo al final una regla escrita. Es una **propuesta** para que Vik la apruebe; no se aplica sola. Ver `.cursor/rules/correct.mdc`.

## Tabla de reglas y quién las hace cumplir

| Regla | Qué la hace cumplir hoy |
| --- | --- |
| Verificar en la app real con evidencia antes de entregar | `.cursor/rules/poteto-mode.mdc` + skill `verify-qcheck` (texto: nada falla si se salta) |
| Chequeos del repo en cada PR | `.github/workflows/verify.yml` (no bloquea todavía) |
| Error repetido dos veces se encoda en tipos/lint/CI | `.cursor/rules/correct.mdc` (propuesta para Vik) |

## Cuidado en este repo

- Las pruebas de `pruebas/` ESCRIBEN. Solo con `--local`, nunca contra producción (lo dice `pruebas/LEEME.md`).
- `wrangler.toml` apunta a la D1 y al R2 de PRODUCCIÓN y reclama `qterapr.com` como dominio propio. Hoy `qterapr.com` sirve el sitio de QTera, no QCheck. Un `wrangler deploy` desde aquí podría quitarle el dominio al sitio de QTera. Nunca desplegar sin Vik.
- GitHub Pages de este repo marca estado `errored` en la API, aunque la URL responde 200.
