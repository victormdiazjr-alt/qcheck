#!/bin/sh
# Corre todas las pruebas y SALE CON ERROR si alguna falla.
# Existe porque el 14 de agosto un bucle escrito a mano imprimió «todas en
# verde» con dos en rojo: el `echo` iba después del bucle y no miraba nada.
# Un comprobador que no puede fallar es de la misma familia que todo lo demás.
cd "$(dirname "$0")/.." || exit 2
mal=0
for t in pruebas/*.mjs; do
  if node "$t" >/dev/null 2>&1; then echo "  ✓ $(basename "$t")"
  else echo "  ✗ $(basename "$t")"; mal=$((mal+1)); fi
done
node verificar.js >/dev/null 2>&1 || { echo "  ✗ verificar.js"; mal=$((mal+1)); }
[ "$mal" -eq 0 ] && echo "\n  sin fallos\n" || echo "\n  $mal FALLO(S)\n"
exit "$mal"
