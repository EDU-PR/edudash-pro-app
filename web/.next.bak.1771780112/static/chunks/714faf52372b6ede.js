(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,339621,e=>{"use strict";let t=(0,e.i(292511).default)("star",[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]]);e.s(["Star",()=>t],339621)},803231,e=>{"use strict";let t=(0,e.i(292511).default)("save",[["path",{d:"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",key:"1c8476"}],["path",{d:"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",key:"1ydtos"}],["path",{d:"M7 3v4a1 1 0 0 0 1 1h7",key:"t51u73"}]]);e.s(["Save",()=>t],803231)},991234,e=>{"use strict";let t=(0,e.i(292511).default)("eye",[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);e.s(["Eye",()=>t],991234)},499913,e=>{"use strict";let t=(0,e.i(292511).default)("send",[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]]);e.s(["Send",()=>t],499913)},24390,e=>{"use strict";let t=(0,e.i(292511).default)("lightbulb",[["path",{d:"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",key:"1gvzjb"}],["path",{d:"M9 18h6",key:"x1upvd"}],["path",{d:"M10 22h4",key:"ceow96"}]]);e.s(["Lightbulb",()=>t],24390)},262476,e=>{"use strict";var t=e.i(414294),r=e.i(430878),a=e.i(353913),s=e.i(192258),i=e.i(930971),o=e.i(553031),n=e.i(423350),l=e.i(54671),d=e.i(803231),c=e.i(499913),p=e.i(991234),g=e.i(470309),m=e.i(72172),h=e.i(24390),x=e.i(339621),b=e.i(460401),u=e.i(128108);let y={"Numbers & Counting":{grade:"",comments:""},"Language & Communication":{grade:"",comments:""},"Creative Arts":{grade:"",comments:""},"Physical Development":{grade:"",comments:""}},f={social_skills:{rating:3,notes:""},emotional_development:{rating:3,notes:""},gross_motor_skills:{rating:3,notes:""},fine_motor_skills:{rating:3,notes:""},cognitive_development:{rating:3,notes:""},language_development:{rating:3,notes:""},independence:{rating:3,notes:""},self_care:{rating:3,notes:""}},v={can_write_name:!1,can_count_to_20:!1,recognizes_letters:!1,follows_instructions:!1,shares_with_others:!1,sits_still_in_circle_time:!1,uses_toilet_independently:!1,ties_shoelaces:!1};function j(){return(0,t.jsx)(r.Suspense,{fallback:(0,t.jsx)("div",{className:"flex items-center justify-center min-h-screen",children:(0,t.jsx)("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-primary"})}),children:(0,t.jsx)(_,{})})}function _(){let e=(0,a.useRouter)(),j=(0,a.useSearchParams)(),_=(0,s.createClient)(),w=j.get("student_id"),S=j.get("report_id"),[k,C]=(0,r.useState)(),[R,z]=(0,r.useState)(!0),[N,B]=(0,r.useState)(!1),[$,P]=(0,r.useState)(null),[I,T]=(0,r.useState)(!1),[D,A]=(0,r.useState)(""),[E,O]=(0,r.useState)("general"),[L,M]=(0,r.useState)("Q4 2025"),[U,W]=(0,r.useState)("quarterly"),[q,G]=(0,r.useState)(""),[F,H]=(0,r.useState)(""),[Q,V]=(0,r.useState)(""),[Y,K]=(0,r.useState)(""),[Z,J]=(0,r.useState)(y),[X,ee]=(0,r.useState)("developing"),[et,er]=(0,r.useState)(""),[ea,es]=(0,r.useState)(""),[ei,eo]=(0,r.useState)(f),[en,el]=(0,r.useState)(v),{profile:ed,loading:ec}=(0,i.useUserProfile)(k),{slug:ep}=(0,o.useTenantSlug)(k),eg=ed?.preschoolName,em=ed?.preschoolId,eh=ed?.firstName||"Teacher",ex=(0,r.useCallback)(()=>{let e=0;return L&&e++,q&&e++,F&&e++,(Q||"school_readiness"===E&&et)&&e++,(Y||"school_readiness"===E&&ea)&&e++,Math.round(e/5*100)},[L,q,F,Q,Y,et,ea,E]);(0,r.useEffect)(()=>{(async()=>{let{data:{session:t}}=await _.auth.getSession();t?(C(t.user.id),z(!1)):e.push("/sign-in")})()},[e,_]),(0,r.useEffect)(()=>{em&&w&&(async()=>{try{let{data:e,error:t}=await _.from("students").select("id, first_name, last_name, date_of_birth, parent_id, guardian_id").eq("id",w).eq("preschool_id",em).single();if(t)return void console.error("Error loading student:",t);let r="",a="Parent";if(e?.parent_id){let{data:t}=await _.from("profiles").select("email, first_name, last_name").eq("id",e.parent_id).maybeSingle();t&&(r=t.email||"",a=`${t.first_name||""} ${t.last_name||""}`.trim()||"Parent")}P({...e,parent_email:r,parent_name:a})}catch(e){console.error("Error:",e)}})()},[em,w,_]),(0,r.useEffect)(()=>{em&&S&&(async()=>{try{let{data:e,error:t}=await _.from("progress_reports").select("*").eq("id",S).eq("preschool_id",em).single();if(t||!e)return void console.error("Error loading report:",t);O(e.report_category||"general"),M(e.report_period||"Q4 2025"),W(e.report_type||"quarterly"),G(e.overall_grade||""),H(e.teacher_comments||e.overall_comments||""),V(e.strengths||""),K(e.areas_for_improvement||""),e.subjects_performance&&J(e.subjects_performance),e.school_readiness_indicators&&eo(e.school_readiness_indicators),e.developmental_milestones&&el(e.developmental_milestones),ee(e.transition_readiness_level||"developing"),er(e.readiness_notes||""),es(e.recommendations||"")}catch(e){console.error("Error:",e)}})()},[em,S,_]);let eb=(e,t,r)=>{J(a=>({...a,[e]:{...a[e],[t]:r}}))},eu=(e,t,r)=>{eo(a=>({...a,[e]:{...a[e],[t]:r}}))},ey=async()=>{if($&&em&&k){B(!0);try{let e={preschool_id:em,student_id:$.id,teacher_id:k,report_period:L,report_type:U,report_category:E,overall_comments:F,teacher_comments:F,strengths:Q,areas_for_improvement:Y,subjects_performance:Z,overall_grade:q,approval_status:"draft",..."school_readiness"===E&&{school_readiness_indicators:ei,developmental_milestones:en,transition_readiness_level:X,readiness_notes:et,recommendations:ea},updated_at:new Date().toISOString()};if(S){let{error:t}=await _.from("progress_reports").update(e).eq("id",S);if(t)throw t}else{let{error:t}=await _.from("progress_reports").insert({...e,created_at:new Date().toISOString()});if(t)throw t}alert("Draft saved successfully!")}catch(e){console.error("Error saving draft:",e),alert(`Error saving draft: ${e.message}`)}finally{B(!1)}}},ef=async()=>{if($&&em&&k){if(!L||!q||!F)return void alert("Please fill in all required fields: Report Period, Overall Grade, and Teacher Comments");if(confirm("Submit this report for principal review? You will not be able to edit it until it is reviewed.")){B(!0);try{let t={preschool_id:em,student_id:$.id,teacher_id:k,report_period:L,report_type:U,report_category:E,overall_comments:F,teacher_comments:F,strengths:Q,areas_for_improvement:Y,subjects_performance:Z,overall_grade:q,approval_status:"pending_review",teacher_signed_at:new Date().toISOString(),..."school_readiness"===E&&{school_readiness_indicators:ei,developmental_milestones:en,transition_readiness_level:X,readiness_notes:et,recommendations:ea},updated_at:new Date().toISOString()};if(S){let{error:e}=await _.from("progress_reports").update(t).eq("id",S);if(e)throw e}else{let{error:e}=await _.from("progress_reports").insert({...t,created_at:new Date().toISOString()});if(e)throw e}alert("Report submitted for principal review!"),e.push("/dashboard/teacher/reports")}catch(e){console.error("Error submitting report:",e),alert(`Error submitting report: ${e.message}`)}finally{B(!1)}}}},ev=()=>{if(!$)return"";let e=`${$.first_name} ${$.last_name}`,t=`${ed?.firstName||""} ${ed?.lastName||""}`.trim()||"Teacher",r=new Date().toLocaleDateString("en-ZA",{year:"numeric",month:"long",day:"numeric"}),a="";if("general"===E){let e=Object.entries(Z).map(([e,t])=>`
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${e}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #059669;">${t.grade||"N/A"}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${t.comments||"-"}</td>
          </tr>
        `).join("");a=`
        <div style="margin: 30px 0;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Subject Performance</h2>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Subject</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Grade</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Comments</th>
              </tr>
            </thead>
            <tbody>
              ${e}
            </tbody>
          </table>
        </div>
      `}let s="";if("school_readiness"===E){let e=Object.entries(ei).map(([e,t])=>{let r="★".repeat(t.rating||0)+"☆".repeat(5-(t.rating||0));return`
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${e.replace(/_/g," ").replace(/\b\w/g,e=>e.toUpperCase())}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #f59e0b; font-size: 18px;">${r}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${t.notes||"-"}</td>
            </tr>
          `}).join(""),t=Object.entries(en).map(([e,t])=>`
          <li style="padding: 8px 0; color: ${t?"#059669":"#6b7280"};">
            <span style="display: inline-block; width: 20px; font-weight: bold;">${t?"✓":"○"}</span>
            ${e.replace(/_/g," ").replace(/\b\w/g,e=>e.toUpperCase())}
          </li>
        `).join("");s=`
        <div style="margin: 30px 0;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">School Readiness Assessment</h2>
          
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #374151;"><strong>Overall Readiness Level:</strong> <span style="color: #059669; font-weight: 600;">${X.replace(/_/g," ").replace(/\b\w/g,e=>e.toUpperCase())}</span></p>
          </div>

          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Development Area</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Rating</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${e}
            </tbody>
          </table>

          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin-bottom: 12px;">Developmental Milestones</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${t}
            </ul>
          </div>
        </div>
      `}return`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Progress Report - ${e}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #f9fafb;
          }
        </style>
      </head>
      <body>
        <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
            <h1 style="color: #1f2937; font-size: 28px; margin-bottom: 8px;">Progress Report</h1>
            <p style="color: #6b7280; font-size: 14px;">${eg||"School"}</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">STUDENT</p>
              <p style="margin: 0; font-weight: 600; font-size: 18px;">${e}</p>
            </div>
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">REPORT PERIOD</p>
              <p style="margin: 0; font-weight: 600; font-size: 18px;">${L}</p>
            </div>
          </div>

          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">OVERALL GRADE</p>
            <p style="margin: 0; font-size: 36px; font-weight: 700;">${q||"N/A"}</p>
          </div>

          ${a}
          ${s}

          <div style="margin: 30px 0;">
            <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #10b981; padding-bottom: 8px;">Teacher Comments</h2>
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <p style="margin: 0; white-space: pre-line;">${F||"No comments provided."}</p>
            </div>
          </div>

          ${Q?`
            <div style="margin: 30px 0;">
              <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #10b981; padding-bottom: 8px;">Strengths</h2>
              <div style="background: #ecfdf5; padding: 20px; border-radius: 8px;">
                <p style="margin: 0; white-space: pre-line;">${Q}</p>
              </div>
            </div>
          `:""}

          ${Y?`
            <div style="margin: 30px 0;">
              <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">Areas for Improvement</h2>
              <div style="background: #fffbeb; padding: 20px; border-radius: 8px;">
                <p style="margin: 0; white-space: pre-line;">${Y}</p>
              </div>
            </div>
          `:""}

          ${ea?`
            <div style="margin: 30px 0;">
              <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">Recommendations</h2>
              <div style="background: #f5f3ff; padding: 20px; border-radius: 8px;">
                <p style="margin: 0; white-space: pre-line;">${ea}</p>
              </div>
            </div>
          `:""}

          <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
              <div>
                <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px;">PREPARED BY</p>
                <p style="margin: 0; font-weight: 600;">${t}</p>
                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 12px;">${r}</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `};return R||ec?(0,t.jsx)(n.PrincipalShell,{tenantSlug:ep,userName:eh,preschoolName:eg,preschoolId:em,children:(0,t.jsx)("div",{className:"flex items-center justify-center min-h-[400px]",children:(0,t.jsx)("p",{className:"text-slate-400",children:"Loading..."})})}):$?(0,t.jsxs)(n.PrincipalShell,{tenantSlug:ep,userName:eh,preschoolName:eg,preschoolId:em,children:[(0,t.jsxs)("div",{className:"section",children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:16,marginBottom:24},children:[(0,t.jsx)("button",{className:"btn btnSecondary",onClick:()=>e.back(),style:{display:"flex",alignItems:"center",gap:8},children:(0,t.jsx)(g.ArrowLeft,{size:18})}),(0,t.jsxs)("div",{style:{flex:1},children:[(0,t.jsx)("h1",{className:"h1",style:{marginBottom:4},children:S?"Edit Report":"Create Progress Report"}),(0,t.jsxs)("p",{style:{color:"var(--muted)",fontSize:14,margin:0},children:[$.first_name," ",$.last_name]})]}),(0,t.jsxs)("div",{style:{background:"linear-gradient(135deg, #667eea 0%, #764ba2 100%)",color:"white",padding:"8px 16px",borderRadius:8,fontSize:14,fontWeight:600},children:[ex(),"% Complete"]})]}),(0,t.jsx)("div",{className:"card",style:{marginBottom:24,background:"linear-gradient(135deg, #667eea 0%, #764ba2 100%)",color:"white"},children:(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:16},children:[(0,t.jsxs)("div",{style:{width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700},children:[$.first_name[0],$.last_name[0]]}),(0,t.jsxs)("div",{children:[(0,t.jsxs)("h2",{style:{margin:0,fontSize:20,fontWeight:700},children:[$.first_name," ",$.last_name]}),$.parent_email&&(0,t.jsxs)("p",{style:{margin:"4px 0 0 0",opacity:.9,fontSize:14},children:["Parent: ",$.parent_name," (",$.parent_email,")"]})]})]})}),(0,t.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,t.jsxs)("h3",{style:{marginBottom:8,display:"flex",alignItems:"center",gap:8},children:[(0,t.jsx)(l.FileText,{size:20}),"Report Type"]}),(0,t.jsxs)("div",{style:{display:"flex",gap:12,flexWrap:"wrap"},children:[(0,t.jsx)("button",{className:"general"===E?"btn btnPrimary":"btn btnSecondary",onClick:()=>O("general"),children:"General Progress"}),(0,t.jsx)("button",{className:"school_readiness"===E?"btn btnPrimary":"btn btnSecondary",onClick:()=>O("school_readiness"),children:"🎓 School Readiness"})]}),"school_readiness"===E&&(0,t.jsx)("p",{style:{color:"var(--muted)",fontSize:13,marginTop:8},children:"For Grade R students transitioning to formal school"})]}),(0,t.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,t.jsx)("h3",{style:{marginBottom:16},children:"Basic Information"}),(0,t.jsxs)("div",{style:{display:"grid",gap:16,gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))"},children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",marginBottom:8,fontWeight:500},children:"Report Period *"}),(0,t.jsx)("input",{type:"text",className:"searchInput",value:L,onChange:e=>M(e.target.value),placeholder:"e.g., Q1 2025, Term 1",style:{width:"100%",paddingLeft:12}})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",marginBottom:8,fontWeight:500},children:"Report Type"}),(0,t.jsxs)("select",{value:U,onChange:e=>W(e.target.value),style:{width:"100%",padding:"12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--foreground)"},children:[(0,t.jsx)("option",{value:"weekly",children:"Weekly"}),(0,t.jsx)("option",{value:"monthly",children:"Monthly"}),(0,t.jsx)("option",{value:"quarterly",children:"Quarterly"}),(0,t.jsx)("option",{value:"term",children:"Term"}),(0,t.jsx)("option",{value:"annual",children:"Annual"})]})]}),(0,t.jsxs)("div",{children:[(0,t.jsx)("label",{style:{display:"block",marginBottom:8,fontWeight:500},children:"Overall Grade *"}),(0,t.jsx)("input",{type:"text",className:"searchInput",value:q,onChange:e=>G(e.target.value),placeholder:"e.g., A, B+, Excellent",style:{width:"100%",paddingLeft:12}})]})]})]}),(0,t.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},children:[(0,t.jsx)("h3",{style:{margin:0},children:"Teacher Comments *"}),(0,t.jsxs)("span",{style:{fontSize:12,color:F.length>900?"#ef4444":"var(--muted)"},children:[1e3-F.length," characters remaining"]})]}),(0,t.jsx)("textarea",{value:F,onChange:e=>{e.target.value.length<=1e3&&H(e.target.value)},placeholder:"General comments about the student's progress...",rows:4,style:{width:"100%",padding:12,borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--foreground)",resize:"vertical"}})]}),(0,t.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},children:[(0,t.jsxs)("h3",{style:{margin:0,display:"flex",alignItems:"center",gap:8},children:[(0,t.jsx)(x.Star,{size:20,color:"#10b981"}),"Strengths"]}),(0,t.jsxs)("span",{style:{fontSize:12,color:"var(--muted)"},children:[500-Q.length," characters remaining"]})]}),(0,t.jsx)("textarea",{value:Q,onChange:e=>{e.target.value.length<=500&&V(e.target.value)},placeholder:"What the student excels at...",rows:3,style:{width:"100%",padding:12,borderRadius:8,border:"1px solid var(--border)",backgroundColor:"var(--input-bg)",color:"var(--foreground)",resize:"vertical"}})]}),(0,t.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},children:[(0,t.jsxs)("h3",{style:{margin:0,display:"flex",alignItems:"center",gap:8},children:[(0,t.jsx)(b.AlertCircle,{size:20,color:"#f59e0b"}),"Areas for Improvement"]}),(0,t.jsxs)("span",{style:{fontSize:12,color:"var(--muted)"},children:[500-Y.length," characters remaining"]})]}),(0,t.jsx)("textarea",{value:Y,onChange:e=>{e.target.value.length<=500&&K(e.target.value)},placeholder:"What the student can work on...",rows:3,style:{width:"100%",padding:12,borderRadius:8,border:"1px solid var(--border)",backgroundColor:"var(--input-bg)",color:"var(--foreground)",resize:"vertical"}})]}),"general"===E&&(0,t.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,t.jsx)("h3",{style:{marginBottom:16},children:"Subject Performance"}),(0,t.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:16},children:Object.entries(Z).map(([e,r])=>(0,t.jsxs)("div",{style:{padding:16,background:"var(--card-hover)",borderRadius:8},children:[(0,t.jsx)("h4",{style:{margin:"0 0 12px 0",color:"var(--primary)"},children:e}),(0,t.jsxs)("div",{style:{display:"grid",gap:12,gridTemplateColumns:"120px 1fr"},children:[(0,t.jsx)("input",{type:"text",value:r.grade,onChange:t=>eb(e,"grade",t.target.value),placeholder:"Grade",style:{padding:8,borderRadius:6,border:"1px solid var(--border)",background:"var(--card)",color:"var(--foreground)"}}),(0,t.jsx)("input",{type:"text",value:r.comments,onChange:t=>eb(e,"comments",t.target.value),placeholder:"Comments for this subject",style:{padding:8,borderRadius:6,border:"1px solid var(--border)",background:"var(--card)",color:"var(--foreground)"}})]})]},e))})]}),"school_readiness"===E&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,t.jsx)("h3",{style:{marginBottom:16},children:"Overall School Readiness *"}),(0,t.jsx)("div",{style:{display:"flex",gap:8,flexWrap:"wrap"},children:["not_ready","developing","ready","exceeds_expectations"].map(e=>(0,t.jsx)("button",{className:X===e?"btn btnPrimary":"btn btnSecondary",onClick:()=>ee(e),children:e.replace(/_/g," ").replace(/\b\w/g,e=>e.toUpperCase())},e))})]}),(0,t.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,t.jsx)("h3",{style:{marginBottom:16},children:"Development Areas (Rate 1-5)"}),(0,t.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:16},children:Object.entries(ei).map(([e,r])=>(0,t.jsxs)("div",{style:{padding:16,background:"var(--card-hover)",borderRadius:8},children:[(0,t.jsx)("h4",{style:{margin:"0 0 12px 0",color:"var(--primary)"},children:e.replace(/_/g," ").replace(/\b\w/g,e=>e.toUpperCase())}),(0,t.jsx)("div",{style:{display:"flex",gap:8,marginBottom:12},children:[1,2,3,4,5].map(a=>(0,t.jsx)("button",{onClick:()=>eu(e,"rating",a),style:{width:40,height:40,borderRadius:"50%",border:"none",background:r.rating>=a?"#f59e0b":"var(--card)",color:r.rating>=a?"white":"var(--muted)",cursor:"pointer",fontSize:18},children:r.rating>=a?"★":"☆"},a))}),(0,t.jsx)("input",{type:"text",value:r.notes,onChange:t=>eu(e,"notes",t.target.value),placeholder:"Notes for this area",style:{width:"100%",padding:8,borderRadius:6,border:"1px solid var(--border)",background:"var(--card)",color:"var(--foreground)"}})]},e))})]}),(0,t.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,t.jsx)("h3",{style:{marginBottom:16},children:"Developmental Milestones"}),(0,t.jsx)("div",{style:{display:"grid",gap:8,gridTemplateColumns:"repeat(auto-fill, minmax(250px, 1fr))"},children:Object.entries(en).map(([e,r])=>(0,t.jsxs)("button",{onClick:()=>{el(t=>({...t,[e]:!t[e]}))},style:{display:"flex",alignItems:"center",gap:12,padding:12,background:r?"#ecfdf5":"var(--card)",border:`1px solid ${r?"#10b981":"var(--border)"}`,borderRadius:8,cursor:"pointer",textAlign:"left",color:"var(--foreground)"},children:[(0,t.jsx)("span",{style:{width:24,height:24,borderRadius:6,background:r?"#10b981":"var(--card-hover)",display:"flex",alignItems:"center",justifyContent:"center",color:r?"white":"var(--muted)"},children:r?"✓":""}),(0,t.jsx)("span",{style:{fontSize:14},children:e.replace(/_/g," ").replace(/\b\w/g,e=>e.toUpperCase())})]},e))})]}),(0,t.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,t.jsx)("h3",{style:{marginBottom:16},children:"Readiness Notes"}),(0,t.jsx)("textarea",{value:et,onChange:e=>{e.target.value.length<=800&&er(e.target.value)},placeholder:"Additional notes about school readiness...",rows:4,style:{width:"100%",padding:12,borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--foreground)",resize:"vertical"}})]}),(0,t.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,t.jsxs)("h3",{style:{marginBottom:8,display:"flex",alignItems:"center",gap:8},children:[(0,t.jsx)(h.Lightbulb,{size:20,color:"#8b5cf6"}),"Recommendations for Parents/School"]}),(0,t.jsx)("textarea",{value:ea,onChange:e=>{e.target.value.length<=800&&es(e.target.value)},placeholder:"Recommendations for supporting transition to formal school...",rows:4,style:{width:"100%",padding:12,borderRadius:8,border:"1px solid var(--border)",background:"#f5f3ff",color:"var(--foreground)",resize:"vertical"}})]})]}),(0,t.jsx)("div",{className:"card",style:{marginTop:32,marginBottom:24,borderTop:"2px solid var(--primary)",boxShadow:"0 -4px 6px -1px rgba(0, 0, 0, 0.1)"},children:(0,t.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:12},children:[(0,t.jsxs)("button",{className:"btn btnSecondary",onClick:()=>{A(ev()),T(!0)},style:{width:"100%"},children:[(0,t.jsx)(p.Eye,{size:18,style:{marginRight:8}}),"Preview"]}),(0,t.jsxs)("button",{className:"btn btnSecondary",onClick:()=>{let e=ev(),t=window.open("","_blank");t&&(t.document.write(e),t.document.close(),t.print())},style:{width:"100%"},children:[(0,t.jsx)(u.Download,{size:18,style:{marginRight:8}}),"Print/PDF"]}),(0,t.jsxs)("button",{className:"btn btnSecondary",onClick:ey,disabled:N,style:{width:"100%"},children:[(0,t.jsx)(d.Save,{size:18,style:{marginRight:8}}),N?"Saving...":"Save Draft"]}),(0,t.jsxs)("button",{className:"btn btnPrimary",onClick:ef,disabled:N||!L||!q||!F,style:{width:"100%",fontWeight:600},children:[(0,t.jsx)(c.Send,{size:18,style:{marginRight:8}}),N?"Submitting...":"Submit for Review"]})]})})]}),I&&(0,t.jsxs)("div",{style:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",zIndex:1e3,display:"flex",flexDirection:"column"},onClick:()=>T(!1),children:[(0,t.jsxs)("div",{style:{padding:16,background:"var(--card)",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[(0,t.jsx)("h3",{style:{margin:0},children:"Report Preview"}),(0,t.jsx)("button",{className:"btn btnSecondary",onClick:()=>T(!1),children:"Close"})]}),(0,t.jsx)("div",{style:{flex:1,overflow:"auto",padding:20},onClick:e=>e.stopPropagation(),children:(0,t.jsx)("iframe",{srcDoc:D,style:{width:"100%",height:"100%",minHeight:"800px",border:"none",background:"white",borderRadius:8}})})]})]}):(0,t.jsx)(n.PrincipalShell,{tenantSlug:ep,userName:eh,preschoolName:eg,preschoolId:em,children:(0,t.jsxs)("div",{className:"section",children:[(0,t.jsxs)("button",{className:"btn btnSecondary",onClick:()=>e.back(),style:{marginBottom:8,display:"flex",alignItems:"center",gap:8},children:[(0,t.jsx)(g.ArrowLeft,{size:18}),"Back"]}),(0,t.jsxs)("div",{className:"card",style:{textAlign:"center",padding:40},children:[(0,t.jsx)(m.User,{size:48,color:"var(--muted)",style:{margin:"0 auto 16px"}}),(0,t.jsx)("h3",{style:{marginBottom:8},children:"Student Not Found"}),(0,t.jsx)("p",{style:{color:"var(--muted)"},children:"Please select a student from the reports page."})]})]})})}e.s(["default",()=>j])}]);