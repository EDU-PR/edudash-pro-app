(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,715513,e=>{"use strict";var t=e.i(414294),s=e.i(430878),l=e.i(292623),n=e.i(353913),a=e.i(192258),r=e.i(930971);let i=[15,10,5];function o(e){let t=String(e||"").trim().match(/^(\d{1,2}):(\d{2})$/);if(!t)return null;let s=Number(t[1]),l=Number(t[2]);return!Number.isFinite(s)||!Number.isFinite(l)||s<0||s>23||l<0||l>59?null:60*s+l}function c(e){let t=Number.isFinite(e)?Math.max(0,Math.min(1439,Math.floor(e))):0,s=Math.floor(t/60);return`${String(s).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`}function d(e,t,s){let l=new Blob([t],{type:s}),n=URL.createObjectURL(l),a=document.createElement("a");a.href=n,a.download=e,document.body.appendChild(a),a.click(),a.remove(),window.setTimeout(()=>URL.revokeObjectURL(n),1200)}function u(e,t){if(!e.length)return[];let s=[];for(let l=0;l<e.length;l+=t)s.push(e.slice(l,l+t));return s}function m(e,t=78){let s=String(e||"").replace(/\s+/g," ").trim();return s?s.length<=t?s:`${s.slice(0,Math.max(0,t-1)).trim()}…`:""}var p=e.i(217632),x=e.i(783688),h=e.i(215034),g=e.i(24390),f=e.i(574462),y=e.i(974123),b=e.i(320023),v=e.i(853640);let j=(0,e.i(292511).default)("hard-drive-download",[["path",{d:"M12 2v8",key:"1q4o3n"}],["path",{d:"m16 6-4 4-4-4",key:"6wukr"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",key:"w68u3i"}],["path",{d:"M6 18h.01",key:"uhywen"}],["path",{d:"M10 18h.01",key:"h775k"}]]);var N=e.i(29343),w=e.i(372379),k=e.i(750861);let T=["routine","lessons","menu","announcements","insights"],S="edudash.display.trustedTv.v1",C=[15,10,5],M={routine:"Routine",lessons:"Lessons",menu:"Menu",announcements:"Announcements",insights:"Insights"};function E(e){return new Date(e).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}function L(e,t){if(!t)return null;let s=String(t).trim().match(/^(\d{1,2}):(\d{2})$/);if(!s)return null;let l=Number(s[1]),n=Number(s[2]);if(!Number.isFinite(l)||!Number.isFinite(n)||l<0||l>23||n<0||n>59)return null;let a=new Date(`${e}T${String(l).padStart(2,"0")}:${String(n).padStart(2,"0")}:00`).getTime();return Number.isFinite(a)?a:null}function $(e){return!!(e.menuToday&&(e.menuToday.breakfast?.length||e.menuToday.lunch?.length||e.menuToday.snack?.length))}let I="rounded-full border border-slate-600/50 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold transition-all hover:border-[var(--primary)]/50 hover:bg-[var(--primary-subtle)] text-[var(--text-secondary)]",R="rounded-full border border-[var(--primary)]/60 bg-gradient-to-r from-[var(--primary)]/35 to-fuchsia-500/30 px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] shadow-[0_8px_24px_-16px_rgba(124,58,237,0.7)]";function A({title:e,message:s,checklist:l}){return(0,t.jsxs)("div",{className:"card",children:[(0,t.jsx)("p",{className:"text-lg font-semibold text-white",children:e}),(0,t.jsx)("p",{className:"mt-3 text-sm text-slate-400 leading-tight",children:s}),l&&l.length>0&&(0,t.jsx)("ul",{className:"mt-4 grid gap-3",children:l.map(e=>(0,t.jsxs)("li",{className:"flex items-center gap-2 text-xs sm:text-sm text-slate-400 font-medium leading-tight",children:[(0,t.jsx)(N.CheckCircle2,{className:"h-4 w-4 shrink-0 text-violet-400"}),e]},e))})]})}function D({data:e,nowMs:l}){let[n,a]=(0,s.useState)(!0),[r,i]=(0,s.useState)(null),{routine:o,themeLabel:c,dateLabel:d,lessons:u}=e,m=(0,s.useMemo)(()=>{if(!o?.blocks?.length||null==l)return null;for(let e of o.blocks){let t=L(d,e.startTime),s=L(d,e.endTime);if(null!=t&&null!=s&&l>=t&&l<s)return e.id}return null},[o?.blocks,d,l]);return(0,t.jsxs)("section",{className:"card display-glass relative overflow-hidden rounded-2xl",children:[(0,t.jsx)("div",{className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.12),transparent_55%)]"}),(0,t.jsxs)("div",{className:"relative",children:[(0,t.jsxs)("button",{type:"button",onClick:()=>a(e=>!e),onKeyDown:e=>{("Enter"===e.key||" "===e.key)&&(e.preventDefault(),a(e=>!e))},"aria-expanded":n,className:"display-routine-toggle flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-left transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50",children:[(0,t.jsxs)("div",{className:"flex items-center gap-3",children:[(0,t.jsx)("span",{className:"flex h-10 w-10 items-center justify-center rounded-xl shadow-md",style:{backgroundColor:"rgba(124, 58, 237, 0.2)"},children:(0,t.jsx)(f.Clock,{className:"h-5 w-5",style:{color:"var(--primary)"}})}),(0,t.jsxs)("span",{className:"flex min-w-0 flex-col",children:[(0,t.jsx)("span",{className:"sectionTitle",style:{marginBottom:0},children:"Today's routine"}),o?.blocks?.length?(0,t.jsxs)("span",{className:"display-routine-count",children:[o.blocks.length," blocks planned"]}):null]})]}),n?(0,t.jsx)(k.ChevronUp,{className:"h-6 w-6 shrink-0",style:{color:"var(--text-secondary)"}}):(0,t.jsx)(w.ChevronDown,{className:"h-6 w-6 shrink-0",style:{color:"var(--text-secondary)"}})]}),c&&(0,t.jsxs)("p",{className:"display-routine-theme section-subtitle",children:["Theme: ",c]}),n&&(0,t.jsx)(t.Fragment,{children:o?.blocks?.length?(0,t.jsx)("ul",{className:"display-routine-list",children:o.blocks.map(e=>{let s=m===e.id,l=function(e,t,s){if(e.linkedLesson)return e.linkedLesson;let l=L(t,e.startTime),n=L(t,e.endTime);if(null==l||null==n)return null;for(let e of s){let t=new Date(e.scheduled_at).getTime();if(Number.isFinite(t)&&t>=l&&t<n)return e}return null}(e,d,u??[]),n=r===e.id,a=()=>i(t=>t===e.id?null:e.id);return(0,t.jsxs)("li",{className:`display-routine-item rounded-xl overflow-hidden ${s?"display-glass-routine-block-active":"display-glass-routine-block"}`,children:[(0,t.jsxs)("button",{type:"button",onClick:a,onKeyDown:e=>{("Enter"===e.key||" "===e.key)&&(e.preventDefault(),a())},"aria-expanded":n,className:"display-routine-row flex w-full cursor-pointer items-center gap-4 text-left transition-colors hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--primary)]/50",children:[(0,t.jsxs)("span",{className:"display-routine-time min-w-[5rem] font-mono",style:{color:"#c4b5fd"},children:[e.startTime??"–","–",e.endTime??"–"]}),(0,t.jsxs)("span",{className:`display-routine-title flex-1 ${s?"font-semibold":""}`,style:{color:"var(--text-primary)"},children:[e.title,e.lessonLinkSource&&(0,t.jsx)("span",{className:"ml-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",style:{borderColor:"manual"===e.lessonLinkSource?"rgba(236,72,153,0.35)":"rgba(139,92,246,0.4)",background:"manual"===e.lessonLinkSource?"rgba(236,72,153,0.14)":"rgba(124,58,237,0.16)",color:"manual"===e.lessonLinkSource?"#f9a8d4":"#c4b5fd"},children:e.lessonLinkSource})]}),n?(0,t.jsx)(k.ChevronUp,{className:"h-5 w-5 shrink-0",style:{color:"var(--text-secondary)"}}):(0,t.jsx)(w.ChevronDown,{className:"h-5 w-5 shrink-0",style:{color:"var(--text-secondary)"}})]}),n&&(0,t.jsx)("div",{className:"display-routine-detail border-t border-white/[0.06]",style:{color:"var(--text-secondary)"},children:l?(0,t.jsxs)("div",{className:"space-y-4",children:[(0,t.jsx)("p",{className:"font-semibold",style:{color:"var(--text-primary)"},children:l.title}),l.description&&(0,t.jsx)("p",{className:"text-sm",children:l.description}),l.steps&&l.steps.length>0?(0,t.jsxs)("div",{children:[(0,t.jsx)("p",{className:"mb-2 text-xs font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"What to do next"}),(0,t.jsx)("ol",{className:"list-decimal space-y-2 pl-5",children:l.steps.map((e,s)=>(0,t.jsxs)("li",{children:[(0,t.jsx)("span",{className:"font-medium",style:{color:"var(--text-primary)"},children:e.title}),e.duration?(0,t.jsxs)("span",{className:"ml-2 text-sm opacity-90",children:["(",e.duration,")"]}):null,e.description?(0,t.jsx)("p",{className:"mt-0.5 text-sm opacity-90",children:e.description}):null]},s))})]}):null,l.media?.resources&&l.media.resources.length>0?(0,t.jsxs)("div",{children:[(0,t.jsx)("p",{className:"mb-1 text-xs font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Resources"}),(0,t.jsx)("ul",{className:"list-disc pl-5 text-sm",children:l.media.resources.map((e,s)=>(0,t.jsx)("li",{children:e.title},s))})]}):null]}):(0,t.jsx)("p",{className:"text-sm",children:"No lesson scheduled for this block. Schedule a lesson in the teacher dashboard for this time to see instructions here."})})]},e.id)})}):(0,t.jsx)(A,{title:"Routine pending",message:"No routine blocks found for today yet.",checklist:["Generate and save the weekly routine in the principal planner.","Ensure today has published routine blocks with start/end times."]})})]})]})}function O({data:e}){let{lessons:s}=e;return(0,t.jsxs)("section",{className:"card display-glass relative overflow-hidden rounded-2xl",children:[(0,t.jsx)("div",{className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.1),transparent_55%)]"}),(0,t.jsxs)("div",{className:"relative flex items-center gap-3 mb-4",children:[(0,t.jsx)("span",{className:"flex h-10 w-10 items-center justify-center rounded-xl shadow-md",style:{backgroundColor:"rgba(124, 58, 237, 0.2)"},children:(0,t.jsx)(p.BookOpen,{className:"h-5 w-5 text-violet-300"})}),(0,t.jsx)("h2",{className:"sectionTitle",style:{marginBottom:0},children:"Lessons of the day"})]}),s?.length?(0,t.jsx)("ul",{className:"display-section-body space-y-5 text-base leading-relaxed",children:s.map(e=>(0,t.jsxs)("li",{className:"border-b border-slate-700/60 px-1 pb-5 last:border-0 last:pb-0",children:[(0,t.jsxs)("div",{className:"flex flex-wrap items-baseline gap-2",children:[(0,t.jsx)("span",{className:"font-mono text-lg text-violet-300",children:function(e){try{return new Date(e).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}catch{return e.slice(11,16)}}(e.scheduled_at)}),(0,t.jsx)("span",{className:"text-xl font-semibold text-white",children:e.title}),null!=e.duration_minutes&&(0,t.jsxs)("span",{className:"text-slate-400",children:[e.duration_minutes," min"]})]}),e.description&&(0,t.jsx)("p",{className:"mt-1 text-slate-300",children:e.description}),e.steps?.length?(0,t.jsxs)("div",{className:"mt-3 pl-4",children:[(0,t.jsx)("p",{className:"mb-1 text-sm font-medium text-slate-400",children:"Steps"}),(0,t.jsx)("ol",{className:"list-decimal space-y-1 text-lg text-slate-200",children:e.steps.slice(0,5).map((e,s)=>(0,t.jsxs)("li",{children:[e.title,e.duration?` (${e.duration})`:""]},s))})]}):null,e.media?.resources?.length?(0,t.jsxs)("div",{className:"mt-2 text-slate-400",children:["Resources: ",e.media.resources.map(e=>e.title).join(", ")]}):null]},e.id))}):(0,t.jsx)(A,{title:"No lessons scheduled",message:"Add a scheduled lesson and it will appear here in real time.",checklist:["Schedule at least one lesson for today.","Set lesson duration so reminder alerts can trigger."]})]})}function U({data:e}){let{menuToday:s}=e,l=$(e);return(0,t.jsxs)("section",{className:"card display-glass relative overflow-hidden rounded-2xl",children:[(0,t.jsx)("div",{className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.1),transparent_55%)]"}),(0,t.jsxs)("div",{className:"relative flex items-center gap-3 mb-4",children:[(0,t.jsx)("span",{className:"flex h-10 w-10 items-center justify-center rounded-xl shadow-md",style:{backgroundColor:"rgba(124, 58, 237, 0.2)"},children:(0,t.jsx)(x.UtensilsCrossed,{className:"h-5 w-5 text-violet-300"})}),(0,t.jsx)("h2",{className:"sectionTitle",style:{marginBottom:0},children:"Today's menu"})]}),l&&s?(0,t.jsxs)("div",{className:"display-section-body grid gap-5 text-xl leading-relaxed sm:grid-cols-3",children:[s.breakfast?.length?(0,t.jsxs)("div",{children:[(0,t.jsx)("p",{className:"mb-1 font-medium text-slate-400",children:"Breakfast"}),(0,t.jsx)("ul",{className:"text-white",children:s.breakfast.map((e,s)=>(0,t.jsx)("li",{children:e},s))})]}):null,s.lunch?.length?(0,t.jsxs)("div",{children:[(0,t.jsx)("p",{className:"mb-1 font-medium text-slate-400",children:"Lunch"}),(0,t.jsx)("ul",{className:"text-white",children:s.lunch.map((e,s)=>(0,t.jsx)("li",{children:e},s))})]}):null,s.snack?.length?(0,t.jsxs)("div",{children:[(0,t.jsx)("p",{className:"mb-1 font-medium text-slate-400",children:"Snack"}),(0,t.jsx)("ul",{className:"text-white",children:s.snack.map((e,s)=>(0,t.jsx)("li",{children:e},s))})]}):null]}):(0,t.jsx)(A,{title:"Menu not published",message:"No breakfast/lunch/snack items were found for today.",checklist:["Publish this week menu to include breakfast/lunch/snack entries."]})]})}function B({data:e}){let{announcements:s}=e;return(0,t.jsxs)("section",{className:"card display-glass relative overflow-hidden rounded-2xl",children:[(0,t.jsx)("div",{className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.1),transparent_55%)]"}),(0,t.jsxs)("div",{className:"relative flex items-center gap-3 mb-4",children:[(0,t.jsx)("span",{className:"flex h-10 w-10 items-center justify-center rounded-xl shadow-md",style:{backgroundColor:"rgba(124, 58, 237, 0.2)"},children:(0,t.jsx)(h.Megaphone,{className:"h-5 w-5 text-violet-300"})}),(0,t.jsx)("h2",{className:"sectionTitle",style:{marginBottom:0},children:"Announcements"})]}),s?.length?(0,t.jsx)("ul",{className:"display-section-body space-y-4 text-base leading-relaxed",children:s.map(e=>(0,t.jsxs)("li",{className:"rounded-lg bg-slate-800/40 px-4 py-3",children:[(0,t.jsx)("p",{className:"font-semibold",style:{color:"var(--text-primary)"},children:e.title}),(0,t.jsx)("p",{className:"text-slate-300",children:e.body_preview})]},e.id))}):(0,t.jsx)(A,{title:"Quiet channel",message:"No announcements are queued for display right now.",checklist:["Share a principal or teacher announcement to pin school notices here."]})]})}function V({data:e}){let{insights:s}=e;return(0,t.jsxs)("section",{className:"card display-glass relative overflow-hidden rounded-2xl",children:[(0,t.jsx)("div",{className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.1),transparent_55%)]"}),(0,t.jsxs)("div",{className:"relative flex items-center gap-3 mb-4",children:[(0,t.jsx)("span",{className:"flex h-10 w-10 items-center justify-center rounded-xl shadow-md",style:{backgroundColor:"rgba(124, 58, 237, 0.2)"},children:(0,t.jsx)(g.Lightbulb,{className:"h-5 w-5 text-violet-300"})}),(0,t.jsx)("h2",{className:"sectionTitle",style:{marginBottom:0},children:s?.title||"Class insights"})]}),s?.bullets?.length?(0,t.jsx)("ul",{className:"display-section-body list-disc space-y-3 pl-6 pr-2 text-lg leading-relaxed text-slate-200",children:s.bullets.map((e,s)=>(0,t.jsx)("li",{children:e},s))}):(0,t.jsx)(A,{title:"Insights pending",message:"AI insights will appear when enough recent classroom data is available.",checklist:["Insights appear after routine and lesson activity accumulates over time."]})]})}function _(){let e=(0,n.useRouter)(),p=(0,n.useSearchParams)(),x=p.get("org"),h=p.get("class"),g=p.get("token"),w=p.get("code")?.trim().toUpperCase()||null,[k,A]=(0,s.useState)(),[_,P]=(0,s.useState)(!1),[F,z]=(0,s.useState)(!1),[H,G]=(0,s.useState)(null),[q,K]=(0,s.useState)(null),[J,W]=(0,s.useState)(!1),[Z,Q]=(0,s.useState)(null),[X,Y]=(0,s.useState)(!1),[ee,et]=(0,s.useState)(null),[es,el]=(0,s.useState)(null),[en,ea]=(0,s.useState)(null),[er,ei]=(0,s.useState)(""),[eo,ec]=(0,s.useState)("grid"),[ed,eu]=(0,s.useState)(!1),[em,ep]=(0,s.useState)(null),[ex,eh]=(0,s.useState)(()=>Date.now()),[eg,ef]=(0,s.useState)(!0),[ey,eb]=(0,s.useState)(null),[ev,ej]=(0,s.useState)(null),[eN,ew]=(0,s.useState)(null),[ek,eT]=(0,s.useState)(!1),[eS,eC]=(0,s.useState)(!1),eM=(0,s.useRef)(new Set),eE=(0,s.useRef)(!1),eL=(0,s.useRef)(!1),e$=(0,s.useMemo)(()=>(0,a.createClient)(),[]),{profile:eI,loading:eR}=(0,r.useUserProfile)(k);(0,s.useEffect)(()=>{G(function(){let e=window.localStorage.getItem(S);if(!e)return null;try{let t=JSON.parse(e);if(!t||"string"!=typeof t.token||!t.token.trim())return null;return{token:t.token.trim(),expiresAt:t.expiresAt||null,orgId:t.orgId||null,classId:t.classId||null}}catch{return null}}()),z(!0)},[]);let eA=x||eI?.preschoolId||eI?.organizationId||null,eD=h||null,eO=H?.token||null,eU=!!eO,eB=!!(x&&g),eV=!!w&&!x&&!g,e_=eU||eB||eV,eP=(0,s.useMemo)(()=>{if(!H?.expiresAt)return null;let e=new Date(H.expiresAt);return Number.isNaN(e.getTime())?null:e.toLocaleDateString("en-ZA",{year:"numeric",month:"short",day:"numeric"})},[H?.expiresAt]),eF=(0,s.useCallback)(e=>{window.localStorage.removeItem(S),G(null),eE.current=!1,e&&ew(e)},[]),ez=(0,s.useCallback)(async()=>{if(eO){W(!0),Q(null);try{let e=await fetch(`/api/display/data?pair=${encodeURIComponent(eO)}`);if(!e.ok){let t=await e.json().catch(()=>({}));throw 403===e.status&&eF("Trusted TV pairing expired. Enter a join code to pair this screen again."),Error(t.error||`Request failed: ${e.status}`)}let t=await e.json();K(t)}catch(e){Q(e instanceof Error?e.message:"Failed to load display"),K(null)}finally{W(!1)}}},[eO,eF]),eH=(0,s.useCallback)(async()=>{if(x&&g){W(!0),Q(null);try{let e=new URLSearchParams({org:x,token:g});h&&e.set("class",h);let t=await fetch(`/api/display/data?${e.toString()}`);if(!t.ok){let e=await t.json().catch(()=>({}));throw Error(e.error||`Request failed: ${t.status}`)}let s=await t.json();K(s)}catch(e){Q(e instanceof Error?e.message:"Failed to load display"),K(null)}finally{W(!1)}}},[x,g,h]),eG=(0,s.useCallback)(async()=>{if(w){W(!0),Q(null);try{let e=await fetch(`/api/display/data?code=${encodeURIComponent(w)}`);if(!e.ok){let t=await e.json().catch(()=>({}));throw Error(t.error||`Request failed: ${e.status}`)}let t=await e.json();K(t)}catch(e){Q(e instanceof Error?e.message:"Failed to load display"),K(null)}finally{W(!1)}}},[w]);(0,s.useEffect)(()=>{eU?ez():eB?eH():eV&&eG()},[eU,eB,eV,ez,eH,eG]),(0,s.useEffect)(()=>{F&&!eU&&!eE.current&&(eV||eB)&&(eE.current=!0,(async()=>{try{let t=eV?{code:w,deviceName:"TV Display"}:{org:x,token:g,class:h,deviceName:"TV Display"},s=await fetch("/api/display/pair/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!s.ok)return;let l=await s.json().catch(()=>null),n=String(l?.pairToken||"").trim();if(!n)return;let a={token:n,expiresAt:l?.expiresAt||null,orgId:l?.orgId||null,classId:l?.classId||null};window.localStorage.setItem(S,JSON.stringify(a)),G(a),ew(`Trusted TV paired successfully. This screen will stay connected for ${Number(l?.expiresInDays)||180} days.`),e.replace("/display")}catch{}})())},[F,eU,eV,eB,w,x,g,h,e]),(0,s.useEffect)(()=>{if(!e_||!q)return;let e=setInterval(eU?ez:eV?eG:eH,6e5);return()=>clearInterval(e)},[e_,eU,eV,q,ez,eH,eG]);let{data:eq,loading:eK,error:eJ,refetch:eW}=function({orgId:e,classId:t=null,enabled:l=!0}){let[n,a]=(0,s.useState)(null),[r,i]=(0,s.useState)(!0),[o,c]=(0,s.useState)(null),d=(0,s.useCallback)(async()=>{if(!e||!l){a(null),i(!1);return}i(!0),c(null);try{let s=new URLSearchParams({org:e});t&&s.set("class",t);let l=await fetch(`/api/display/preview?${s.toString()}`,{method:"GET",cache:"no-store",credentials:"include"});if(!l.ok){let e=await l.json().catch(()=>({}));throw Error(e.error||`Request failed: ${l.status}`)}let n=await l.json();a(n)}catch(e){c(e instanceof Error?e.message:"Failed to load display data"),a(null)}finally{i(!1)}},[e,t,l]);return(0,s.useEffect)(()=>{d();let e=setInterval(d,6e5);return()=>clearInterval(e)},[d]),{data:n,loading:r,error:o,refetch:d}}({orgId:e_?null:eA,classId:eD,enabled:!!eA&&!e_}),eZ=e_?q:eq,eQ=e_?J:eK,eX=e_?Z:eJ,eY=e_?eU?ez:eV?eG:eH:eW,e0=(0,s.useMemo)(()=>{if(!eZ)return{routineBlocks:0,lessonBlocks:0,menuItems:0,announcements:0,insightBullets:0,filledSections:0};let e=eZ.routine?.blocks?.length||0,t=eZ.lessons?.length||0,s=(eZ.menuToday?.breakfast?.length||0)+(eZ.menuToday?.lunch?.length||0)+(eZ.menuToday?.snack?.length||0),l=eZ.announcements?.length||0,n=eZ.insights?.bullets?.length||0,a=[e>0,t>0,s>0,l>0,n>0].filter(Boolean).length;return{routineBlocks:e,lessonBlocks:t,menuItems:s,announcements:l,insightBullets:n,filledSections:a}},[eZ]),e1=0===e0.filledSections;(0,s.useEffect)(()=>{eZ&&ep(new Date)},[eZ]),(0,s.useEffect)(()=>{if(!eN)return;let e=window.setTimeout(()=>ew(null),5e3);return()=>window.clearTimeout(e)},[eN]),(0,s.useEffect)(()=>{e_||eL.current||(eL.current=!0,window.matchMedia("(max-width: 840px)").matches&&ec("focus"))},[e_]),(0,s.useEffect)(()=>{e_?P(!0):(async()=>{try{let{data:{session:e}}=await e$.auth.getSession();e?.user?.id&&A(e.user.id)}catch{}finally{P(!0)}})()},[e$,e_]),(0,s.useEffect)(()=>{if(e_)return void eC(!1);eC(!1);let e=window.setTimeout(()=>eC(!0),6e3);return()=>window.clearTimeout(e)},[e_]),(0,s.useEffect)(()=>{let e=setInterval(()=>eh(Date.now()),3e4);return()=>clearInterval(e)},[]);let e2=(0,s.useMemo)(()=>{if(!eZ)return[];let e=[];return eZ.routine?.blocks?.forEach(t=>{let s=L(eZ.dateLabel,t.startTime);s&&e.push({id:`routine:${t.id}`,title:t.title||"Routine block",startsAtMs:s,source:"routine"})}),eZ.lessons?.forEach(t=>{let s=new Date(t.scheduled_at).getTime();Number.isFinite(s)&&e.push({id:`lesson:${t.id}`,title:t.title||"Lesson",startsAtMs:s,source:"lesson"})}),e.sort((e,t)=>e.startsAtMs-t.startsAtMs)},[eZ]),e5=(0,s.useMemo)(()=>e2.find(e=>e.startsAtMs>ex)||null,[e2,ex]),e4=(0,s.useMemo)(()=>e2.filter(e=>e.startsAtMs>ex).slice(0,4),[e2,ex]),e3=(0,s.useMemo)(()=>{if(!eZ)return null;let e=(eZ.routine?.blocks||[]).map(e=>{let t=L(eZ.dateLabel,e.startTime),s=L(eZ.dateLabel,e.endTime);return t&&s&&!(s<=t)?{id:`routine:${e.id}`,title:e.title||"Routine block",source:"routine",startMs:t,endMs:s}:null}).filter(e=>null!==e).find(e=>ex>=e.startMs&&ex<e.endMs);return e||(eZ.lessons||[]).map(e=>{let t=new Date(e.scheduled_at).getTime();if(!Number.isFinite(t))return null;let s=Number(e.duration_minutes)||30;return{id:`lesson:${e.id}`,title:e.title||"Lesson",source:"lesson",startMs:t,endMs:t+6e4*s}}).filter(e=>null!==e).find(e=>ex>=e.startMs&&ex<e.endMs)||null},[eZ,ex]),e8=e3?Math.max(0,Math.min(100,(ex-e3.startMs)/(e3.endMs-e3.startMs)*100)):0,e6=(0,s.useCallback)(()=>{eb(null),ej(null)},[]),e9=(0,s.useCallback)(()=>{if(!eZ)return void ew("Cannot export yet. Room data is still loading.");try{let s,l;eT(!0);var e,t=(e={orgId:eA,classId:eD},{version:1,generatedAt:new Date().toISOString(),orgId:e.orgId,classId:e.classId,dayName:eZ.dayName,dateLabel:eZ.dateLabel,routineTitle:eZ.routine?.title||eZ.themeLabel||null,routineSummary:eZ.routine?.summary||null,schedule:(s=[],(eZ.routine?.blocks||[]).forEach(e=>{let t=e.startTime||null,l=e.endTime||null;if(!t||!l)return;let n=o(t),a=o(l);null==n||null==a||a<=n||s.push({id:`routine:${e.id}`,title:e.title||"Routine block",source:"routine",startTime:c(n),endTime:c(a),durationMinutes:Math.max(1,a-n)})}),(eZ.lessons||[]).forEach(e=>{let t=function(e){let t=new Date(e);if(!Number.isFinite(t.getTime()))return null;let s=t.getHours(),l=t.getMinutes();return`${String(s).padStart(2,"0")}:${String(l).padStart(2,"0")}`}(e.scheduled_at);if(!t)return;let l=o(t);if(null==l)return;let n=Number(e.duration_minutes)||30;s.push({id:`lesson:${e.id}`,title:e.title||"Lesson",source:"lesson",startTime:c(l),endTime:c(l+n),durationMinutes:Math.max(1,n)})}),s.sort((e,t)=>(o(e.startTime)??0)-(o(t.startTime)??0))),data:eZ});let n=String(t.dateLabel||"").replace(/[^0-9-]/g,"")||"today",a=`edudash-room-display-offline-${n}`;d(`${a}.html`,(l=JSON.stringify(t).replace(/</g,"\\u003c"),`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EduDash Offline Room Display</title>
  <style>
    :root{
      --bg:#060915;
      --panel:#0f172abf;
      --line:rgba(148,163,184,.28);
      --text:#f8fafc;
      --muted:#cbd5e1;
      --primary:#7c3aed;
      --cyan:#22d3ee;
      --pink:#ec4899;
      --ok:#22c55e;
      --warn:#f59e0b;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      min-height:100vh;
      color:var(--text);
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
      background:
        radial-gradient(1100px 650px at 8% -10%, rgba(124,58,237,.34), transparent 60%),
        radial-gradient(900px 560px at 92% 0%, rgba(34,211,238,.22), transparent 64%),
        radial-gradient(700px 480px at 60% 100%, rgba(236,72,153,.18), transparent 70%),
        linear-gradient(170deg, #03050f 0%, #070b1d 58%, #05070f 100%);
      padding:22px;
    }
    .shell{
      max-width:1400px;
      margin:0 auto;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(2,6,23,.62);
      border-radius:24px;
      backdrop-filter:blur(12px);
      box-shadow:0 30px 90px -44px rgba(0,0,0,.9);
      padding:18px;
    }
    .top{
      display:grid;
      grid-template-columns:1.2fr 1fr auto;
      gap:12px;
      align-items:stretch;
      margin-bottom:14px;
    }
    .hero,.status,.controls,.panel{
      border:1px solid var(--line);
      border-radius:16px;
      background:linear-gradient(130deg, rgba(15,23,42,.92), rgba(17,24,39,.7));
    }
    .hero{padding:14px 16px}
    .hero h1{font-size:38px;line-height:1.02;font-weight:900;letter-spacing:-.02em}
    .hero p{margin-top:7px;color:var(--muted);font-size:15px}
    .status{
      padding:14px 16px;
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:10px;
      align-content:center;
    }
    .chip{
      border:1px solid rgba(148,163,184,.34);
      border-radius:12px;
      padding:8px 10px;
      background:rgba(15,23,42,.6);
    }
    .chip b{display:block;font-size:19px;line-height:1.1}
    .chip span{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
    .controls{
      padding:12px;
      display:grid;
      gap:8px;
      min-width:180px;
      align-content:center;
    }
    button{
      border:0;
      border-radius:11px;
      color:white;
      background:linear-gradient(135deg,var(--primary),var(--pink));
      padding:10px 12px;
      font-weight:700;
      font-size:13px;
      cursor:pointer;
    }
    button.secondary{
      background:rgba(15,23,42,.9);
      border:1px solid rgba(148,163,184,.38);
    }
    .alert{
      margin-bottom:12px;
      border:1px solid rgba(251,191,36,.42);
      background:rgba(245,158,11,.16);
      border-radius:14px;
      padding:11px 13px;
      display:none;
    }
    .grid{
      display:grid;
      grid-template-columns:1.08fr 1fr;
      gap:12px;
    }
    .panel{padding:14px}
    .panel h2{font-size:17px;font-weight:800;margin-bottom:10px}
    .currentTitle{font-size:26px;font-weight:900;line-height:1.05}
    .meta{margin-top:7px;color:var(--muted);font-size:14px}
    .bar{
      margin-top:10px;
      height:8px;
      border-radius:999px;
      overflow:hidden;
      background:rgba(15,23,42,.95);
      border:1px solid rgba(148,163,184,.3);
    }
    .bar > i{
      display:block;
      width:0%;
      height:100%;
      background:linear-gradient(90deg,var(--cyan),#38bdf8,var(--ok));
      transition:width .25s linear;
    }
    .timeline{display:grid;gap:8px;max-height:58vh;overflow:auto;padding-right:4px}
    .item{
      border:1px solid rgba(148,163,184,.28);
      border-radius:12px;
      padding:10px 12px;
      background:rgba(15,23,42,.56);
    }
    .item.now{
      border-color:rgba(34,211,238,.6);
      background:linear-gradient(120deg, rgba(34,211,238,.16), rgba(124,58,237,.14));
      box-shadow:0 18px 38px -30px rgba(34,211,238,.9);
    }
    .item .line1{
      display:flex;
      justify-content:space-between;
      gap:8px;
      align-items:center;
      margin-bottom:4px;
    }
    .item .line1 b{font-size:14px}
    .badge{
      border-radius:999px;
      border:1px solid rgba(148,163,184,.45);
      padding:2px 8px;
      font-size:11px;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:var(--muted);
    }
    .time{font-size:12px;color:var(--muted)}
    .foot{
      margin-top:10px;
      color:var(--muted);
      font-size:12px;
      text-align:center;
    }
    @media (max-width:1024px){
      .top{grid-template-columns:1fr}
      .grid{grid-template-columns:1fr}
      .hero h1{font-size:28px}
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="top">
      <div class="hero">
        <h1>EduDash Pro Room Display</h1>
        <p id="dateLine">Offline mode</p>
      </div>
      <div class="status">
        <div class="chip"><span>Current Time</span><b id="clock">--:--</b></div>
        <div class="chip"><span>Next Reminder</span><b id="nextReminder">None</b></div>
        <div class="chip"><span>Blocks Today</span><b id="blockCount">0</b></div>
        <div class="chip"><span>Sound</span><b id="soundLabel">On</b></div>
      </div>
      <div class="controls">
        <button id="soundToggle" class="secondary">Sound: On</button>
        <button id="refreshBtn" class="secondary">Refresh Now</button>
      </div>
    </section>

    <section id="alertBox" class="alert"></section>

    <section class="grid">
      <article class="panel">
        <h2>Current Block Now</h2>
        <div class="currentTitle" id="currentTitle">No active block right now</div>
        <p class="meta" id="currentMeta">Waiting for the next scheduled activity.</p>
        <div class="bar"><i id="progressFill"></i></div>
      </article>
      <article class="panel">
        <h2>Upcoming (15/10/5)</h2>
        <div class="timeline" id="upcomingList"></div>
      </article>
    </section>

    <section class="panel" style="margin-top:12px;">
      <h2>Full Day Timeline</h2>
      <div class="timeline" id="timeline"></div>
    </section>

    <p class="foot">Generated offline pack from EduDash Pro. Keep this file on USB for local playback.</p>
  </div>

  <script>
    const PACK = ${l};
    const THRESHOLDS = ${JSON.stringify(i)};
    const state = { sound: true, fired: new Set() };

    const byId = (id) => document.getElementById(id);
    const dateLine = byId('dateLine');
    const clockNode = byId('clock');
    const nextReminderNode = byId('nextReminder');
    const blockCountNode = byId('blockCount');
    const soundLabel = byId('soundLabel');
    const soundToggle = byId('soundToggle');
    const alertBox = byId('alertBox');
    const currentTitle = byId('currentTitle');
    const currentMeta = byId('currentMeta');
    const progressFill = byId('progressFill');
    const upcomingList = byId('upcomingList');
    const timeline = byId('timeline');

    function parseClock(clock) {
      const m = String(clock || '').trim().match(/^(\\d{1,2}):(\\d{2})$/);
      if (!m) return null;
      const h = Number(m[1]); const mm = Number(m[2]);
      if (!Number.isFinite(h) || !Number.isFinite(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null;
      return h * 60 + mm;
    }
    function fmtClock(minute) {
      const x = Math.max(0, Math.min(1439, Math.floor(minute)));
      const h = Math.floor(x / 60); const m = x % 60;
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    function minuteNow() {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    }
    function playChime(threshold) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const gain = ctx.createGain();
        gain.gain.value = threshold === 5 ? 0.3 : threshold === 10 ? 0.24 : 0.2;
        gain.connect(ctx.destination);
        const signature = {
          15: [523, 659],
          10: [659, 784, 659],
          5: [880, 988, 1174, 988],
        };
        const tones = signature[threshold] || [660, 880];
        let cursor = ctx.currentTime;
        tones.forEach((freq) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, cursor);
          osc.connect(gain);
          osc.start(cursor);
          osc.stop(cursor + 0.25);
          cursor += 0.34;
        });
        setTimeout(() => ctx.close(), 2200);
      } catch {}
    }
    function normalizeItems() {
      return (PACK.schedule || [])
        .map((item) => {
          const start = parseClock(item.startTime);
          const end = parseClock(item.endTime);
          if (start == null || end == null || end <= start) return null;
          return { ...item, start, end };
        })
        .filter(Boolean)
        .sort((a, b) => a.start - b.start);
    }
    function render() {
      const nowDate = new Date();
      const nowMin = minuteNow();
      clockNode.textContent = nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      dateLine.textContent = PACK.dayName + ', ' + PACK.dateLabel + ' • Offline USB mode';
      soundLabel.textContent = state.sound ? 'On' : 'Off';
      soundToggle.textContent = 'Sound: ' + (state.sound ? 'On' : 'Off');

      const items = normalizeItems();
      blockCountNode.textContent = String(items.length);
      const current = items.find((x) => nowMin >= x.start && nowMin < x.end) || null;
      const upcoming = items.filter((x) => x.start > nowMin);
      const next = upcoming[0] || null;
      nextReminderNode.textContent = next ? ('in ' + (next.start - nowMin) + ' min') : 'None';

      if (current) {
        const pct = Math.max(0, Math.min(100, ((nowMin - current.start) / (current.end - current.start)) * 100));
        currentTitle.textContent = current.title;
        currentMeta.textContent = fmtClock(current.start) + ' - ' + fmtClock(current.end) + ' • ' + Math.max(0, current.end - nowMin) + ' min left';
        progressFill.style.width = pct.toFixed(1) + '%';
      } else {
        currentTitle.textContent = next ? ('Up next: ' + next.title) : 'No active block right now';
        currentMeta.textContent = next ? ('Starts at ' + fmtClock(next.start) + ' • in ' + (next.start - nowMin) + ' min') : 'Schedule complete for now.';
        progressFill.style.width = '0%';
      }

      upcomingList.innerHTML = '';
      (upcoming.slice(0, 4)).forEach((item) => {
        const card = document.createElement('div');
        card.className = 'item';
        card.innerHTML = '<div class="line1"><b>' + item.title + '</b><span class="badge">' + item.source + '</span></div>' +
          '<div class="time">' + fmtClock(item.start) + ' - ' + fmtClock(item.end) + ' • in ' + (item.start - nowMin) + ' min</div>';
        upcomingList.appendChild(card);
      });
      if (!upcoming.length) {
        const empty = document.createElement('div');
        empty.className = 'item';
        empty.innerHTML = '<div class="time">No upcoming schedule items found.</div>';
        upcomingList.appendChild(empty);
      }

      timeline.innerHTML = '';
      items.forEach((item) => {
        const card = document.createElement('div');
        const active = nowMin >= item.start && nowMin < item.end;
        card.className = 'item' + (active ? ' now' : '');
        card.innerHTML = '<div class="line1"><b>' + item.title + '</b><span class="badge">' + item.source + '</span></div>' +
          '<div class="time">' + fmtClock(item.start) + ' - ' + fmtClock(item.end) + ' • ' + item.durationMinutes + ' min</div>';
        timeline.appendChild(card);
      });

      alertBox.style.display = 'none';
      if (next) {
        const remain = next.start - nowMin;
        const threshold = THRESHOLDS.find((t) => remain <= t && remain > t - 1);
        if (threshold != null) {
          const key = next.id + ':' + threshold;
          if (!state.fired.has(key)) {
            state.fired.add(key);
            if (state.sound) playChime(threshold);
            alertBox.style.display = 'block';
            alertBox.textContent = threshold + '-minute reminder • ' + next.title;
          }
        }
      }
    }

    soundToggle.addEventListener('click', () => {
      state.sound = !state.sound;
      render();
    });
    byId('refreshBtn').addEventListener('click', render);

    render();
    setInterval(render, 30000);
  </script>
</body>
</html>`),"text/html;charset=utf-8"),window.setTimeout(()=>{d(`${a}.json`,JSON.stringify(t,null,2),"application/json;charset=utf-8")},120),window.setTimeout(()=>{d(`${a}-README.txt`,`EduDash Pro - Offline TV Pack

Generated: ${t.generatedAt}
Day: ${t.dayName}, ${t.dateLabel}

FILES
- edudash-room-display-offline-<date>.html: Self-running offline display page with reminders/chimes.
- edudash-room-display-offline-<date>.json: Raw routine/lesson payload.
- edudash-room-display-offline-<date>-slide-##.png: Standard-TV-safe slideshow images.
- edudash-room-display-offline-<date>-README.txt: This guide.

USB USE - SMART TV / BROWSER TV
1. Copy the HTML file to your USB.
2. Insert USB into a device/TV browser that can open local HTML files.
3. Open the HTML file and set TV to fullscreen mode.
4. Sound is enabled by default for 15/10/5-minute reminder chimes.

USB USE - NORMAL TV (NO BROWSER)
1. Copy the slide PNG files to USB.
2. Open the TV photo viewer and start slideshow mode.
3. Set interval to 10-20 seconds and turn loop/repeat on.
4. Keep TV in landscape fullscreen for all-day display.

IMPORTANT
- Normal TVs cannot execute HTML/JS from USB; use the PNG slide files on those TVs.
- For live reminders/chimes, use a browser-capable TV or HDMI mini-PC.`,"text/plain;charset=utf-8")},240);let r=function(e){let{data:t}=e,s=(t.menuToday?.breakfast?.length||0)+(t.menuToday?.lunch?.length||0)+(t.menuToday?.snack?.length||0),l=[{title:"EduDash Pro Daily Room Display",subtitle:`${e.dayName}, ${e.dateLabel}`,lines:[e.routineTitle?`Theme: ${e.routineTitle}`:"Theme: Not published",`Routine blocks: ${t.routine?.blocks?.length||0}`,`Lessons: ${t.lessons?.length||0}`,`Menu items: ${s}`,`Announcements: ${t.announcements?.length||0}`,"For standard TVs, use slideshow mode (10-20 sec interval, loop on)."]}],n=(t.routine?.blocks||[]).map(e=>`${e.startTime||"--:--"}-${e.endTime||"--:--"}  ${e.title||"Routine block"}`);n.length?u(n,10).forEach((e,t)=>{l.push({title:0===t?"Today's routine":"Today's routine (cont.)",lines:e})}):l.push({title:"Today's routine",lines:["No routine blocks found for today."]});let a=(t.lessons||[]).map(e=>{let t=new Date(e.scheduled_at),s=Number.isNaN(t.getTime())?"--:--":t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),l=Number(e.duration_minutes)||0,n=l>0?` (${l} min)`:"";return`${s}  ${e.title||"Lesson"}${n}`});a.length?u(a,10).forEach((e,t)=>{l.push({title:0===t?"Today's lessons":"Today's lessons (cont.)",lines:e})}):l.push({title:"Today's lessons",lines:["No scheduled lessons for today."]});let r=[];t.menuToday?.breakfast?.length&&r.push(`Breakfast: ${t.menuToday.breakfast.join(", ")}`),t.menuToday?.lunch?.length&&r.push(`Lunch: ${t.menuToday.lunch.join(", ")}`),t.menuToday?.snack?.length&&r.push(`Snack: ${t.menuToday.snack.join(", ")}`),l.push({title:"Today's menu",lines:r.length?r:["Menu is not published for today."]});let i=(t.announcements||[]).map(e=>{let t=m(e.body_preview||"",60);return t?`${e.title}: ${t}`:e.title});return l.push({title:"Announcements",lines:i.length?i:["No announcements queued."]}),l.push({title:"Reminder cadence",lines:["15 minutes before next block: prepare transition.","10 minutes before: start wrap-up instructions.","5 minutes before: final transition cue.","Tip: keep the TV slideshow in loop mode."]}),l}(t);r.forEach((e,s)=>{window.setTimeout(()=>{var l,n;let i,o=function(e,t,s,l){let n=document.createElement("canvas");n.width=1920,n.height=1080;let a=n.getContext("2d");if(!a)return n;let r=a.createLinearGradient(0,0,1920,1080);r.addColorStop(0,"#060915"),r.addColorStop(.55,"#0a1020"),r.addColorStop(1,"#070c17"),a.fillStyle=r,a.fillRect(0,0,1920,1080);let i=a.createRadialGradient(1632,-40,80,1632,-40,560);i.addColorStop(0,"rgba(124,58,237,0.34)"),i.addColorStop(1,"rgba(124,58,237,0)"),a.fillStyle=i,a.fillRect(0,0,1920,1080),a.fillStyle="rgba(10,20,42,0.78)",a.fillRect(80,84,1760,912),a.fillStyle="#c4b5fd",a.font='700 26px "Segoe UI", Arial, sans-serif',a.fillText("EduDash Pro • Offline TV Pack",120,138),a.fillStyle="#f8fafc",a.font='800 62px "Segoe UI", Arial, sans-serif',a.fillText(t.title,120,232),t.subtitle&&(a.fillStyle="#cbd5e1",a.font='500 34px "Segoe UI", Arial, sans-serif',a.fillText(t.subtitle,120,284));let o=360;return t.lines.forEach(e=>{(function(e,t=78){let s=m(e,3*t);if(!s)return[];let l=s.split(" "),n=[],a="";return l.forEach(e=>{let s=a?`${a} ${e}`:e;if(s.length<=t){a=s;return}a&&n.push(a),a=e.length<=t?e:`${e.slice(0,t-1)}…`}),a&&n.push(a),n.slice(0,2)})(e,82).forEach((e,t)=>{o>920||(0===t&&(a.fillStyle="#8b5cf6",a.beginPath(),a.arc(130,o-12,6,0,2*Math.PI),a.fill()),a.fillStyle="#e2e8f0",a.font=0===t?'600 36px "Segoe UI", Arial, sans-serif':'500 31px "Segoe UI", Arial, sans-serif',a.fillText(e,0===t?150:178,o),o+=0===t?56:46)})}),a.fillStyle="#94a3b8",a.font='500 26px "Segoe UI", Arial, sans-serif',a.fillText(`Generated ${new Date(e.generatedAt).toLocaleString()}`,120,1002),a.fillText(`Slide ${s+1}/${l}`,1660,1002),n}(t,e,s,r.length);l=`${a}-slide-${String(s+1).padStart(2,"0")}.png`,n=o.toDataURL("image/png"),(i=document.createElement("a")).href=n,i.download=l,document.body.appendChild(i),i.click(),i.remove()},360+140*s)}),ew("Offline TV Pack downloaded: HTML + JSON + README.")}catch(e){ew(e instanceof Error?e.message:"Failed to export Offline TV Pack.")}finally{window.setTimeout(()=>eT(!1),500)}},[eD,eZ,eA]),e7=e5?Math.max(0,Math.ceil((e5.startsAtMs-ex)/6e4)):null;(0,s.useEffect)(()=>{if(!e5)return;let e=e5.startsAtMs-ex;if(e<=0||e>9e5)return;let t=C.find(t=>e<=6e4*t&&e>(t-1)*6e4);if(!t)return;let s=`${e5.id}:${t}`;if(eM.current.has(s))return;eM.current.add(s);let l=`${t}-minute reminder • ${e5.title}`;eb(l),ej({threshold:t,title:e5.title}),eg&&function(e){try{let t=window,s=t.AudioContext||t.webkitAudioContext;if(!s)return;let l=new s,n=l.createGain();n.gain.value=5===e?.3:10===e?.24:.2,n.connect(l.destination);let a=l.currentTime;(({15:[523,659],10:[659,784,659],5:[880,988,1174,988]})[e]||[660,880]).forEach(e=>{let t=l.createOscillator();t.type="triangle",t.frequency.setValueAtTime(e,a),t.connect(n),t.start(a),t.stop(a+.25),a+=.34}),window.setTimeout(()=>{l.close()},2200)}catch{}}(t);let n=window.setTimeout(()=>{eb(e=>e===l?null:e),ej(e=>e?.title===e5.title&&e?.threshold===t?null:e)},9e3);return()=>{window.clearTimeout(n)}},[e5,ex,eg]),(0,s.useEffect)(()=>{if(!ev)return;let e=e=>{("Escape"===e.key||"Enter"===e.key||" "===e.key)&&(e.preventDefault(),e6())};return window.addEventListener("keydown",e),()=>{window.removeEventListener("keydown",e)}},[ev,e6]);let[te,tt]=(0,s.useState)(0),ts=(0,s.useMemo)(()=>{if(!eZ)return T;let e=[];return(eZ.routine?.blocks?.length||eZ.themeLabel)&&e.push("routine"),eZ.lessons?.length&&e.push("lessons"),$(eZ)&&e.push("menu"),eZ.announcements?.length&&e.push("announcements"),eZ.insights?.bullets?.length&&e.push("insights"),e.length?e:T},[eZ]),tl=ts.length>1,tn=!e_&&("grid"===eo||e1),ta=tl&&!tn&&(e_||ed);(0,s.useEffect)(()=>{if(!ta)return;let e=setInterval(()=>{tt(e=>(e+1)%Math.max(1,ts.length))},45e3);return()=>clearInterval(e)},[ta,ts.length]),(0,s.useEffect)(()=>{tt(e=>e>=ts.length?0:e)},[ts.length]);let tr=ts[te]??ts[0]??"routine",ti=(0,s.useCallback)(e=>eZ?"routine"===e?(0,t.jsx)(D,{data:eZ,nowMs:ex}):"lessons"===e?(0,t.jsx)(O,{data:eZ}):"menu"===e?(0,t.jsx)(U,{data:eZ}):"announcements"===e?(0,t.jsx)(B,{data:eZ}):(0,t.jsx)(V,{data:eZ}):null,[eZ,ex]);return F&&(e_||eS||_&&(!k||!eR)||eA)?e_||!_||eR||eA||k?eQ&&!eZ?(0,t.jsx)("div",{className:"flex min-h-screen items-center justify-center",children:(0,t.jsx)("p",{className:"text-xl",style:{color:"var(--muted)"},children:"Loading display…"})}):eX?(0,t.jsxs)("div",{className:"flex min-h-screen flex-col items-center justify-center gap-6 p-8",children:[(0,t.jsx)("p",{className:"text-xl",style:{color:"var(--danger)"},children:eX}),(0,t.jsx)("button",{type:"button",onClick:()=>eY(),className:"rounded-xl px-6 py-3 font-medium text-white transition-colors hover:opacity-90",style:{background:"var(--primary)"},children:"Retry"})]}):eZ?(0,t.jsxs)("div",{className:`display-root relative min-h-screen overflow-x-hidden overflow-y-auto ${e_?"tv-mode":""}`,children:[ev&&(0,t.jsx)("div",{className:"fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-slate-950/55 backdrop-blur-sm threshold-overlay-backdrop",onClick:e6,children:(0,t.jsxs)("div",{className:"threshold-overlay-content rounded-3xl border border-amber-300/40 bg-gradient-to-br from-amber-300/15 to-rose-300/10 px-8 py-7 text-center shadow-[0_24px_80px_-28px_rgba(245,158,11,0.55)]",onClick:e=>e.stopPropagation(),children:[(0,t.jsx)("p",{className:"text-xs font-semibold uppercase tracking-[0.28em] text-amber-100",children:"Reminder Alert"}),(0,t.jsxs)("p",{className:"mt-2 text-5xl font-black text-white",children:[ev.threshold," min"]}),(0,t.jsx)("p",{className:"mt-3 text-lg font-semibold text-amber-100",children:ev.title}),(0,t.jsx)("p",{className:"mt-1 text-xs text-slate-200",children:"Prepare transition now."}),(0,t.jsx)("button",{type:"button",onClick:e6,className:"mt-4 rounded-lg border border-amber-200/45 bg-amber-100/15 px-4 py-2 text-xs font-semibold text-amber-50",children:"Dismiss"}),(0,t.jsx)("p",{className:"mt-2 text-[11px] text-amber-100/80",children:"Tap outside, press Enter, or Esc to close."})]})}),(0,t.jsxs)("div",{className:"display-container",children:[eN&&(0,t.jsx)("div",{className:"card display-glass mb-4 rounded-2xl border-fuchsia-300/30 bg-fuchsia-500/10 px-4 py-3 text-sm font-semibold text-fuchsia-100 backdrop-blur-md",children:eN}),ey&&(0,t.jsx)("div",{className:"card display-glass mb-4 rounded-2xl border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 backdrop-blur-md",children:ey}),(0,t.jsxs)("header",{className:"card display-glass-header display-header-shell mb-8 flex flex-wrap items-start justify-between gap-6 rounded-2xl",children:[(0,t.jsxs)("div",{className:"display-header-brand min-w-0",children:[(0,t.jsx)("span",{className:"inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-widest",style:{borderColor:"rgba(139,92,246,0.4)",background:"var(--primary-subtle)",color:"#ddd6fe"},children:"Next-Gen UI"}),(0,t.jsxs)("h1",{className:"display-title mt-3 flex items-center gap-3 font-bold tracking-tight",style:{color:"var(--text-primary)"},children:[(0,t.jsx)(l.default,{src:"/icon-192.png",alt:"EduDash Pro",width:40,height:40,className:"h-9 w-9 shrink-0 rounded-xl object-contain md:h-10 md:w-10"}),"EduDash Pro – Room Display"]}),(0,t.jsxs)("p",{className:"display-date mt-2",style:{color:"var(--text-secondary)"},children:[eZ.dayName,", ",eZ.dateLabel]}),(0,t.jsxs)("div",{className:"display-header-meta-row mt-3",children:[(0,t.jsx)("span",{className:"display-meta-pill",children:e_?"Live TV mode":"Desktop preview"}),em?(0,t.jsxs)("span",{className:"display-meta-pill",children:["Updated ",em.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})]}):null,eU?(0,t.jsxs)("span",{className:"display-meta-pill display-meta-pill-accent",children:["Trusted TV paired",eP?` • Expires ${eP}`:""]}):null]})]}),(0,t.jsxs)("div",{className:"display-header-right flex w-full min-w-0 flex-col items-stretch gap-2 md:w-auto md:max-w-[460px] md:items-end",children:[(0,t.jsxs)("div",{className:"card display-glass display-reminder-card w-full rounded-2xl",children:[(0,t.jsxs)("div",{className:"mb-2 flex items-center justify-between gap-3",children:[(0,t.jsx)("p",{className:"text-xs font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Upcoming reminder"}),(0,t.jsxs)("button",{type:"button",onClick:()=>ef(e=>!e),className:`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${eg?"border-[var(--primary)]/50":"border-slate-600/50"}`,style:{background:eg?"var(--primary-subtle)":"rgba(15,23,42,0.72)",color:"var(--text-secondary)"},children:[eg?(0,t.jsx)(b.Volume2,{className:"h-3.5 w-3.5"}):(0,t.jsx)(v.VolumeX,{className:"h-3.5 w-3.5"}),eg?"Sound on":"Sound off"]})]}),e5?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("p",{className:"text-base font-semibold",style:{color:"var(--text-primary)"},children:[(0,t.jsx)(y.BellRing,{className:"mr-1 inline h-4 w-4",style:{color:"var(--primary)"}}),e5.title]}),(0,t.jsxs)("p",{className:"mt-1 text-xs",style:{color:"var(--text-secondary)"},children:["Starts at ",E(e5.startsAtMs)," • in ",e7," min (",e5.source,")"]}),(0,t.jsx)("div",{className:"mt-2 flex flex-wrap gap-1.5",children:C.map(e=>{let s=e5.startsAtMs-ex<=6e4*e;return(0,t.jsxs)("span",{className:"rounded-full px-2.5 py-1 text-[11px] font-semibold",style:{background:s?"rgba(124,58,237,0.22)":"rgba(15,23,42,0.42)",color:s?"#ede9fe":"#94a3b8",border:"1px solid rgba(148, 163, 184, 0.24)"},children:[e,"m"]},e)})})]}):(0,t.jsx)("p",{className:"text-xs",style:{color:"var(--text-secondary)"},children:"No upcoming lessons or routine blocks found for reminder alerts."})]}),k&&!e_&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("div",{className:"grid w-full grid-cols-1 gap-2 sm:grid-cols-2",children:[(0,t.jsx)("button",{type:"button",onClick:async()=>{et(null),Y(!1),el(null),ea(null);try{let e=await fetch("/api/display/link");if(!e.ok){let t=await e.json().catch(()=>({}));throw Error(t.error||"Failed to get link")}let{url:t,joinCode:s}=await e.json();el(t),s&&ea(s),"undefined"!=typeof navigator&&navigator.clipboard?.writeText&&(await navigator.clipboard.writeText(s?`${s} (or open: ${t})`:t),Y(!0),setTimeout(()=>Y(!1),3e3))}catch(e){et(e instanceof Error?e.message:"Failed")}},className:"rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90",style:{background:X?"var(--success)":"var(--primary)"},children:X?"Copied! Open on TV":"Get TV link"}),(0,t.jsxs)("button",{type:"button",onClick:e9,disabled:ek,className:"inline-flex items-center justify-center gap-1.5 rounded-xl border border-fuchsia-200/35 bg-fuchsia-500/14 px-4 py-2.5 text-sm font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-500/22 disabled:opacity-70",children:[(0,t.jsx)(j,{className:"h-4 w-4"}),ek?"Exporting...":"Export USB Pack"]})]}),en&&(0,t.jsxs)("p",{className:"text-sm",style:{color:"var(--text-secondary)"},children:["Join code:"," ",(0,t.jsx)("span",{className:"select-all font-mono text-lg font-bold tracking-widest",style:{color:"var(--primary)"},children:en}),(0,t.jsx)("span",{className:"ml-1 text-xs",style:{color:"var(--muted)"},children:"(type on TV)"})]}),es&&(0,t.jsxs)("p",{className:"max-w-xs break-all text-xs",style:{color:"var(--muted)"},children:["Or open:"," ",(0,t.jsx)("span",{className:"select-all font-mono",style:{color:"var(--cyan)"},children:es})]}),ee&&(0,t.jsx)("p",{className:"text-xs",style:{color:"var(--danger)"},children:ee}),(0,t.jsxs)("div",{className:"mt-1 flex w-full flex-wrap justify-start gap-2 md:justify-end",children:[(0,t.jsx)("button",{type:"button",onClick:()=>ec(e=>"focus"===e?"grid":"focus"),className:"grid"===eo?R:I,children:"focus"===eo?"Grid preview":"Focus preview"}),(0,t.jsx)("button",{type:"button",onClick:()=>eu(e=>!e),className:ed?R:I,children:ed?"Auto-rotate on":"Auto-rotate off"})]}),(0,t.jsx)("p",{className:"text-right text-[11px]",style:{color:"var(--muted)"},children:"Preview mode only. TV mode stays optimized for fullscreen playback."})]})]}),tl&&!tn&&(0,t.jsx)("div",{className:"flex w-full flex-wrap items-center gap-2",children:ts.map((e,s)=>(0,t.jsx)("button",{type:"button",onClick:()=>tt(s),className:tr===e?`${R} px-4 py-2 text-sm`:`${I} px-4 py-2 text-sm`,children:M[e]},e))})]}),(0,t.jsxs)("div",{className:"section display-overview-section",children:[(0,t.jsx)("div",{className:"sectionTitle display-section-heading",children:"Overview"}),(0,t.jsxs)("div",{className:"display-stats-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6",children:[(0,t.jsxs)("div",{className:`card tile display-glass-tile col-span-2 sm:col-span-3 lg:col-span-2 min-w-0 rounded-2xl ${e3?"current-block-live":""}`,children:[(0,t.jsx)("p",{className:"text-[11px] uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Routine blocks"}),(0,t.jsx)("p",{className:"display-stat-number mt-1 text-2xl font-black",style:{color:"var(--text-primary)"},children:e0.routineBlocks}),(0,t.jsxs)("div",{className:"mt-4 space-y-3",children:[(0,t.jsx)("p",{className:"text-[11px] font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Current block now"}),e3?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("p",{className:"text-lg font-semibold",style:{color:"var(--text-primary)"},children:[e3.title,(0,t.jsx)("span",{className:"ml-2 text-xs uppercase tracking-wider",style:{color:"#c4b5fd"},children:e3.source})]}),(0,t.jsx)("div",{className:"h-2 w-full overflow-hidden rounded-full bg-slate-800/80",children:(0,t.jsx)("div",{className:"current-block-progress h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 transition-all",style:{width:`${e8}%`}})}),(0,t.jsxs)("p",{className:"text-xs",style:{color:"var(--text-secondary)"},children:[E(e3.startMs)," - ",E(e3.endMs)," • ",Math.max(0,Math.ceil((e3.endMs-ex)/6e4))," min left"]})]}):(0,t.jsx)("p",{className:"text-base font-semibold",style:{color:"var(--text-primary)"},children:"No active block right now."}),e5&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)("p",{className:"text-[11px] font-semibold uppercase tracking-wider pt-1",style:{color:"var(--text-secondary)"},children:"Routine"}),(0,t.jsx)("p",{className:"text-sm font-semibold",style:{color:"var(--text-primary)"},children:e5.title}),(0,t.jsxs)("p",{className:"text-xs",style:{color:"var(--text-secondary)"},children:[E(e5.startsAtMs)," • in ",e7," min (",e5.source,")"]})]})]})]}),(0,t.jsxs)("div",{className:"card tile display-glass-tile rounded-2xl",children:[(0,t.jsx)("p",{className:"text-[11px] uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Lessons"}),(0,t.jsx)("p",{className:"display-stat-number mt-1 text-2xl font-black",style:{color:"var(--text-primary)"},children:e0.lessonBlocks})]}),(0,t.jsxs)("div",{className:"card tile display-glass-tile rounded-2xl",children:[(0,t.jsx)("p",{className:"text-[11px] uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Menu items"}),(0,t.jsx)("p",{className:"display-stat-number mt-1 text-2xl font-black",style:{color:"var(--text-primary)"},children:e0.menuItems})]}),(0,t.jsxs)("div",{className:"card tile display-glass-tile rounded-2xl",children:[(0,t.jsx)("p",{className:"text-[11px] uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Announcements"}),(0,t.jsx)("p",{className:"display-stat-number mt-1 text-2xl font-black",style:{color:"var(--text-primary)"},children:e0.announcements})]}),(0,t.jsxs)("div",{className:"card tile display-glass-tile rounded-2xl",children:[(0,t.jsx)("p",{className:"text-[11px] uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Display state"}),(0,t.jsx)("p",{className:"mt-1 text-base font-semibold",style:{color:"var(--text-primary)"},children:e1?"Setup needed":`${e0.filledSections}/5 live`})]})]})]}),e4.length>0&&(0,t.jsxs)("div",{className:"section",children:[(0,t.jsx)("div",{className:"sectionTitle display-section-heading",children:"Upcoming"}),(0,t.jsx)("div",{className:"card grid gap-3 md:grid-cols-4",children:e4.map(e=>{let s=Math.max(0,Math.ceil((e.startsAtMs-ex)/6e4));return(0,t.jsxs)("div",{className:"rounded-lg border border-slate-600/40 bg-slate-800/40 px-4 py-3",children:[(0,t.jsx)("p",{className:"text-xs uppercase tracking-wider",style:{color:"var(--muted)"},children:e.source}),(0,t.jsx)("p",{className:"mt-1 text-sm font-semibold",style:{color:"var(--text-primary)"},children:e.title}),(0,t.jsxs)("p",{className:"mt-1 text-xs",style:{color:"var(--text-secondary)"},children:[E(e.startsAtMs)," • in ",s," min"]})]},e.id)})})]}),e1&&!e_&&(0,t.jsx)("div",{className:"section",children:(0,t.jsxs)("div",{className:"card grid gap-3 md:grid-cols-[1.7fr_1fr]",children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("p",{className:"text-xs font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Setup checklist"}),(0,t.jsx)("p",{className:"mt-2 text-lg font-semibold",style:{color:"var(--text-primary)"},children:"Room Display is connected, but today has no published classroom content yet."}),(0,t.jsxs)("ul",{className:"mt-3 grid gap-2 text-sm",style:{color:"var(--text-secondary)"},children:[(0,t.jsxs)("li",{className:"flex items-start gap-2",children:[(0,t.jsx)(N.CheckCircle2,{className:"mt-0.5 h-4 w-4 shrink-0",style:{color:"var(--primary)"}}),"Save and share today's routine to teachers."]}),(0,t.jsxs)("li",{className:"flex items-start gap-2",children:[(0,t.jsx)(N.CheckCircle2,{className:"mt-0.5 h-4 w-4 shrink-0",style:{color:"var(--primary)"}}),"Schedule at least one lesson block with start time."]}),(0,t.jsxs)("li",{className:"flex items-start gap-2",children:[(0,t.jsx)(N.CheckCircle2,{className:"mt-0.5 h-4 w-4 shrink-0",style:{color:"var(--primary)"}}),"Publish menu/announcements to enrich the wall display."]})]})]}),(0,t.jsxs)("div",{className:"rounded-lg border border-slate-600/50 bg-slate-800/40 p-5",children:[(0,t.jsx)("p",{className:"text-sm font-semibold",style:{color:"var(--text-primary)"},children:"Offline fallback ready"}),(0,t.jsx)("p",{className:"mt-1 text-xs",style:{color:"var(--text-secondary)"},children:"You can still export an Offline TV Pack now and copy it to USB for standalone playback."}),(0,t.jsxs)("button",{type:"button",onClick:e9,disabled:ek,className:"mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-70",style:{borderColor:"rgba(236,72,153,0.4)",background:"var(--primary-subtle)",color:"var(--text-primary)"},children:[(0,t.jsx)(j,{className:"h-3.5 w-3.5"}),ek?"Exporting...":"Export USB Pack"]})]})]})}),(0,t.jsx)("div",{className:`dashboardSections mx-auto ${tn?"max-w-7xl":"max-w-5xl"}`,children:tn?(0,t.jsxs)("div",{className:"section grid gap-4 xl:grid-cols-2 xl:grid-rows-1",children:[(0,t.jsx)("div",{className:"min-h-0 xl:row-span-1",children:ti("routine")}),(0,t.jsxs)("div",{className:"flex flex-col gap-6 min-h-0",children:[ti("lessons"),ti("menu"),ti("announcements"),ti("insights")]})]}):tl?(0,t.jsx)("div",{className:"section min-h-[min(68vh,720px)]",children:ti(tr)}):(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)("div",{className:"section",children:ti("routine")}),(0,t.jsx)("div",{className:"section",children:ti("lessons")}),(0,t.jsx)("div",{className:"section",children:ti("menu")}),(0,t.jsx)("div",{className:"section",children:ti("announcements")}),(0,t.jsx)("div",{className:"section",children:ti("insights")})]})}),(0,t.jsxs)("footer",{className:"mt-8 text-center text-sm",style:{color:"var(--muted)"},children:[e_?"Data refreshes every 10 minutes. ":"Preview updates with your live dashboard data. ","15/10/5 reminder pattern is active for upcoming routine and lesson starts. Use fullscreen (F11) for TV."]})]})]}):(0,t.jsx)("div",{className:"flex min-h-screen items-center justify-center",children:(0,t.jsx)("p",{className:"text-xl",style:{color:"var(--muted)"},children:"No data for this organisation."})}):(0,t.jsx)("div",{className:"flex min-h-screen flex-col items-center justify-center p-6 sm:p-8",children:(0,t.jsxs)("div",{className:"w-full max-w-lg rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl",style:{background:"linear-gradient(145deg, var(--surface-1) 0%, var(--surface-2) 50%, var(--card) 100%)",border:"1px solid var(--border)",boxShadow:"0 0 0 1px rgba(255,255,255,0.05), 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 80px -20px var(--primary-subtle)"},children:[(0,t.jsx)("div",{className:"mb-6 flex justify-center",children:(0,t.jsx)("div",{className:"flex h-14 w-14 items-center justify-center rounded-2xl text-2xl",style:{background:"var(--primary-subtle)",color:"var(--primary)"},children:(0,t.jsx)(f.Clock,{className:"h-8 w-8"})})}),(0,t.jsx)("h1",{className:"text-center text-2xl font-bold tracking-tight sm:text-3xl",style:{color:"var(--text-primary)"},children:"Room Display"}),(0,t.jsx)("p",{className:"mt-2 text-center text-sm",style:{color:"var(--muted)"},children:"Show routine, lessons, menu and announcements on a TV. This page does not auto-refresh."}),(0,t.jsxs)("div",{className:"mt-8 rounded-2xl p-5",style:{background:"rgba(0,0,0,0.2)",border:"1px solid var(--border)"},children:[(0,t.jsx)("h2",{className:"text-sm font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"How to get the link on the TV"}),(0,t.jsxs)("ol",{className:"mt-4 space-y-3 text-[var(--text-secondary)]",children:[(0,t.jsxs)("li",{className:"flex gap-3",children:[(0,t.jsx)("span",{className:"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",style:{background:"var(--primary)",color:"white"},children:"1"}),"On your phone or laptop, ",(0,t.jsx)("strong",{style:{color:"var(--text-primary)"},children:"sign in"})," to EduDash Pro."]}),(0,t.jsxs)("li",{className:"flex gap-3",children:[(0,t.jsx)("span",{className:"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",style:{background:"var(--primary)",color:"white"},children:"2"}),"Open ",(0,t.jsx)("strong",{style:{color:"var(--text-primary)"},children:"Dashboard"})," and tap or click ",(0,t.jsx)("strong",{style:{color:"var(--primary)"},children:'"Get TV link"'}),"."]}),(0,t.jsxs)("li",{className:"flex gap-3",children:[(0,t.jsx)("span",{className:"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",style:{background:"var(--primary)",color:"white"},children:"3"}),"Copy the link, then on the ",(0,t.jsx)("strong",{style:{color:"var(--text-primary)"},children:"TV browser"})," open that link. No sign-in needed on the TV."]})]})]}),(0,t.jsxs)("p",{className:"mt-4 text-center text-xs",style:{color:"var(--muted)"},children:["Or on the TV, add ",(0,t.jsx)("code",{className:"rounded px-1.5 py-0.5",style:{background:"var(--surface-2)"},children:"?org=...&token=..."})," to the URL (get the full link from a signed-in device)."]}),(0,t.jsxs)("div",{className:"mt-6 rounded-2xl p-5",style:{background:"rgba(0,0,0,0.2)",border:"1px solid var(--border)"},children:[(0,t.jsx)("h2",{className:"text-sm font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"On the TV: enter join code"}),(0,t.jsx)("p",{className:"mt-1 text-xs",style:{color:"var(--muted)"},children:"Open this page on the TV, then type the 6-character code from your phone or laptop."}),(0,t.jsx)("p",{className:"mt-1 text-xs",style:{color:"var(--muted)"},children:"After first pairing, this TV stays trusted for months and reconnects automatically."}),(0,t.jsxs)("div",{className:"mt-4 flex gap-2",children:[(0,t.jsx)("input",{type:"text",inputMode:"text",maxLength:8,placeholder:"e.g. ABC123",value:er,onChange:e=>ei(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"")),className:"flex-1 rounded-xl border px-4 py-3 text-center text-lg font-mono font-bold tracking-widest",style:{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text-primary)"}}),(0,t.jsx)("button",{type:"button",onClick:()=>{let t=er.trim().toUpperCase();t.length>=4&&e.push(`/display?code=${encodeURIComponent(t)}`)},className:"shrink-0 rounded-xl px-6 py-3 text-base font-semibold text-white",style:{background:"var(--primary)"},children:"Go"})]})]}),(0,t.jsx)("div",{className:"mt-8 flex justify-center",children:(0,t.jsx)("button",{type:"button",onClick:()=>e.push("/sign-in"),className:"rounded-xl px-8 py-3.5 text-base font-semibold text-white transition-all hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]",style:{background:"var(--primary)",boxShadow:"0 4px 14px 0 rgba(124, 58, 237, 0.4)"},children:"Sign in to get TV link"})})]})}):(0,t.jsx)("div",{className:"flex min-h-screen items-center justify-center",children:(0,t.jsx)("p",{className:"text-xl",style:{color:"var(--muted)"},children:"Preparing display…"})})}function P(){return(0,t.jsx)(s.Suspense,{fallback:(0,t.jsx)("div",{className:"flex min-h-screen items-center justify-center",children:(0,t.jsx)("p",{className:"text-xl",style:{color:"var(--muted)"},children:"Loading display…"})}),children:(0,t.jsx)(_,{})})}e.s(["default",()=>P],715513)}]);