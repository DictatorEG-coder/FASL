import { STORIES, type Story, type Scene } from "./stories";

interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  ADMIN_IDS?: string;
  APP_NAME?: string;
  POLL_DELAY_SECONDS?: string;
  POLL_DURATION_SECONDS?: string;
  FRIDAY_REMINDER_ENABLED?: string;
}
type TgMessage = { message_id:number; chat:{id:number;type:string;title?:string}; from?:{id:number;first_name?:string;username?:string}; text?:string };
type TgUpdate = { update_id:number; message?:TgMessage; callback_query?:{id:string;from:{id:number;first_name?:string;username?:string};message?:TgMessage;data?:string}; poll?:{id:string;is_closed:boolean;options:{text:string;voter_count:number}[]}; my_chat_member?:unknown };
type Session = {session_id:string;chat_id:string;user_id:string;story_id:string;scene_id:string;status:string;mode:"private"|"group";poll_id:string|null;pending_poll_scene:string|null;poll_due_at:number|null};
const json = (v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{"content-type":"application/json; charset=utf-8"}});
const now = ()=>Math.floor(Date.now()/1000);
const id = ()=>crypto.randomUUID();
const parse = <T>(s:string)=>JSON.parse(s) as T;

async function tg(env:Env,method:string,payload:Record<string,unknown>={}) {
  const r=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const data=await r.json() as {ok:boolean;result:any;description?:string};
  if(!r.ok||!data.ok) throw new Error(data.description||`Telegram API ${method} failed`);
  return data.result;
}
async function send(env:Env,chat_id:string,text:string,reply_markup?:unknown) {
  return tg(env,"sendMessage",{chat_id,text,parse_mode:"HTML",disable_web_page_preview:true,...(reply_markup?{reply_markup}:{})});
}
async function sendPhoto(env:Env,chat_id:string,photo:string,caption:string,reply_markup?:unknown) {
  return tg(env,"sendPhoto",{chat_id,photo,caption,parse_mode:"HTML",...(reply_markup?{reply_markup}:{})});
}
async function resolveCaseEnding(env:Env,s:Session,story:Story){
  const file=story.caseFile;
  if(!file)return {title:"القضية حُلّت",text:story.title};
  const [clues,interrogations]=await Promise.all([
    env.DB.prepare("SELECT clue_id FROM session_clues WHERE session_id=?").bind(s.session_id).all<{clue_id:string}>(),
    env.DB.prepare("SELECT question_key FROM session_interrogations WHERE session_id=?").bind(s.session_id).all<{question_key:string}>()
  ]);
  const clueSet=new Set(clues.results.map(x=>x.clue_id));
  const interrogationSet=new Set(interrogations.results.map(x=>x.question_key));
  const ending=file.endings?.find(x=>x.requiredClues.every(id=>clueSet.has(id))&&x.requiredInterrogations.every(key=>interrogationSet.has(key)));
  return ending?{title:ending.title,text:ending.text}:file.defaultEnding||{title:"القضية حُلّت",text:file.explanation};
}
async function showCaseResolution(env:Env,s:Session,story:Story){
  const ending=await resolveCaseEnding(env,s,story);
  await send(env,s.chat_id,`<b>أحسنتم! حلّت المجموعة القضية.</b>\n\n<b>${escapeHtml(ending.title)}</b>\n${escapeHtml(ending.text)}\n\n<b>انتهى التحقيق.</b>`);
  await finish(env,s,{text:ending.title,ending:true});
}
async function showInterrogationMenu(env:Env,s:Session,story:Story){
  const suspects=story.caseFile?.suspects||[];if(!suspects.length)return;
  await send(env,s.chat_id,"<b>🕵️ غرفة الاستجواب</b>\nاختر شخصًا لمواجهته. يمكنك العودة إلى هنا بعد جمع أدلة جديدة.",{inline_keyboard:suspects.map(x=>[{text:x.name,callback_data:`suspect:${s.session_id}:${x.id}`}])});
}
async function eligibleChoices(env:Env,sessionId:string,choices:NonNullable<Scene["choices"]>){
  const rows=await env.DB.prepare("SELECT clue_id FROM session_clues WHERE session_id=?").bind(sessionId).all<{clue_id:string}>();
  const flags=new Set(rows.results.map(x=>x.clue_id));
  return choices.filter(c=>(!c.requires||c.requires.every(x=>flags.has(x)))&&(!c.excludes||c.excludes.every(x=>!flags.has(x))));
}
async function grantChoiceEffects(env:Env,sessionId:string,choice:NonNullable<Scene["choices"]>[number]){
  for(const clue of choice.grants||[]) await env.DB.prepare("INSERT OR IGNORE INTO session_clues(session_id,clue_id,title,detail) VALUES(?,?,?,?)").bind(sessionId,clue.id,clue.title,clue.detail).run();
}
async function showChoices(env:Env,chatId:string,sessionId:string,choices:NonNullable<Scene["choices"]>) {
  const available=await eligibleChoices(env,sessionId,choices);
  for(let i=0;i<available.length;i++){
    const choice=available[i];
    const markup={inline_keyboard:[[{text:choice.text,callback_data:`choose:${sessionId}:${i}`}]]};
    if(choice.image){
      try{await sendPhoto(env,chatId,choice.image,`<b>${escapeHtml(choice.text)}</b>`,markup);}
      catch(e){console.error("choice image failed",e);await send(env,chatId,`<b>${escapeHtml(choice.text)}</b>`,markup);}
    } else await send(env,chatId,`<b>${escapeHtml(choice.text)}</b>`,markup);
  }
}
function escapeHtml(s:string){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!));}
function isAdmin(env:Env,userId:string){return (env.ADMIN_IDS||"").split(",").map(x=>x.trim()).filter(Boolean).includes(userId);}
async function storyById(db:D1Database,storyId:string):Promise<Story|null>{
  const row=await db.prepare("SELECT content_json,active FROM stories WHERE story_id=?").bind(storyId).first<{content_json:string;active:number}>();
  if(row)return row.active===1?parse<Story>(row.content_json):null;
  return STORIES.find(s=>s.id===storyId)||null;
}
async function ensureSeed(db:D1Database){
  for(const s of STORIES) await db.prepare("INSERT INTO stories(story_id,title,description,genre,estimated_minutes,content_json) VALUES(?,?,?,?,?,?) ON CONFLICT(story_id) DO UPDATE SET title=excluded.title,description=excluded.description,genre=excluded.genre,estimated_minutes=excluded.estimated_minutes,content_json=excluded.content_json").bind(s.id,s.title,s.description,s.genre,s.minutes,JSON.stringify(s)).run();
}
async function recordUser(env:Env,m:TgMessage){
  if(m.from) await env.DB.prepare("INSERT INTO users(telegram_id,first_name,username) VALUES(?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET first_name=excluded.first_name,username=excluded.username,last_seen_at=CURRENT_TIMESTAMP").bind(String(m.from.id),m.from.first_name||"",m.from.username||null).run();
  await env.DB.prepare("INSERT INTO chats(chat_id,chat_type,title) VALUES(?,?,?) ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title,last_seen_at=CURRENT_TIMESTAMP").bind(String(m.chat.id),m.chat.type,m.chat.title||null).run();
}
async function listStories(env:Env,chatId:string){
  const rows=await env.DB.prepare("SELECT story_id,title,description,genre,estimated_minutes FROM stories WHERE active=1 ORDER BY created_at").all<{story_id:string;title:string;description:string;genre:string;estimated_minutes:number}>();
  const keyboard=rows.results.map(s=>[{text:`${s.title} · ${s.estimated_minutes} د`,callback_data:`play:${s.story_id}`}]);
  if(!keyboard.length){await send(env,chatId,"لا توجد قصص متاحة حاليًا.");return;}
  await send(env,chatId,"<b>مكتبة فَصْل</b>\nاختر قصة لبدء التجربة:",{inline_keyboard:keyboard});
}
async function getSession(db:D1Database,chatId:string){return db.prepare("SELECT * FROM sessions WHERE chat_id=? AND status IN ('active','waiting_poll','polling')").bind(chatId).first<Session>();}
async function showScene(env:Env,session:Session,story:Story,sceneId:string){
  const scene=story.scenes[sceneId]; if(!scene){await send(env,session.chat_id,"حدث خلل في مسار القصة. أوقفنا الجلسة لحماية تقدمك.");return;}
  if(scene.clue) await env.DB.prepare("INSERT OR IGNORE INTO session_clues(session_id,clue_id,title,detail) VALUES(?,?,?,?)").bind(session.session_id,scene.clue.id,scene.clue.title,scene.clue.detail).run();
  await env.DB.prepare("UPDATE sessions SET scene_id=?,poll_id=NULL,pending_poll_scene=NULL,poll_due_at=NULL,status='active',updated_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(sceneId,session.session_id).run();
  if(session.mode==="group"){
    await send(env,session.chat_id,`<b>${escapeHtml(story.title)}</b>\n\n${escapeHtml(scene.text)}`);
    if(story.caseFile) await send(env,session.chat_id,"أدوات التحقيق:",{inline_keyboard:[[{text:"📁 دفتر الأدلة",callback_data:`clues:${session.session_id}`},{text:"🕵️ استجواب المشتبه بهم",callback_data:`interrogate:${session.session_id}`}]]});
    if(scene.ending){await finish(env,session,scene);return;}
    await env.DB.prepare("UPDATE sessions SET status='waiting_poll',pending_poll_scene=?,poll_due_at=? WHERE session_id=?").bind(sceneId,now()+Number(env.POLL_DELAY_SECONDS||120),session.session_id).run();
    return;
  }
  if(scene.ending){await send(env,session.chat_id,`<b>${escapeHtml(story.title)}</b>\n\n${escapeHtml(scene.text)}\n\n<b>انتهت القصة.</b>`);await finish(env,session,scene);return;}
  await send(env,session.chat_id,`<b>${escapeHtml(story.title)}</b>\n\n${escapeHtml(scene.text)}`);
  await showChoices(env,session.chat_id,session.session_id,scene.choices||[]);
  if(story.caseFile){await send(env,session.chat_id,"أدوات التحقيق:",{inline_keyboard:[[{text:"📁 دفتر الأدلة",callback_data:`clues:${session.session_id}`},{text:"🕵️ استجواب المشتبه بهم",callback_data:`interrogate:${session.session_id}`}]]});}
}
async function finish(env:Env,s:Session,scene:Scene){
  await env.DB.prepare("UPDATE sessions SET status='finished',updated_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(s.session_id).run();
  await send(env,s.chat_id,"إذا استمتعت بالقصة، قيّم التجربة:",{inline_keyboard:[[{text:"⭐",callback_data:`rate:${s.session_id}:1`},{text:"⭐⭐",callback_data:`rate:${s.session_id}:2`},{text:"⭐⭐⭐",callback_data:`rate:${s.session_id}:3`},{text:"⭐⭐⭐⭐",callback_data:`rate:${s.session_id}:4`},{text:"⭐⭐⭐⭐⭐",callback_data:`rate:${s.session_id}:5`}]]});
}
async function startStory(env:Env,chatId:string,userId:string,storyId:string,mode:"private"|"group"){
  const story=await storyById(env.DB,storyId);if(!story){await send(env,chatId,"القصة غير متاحة.");return;}
  const old=await getSession(env.DB,chatId);
  if(old) await env.DB.prepare("UPDATE sessions SET status='stopped' WHERE session_id=?").bind(old.session_id).run();
  const session:Session={session_id:id(),chat_id:chatId,user_id: userId,story_id:storyId,scene_id:story.start,status:"active",mode,poll_id:null,pending_poll_scene:null,poll_due_at:null};
  await env.DB.prepare("INSERT INTO sessions(session_id,chat_id,user_id,story_id,scene_id,status,mode) VALUES(?,?,?,?,?,'active',?)").bind(session.session_id,chatId,userId,storyId,story.start,mode).run();
  await showScene(env,session,story,story.start);
}
async function onMessage(env:Env,m:TgMessage){
  await recordUser(env,m);
  const chatId=String(m.chat.id),userId=String(m.from?.id||"");
  const text=(m.text||"").trim();
  const command=(text.split(/\s+/,1)[0]||"").split("@")[0];
  if(command==="/start"){await send(env,chatId,"أهلًا بك في <b>فَصْل</b> — قصص تفاعلية، وقرارات تغيّر مجرى الأحداث.\n\nاستخدم /stories لاختيار قصة أو /help للمساعدة.");return;}
  if(command==="/help"){await send(env,chatId,"/stories — مكتبة القصص\n/stop — إنهاء الجلسة الحالية\n/admin — لوحة المالك (للمالك فقط)\n\nفي المجموعات: أضف البوت وامنحه صلاحية إرسال الرسائل والتصويت.");return;}
  if(command==="/stories"){await listStories(env,chatId);return;}
  if(command==="/stop"){const s=await getSession(env.DB,chatId);if(s){await env.DB.prepare("UPDATE sessions SET status='stopped' WHERE session_id=?").bind(s.session_id).run();await send(env,chatId,"أُوقفت الجلسة. يمكنك بدء قصة جديدة عبر /stories.");}else await send(env,chatId,"لا توجد جلسة نشطة.");return;}
  if(command==="/broadcast"){
    if(!isAdmin(env,userId)){await send(env,chatId,"هذا الأمر مخصص للمالك.");return;}
    const body=text.includes(" ")?text.slice(text.indexOf(" ")+1).trim():"";if(!body){await send(env,chatId,"اكتب الرسالة بعد الأمر: /broadcast نص الرسالة");return;}
    const targets=await env.DB.prepare("SELECT chat_id FROM chats").all<{chat_id:string}>();
    let ok=0,failed=0;
    for(const target of targets.results){try{await send(env,target.chat_id,escapeHtml(body));ok++;}catch{failed++;}}
    await send(env,chatId,`انتهت الإذاعة. وصلت إلى ${ok} محادثة، وفشلت ${failed}.`);return;
  }
  if(command==="/story"){
    if(!isAdmin(env,userId)){await send(env,chatId,"هذا الأمر مخصص للمالك.");return;}
    const [,action,storyId]=text.split(/\s+/,3);
    if(!["on","off"].includes(action)||!storyId){await send(env,chatId,"الاستخدام: /story on|off story-id");return;}
    const result=await env.DB.prepare("UPDATE stories SET active=? WHERE story_id=?").bind(action==="on"?1:0,storyId).run();
    await send(env,chatId,result.meta.changes?`تم ${action==="on"?"تفعيل":"إيقاف"} القصة.`:"لم أجد هذه القصة.");return;
  }
  if(command==="/admin"){
    if(!isAdmin(env,userId)){await send(env,chatId,"هذا الأمر مخصص للمالك.");return;}
    const [u,c,a,r]=await Promise.all([env.DB.prepare("SELECT COUNT(*) n FROM users").first<{n:number}>(),env.DB.prepare("SELECT COUNT(*) n FROM chats").first<{n:number}>(),env.DB.prepare("SELECT COUNT(*) n FROM sessions WHERE status IN ('active','waiting_poll','polling')").first<{n:number}>(),env.DB.prepare("SELECT COUNT(*) n FROM ratings").first<{n:number}>()]);
    await send(env,chatId,`<b>لوحة فَصْل</b>\nالمستخدمون: ${u?.n||0}\nالمحادثات والمجموعات: ${c?.n||0}\nالجلسات الجارية: ${a?.n||0}\nالتقييمات: ${r?.n||0}\n\n/broadcast نص — إذاعة\n/story off story-id — إيقاف قصة\n/story on story-id — تفعيل قصة`);return;
  }
  if(text.startsWith("/"))return;
  const s=await getSession(env.DB,chatId);if(s&&s.mode==="private") await send(env,chatId,"اختر أحد الأزرار أسفل المشهد حتى يستمر السرد.");
}
async function onCallback(env:Env,q:NonNullable<TgUpdate["callback_query"]>){
  await tg(env,"answerCallbackQuery",{callback_query_id:q.id});
  const data=q.data||"",chatId=String(q.message?.chat.id||q.from.id),userId=String(q.from.id);
  if(data.startsWith("play:")){
    const storyId=data.slice(5),mode=q.message?.chat.type==="private"?"private":"group";
    if(mode==="group"&&!isAdmin(env,userId)){await send(env,chatId,"بدء القصص في المجموعة متاح للمشرفين فقط.");return;}
    await startStory(env,chatId,userId,storyId,mode);return;
  }
  if(data.startsWith("rate:")){
    const [,sessionId,ratingText]=data.split(":"),rating=Number(ratingText);
    const session=await env.DB.prepare("SELECT status FROM sessions WHERE session_id=?").bind(sessionId).first<{status:string}>();
    if(!session||session.status!=="finished"||!Number.isInteger(rating)||rating<1||rating>5){await send(env,chatId,"تعذر حفظ التقييم.");return;}
    await env.DB.prepare("INSERT INTO ratings(session_id,user_id,rating) VALUES(?,?,?) ON CONFLICT(session_id,user_id) DO UPDATE SET rating=excluded.rating,created_at=CURRENT_TIMESTAMP").bind(sessionId,userId,rating).run();
    await send(env,chatId,"شكرًا لتقييمك. رأيك يساعدنا على تحسين فَصْل.");return;
  }
  if(data.startsWith("interrogate:")){
    const sessionId=data.slice(12),s=await env.DB.prepare("SELECT * FROM sessions WHERE session_id=? AND status IN ('active','waiting_poll','polling')").bind(sessionId).first<Session>();
    if(!s||(s.mode==="private"&&s.user_id!==userId)){await send(env,chatId,"غرفة الاستجواب غير متاحة لهذه الجلسة.");return;}
    const story=await storyById(env.DB,s.story_id);if(story?.caseFile)await showInterrogationMenu(env,s,story);return;
  }
  if(data.startsWith("suspect:")){
    const [,sessionId,suspectId]=data.split(":"),s=await env.DB.prepare("SELECT * FROM sessions WHERE session_id=? AND status IN ('active','waiting_poll','polling')").bind(sessionId).first<Session>();
    if(!s||(s.mode==="private"&&s.user_id!==userId)){await send(env,chatId,"هذا الاستجواب لا يخص جلستك.");return;}
    const story=await storyById(env.DB,s.story_id),suspect=story?.caseFile?.suspects.find(x=>x.id===suspectId);if(!story||!suspect)return;
    const rows=await env.DB.prepare("SELECT clue_id FROM session_clues WHERE session_id=?").bind(sessionId).all<{clue_id:string}>();
    const clues=new Set(rows.results.map(x=>x.clue_id));
    const buttons=suspect.questions.map((q,i)=>[{text:q.prompt,callback_data:`ask:${sessionId}:${suspectId}:${i}`}]);
    if(clues.has(suspect.contradiction.clueId))buttons.push([{text:"⚖️ واجهه بالدليل",callback_data:`confront:${sessionId}:${suspectId}`}]);
    buttons.push([{text:"↩️ قائمة المشتبه بهم",callback_data:`interrogate:${sessionId}`}]);
    await send(env,chatId,`<b>${escapeHtml(suspect.name)}</b>\n${escapeHtml(suspect.opening)}`,{inline_keyboard:buttons});return;
  }
  if(data.startsWith("ask:")){
    const [,sessionId,suspectId,indexText]=data.split(":"),s=await env.DB.prepare("SELECT * FROM sessions WHERE session_id=? AND status IN ('active','waiting_poll','polling')").bind(sessionId).first<Session>();
    if(!s||(s.mode==="private"&&s.user_id!==userId)){await send(env,chatId,"هذا الاستجواب لا يخص جلستك.");return;}
    const story=await storyById(env.DB,s.story_id),suspect=story?.caseFile?.suspects.find(x=>x.id===suspectId),q=suspect?.questions[Number(indexText)];if(!story||!suspect||!q)return;
    if(q.requiresClueId){const has=await env.DB.prepare("SELECT 1 ok FROM session_clues WHERE session_id=? AND clue_id=?").bind(sessionId,q.requiresClueId).first();if(!has){await send(env,chatId,"هذه المواجهة تحتاج إلى قرينة لم تجمعها بعد.");return;}}
    const key=`q:${suspectId}:${indexText}`;
    const seen=await env.DB.prepare("SELECT 1 ok FROM session_interrogations WHERE session_id=? AND question_key=?").bind(sessionId,key).first();
    if(!seen)await env.DB.prepare("INSERT OR IGNORE INTO session_interrogations(session_id,suspect_id,question_key) VALUES(?,?,?)").bind(sessionId,suspectId,key).run();
    if(q.revealClue)await env.DB.prepare("INSERT OR IGNORE INTO session_clues(session_id,clue_id,title,detail) VALUES(?,?,?,?)").bind(sessionId,q.revealClue.id,q.revealClue.title,q.revealClue.detail).run();
    await send(env,chatId,`<b>سؤالك:</b> ${escapeHtml(q.prompt)}\n\n<b>إجابة ${escapeHtml(suspect.name)}:</b> ${escapeHtml(q.answer)}`,{inline_keyboard:[[{text:"اسأل سؤالًا آخر",callback_data:`suspect:${sessionId}:${suspectId}`}],[{text:"عودة للمشتبه بهم",callback_data:`interrogate:${sessionId}`}]]});return;
  }
  if(data.startsWith("confront:")){
    const [,sessionId,suspectId]=data.split(":"),s=await env.DB.prepare("SELECT * FROM sessions WHERE session_id=? AND status IN ('active','waiting_poll','polling')").bind(sessionId).first<Session>();
    if(!s||(s.mode==="private"&&s.user_id!==userId)){await send(env,chatId,"هذه المواجهة لا تخص جلستك.");return;}
    const story=await storyById(env.DB,s.story_id),suspect=story?.caseFile?.suspects.find(x=>x.id===suspectId);if(!story||!suspect)return;
    const has=await env.DB.prepare("SELECT 1 ok FROM session_clues WHERE session_id=? AND clue_id=?").bind(sessionId,suspect.contradiction.clueId).first();
    if(!has){await send(env,chatId,"لا تملك الدليل اللازم لهذه المواجهة بعد.");return;}
    await env.DB.prepare("INSERT OR IGNORE INTO session_interrogations(session_id,suspect_id,question_key) VALUES(?,?,?)").bind(sessionId,suspectId,`confront:${suspectId}`).run();
    if(suspect.contradiction.revealClue){const clue=suspect.contradiction.revealClue;await env.DB.prepare("INSERT OR IGNORE INTO session_clues(session_id,clue_id,title,detail) VALUES(?,?,?,?)").bind(sessionId,clue.id,clue.title,clue.detail).run();}
    await send(env,chatId,`<b>واجهته بالدليل:</b> ${escapeHtml(suspect.contradiction.prompt)}\n\n<b>ردّه:</b> ${escapeHtml(suspect.contradiction.response)}`,{inline_keyboard:[[{text:"استجواب شخص آخر",callback_data:`interrogate:${sessionId}`}]]});return;
  }
  if(data.startsWith("clues:")){
    const sessionId=data.slice(6);
    const s=await env.DB.prepare("SELECT * FROM sessions WHERE session_id=? AND status IN ('active','waiting_poll','polling')").bind(sessionId).first<Session>();
    if(!s||(s.mode==="private"&&s.user_id!==userId)){await send(env,chatId,"دفتر الأدلة غير متاح لهذه الجلسة.");return;}
    const rows=await env.DB.prepare("SELECT title,detail FROM session_clues WHERE session_id=? ORDER BY rowid").bind(sessionId).all<{title:string;detail:string}>();
    if(!rows.results.length){await send(env,chatId,"لم تجمع أي دليل بعد. انتبه للتفاصيل الصغيرة.");return;}
    await send(env,chatId,"<b>📁 دفتر الأدلة</b>\n\n"+rows.results.map((x,i)=>`${i+1}. <b>${escapeHtml(x.title)}</b>\n${escapeHtml(x.detail)}`).join("\n\n"));return;
  }
  if(data.startsWith("choose:")){
    const [,sessionId,indexText]=data.split(":"),s=await env.DB.prepare("SELECT * FROM sessions WHERE session_id=? AND status='active'").bind(sessionId).first<Session>();
    if(!s||s.user_id!==userId){await send(env,chatId,"هذا الاختيار لا يخص جلستك الحالية.");return;}
    const story=await storyById(env.DB,s.story_id),scene=story?.scenes[s.scene_id];
    const available=scene?await eligibleChoices(env,sessionId,scene.choices||[]):[];
    const choice=available[Number(indexText)];
    if(!story||!scene||!choice){await send(env,chatId,"هذا الخيار لم يعد متاحًا؛ ربما تغيّرت حالة القصة.");return;}
    if(choice.suspectId&&story.caseFile){
      const count=await env.DB.prepare("SELECT COUNT(*) n FROM session_clues WHERE session_id=?").bind(sessionId).first<{n:number}>();
      const interrogations=await env.DB.prepare("SELECT COUNT(*) n FROM session_interrogations WHERE session_id=?").bind(sessionId).first<{n:number}>();
      if((count?.n||0)<story.caseFile.minimumClues||(interrogations?.n||0)<story.caseFile.minimumInterrogations){await send(env,chatId,`لا تتسرع في الاتهام. تحتاج إلى ${story.caseFile.minimumClues} قرائن و${story.caseFile.minimumInterrogations} استجوابات على الأقل. لديك الآن ${count?.n||0} قرائن و${interrogations?.n||0} استجوابات.`);return;}
      if(choice.suspectId!==story.caseFile.correctSuspectId){await send(env,chatId,"اتهام غير صحيح. هناك تفصيل صغير لا يتفق مع روايتك. راجع القرائن وحاول مجددًا.");return;}
      const ending=await resolveCaseEnding(env,s,story);
      await send(env,chatId,`<b>أحسنت! لقد حللت القضية.</b>\n\n<b>${escapeHtml(ending.title)}</b>\n${escapeHtml(ending.text)}\n\n<b>انتهى التحقيق.</b>`);
      await finish(env,s,{text:ending.title,ending:true});return;
    }
    await grantChoiceEffects(env,sessionId,choice);
    await showScene(env,s,story,choice.next);
  }
}
async function publishDuePolls(env:Env){
  const due=await env.DB.prepare("SELECT * FROM sessions WHERE status='waiting_poll' AND poll_due_at<=?").bind(now()).all<Session>();
  for(const s of due.results){
    const story=await storyById(env.DB,s.story_id),scene=story?.scenes[s.pending_poll_scene||s.scene_id];
    if(!story||!scene||!scene.choices?.length)continue;
    const available=await eligibleChoices(env,s.session_id,scene.choices);
    if(!available.length){
      await env.DB.prepare("UPDATE sessions SET status='stopped',poll_id=NULL,pending_poll_scene=NULL,poll_due_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(s.session_id).run();
      await send(env,s.chat_id,"لم يتبقَّ قرار صالح في هذا المشهد. أوقفنا الجلسة بدل تركها معلّقة؛ يمكنكم بدء قصة جديدة عبر /stories.");
      continue;
    }
    try{
      for(const choice of available){
        if(choice.image){
          try{await sendPhoto(env,s.chat_id,choice.image,`<b>${escapeHtml(choice.text)}</b>`);}
          catch(e){console.error("group choice image failed",e);await send(env,s.chat_id,`<b>${escapeHtml(choice.text)}</b>`);}
        } else await send(env,s.chat_id,`<b>${escapeHtml(choice.text)}</b>`);
      }
      const p=await tg(env,"sendPoll",{chat_id:s.chat_id,question:"اختر القرار الذي تريدونه:",options:available.map(c=>c.text),is_anonymous:false,allows_multiple_answers:false,open_period:Number(env.POLL_DURATION_SECONDS||120)});
      await env.DB.prepare("UPDATE sessions SET poll_id=?,poll_message_id=?,status='polling',updated_at=CURRENT_TIMESTAMP WHERE session_id=? AND status='waiting_poll'").bind(p.id,p.message_id,s.session_id).run();
    }catch(e){console.error("poll publish failed",e);await send(env,s.chat_id,"تعذر فتح التصويت. أعد المحاولة عبر /stop ثم /stories.");}
  }
}
async function resolvePoll(env:Env,poll:{id:string;is_closed:boolean;options:{text:string;voter_count:number}[]}){
  if(!poll.is_closed)return;
  const s=await env.DB.prepare("SELECT * FROM sessions WHERE poll_id=? AND status='polling'").bind(poll.id).first<Session>();
  if(!s)return;
  const story=await storyById(env.DB,s.story_id),scene=story?.scenes[s.scene_id];if(!story||!scene)return;
  const available=await eligibleChoices(env,s.session_id,scene.choices||[]);
  const max=Math.max(0,...poll.options.map(o=>o.voter_count));
  const winners=poll.options.map((o,i)=>({o,i})).filter(x=>x.o.voter_count===max&&max>0);
  if(winners.length===0){
    await env.DB.prepare("UPDATE sessions SET poll_id=NULL,status='stopped',pending_poll_scene=NULL,poll_due_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(s.session_id).run();
    await send(env,s.chat_id,"انتهى التصويت دون أصوات، لذلك لم نختر مسارًا بالنيابة عنكم. يمكنكم بدء القصة مجددًا عبر /stories.");
    return;
  }
  if(winners.length===1){
    const selected=available[winners[0].i];
    if(selected?.suspectId&&story.caseFile){
      const count=await env.DB.prepare("SELECT COUNT(*) n FROM session_clues WHERE session_id=?").bind(s.session_id).first<{n:number}>();
      const interrogations=await env.DB.prepare("SELECT COUNT(*) n FROM session_interrogations WHERE session_id=?").bind(s.session_id).first<{n:number}>();
      await env.DB.prepare("UPDATE sessions SET poll_id=NULL,status='active',updated_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(s.session_id).run();
      if((count?.n||0)<story.caseFile.minimumClues||(interrogations?.n||0)<story.caseFile.minimumInterrogations){
        await send(env,s.chat_id,"لا تتسرعوا في الاتهام؛ اجمعوا أدلة إضافية واستجوبوا المشتبه بهم قبل التصويت.");
        await showScene(env,s,story,s.scene_id);return;
      }
      if(selected.suspectId===story.caseFile.correctSuspectId){
        await showCaseResolution(env,s,story);return;
      }
      await send(env,s.chat_id,"اتهام غير صحيح. أعيدوا مراجعة القرائن؛ ما زال هناك تفصيل لا يتفق مع روايتكم.");
      await showScene(env,s,story,s.scene_id);return;
    }
  }
  if(winners.length>1&&story.caseFile&&scene.choices?.some(choice=>choice.suspectId)){
    await env.DB.prepare("UPDATE sessions SET poll_id=NULL,status='active',updated_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(s.session_id).run();
    await send(env,s.chat_id,"تعادل التصويت بين أكثر من اتهام. لن نخمن القاتل؛ راجعوا الأدلة ثم صوّتوا من جديد.");
    await showScene(env,s,story,s.scene_id);return;
  }
  let next:string;
  if(winners.length===1)next=scene.choices?.[winners[0].i]?.next||"";
  else if(scene.tieNext){await send(env,s.chat_id,scene.tieText||"تعادل التصويت؛ تتداخل المسارات.");next=scene.tieNext;}
  else {
    const distinct=[...new Set(winners.map(w=>available[w.i]?.next).filter(Boolean))] as string[];
    next=distinct.length===1?distinct[0]:"";
  }
  if(!next&&winners.length>1){
    await env.DB.prepare("UPDATE sessions SET poll_id=NULL,status='waiting_poll',pending_poll_scene=?,poll_due_at=?,updated_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(s.scene_id,now()+15,s.session_id).run();
    await send(env,s.chat_id,"تعادل التصويت بين مسارات مختلفة. لن نختار نيابةً عنكم؛ سنعيد التصويت بعد لحظات حتى تحسموا القرار.");
    return;
  }
  await env.DB.prepare("UPDATE sessions SET poll_id=NULL,status='active',updated_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(s.session_id).run();
  if(!next){await send(env,s.chat_id,"تعذر تحديد المسار التالي. أوقفنا الجلسة لحماية تقدمكم.");await env.DB.prepare("UPDATE sessions SET status='finished' WHERE session_id=?").bind(s.session_id).run();return;}
  if(winners.length===1) await grantChoiceEffects(env,s.session_id,available[winners[0].i]);
  await showScene(env,s,story,next);
}
async function handleUpdate(env:Env,u:TgUpdate){
  if(u.message)await onMessage(env,u.message);
  if(u.callback_query)await onCallback(env,u.callback_query);
  if(u.poll)await resolvePoll(env,u.poll);
}
async function fridayReminder(env:Env){
  if(env.FRIDAY_REMINDER_ENABLED!=="true")return;
  const day=new Date().getUTCDay();if(day!==5)return;
  const hour=new Date().getUTCHours();if(hour!==9)return;
  const key=new Date().toISOString().slice(0,10);
  const sent=await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind("friday:"+key).first<{value:string}>();if(sent)return;
  const chats=await env.DB.prepare("SELECT chat_id FROM chats").all<{chat_id:string}>();
  for(const c of chats.results)try{await send(env,c.chat_id,"تذكير الجمعة: أكثروا من الصلاة والسلام على النبي ﷺ، ولا تنسوا قراءة سورة الكهف.");}catch(e){console.error("friday reminder",e);}
  await env.DB.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)").bind("friday:"+key,"sent").run();
}
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);
    if(request.method==="GET"&&url.pathname==="/")return new Response("FASL bot is running.");
    if(request.method!=="POST"||url.pathname!=="/webhook")return json({ok:false,error:"Not found"},404);
    if(!env.BOT_TOKEN||!env.WEBHOOK_SECRET)return json({ok:false,error:"Missing secrets"},503);
    if(request.headers.get("X-Telegram-Bot-Api-Secret-Token")!==env.WEBHOOK_SECRET)return json({ok:false,error:"Unauthorized"},401);
    const update=await request.json() as TgUpdate;
    const claimed=await env.DB.prepare("INSERT OR IGNORE INTO processed_updates(update_id) VALUES(?)").bind(update.update_id).run();
    if(!claimed.meta.changes)return json({ok:true,deduplicated:true});
    try{await ensureSeed(env.DB);await handleUpdate(env,update);return json({ok:true});}
    catch(e){console.error("update failed",e);await env.DB.prepare("DELETE FROM processed_updates WHERE update_id=?").bind(update.update_id).run();return json({ok:false,error:"Temporary processing failure"},500);}
  },
  async scheduled(_event:ScheduledEvent,env:Env,ctx:ExecutionContext){
    ctx.waitUntil((async()=>{await ensureSeed(env.DB);await publishDuePolls(env);await fridayReminder(env);})());
  }
};
