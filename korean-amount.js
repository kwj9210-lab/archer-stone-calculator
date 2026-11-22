/* Game-style Korean amount parser, shared by engraving calculators.
   Supports: 1조 2211억, 8389억 1745만, 1.5조, 123,456,789, x1조.
   Rejects ambiguous/unsafe values instead of silently treating them as zero. */
(function(root){
 'use strict';
 const MAX=BigInt(Number.MAX_SAFE_INTEGER);
 const UNITS=[['경',10000000000000000n],['조',1000000000000n],['억',100000000n],['만',10000n]];
 const LOOKUP=Object.fromEntries(UNITS.map(([unit,power],i)=>[unit,{power,order:i}]));
 function parse(value){
  if(value===null||value===undefined)return NaN;
  let s=String(value).trim().replace(/^[xX×]\s*/,'').replace(/[\s,]/g,'');
  if(s==='')return 0;
  if(/^\d+$/.test(s)){
   const n=Number(s);return Number.isSafeInteger(n)?n:NaN;
  }
  const token=/(\d+(?:\.\d+)?)(경|조|억|만)/g;
  let total=0n,position=0,previousOrder=-1,match;
  while((match=token.exec(s))!==null){
   if(match.index!==position)return NaN;
   const {power,order}=LOOKUP[match[2]];
   if(order<=previousOrder)return NaN;
   const [whole,fraction='']=match[1].split('.');
   const scale=10n**BigInt(fraction.length);
   const numerator=BigInt(whole+fraction)*power;
   if(numerator%scale!==0n)return NaN;
   total+=numerator/scale;
   if(total>MAX)return NaN;
   position=token.lastIndex;previousOrder=order;
  }
  if(position===0)return NaN;
  const tail=s.slice(position);
  if(tail&&!/^\d+$/.test(tail))return NaN;
  total+=BigInt(tail||'0');
  return total<=MAX?Number(total):NaN;
 }
 function storedText(value,fallback='0'){
  if(value===undefined||value===null)return fallback;
  const s=String(value);
  return s.length<=96&&/^[0-9경조억만.,xX×\s]*$/.test(s)?s:fallback;
 }
 root.ArcherKoreanAmount={parse,storedText};
})(typeof window!=='undefined'?window:globalThis);
