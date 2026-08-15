/* El interruptor de la 934, con `core.js` de verdad.
   Víctor: «el 934 ser un botón que se prende y se apaga. Si se prende aplica
   la permeabilidad y los límites de 934. Si no, límites normales.» */
import { readFileSync } from "node:fs";

const HOY = (() => { const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();

function conObra(specObra, specDia) {
  const alm = new Map([["qc-user","tecnico1"]]);
  const ctx = {
    localStorage:{ getItem:(k)=>alm.get(k)??null, setItem:(k,v)=>alm.set(k,String(v)), removeItem:(k)=>alm.delete(k) },
    document:{ getElementById:()=>null, addEventListener(){}, querySelectorAll:()=>[],
               createElement:()=>({style:{},classList:{add(){}}}),
               documentElement:{dataset:{},style:{setProperty(){}}}, head:{appendChild(){}}, body:{appendChild(){}} },
    window:{ addEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}}) },
    navigator:{onLine:true}, location:{pathname:"/x.html",hash:"",replace(){}},
    setInterval:()=>0, clearInterval(){}, setTimeout:()=>0, console,
    crypto:{randomUUID:()=>"u"}, fetch:async()=>{throw new Error("sin red")},
    addEventListener(){}, removeEventListener(){}, requestAnimationFrame:()=>0,
  };
  const meta = specDia === undefined ? {} : { spec: specDia };
  const src = readFileSync("assets/core.js","utf8");
  const f = new Function(...Object.keys(ctx), src + `
    ;db = { tests: [], dayMeta: { "${HOY}": ${JSON.stringify(meta)} }, humidity: [], plan: {},
            proyectos: [{ id:"p", name:"Obra", spec: ${JSON.stringify(specObra)} }], proyectoActivo:"p" };
    db.project = db.proyectos[0];
    return { es934, specDelDia };`);
  return f(...Object.values(ctx));
}

let fallos = 0;
const di=(ok,t)=>{ console.log(`  ${ok?"✓":"✗"} ${t}`); if(!ok) fallos++; };

console.log("\nOBRA CON 934 — la PR-52 de hoy");
di(conObra("934", undefined).es934(HOY) === true,  "sin decir nada, el tiro hereda la 934");
di(conObra("934", "934").es934(HOY)     === true,  "interruptor ENCENDIDO: es 934");
di(conObra("934", "no").es934(HOY)      === false, "interruptor APAGADO: NO es 934 aunque la obra lo sea");

console.log("\nOBRA SIN 934");
di(conObra("", undefined).es934(HOY) === false, "sin decir nada, no es 934");
di(conObra("", "934").es934(HOY)     === true,  "y aun así un tiro suelto puede serlo");
di(conObra("", "no").es934(HOY)      === false, "apagado, sigue sin serlo");

console.log("\nLO GUARDADO ANTES DE HOY NO CAMBIA DE VEREDICTO");
di(conObra("934", "").es934(HOY) === true, "spec en blanco sigue heredando, como siempre");

console.log("\nY EL FORMULARIO PREGUNTA CON UN INTERRUPTOR, NO CON DOS OPCIONES IGUALES");
{
  const c = readFileSync("assets/core.js","utf8");
  di(/\{ key: "es934", label: "SP-934", type: "checkbox"/.test(c),
     "es un interruptor y el rótulo es solo «SP-934»");
  di(/\.\.\.\(specDelDia\(day\) === "934" \? \[\{\s*\n\s*key: "nivelPermeabilidad"/.test(c),
     "la permeabilidad SOLO se pregunta si la 934 está encendida");
  di(!/Como el proyecto \(\$\{QC_SPECS/.test(c), "y ya no existe la opción que decía lo mismo dos veces");
  di(/db\.dayMeta\[day\]\.spec = db\.dayMeta\[day\]\.es934 \? "934" : "no"/.test(c),
     "apagado se guarda como «no», no en blanco");
  di(/if \(v\.es934 && !\(db\.project \|\| \{\}\)\.clase934/.test(c),
     "y solo pregunta lo de la 934 si está encendido");
}

console.log(fallos ? `\n  ${fallos} FALLO(S)\n` : "\n  sin fallos\n");
process.exit(fallos ? 1 : 0);
