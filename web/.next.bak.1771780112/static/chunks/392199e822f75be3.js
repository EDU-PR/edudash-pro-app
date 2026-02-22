(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,18259,e=>{"use strict";var a=e.i(950382),t=e.i(414294),i=e.i(430878),s=e.i(707387),r=e.i(499913),n=e.i(266514);let o=(0,e.i(292511).default)("database",[["ellipse",{cx:"12",cy:"5",rx:"9",ry:"3",key:"msslwz"}],["path",{d:"M3 5V19A9 3 0 0 0 21 19V5",key:"1wlel7"}],["path",{d:"M3 12A9 3 0 0 0 21 12",key:"mv7ke4"}]]);var l=e.i(461957),c=e.i(185877),d=e.i(192258),u=e.i(155373),g=e.i(793925),m=e.i(530043),h=e.i(619668),p=e.i(235775);let f=new Set(["true","1","yes","y","on","enabled"]),y=new Set(["false","0","no","n","off","disabled"]),x=e=>{if("string"!=typeof e)return;let a=e.trim().toLowerCase();return!!f.has(a)||!y.has(a)&&void 0};function v({scope:e,inline:f=!0,initialPrompt:y,displayMessage:v,fullscreen:b=!1,language:S="en-ZA",enableInteractive:A=!1,conversationId:w,userId:j,onClose:k}){let[C,N]=(0,i.useState)(f),[L,T]=(0,i.useState)(""),[I,E]=(0,i.useState)([]),[P,R]=(0,i.useState)(!1),[F,_]=(0,i.useState)(!1),[D,G]=(0,i.useState)(!1),[W,z]=(0,i.useState)(null),[H,$]=(0,i.useState)(null),q=(0,i.useRef)(null),O=(0,i.useRef)(!1),B=(0,i.useRef)(null),{messages:M,saveMessages:U}=function(e){let a=(0,d.createClient)(),[t,s]=(0,i.useState)([]),[r,n]=(0,i.useState)(!0),[o,l]=(0,i.useState)(null);(0,i.useEffect)(()=>{e?(async()=>{try{let{data:t,error:i}=await a.from("ai_conversations").select("messages, title").eq("conversation_id",e).single();i&&"PGRST116"!==i.code&&(console.error("[useAIConversation] Load error:",i),l(i.message)),t?.messages&&s(t.messages)}catch(e){console.error("[useAIConversation] Exception:",e),l(e instanceof Error?e.message:"Failed to load conversation")}finally{n(!1)}})():n(!1)},[e]);let c=async()=>{if(!e)return!1;try{let{error:t}=await a.from("ai_conversations").delete().eq("conversation_id",e);if(t)return console.error("[useAIConversation] Delete error:",t),!1;return s([]),!0}catch(e){return console.error("[useAIConversation] Exception:",e),!1}};return{messages:t,setMessages:s,saveMessages:async(t,i)=>{if(!e)return console.warn("[useAIConversation] No conversationId provided, cannot save"),!1;try{let{data:s}=await a.auth.getSession();if(!s.session)return console.error("[useAIConversation] Not authenticated"),!1;let{data:r}=await a.from("profiles").select("id, preschool_id").eq("id",s.session.user.id).single(),{error:n}=await a.from("ai_conversations").upsert({conversation_id:e,user_id:s.session.user.id,preschool_id:r?.preschool_id||null,title:i||"Untitled Conversation",messages:t,updated_at:new Date().toISOString()},{onConflict:"conversation_id"});if(n)return console.error("[useAIConversation] Save error:",n),l(n.message),!1;return!0}catch(e){return console.error("[useAIConversation] Exception:",e),l(e instanceof Error?e.message:"Failed to save conversation"),!1}},deleteConversation:c,loading:r,error:o}}(w||null),{saveExamGeneration:Y}=(0,p.useExamSession)(null);(0,i.useEffect)(()=>{q.current&&(q.current.scrollTop=q.current.scrollHeight)},[I]),(0,i.useEffect)(()=>{!y||D||(G(!0),T(function(e){if(!e)return"";let a=e.split("\n").filter(e=>{let a=e.trim();return!(a.startsWith("You are Dash,")||a.includes("**IMPORTANT:")||a.includes("Generate ALL content")||a.startsWith("**Your Task:**")||a.startsWith("**Conversation Flow:**")||a.startsWith("**Important Guidelines:**")||a.startsWith("**CAPS Curriculum Focus:**")||a.startsWith("**AGE-APPROPRIATE INSTRUCTION VERBS")||a.startsWith("**WRONG - Too vague")||a.startsWith("**CORRECT - Clear teacher")||a.startsWith("**PEDAGOGICAL FRAMEWORK")||a.startsWith("**Student Context:**")||a.startsWith("**Age-Appropriate Instructions:**")||a.startsWith("Let's start:"))}).join("\n").trim();for(let e of["Generate an interactive","Generate comprehensive revision notes","Generate a 7-day intensive study","Generate 30 flashcards","Generate"]){let t=a.indexOf(e);if(-1!==t){a=a.substring(t);break}}return a}(y)))},[y,D]);let X=async()=>{let t=L.trim();if(!t||P)return;let i=t.includes("Generate")||t.includes("generate")?function(e,a="English (South Africa)"){return e?`You are Dash, a South African education assistant specializing in CAPS curriculum.

**IMPORTANT: Generate ALL content in ${a}. Use ONLY this language throughout the entire document. Do NOT switch languages.**

`+e:""}(t,S):t;E(e=>[...e,{role:"user",text:t}]),T(""),R(!0),A&&(_(!0),B.current=new AbortController);let s=(0,d.createClient)();try{if(!(()=>{for(let e of["true",a.default.env.EXPO_PUBLIC_AI_PROXY_ENABLED]){let a=x(e);if(!0===a)return!0;if(!1===a)continue}return!1})()){E(e=>[...e,{role:"assistant",text:"⚠️ Dash AI is not enabled."}]),R(!1),_(!1);return}let{data:r}=await s.auth.getSession(),n=r.session?.access_token,o=I.map(e=>({role:"tool"===e.role?"assistant":e.role,content:e.text})),{data:l,error:c}=await s.functions.invoke("ai-proxy",{options:A?{signal:B.current?.signal}:void 0,body:{scope:e,service_type:"homework_help",enable_tools:!0,prefer_openai:!0,payload:{prompt:i,context:A?"caps_exam_preparation":"general_question",conversationHistory:o.length>0?o:void 0},metadata:{role:e,source:A?"exam_generator":"dashboard",language:S||"en-ZA",enableInteractive:A}},headers:n?{Authorization:`Bearer ${n}`}:void 0});if(c)throw console.error("[DashAI] Send Error:",c),c;if(A&&!O.current){if(l?.tool_results&&Array.isArray(l.tool_results))for(let e of l.tool_results)try{let a=e?.content??e?.output??e;if("string"==typeof a&&(a.startsWith("Error:")||!1===a.startsWith("{"))){console.error("[DashAI] Tool execution failed:",a),E(e=>[...e,{role:"assistant",text:`❌ Exam generation failed: ${a}

Please try again with different parameters.`}]);continue}let i="string"==typeof a?JSON.parse(a):a;if(i.success&&i.data?.sections){O.current=!0;try{let e=await Y(i.data,t,i.data.title||"Generated Exam",i.data.grade,i.data.subject);$(e)}catch(e){console.error("[DashAI] Failed to save exam:",e)}z(i.data),R(!1),_(!1),B.current=null;return}if(i.sections){O.current=!0;try{let e=await Y(i,t,i.title||"Generated Exam",i.grade,i.subject);$(e)}catch(e){console.error("[DashAI] Failed to save exam:",e)}z(i),R(!1),_(!1),B.current=null;return}}catch(a){console.error("[DashAI] Failed to parse tool result:",a),E(a=>[...a,{role:"assistant",text:`❌ Failed to process exam generation result. The AI may have returned an error:

${e.content}

Please try again.`}])}let e=l?.content||l?.error?.message||"";if(e){let a=(0,m.parseExamMarkdown)(e);if(a){O.current=!0;try{let e=await Y(a,t,a.title,a.grade,a.subject);$(e)}catch(e){console.error("[DashAI] Failed to save exam:",e)}z(a),R(!1),_(!1),B.current=null;return}}}if(l?.tool_results&&Array.isArray(l.tool_results)&&l.tool_results.length>0){let e,a=l?.tool_use?.[0]||l.tool_results[0],t=l.tool_results[0]?.content??l.tool_results[0]?.output;if("string"==typeof t)if(t.startsWith("Error:")||!1===t.startsWith("{"))e={error:t};else try{e=JSON.parse(t)}catch(a){console.error("[DashAI] Failed to parse tool result as JSON:",a),e={error:t}}else e=t;E(t=>[...t,{role:"tool",text:`🔧 ${a?.name||"tool"}`,tool:{name:a?.name,input:a?.input,results:e}}])}let d=l?.content||l?.error?.message||"No response from AI";E(e=>[...e,{role:"assistant",text:d}])}catch(t){console.error("[DashAI] Error:",t);let e=t?.message||"Unknown error",a="";a=e.toLowerCase().includes("429")||e.toLowerCase().includes("rate limit")||e.toLowerCase().includes("too many requests")?`⏳ **AI Service is Busy**

The AI service is experiencing high demand right now. This happens when many users are generating content at the same time.

**What you can do:**
1. Wait 2-3 minutes and try again
2. Try during off-peak hours for faster response
3. Contact support if this persists

Your request is safe and hasn't been lost.`:e.toLowerCase().includes("timeout")?`⏱️ **Request Timeout**

The request took too long to complete. Try:
1. Using a shorter or simpler prompt
2. Reducing the number of images (if any)
3. Breaking your request into smaller parts`:`❌ **Error:** ${e}

Please check the browser console for details.`,E(e=>[...e,{role:"assistant",text:a}])}finally{R(!1),_(!1),B.current=null}},Z=()=>{B.current&&(B.current.abort(),B.current=null),_(!1),R(!1),O.current=!1,E(e=>[...e,{role:"assistant",text:"?? Exam generation cancelled. You can try again with different parameters."}])};return((0,i.useEffect)(()=>()=>{B.current&&(B.current.abort(),B.current=null),_(!1)},[]),b)?W?(0,t.jsxs)("div",{className:"app",style:{height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden"},children:[(0,t.jsx)("div",{className:"topbar",style:{flexShrink:0},children:(0,t.jsx)("div",{className:"topbarEdge",children:(0,t.jsxs)("div",{className:"topbarRow",children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:12},children:[(0,t.jsx)("div",{style:{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",display:"flex",alignItems:"center",justifyContent:"center"},children:(0,t.jsx)(c.Sparkles,{className:"icon20",style:{color:"white"}})}),(0,t.jsxs)("div",{children:[(0,t.jsx)("div",{style:{fontWeight:700,fontSize:16},children:"Dash AI"}),(0,t.jsx)("div",{style:{fontSize:12,color:"var(--muted)"},children:W.title||v||"Interactive Exam"})]})]}),(0,t.jsx)("button",{onClick:()=>z(null),"aria-label":"Close",className:"w-11 h-11 flex items-center justify-center rounded-full bg-white/90 border border-black/20 shadow backdrop-blur-sm text-slate-900 dark:bg-slate-700 dark:text-white dark:border-white/20 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500",children:(0,t.jsx)(s.X,{className:"w-5 h-5",strokeWidth:2.5})})]})})}),(0,t.jsx)("div",{style:{flex:1,overflow:"auto"},children:(0,t.jsx)(h.ExamInteractiveView,{exam:W,generationId:H,userId:j,onClose:()=>z(null)})})]}):(0,t.jsxs)("div",{className:"app",style:{height:"100%"},children:[(0,t.jsx)("div",{className:"topbar",children:(0,t.jsx)("div",{className:"topbarEdge",children:(0,t.jsxs)("div",{className:"topbarRow",children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:12},children:[(0,t.jsx)("div",{style:{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",display:"flex",alignItems:"center",justifyContent:"center"},children:(0,t.jsx)(c.Sparkles,{className:"icon20",style:{color:"white"}})}),(0,t.jsxs)("div",{children:[(0,t.jsx)("div",{style:{fontWeight:700,fontSize:16},children:"Dash AI"}),(0,t.jsx)("div",{style:{fontSize:12,color:"var(--muted)"},children:v||"AI-Powered Exam Help"})]})]}),k&&(0,t.jsx)("button",{className:"iconBtn",onClick:()=>{N(!1),k?.()},"aria-label":"Close",children:(0,t.jsx)(s.X,{className:"icon16"})})]})})}),(0,t.jsx)("div",{className:"content",ref:q,style:{flex:1,paddingBottom:"calc(80px + var(--space-4))",paddingTop:"var(--space-4)"},children:(0,t.jsxs)("div",{className:"container",style:{maxWidth:900},children:[0===I.length&&(0,t.jsxs)("div",{className:"card",style:{textAlign:"center",padding:"var(--space-6)",marginTop:"var(--space-6)"},children:[(0,t.jsx)(n.Bot,{style:{width:48,height:48,margin:"0 auto var(--space-4)",color:"var(--primary)"}}),(0,t.jsx)("div",{style:{fontWeight:700,fontSize:18,marginBottom:8},children:"Ask Dash AI Anything"}),(0,t.jsx)("div",{className:"muted",style:{fontSize:14},children:"CAPS-aligned help • Exam prep • Practice tests • 24/7 support"})]}),(0,t.jsxs)("div",{style:{display:"flex",flexDirection:"column",gap:"var(--space-4)"},children:[I.map((e,a)=>(0,t.jsx)("div",{style:{display:"flex",justifyContent:"user"===e.role?"flex-end":"flex-start"},children:"tool"===e.role?(0,t.jsxs)("div",{className:"card",style:{maxWidth:"85%",background:"rgba(59, 130, 246, 0.1)",borderColor:"rgba(59, 130, 246, 0.3)",display:"flex",alignItems:"center",gap:12},children:[(0,t.jsx)(o,{className:"icon16",style:{color:"#60a5fa",flexShrink:0}}),(0,t.jsx)("span",{style:{fontSize:13,color:"#93c5fd",fontWeight:600},children:e.text}),e.tool?.results?.row_count!==void 0&&(0,t.jsxs)("span",{className:"badge",style:{marginLeft:"auto"},children:[e.tool.results.row_count," results"]})]}):(0,t.jsx)("div",{className:"card",style:{maxWidth:"85%",background:"user"===e.role?"linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)":"var(--surface-2)",borderColor:"user"===e.role?"transparent":"var(--border)",color:"user"===e.role?"white":"var(--text)"},children:"assistant"===e.role?(0,t.jsx)("div",{className:"markdown-content",style:{lineHeight:1.7},children:(0,t.jsx)(u.default,{remarkPlugins:[g.default],children:e.text})}):(0,t.jsx)("div",{style:{lineHeight:1.6},children:e.text})})},a)),P&&(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:12,color:"var(--muted)"},children:[(0,t.jsx)(l.Loader2,{className:"icon16",style:{animation:"spin 1s linear infinite"}}),(0,t.jsx)("span",{style:{fontSize:13},children:"Dash AI is thinking..."})]})]})]})}),(0,t.jsx)("div",{style:{position:"fixed",bottom:0,left:0,right:0,borderTop:"1px solid var(--border)",background:"var(--surface)",padding:"var(--space-4)",zIndex:10},children:(0,t.jsxs)("div",{className:"container",style:{maxWidth:900,display:"flex",gap:"var(--space-3)"},children:[(0,t.jsx)("input",{className:"input",value:L,onChange:e=>T(e.target.value),onKeyDown:e=>"Enter"===e.key&&!e.shiftKey&&(e.preventDefault(),X()),placeholder:"Ask about exams, subjects, practice tests...",disabled:P,style:{flex:1}}),(0,t.jsxs)("button",{className:"btn btnPrimary",onClick:X,disabled:P||!L.trim(),style:{minWidth:100},children:[(0,t.jsx)(r.Send,{className:"icon16"}),"Send"]})]})})]}):f?(0,t.jsx)("div",{className:"section",children:(0,t.jsxs)("div",{className:"card",style:{padding:0},children:[(0,t.jsxs)("div",{className:"titleRow",style:{padding:"var(--space-4)",marginBottom:0},children:[(0,t.jsxs)("div",{className:"sectionTitle",style:{marginBottom:0,display:"flex",alignItems:"center",gap:10},children:[(0,t.jsx)(c.Sparkles,{className:"icon16",style:{color:"var(--primary)"}}),"Dash AI"]}),(0,t.jsx)("button",{className:"btn",onClick:()=>N(!C),style:{height:32},children:C?"Hide":"Show"})]}),C&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("div",{ref:q,style:{maxHeight:400,overflowY:"auto",padding:"var(--space-4)",display:"flex",flexDirection:"column",gap:"var(--space-4)"},children:[0===I.length&&(0,t.jsx)("div",{style:{textAlign:"center",color:"var(--muted)",fontSize:13},children:"Ask about your dashboard, child progress, or exam prep"}),I.map((e,a)=>(0,t.jsx)("div",{style:{display:"flex",justifyContent:"user"===e.role?"flex-end":"flex-start"},children:(0,t.jsx)("div",{style:{maxWidth:"80%",padding:"var(--space-3)",borderRadius:12,background:"user"===e.role?"linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)":"var(--surface-2)",border:"user"===e.role?"none":"1px solid var(--border)",color:"user"===e.role?"white":"var(--text)",fontSize:14,lineHeight:1.6},children:e.text})},a)),P&&!F&&(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:10,color:"var(--muted)"},children:[(0,t.jsx)(l.Loader2,{className:"icon16",style:{animation:"spin 1s linear infinite"}}),(0,t.jsx)("span",{style:{fontSize:13},children:"Processing..."})]})]}),F&&(0,t.jsx)("div",{style:{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0, 0, 0, 0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,borderRadius:"var(--radius-2)"},children:(0,t.jsxs)("div",{className:"card loading-overlay",style:{position:"relative",borderRadius:"var(--radius-2)"},children:[(0,t.jsx)("button",{className:"close-button loading",onClick:Z,"aria-label":"Cancel exam generation",title:"Cancel and return to chat",style:{position:"absolute",top:12,right:12},children:(0,t.jsx)(s.X,{size:20,strokeWidth:2.5})}),(0,t.jsx)("div",{className:"loading-spinner",style:{width:40,height:40,border:"4px solid var(--border)",borderTop:"4px solid var(--primary)",borderRadius:"50%",animation:"spin 1s linear infinite"}}),(0,t.jsx)("div",{style:{textAlign:"center",fontSize:16,fontWeight:600},children:"Generating Exam"}),(0,t.jsx)("div",{style:{textAlign:"center",fontSize:13,color:"var(--muted)"},children:"Dash is creating your CAPS-aligned exam. This may take a few seconds..."})]})}),(0,t.jsxs)("div",{style:{padding:"var(--space-4)",borderTop:"1px solid var(--border)",display:"flex",gap:10},children:[(0,t.jsx)("input",{className:"input",value:L,onChange:e=>T(e.target.value),onKeyDown:e=>"Enter"===e.key&&!e.shiftKey&&(e.preventDefault(),X()),placeholder:"Ask a question...",disabled:P,style:{flex:1}}),(0,t.jsx)("button",{className:"btn btnPrimary",onClick:X,disabled:P||!L.trim(),children:(0,t.jsx)(r.Send,{className:"icon16"})})]})]})]})}):C?(0,t.jsxs)("div",{className:"card",style:{position:"fixed",bottom:24,right:24,zIndex:50,width:380,maxWidth:"90vw",height:520,maxHeight:"80vh",display:"flex",flexDirection:"column",padding:0,boxShadow:"0 12px 40px rgba(0, 0, 0, 0.4)"},children:[(0,t.jsxs)("div",{style:{padding:"var(--space-3)",borderBottom:"1px solid var(--border)",background:"linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",borderRadius:"var(--radius-2) var(--radius-2) 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:10},children:[(0,t.jsx)(c.Sparkles,{className:"icon16",style:{color:"white"}}),(0,t.jsx)("span",{style:{fontWeight:700,fontSize:14,color:"white"},children:"Dash AI"})]}),(0,t.jsx)("button",{onClick:()=>N(!1),"aria-label":"Close",className:"w-11 h-11 flex items-center justify-center rounded-full bg-white/90 border border-black/20 shadow text-slate-900 dark:bg-slate-700 dark:text-white dark:border-white/30 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500",children:(0,t.jsx)(s.X,{className:"w-4 h-4"})})]}),(0,t.jsxs)("div",{ref:q,style:{flex:1,overflowY:"auto",padding:"var(--space-3)",display:"flex",flexDirection:"column",gap:"var(--space-3)"},children:[0===I.length&&(0,t.jsx)("div",{style:{textAlign:"center",color:"var(--muted)",marginTop:"var(--space-4)",fontSize:13},children:"Ask about exams, practice tests, or any CAPS subject"}),I.map((e,a)=>(0,t.jsx)("div",{style:{display:"flex",justifyContent:"user"===e.role?"flex-end":"flex-start"},children:"tool"===e.role?(0,t.jsxs)("div",{style:{padding:10,borderRadius:10,background:"rgba(59, 130, 246, 0.1)",border:"1px solid rgba(59, 130, 246, 0.3)",display:"flex",alignItems:"center",gap:8,fontSize:12},children:[(0,t.jsx)(o,{className:"icon16",style:{color:"#60a5fa"}}),(0,t.jsx)("span",{style:{color:"#93c5fd"},children:e.text})]}):(0,t.jsx)("div",{style:{maxWidth:"85%",padding:12,borderRadius:16,background:"user"===e.role?"linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)":"var(--surface-2)",border:"user"===e.role?"none":"1px solid var(--border)",color:"user"===e.role?"white":"var(--text)",fontSize:13,lineHeight:1.6},children:e.text})},a)),P&&!F&&(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:8,color:"var(--muted)",fontSize:12},children:[(0,t.jsx)(l.Loader2,{className:"icon16",style:{animation:"spin 1s linear infinite"}}),(0,t.jsx)("span",{children:"Thinking..."})]})]}),F&&(0,t.jsx)("div",{style:{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0, 0, 0, 0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,borderRadius:"var(--radius-2)"},children:(0,t.jsxs)("div",{className:"card loading-overlay",style:{position:"relative",borderRadius:"var(--radius-2)"},children:[(0,t.jsx)("button",{onClick:Z,"aria-label":"Cancel exam generation",title:"Cancel and return to chat",className:"absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full bg-red-600 text-white border border-red-700 shadow transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400",children:(0,t.jsx)(s.X,{className:"w-5 h-5",strokeWidth:2.5})}),(0,t.jsx)("div",{className:"loading-spinner",style:{width:40,height:40,border:"4px solid var(--border)",borderTop:"4px solid var(--primary)",borderRadius:"50%",animation:"spin 1s linear infinite"}}),(0,t.jsx)("div",{style:{textAlign:"center",fontSize:16,fontWeight:600},children:"Generating Exam"}),(0,t.jsx)("div",{style:{textAlign:"center",fontSize:13,color:"var(--muted)"},children:"Dash is creating your CAPS-aligned exam. This may take a few seconds..."})]})}),(0,t.jsxs)("div",{style:{padding:"var(--space-3)",borderTop:"1px solid var(--border)",display:"flex",gap:8},children:[(0,t.jsx)("input",{className:"input",value:L,onChange:e=>T(e.target.value),onKeyDown:e=>"Enter"===e.key&&!e.shiftKey&&(e.preventDefault(),X()),placeholder:"Type your question...",disabled:P,style:{flex:1,height:36,fontSize:13}}),(0,t.jsx)("button",{className:"btn btnPrimary",onClick:X,disabled:P||!L.trim(),style:{width:36,height:36,padding:0},children:(0,t.jsx)(r.Send,{className:"icon16"})})]})]}):(0,t.jsxs)("button",{className:"btn btnPrimary",onClick:()=>N(!0),"aria-label":"Ask Dash AI",style:{position:"fixed",bottom:24,right:24,zIndex:50,borderRadius:"999px",height:56,paddingLeft:20,paddingRight:20,boxShadow:"0 8px 30px rgba(124, 58, 237, 0.4)"},children:[(0,t.jsx)(n.Bot,{className:"icon20"}),(0,t.jsx)("span",{children:"Ask Dash"})]})}e.s(["AskAIWidget",()=>v],18259)},671406,e=>{"use strict";var a=e.i(414294),t=e.i(430878),i=e.i(353913),s=e.i(217632),r=e.i(54671),n=e.i(571684),o=e.i(377206),l=e.i(185877),c=e.i(423025),d=e.i(574462),u=e.i(484923),g=e.i(573434),m=e.i(667249),h=e.i(839451),p=e.i(159914),f=e.i(437622),y=e.i(192258);let x={"en-ZA":"English (South Africa)","af-ZA":"Afrikaans","zu-ZA":"isiZulu","xh-ZA":"isiXhosa","nso-ZA":"Sepedi (Northern Sotho)"},v=[{value:"grade_r",label:"Grade R",age:"5-6"},{value:"grade_1",label:"Grade 1",age:"6-7"},{value:"grade_2",label:"Grade 2",age:"7-8"},{value:"grade_3",label:"Grade 3",age:"8-9"},{value:"grade_4",label:"Grade 4",age:"9-10"},{value:"grade_5",label:"Grade 5",age:"10-11"},{value:"grade_6",label:"Grade 6",age:"11-12"},{value:"grade_7",label:"Grade 7",age:"12-13"},{value:"grade_8",label:"Grade 8",age:"13-14"},{value:"grade_9",label:"Grade 9",age:"14-15"},{value:"grade_10",label:"Grade 10",age:"15-16"},{value:"grade_11",label:"Grade 11",age:"16-17"},{value:"grade_12",label:"Grade 12 (Matric)",age:"17-18"}],b={foundation:["English Home Language","English First Additional Language","Afrikaans Home Language","Afrikaans First Additional Language","isiZulu Home Language","isiZulu First Additional Language","isiXhosa Home Language","isiXhosa First Additional Language","Sepedi Home Language","Sepedi First Additional Language","Setswana Home Language","Setswana First Additional Language","Sesotho Home Language","Sesotho First Additional Language","Xitsonga Home Language","Xitsonga First Additional Language","Siswati Home Language","Siswati First Additional Language","Tshivenda Home Language","Tshivenda First Additional Language","isiNdebele Home Language","isiNdebele First Additional Language","Mathematics","Life Skills"],intermediate:["English Home Language","English First Additional Language","Afrikaans Home Language","Afrikaans First Additional Language","isiZulu Home Language","isiZulu First Additional Language","isiXhosa Home Language","isiXhosa First Additional Language","Sepedi Home Language","Sepedi First Additional Language","Setswana Home Language","Setswana First Additional Language","Sesotho Home Language","Sesotho First Additional Language","Xitsonga Home Language","Xitsonga First Additional Language","Siswati Home Language","Siswati First Additional Language","Tshivenda Home Language","Tshivenda First Additional Language","isiNdebele Home Language","isiNdebele First Additional Language","Mathematics","Natural Sciences & Technology","History","Geography","Life Skills"],senior:["English Home Language","English First Additional Language","Afrikaans Home Language","Afrikaans First Additional Language","isiZulu Home Language","isiZulu First Additional Language","isiXhosa Home Language","isiXhosa First Additional Language","Sepedi Home Language","Sepedi First Additional Language","Setswana Home Language","Setswana First Additional Language","Sesotho Home Language","Sesotho First Additional Language","Xitsonga Home Language","Xitsonga First Additional Language","Siswati Home Language","Siswati First Additional Language","Tshivenda Home Language","Tshivenda First Additional Language","isiNdebele Home Language","isiNdebele First Additional Language","Mathematics","Natural Sciences","History","Geography","Technology","Economic & Management Sciences","Life Orientation","Creative Arts"],fet:["English Home Language","English First Additional Language","Afrikaans Home Language","Afrikaans First Additional Language","isiZulu Home Language","isiZulu First Additional Language","isiXhosa Home Language","isiXhosa First Additional Language","Sepedi Home Language","Sepedi First Additional Language","Setswana Home Language","Setswana First Additional Language","Sesotho Home Language","Sesotho First Additional Language","Xitsonga Home Language","Xitsonga First Additional Language","Siswati Home Language","Siswati First Additional Language","Tshivenda Home Language","Tshivenda First Additional Language","isiNdebele Home Language","isiNdebele First Additional Language","Mathematics","Mathematical Literacy","Life Sciences","Physical Sciences","Accounting","Business Studies","Economics","Geography","History","Life Orientation","Agricultural Sciences","Agricultural Technology","Civil Technology","Computer Applications Technology","Consumer Studies","Dance Studies","Design","Dramatic Arts","Electrical Technology","Engineering Graphics & Design","Hospitality Studies","Information Technology","Mechanical Technology","Music","Tourism","Visual Arts"]},S=[{id:"practice_test",label:"Practice Test",description:"Full exam paper with memo",icon:r.FileText,color:"primary",duration:"60-120 min"},{id:"revision_notes",label:"Revision Notes",description:"Topic summaries & key points",icon:s.BookOpen,color:"accent",duration:"30 min read"},{id:"study_guide",label:"Study Guide",description:"Week-long study schedule",icon:o.Target,color:"warning",duration:"7-day plan"},{id:"flashcards",label:"Flashcards",description:"Quick recall questions",icon:n.Brain,color:"danger",duration:"15 min"}],A={grade_r:{duration:"20 minutes",marks:10,questionTypes:"Picture identification, matching, coloring, simple counting",vocabulary:"Basic colors, shapes, numbers 1-5, simple animals",instructions:"Use LOTS of visual cues, emojis, and simple one-word answers. NO writing required. Focus on recognition and matching.",calculator:!1,decimals:!1},grade_1:{duration:"30 minutes",marks:20,questionTypes:"Fill-in-the-blank with word bank, matching pictures to words, simple multiple choice (2-3 options), basic counting",vocabulary:"Simple everyday words, numbers 1-10, basic family/animals/food vocabulary",instructions:"Keep sentences SHORT (3-5 words max). Provide word banks for fill-in-blanks. Use pictures wherever possible. For First Additional Language: assume BEGINNER level.",calculator:!1,decimals:!1},grade_2:{duration:"45 minutes",marks:30,questionTypes:"Short answer (1-2 sentences), fill-in-blanks, multiple choice (3-4 options), simple problem solving",vocabulary:"Expanded vocabulary, numbers 1-20, basic sentence construction",instructions:"Simple paragraph reading (3-4 sentences). Basic grammar concepts. For Additional Language: elementary conversational level.",calculator:!1,decimals:!1},grade_3:{duration:"60 minutes",marks:40,questionTypes:"Short paragraphs, multiple choice, true/false, matching, basic problem solving",vocabulary:"Age-appropriate vocabulary, numbers 1-100, basic fractions (half, quarter)",instructions:"Reading comprehension with short stories (1 paragraph). Introduction to simple essays (3-4 sentences). Basic calculator use for checking only.",calculator:!1,decimals:!1},grade_4:{duration:"90 minutes",marks:50,questionTypes:"Paragraphs, essays (5-7 sentences), multiple choice, problem solving, data interpretation",vocabulary:"Grade-appropriate vocabulary, decimals to 1 place, basic fractions",instructions:"Reading passages (2-3 paragraphs). Essay writing with structure. Basic calculator allowed.",calculator:!0,decimals:!0},grade_5:{duration:"90 minutes",marks:60,questionTypes:"Extended paragraphs, structured essays, complex problem solving, comprehension",vocabulary:"Intermediate vocabulary, decimals to 2 places, common fractions",instructions:"Multi-paragraph reading. Structured essays with introduction and conclusion. Calculator allowed.",calculator:!0,decimals:!0},grade_6:{duration:"90 minutes",marks:75,questionTypes:"Essays with clear structure, data analysis, multi-step problem solving",vocabulary:"Advanced intermediate vocabulary, percentages, ratios, algebraic thinking",instructions:"Complex reading comprehension. Essay writing with planning. Calculator allowed except for mental math sections.",calculator:!0,decimals:!0},grade_7:{duration:"2 hours",marks:75,questionTypes:"Analytical essays, data interpretation, multi-step problems, reasoning",vocabulary:"Grade 7 curriculum vocabulary, algebraic expressions, geometry",instructions:"Extended reading passages. Structured analytical writing. Scientific calculator allowed.",calculator:!0,decimals:!0},grade_8:{duration:"2 hours",marks:100,questionTypes:"Analytical and creative writing, complex problem solving, research-based questions",vocabulary:"Grade 8 curriculum, algebra, functions, advanced grammar",instructions:"Critical thinking required. Extended essays with evidence. Scientific calculator allowed.",calculator:!0,decimals:!0},grade_9:{duration:"2 hours",marks:100,questionTypes:"Critical analysis, extended essays, complex calculations, abstract reasoning",vocabulary:"Grade 9 curriculum, quadratics, trigonometry basics, formal language",instructions:"FET Phase preparation. Formal academic writing. Scientific calculator required.",calculator:!0,decimals:!0},grade_10:{duration:"2.5 hours",marks:100,questionTypes:"FET formal exam format, extended responses, proofs, investigations",vocabulary:"Grade 10 curriculum, advanced algebra, trigonometry, analytical writing",instructions:"NSC preparation format. Extended essay responses. Scientific calculator required.",calculator:!0,decimals:!0},grade_11:{duration:"3 hours",marks:150,questionTypes:"NSC format, research essays, complex multi-step problems, investigations",vocabulary:"Grade 11 curriculum, calculus introduction, advanced topics",instructions:"Full NSC exam format. University preparation. Scientific calculator required.",calculator:!0,decimals:!0},grade_12:{duration:"3 hours",marks:150,questionTypes:"Full NSC Matric format, research essays, proofs, investigations, applications",vocabulary:"Grade 12 curriculum, calculus, statistics, formal academic language",instructions:"Official NSC Matric format. University-level expectations. Scientific calculator required.",calculator:!0,decimals:!0}};function w({onAskDashAI:e,guestMode:s=!1,userId:r}){let n=(0,i.useRouter)(),{checkQuota:o,incrementUsage:w}=(0,p.useQuotaCheck)(r),j=(0,y.createClient)(),[k,C]=(0,t.useState)("grade_9"),[N,L]=(0,t.useState)("Mathematics"),[T,I]=(0,t.useState)("practice_test"),[E,P]=(0,t.useState)("en-ZA"),[R,F]=(0,t.useState)(""),[_,D]=(0,t.useState)(!1),[G,W]=(0,t.useState)(!1),[z,H]=(0,t.useState)(!1),[$,q]=(0,t.useState)(null),[O,B]=(0,t.useState)(""),[M,U]=(0,t.useState)(""),[Y,X]=(0,t.useState)("free"),[Z,K]=(0,t.useState)("");if((0,t.useEffect)(()=>{(async()=>{if(!r)return;let{data:{user:e}}=await j.auth.getUser();e&&(B(e.email||""),U(e.user_metadata?.full_name||""));let{data:a}=await j.from("user_ai_tiers").select("tier").eq("user_id",r).single();a&&X(a.tier||"free")})()},[r,j]),G)return(0,a.jsx)(h.ConversationalExamBuilder,{grade:k,subject:N,onClose:()=>W(!1),onSave:e=>{W(!1)}});let Q="grade_r"===k||"grade_1"===k||"grade_2"===k||"grade_3"===k?"foundation":"grade_4"===k||"grade_5"===k||"grade_6"===k?"intermediate":"grade_7"===k||"grade_8"===k||"grade_9"===k?"senior":"fet",V=b[Q],J=v.find(e=>e.value===k),ee=S.find(e=>e.id===T),ea=async()=>{if(!e)return;if(r&&!s){let e=await o("exam_generation");if(e&&!e.allowed){q({currentUsage:0===e.remaining?e.limit:e.limit-e.remaining,currentLimit:e.limit}),H(!0);return}}if(s){let e="EDUDASH_EXAM_PREP_FREE_USED",a=new Date().toDateString();if(localStorage.getItem(e)===a)return void n.push("/sign-in?message=Sign in to continue generating exams");localStorage.setItem(e,a)}let a="",t=x[E],i=A[k];N.includes("Additional"),"practice_test"===T?(a=`You are Dash, a South African CAPS curriculum expert helping a ${J?.label} student prepare for a ${N} exam in ${t}.

**Student Context:**
- Grade: ${J?.label} (Ages ${J?.age})
- Subject: ${N}
- Language: ${t} (${E})
- Duration: ${i.duration}
- Total marks: ${i.marks}

**Your Task:**
Have a brief conversation to understand what the student needs, THEN generate a CAPS-aligned practice test directly in markdown format.

**Conversation Flow:**
1. First, greet warmly and ask what specific topics they'd like to focus on
2. If they're unsure, suggest 2-3 main topics from the CAPS curriculum
3. Ask about difficulty preference (easier warm-up, standard, or challenging)
4. AFTER understanding their needs, generate the exam directly in markdown with proper sections and questions

**Important Guidelines:**
- Be conversational and helpful, not robotic
- Understand context from their short answers ("Yes", "Algebra", "harder", etc.)
- You have access to CAPS curriculum tools: use 'get_curriculum_for_topic' or 'search_caps_curriculum' if you need official CAPS content
- Once you have enough info (and retrieved any needed CAPS content), generate the exam immediately in markdown
- The exam MUST be in ${t} - every question, instruction, and memo
- Format the exam with clear sections (## SECTION A, ## SECTION B, etc.)
- Include a MARKING MEMORANDUM at the end

**CAPS Curriculum Focus:**
${i.questionTypes}

**CRITICAL CAPS ALIGNMENT REQUIREMENTS:**
You MUST ensure all educational content strictly follows the South African CAPS curriculum for Grade ${J?.label}:

1. **Curriculum Accuracy**: All topics, learning objectives, and assessment standards MUST align with the official CAPS document for ${N} Grade ${J?.label}
2. **Content Appropriateness**: Questions must match the cognitive demand level specified in CAPS for this grade
3. **Local Context**: Use South African examples, contexts, and scenarios (ZAR currency, local geography, culturally relevant situations)
4. **Assessment Standards**: Follow CAPS assessment guidelines for question distribution, mark allocation, and difficulty progression
5. **Topic Coverage**: Only include topics that are in the CAPS curriculum for this specific grade and term
6. **Language Policy**: Adhere to CAPS language policy - use ${t} consistently throughout

**Before generating content, verify:**
- The topics you choose are in the official CAPS curriculum for Grade ${J?.label} ${N}
- The difficulty level matches CAPS cognitive levels for this grade
- Your question types align with CAPS assessment requirements
- All contexts and examples are South African and age-appropriate

**Age-Appropriate Instructions:**
${i.instructions}

Let's start: Say hello and ask what specific topics they'd like to practice for their ${N} exam.`,J?.age,i.duration,i.marks,i.questionTypes,i.vocabulary,i.instructions,i.calculator,i.decimals,J?.label,J?.label,J?.age,i.duration,i.marks,J?.label,J?.label,J?.label,new Date().getFullYear(),"foundation"===Q||(i.calculator,i.decimals),i.duration,i.marks,i.questionTypes.includes("word bank"),J?.label,J?.age,i.marks,i.marks,J?.label,J?.age,new Date().getFullYear(),J?.label):"revision_notes"===T?(a=`You are Dash, a South African education assistant specializing in CAPS curriculum.

**IMPORTANT: Generate ALL content in ${t} (${E}). Use ONLY this language throughout the entire document. Do NOT switch languages.**

Generate comprehensive revision notes for ${J?.label} ${N} aligned to CAPS Term 4 assessment topics.

**Requirements:**
- Grade: ${J?.label}
- Subject: ${N}
- Format: Structured revision guide with clear headings
- Include: Key concepts, formulas, definitions, examples, diagrams (described in text)
- Use South African context and terminology
- Highlight exam-critical content

**Output Structure:**

# ${J?.label} ${N} Revision Notes
## CAPS Term 4 Focus Areas

### Topic 1: [Main Topic Name]
**Key Concepts:**
- [Concept 1 with clear explanation]
- [Concept 2 with clear explanation]

**Important Formulas/Rules:**
- [Formula 1 with when to use it]
- [Formula 2 with when to use it]

**Worked Example:**
[Step-by-step example problem with solution]

**Common Exam Questions:**
- [Type of question students should expect]
- [How to approach it]

**Memory Tips:**
- [Mnemonics or shortcuts]

---

[Continue for all major topics...]

---

## Quick Reference Summary
[One-page summary of all key formulas, definitions, and concepts]

## Exam Preparation Checklist
- [ ] Understand all key concepts
- [ ] Memorize essential formulas
- [ ] Practice worked examples
- [ ] Complete past papers
- [ ] Review common mistakes

---

? ${new Date().getFullYear()} EduDash Pro ? CAPS-Aligned Revision Resources`,J?.label):"study_guide"===T?(a=`You are Dash, a South African education assistant specializing in CAPS curriculum.

**IMPORTANT: Generate ALL content in ${t} (${E}). Use ONLY this language throughout the entire study guide. Do NOT switch languages.**

Generate a 7-day intensive study schedule for ${J?.label} ${N} exam preparation aligned to CAPS curriculum.

**Requirements:**
- Grade: ${J?.label}
- Subject: ${N}
- Timeline: 7 days leading up to exam
- Include: Daily topics, practice exercises, review sessions, rest periods
- Realistic time allocations
- South African school context (?? daily homework, other subjects)

**Output Structure:**

# 7-Day Study Plan: ${J?.label} ${N}
## CAPS-Aligned Exam Preparation Schedule

**Exam Date:** [One week from today]  
**Daily Commitment:** 60-90 minutes  
**Total Topics:** [Number based on CAPS curriculum]

---

## Day 1 (Monday): [Main Topic]
? **Time:** 75 minutes  
?? **Focus:** [Specific CAPS topic]

**Morning Session (40 min):**
- [ ] Review notes: [Specific subtopic 1]
- [ ] Review notes: [Specific subtopic 2]
- [ ] Watch/read: [Resource suggestion]

**Afternoon Session (35 min):**
- [ ] Practice: 5 questions on [topic]
- [ ] Self-assess using memo
- [ ] Identify weak areas

**Evening Quick Review (10 min):**
- [ ] Flashcards: Key formulas/concepts
- [ ] Tomorrow's preview: [Next topic]

**Progress Check:**
- Can you explain [concept] to someone else?
- Can you solve [problem type] without notes?

---

[Continue for Days 2-6...]

---

## Day 7 (Sunday): Final Review & Rest
? **Time:** 45 minutes + rest  
?? **Focus:** Consolidation & confidence building

**Morning (45 min):**
- [ ] Quick revision: All key formulas
- [ ] Skim through all notes (don't study deeply)
- [ ] Review common mistakes list
- [ ] Practice 3 easy warm-up questions

**Afternoon:**
- ?? NO HEAVY STUDYING
- ? Light review of one-page summary
- ? Pack exam materials (calculator, pens, ID)
- ? Prepare healthy snacks for exam day
- ? Set 2 alarms for exam morning

**Evening:**
- ?? Early bedtime (8-9 hours sleep)
- ?? No screens 1 hour before bed
- ?? Relaxation or light exercise

---

## Study Tips for Success

**Before You Start:**
- Gather all materials (textbook, notes, calculator)
- Find quiet study space
- Tell family your study schedule
- Prepare healthy snacks

**During Study Sessions:**
- Use Pomodoro technique (25 min study, 5 min break)
- Practice active recall (close book, try to remember)
- Explain concepts out loud
- Make notes of what you don't understand

**Self-Care Reminders:**
- ?? Drink water regularly
- ?? Eat brain-healthy foods
- ?? Get 8 hours sleep each night
- ?? Take movement breaks
- ?? Don't cram the night before

---

## Parent Support Guide

**How to Help:**
- Provide quiet study environment
- Ensure regular meals and snacks
- Check daily progress (not pressuring)
- Offer encouragement, not criticism
- Help with practice testing (read questions)

**Warning Signs to Watch:**
- Excessive stress or anxiety
- Sleeping too little
- Skipping meals
- Isolation from family

**When to Seek Help:**
- If student is completely stuck on topic
- If panic/anxiety is overwhelming
- If additional tutoring might help

---

? ${new Date().getFullYear()} EduDash Pro ? CAPS-Aligned Study Resources`,J?.label):"flashcards"===T&&(a=`You are Dash, a South African education assistant specializing in CAPS curriculum.

**IMPORTANT: Generate ALL content in ${t} (${E}). Use ONLY this language for all flashcard content. Do NOT switch languages.**

Generate 30 flashcards for ${J?.label} ${N} covering essential exam concepts aligned to CAPS curriculum.

**Requirements:**
- Grade: ${J?.label}
- Subject: ${N}
- Format: Question on front, detailed answer on back
- Cover: Definitions, formulas, problem-solving strategies, key facts
- Difficulty: Mix of easy recall and challenging application

**Output Structure:**

# ${J?.label} ${N} Flashcards
## CAPS Exam Essentials

---

### Flashcard 1
**FRONT (Question):**
[Clear, concise question or prompt]

**BACK (Answer):**
[Detailed answer with explanation]
[Example if applicable]
[Common mistake to avoid]

---

### Flashcard 2
**FRONT (Question):**
[Clear, concise question or prompt]

**BACK (Answer):**
[Detailed answer with explanation]

---

[Continue for 30 flashcards covering all major topics...]

---

## How to Use These Flashcards

**Study Methods:**
1. **Spaced Repetition:** Review cards you got wrong more frequently
2. **Active Recall:** Try to answer before flipping
3. **Teach Someone:** Explain the answer out loud
4. **Mix Order:** Don't memorize sequence, shuffle daily
5. **Practice Application:** Don't just memorize, understand why

**Daily Routine:**
- Morning: 10 new cards
- Afternoon: Review all cards once
- Evening: Focus on difficult cards

**Mastery Levels:**
- ? Got it right immediately ? Review in 3 days
- ?? Got it right after thinking ? Review tomorrow
- ? Got it wrong ? Review today + tomorrow

---

? ${new Date().getFullYear()} EduDash Pro ? CAPS-Aligned Study Resources`,J?.label),K(a),D(!0),r&&!s&&w("exam_generation","success").catch(e=>{console.error("[ExamPrep] Failed to increment usage:",e)})},et=()=>{D(!1),K("")};return(0,a.jsxs)(a.Fragment,{children:[_&&(0,a.jsx)("div",{style:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0, 0, 0, 0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1e3,padding:"var(--space-4)"},children:(0,a.jsxs)("div",{className:"card",style:{maxWidth:700,width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column",padding:0},children:[(0,a.jsxs)("div",{style:{padding:"var(--space-4)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,a.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"var(--space-2)"},children:[(0,a.jsx)(l.Sparkles,{className:"icon20",style:{color:"var(--primary)"}}),(0,a.jsx)("span",{style:{fontWeight:700,fontSize:16},children:"Review & Customize Prompt"})]}),(0,a.jsx)("button",{onClick:et,className:"iconBtn","aria-label":"Close",children:(0,a.jsx)("span",{style:{fontSize:20},children:"×"})})]}),(0,a.jsxs)("div",{style:{padding:"var(--space-4)",flex:1,overflowY:"auto"},children:[(0,a.jsxs)("div",{style:{marginBottom:"var(--space-3)"},children:[(0,a.jsx)("div",{style:{fontWeight:600,marginBottom:"var(--space-2)",fontSize:14},children:"Selected Configuration:"}),(0,a.jsxs)("div",{style:{display:"flex",flexWrap:"wrap",gap:"var(--space-2)"},children:[(0,a.jsx)("span",{className:"badge",style:{background:"var(--primary)",color:"#fff"},children:J?.label}),(0,a.jsx)("span",{className:"badge",style:{background:"var(--accent)",color:"#fff"},children:N}),(0,a.jsx)("span",{className:"badge",style:{background:"var(--warning)",color:"#fff"},children:S.find(e=>e.id===T)?.label}),(0,a.jsx)("span",{className:"badge",style:{background:"var(--danger)",color:"#fff"},children:x[E]})]})]}),(0,a.jsxs)("div",{style:{marginBottom:"var(--space-3)"},children:[(0,a.jsx)("label",{style:{display:"block",fontWeight:600,marginBottom:"var(--space-2)",fontSize:14},children:"Content Instructions (You can edit this):"}),(0,a.jsx)("textarea",{value:(e=>{if(!e)return"";let a=e.split("\n").filter(e=>{let a=e.trim();return!(a.startsWith("You are Dash,")||a.includes("**IMPORTANT:")||a.includes("Generate ALL content")||a.startsWith("**Your Task:**")||a.startsWith("**Conversation Flow:**")||a.startsWith("**Important Guidelines:**")||a.startsWith("**CAPS Curriculum Focus:**")||a.startsWith("**AGE-APPROPRIATE INSTRUCTION VERBS")||a.startsWith("**WRONG - Too vague")||a.startsWith("**CORRECT - Clear teacher")||a.startsWith("**PEDAGOGICAL FRAMEWORK"))}).join("\n").trim();for(let e of["Generate an interactive","Generate comprehensive revision notes","Generate a 7-day intensive study","Generate 30 flashcards"]){let t=a.indexOf(e);if(-1!==t){a=a.substring(t);break}}return a})(Z),onChange:e=>{K((e=>{if(!e)return"";let a=x[E];return A[k],`You are Dash, a South African education assistant specializing in CAPS curriculum.

**IMPORTANT: Generate ALL content in ${a} (${E}). Use ONLY this language throughout the entire document. Do NOT switch languages.**

`+e})(e.target.value))},style:{width:"100%",minHeight:300,padding:"var(--space-3)",borderRadius:"var(--radius-2)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:13,fontFamily:"monospace",resize:"vertical"},placeholder:"Customize the content requirements, topics to focus on, difficulty adjustments, etc..."}),(0,a.jsxs)("div",{style:{marginTop:"var(--space-2)",fontSize:12,color:"var(--text-secondary)"},children:["💡 ",(0,a.jsx)("strong",{children:"Note:"})," Internal AI instructions are hidden. You're editing the content requirements only."]})]}),(0,a.jsx)("div",{className:"card",style:{padding:"var(--space-3)",background:"rgba(59, 130, 246, 0.1)",border:"1px solid rgba(59, 130, 246, 0.3)"},children:(0,a.jsxs)("div",{style:{fontSize:12,color:"var(--text-secondary)"},children:[(0,a.jsx)("strong",{children:"✨ Customization Tips:"}),(0,a.jsxs)("ul",{style:{margin:"0.5rem 0",paddingLeft:"1.5rem"},children:[(0,a.jsx)("li",{children:'Want specific topics? Add: "Focus on [topic1], [topic2]"'}),(0,a.jsx)("li",{children:'Adjust difficulty? Add: "Make questions [easier/harder] than usual"'}),(0,a.jsx)("li",{children:"Need more/fewer questions? Modify the marks allocation"}),(0,a.jsx)("li",{children:'Want a specific theme? Add: "Use [theme] context for all questions"'})]})]})})]}),(0,a.jsxs)("div",{style:{padding:"var(--space-4)",borderTop:"1px solid var(--border)",display:"flex",gap:"var(--space-3)",justifyContent:"flex-end"},children:[(0,a.jsx)("button",{onClick:et,className:"btn",children:"Cancel"}),(0,a.jsxs)("button",{onClick:()=>{if(Z){if("practice_test"===T){let e=new URLSearchParams({grade:k,subject:N,type:T,language:E,prompt:Z});n.push(`/dashboard/parent/generate-exam?${e.toString()}`),D(!1);return}e&&(e(Z,`${S.find(e=>e.id===T)?.label}: ${J?.label} ${N} (${x[E]})`,E,!1),D(!1))}},className:"btn btnPrimary",children:[(0,a.jsx)(l.Sparkles,{className:"icon16"}),"practice_test"===T?"Generate Exam":"study_guide"===T?"Generate Study Guide":"flashcards"===T?"Generate Flashcards":"revision_notes"===T?"Generate Revision Notes":"Generate Resource"]})]})]})}),(0,a.jsxs)("div",{className:"sectionTitle",style:{marginBottom:"var(--space-4)"},children:[(0,a.jsx)(c.GraduationCap,{className:"w-5 h-5",style:{color:"var(--primary)"}}),"CAPS Exam Preparation"]}),s&&(0,a.jsxs)("div",{style:{padding:"var(--space-3)",background:"linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)",border:"1px solid rgba(99, 102, 241, 0.3)",borderRadius:"var(--radius-2)",marginBottom:"var(--space-4)",fontSize:13},children:[(0,a.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"var(--space-2)",marginBottom:"var(--space-2)"},children:[(0,a.jsx)(u.Award,{className:"w-4 h-4",style:{color:"var(--primary)"}}),(0,a.jsx)("strong",{children:"Free Trial: 1 exam resource per day"})]}),(0,a.jsx)("p",{className:"muted",style:{fontSize:12,margin:0},children:"Upgrade to Parent Starter (R49.50/month) for unlimited practice tests, study guides, and more."})]}),(0,a.jsxs)("div",{style:{marginBottom:"var(--space-4)"},children:[(0,a.jsx)("label",{style:{display:"block",fontWeight:600,marginBottom:"var(--space-2)",fontSize:14},children:"Select Grade"}),(0,a.jsx)("select",{value:k,onChange:e=>C(e.target.value),style:{width:"100%",padding:"var(--space-3)",borderRadius:"var(--radius-2)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:14},children:v.map(e=>(0,a.jsxs)("option",{value:e.value,children:[e.label," (Ages ",e.age,")"]},e.value))})]}),(0,a.jsxs)("div",{style:{marginBottom:"var(--space-4)"},children:[(0,a.jsxs)("label",{style:{display:"block",fontWeight:600,marginBottom:"var(--space-2)",fontSize:14},children:[(0,a.jsx)(g.Globe,{className:"w-4 h-4",style:{display:"inline",verticalAlign:"middle",marginRight:6}}),"Select Language"]}),(0,a.jsx)("select",{value:E,onChange:e=>P(e.target.value),style:{width:"100%",padding:"var(--space-3)",borderRadius:"var(--radius-2)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:14},children:Object.entries(x).map(([e,t])=>(0,a.jsx)("option",{value:e,children:t},e))}),(0,a.jsx)("p",{className:"muted",style:{fontSize:11,marginTop:"var(--space-2)"},children:"???? All exam content will be generated in your selected language"})]}),(0,a.jsxs)("div",{style:{marginBottom:"var(--space-4)"},children:[(0,a.jsx)("label",{style:{display:"block",fontWeight:600,marginBottom:"var(--space-2)",fontSize:14},children:"Select Subject"}),(0,a.jsx)("input",{type:"text",placeholder:"🔍 Search subjects... (Math, Physics, English, etc.)",value:R,onChange:e=>{F(e.target.value);let a=V.filter(a=>a.toLowerCase().includes(e.target.value.toLowerCase()));1===a.length&&L(a[0])},style:{width:"100%",padding:"var(--space-3)",borderRadius:"var(--radius-2)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:14,marginBottom:"var(--space-2)"}}),(0,a.jsx)("select",{value:N,onChange:e=>L(e.target.value),style:{width:"100%",padding:"var(--space-3)",borderRadius:"var(--radius-2)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:14},children:V.filter(e=>e.toLowerCase().includes(R.toLowerCase())).map(e=>(0,a.jsx)("option",{value:e,children:e},e))}),(0,a.jsx)("p",{className:"muted",style:{fontSize:11,marginTop:"var(--space-2)"},children:R?`Showing ${V.filter(e=>e.toLowerCase().includes(R.toLowerCase())).length} of ${V.length} subjects`:`${V.length} subjects available for ${"foundation"===Q?"Foundation Phase":"intermediate"===Q?"Intermediate Phase":"senior"===Q?"Senior Phase":"FET Phase"}`})]}),(0,a.jsxs)("div",{style:{marginBottom:"var(--space-4)"},children:[(0,a.jsx)("label",{style:{display:"block",fontWeight:600,marginBottom:"var(--space-3)",fontSize:14},children:"Select Resource Type"}),(0,a.jsx)("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:"var(--space-3)"},children:S.map(e=>{let t=e.icon,i=T===e.id;return(0,a.jsx)("button",{onClick:()=>I(e.id),className:"card",style:{padding:"var(--space-3)",cursor:"pointer",border:i?"2px solid var(--primary)":"1px solid var(--border)",background:i?"rgba(var(--primary-rgb), 0.1)":"var(--card)",transition:"all 0.2s"},children:(0,a.jsxs)("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:"var(--space-2)",textAlign:"center"},children:[(0,a.jsx)("div",{style:{padding:8,borderRadius:"var(--radius-2)",background:`var(--${e.color})`},children:(0,a.jsx)(t,{className:"icon16",style:{color:"#fff"}})}),(0,a.jsx)("div",{style:{fontWeight:600,fontSize:13},children:e.label}),(0,a.jsx)("div",{className:"muted",style:{fontSize:11},children:e.description}),(0,a.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:4,fontSize:10},className:"muted",children:[(0,a.jsx)(d.Clock,{className:"icon12"}),e.duration]})]})},e.id)})})]}),(0,a.jsxs)("button",{className:"btn btnPrimary",onClick:ea,style:{width:"100%",fontSize:14,padding:"var(--space-3)",marginBottom:"var(--space-3)"},children:[(0,a.jsx)(l.Sparkles,{className:"icon16"}),"Generate ",ee?.label," with Dash AI"]}),(0,a.jsx)("p",{className:"muted",style:{fontSize:11,marginBottom:"var(--space-4)",textAlign:"center"},children:"✨ CAPS-aligned content generated by Dash AI • Exams next week? We've got you covered!"}),(0,a.jsxs)(a.Fragment,{children:[(0,a.jsxs)("div",{style:{textAlign:"center",color:"var(--muted)",fontSize:"13px",margin:"var(--space-3) 0",position:"relative"},children:[(0,a.jsx)("span",{style:{background:"var(--background)",padding:"0 12px",position:"relative",zIndex:1},children:"or try our new feature"}),(0,a.jsx)("div",{style:{position:"absolute",top:"50%",left:0,right:0,height:"1px",background:"var(--border)",zIndex:0}})]}),(0,a.jsx)("div",{style:{padding:"var(--space-4)",background:"linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)",border:"2px solid rgba(99, 102, 241, 0.3)",borderRadius:"var(--radius-3)"},children:(0,a.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"var(--space-3)",flexWrap:"wrap"},children:[(0,a.jsx)("div",{style:{width:48,height:48,borderRadius:"50%",background:"var(--primary)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flexShrink:0},children:(0,a.jsx)(m.MessageSquare,{className:"w-6 h-6"})}),(0,a.jsxs)("div",{style:{flex:1,minWidth:"200px"},children:[(0,a.jsxs)("h3",{style:{fontSize:16,fontWeight:600,marginBottom:"4px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"},children:[(0,a.jsx)(l.Sparkles,{className:"w-4 h-4",style:{color:"var(--primary)"}}),(0,a.jsx)("span",{children:"NEW: Conversational Exam Builder"})]}),(0,a.jsx)("p",{style:{fontSize:13,color:"var(--muted)",marginBottom:"12px"},children:"Let Dash AI guide you step-by-step. Choose topics, adjust difficulty, and refine each section in real-time!"}),(0,a.jsxs)("button",{onClick:()=>W(!0),className:"btn btnPrimary",style:{fontSize:"14px"},children:[(0,a.jsx)(m.MessageSquare,{className:"icon16"}),"Start Conversational Builder"]})]})]})})]}),(0,a.jsx)(f.UpgradeModal,{isOpen:z,onClose:()=>H(!1),currentTier:Y,userId:r||"",userEmail:O,userName:M,featureBlocked:"exam_generation",currentUsage:$?.currentUsage,currentLimit:$?.currentLimit})]})}e.s(["ExamPrepWidget",()=>w])}]);