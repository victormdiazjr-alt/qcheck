# Los límites no se aplican hacia atrás — Q-40 y Q-41

Estas pruebas necesitan el motor cargado (`db`, `zoneSlump`, `planDe`…), así que
se corren **en el navegador**, no con Node.

## Cómo

1. `node serve.js` y abrir `results.html` entrando como `ruben`
2. Consola del navegador
3. Pegar los dos bloques de abajo

Escriben y restauran solos. No dejan rastro.

## 1 · Cambiar los límites no re-juzga la historia

```js
(() => {
  const r=[]; const ok=(n,c,e)=>r.push((c?"✓ ":"✗ ")+n+(e&&!c?"  → "+e:""));
  const huella=()=> (db.tests||[]).map(t=>`${t.n}:${zoneSlump(t)}|${zoneAir(t)}|${zoneUW(t)}|${zoneTemp(t)}|${zoneCS5(t.cs5,t.date)}`).join(";");
  const antes=huella(), planViejo=JSON.parse(JSON.stringify(db.plan));
  ok("la migración creó la primera versión", Array.isArray(db.planes)&&db.planes.length===1);
  ok("arranca en el ensayo más antiguo", db.planes[0].desde===(db.tests||[]).map(t=>t.date).filter(Boolean).sort()[0]);
  migrarPlanes(); ok("volver a migrar no cambia nada", huella()===antes);
  const n=JSON.parse(JSON.stringify(db.plan)); n.slump.actLo=3.4; n.slump.actHi=3.6;
  guardarPlan(n,"prueba");
  ok("se añadió una versión", db.planes.length===2);
  const hist=(db.tests||[]).filter(t=>t.date<todayISO());
  const malos=hist.filter(t=>!antes.includes(`${t.n}:${zoneSlump(t)}|${zoneAir(t)}|${zoneUW(t)}|${zoneTemp(t)}|${zoneCS5(t.cs5,t.date)}`));
  ok("NINGÚN ensayo histórico cambió de veredicto", malos.length===0, malos.length+" cambiaron");
  const dia=hist.length?hist[hist.length-1].date:null;
  ok("la carta de un día viejo dibuja los límites viejos", bandsFor("slump",dia).actLo===planViejo.slump.actLo);
  ok("la de hoy dibuja los nuevos", bandsFor("slump",todayISO()).actLo===3.4);
  db.planes=[db.planes[0]]; db.plan=planViejo; saveDB();
  ok("restaurado", huella()===antes);
  console.log(r.join("\n"));
})()
```

## 2 · Un tiro cerrado queda congelado y cerrado

```js
(() => {
  const r=[]; const ok=(n,c,e)=>r.push((c?"✓ ":"✗ ")+n+(e&&!c?"  → "+e:""));
  const copia=JSON.parse(JSON.stringify({plan:db.plan,planes:db.planes,dayMeta:db.dayMeta}));
  const dia=(db.tests||[]).map(t=>t.date).filter(Boolean).sort().pop();
  const delDia=(db.tests||[]).filter(t=>t.date===dia), antes=delDia.map(t=>zoneSlump(t)).join(",");
  if(!db.dayMeta[dia]) db.dayMeta[dia]={};
  db.dayMeta[dia].cerradoA="17:00"; db.dayMeta[dia].cerradoPor="Rubén Segarra";
  db.dayMeta[dia].plan=JSON.parse(JSON.stringify(planDe(dia))); saveDB();
  ok("el cierre congeló el plan", !!db.dayMeta[dia].plan);
  const n=JSON.parse(JSON.stringify(db.plan)); n.slump.actLo=3.45; n.slump.actHi=3.55; n.tempMax=60;
  guardarPlan(n,"prueba");
  ok("el día cerrado no cambió", delDia.map(t=>zoneSlump(t)).join(",")===antes);
  ok("planDe devuelve el congelado", planDe(dia).slump.actLo===copia.plan.slump.actLo);
  ok("la nota lo explica", (notaDeLimites(dia)||"").includes("congelados"));
  sessionStorage.setItem("qc-user","admin");
  ok("admin NO puede tocarlo", puedeEditarDia(dia)!==true);
  sessionStorage.setItem("qc-user","ruben");
  ok("el ingeniero de récord SÍ", puedeEditarDia(dia)===true);
  ok("un día abierto lo edita cualquiera de QC", puedeEditarDia(todayISO())===true);
  db.plan=copia.plan; db.planes=copia.planes; db.dayMeta=copia.dayMeta; saveDB();
  ok("restaurado", delDia.map(t=>zoneSlump(t)).join(",")===antes);
  console.log(r.join("\n"));
})()
```

## Qué se espera

Todo en verde. **La que más importa es «NINGÚN ensayo histórico cambió de
veredicto»**: si esa falla, cambiar un límite está reescribiendo el récord del
proyecto hacia atrás, que es exactamente lo que Q-40 vino a impedir.
