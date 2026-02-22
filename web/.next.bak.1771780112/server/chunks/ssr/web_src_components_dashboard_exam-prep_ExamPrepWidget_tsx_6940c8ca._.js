module.exports=[727706,a=>{"use strict";var b=a.i(256856),c=a.i(755132),d=a.i(832315),e=a.i(268975),f=a.i(718912),g=a.i(597697),h=a.i(775283),i=a.i(207714),j=a.i(170263),k=a.i(799815),l=a.i(317873),m=a.i(809616),n=a.i(544244),o=a.i(789132),p=a.i(331266),q=a.i(803599),r=a.i(428513);let s={"en-ZA":"English (South Africa)","af-ZA":"Afrikaans","zu-ZA":"isiZulu","xh-ZA":"isiXhosa","nso-ZA":"Sepedi (Northern Sotho)"},t=[{value:"grade_r",label:"Grade R",age:"5-6"},{value:"grade_1",label:"Grade 1",age:"6-7"},{value:"grade_2",label:"Grade 2",age:"7-8"},{value:"grade_3",label:"Grade 3",age:"8-9"},{value:"grade_4",label:"Grade 4",age:"9-10"},{value:"grade_5",label:"Grade 5",age:"10-11"},{value:"grade_6",label:"Grade 6",age:"11-12"},{value:"grade_7",label:"Grade 7",age:"12-13"},{value:"grade_8",label:"Grade 8",age:"13-14"},{value:"grade_9",label:"Grade 9",age:"14-15"},{value:"grade_10",label:"Grade 10",age:"15-16"},{value:"grade_11",label:"Grade 11",age:"16-17"},{value:"grade_12",label:"Grade 12 (Matric)",age:"17-18"}],u={foundation:["English Home Language","English First Additional Language","Afrikaans Home Language","Afrikaans First Additional Language","isiZulu Home Language","isiZulu First Additional Language","isiXhosa Home Language","isiXhosa First Additional Language","Sepedi Home Language","Sepedi First Additional Language","Setswana Home Language","Setswana First Additional Language","Sesotho Home Language","Sesotho First Additional Language","Xitsonga Home Language","Xitsonga First Additional Language","Siswati Home Language","Siswati First Additional Language","Tshivenda Home Language","Tshivenda First Additional Language","isiNdebele Home Language","isiNdebele First Additional Language","Mathematics","Life Skills"],intermediate:["English Home Language","English First Additional Language","Afrikaans Home Language","Afrikaans First Additional Language","isiZulu Home Language","isiZulu First Additional Language","isiXhosa Home Language","isiXhosa First Additional Language","Sepedi Home Language","Sepedi First Additional Language","Setswana Home Language","Setswana First Additional Language","Sesotho Home Language","Sesotho First Additional Language","Xitsonga Home Language","Xitsonga First Additional Language","Siswati Home Language","Siswati First Additional Language","Tshivenda Home Language","Tshivenda First Additional Language","isiNdebele Home Language","isiNdebele First Additional Language","Mathematics","Natural Sciences & Technology","History","Geography","Life Skills"],senior:["English Home Language","English First Additional Language","Afrikaans Home Language","Afrikaans First Additional Language","isiZulu Home Language","isiZulu First Additional Language","isiXhosa Home Language","isiXhosa First Additional Language","Sepedi Home Language","Sepedi First Additional Language","Setswana Home Language","Setswana First Additional Language","Sesotho Home Language","Sesotho First Additional Language","Xitsonga Home Language","Xitsonga First Additional Language","Siswati Home Language","Siswati First Additional Language","Tshivenda Home Language","Tshivenda First Additional Language","isiNdebele Home Language","isiNdebele First Additional Language","Mathematics","Natural Sciences","History","Geography","Technology","Economic & Management Sciences","Life Orientation","Creative Arts"],fet:["English Home Language","English First Additional Language","Afrikaans Home Language","Afrikaans First Additional Language","isiZulu Home Language","isiZulu First Additional Language","isiXhosa Home Language","isiXhosa First Additional Language","Sepedi Home Language","Sepedi First Additional Language","Setswana Home Language","Setswana First Additional Language","Sesotho Home Language","Sesotho First Additional Language","Xitsonga Home Language","Xitsonga First Additional Language","Siswati Home Language","Siswati First Additional Language","Tshivenda Home Language","Tshivenda First Additional Language","isiNdebele Home Language","isiNdebele First Additional Language","Mathematics","Mathematical Literacy","Life Sciences","Physical Sciences","Accounting","Business Studies","Economics","Geography","History","Life Orientation","Agricultural Sciences","Agricultural Technology","Civil Technology","Computer Applications Technology","Consumer Studies","Dance Studies","Design","Dramatic Arts","Electrical Technology","Engineering Graphics & Design","Hospitality Studies","Information Technology","Mechanical Technology","Music","Tourism","Visual Arts"]},v=[{id:"practice_test",label:"Practice Test",description:"Full exam paper with memo",icon:f.FileText,color:"primary",duration:"60-120 min"},{id:"revision_notes",label:"Revision Notes",description:"Topic summaries & key points",icon:e.BookOpen,color:"accent",duration:"30 min read"},{id:"study_guide",label:"Study Guide",description:"Week-long study schedule",icon:h.Target,color:"warning",duration:"7-day plan"},{id:"flashcards",label:"Flashcards",description:"Quick recall questions",icon:g.Brain,color:"danger",duration:"15 min"}],w={grade_r:{duration:"20 minutes",marks:10,questionTypes:"Picture identification, matching, coloring, simple counting",vocabulary:"Basic colors, shapes, numbers 1-5, simple animals",instructions:"Use LOTS of visual cues, emojis, and simple one-word answers. NO writing required. Focus on recognition and matching.",calculator:!1,decimals:!1},grade_1:{duration:"30 minutes",marks:20,questionTypes:"Fill-in-the-blank with word bank, matching pictures to words, simple multiple choice (2-3 options), basic counting",vocabulary:"Simple everyday words, numbers 1-10, basic family/animals/food vocabulary",instructions:"Keep sentences SHORT (3-5 words max). Provide word banks for fill-in-blanks. Use pictures wherever possible. For First Additional Language: assume BEGINNER level.",calculator:!1,decimals:!1},grade_2:{duration:"45 minutes",marks:30,questionTypes:"Short answer (1-2 sentences), fill-in-blanks, multiple choice (3-4 options), simple problem solving",vocabulary:"Expanded vocabulary, numbers 1-20, basic sentence construction",instructions:"Simple paragraph reading (3-4 sentences). Basic grammar concepts. For Additional Language: elementary conversational level.",calculator:!1,decimals:!1},grade_3:{duration:"60 minutes",marks:40,questionTypes:"Short paragraphs, multiple choice, true/false, matching, basic problem solving",vocabulary:"Age-appropriate vocabulary, numbers 1-100, basic fractions (half, quarter)",instructions:"Reading comprehension with short stories (1 paragraph). Introduction to simple essays (3-4 sentences). Basic calculator use for checking only.",calculator:!1,decimals:!1},grade_4:{duration:"90 minutes",marks:50,questionTypes:"Paragraphs, essays (5-7 sentences), multiple choice, problem solving, data interpretation",vocabulary:"Grade-appropriate vocabulary, decimals to 1 place, basic fractions",instructions:"Reading passages (2-3 paragraphs). Essay writing with structure. Basic calculator allowed.",calculator:!0,decimals:!0},grade_5:{duration:"90 minutes",marks:60,questionTypes:"Extended paragraphs, structured essays, complex problem solving, comprehension",vocabulary:"Intermediate vocabulary, decimals to 2 places, common fractions",instructions:"Multi-paragraph reading. Structured essays with introduction and conclusion. Calculator allowed.",calculator:!0,decimals:!0},grade_6:{duration:"90 minutes",marks:75,questionTypes:"Essays with clear structure, data analysis, multi-step problem solving",vocabulary:"Advanced intermediate vocabulary, percentages, ratios, algebraic thinking",instructions:"Complex reading comprehension. Essay writing with planning. Calculator allowed except for mental math sections.",calculator:!0,decimals:!0},grade_7:{duration:"2 hours",marks:75,questionTypes:"Analytical essays, data interpretation, multi-step problems, reasoning",vocabulary:"Grade 7 curriculum vocabulary, algebraic expressions, geometry",instructions:"Extended reading passages. Structured analytical writing. Scientific calculator allowed.",calculator:!0,decimals:!0},grade_8:{duration:"2 hours",marks:100,questionTypes:"Analytical and creative writing, complex problem solving, research-based questions",vocabulary:"Grade 8 curriculum, algebra, functions, advanced grammar",instructions:"Critical thinking required. Extended essays with evidence. Scientific calculator allowed.",calculator:!0,decimals:!0},grade_9:{duration:"2 hours",marks:100,questionTypes:"Critical analysis, extended essays, complex calculations, abstract reasoning",vocabulary:"Grade 9 curriculum, quadratics, trigonometry basics, formal language",instructions:"FET Phase preparation. Formal academic writing. Scientific calculator required.",calculator:!0,decimals:!0},grade_10:{duration:"2.5 hours",marks:100,questionTypes:"FET formal exam format, extended responses, proofs, investigations",vocabulary:"Grade 10 curriculum, advanced algebra, trigonometry, analytical writing",instructions:"NSC preparation format. Extended essay responses. Scientific calculator required.",calculator:!0,decimals:!0},grade_11:{duration:"3 hours",marks:150,questionTypes:"NSC format, research essays, complex multi-step problems, investigations",vocabulary:"Grade 11 curriculum, calculus introduction, advanced topics",instructions:"Full NSC exam format. University preparation. Scientific calculator required.",calculator:!0,decimals:!0},grade_12:{duration:"3 hours",marks:150,questionTypes:"Full NSC Matric format, research essays, proofs, investigations, applications",vocabulary:"Grade 12 curriculum, calculus, statistics, formal academic language",instructions:"Official NSC Matric format. University-level expectations. Scientific calculator required.",calculator:!0,decimals:!0}};function x({onAskDashAI:a,guestMode:e=!1,userId:f}){let g=(0,d.useRouter)(),{checkQuota:h,incrementUsage:x}=(0,p.useQuotaCheck)(f),y=(0,r.createClient)(),[z,A]=(0,c.useState)("grade_9"),[B,C]=(0,c.useState)("Mathematics"),[D,E]=(0,c.useState)("practice_test"),[F,G]=(0,c.useState)("en-ZA"),[H,I]=(0,c.useState)(""),[J,K]=(0,c.useState)(!1),[L,M]=(0,c.useState)(!1),[N,O]=(0,c.useState)(!1),[P,Q]=(0,c.useState)(null),[R,S]=(0,c.useState)(""),[T,U]=(0,c.useState)(""),[V,W]=(0,c.useState)("free"),[X,Y]=(0,c.useState)("");if((0,c.useEffect)(()=>{(async()=>{if(!f)return;let{data:{user:a}}=await y.auth.getUser();a&&(S(a.email||""),U(a.user_metadata?.full_name||""));let{data:b}=await y.from("user_ai_tiers").select("tier").eq("user_id",f).single();b&&W(b.tier||"free")})()},[f,y]),L)return(0,b.jsx)(o.ConversationalExamBuilder,{grade:z,subject:B,onClose:()=>M(!1),onSave:a=>{M(!1)}});let Z="grade_r"===z||"grade_1"===z||"grade_2"===z||"grade_3"===z?"foundation":"grade_4"===z||"grade_5"===z||"grade_6"===z?"intermediate":"grade_7"===z||"grade_8"===z||"grade_9"===z?"senior":"fet",$=u[Z],_=t.find(a=>a.value===z),aa=v.find(a=>a.id===D),ab=async()=>{if(!a)return;if(f&&!e){let a=await h("exam_generation");if(a&&!a.allowed){Q({currentUsage:0===a.remaining?a.limit:a.limit-a.remaining,currentLimit:a.limit}),O(!0);return}}if(e&&null===new Date().toDateString())return void g.push("/sign-in?message=Sign in to continue generating exams");let b="",c=s[F],d=w[z];B.includes("Additional"),"practice_test"===D?(b=`You are Dash, a South African CAPS curriculum expert helping a ${_?.label} student prepare for a ${B} exam in ${c}.

**Student Context:**
- Grade: ${_?.label} (Ages ${_?.age})
- Subject: ${B}
- Language: ${c} (${F})
- Duration: ${d.duration}
- Total marks: ${d.marks}

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
- The exam MUST be in ${c} - every question, instruction, and memo
- Format the exam with clear sections (## SECTION A, ## SECTION B, etc.)
- Include a MARKING MEMORANDUM at the end

**CAPS Curriculum Focus:**
${d.questionTypes}

**CRITICAL CAPS ALIGNMENT REQUIREMENTS:**
You MUST ensure all educational content strictly follows the South African CAPS curriculum for Grade ${_?.label}:

1. **Curriculum Accuracy**: All topics, learning objectives, and assessment standards MUST align with the official CAPS document for ${B} Grade ${_?.label}
2. **Content Appropriateness**: Questions must match the cognitive demand level specified in CAPS for this grade
3. **Local Context**: Use South African examples, contexts, and scenarios (ZAR currency, local geography, culturally relevant situations)
4. **Assessment Standards**: Follow CAPS assessment guidelines for question distribution, mark allocation, and difficulty progression
5. **Topic Coverage**: Only include topics that are in the CAPS curriculum for this specific grade and term
6. **Language Policy**: Adhere to CAPS language policy - use ${c} consistently throughout

**Before generating content, verify:**
- The topics you choose are in the official CAPS curriculum for Grade ${_?.label} ${B}
- The difficulty level matches CAPS cognitive levels for this grade
- Your question types align with CAPS assessment requirements
- All contexts and examples are South African and age-appropriate

**Age-Appropriate Instructions:**
${d.instructions}

Let's start: Say hello and ask what specific topics they'd like to practice for their ${B} exam.`,_?.age,d.duration,d.marks,d.questionTypes,d.vocabulary,d.instructions,d.calculator,d.decimals,_?.label,_?.label,_?.age,d.duration,d.marks,_?.label,_?.label,_?.label,new Date().getFullYear(),"foundation"===Z||(d.calculator,d.decimals),d.duration,d.marks,d.questionTypes.includes("word bank"),_?.label,_?.age,d.marks,d.marks,_?.label,_?.age,new Date().getFullYear(),_?.label):"revision_notes"===D?(b=`You are Dash, a South African education assistant specializing in CAPS curriculum.

**IMPORTANT: Generate ALL content in ${c} (${F}). Use ONLY this language throughout the entire document. Do NOT switch languages.**

Generate comprehensive revision notes for ${_?.label} ${B} aligned to CAPS Term 4 assessment topics.

**Requirements:**
- Grade: ${_?.label}
- Subject: ${B}
- Format: Structured revision guide with clear headings
- Include: Key concepts, formulas, definitions, examples, diagrams (described in text)
- Use South African context and terminology
- Highlight exam-critical content

**Output Structure:**

# ${_?.label} ${B} Revision Notes
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

? ${new Date().getFullYear()} EduDash Pro ? CAPS-Aligned Revision Resources`,_?.label):"study_guide"===D?(b=`You are Dash, a South African education assistant specializing in CAPS curriculum.

**IMPORTANT: Generate ALL content in ${c} (${F}). Use ONLY this language throughout the entire study guide. Do NOT switch languages.**

Generate a 7-day intensive study schedule for ${_?.label} ${B} exam preparation aligned to CAPS curriculum.

**Requirements:**
- Grade: ${_?.label}
- Subject: ${B}
- Timeline: 7 days leading up to exam
- Include: Daily topics, practice exercises, review sessions, rest periods
- Realistic time allocations
- South African school context (?? daily homework, other subjects)

**Output Structure:**

# 7-Day Study Plan: ${_?.label} ${B}
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

? ${new Date().getFullYear()} EduDash Pro ? CAPS-Aligned Study Resources`,_?.label):"flashcards"===D&&(b=`You are Dash, a South African education assistant specializing in CAPS curriculum.

**IMPORTANT: Generate ALL content in ${c} (${F}). Use ONLY this language for all flashcard content. Do NOT switch languages.**

Generate 30 flashcards for ${_?.label} ${B} covering essential exam concepts aligned to CAPS curriculum.

**Requirements:**
- Grade: ${_?.label}
- Subject: ${B}
- Format: Question on front, detailed answer on back
- Cover: Definitions, formulas, problem-solving strategies, key facts
- Difficulty: Mix of easy recall and challenging application

**Output Structure:**

# ${_?.label} ${B} Flashcards
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

? ${new Date().getFullYear()} EduDash Pro ? CAPS-Aligned Study Resources`,_?.label),Y(b),K(!0),f&&!e&&x("exam_generation","success").catch(a=>{console.error("[ExamPrep] Failed to increment usage:",a)})},ac=()=>{K(!1),Y("")};return(0,b.jsxs)(b.Fragment,{children:[J&&(0,b.jsx)("div",{style:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0, 0, 0, 0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1e3,padding:"var(--space-4)"},children:(0,b.jsxs)("div",{className:"card",style:{maxWidth:700,width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column",padding:0},children:[(0,b.jsxs)("div",{style:{padding:"var(--space-4)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"var(--space-2)"},children:[(0,b.jsx)(i.Sparkles,{className:"icon20",style:{color:"var(--primary)"}}),(0,b.jsx)("span",{style:{fontWeight:700,fontSize:16},children:"Review & Customize Prompt"})]}),(0,b.jsx)("button",{onClick:ac,className:"iconBtn","aria-label":"Close",children:(0,b.jsx)("span",{style:{fontSize:20},children:"×"})})]}),(0,b.jsxs)("div",{style:{padding:"var(--space-4)",flex:1,overflowY:"auto"},children:[(0,b.jsxs)("div",{style:{marginBottom:"var(--space-3)"},children:[(0,b.jsx)("div",{style:{fontWeight:600,marginBottom:"var(--space-2)",fontSize:14},children:"Selected Configuration:"}),(0,b.jsxs)("div",{style:{display:"flex",flexWrap:"wrap",gap:"var(--space-2)"},children:[(0,b.jsx)("span",{className:"badge",style:{background:"var(--primary)",color:"#fff"},children:_?.label}),(0,b.jsx)("span",{className:"badge",style:{background:"var(--accent)",color:"#fff"},children:B}),(0,b.jsx)("span",{className:"badge",style:{background:"var(--warning)",color:"#fff"},children:v.find(a=>a.id===D)?.label}),(0,b.jsx)("span",{className:"badge",style:{background:"var(--danger)",color:"#fff"},children:s[F]})]})]}),(0,b.jsxs)("div",{style:{marginBottom:"var(--space-3)"},children:[(0,b.jsx)("label",{style:{display:"block",fontWeight:600,marginBottom:"var(--space-2)",fontSize:14},children:"Content Instructions (You can edit this):"}),(0,b.jsx)("textarea",{value:(a=>{if(!a)return"";let b=a.split("\n").filter(a=>{let b=a.trim();return!(b.startsWith("You are Dash,")||b.includes("**IMPORTANT:")||b.includes("Generate ALL content")||b.startsWith("**Your Task:**")||b.startsWith("**Conversation Flow:**")||b.startsWith("**Important Guidelines:**")||b.startsWith("**CAPS Curriculum Focus:**")||b.startsWith("**AGE-APPROPRIATE INSTRUCTION VERBS")||b.startsWith("**WRONG - Too vague")||b.startsWith("**CORRECT - Clear teacher")||b.startsWith("**PEDAGOGICAL FRAMEWORK"))}).join("\n").trim();for(let a of["Generate an interactive","Generate comprehensive revision notes","Generate a 7-day intensive study","Generate 30 flashcards"]){let c=b.indexOf(a);if(-1!==c){b=b.substring(c);break}}return b})(X),onChange:a=>{Y((a=>{if(!a)return"";let b=s[F];return w[z],`You are Dash, a South African education assistant specializing in CAPS curriculum.

**IMPORTANT: Generate ALL content in ${b} (${F}). Use ONLY this language throughout the entire document. Do NOT switch languages.**

`+a})(a.target.value))},style:{width:"100%",minHeight:300,padding:"var(--space-3)",borderRadius:"var(--radius-2)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:13,fontFamily:"monospace",resize:"vertical"},placeholder:"Customize the content requirements, topics to focus on, difficulty adjustments, etc..."}),(0,b.jsxs)("div",{style:{marginTop:"var(--space-2)",fontSize:12,color:"var(--text-secondary)"},children:["💡 ",(0,b.jsx)("strong",{children:"Note:"})," Internal AI instructions are hidden. You're editing the content requirements only."]})]}),(0,b.jsx)("div",{className:"card",style:{padding:"var(--space-3)",background:"rgba(59, 130, 246, 0.1)",border:"1px solid rgba(59, 130, 246, 0.3)"},children:(0,b.jsxs)("div",{style:{fontSize:12,color:"var(--text-secondary)"},children:[(0,b.jsx)("strong",{children:"✨ Customization Tips:"}),(0,b.jsxs)("ul",{style:{margin:"0.5rem 0",paddingLeft:"1.5rem"},children:[(0,b.jsx)("li",{children:'Want specific topics? Add: "Focus on [topic1], [topic2]"'}),(0,b.jsx)("li",{children:'Adjust difficulty? Add: "Make questions [easier/harder] than usual"'}),(0,b.jsx)("li",{children:"Need more/fewer questions? Modify the marks allocation"}),(0,b.jsx)("li",{children:'Want a specific theme? Add: "Use [theme] context for all questions"'})]})]})})]}),(0,b.jsxs)("div",{style:{padding:"var(--space-4)",borderTop:"1px solid var(--border)",display:"flex",gap:"var(--space-3)",justifyContent:"flex-end"},children:[(0,b.jsx)("button",{onClick:ac,className:"btn",children:"Cancel"}),(0,b.jsxs)("button",{onClick:()=>{if(X){if("practice_test"===D){let a=new URLSearchParams({grade:z,subject:B,type:D,language:F,prompt:X});g.push(`/dashboard/parent/generate-exam?${a.toString()}`),K(!1);return}a&&(a(X,`${v.find(a=>a.id===D)?.label}: ${_?.label} ${B} (${s[F]})`,F,!1),K(!1))}},className:"btn btnPrimary",children:[(0,b.jsx)(i.Sparkles,{className:"icon16"}),"practice_test"===D?"Generate Exam":"study_guide"===D?"Generate Study Guide":"flashcards"===D?"Generate Flashcards":"revision_notes"===D?"Generate Revision Notes":"Generate Resource"]})]})]})}),(0,b.jsxs)("div",{className:"sectionTitle",style:{marginBottom:"var(--space-4)"},children:[(0,b.jsx)(j.GraduationCap,{className:"w-5 h-5",style:{color:"var(--primary)"}}),"CAPS Exam Preparation"]}),e&&(0,b.jsxs)("div",{style:{padding:"var(--space-3)",background:"linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)",border:"1px solid rgba(99, 102, 241, 0.3)",borderRadius:"var(--radius-2)",marginBottom:"var(--space-4)",fontSize:13},children:[(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"var(--space-2)",marginBottom:"var(--space-2)"},children:[(0,b.jsx)(l.Award,{className:"w-4 h-4",style:{color:"var(--primary)"}}),(0,b.jsx)("strong",{children:"Free Trial: 1 exam resource per day"})]}),(0,b.jsx)("p",{className:"muted",style:{fontSize:12,margin:0},children:"Upgrade to Parent Starter (R49.50/month) for unlimited practice tests, study guides, and more."})]}),(0,b.jsxs)("div",{style:{marginBottom:"var(--space-4)"},children:[(0,b.jsx)("label",{style:{display:"block",fontWeight:600,marginBottom:"var(--space-2)",fontSize:14},children:"Select Grade"}),(0,b.jsx)("select",{value:z,onChange:a=>A(a.target.value),style:{width:"100%",padding:"var(--space-3)",borderRadius:"var(--radius-2)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:14},children:t.map(a=>(0,b.jsxs)("option",{value:a.value,children:[a.label," (Ages ",a.age,")"]},a.value))})]}),(0,b.jsxs)("div",{style:{marginBottom:"var(--space-4)"},children:[(0,b.jsxs)("label",{style:{display:"block",fontWeight:600,marginBottom:"var(--space-2)",fontSize:14},children:[(0,b.jsx)(m.Globe,{className:"w-4 h-4",style:{display:"inline",verticalAlign:"middle",marginRight:6}}),"Select Language"]}),(0,b.jsx)("select",{value:F,onChange:a=>G(a.target.value),style:{width:"100%",padding:"var(--space-3)",borderRadius:"var(--radius-2)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:14},children:Object.entries(s).map(([a,c])=>(0,b.jsx)("option",{value:a,children:c},a))}),(0,b.jsx)("p",{className:"muted",style:{fontSize:11,marginTop:"var(--space-2)"},children:"???? All exam content will be generated in your selected language"})]}),(0,b.jsxs)("div",{style:{marginBottom:"var(--space-4)"},children:[(0,b.jsx)("label",{style:{display:"block",fontWeight:600,marginBottom:"var(--space-2)",fontSize:14},children:"Select Subject"}),(0,b.jsx)("input",{type:"text",placeholder:"🔍 Search subjects... (Math, Physics, English, etc.)",value:H,onChange:a=>{I(a.target.value);let b=$.filter(b=>b.toLowerCase().includes(a.target.value.toLowerCase()));1===b.length&&C(b[0])},style:{width:"100%",padding:"var(--space-3)",borderRadius:"var(--radius-2)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:14,marginBottom:"var(--space-2)"}}),(0,b.jsx)("select",{value:B,onChange:a=>C(a.target.value),style:{width:"100%",padding:"var(--space-3)",borderRadius:"var(--radius-2)",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:14},children:$.filter(a=>a.toLowerCase().includes(H.toLowerCase())).map(a=>(0,b.jsx)("option",{value:a,children:a},a))}),(0,b.jsx)("p",{className:"muted",style:{fontSize:11,marginTop:"var(--space-2)"},children:H?`Showing ${$.filter(a=>a.toLowerCase().includes(H.toLowerCase())).length} of ${$.length} subjects`:`${$.length} subjects available for ${"foundation"===Z?"Foundation Phase":"intermediate"===Z?"Intermediate Phase":"senior"===Z?"Senior Phase":"FET Phase"}`})]}),(0,b.jsxs)("div",{style:{marginBottom:"var(--space-4)"},children:[(0,b.jsx)("label",{style:{display:"block",fontWeight:600,marginBottom:"var(--space-3)",fontSize:14},children:"Select Resource Type"}),(0,b.jsx)("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:"var(--space-3)"},children:v.map(a=>{let c=a.icon,d=D===a.id;return(0,b.jsx)("button",{onClick:()=>E(a.id),className:"card",style:{padding:"var(--space-3)",cursor:"pointer",border:d?"2px solid var(--primary)":"1px solid var(--border)",background:d?"rgba(var(--primary-rgb), 0.1)":"var(--card)",transition:"all 0.2s"},children:(0,b.jsxs)("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:"var(--space-2)",textAlign:"center"},children:[(0,b.jsx)("div",{style:{padding:8,borderRadius:"var(--radius-2)",background:`var(--${a.color})`},children:(0,b.jsx)(c,{className:"icon16",style:{color:"#fff"}})}),(0,b.jsx)("div",{style:{fontWeight:600,fontSize:13},children:a.label}),(0,b.jsx)("div",{className:"muted",style:{fontSize:11},children:a.description}),(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:4,fontSize:10},className:"muted",children:[(0,b.jsx)(k.Clock,{className:"icon12"}),a.duration]})]})},a.id)})})]}),(0,b.jsxs)("button",{className:"btn btnPrimary",onClick:ab,style:{width:"100%",fontSize:14,padding:"var(--space-3)",marginBottom:"var(--space-3)"},children:[(0,b.jsx)(i.Sparkles,{className:"icon16"}),"Generate ",aa?.label," with Dash AI"]}),(0,b.jsx)("p",{className:"muted",style:{fontSize:11,marginBottom:"var(--space-4)",textAlign:"center"},children:"✨ CAPS-aligned content generated by Dash AI • Exams next week? We've got you covered!"}),(0,b.jsxs)(b.Fragment,{children:[(0,b.jsxs)("div",{style:{textAlign:"center",color:"var(--muted)",fontSize:"13px",margin:"var(--space-3) 0",position:"relative"},children:[(0,b.jsx)("span",{style:{background:"var(--background)",padding:"0 12px",position:"relative",zIndex:1},children:"or try our new feature"}),(0,b.jsx)("div",{style:{position:"absolute",top:"50%",left:0,right:0,height:"1px",background:"var(--border)",zIndex:0}})]}),(0,b.jsx)("div",{style:{padding:"var(--space-4)",background:"linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)",border:"2px solid rgba(99, 102, 241, 0.3)",borderRadius:"var(--radius-3)"},children:(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"var(--space-3)",flexWrap:"wrap"},children:[(0,b.jsx)("div",{style:{width:48,height:48,borderRadius:"50%",background:"var(--primary)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flexShrink:0},children:(0,b.jsx)(n.MessageSquare,{className:"w-6 h-6"})}),(0,b.jsxs)("div",{style:{flex:1,minWidth:"200px"},children:[(0,b.jsxs)("h3",{style:{fontSize:16,fontWeight:600,marginBottom:"4px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"},children:[(0,b.jsx)(i.Sparkles,{className:"w-4 h-4",style:{color:"var(--primary)"}}),(0,b.jsx)("span",{children:"NEW: Conversational Exam Builder"})]}),(0,b.jsx)("p",{style:{fontSize:13,color:"var(--muted)",marginBottom:"12px"},children:"Let Dash AI guide you step-by-step. Choose topics, adjust difficulty, and refine each section in real-time!"}),(0,b.jsxs)("button",{onClick:()=>M(!0),className:"btn btnPrimary",style:{fontSize:"14px"},children:[(0,b.jsx)(n.MessageSquare,{className:"icon16"}),"Start Conversational Builder"]})]})]})})]}),(0,b.jsx)(q.UpgradeModal,{isOpen:N,onClose:()=>O(!1),currentTier:V,userId:f||"",userEmail:R,userName:T,featureBlocked:"exam_generation",currentUsage:P?.currentUsage,currentLimit:P?.currentLimit})]})}a.s(["ExamPrepWidget",()=>x])}];

//# sourceMappingURL=web_src_components_dashboard_exam-prep_ExamPrepWidget_tsx_6940c8ca._.js.map