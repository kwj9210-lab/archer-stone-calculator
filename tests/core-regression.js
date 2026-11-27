function runCoreTests(html,dataset){
 let assertions=0,failed=[];
 function check(cond,label){ assertions++;if(!cond)failed.push(label); }
 const pattern=/\{heaven:"(\d+)",nebula:"(\d+)",core:"(\d+)",attack:"(\d+)"\}/g;
 const matches=[...html.matchAll(pattern)];
 check(matches.length===20,"core.html has 20 seeded stages");
 check(dataset.stages.length===20,"data JSON has 20 stages");
 const rows=matches.map(x=>({heaven:Number(x[1]),nebula:Number(x[2]),core:Number(x[3]),attack:Number(x[4])}));
 const expected=[];
 for(let level=1;level<=20;level++){
  const group=Math.floor((level-1)*205/1024);
  expected.push({heaven:1000000000+group*200000000,nebula:(group+5)*100000000,core:level<12?level+11:level*2,attack:3999999983616+group*799999983616});
 }
 for(let i=0;i<20;i++){
  for(const key of ["heaven","nebula","core","attack"]){
   check(rows[i]?.[key]===expected[i][key],"HTML stage "+(i+1)+" "+key);
   const k={heaven:"TranscendHeaven",nebula:"TranscendNebula",core:"TranscendCores",attack:"TranscendStepDigits"}[key];
   check(dataset.stages[i]?.[k]===expected[i][key],"JSON stage "+(i+1)+" "+key);
  }
 }
 const sums=arr=>arr.reduce((a,r)=>({heaven:a.heaven+r.heaven,nebula:a.nebula+r.nebula,core:a.core+r.core,attack:a.attack+r.attack}),{heaven:0,nebula:0,core:0,attack:0});
 const prefix=[{heaven:0,nebula:0,core:0,attack:0}];
 for(const r of expected){const p=prefix[prefix.length-1];prefix.push({heaven:p.heaven+r.heaven,nebula:p.nebula+r.nebula,core:p.core+r.core,attack:p.attack+r.attack});}
 for(let from=0;from<=20;from++){
  for(let to=from;to<=20;to++){
   const a=sums(rows.slice(from,to)),b=prefix[to],p=prefix[from];
   for(const k of ["heaven","nebula","core","attack"])check(a[k]===b[k]-p[k],"interval "+from+"->"+to+" "+k);
  }
 }
 for(let t=0;t<100;t++){
  const from=t%21,to=from+(t*7)%(21-from);
  const cost=sums(rows.slice(from,to));
  const inventory=Math.floor(cost.core*((t%10)/10));
  const shortage=Math.max(0,cost.core-inventory);
  check(Number.isSafeInteger(shortage)&&shortage>=0&&shortage<=cost.core,"shortage "+t);
  check(Math.max(0,shortage-inventory)<=shortage,"craft transfer "+t);
 }
 for(let t=0;t<100;t++){
  const goal=t%11,own=t%7;
  const remaining=Math.max(0,goal-own);
  let pieces=0;
  for(let j=0;j<20;j++){const owned=(t+j)%5;pieces+=Math.max(0,remaining-owned);}
  check(Number.isSafeInteger(pieces)&&pieces>=0&&pieces<=remaining*20,"pieces quantity "+t);
 }
 check(prefix[20].heaven===26000000000,"20 stage heaven total");
 check(prefix[20].nebula===13000000000,"20 stage nebula total");
 check(prefix[20].core===475,"20 stage core total");
 check(prefix[20].attack===103999999180800,"20 stage attack total");
 // 0.2.14 stage-cap and fixed-price inheritance regression checks.
 check(html.includes("const MAX_TRANSCEND=100"),"maximum transcend stage is 100");
 check(html.includes("const FIXED_FROM_LEVEL=35"),"fixed price source level is 35");
 check(html.includes("while(stageData.length<MAX_TRANSCEND)stageData.push"),"stage data array is expanded to 100");
 check(html.includes("for(let i=FIXED_FROM_LEVEL;i<MAX_TRANSCEND;i++)Object.assign(stageData[i],source)"),"stages 36-100 inherit stage 35 costs");
 check(html.includes("level<=35"),"provisional extension covers levels 21-35");
 check(html.includes("i+1>=21&&i+1<=35"),"provisional levels are visibly flagged");
 check(html.includes("0.2.14 네이티브 바이너리 교차검증"),"unverified 0.2.14 values are disclosed");
 check(html.includes('a.value=b.value=String(i)'),"stage selectors are generated from the maximum stage");
 check(html.includes('i<=MAX_TRANSCEND'),"stage selectors include level 100");
 check(html.includes('id="handoffCraft"'),"craft handoff UI");
 check(html.includes('id="pieceRows"'),"20 piece editor UI");
 check(html.includes('const defaultStageData=stageData.map'),"reset verified stage defaults");
 check(html.includes('function safeAdd(a,b)'),"safe integer overflow protection");
 check(html.includes("recipeVerified:false"),"unknown recipe status explicit");
 check(!html.includes('id="platinumEach"'),"old identical recipe removed");
 return {assertions,pass:assertions-failed.length,fail:failed.length,failed:failed.slice(0,15),sums:prefix[20]};
}
if (typeof require==="function" && typeof module!=="undefined" && require.main===module) {
 const fs=require("node:fs");
 const path=require("node:path");
 const root=path.resolve(__dirname,"..");
 const html=fs.readFileSync(path.join(root,"core.html"),"utf8");
 const dataset=JSON.parse(fs.readFileSync(path.join(root,"data","transcendence-core-v0.2.10.json"),"utf8"));
 const report=runCoreTests(html,dataset);
 console.log(JSON.stringify(report,null,2));
 if(report.fail)process.exitCode=1;
}
if(typeof module!=="undefined")module.exports={runCoreTests};
