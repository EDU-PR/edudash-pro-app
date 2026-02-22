module.exports=[944571,a=>{"use strict";var b=a.i(256856),c=a.i(755132),d=a.i(746881),e=a.i(832315),f=a.i(428513),g=a.i(97473);let h=[15,10,5];function i(a){let b=String(a||"").trim().match(/^(\d{1,2}):(\d{2})$/);if(!b)return null;let c=Number(b[1]),d=Number(b[2]);return!Number.isFinite(c)||!Number.isFinite(d)||c<0||c>23||d<0||d>59?null:60*c+d}function j(a){let b=Number.isFinite(a)?Math.max(0,Math.min(1439,Math.floor(a))):0,c=Math.floor(b/60);return`${String(c).padStart(2,"0")}:${String(b%60).padStart(2,"0")}`}function k(a,b,c){let d=new Blob([b],{type:c}),e=URL.createObjectURL(d),f=document.createElement("a");f.href=e,f.download=a,document.body.appendChild(f),f.click(),f.remove(),window.setTimeout(()=>URL.revokeObjectURL(e),1200)}function l(a,b){if(!a.length)return[];let c=[];for(let d=0;d<a.length;d+=b)c.push(a.slice(d,d+b));return c}function m(a,b=78){let c=String(a||"").replace(/\s+/g," ").trim();return c?c.length<=b?c:`${c.slice(0,Math.max(0,b-1)).trim()}…`:""}var n=a.i(268975),o=a.i(412401),p=a.i(547252),q=a.i(445203),r=a.i(799815),s=a.i(587969),t=a.i(174853),u=a.i(720587);let v=(0,a.i(335520).default)("hard-drive-download",[["path",{d:"M12 2v8",key:"1q4o3n"}],["path",{d:"m16 6-4 4-4-4",key:"6wukr"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",key:"w68u3i"}],["path",{d:"M6 18h.01",key:"uhywen"}],["path",{d:"M10 18h.01",key:"h775k"}]]);var w=a.i(218943),x=a.i(189854),y=a.i(136608);let z=["routine","lessons","menu","announcements","insights"],A=[15,10,5],B={routine:"Routine",lessons:"Lessons",menu:"Menu",announcements:"Announcements",insights:"Insights"};function C(a){return new Date(a).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}function D(a,b){if(!b)return null;let c=String(b).trim().match(/^(\d{1,2}):(\d{2})$/);if(!c)return null;let d=Number(c[1]),e=Number(c[2]);if(!Number.isFinite(d)||!Number.isFinite(e)||d<0||d>23||e<0||e>59)return null;let f=new Date(`${a}T${String(d).padStart(2,"0")}:${String(e).padStart(2,"0")}:00`).getTime();return Number.isFinite(f)?f:null}function E(a){return!!(a.menuToday&&(a.menuToday.breakfast?.length||a.menuToday.lunch?.length||a.menuToday.snack?.length))}let F="rounded-full border border-slate-600/50 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold transition-all hover:border-[var(--primary)]/50 hover:bg-[var(--primary-subtle)] text-[var(--text-secondary)]",G="rounded-full border border-[var(--primary)]/60 bg-gradient-to-r from-[var(--primary)]/35 to-fuchsia-500/30 px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] shadow-[0_8px_24px_-16px_rgba(124,58,237,0.7)]";function H({title:a,message:c,checklist:d}){return(0,b.jsxs)("div",{className:"card",children:[(0,b.jsx)("p",{className:"text-lg font-semibold text-white",children:a}),(0,b.jsx)("p",{className:"mt-3 text-sm text-slate-400 leading-tight",children:c}),d&&d.length>0&&(0,b.jsx)("ul",{className:"mt-4 grid gap-3",children:d.map(a=>(0,b.jsxs)("li",{className:"flex items-center gap-2 text-xs sm:text-sm text-slate-400 font-medium leading-tight",children:[(0,b.jsx)(w.CheckCircle2,{className:"h-4 w-4 shrink-0 text-violet-400"}),a]},a))})]})}function I({data:a,nowMs:d}){let[e,f]=(0,c.useState)(!0),[g,h]=(0,c.useState)(null),{routine:i,themeLabel:j,dateLabel:k,lessons:l}=a,m=(0,c.useMemo)(()=>{if(!i?.blocks?.length||null==d)return null;for(let a of i.blocks){let b=D(k,a.startTime),c=D(k,a.endTime);if(null!=b&&null!=c&&d>=b&&d<c)return a.id}return null},[i?.blocks,k,d]);return(0,b.jsxs)("section",{className:"card display-glass relative overflow-hidden rounded-2xl",children:[(0,b.jsx)("div",{className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.12),transparent_55%)]"}),(0,b.jsxs)("div",{className:"relative",children:[(0,b.jsxs)("button",{type:"button",onClick:()=>f(a=>!a),onKeyDown:a=>{("Enter"===a.key||" "===a.key)&&(a.preventDefault(),f(a=>!a))},"aria-expanded":e,className:"display-routine-toggle flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-left transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50",children:[(0,b.jsxs)("div",{className:"flex items-center gap-3",children:[(0,b.jsx)("span",{className:"flex h-10 w-10 items-center justify-center rounded-xl shadow-md",style:{backgroundColor:"rgba(124, 58, 237, 0.2)"},children:(0,b.jsx)(r.Clock,{className:"h-5 w-5",style:{color:"var(--primary)"}})}),(0,b.jsxs)("span",{className:"flex min-w-0 flex-col",children:[(0,b.jsx)("span",{className:"sectionTitle",style:{marginBottom:0},children:"Today's routine"}),i?.blocks?.length?(0,b.jsxs)("span",{className:"display-routine-count",children:[i.blocks.length," blocks planned"]}):null]})]}),e?(0,b.jsx)(y.ChevronUp,{className:"h-6 w-6 shrink-0",style:{color:"var(--text-secondary)"}}):(0,b.jsx)(x.ChevronDown,{className:"h-6 w-6 shrink-0",style:{color:"var(--text-secondary)"}})]}),j&&(0,b.jsxs)("p",{className:"display-routine-theme section-subtitle",children:["Theme: ",j]}),e&&(0,b.jsx)(b.Fragment,{children:i?.blocks?.length?(0,b.jsx)("ul",{className:"display-routine-list",children:i.blocks.map(a=>{let c=m===a.id,d=function(a,b,c){if(a.linkedLesson)return a.linkedLesson;let d=D(b,a.startTime),e=D(b,a.endTime);if(null==d||null==e)return null;for(let a of c){let b=new Date(a.scheduled_at).getTime();if(Number.isFinite(b)&&b>=d&&b<e)return a}return null}(a,k,l??[]),e=g===a.id,f=()=>h(b=>b===a.id?null:a.id);return(0,b.jsxs)("li",{className:`display-routine-item rounded-xl overflow-hidden ${c?"display-glass-routine-block-active":"display-glass-routine-block"}`,children:[(0,b.jsxs)("button",{type:"button",onClick:f,onKeyDown:a=>{("Enter"===a.key||" "===a.key)&&(a.preventDefault(),f())},"aria-expanded":e,className:"display-routine-row flex w-full cursor-pointer items-center gap-4 text-left transition-colors hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--primary)]/50",children:[(0,b.jsxs)("span",{className:"display-routine-time min-w-[5rem] font-mono",style:{color:"#c4b5fd"},children:[a.startTime??"–","–",a.endTime??"–"]}),(0,b.jsxs)("span",{className:`display-routine-title flex-1 ${c?"font-semibold":""}`,style:{color:"var(--text-primary)"},children:[a.title,a.lessonLinkSource&&(0,b.jsx)("span",{className:"ml-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",style:{borderColor:"manual"===a.lessonLinkSource?"rgba(236,72,153,0.35)":"rgba(139,92,246,0.4)",background:"manual"===a.lessonLinkSource?"rgba(236,72,153,0.14)":"rgba(124,58,237,0.16)",color:"manual"===a.lessonLinkSource?"#f9a8d4":"#c4b5fd"},children:a.lessonLinkSource})]}),e?(0,b.jsx)(y.ChevronUp,{className:"h-5 w-5 shrink-0",style:{color:"var(--text-secondary)"}}):(0,b.jsx)(x.ChevronDown,{className:"h-5 w-5 shrink-0",style:{color:"var(--text-secondary)"}})]}),e&&(0,b.jsx)("div",{className:"display-routine-detail border-t border-white/[0.06]",style:{color:"var(--text-secondary)"},children:d?(0,b.jsxs)("div",{className:"space-y-4",children:[(0,b.jsx)("p",{className:"font-semibold",style:{color:"var(--text-primary)"},children:d.title}),d.description&&(0,b.jsx)("p",{className:"text-sm",children:d.description}),d.steps&&d.steps.length>0?(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"mb-2 text-xs font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"What to do next"}),(0,b.jsx)("ol",{className:"list-decimal space-y-2 pl-5",children:d.steps.map((a,c)=>(0,b.jsxs)("li",{children:[(0,b.jsx)("span",{className:"font-medium",style:{color:"var(--text-primary)"},children:a.title}),a.duration?(0,b.jsxs)("span",{className:"ml-2 text-sm opacity-90",children:["(",a.duration,")"]}):null,a.description?(0,b.jsx)("p",{className:"mt-0.5 text-sm opacity-90",children:a.description}):null]},c))})]}):null,d.media?.resources&&d.media.resources.length>0?(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"mb-1 text-xs font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Resources"}),(0,b.jsx)("ul",{className:"list-disc pl-5 text-sm",children:d.media.resources.map((a,c)=>(0,b.jsx)("li",{children:a.title},c))})]}):null]}):(0,b.jsx)("p",{className:"text-sm",children:"No lesson scheduled for this block. Schedule a lesson in the teacher dashboard for this time to see instructions here."})})]},a.id)})}):(0,b.jsx)(H,{title:"Routine pending",message:"No routine blocks found for today yet.",checklist:["Generate and save the weekly routine in the principal planner.","Ensure today has published routine blocks with start/end times."]})})]})]})}function J({data:a}){let{lessons:c}=a;return(0,b.jsxs)("section",{className:"card display-glass relative overflow-hidden rounded-2xl",children:[(0,b.jsx)("div",{className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.1),transparent_55%)]"}),(0,b.jsxs)("div",{className:"relative flex items-center gap-3 mb-4",children:[(0,b.jsx)("span",{className:"flex h-10 w-10 items-center justify-center rounded-xl shadow-md",style:{backgroundColor:"rgba(124, 58, 237, 0.2)"},children:(0,b.jsx)(n.BookOpen,{className:"h-5 w-5 text-violet-300"})}),(0,b.jsx)("h2",{className:"sectionTitle",style:{marginBottom:0},children:"Lessons of the day"})]}),c?.length?(0,b.jsx)("ul",{className:"display-section-body space-y-5 text-base leading-relaxed",children:c.map(a=>(0,b.jsxs)("li",{className:"border-b border-slate-700/60 px-1 pb-5 last:border-0 last:pb-0",children:[(0,b.jsxs)("div",{className:"flex flex-wrap items-baseline gap-2",children:[(0,b.jsx)("span",{className:"font-mono text-lg text-violet-300",children:function(a){try{return new Date(a).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}catch{return a.slice(11,16)}}(a.scheduled_at)}),(0,b.jsx)("span",{className:"text-xl font-semibold text-white",children:a.title}),null!=a.duration_minutes&&(0,b.jsxs)("span",{className:"text-slate-400",children:[a.duration_minutes," min"]})]}),a.description&&(0,b.jsx)("p",{className:"mt-1 text-slate-300",children:a.description}),a.steps?.length?(0,b.jsxs)("div",{className:"mt-3 pl-4",children:[(0,b.jsx)("p",{className:"mb-1 text-sm font-medium text-slate-400",children:"Steps"}),(0,b.jsx)("ol",{className:"list-decimal space-y-1 text-lg text-slate-200",children:a.steps.slice(0,5).map((a,c)=>(0,b.jsxs)("li",{children:[a.title,a.duration?` (${a.duration})`:""]},c))})]}):null,a.media?.resources?.length?(0,b.jsxs)("div",{className:"mt-2 text-slate-400",children:["Resources: ",a.media.resources.map(a=>a.title).join(", ")]}):null]},a.id))}):(0,b.jsx)(H,{title:"No lessons scheduled",message:"Add a scheduled lesson and it will appear here in real time.",checklist:["Schedule at least one lesson for today.","Set lesson duration so reminder alerts can trigger."]})]})}function K({data:a}){let{menuToday:c}=a,d=E(a);return(0,b.jsxs)("section",{className:"card display-glass relative overflow-hidden rounded-2xl",children:[(0,b.jsx)("div",{className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.1),transparent_55%)]"}),(0,b.jsxs)("div",{className:"relative flex items-center gap-3 mb-4",children:[(0,b.jsx)("span",{className:"flex h-10 w-10 items-center justify-center rounded-xl shadow-md",style:{backgroundColor:"rgba(124, 58, 237, 0.2)"},children:(0,b.jsx)(o.UtensilsCrossed,{className:"h-5 w-5 text-violet-300"})}),(0,b.jsx)("h2",{className:"sectionTitle",style:{marginBottom:0},children:"Today's menu"})]}),d&&c?(0,b.jsxs)("div",{className:"display-section-body grid gap-5 text-xl leading-relaxed sm:grid-cols-3",children:[c.breakfast?.length?(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"mb-1 font-medium text-slate-400",children:"Breakfast"}),(0,b.jsx)("ul",{className:"text-white",children:c.breakfast.map((a,c)=>(0,b.jsx)("li",{children:a},c))})]}):null,c.lunch?.length?(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"mb-1 font-medium text-slate-400",children:"Lunch"}),(0,b.jsx)("ul",{className:"text-white",children:c.lunch.map((a,c)=>(0,b.jsx)("li",{children:a},c))})]}):null,c.snack?.length?(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"mb-1 font-medium text-slate-400",children:"Snack"}),(0,b.jsx)("ul",{className:"text-white",children:c.snack.map((a,c)=>(0,b.jsx)("li",{children:a},c))})]}):null]}):(0,b.jsx)(H,{title:"Menu not published",message:"No breakfast/lunch/snack items were found for today.",checklist:["Publish this week menu to include breakfast/lunch/snack entries."]})]})}function L({data:a}){let{announcements:c}=a;return(0,b.jsxs)("section",{className:"card display-glass relative overflow-hidden rounded-2xl",children:[(0,b.jsx)("div",{className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.1),transparent_55%)]"}),(0,b.jsxs)("div",{className:"relative flex items-center gap-3 mb-4",children:[(0,b.jsx)("span",{className:"flex h-10 w-10 items-center justify-center rounded-xl shadow-md",style:{backgroundColor:"rgba(124, 58, 237, 0.2)"},children:(0,b.jsx)(p.Megaphone,{className:"h-5 w-5 text-violet-300"})}),(0,b.jsx)("h2",{className:"sectionTitle",style:{marginBottom:0},children:"Announcements"})]}),c?.length?(0,b.jsx)("ul",{className:"display-section-body space-y-4 text-base leading-relaxed",children:c.map(a=>(0,b.jsxs)("li",{className:"rounded-lg bg-slate-800/40 px-4 py-3",children:[(0,b.jsx)("p",{className:"font-semibold",style:{color:"var(--text-primary)"},children:a.title}),(0,b.jsx)("p",{className:"text-slate-300",children:a.body_preview})]},a.id))}):(0,b.jsx)(H,{title:"Quiet channel",message:"No announcements are queued for display right now.",checklist:["Share a principal or teacher announcement to pin school notices here."]})]})}function M({data:a}){let{insights:c}=a;return(0,b.jsxs)("section",{className:"card display-glass relative overflow-hidden rounded-2xl",children:[(0,b.jsx)("div",{className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.1),transparent_55%)]"}),(0,b.jsxs)("div",{className:"relative flex items-center gap-3 mb-4",children:[(0,b.jsx)("span",{className:"flex h-10 w-10 items-center justify-center rounded-xl shadow-md",style:{backgroundColor:"rgba(124, 58, 237, 0.2)"},children:(0,b.jsx)(q.Lightbulb,{className:"h-5 w-5 text-violet-300"})}),(0,b.jsx)("h2",{className:"sectionTitle",style:{marginBottom:0},children:c?.title||"Class insights"})]}),c?.bullets?.length?(0,b.jsx)("ul",{className:"display-section-body list-disc space-y-3 pl-6 pr-2 text-lg leading-relaxed text-slate-200",children:c.bullets.map((a,c)=>(0,b.jsx)("li",{children:a},c))}):(0,b.jsx)(H,{title:"Insights pending",message:"AI insights will appear when enough recent classroom data is available.",checklist:["Insights appear after routine and lesson activity accumulates over time."]})]})}function N(){let a=(0,e.useRouter)(),n=(0,e.useSearchParams)(),o=n.get("org"),p=n.get("class"),q=n.get("token"),x=n.get("code")?.trim().toUpperCase()||null,[y,H]=(0,c.useState)(),[N,O]=(0,c.useState)(!1),[P,Q]=(0,c.useState)(!1),[R,S]=(0,c.useState)(null),[T,U]=(0,c.useState)(null),[V,W]=(0,c.useState)(!1),[X,Y]=(0,c.useState)(null),[Z,$]=(0,c.useState)(!1),[_,aa]=(0,c.useState)(null),[ab,ac]=(0,c.useState)(null),[ad,ae]=(0,c.useState)(null),[af,ag]=(0,c.useState)(""),[ah,ai]=(0,c.useState)("grid"),[aj,ak]=(0,c.useState)(!1),[al,am]=(0,c.useState)(null),[an,ao]=(0,c.useState)(()=>Date.now()),[ap,aq]=(0,c.useState)(!0),[ar,as]=(0,c.useState)(null),[at,au]=(0,c.useState)(null),[av,aw]=(0,c.useState)(null),[ax,ay]=(0,c.useState)(!1),[az,aA]=(0,c.useState)(!1),aB=(0,c.useRef)(new Set),aC=(0,c.useRef)(!1),aD=(0,c.useRef)(!1),aE=(0,c.useMemo)(()=>(0,f.createClient)(),[]),{profile:aF,loading:aG}=(0,g.useUserProfile)(y);(0,c.useEffect)(()=>{S(null),Q(!0)},[]);let aH=o||aF?.preschoolId||aF?.organizationId||null,aI=p||null,aJ=R?.token||null,aK=!!aJ,aL=!!(o&&q),aM=!!x&&!o&&!q,aN=aK||aL||aM,aO=(0,c.useMemo)(()=>{if(!R?.expiresAt)return null;let a=new Date(R.expiresAt);return Number.isNaN(a.getTime())?null:a.toLocaleDateString("en-ZA",{year:"numeric",month:"short",day:"numeric"})},[R?.expiresAt]),aP=(0,c.useCallback)(a=>{S(null),aC.current=!1,a&&aw(a)},[]),aQ=(0,c.useCallback)(async()=>{if(aJ){W(!0),Y(null);try{let a=await fetch(`/api/display/data?pair=${encodeURIComponent(aJ)}`);if(!a.ok){let b=await a.json().catch(()=>({}));throw 403===a.status&&aP("Trusted TV pairing expired. Enter a join code to pair this screen again."),Error(b.error||`Request failed: ${a.status}`)}let b=await a.json();U(b)}catch(a){Y(a instanceof Error?a.message:"Failed to load display"),U(null)}finally{W(!1)}}},[aJ,aP]),aR=(0,c.useCallback)(async()=>{if(o&&q){W(!0),Y(null);try{let a=new URLSearchParams({org:o,token:q});p&&a.set("class",p);let b=await fetch(`/api/display/data?${a.toString()}`);if(!b.ok){let a=await b.json().catch(()=>({}));throw Error(a.error||`Request failed: ${b.status}`)}let c=await b.json();U(c)}catch(a){Y(a instanceof Error?a.message:"Failed to load display"),U(null)}finally{W(!1)}}},[o,q,p]),aS=(0,c.useCallback)(async()=>{if(x){W(!0),Y(null);try{let a=await fetch(`/api/display/data?code=${encodeURIComponent(x)}`);if(!a.ok){let b=await a.json().catch(()=>({}));throw Error(b.error||`Request failed: ${a.status}`)}let b=await a.json();U(b)}catch(a){Y(a instanceof Error?a.message:"Failed to load display"),U(null)}finally{W(!1)}}},[x]);(0,c.useEffect)(()=>{aK?aQ():aL?aR():aM&&aS()},[aK,aL,aM,aQ,aR,aS]),(0,c.useEffect)(()=>{P&&!aK&&!aC.current&&(aM||aL)&&(aC.current=!0,(async()=>{try{let b=aM?{code:x,deviceName:"TV Display"}:{org:o,token:q,class:p,deviceName:"TV Display"},c=await fetch("/api/display/pair/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});if(!c.ok)return;let d=await c.json().catch(()=>null),e=String(d?.pairToken||"").trim();if(!e)return;let f={token:e,expiresAt:d?.expiresAt||null,orgId:d?.orgId||null,classId:d?.classId||null};S(f),aw(`Trusted TV paired successfully. This screen will stay connected for ${Number(d?.expiresInDays)||180} days.`),a.replace("/display")}catch{}})())},[P,aK,aM,aL,x,o,q,p,a]),(0,c.useEffect)(()=>{if(!aN||!T)return;let a=setInterval(aK?aQ:aM?aS:aR,6e5);return()=>clearInterval(a)},[aN,aK,aM,T,aQ,aR,aS]);let{data:aT,loading:aU,error:aV,refetch:aW}=function({orgId:a,classId:b=null,enabled:d=!0}){let[e,f]=(0,c.useState)(null),[g,h]=(0,c.useState)(!0),[i,j]=(0,c.useState)(null),k=(0,c.useCallback)(async()=>{if(!a||!d){f(null),h(!1);return}h(!0),j(null);try{let c=new URLSearchParams({org:a});b&&c.set("class",b);let d=await fetch(`/api/display/preview?${c.toString()}`,{method:"GET",cache:"no-store",credentials:"include"});if(!d.ok){let a=await d.json().catch(()=>({}));throw Error(a.error||`Request failed: ${d.status}`)}let e=await d.json();f(e)}catch(a){j(a instanceof Error?a.message:"Failed to load display data"),f(null)}finally{h(!1)}},[a,b,d]);return(0,c.useEffect)(()=>{k();let a=setInterval(k,6e5);return()=>clearInterval(a)},[k]),{data:e,loading:g,error:i,refetch:k}}({orgId:aN?null:aH,classId:aI,enabled:!!aH&&!aN}),aX=aN?T:aT,aY=aN?V:aU,aZ=aN?X:aV,a$=aN?aK?aQ:aM?aS:aR:aW,a_=(0,c.useMemo)(()=>{if(!aX)return{routineBlocks:0,lessonBlocks:0,menuItems:0,announcements:0,insightBullets:0,filledSections:0};let a=aX.routine?.blocks?.length||0,b=aX.lessons?.length||0,c=(aX.menuToday?.breakfast?.length||0)+(aX.menuToday?.lunch?.length||0)+(aX.menuToday?.snack?.length||0),d=aX.announcements?.length||0,e=aX.insights?.bullets?.length||0,f=[a>0,b>0,c>0,d>0,e>0].filter(Boolean).length;return{routineBlocks:a,lessonBlocks:b,menuItems:c,announcements:d,insightBullets:e,filledSections:f}},[aX]),a0=0===a_.filledSections;(0,c.useEffect)(()=>{aX&&am(new Date)},[aX]),(0,c.useEffect)(()=>{if(!av)return;let a=window.setTimeout(()=>aw(null),5e3);return()=>window.clearTimeout(a)},[av]),(0,c.useEffect)(()=>{aN||aD.current},[aN]),(0,c.useEffect)(()=>{aN?O(!0):(async()=>{try{let{data:{session:a}}=await aE.auth.getSession();a?.user?.id&&H(a.user.id)}catch{}finally{O(!0)}})()},[aE,aN]),(0,c.useEffect)(()=>{if(aN)return void aA(!1);aA(!1);let a=window.setTimeout(()=>aA(!0),6e3);return()=>window.clearTimeout(a)},[aN]),(0,c.useEffect)(()=>{let a=setInterval(()=>ao(Date.now()),3e4);return()=>clearInterval(a)},[]);let a1=(0,c.useMemo)(()=>{if(!aX)return[];let a=[];return aX.routine?.blocks?.forEach(b=>{let c=D(aX.dateLabel,b.startTime);c&&a.push({id:`routine:${b.id}`,title:b.title||"Routine block",startsAtMs:c,source:"routine"})}),aX.lessons?.forEach(b=>{let c=new Date(b.scheduled_at).getTime();Number.isFinite(c)&&a.push({id:`lesson:${b.id}`,title:b.title||"Lesson",startsAtMs:c,source:"lesson"})}),a.sort((a,b)=>a.startsAtMs-b.startsAtMs)},[aX]),a2=(0,c.useMemo)(()=>a1.find(a=>a.startsAtMs>an)||null,[a1,an]),a3=(0,c.useMemo)(()=>a1.filter(a=>a.startsAtMs>an).slice(0,4),[a1,an]),a4=(0,c.useMemo)(()=>{if(!aX)return null;let a=(aX.routine?.blocks||[]).map(a=>{let b=D(aX.dateLabel,a.startTime),c=D(aX.dateLabel,a.endTime);return b&&c&&!(c<=b)?{id:`routine:${a.id}`,title:a.title||"Routine block",source:"routine",startMs:b,endMs:c}:null}).filter(a=>null!==a).find(a=>an>=a.startMs&&an<a.endMs);return a||(aX.lessons||[]).map(a=>{let b=new Date(a.scheduled_at).getTime();if(!Number.isFinite(b))return null;let c=Number(a.duration_minutes)||30;return{id:`lesson:${a.id}`,title:a.title||"Lesson",source:"lesson",startMs:b,endMs:b+6e4*c}}).filter(a=>null!==a).find(a=>an>=a.startMs&&an<a.endMs)||null},[aX,an]),a5=a4?Math.max(0,Math.min(100,(an-a4.startMs)/(a4.endMs-a4.startMs)*100)):0,a6=(0,c.useCallback)(()=>{as(null),au(null)},[]),a7=(0,c.useCallback)(()=>{if(!aX)return void aw("Cannot export yet. Room data is still loading.");try{let c,d;ay(!0);var a,b=(a={orgId:aH,classId:aI},{version:1,generatedAt:new Date().toISOString(),orgId:a.orgId,classId:a.classId,dayName:aX.dayName,dateLabel:aX.dateLabel,routineTitle:aX.routine?.title||aX.themeLabel||null,routineSummary:aX.routine?.summary||null,schedule:(c=[],(aX.routine?.blocks||[]).forEach(a=>{let b=a.startTime||null,d=a.endTime||null;if(!b||!d)return;let e=i(b),f=i(d);null==e||null==f||f<=e||c.push({id:`routine:${a.id}`,title:a.title||"Routine block",source:"routine",startTime:j(e),endTime:j(f),durationMinutes:Math.max(1,f-e)})}),(aX.lessons||[]).forEach(a=>{let b=function(a){let b=new Date(a);if(!Number.isFinite(b.getTime()))return null;let c=b.getHours(),d=b.getMinutes();return`${String(c).padStart(2,"0")}:${String(d).padStart(2,"0")}`}(a.scheduled_at);if(!b)return;let d=i(b);if(null==d)return;let e=Number(a.duration_minutes)||30;c.push({id:`lesson:${a.id}`,title:a.title||"Lesson",source:"lesson",startTime:j(d),endTime:j(d+e),durationMinutes:Math.max(1,e)})}),c.sort((a,b)=>(i(a.startTime)??0)-(i(b.startTime)??0))),data:aX});let e=String(b.dateLabel||"").replace(/[^0-9-]/g,"")||"today",f=`edudash-room-display-offline-${e}`;k(`${f}.html`,(d=JSON.stringify(b).replace(/</g,"\\u003c"),`<!doctype html>
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
    const PACK = ${d};
    const THRESHOLDS = ${JSON.stringify(h)};
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
</html>`),"text/html;charset=utf-8"),window.setTimeout(()=>{k(`${f}.json`,JSON.stringify(b,null,2),"application/json;charset=utf-8")},120),window.setTimeout(()=>{k(`${f}-README.txt`,`EduDash Pro - Offline TV Pack

Generated: ${b.generatedAt}
Day: ${b.dayName}, ${b.dateLabel}

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
- For live reminders/chimes, use a browser-capable TV or HDMI mini-PC.`,"text/plain;charset=utf-8")},240);let g=function(a){let{data:b}=a,c=(b.menuToday?.breakfast?.length||0)+(b.menuToday?.lunch?.length||0)+(b.menuToday?.snack?.length||0),d=[{title:"EduDash Pro Daily Room Display",subtitle:`${a.dayName}, ${a.dateLabel}`,lines:[a.routineTitle?`Theme: ${a.routineTitle}`:"Theme: Not published",`Routine blocks: ${b.routine?.blocks?.length||0}`,`Lessons: ${b.lessons?.length||0}`,`Menu items: ${c}`,`Announcements: ${b.announcements?.length||0}`,"For standard TVs, use slideshow mode (10-20 sec interval, loop on)."]}],e=(b.routine?.blocks||[]).map(a=>`${a.startTime||"--:--"}-${a.endTime||"--:--"}  ${a.title||"Routine block"}`);e.length?l(e,10).forEach((a,b)=>{d.push({title:0===b?"Today's routine":"Today's routine (cont.)",lines:a})}):d.push({title:"Today's routine",lines:["No routine blocks found for today."]});let f=(b.lessons||[]).map(a=>{let b=new Date(a.scheduled_at),c=Number.isNaN(b.getTime())?"--:--":b.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),d=Number(a.duration_minutes)||0,e=d>0?` (${d} min)`:"";return`${c}  ${a.title||"Lesson"}${e}`});f.length?l(f,10).forEach((a,b)=>{d.push({title:0===b?"Today's lessons":"Today's lessons (cont.)",lines:a})}):d.push({title:"Today's lessons",lines:["No scheduled lessons for today."]});let g=[];b.menuToday?.breakfast?.length&&g.push(`Breakfast: ${b.menuToday.breakfast.join(", ")}`),b.menuToday?.lunch?.length&&g.push(`Lunch: ${b.menuToday.lunch.join(", ")}`),b.menuToday?.snack?.length&&g.push(`Snack: ${b.menuToday.snack.join(", ")}`),d.push({title:"Today's menu",lines:g.length?g:["Menu is not published for today."]});let h=(b.announcements||[]).map(a=>{let b=m(a.body_preview||"",60);return b?`${a.title}: ${b}`:a.title});return d.push({title:"Announcements",lines:h.length?h:["No announcements queued."]}),d.push({title:"Reminder cadence",lines:["15 minutes before next block: prepare transition.","10 minutes before: start wrap-up instructions.","5 minutes before: final transition cue.","Tip: keep the TV slideshow in loop mode."]}),d}(b);g.forEach((a,c)=>{window.setTimeout(()=>{var d,e;let h,i=function(a,b,c,d){let e=document.createElement("canvas");e.width=1920,e.height=1080;let f=e.getContext("2d");if(!f)return e;let g=f.createLinearGradient(0,0,1920,1080);g.addColorStop(0,"#060915"),g.addColorStop(.55,"#0a1020"),g.addColorStop(1,"#070c17"),f.fillStyle=g,f.fillRect(0,0,1920,1080);let h=f.createRadialGradient(1632,-40,80,1632,-40,560);h.addColorStop(0,"rgba(124,58,237,0.34)"),h.addColorStop(1,"rgba(124,58,237,0)"),f.fillStyle=h,f.fillRect(0,0,1920,1080),f.fillStyle="rgba(10,20,42,0.78)",f.fillRect(80,84,1760,912),f.fillStyle="#c4b5fd",f.font='700 26px "Segoe UI", Arial, sans-serif',f.fillText("EduDash Pro • Offline TV Pack",120,138),f.fillStyle="#f8fafc",f.font='800 62px "Segoe UI", Arial, sans-serif',f.fillText(b.title,120,232),b.subtitle&&(f.fillStyle="#cbd5e1",f.font='500 34px "Segoe UI", Arial, sans-serif',f.fillText(b.subtitle,120,284));let i=360;return b.lines.forEach(a=>{(function(a,b=78){let c=m(a,3*b);if(!c)return[];let d=c.split(" "),e=[],f="";return d.forEach(a=>{let c=f?`${f} ${a}`:a;if(c.length<=b){f=c;return}f&&e.push(f),f=a.length<=b?a:`${a.slice(0,b-1)}…`}),f&&e.push(f),e.slice(0,2)})(a,82).forEach((a,b)=>{i>920||(0===b&&(f.fillStyle="#8b5cf6",f.beginPath(),f.arc(130,i-12,6,0,2*Math.PI),f.fill()),f.fillStyle="#e2e8f0",f.font=0===b?'600 36px "Segoe UI", Arial, sans-serif':'500 31px "Segoe UI", Arial, sans-serif',f.fillText(a,0===b?150:178,i),i+=0===b?56:46)})}),f.fillStyle="#94a3b8",f.font='500 26px "Segoe UI", Arial, sans-serif',f.fillText(`Generated ${new Date(a.generatedAt).toLocaleString()}`,120,1002),f.fillText(`Slide ${c+1}/${d}`,1660,1002),e}(b,a,c,g.length);d=`${f}-slide-${String(c+1).padStart(2,"0")}.png`,e=i.toDataURL("image/png"),(h=document.createElement("a")).href=e,h.download=d,document.body.appendChild(h),h.click(),h.remove()},360+140*c)}),aw("Offline TV Pack downloaded: HTML + JSON + README.")}catch(a){aw(a instanceof Error?a.message:"Failed to export Offline TV Pack.")}finally{window.setTimeout(()=>ay(!1),500)}},[aI,aX,aH]),a8=a2?Math.max(0,Math.ceil((a2.startsAtMs-an)/6e4)):null;(0,c.useEffect)(()=>{if(!a2)return;let a=a2.startsAtMs-an;if(a<=0||a>9e5)return;let b=A.find(b=>a<=6e4*b&&a>(b-1)*6e4);if(!b)return;let c=`${a2.id}:${b}`;if(aB.current.has(c))return;aB.current.add(c);let d=`${b}-minute reminder • ${a2.title}`;as(d),au({threshold:b,title:a2.title});let e=window.setTimeout(()=>{as(a=>a===d?null:a),au(a=>a?.title===a2.title&&a?.threshold===b?null:a)},9e3);return()=>{window.clearTimeout(e)}},[a2,an,ap]),(0,c.useEffect)(()=>{if(!at)return;let a=a=>{("Escape"===a.key||"Enter"===a.key||" "===a.key)&&(a.preventDefault(),a6())};return window.addEventListener("keydown",a),()=>{window.removeEventListener("keydown",a)}},[at,a6]);let[a9,ba]=(0,c.useState)(0),bb=(0,c.useMemo)(()=>{if(!aX)return z;let a=[];return(aX.routine?.blocks?.length||aX.themeLabel)&&a.push("routine"),aX.lessons?.length&&a.push("lessons"),E(aX)&&a.push("menu"),aX.announcements?.length&&a.push("announcements"),aX.insights?.bullets?.length&&a.push("insights"),a.length?a:z},[aX]),bc=bb.length>1,bd=!aN&&("grid"===ah||a0),be=bc&&!bd&&(aN||aj);(0,c.useEffect)(()=>{if(!be)return;let a=setInterval(()=>{ba(a=>(a+1)%Math.max(1,bb.length))},45e3);return()=>clearInterval(a)},[be,bb.length]),(0,c.useEffect)(()=>{ba(a=>a>=bb.length?0:a)},[bb.length]);let bf=bb[a9]??bb[0]??"routine",bg=(0,c.useCallback)(a=>aX?"routine"===a?(0,b.jsx)(I,{data:aX,nowMs:an}):"lessons"===a?(0,b.jsx)(J,{data:aX}):"menu"===a?(0,b.jsx)(K,{data:aX}):"announcements"===a?(0,b.jsx)(L,{data:aX}):(0,b.jsx)(M,{data:aX}):null,[aX,an]);return P&&(aN||az||N&&(!y||!aG)||aH)?aN||!N||aG||aH||y?aY&&!aX?(0,b.jsx)("div",{className:"flex min-h-screen items-center justify-center",children:(0,b.jsx)("p",{className:"text-xl",style:{color:"var(--muted)"},children:"Loading display…"})}):aZ?(0,b.jsxs)("div",{className:"flex min-h-screen flex-col items-center justify-center gap-6 p-8",children:[(0,b.jsx)("p",{className:"text-xl",style:{color:"var(--danger)"},children:aZ}),(0,b.jsx)("button",{type:"button",onClick:()=>a$(),className:"rounded-xl px-6 py-3 font-medium text-white transition-colors hover:opacity-90",style:{background:"var(--primary)"},children:"Retry"})]}):aX?(0,b.jsxs)("div",{className:`display-root relative min-h-screen overflow-x-hidden overflow-y-auto ${aN?"tv-mode":""}`,children:[at&&(0,b.jsx)("div",{className:"fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-slate-950/55 backdrop-blur-sm threshold-overlay-backdrop",onClick:a6,children:(0,b.jsxs)("div",{className:"threshold-overlay-content rounded-3xl border border-amber-300/40 bg-gradient-to-br from-amber-300/15 to-rose-300/10 px-8 py-7 text-center shadow-[0_24px_80px_-28px_rgba(245,158,11,0.55)]",onClick:a=>a.stopPropagation(),children:[(0,b.jsx)("p",{className:"text-xs font-semibold uppercase tracking-[0.28em] text-amber-100",children:"Reminder Alert"}),(0,b.jsxs)("p",{className:"mt-2 text-5xl font-black text-white",children:[at.threshold," min"]}),(0,b.jsx)("p",{className:"mt-3 text-lg font-semibold text-amber-100",children:at.title}),(0,b.jsx)("p",{className:"mt-1 text-xs text-slate-200",children:"Prepare transition now."}),(0,b.jsx)("button",{type:"button",onClick:a6,className:"mt-4 rounded-lg border border-amber-200/45 bg-amber-100/15 px-4 py-2 text-xs font-semibold text-amber-50",children:"Dismiss"}),(0,b.jsx)("p",{className:"mt-2 text-[11px] text-amber-100/80",children:"Tap outside, press Enter, or Esc to close."})]})}),(0,b.jsxs)("div",{className:"display-container",children:[av&&(0,b.jsx)("div",{className:"card display-glass mb-4 rounded-2xl border-fuchsia-300/30 bg-fuchsia-500/10 px-4 py-3 text-sm font-semibold text-fuchsia-100 backdrop-blur-md",children:av}),ar&&(0,b.jsx)("div",{className:"card display-glass mb-4 rounded-2xl border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 backdrop-blur-md",children:ar}),(0,b.jsxs)("header",{className:"card display-glass-header display-header-shell mb-8 flex flex-wrap items-start justify-between gap-6 rounded-2xl",children:[(0,b.jsxs)("div",{className:"display-header-brand min-w-0",children:[(0,b.jsx)("span",{className:"inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-widest",style:{borderColor:"rgba(139,92,246,0.4)",background:"var(--primary-subtle)",color:"#ddd6fe"},children:"Next-Gen UI"}),(0,b.jsxs)("h1",{className:"display-title mt-3 flex items-center gap-3 font-bold tracking-tight",style:{color:"var(--text-primary)"},children:[(0,b.jsx)(d.default,{src:"/icon-192.png",alt:"EduDash Pro",width:40,height:40,className:"h-9 w-9 shrink-0 rounded-xl object-contain md:h-10 md:w-10"}),"EduDash Pro – Room Display"]}),(0,b.jsxs)("p",{className:"display-date mt-2",style:{color:"var(--text-secondary)"},children:[aX.dayName,", ",aX.dateLabel]}),(0,b.jsxs)("div",{className:"display-header-meta-row mt-3",children:[(0,b.jsx)("span",{className:"display-meta-pill",children:aN?"Live TV mode":"Desktop preview"}),al?(0,b.jsxs)("span",{className:"display-meta-pill",children:["Updated ",al.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})]}):null,aK?(0,b.jsxs)("span",{className:"display-meta-pill display-meta-pill-accent",children:["Trusted TV paired",aO?` • Expires ${aO}`:""]}):null]})]}),(0,b.jsxs)("div",{className:"display-header-right flex w-full min-w-0 flex-col items-stretch gap-2 md:w-auto md:max-w-[460px] md:items-end",children:[(0,b.jsxs)("div",{className:"card display-glass display-reminder-card w-full rounded-2xl",children:[(0,b.jsxs)("div",{className:"mb-2 flex items-center justify-between gap-3",children:[(0,b.jsx)("p",{className:"text-xs font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Upcoming reminder"}),(0,b.jsxs)("button",{type:"button",onClick:()=>aq(a=>!a),className:`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${ap?"border-[var(--primary)]/50":"border-slate-600/50"}`,style:{background:ap?"var(--primary-subtle)":"rgba(15,23,42,0.72)",color:"var(--text-secondary)"},children:[ap?(0,b.jsx)(t.Volume2,{className:"h-3.5 w-3.5"}):(0,b.jsx)(u.VolumeX,{className:"h-3.5 w-3.5"}),ap?"Sound on":"Sound off"]})]}),a2?(0,b.jsxs)(b.Fragment,{children:[(0,b.jsxs)("p",{className:"text-base font-semibold",style:{color:"var(--text-primary)"},children:[(0,b.jsx)(s.BellRing,{className:"mr-1 inline h-4 w-4",style:{color:"var(--primary)"}}),a2.title]}),(0,b.jsxs)("p",{className:"mt-1 text-xs",style:{color:"var(--text-secondary)"},children:["Starts at ",C(a2.startsAtMs)," • in ",a8," min (",a2.source,")"]}),(0,b.jsx)("div",{className:"mt-2 flex flex-wrap gap-1.5",children:A.map(a=>{let c=a2.startsAtMs-an<=6e4*a;return(0,b.jsxs)("span",{className:"rounded-full px-2.5 py-1 text-[11px] font-semibold",style:{background:c?"rgba(124,58,237,0.22)":"rgba(15,23,42,0.42)",color:c?"#ede9fe":"#94a3b8",border:"1px solid rgba(148, 163, 184, 0.24)"},children:[a,"m"]},a)})})]}):(0,b.jsx)("p",{className:"text-xs",style:{color:"var(--text-secondary)"},children:"No upcoming lessons or routine blocks found for reminder alerts."})]}),y&&!aN&&(0,b.jsxs)(b.Fragment,{children:[(0,b.jsxs)("div",{className:"grid w-full grid-cols-1 gap-2 sm:grid-cols-2",children:[(0,b.jsx)("button",{type:"button",onClick:async()=>{aa(null),$(!1),ac(null),ae(null);try{let a=await fetch("/api/display/link");if(!a.ok){let b=await a.json().catch(()=>({}));throw Error(b.error||"Failed to get link")}let{url:b,joinCode:c}=await a.json();ac(b),c&&ae(c),"undefined"!=typeof navigator&&navigator.clipboard?.writeText&&(await navigator.clipboard.writeText(c?`${c} (or open: ${b})`:b),$(!0),setTimeout(()=>$(!1),3e3))}catch(a){aa(a instanceof Error?a.message:"Failed")}},className:"rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90",style:{background:Z?"var(--success)":"var(--primary)"},children:Z?"Copied! Open on TV":"Get TV link"}),(0,b.jsxs)("button",{type:"button",onClick:a7,disabled:ax,className:"inline-flex items-center justify-center gap-1.5 rounded-xl border border-fuchsia-200/35 bg-fuchsia-500/14 px-4 py-2.5 text-sm font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-500/22 disabled:opacity-70",children:[(0,b.jsx)(v,{className:"h-4 w-4"}),ax?"Exporting...":"Export USB Pack"]})]}),ad&&(0,b.jsxs)("p",{className:"text-sm",style:{color:"var(--text-secondary)"},children:["Join code:"," ",(0,b.jsx)("span",{className:"select-all font-mono text-lg font-bold tracking-widest",style:{color:"var(--primary)"},children:ad}),(0,b.jsx)("span",{className:"ml-1 text-xs",style:{color:"var(--muted)"},children:"(type on TV)"})]}),ab&&(0,b.jsxs)("p",{className:"max-w-xs break-all text-xs",style:{color:"var(--muted)"},children:["Or open:"," ",(0,b.jsx)("span",{className:"select-all font-mono",style:{color:"var(--cyan)"},children:ab})]}),_&&(0,b.jsx)("p",{className:"text-xs",style:{color:"var(--danger)"},children:_}),(0,b.jsxs)("div",{className:"mt-1 flex w-full flex-wrap justify-start gap-2 md:justify-end",children:[(0,b.jsx)("button",{type:"button",onClick:()=>ai(a=>"focus"===a?"grid":"focus"),className:"grid"===ah?G:F,children:"focus"===ah?"Grid preview":"Focus preview"}),(0,b.jsx)("button",{type:"button",onClick:()=>ak(a=>!a),className:aj?G:F,children:aj?"Auto-rotate on":"Auto-rotate off"})]}),(0,b.jsx)("p",{className:"text-right text-[11px]",style:{color:"var(--muted)"},children:"Preview mode only. TV mode stays optimized for fullscreen playback."})]})]}),bc&&!bd&&(0,b.jsx)("div",{className:"flex w-full flex-wrap items-center gap-2",children:bb.map((a,c)=>(0,b.jsx)("button",{type:"button",onClick:()=>ba(c),className:bf===a?`${G} px-4 py-2 text-sm`:`${F} px-4 py-2 text-sm`,children:B[a]},a))})]}),(0,b.jsxs)("div",{className:"section display-overview-section",children:[(0,b.jsx)("div",{className:"sectionTitle display-section-heading",children:"Overview"}),(0,b.jsxs)("div",{className:"display-stats-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6",children:[(0,b.jsxs)("div",{className:`card tile display-glass-tile col-span-2 sm:col-span-3 lg:col-span-2 min-w-0 rounded-2xl ${a4?"current-block-live":""}`,children:[(0,b.jsx)("p",{className:"text-[11px] uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Routine blocks"}),(0,b.jsx)("p",{className:"display-stat-number mt-1 text-2xl font-black",style:{color:"var(--text-primary)"},children:a_.routineBlocks}),(0,b.jsxs)("div",{className:"mt-4 space-y-3",children:[(0,b.jsx)("p",{className:"text-[11px] font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Current block now"}),a4?(0,b.jsxs)(b.Fragment,{children:[(0,b.jsxs)("p",{className:"text-lg font-semibold",style:{color:"var(--text-primary)"},children:[a4.title,(0,b.jsx)("span",{className:"ml-2 text-xs uppercase tracking-wider",style:{color:"#c4b5fd"},children:a4.source})]}),(0,b.jsx)("div",{className:"h-2 w-full overflow-hidden rounded-full bg-slate-800/80",children:(0,b.jsx)("div",{className:"current-block-progress h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 transition-all",style:{width:`${a5}%`}})}),(0,b.jsxs)("p",{className:"text-xs",style:{color:"var(--text-secondary)"},children:[C(a4.startMs)," - ",C(a4.endMs)," • ",Math.max(0,Math.ceil((a4.endMs-an)/6e4))," min left"]})]}):(0,b.jsx)("p",{className:"text-base font-semibold",style:{color:"var(--text-primary)"},children:"No active block right now."}),a2&&(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)("p",{className:"text-[11px] font-semibold uppercase tracking-wider pt-1",style:{color:"var(--text-secondary)"},children:"Routine"}),(0,b.jsx)("p",{className:"text-sm font-semibold",style:{color:"var(--text-primary)"},children:a2.title}),(0,b.jsxs)("p",{className:"text-xs",style:{color:"var(--text-secondary)"},children:[C(a2.startsAtMs)," • in ",a8," min (",a2.source,")"]})]})]})]}),(0,b.jsxs)("div",{className:"card tile display-glass-tile rounded-2xl",children:[(0,b.jsx)("p",{className:"text-[11px] uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Lessons"}),(0,b.jsx)("p",{className:"display-stat-number mt-1 text-2xl font-black",style:{color:"var(--text-primary)"},children:a_.lessonBlocks})]}),(0,b.jsxs)("div",{className:"card tile display-glass-tile rounded-2xl",children:[(0,b.jsx)("p",{className:"text-[11px] uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Menu items"}),(0,b.jsx)("p",{className:"display-stat-number mt-1 text-2xl font-black",style:{color:"var(--text-primary)"},children:a_.menuItems})]}),(0,b.jsxs)("div",{className:"card tile display-glass-tile rounded-2xl",children:[(0,b.jsx)("p",{className:"text-[11px] uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Announcements"}),(0,b.jsx)("p",{className:"display-stat-number mt-1 text-2xl font-black",style:{color:"var(--text-primary)"},children:a_.announcements})]}),(0,b.jsxs)("div",{className:"card tile display-glass-tile rounded-2xl",children:[(0,b.jsx)("p",{className:"text-[11px] uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Display state"}),(0,b.jsx)("p",{className:"mt-1 text-base font-semibold",style:{color:"var(--text-primary)"},children:a0?"Setup needed":`${a_.filledSections}/5 live`})]})]})]}),a3.length>0&&(0,b.jsxs)("div",{className:"section",children:[(0,b.jsx)("div",{className:"sectionTitle display-section-heading",children:"Upcoming"}),(0,b.jsx)("div",{className:"card grid gap-3 md:grid-cols-4",children:a3.map(a=>{let c=Math.max(0,Math.ceil((a.startsAtMs-an)/6e4));return(0,b.jsxs)("div",{className:"rounded-lg border border-slate-600/40 bg-slate-800/40 px-4 py-3",children:[(0,b.jsx)("p",{className:"text-xs uppercase tracking-wider",style:{color:"var(--muted)"},children:a.source}),(0,b.jsx)("p",{className:"mt-1 text-sm font-semibold",style:{color:"var(--text-primary)"},children:a.title}),(0,b.jsxs)("p",{className:"mt-1 text-xs",style:{color:"var(--text-secondary)"},children:[C(a.startsAtMs)," • in ",c," min"]})]},a.id)})})]}),a0&&!aN&&(0,b.jsx)("div",{className:"section",children:(0,b.jsxs)("div",{className:"card grid gap-3 md:grid-cols-[1.7fr_1fr]",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"text-xs font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"Setup checklist"}),(0,b.jsx)("p",{className:"mt-2 text-lg font-semibold",style:{color:"var(--text-primary)"},children:"Room Display is connected, but today has no published classroom content yet."}),(0,b.jsxs)("ul",{className:"mt-3 grid gap-2 text-sm",style:{color:"var(--text-secondary)"},children:[(0,b.jsxs)("li",{className:"flex items-start gap-2",children:[(0,b.jsx)(w.CheckCircle2,{className:"mt-0.5 h-4 w-4 shrink-0",style:{color:"var(--primary)"}}),"Save and share today's routine to teachers."]}),(0,b.jsxs)("li",{className:"flex items-start gap-2",children:[(0,b.jsx)(w.CheckCircle2,{className:"mt-0.5 h-4 w-4 shrink-0",style:{color:"var(--primary)"}}),"Schedule at least one lesson block with start time."]}),(0,b.jsxs)("li",{className:"flex items-start gap-2",children:[(0,b.jsx)(w.CheckCircle2,{className:"mt-0.5 h-4 w-4 shrink-0",style:{color:"var(--primary)"}}),"Publish menu/announcements to enrich the wall display."]})]})]}),(0,b.jsxs)("div",{className:"rounded-lg border border-slate-600/50 bg-slate-800/40 p-5",children:[(0,b.jsx)("p",{className:"text-sm font-semibold",style:{color:"var(--text-primary)"},children:"Offline fallback ready"}),(0,b.jsx)("p",{className:"mt-1 text-xs",style:{color:"var(--text-secondary)"},children:"You can still export an Offline TV Pack now and copy it to USB for standalone playback."}),(0,b.jsxs)("button",{type:"button",onClick:a7,disabled:ax,className:"mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-70",style:{borderColor:"rgba(236,72,153,0.4)",background:"var(--primary-subtle)",color:"var(--text-primary)"},children:[(0,b.jsx)(v,{className:"h-3.5 w-3.5"}),ax?"Exporting...":"Export USB Pack"]})]})]})}),(0,b.jsx)("div",{className:`dashboardSections mx-auto ${bd?"max-w-7xl":"max-w-5xl"}`,children:bd?(0,b.jsxs)("div",{className:"section grid gap-4 xl:grid-cols-2 xl:grid-rows-1",children:[(0,b.jsx)("div",{className:"min-h-0 xl:row-span-1",children:bg("routine")}),(0,b.jsxs)("div",{className:"flex flex-col gap-6 min-h-0",children:[bg("lessons"),bg("menu"),bg("announcements"),bg("insights")]})]}):bc?(0,b.jsx)("div",{className:"section min-h-[min(68vh,720px)]",children:bg(bf)}):(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)("div",{className:"section",children:bg("routine")}),(0,b.jsx)("div",{className:"section",children:bg("lessons")}),(0,b.jsx)("div",{className:"section",children:bg("menu")}),(0,b.jsx)("div",{className:"section",children:bg("announcements")}),(0,b.jsx)("div",{className:"section",children:bg("insights")})]})}),(0,b.jsxs)("footer",{className:"mt-8 text-center text-sm",style:{color:"var(--muted)"},children:[aN?"Data refreshes every 10 minutes. ":"Preview updates with your live dashboard data. ","15/10/5 reminder pattern is active for upcoming routine and lesson starts. Use fullscreen (F11) for TV."]})]})]}):(0,b.jsx)("div",{className:"flex min-h-screen items-center justify-center",children:(0,b.jsx)("p",{className:"text-xl",style:{color:"var(--muted)"},children:"No data for this organisation."})}):(0,b.jsx)("div",{className:"flex min-h-screen flex-col items-center justify-center p-6 sm:p-8",children:(0,b.jsxs)("div",{className:"w-full max-w-lg rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl",style:{background:"linear-gradient(145deg, var(--surface-1) 0%, var(--surface-2) 50%, var(--card) 100%)",border:"1px solid var(--border)",boxShadow:"0 0 0 1px rgba(255,255,255,0.05), 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 80px -20px var(--primary-subtle)"},children:[(0,b.jsx)("div",{className:"mb-6 flex justify-center",children:(0,b.jsx)("div",{className:"flex h-14 w-14 items-center justify-center rounded-2xl text-2xl",style:{background:"var(--primary-subtle)",color:"var(--primary)"},children:(0,b.jsx)(r.Clock,{className:"h-8 w-8"})})}),(0,b.jsx)("h1",{className:"text-center text-2xl font-bold tracking-tight sm:text-3xl",style:{color:"var(--text-primary)"},children:"Room Display"}),(0,b.jsx)("p",{className:"mt-2 text-center text-sm",style:{color:"var(--muted)"},children:"Show routine, lessons, menu and announcements on a TV. This page does not auto-refresh."}),(0,b.jsxs)("div",{className:"mt-8 rounded-2xl p-5",style:{background:"rgba(0,0,0,0.2)",border:"1px solid var(--border)"},children:[(0,b.jsx)("h2",{className:"text-sm font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"How to get the link on the TV"}),(0,b.jsxs)("ol",{className:"mt-4 space-y-3 text-[var(--text-secondary)]",children:[(0,b.jsxs)("li",{className:"flex gap-3",children:[(0,b.jsx)("span",{className:"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",style:{background:"var(--primary)",color:"white"},children:"1"}),"On your phone or laptop, ",(0,b.jsx)("strong",{style:{color:"var(--text-primary)"},children:"sign in"})," to EduDash Pro."]}),(0,b.jsxs)("li",{className:"flex gap-3",children:[(0,b.jsx)("span",{className:"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",style:{background:"var(--primary)",color:"white"},children:"2"}),"Open ",(0,b.jsx)("strong",{style:{color:"var(--text-primary)"},children:"Dashboard"})," and tap or click ",(0,b.jsx)("strong",{style:{color:"var(--primary)"},children:'"Get TV link"'}),"."]}),(0,b.jsxs)("li",{className:"flex gap-3",children:[(0,b.jsx)("span",{className:"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",style:{background:"var(--primary)",color:"white"},children:"3"}),"Copy the link, then on the ",(0,b.jsx)("strong",{style:{color:"var(--text-primary)"},children:"TV browser"})," open that link. No sign-in needed on the TV."]})]})]}),(0,b.jsxs)("p",{className:"mt-4 text-center text-xs",style:{color:"var(--muted)"},children:["Or on the TV, add ",(0,b.jsx)("code",{className:"rounded px-1.5 py-0.5",style:{background:"var(--surface-2)"},children:"?org=...&token=..."})," to the URL (get the full link from a signed-in device)."]}),(0,b.jsxs)("div",{className:"mt-6 rounded-2xl p-5",style:{background:"rgba(0,0,0,0.2)",border:"1px solid var(--border)"},children:[(0,b.jsx)("h2",{className:"text-sm font-semibold uppercase tracking-wider",style:{color:"var(--text-secondary)"},children:"On the TV: enter join code"}),(0,b.jsx)("p",{className:"mt-1 text-xs",style:{color:"var(--muted)"},children:"Open this page on the TV, then type the 6-character code from your phone or laptop."}),(0,b.jsx)("p",{className:"mt-1 text-xs",style:{color:"var(--muted)"},children:"After first pairing, this TV stays trusted for months and reconnects automatically."}),(0,b.jsxs)("div",{className:"mt-4 flex gap-2",children:[(0,b.jsx)("input",{type:"text",inputMode:"text",maxLength:8,placeholder:"e.g. ABC123",value:af,onChange:a=>ag(a.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"")),className:"flex-1 rounded-xl border px-4 py-3 text-center text-lg font-mono font-bold tracking-widest",style:{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text-primary)"}}),(0,b.jsx)("button",{type:"button",onClick:()=>{let b=af.trim().toUpperCase();b.length>=4&&a.push(`/display?code=${encodeURIComponent(b)}`)},className:"shrink-0 rounded-xl px-6 py-3 text-base font-semibold text-white",style:{background:"var(--primary)"},children:"Go"})]})]}),(0,b.jsx)("div",{className:"mt-8 flex justify-center",children:(0,b.jsx)("button",{type:"button",onClick:()=>a.push("/sign-in"),className:"rounded-xl px-8 py-3.5 text-base font-semibold text-white transition-all hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]",style:{background:"var(--primary)",boxShadow:"0 4px 14px 0 rgba(124, 58, 237, 0.4)"},children:"Sign in to get TV link"})})]})}):(0,b.jsx)("div",{className:"flex min-h-screen items-center justify-center",children:(0,b.jsx)("p",{className:"text-xl",style:{color:"var(--muted)"},children:"Preparing display…"})})}function O(){return(0,b.jsx)(c.Suspense,{fallback:(0,b.jsx)("div",{className:"flex min-h-screen items-center justify-center",children:(0,b.jsx)("p",{className:"text-xl",style:{color:"var(--muted)"},children:"Loading display…"})}),children:(0,b.jsx)(N,{})})}a.s(["default",()=>O],944571)}];

//# sourceMappingURL=web_src_app_display_page_tsx_e9b1291b._.js.map