(function(root){
'use strict';
const DAY=86400000;
const seeds=[
['target audience','целевая аудитория','We need to understand our target audience.','Нам нужно понять нашу целевую аудиторию.','Реклама'],
['brand awareness','узнаваемость бренда','The campaign increased brand awareness.','Кампания повысила узнаваемость бренда.','Реклама'],
['call to action','призыв к действию','Add a clear call to action.','Добавьте понятный призыв к действию.','Реклама'],
['creative brief','креативный бриф','Please send me the creative brief.','Пожалуйста, отправьте мне креативный бриф.','Реклама'],
['press release','пресс-релиз','We will publish the press release tomorrow.','Мы опубликуем пресс-релиз завтра.','PR'],
['media coverage','освещение в СМИ','The event received positive media coverage.','Событие получило положительное освещение в СМИ.','PR'],
['stakeholder','заинтересованная сторона','We should keep every stakeholder informed.','Нам следует держать каждую заинтересованную сторону в курсе.','PR'],
['key message','ключевое сообщение','Keep the key message simple.','Сделайте ключевое сообщение простым.','PR'],
['follow up','связаться повторно','I will follow up with the client tomorrow.','Я повторно свяжусь с клиентом завтра.','Бизнес-коммуникации'],
['meet a deadline','уложиться в срок','We need to meet a deadline.','Нам нужно уложиться в срок.','Бизнес-коммуникации'],
['Could you clarify that?','Не могли бы вы это уточнить?','Could you clarify that before we proceed?','Не могли бы вы это уточнить, прежде чем мы продолжим?','Бизнес-коммуникации'],
['Let’s align on the next steps.','Давайте согласуем дальнейшие шаги.','Let’s align on the next steps.','Давайте согласуем дальнейшие шаги.','Бизнес-коммуникации'],
['tone of voice','тон коммуникации','The translation should preserve the tone of voice.','Перевод должен сохранять тон коммуникации.','Перевод'],
['localization','локализация','Localization goes beyond translating words.','Локализация выходит за рамки перевода слов.','Перевод'],
['source text','исходный текст','Check the meaning in the source text.','Проверьте значение в исходном тексте.','Перевод'],
['proofread','вычитать текст','Please proofread the final version.','Пожалуйста, вычитайте окончательную версию.','Перевод']];
function initial(){return {version:1,words:seeds.map((s,i)=>({id:'demo-'+i,en:s[0],ru:s[1],example:s[2],exampleRu:s[3],topic:s[4],alternatives:[],demo:true,due:0,interval:0,reviews:0,mistakes:0})),history:[],settings:{ignorePunctuation:true,rate:0.85}};}
function normalize(s,ignore=true){let t=s.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").trim();if(ignore)t=t.replace(/[^\p{L}\p{N}\s]/gu,'');return t.replace(/\s+/g,' ');}
function schedule(w,rating,now=Date.now()){let interval=rating==='again'?0:rating==='hard'?Math.max(1,Math.round((w.interval||1)*1.2)):Math.max(3,Math.round((w.interval||1)*2.5));return {...w,interval,due:now+(rating==='again'?600000:interval*DAY),reviews:w.reviews+1,mistakes:rating==='again'?w.mistakes+1:rating==='easy'?Math.max(0,w.mistakes-1):w.mistakes};}
function validate(data){if(!data||data.version!==1||!Array.isArray(data.words)||data.words.length>10000||!Array.isArray(data.history)||data.history.length>100000)throw Error('Неподходящий формат резервной копии.');let ids=new Set();const words=data.words.map(w=>{if(!w||typeof w.id!=='string'||!w.id||ids.has(w.id))throw Error('Повторяющийся или пустой идентификатор.');ids.add(w.id);for(const k of ['en','ru','topic'])if(typeof w[k]!=='string'||!w[k].trim()||w[k].length>2000)throw Error('Проверьте слова и переводы в копии.');for(const k of ['due','interval','reviews','mistakes'])if(!Number.isFinite(w[k])||w[k]<0)throw Error('Некорректный прогресс в копии.');if(!Array.isArray(w.alternatives)||w.alternatives.some(s=>typeof s!=='string'||s.length>2000))throw Error('Некорректные варианты ответа.');return {id:w.id,en:w.en,ru:w.ru,topic:w.topic,example:typeof w.example==='string'?w.example:'',exampleRu:typeof w.exampleRu==='string'?w.exampleRu:'',alternatives:w.alternatives,alternativesRu:Array.isArray(w.alternativesRu)?w.alternativesRu.filter(s=>typeof s==='string'&&s.length<=2000):[],demo:!!w.demo,due:w.due,interval:w.interval,reviews:w.reviews,mistakes:w.mistakes};});const history=data.history.map(h=>{if(!h||!Number.isFinite(h.at)||typeof h.id!=='string'||typeof h.correct!=='boolean'||!['cards','dictation'].includes(h.type))throw Error('Некорректная история.');return {at:h.at,id:h.id,correct:h.correct,type:h.type};});return {version:1,words,history,settings:{ignorePunctuation:data.settings?.ignorePunctuation!==false,rate:Math.min(1.2,Math.max(.5,Number(data.settings?.rate)||.85))}};}
function diff(expected,actual,ignore=true){const a=expected.split(/\s+/),b=actual.trim().split(/\s+/).filter(Boolean),dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)dp[i][0]=i;for(let j=0;j<=b.length;j++)dp[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(normalize(a[i-1],ignore)===normalize(b[j-1],ignore)?0:1));let i=a.length,j=b.length,out=[];while(i||j){if(i&&j&&dp[i][j]===dp[i-1][j-1]+(normalize(a[i-1],ignore)===normalize(b[j-1],ignore)?0:1)){out.unshift({expected:a[--i],actual:b[--j],ok:normalize(a[i],ignore)===normalize(b[j],ignore)});}else if(i&&dp[i][j]===dp[i-1][j]+1)out.unshift({expected:a[--i],actual:'',ok:false});else out.unshift({expected:'',actual:b[--j],ok:false});}return out;}
function checkTranslation(w,input,direction,ignore=true){if(!input.trim())return false;const ru=direction==='en-ru',answers=ru?[w.ru,...w.ru.split(/\s*;\s*/),...(w.alternativesRu||[])]:[w.en,...(w.alternatives||[])];const norm=s=>{let n=normalize(s,ignore);return ru?n.replace(/ё/g,'е'):n};return answers.some(a=>norm(a)===norm(input));}
function parseList(text,existing=[]){
const rows=[],errors=[],seen=new Set(existing.map(w=>normalize(w.en,false)+'\u0000'+normalize(w.ru,false)));
const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);if(lines.length>2000)throw Error('Вставь не больше 2000 строк за один раз.');
for(let i=0;i<lines.length;i++){let line=lines[i].trim().replace(/^(?:\d+[.)]\s+|[•*]\s+)/,'');if(!line)continue;
const m=line.match(/\t+|\s*(?:→|=>|=|—|–)\s*|\s+-\s+|\s*;\s*/);
if(!m){errors.push({line:i+1,text:line,reason:'Нет разделителя между словом и переводом'});continue}
const en=line.slice(0,m.index).trim(),ru=line.slice(m.index+m[0].length).trim();
if(!en||!ru||en.length>200||ru.length>300){errors.push({line:i+1,text:line,reason:'Нужны слово (до 200 знаков) и перевод (до 300 знаков)'});continue}
const key=normalize(en,false)+'\u0000'+normalize(ru,false),duplicate=seen.has(key);seen.add(key);rows.push({en,ru,line:i+1,duplicate});}
return {rows,errors};
}
root.Lexika={initial,normalize,schedule,validate,diff,parseList,checkTranslation};if(typeof module!=='undefined')module.exports=root.Lexika;
})(globalThis);
