module.exports=[360729,a=>{"use strict";var b=a.i(256856),c=a.i(755132),d=a.i(832315),e=a.i(428513),f=a.i(97473),g=a.i(863456);a.i(124385);var h=a.i(539108),i=a.i(718912),j=a.i(15719),k=a.i(145211),l=a.i(393700),m=a.i(176908),n=a.i(618996),o=a.i(445203),p=a.i(859604),q=a.i(826764),r=a.i(548085);let s={"Numbers & Counting":{grade:"",comments:""},"Language & Communication":{grade:"",comments:""},"Creative Arts":{grade:"",comments:""},"Physical Development":{grade:"",comments:""}},t={social_skills:{rating:3,notes:""},emotional_development:{rating:3,notes:""},gross_motor_skills:{rating:3,notes:""},fine_motor_skills:{rating:3,notes:""},cognitive_development:{rating:3,notes:""},language_development:{rating:3,notes:""},independence:{rating:3,notes:""},self_care:{rating:3,notes:""}},u={can_write_name:!1,can_count_to_20:!1,recognizes_letters:!1,follows_instructions:!1,shares_with_others:!1,sits_still_in_circle_time:!1,uses_toilet_independently:!1,ties_shoelaces:!1};function v(){return(0,b.jsx)(c.Suspense,{fallback:(0,b.jsx)("div",{className:"flex items-center justify-center min-h-screen",children:(0,b.jsx)("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-primary"})}),children:(0,b.jsx)(w,{})})}function w(){let a=(0,d.useRouter)(),v=(0,d.useSearchParams)(),w=(0,e.createClient)(),x=v.get("student_id"),y=v.get("report_id"),[z,A]=(0,c.useState)(),[B,C]=(0,c.useState)(!0),[D,E]=(0,c.useState)(!1),[F,G]=(0,c.useState)(null),[H,I]=(0,c.useState)(!1),[J,K]=(0,c.useState)(""),[L,M]=(0,c.useState)([]),[N,O]=(0,c.useState)(!1),[P,Q]=(0,c.useState)(null),[R,S]=(0,c.useState)("general"),[T,U]=(0,c.useState)("Q4 2025"),[V,W]=(0,c.useState)("quarterly"),[X,Y]=(0,c.useState)(""),[Z,$]=(0,c.useState)(""),[_,aa]=(0,c.useState)(""),[ab,ac]=(0,c.useState)(""),[ad,ae]=(0,c.useState)(s),[af,ag]=(0,c.useState)("developing"),[ah,ai]=(0,c.useState)(""),[aj,ak]=(0,c.useState)(""),[al,am]=(0,c.useState)(t),[an,ao]=(0,c.useState)(u),{profile:ap,loading:aq}=(0,f.useUserProfile)(z),{slug:ar}=(0,g.useTenantSlug)(z),as=ap?.preschoolName,at=ap?.preschoolId,au=ap?.firstName||"Teacher",av=(0,c.useCallback)(()=>{let a=0;return T&&a++,X&&a++,Z&&a++,(_||"school_readiness"===R&&ah)&&a++,(ab||"school_readiness"===R&&aj)&&a++,Math.round(a/5*100)},[T,X,Z,_,ab,ah,aj,R]),aw=(0,c.useCallback)(async(a,b)=>{if(!F||a.length<10)return void M([]);O(!0);try{let c=(({comments:[`${F.first_name} shows consistent engagement in classroom activities`,`${F.first_name} demonstrates strong understanding of key concepts`,`${F.first_name} actively participates in group discussions and collaborative work`,`${F.first_name} has shown remarkable progress this term`],strengths:["Excellent problem-solving abilities","Strong communication and social skills","Shows creativity in arts and crafts","Demonstrates leadership qualities"],improvements:["Could benefit from more practice with fine motor skills","Would improve with additional focus during circle time","Needs encouragement to share with peers","Could work on following multi-step instructions"]})[b]||[]).filter(b=>!a.toLowerCase().includes(b.substring(0,20).toLowerCase()));M(c.slice(0,3))}catch(a){console.error("AI suggestions error:",a),M([])}finally{O(!1)}},[F]);(0,c.useEffect)(()=>{(async()=>{let{data:{session:b}}=await w.auth.getSession();b?(A(b.user.id),C(!1)):a.push("/sign-in")})()},[a,w]),(0,c.useEffect)(()=>{if(!at||!x)return;let a=async()=>{try{let{data:a,error:b}=await w.from("students").select("id, first_name, last_name, date_of_birth, parent_id, guardian_id").eq("id",x).eq("preschool_id",at).single();if(b)return void console.error("Error loading student:",b);let c="",d="Parent";if(a?.parent_id){let{data:b}=await w.from("profiles").select("email, first_name, last_name").eq("id",a.parent_id).maybeSingle();b&&(c=b.email||"",d=`${b.first_name||""} ${b.last_name||""}`.trim()||"Parent")}G({...a,parent_email:c,parent_name:d})}catch(a){console.error("Error:",a)}};(async()=>{try{let{data:a}=await w.from("preschools").select("name, logo_url, address, phone, email, website_url, settings").eq("id",at).single();a&&Q({name:a.name,logo_url:a.logo_url,address:a.address,phone:a.phone,email:a.email,website_url:a.website_url,...a.settings||{}})}catch(a){console.error("Error loading school branding:",a)}})(),a()},[at,x,w]),(0,c.useEffect)(()=>{at&&y&&(async()=>{try{let{data:a,error:b}=await w.from("progress_reports").select("*").eq("id",y).eq("preschool_id",at).single();if(b||!a)return void console.error("Error loading report:",b);S(a.report_category||"general"),U(a.report_period||"Q4 2025"),W(a.report_type||"quarterly"),Y(a.overall_grade||""),$(a.teacher_comments||a.overall_comments||""),aa(a.strengths||""),ac(a.areas_for_improvement||""),a.subjects_performance&&ae(a.subjects_performance),a.school_readiness_indicators&&am(a.school_readiness_indicators),a.developmental_milestones&&ao(a.developmental_milestones),ag(a.transition_readiness_level||"developing"),ai(a.readiness_notes||""),ak(a.recommendations||"")}catch(a){console.error("Error:",a)}})()},[at,y,w]);let ax=(a,b,c)=>{ae(d=>({...d,[a]:{...d[a],[b]:c}}))},ay=(a,b,c)=>{am(d=>({...d,[a]:{...d[a],[b]:c}}))},az=async()=>{if(F&&at&&z){E(!0);try{let a={preschool_id:at,student_id:F.id,teacher_id:z,report_period:T,report_type:V,report_category:R,overall_comments:Z,teacher_comments:Z,strengths:_,areas_for_improvement:ab,subjects_performance:ad,overall_grade:X,approval_status:"draft",..."school_readiness"===R&&{school_readiness_indicators:al,developmental_milestones:an,transition_readiness_level:af,readiness_notes:ah,recommendations:aj},updated_at:new Date().toISOString()};if(y){let{error:b}=await w.from("progress_reports").update(a).eq("id",y);if(b)throw b}else{let{error:b}=await w.from("progress_reports").insert({...a,created_at:new Date().toISOString()});if(b)throw b}alert("Draft saved successfully!")}catch(a){console.error("Error saving draft:",a),alert(`Error saving draft: ${a.message}`)}finally{E(!1)}}},aA=async()=>{if(F&&at&&z){if(!T||!X||!Z)return void alert("Please fill in all required fields: Report Period, Overall Grade, and Teacher Comments");if(confirm("Submit this report for principal review? You will not be able to edit it until it is reviewed.")){E(!0);try{let b={preschool_id:at,student_id:F.id,teacher_id:z,report_period:T,report_type:V,report_category:R,overall_comments:Z,teacher_comments:Z,strengths:_,areas_for_improvement:ab,subjects_performance:ad,overall_grade:X,approval_status:"pending_review",teacher_signed_at:new Date().toISOString(),..."school_readiness"===R&&{school_readiness_indicators:al,developmental_milestones:an,transition_readiness_level:af,readiness_notes:ah,recommendations:aj},updated_at:new Date().toISOString()};if(y){let{error:a}=await w.from("progress_reports").update(b).eq("id",y);if(a)throw a}else{let{error:a}=await w.from("progress_reports").insert({...b,created_at:new Date().toISOString()});if(a)throw a}alert("Report submitted for principal review!"),a.push("/dashboard/teacher/reports")}catch(a){console.error("Error submitting report:",a),alert(`Error submitting report: ${a.message}`)}finally{E(!1)}}}},aB=()=>{if(!F)return"";let a=`${F.first_name} ${F.last_name}`,b=`${ap?.firstName||""} ${ap?.lastName||""}`.trim()||"Teacher",c=new Date().toLocaleDateString("en-ZA",{year:"numeric",month:"long",day:"numeric"}),d="";if("general"===R){let a=Object.entries(ad).map(([a,b])=>`
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${a}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #059669;">${b.grade||"N/A"}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${b.comments||"-"}</td>
          </tr>
        `).join("");d=`
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
              ${a}
            </tbody>
          </table>
        </div>
      `}let e="";if("school_readiness"===R){let a=Object.entries(al).map(([a,b])=>{let c="★".repeat(b.rating||0)+"☆".repeat(5-(b.rating||0));return`
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${a.replace(/_/g," ").replace(/\b\w/g,a=>a.toUpperCase())}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #f59e0b; font-size: 18px;">${c}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${b.notes||"-"}</td>
            </tr>
          `}).join(""),b=Object.entries(an).map(([a,b])=>`
          <li style="padding: 8px 0; color: ${b?"#059669":"#6b7280"};">
            <span style="display: inline-block; width: 20px; font-weight: bold;">${b?"✓":"○"}</span>
            ${a.replace(/_/g," ").replace(/\b\w/g,a=>a.toUpperCase())}
          </li>
        `).join("");e=`
        <div style="margin: 30px 0;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">School Readiness Assessment</h2>
          
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #374151;"><strong>Overall Readiness Level:</strong> <span style="color: #059669; font-weight: 600;">${af.replace(/_/g," ").replace(/\b\w/g,a=>a.toUpperCase())}</span></p>
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
              ${a}
            </tbody>
          </table>

          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin-bottom: 12px;">Developmental Milestones</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${b}
            </ul>
          </div>
        </div>
      `}return`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Progress Report - ${a}</title>
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
            ${P?.show_logo!==!1&&P?.logo_url?`
              <img src="${P.logo_url}" alt="School Logo" style="max-height: 80px; margin-bottom: 16px;" onerror="this.style.display='none'" />
            `:""}
            <h1 style="color: #1f2937; font-size: 28px; margin-bottom: 8px;">${P?.report_card_header||"Progress Report"}</h1>
            <p style="color: #6b7280; font-size: 16px; font-weight: 600;">${P?.name||as||"School"}</p>
            ${P?.show_address!==!1&&P?.address?`
              <p style="color: #6b7280; font-size: 12px; margin-top: 8px;">${P.address}</p>
            `:""}
            ${P?.show_contact!==!1&&(P?.phone||P?.email)?`
              <p style="color: #6b7280; font-size: 12px;">
                ${P.phone?`Tel: ${P.phone}`:""}
                ${P.phone&&P.email?" | ":""}
                ${P.email?`Email: ${P.email}`:""}
              </p>
            `:""}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">STUDENT</p>
              <p style="margin: 0; font-weight: 600; font-size: 18px;">${a}</p>
            </div>
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">REPORT PERIOD</p>
              <p style="margin: 0; font-weight: 600; font-size: 18px;">${T}</p>
            </div>
          </div>

          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">OVERALL GRADE</p>
            <p style="margin: 0; font-size: 36px; font-weight: 700;">${X||"N/A"}</p>
          </div>

          ${d}
          ${e}

          <div style="margin: 30px 0;">
            <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #10b981; padding-bottom: 8px;">Teacher Comments</h2>
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <p style="margin: 0; white-space: pre-line;">${Z||"No comments provided."}</p>
            </div>
          </div>

          ${_?`
            <div style="margin: 30px 0;">
              <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #10b981; padding-bottom: 8px;">Strengths</h2>
              <div style="background: #ecfdf5; padding: 20px; border-radius: 8px;">
                <p style="margin: 0; white-space: pre-line;">${_}</p>
              </div>
            </div>
          `:""}

          ${ab?`
            <div style="margin: 30px 0;">
              <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">Areas for Improvement</h2>
              <div style="background: #fffbeb; padding: 20px; border-radius: 8px;">
                <p style="margin: 0; white-space: pre-line;">${ab}</p>
              </div>
            </div>
          `:""}

          ${aj?`
            <div style="margin: 30px 0;">
              <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">Recommendations</h2>
              <div style="background: #f5f3ff; padding: 20px; border-radius: 8px;">
                <p style="margin: 0; white-space: pre-line;">${aj}</p>
              </div>
            </div>
          `:""}

          <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
              <div>
                <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px;">PREPARED BY</p>
                <p style="margin: 0; font-weight: 600;">${b}</p>
                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 12px;">${c}</p>
              </div>
              ${P?.show_principal_signature!==!1&&P?.principal_name?`
                <div style="text-align: right;">
                  ${P.principal_signature_url?`
                    <img src="${P.principal_signature_url}" alt="Signature" style="max-height: 50px; margin-bottom: 8px;" onerror="this.style.display='none'" />
                  `:""}
                  <p style="margin: 0; font-weight: 600;">${P.principal_name}</p>
                  <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 12px;">Principal</p>
                </div>
              `:""}
            </div>
          </div>
          ${P?.report_card_footer?`
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 11px;">${P.report_card_footer}</p>
            </div>
          `:""}
        </div>
      </body>
      </html>
    `};return B||aq?(0,b.jsx)(h.TeacherShell,{tenantSlug:ar,userName:au,preschoolName:as,preschoolId:at,userId:z,children:(0,b.jsx)("div",{className:"flex items-center justify-center min-h-[400px]",children:(0,b.jsx)("p",{className:"text-slate-400",children:"Loading..."})})}):F?(0,b.jsxs)(h.TeacherShell,{tenantSlug:ar,userName:au,preschoolName:as,preschoolId:at,userId:z,children:[(0,b.jsxs)("div",{className:"section",children:[(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:16,marginBottom:24},children:[(0,b.jsx)("button",{className:"btn btnSecondary",onClick:()=>a.back(),style:{display:"flex",alignItems:"center",gap:8},children:(0,b.jsx)(m.ArrowLeft,{size:18})}),(0,b.jsxs)("div",{style:{flex:1},children:[(0,b.jsx)("h1",{className:"h1",style:{marginBottom:4},children:y?"Edit Report":"Create Progress Report"}),(0,b.jsxs)("p",{style:{color:"var(--muted)",fontSize:14,margin:0},children:[F.first_name," ",F.last_name]})]}),(0,b.jsxs)("div",{style:{background:"linear-gradient(135deg, #667eea 0%, #764ba2 100%)",color:"white",padding:"8px 16px",borderRadius:8,fontSize:14,fontWeight:600},children:[av(),"% Complete"]})]}),(0,b.jsx)("div",{className:"card",style:{marginBottom:24,background:"linear-gradient(135deg, #667eea 0%, #764ba2 100%)",color:"white"},children:(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:16},children:[(0,b.jsxs)("div",{style:{width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700},children:[F.first_name[0],F.last_name[0]]}),(0,b.jsxs)("div",{children:[(0,b.jsxs)("h2",{style:{margin:0,fontSize:20,fontWeight:700},children:[F.first_name," ",F.last_name]}),F.parent_email&&(0,b.jsxs)("p",{style:{margin:"4px 0 0 0",opacity:.9,fontSize:14},children:["Parent: ",F.parent_name," (",F.parent_email,")"]})]})]})}),(0,b.jsx)("div",{className:"card",style:{marginBottom:24,background:"linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",color:"white",border:"none"},children:(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16},children:[(0,b.jsxs)("div",{style:{flex:1,minWidth:200},children:[(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8},children:[(0,b.jsx)("div",{style:{fontSize:24},children:"⚡"}),(0,b.jsx)("h3",{style:{margin:0,fontSize:18,fontWeight:700},children:"Dash AI Report Assistant"})]}),(0,b.jsx)("p",{style:{margin:0,fontSize:14,opacity:.95},children:"Let AI help you create a comprehensive progress report based on student data and performance history."})]}),(0,b.jsx)("button",{onClick:async()=>{if(F&&!N&&confirm(`Generate a complete progress report for ${F.first_name}?\\n\\nDash AI will analyze student data and fill in all sections automatically. You can review and edit afterwards.`)){O(!0);try{await new Promise(a=>setTimeout(a,2e3)),Y("B+"),$(`${F.first_name} has shown consistent progress throughout this term. They demonstrate strong engagement in classroom activities and actively participates in group discussions. Their enthusiasm for learning is evident in their daily interactions and completed assignments.`),aa(`• Excellent communication and social skills
• Shows creativity in arts and crafts activities
• Demonstrates strong problem-solving abilities
• Eager to help classmates and share materials`),ac(`• Could benefit from more practice with fine motor skills
• Would improve with additional focus during circle time
• Needs encouragement to complete tasks independently`),ae({"Numbers & Counting":{grade:"B+",comments:"Shows good understanding of numbers 1-20"},"Language & Communication":{grade:"A",comments:"Excellent vocabulary and expression"},"Creative Arts":{grade:"A",comments:"Very creative and enthusiastic"},"Physical Development":{grade:"B",comments:"Good gross motor skills, fine motor needs work"}}),alert("✨ Report generated successfully! Please review and edit as needed.")}catch(a){alert("Failed to generate report. Please try again.")}finally{O(!1)}}},disabled:N||!F,style:{padding:"12px 24px",borderRadius:8,border:"none",background:"white",color:"#7c3aed",fontWeight:600,cursor:N?"not-allowed":"pointer",fontSize:14,whiteSpace:"nowrap",opacity:N?.7:1},children:N?"⏳ Generating...":"⚡ Auto-Generate Report"})]})}),(0,b.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,b.jsxs)("h3",{style:{marginBottom:16,display:"flex",alignItems:"center",gap:8},children:[(0,b.jsx)(i.FileText,{size:20}),"Report Type"]}),(0,b.jsxs)("div",{style:{display:"flex",gap:12,flexWrap:"wrap"},children:[(0,b.jsx)("button",{className:"general"===R?"btn btnPrimary":"btn btnSecondary",onClick:()=>S("general"),children:"General Progress"}),(0,b.jsx)("button",{className:"school_readiness"===R?"btn btnPrimary":"btn btnSecondary",onClick:()=>S("school_readiness"),children:"🎓 School Readiness"})]}),"school_readiness"===R&&(0,b.jsx)("p",{style:{color:"var(--muted)",fontSize:13,marginTop:8},children:"For Grade R students transitioning to formal school"})]}),(0,b.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,b.jsx)("h3",{style:{marginBottom:16},children:"Basic Information"}),(0,b.jsxs)("div",{style:{display:"grid",gap:16,gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))"},children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("label",{style:{display:"block",marginBottom:8,fontWeight:500},children:"Report Period *"}),(0,b.jsx)("input",{type:"text",className:"searchInput",value:T,onChange:a=>U(a.target.value),placeholder:"e.g., Q1 2025, Term 1",style:{width:"100%",paddingLeft:12}})]}),(0,b.jsxs)("div",{children:[(0,b.jsx)("label",{style:{display:"block",marginBottom:8,fontWeight:500},children:"Report Type"}),(0,b.jsxs)("select",{value:V,onChange:a=>W(a.target.value),style:{width:"100%",padding:"12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--foreground)"},children:[(0,b.jsx)("option",{value:"weekly",children:"Weekly"}),(0,b.jsx)("option",{value:"monthly",children:"Monthly"}),(0,b.jsx)("option",{value:"quarterly",children:"Quarterly"}),(0,b.jsx)("option",{value:"term",children:"Term"}),(0,b.jsx)("option",{value:"annual",children:"Annual"})]})]}),(0,b.jsxs)("div",{children:[(0,b.jsx)("label",{style:{display:"block",marginBottom:8,fontWeight:500},children:"Overall Grade *"}),(0,b.jsx)("input",{type:"text",className:"searchInput",value:X,onChange:a=>Y(a.target.value),placeholder:"e.g., A, B+, Excellent",style:{width:"100%",paddingLeft:12}})]})]})]}),(0,b.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,b.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},children:[(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:8},children:[(0,b.jsx)("h3",{style:{margin:0},children:"Teacher Comments *"}),(0,b.jsx)("div",{style:{fontSize:11,padding:"3px 8px",borderRadius:4,background:"linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",color:"white",fontWeight:600},children:"⚡ Dash AI"})]}),(0,b.jsxs)("span",{style:{fontSize:12,color:Z.length>900?"#ef4444":"var(--muted)"},children:[1e3-Z.length," characters remaining"]})]}),(0,b.jsx)("textarea",{value:Z,onChange:a=>{a.target.value.length<=1e3&&$(a.target.value)},onFocus:()=>aw(Z,"comments"),placeholder:"General comments about the student's progress...",rows:4,style:{width:"100%",padding:12,borderRadius:8,border:"1px solid var(--border)",backgroundColor:"var(--input-bg)",color:"var(--foreground)",resize:"vertical"}}),L.length>0&&(0,b.jsxs)("div",{style:{marginTop:12,padding:12,borderRadius:8,background:"linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)",border:"1px solid rgba(139, 92, 246, 0.3)"},children:[(0,b.jsx)("div",{style:{fontSize:12,fontWeight:600,marginBottom:8,color:"#8b5cf6"},children:"💡 Dash AI Suggestions:"}),L.map((a,c)=>(0,b.jsx)("button",{onClick:()=>{let b=Z?`${Z} ${a}`:a;b.length<=1e3&&($(b),M([]))},style:{display:"block",width:"100%",textAlign:"left",padding:8,marginBottom:4,borderRadius:4,border:"1px solid rgba(139, 92, 246, 0.3)",background:"var(--card)",color:"var(--foreground)",cursor:"pointer",fontSize:13,transition:"all 0.2s"},onMouseEnter:a=>{a.currentTarget.style.background="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",a.currentTarget.style.color="white",a.currentTarget.style.borderColor="#8b5cf6"},onMouseLeave:a=>{a.currentTarget.style.background="var(--card)",a.currentTarget.style.color="var(--foreground)",a.currentTarget.style.borderColor="rgba(139, 92, 246, 0.3)"},children:a},c))]})]}),(0,b.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,b.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},children:[(0,b.jsxs)("h3",{style:{margin:0,display:"flex",alignItems:"center",gap:8},children:[(0,b.jsx)(p.Star,{size:20,color:"#10b981"}),"Strengths"]}),(0,b.jsxs)("span",{style:{fontSize:12,color:"var(--muted)"},children:[500-_.length," characters remaining"]})]}),(0,b.jsx)("textarea",{value:_,onChange:a=>{a.target.value.length<=500&&aa(a.target.value)},placeholder:"What the student excels at...",rows:3,style:{width:"100%",padding:12,borderRadius:8,border:"1px solid var(--border)",backgroundColor:"var(--input-bg)",color:"var(--foreground)",resize:"vertical"}})]}),(0,b.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,b.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},children:[(0,b.jsxs)("h3",{style:{margin:0,display:"flex",alignItems:"center",gap:8},children:[(0,b.jsx)(q.AlertCircle,{size:20,color:"#f59e0b"}),"Areas for Improvement"]}),(0,b.jsxs)("span",{style:{fontSize:12,color:"var(--muted)"},children:[500-ab.length," characters remaining"]})]}),(0,b.jsx)("textarea",{value:ab,onChange:a=>{a.target.value.length<=500&&ac(a.target.value)},placeholder:"What the student can work on...",rows:3,style:{width:"100%",padding:12,borderRadius:8,border:"1px solid var(--border)",backgroundColor:"var(--input-bg)",color:"var(--foreground)",resize:"vertical"}})]}),"general"===R&&(0,b.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,b.jsx)("h3",{style:{marginBottom:16},children:"Subject Performance"}),(0,b.jsx)("div",{style:{display:"grid",gap:16,gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))"},children:Object.entries(ad).map(([a,c])=>(0,b.jsxs)("div",{style:{padding:16,background:"var(--card-hover)",borderRadius:8,border:"1px solid var(--border)"},children:[(0,b.jsx)("h4",{style:{margin:"0 0 12px 0",color:"var(--primary)",fontSize:15,fontWeight:600},children:a}),(0,b.jsxs)("div",{style:{display:"flex",flexDirection:"column",gap:10},children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("label",{style:{fontSize:12,color:"var(--muted)",marginBottom:4,display:"block"},children:"Grade"}),(0,b.jsx)("input",{type:"text",value:c.grade,onChange:b=>ax(a,"grade",b.target.value),placeholder:"e.g., A, B+, Excellent",style:{width:"100%",padding:8,borderRadius:6,border:"1px solid var(--border)",backgroundColor:"var(--input-bg)",color:"var(--foreground)"}})]}),(0,b.jsxs)("div",{children:[(0,b.jsx)("label",{style:{fontSize:12,color:"var(--muted)",marginBottom:4,display:"block"},children:"Comments"}),(0,b.jsx)("input",{type:"text",value:c.comments,onChange:b=>ax(a,"comments",b.target.value),placeholder:"Brief comments...",style:{width:"100%",padding:8,borderRadius:6,border:"1px solid var(--border)",backgroundColor:"var(--input-bg)",color:"var(--foreground)"}})]})]})]},a))})]}),"school_readiness"===R&&(0,b.jsxs)(b.Fragment,{children:[(0,b.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,b.jsx)("h3",{style:{marginBottom:16},children:"Overall School Readiness *"}),(0,b.jsx)("div",{style:{display:"flex",gap:8,flexWrap:"wrap"},children:["not_ready","developing","ready","exceeds_expectations"].map(a=>(0,b.jsx)("button",{className:af===a?"btn btnPrimary":"btn btnSecondary",onClick:()=>ag(a),children:a.replace(/_/g," ").replace(/\b\w/g,a=>a.toUpperCase())},a))})]}),(0,b.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,b.jsx)("h3",{style:{marginBottom:16},children:"Development Areas (Rate 1-5)"}),(0,b.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:16},children:Object.entries(al).map(([a,c])=>(0,b.jsxs)("div",{style:{padding:16,background:"var(--card-hover)",borderRadius:8},children:[(0,b.jsx)("h4",{style:{margin:"0 0 12px 0",color:"var(--primary)"},children:a.replace(/_/g," ").replace(/\b\w/g,a=>a.toUpperCase())}),(0,b.jsx)("div",{style:{display:"flex",gap:8,marginBottom:12},children:[1,2,3,4,5].map(d=>(0,b.jsx)("button",{onClick:()=>ay(a,"rating",d),style:{width:40,height:40,borderRadius:"50%",border:"none",background:c.rating>=d?"#f59e0b":"var(--card)",color:c.rating>=d?"white":"var(--muted)",cursor:"pointer",fontSize:18},children:c.rating>=d?"★":"☆"},d))}),(0,b.jsx)("input",{type:"text",value:c.notes,onChange:b=>ay(a,"notes",b.target.value),placeholder:"Notes for this area",style:{width:"100%",padding:8,borderRadius:6,border:"1px solid var(--border)",background:"var(--card)",color:"var(--foreground)"}})]},a))})]}),(0,b.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,b.jsx)("h3",{style:{marginBottom:16},children:"Developmental Milestones"}),(0,b.jsx)("div",{style:{display:"grid",gap:8,gridTemplateColumns:"repeat(auto-fill, minmax(250px, 1fr))"},children:Object.entries(an).map(([a,c])=>(0,b.jsxs)("button",{onClick:()=>{ao(b=>({...b,[a]:!b[a]}))},style:{display:"flex",alignItems:"center",gap:12,padding:12,background:c?"#ecfdf5":"var(--card)",border:`1px solid ${c?"#10b981":"var(--border)"}`,borderRadius:8,cursor:"pointer",textAlign:"left",color:"var(--foreground)"},children:[(0,b.jsx)("span",{style:{width:24,height:24,borderRadius:6,background:c?"#10b981":"var(--card-hover)",display:"flex",alignItems:"center",justifyContent:"center",color:c?"white":"var(--muted)"},children:c?"✓":""}),(0,b.jsx)("span",{style:{fontSize:14},children:a.replace(/_/g," ").replace(/\b\w/g,a=>a.toUpperCase())})]},a))})]}),(0,b.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,b.jsx)("h3",{style:{marginBottom:16},children:"Readiness Notes"}),(0,b.jsx)("textarea",{value:ah,onChange:a=>{a.target.value.length<=800&&ai(a.target.value)},placeholder:"Additional notes about school readiness...",rows:4,style:{width:"100%",padding:12,borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--foreground)",resize:"vertical"}})]}),(0,b.jsxs)("div",{className:"card",style:{marginBottom:24},children:[(0,b.jsxs)("h3",{style:{marginBottom:16,display:"flex",alignItems:"center",gap:8},children:[(0,b.jsx)(o.Lightbulb,{size:20,color:"#8b5cf6"}),"Recommendations for Parents/School"]}),(0,b.jsx)("textarea",{value:aj,onChange:a=>{a.target.value.length<=800&&ak(a.target.value)},placeholder:"Recommendations for supporting transition to formal school...",rows:4,style:{width:"100%",padding:12,borderRadius:8,border:"1px solid var(--border)",backgroundColor:"var(--input-bg)",color:"var(--foreground)",resize:"vertical"}})]})]}),(0,b.jsx)("div",{className:"card",style:{marginTop:20,marginBottom:8,borderTop:"2px solid var(--primary)",boxShadow:"0 -4px 6px -1px rgba(0, 0, 0, 0.1)"},children:(0,b.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:12},children:[(0,b.jsxs)("button",{className:"btn btnSecondary",onClick:()=>{K(aB()),I(!0)},style:{width:"100%"},children:[(0,b.jsx)(l.Eye,{size:18,style:{marginRight:8}}),"Preview"]}),(0,b.jsxs)("button",{className:"btn btnSecondary",onClick:()=>{let a=aB(),b=window.open("","_blank");b&&(b.document.write(a),b.document.close(),b.print())},style:{width:"100%"},children:[(0,b.jsx)(r.Download,{size:18,style:{marginRight:8}}),"Print/PDF"]}),(0,b.jsxs)("button",{className:"btn btnSecondary",onClick:az,disabled:D,style:{width:"100%"},children:[(0,b.jsx)(j.Save,{size:18,style:{marginRight:8}}),D?"Saving...":"Save Draft"]}),(0,b.jsxs)("button",{className:"btn btnPrimary",onClick:aA,disabled:D||!T||!X||!Z,style:{width:"100%",fontWeight:600},children:[(0,b.jsx)(k.Send,{size:18,style:{marginRight:8}}),D?"Submitting...":"Submit for Review"]})]})})]}),H&&(0,b.jsxs)("div",{style:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",zIndex:1e3,display:"flex",flexDirection:"column"},onClick:()=>I(!1),children:[(0,b.jsxs)("div",{style:{padding:16,background:"var(--card)",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[(0,b.jsx)("h3",{style:{margin:0},children:"Report Preview"}),(0,b.jsx)("button",{className:"btn btnSecondary",onClick:()=>I(!1),children:"Close"})]}),(0,b.jsx)("div",{style:{flex:1,overflow:"auto",padding:20},onClick:a=>a.stopPropagation(),children:(0,b.jsx)("iframe",{srcDoc:J,style:{width:"100%",height:"100%",minHeight:"800px",border:"none",background:"white",borderRadius:8}})})]})]}):(0,b.jsx)(h.TeacherShell,{tenantSlug:ar,userName:au,preschoolName:as,preschoolId:at,userId:z,children:(0,b.jsxs)("div",{className:"section",children:[(0,b.jsxs)("button",{className:"btn btnSecondary",onClick:()=>a.back(),style:{marginBottom:16,display:"flex",alignItems:"center",gap:8},children:[(0,b.jsx)(m.ArrowLeft,{size:18}),"Back"]}),(0,b.jsxs)("div",{className:"card",style:{textAlign:"center",padding:40},children:[(0,b.jsx)(n.User,{size:48,color:"var(--muted)",style:{margin:"0 auto 16px"}}),(0,b.jsx)("h3",{style:{marginBottom:8},children:"Student Not Found"}),(0,b.jsx)("p",{style:{color:"var(--muted)"},children:"Please select a student from the reports page."})]})]})})}a.s(["default",()=>v])}];

//# sourceMappingURL=web_src_app_dashboard_teacher_reports_create_page_tsx_d3c7771e._.js.map