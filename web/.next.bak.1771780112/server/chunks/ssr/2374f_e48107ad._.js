module.exports=[902100,(a,b,c)=>{a.e,b.exports=function(a,b,c){var d=function(a){return a.add(4-a.isoWeekday(),"day")},e=b.prototype;e.isoWeekYear=function(){return d(this).year()},e.isoWeek=function(a){if(!this.$utils().u(a))return this.add(7*(a-this.isoWeek()),"day");var b,e,f,g=d(this),h=(b=this.isoWeekYear(),f=4-(e=(this.$u?c.utc:c)().year(b).startOf("year")).isoWeekday(),e.isoWeekday()>4&&(f+=7),e.add(f,"day"));return g.diff(h,"week")+1},e.isoWeekday=function(a){return this.$utils().u(a)?this.day()||7:this.day(this.day()%7?a:a-7)};var f=e.startOf;e.startOf=function(a,b){var c=this.$utils(),d=!!c.u(b)||b;return"isoweek"===c.p(a)?d?this.date(this.date()-(this.isoWeekday()-1)).startOf("day"):this.date(this.date()-1-(this.isoWeekday()-1)+7).endOf("day"):f.bind(this)(a,b)}}},52550,(a,b,c)=>{a.e,b.exports=function(){"use strict";var a={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},b=/(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,c=/\d/,d=/\d\d/,e=/\d\d?/,f=/\d*[^-_:/,()\s\d]+/,g={},h=function(a){return(a*=1)+(a>68?1900:2e3)},i=function(a){return function(b){this[a]=+b}},j=[/[+-]\d\d:?(\d\d)?|Z/,function(a){(this.zone||(this.zone={})).offset=function(a){if(!a||"Z"===a)return 0;var b=a.match(/([+-]|\d\d)/g),c=60*b[1]+(+b[2]||0);return 0===c?0:"+"===b[0]?-c:c}(a)}],k=function(a){var b=g[a];return b&&(b.indexOf?b:b.s.concat(b.f))},l=function(a,b){var c,d=g.meridiem;if(d){for(var e=1;e<=24;e+=1)if(a.indexOf(d(e,0,b))>-1){c=e>12;break}}else c=a===(b?"pm":"PM");return c},m={A:[f,function(a){this.afternoon=l(a,!1)}],a:[f,function(a){this.afternoon=l(a,!0)}],Q:[c,function(a){this.month=3*(a-1)+1}],S:[c,function(a){this.milliseconds=100*a}],SS:[d,function(a){this.milliseconds=10*a}],SSS:[/\d{3}/,function(a){this.milliseconds=+a}],s:[e,i("seconds")],ss:[e,i("seconds")],m:[e,i("minutes")],mm:[e,i("minutes")],H:[e,i("hours")],h:[e,i("hours")],HH:[e,i("hours")],hh:[e,i("hours")],D:[e,i("day")],DD:[d,i("day")],Do:[f,function(a){var b=g.ordinal,c=a.match(/\d+/);if(this.day=c[0],b)for(var d=1;d<=31;d+=1)b(d).replace(/\[|\]/g,"")===a&&(this.day=d)}],w:[e,i("week")],ww:[d,i("week")],M:[e,i("month")],MM:[d,i("month")],MMM:[f,function(a){var b=k("months"),c=(k("monthsShort")||b.map(function(a){return a.slice(0,3)})).indexOf(a)+1;if(c<1)throw Error();this.month=c%12||c}],MMMM:[f,function(a){var b=k("months").indexOf(a)+1;if(b<1)throw Error();this.month=b%12||b}],Y:[/[+-]?\d+/,i("year")],YY:[d,function(a){this.year=h(a)}],YYYY:[/\d{4}/,i("year")],Z:j,ZZ:j};return function(c,d,e){e.p.customParseFormat=!0,c&&c.parseTwoDigitYear&&(h=c.parseTwoDigitYear);var f=d.prototype,i=f.parse;f.parse=function(c){var d=c.date,f=c.utc,h=c.args;this.$u=f;var j=h[1];if("string"==typeof j){var k=!0===h[2],l=!0===h[3],n=h[2];l&&(n=h[2]),g=this.$locale(),!k&&n&&(g=e.Ls[n]),this.$d=function(c,d,e,f){try{if(["x","X"].indexOf(d)>-1)return new Date(("X"===d?1e3:1)*c);var h=(function(c){var d,e;d=c,e=g&&g.formats;for(var f=(c=d.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,function(b,c,d){var f=d&&d.toUpperCase();return c||e[d]||a[d]||e[f].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,function(a,b,c){return b||c.slice(1)})})).match(b),h=f.length,i=0;i<h;i+=1){var j=f[i],k=m[j],l=k&&k[0],n=k&&k[1];f[i]=n?{regex:l,parser:n}:j.replace(/^\[|\]$/g,"")}return function(a){for(var b={},c=0,d=0;c<h;c+=1){var e=f[c];if("string"==typeof e)d+=e.length;else{var g=e.regex,i=e.parser,j=a.slice(d),k=g.exec(j)[0];i.call(b,k),a=a.replace(k,"")}}return function(a){var b=a.afternoon;if(void 0!==b){var c=a.hours;b?c<12&&(a.hours+=12):12===c&&(a.hours=0),delete a.afternoon}}(b),b}})(d)(c),i=h.year,j=h.month,k=h.day,l=h.hours,n=h.minutes,o=h.seconds,p=h.milliseconds,q=h.zone,r=h.week,s=new Date,t=k||(i||j?1:s.getDate()),u=i||s.getFullYear(),v=0;i&&!j||(v=j>0?j-1:s.getMonth());var w,x=l||0,y=n||0,z=o||0,A=p||0;return q?new Date(Date.UTC(u,v,t,x,y,z,A+60*q.offset*1e3)):e?new Date(Date.UTC(u,v,t,x,y,z,A)):(w=new Date(u,v,t,x,y,z,A),r&&(w=f(w).week(r).toDate()),w)}catch(a){return new Date("")}}(d,j,f,e),this.init(),n&&!0!==n&&(this.$L=this.locale(n).$L),(k||l)&&d!=this.format(j)&&(this.$d=new Date("")),g={}}else if(j instanceof Array)for(var o=j.length,p=1;p<=o;p+=1){h[1]=j[p-1];var q=e.apply(this,h);if(q.isValid()){this.$d=q.$d,this.$L=q.$L,this.init();break}p===o&&(this.$d=new Date(""))}else i.call(this,c)}}}()},299474,(a,b,c)=>{a.e,b.exports=function(a,b){var c=b.prototype,d=c.format;c.format=function(a){var b=this,c=this.$locale();if(!this.isValid())return d.bind(this)(a);var e=this.$utils(),f=(a||"YYYY-MM-DDTHH:mm:ssZ").replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g,function(a){switch(a){case"Q":return Math.ceil((b.$M+1)/3);case"Do":return c.ordinal(b.$D);case"gggg":return b.weekYear();case"GGGG":return b.isoWeekYear();case"wo":return c.ordinal(b.week(),"W");case"w":case"ww":return e.s(b.week(),"w"===a?1:2,"0");case"W":case"WW":return e.s(b.isoWeek(),"W"===a?1:2,"0");case"k":case"kk":return e.s(String(0===b.$H?24:b.$H),"k"===a?1:2,"0");case"X":return Math.floor(b.$d.getTime()/1e3);case"x":return b.$d.getTime();case"z":return"["+b.offsetName()+"]";case"zzz":return"["+b.offsetName("long")+"]";default:return a}});return d.bind(this)(f)}}},141253,a=>{"use strict";var b,c,d,e=a.i(26384),f=a.i(128048),g=a.i(807128),h=a.i(878536),i=a.i(128994),j=a.i(902100),k=a.i(52550),l=a.i(299474);a.i(669877);var m=a.i(510790),n=a.i(860493),n=n,o=a.i(614396),o=o,p=a.i(596569),p=p,q=a.i(442933),r=a.i(885236),s=a.i(421353);let t=Math.PI/180,u=180/Math.PI,v=4/29,w=6/29,x=6/29*3*(6/29),y=6/29*(6/29)*(6/29);function z(a){if(a instanceof A)return new A(a.l,a.a,a.b,a.opacity);if(a instanceof G)return H(a);a instanceof s.Rgb||(a=(0,s.rgbConvert)(a));var b,c,d=E(a.r),e=E(a.g),f=E(a.b),g=B((.2225045*d+.7168786*e+.0606169*f)/1);return d===e&&e===f?b=c=g:(b=B((.4360747*d+.3850649*e+.1430804*f)/.96422),c=B((.0139322*d+.0971045*e+.7141733*f)/.82521)),new A(116*g-16,500*(b-g),200*(g-c),a.opacity)}function A(a,b,c,d){this.l=+a,this.a=+b,this.b=+c,this.opacity=+d}function B(a){return a>y?Math.pow(a,1/3):a/x+v}function C(a){return a>w?a*a*a:x*(a-v)}function D(a){return 255*(a<=.0031308?12.92*a:1.055*Math.pow(a,1/2.4)-.055)}function E(a){return(a/=255)<=.04045?a/12.92:Math.pow((a+.055)/1.055,2.4)}function F(a,b,c,d){return 1==arguments.length?function(a){if(a instanceof G)return new G(a.h,a.c,a.l,a.opacity);if(a instanceof A||(a=z(a)),0===a.a&&0===a.b)return new G(NaN,0<a.l&&a.l<100?0:NaN,a.l,a.opacity);var b=Math.atan2(a.b,a.a)*u;return new G(b<0?b+360:b,Math.sqrt(a.a*a.a+a.b*a.b),a.l,a.opacity)}(a):new G(a,b,c,null==d?1:d)}function G(a,b,c,d){this.h=+a,this.c=+b,this.l=+c,this.opacity=+d}function H(a){if(isNaN(a.h))return new A(a.l,0,0,a.opacity);var b=a.h*t;return new A(a.l,Math.cos(b)*a.c,Math.sin(b)*a.c,a.opacity)}(0,r.default)(A,function(a,b,c,d){return 1==arguments.length?z(a):new A(a,b,c,null==d?1:d)},(0,r.extend)(s.Color,{brighter(a){return new A(this.l+18*(null==a?1:a),this.a,this.b,this.opacity)},darker(a){return new A(this.l-18*(null==a?1:a),this.a,this.b,this.opacity)},rgb(){var a=(this.l+16)/116,b=isNaN(this.a)?a:a+this.a/500,c=isNaN(this.b)?a:a-this.b/200;return b=.96422*C(b),a=+C(a),c=.82521*C(c),new s.Rgb(D(3.1338561*b-1.6168667*a-.4906146*c),D(-.9787684*b+1.9161415*a+.033454*c),D(.0719453*b-.2289914*a+1.4052427*c),this.opacity)}})),(0,r.default)(G,F,(0,r.extend)(s.Color,{brighter(a){return new G(this.h,this.c,this.l+18*(null==a?1:a),this.opacity)},darker(a){return new G(this.h,this.c,this.l-18*(null==a?1:a),this.opacity)},rgb(){return H(this).rgb()}}));var I=a.i(522808);function J(a){return function(b,c){var d=a((b=F(b)).h,(c=F(c)).h),e=(0,I.default)(b.c,c.c),f=(0,I.default)(b.l,c.l),g=(0,I.default)(b.opacity,c.opacity);return function(a){return b.h=d(a),b.c=e(a),b.l=f(a),b.opacity=g(a),b+""}}}let K=J(I.hue);function L(a){return a}function M(a){return"translate("+a+",0)"}function N(a){return"translate(0,"+a+")"}function O(){return!this.__axis}function P(a,b){var c=[],d=null,e=null,f=6,g=6,h=3,i=.5,j=1===a||4===a?-1:1,k=4===a||2===a?"x":"y",l=1===a||3===a?M:N;function m(m){var n=null==d?b.ticks?b.ticks.apply(b,c):b.domain():d,o=null==e?b.tickFormat?b.tickFormat.apply(b,c):L:e,p=Math.max(f,0)+h,q=b.range(),r=+q[0]+i,s=+q[q.length-1]+i,t=(b.bandwidth?function(a,b){return b=Math.max(0,a.bandwidth()-2*b)/2,a.round()&&(b=Math.round(b)),c=>+a(c)+b}:function(a){return b=>+a(b)})(b.copy(),i),u=m.selection?m.selection():m,v=u.selectAll(".domain").data([null]),w=u.selectAll(".tick").data(n,b).order(),x=w.exit(),y=w.enter().append("g").attr("class","tick"),z=w.select("line"),A=w.select("text");v=v.merge(v.enter().insert("path",".tick").attr("class","domain").attr("stroke","currentColor")),w=w.merge(y),z=z.merge(y.append("line").attr("stroke","currentColor").attr(k+"2",j*f)),A=A.merge(y.append("text").attr("fill","currentColor").attr(k,j*p).attr("dy",1===a?"0em":3===a?"0.71em":"0.32em")),m!==u&&(v=v.transition(m),w=w.transition(m),z=z.transition(m),A=A.transition(m),x=x.transition(m).attr("opacity",1e-6).attr("transform",function(a){return isFinite(a=t(a))?l(a+i):this.getAttribute("transform")}),y.attr("opacity",1e-6).attr("transform",function(a){var b=this.parentNode.__axis;return l((b&&isFinite(b=b(a))?b:t(a))+i)})),x.remove(),v.attr("d",4===a||2===a?g?"M"+j*g+","+r+"H"+i+"V"+s+"H"+j*g:"M"+i+","+r+"V"+s:g?"M"+r+","+j*g+"V"+i+"H"+s+"V"+j*g:"M"+r+","+i+"H"+s),w.attr("opacity",1).attr("transform",function(a){return l(t(a)+i)}),z.attr(k+"2",j*f),A.attr(k,j*p).text(o),u.filter(O).attr("fill","none").attr("font-size",10).attr("font-family","sans-serif").attr("text-anchor",2===a?"start":4===a?"end":"middle"),u.each(function(){this.__axis=t})}return m.scale=function(a){return arguments.length?(b=a,m):b},m.ticks=function(){return c=Array.from(arguments),m},m.tickArguments=function(a){return arguments.length?(c=null==a?[]:Array.from(a),m):c.slice()},m.tickValues=function(a){return arguments.length?(d=null==a?null:Array.from(a),m):d&&d.slice()},m.tickFormat=function(a){return arguments.length?(e=a,m):e},m.tickSize=function(a){return arguments.length?(f=g=+a,m):f},m.tickSizeInner=function(a){return arguments.length?(f=+a,m):f},m.tickSizeOuter=function(a){return arguments.length?(g=+a,m):g},m.tickPadding=function(a){return arguments.length?(h=+a,m):h},m.offset=function(a){return arguments.length?(i=+a,m):i},m}J(I.default);var Q=a.i(403463),R=a.i(622760),R=R,S=a.i(376489),T=a.i(346053),U=a.i(512403),V=a.i(220244),W=a.i(326865),X=a.i(576681),Y=function(){var a=(0,g.__name)(function(a,b,c,d){for(c=c||{},d=a.length;d--;c[a[d]]=b);return c},"o"),b=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],c=[1,26],d=[1,27],e=[1,28],f=[1,29],h=[1,30],i=[1,31],j=[1,32],k=[1,33],l=[1,34],m=[1,9],n=[1,10],o=[1,11],p=[1,12],q=[1,13],r=[1,14],s=[1,15],t=[1,16],u=[1,19],v=[1,20],w=[1,21],x=[1,22],y=[1,23],z=[1,25],A=[1,35],B={trace:(0,g.__name)(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:(0,g.__name)(function(a,b,c,d,e,f,g){var h=f.length-1;switch(e){case 1:return f[h-1];case 2:case 6:case 7:this.$=[];break;case 3:f[h-1].push(f[h]),this.$=f[h-1];break;case 4:case 5:this.$=f[h];break;case 8:d.setWeekday("monday");break;case 9:d.setWeekday("tuesday");break;case 10:d.setWeekday("wednesday");break;case 11:d.setWeekday("thursday");break;case 12:d.setWeekday("friday");break;case 13:d.setWeekday("saturday");break;case 14:d.setWeekday("sunday");break;case 15:d.setWeekend("friday");break;case 16:d.setWeekend("saturday");break;case 17:d.setDateFormat(f[h].substr(11)),this.$=f[h].substr(11);break;case 18:d.enableInclusiveEndDates(),this.$=f[h].substr(18);break;case 19:d.TopAxis(),this.$=f[h].substr(8);break;case 20:d.setAxisFormat(f[h].substr(11)),this.$=f[h].substr(11);break;case 21:d.setTickInterval(f[h].substr(13)),this.$=f[h].substr(13);break;case 22:d.setExcludes(f[h].substr(9)),this.$=f[h].substr(9);break;case 23:d.setIncludes(f[h].substr(9)),this.$=f[h].substr(9);break;case 24:d.setTodayMarker(f[h].substr(12)),this.$=f[h].substr(12);break;case 27:d.setDiagramTitle(f[h].substr(6)),this.$=f[h].substr(6);break;case 28:this.$=f[h].trim(),d.setAccTitle(this.$);break;case 29:case 30:this.$=f[h].trim(),d.setAccDescription(this.$);break;case 31:d.addSection(f[h].substr(8)),this.$=f[h].substr(8);break;case 33:d.addTask(f[h-1],f[h]),this.$="task";break;case 34:this.$=f[h-1],d.setClickEvent(f[h-1],f[h],null);break;case 35:this.$=f[h-2],d.setClickEvent(f[h-2],f[h-1],f[h]);break;case 36:this.$=f[h-2],d.setClickEvent(f[h-2],f[h-1],null),d.setLink(f[h-2],f[h]);break;case 37:this.$=f[h-3],d.setClickEvent(f[h-3],f[h-2],f[h-1]),d.setLink(f[h-3],f[h]);break;case 38:this.$=f[h-2],d.setClickEvent(f[h-2],f[h],null),d.setLink(f[h-2],f[h-1]);break;case 39:this.$=f[h-3],d.setClickEvent(f[h-3],f[h-1],f[h]),d.setLink(f[h-3],f[h-2]);break;case 40:this.$=f[h-1],d.setLink(f[h-1],f[h]);break;case 41:case 47:this.$=f[h-1]+" "+f[h];break;case 42:case 43:case 45:this.$=f[h-2]+" "+f[h-1]+" "+f[h];break;case 44:case 46:this.$=f[h-3]+" "+f[h-2]+" "+f[h-1]+" "+f[h]}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},a(b,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:c,13:d,14:e,15:f,16:h,17:i,18:j,19:18,20:k,21:l,22:m,23:n,24:o,25:p,26:q,27:r,28:s,29:t,30:u,31:v,33:w,35:x,36:y,37:24,38:z,40:A},a(b,[2,7],{1:[2,1]}),a(b,[2,3]),{9:36,11:17,12:c,13:d,14:e,15:f,16:h,17:i,18:j,19:18,20:k,21:l,22:m,23:n,24:o,25:p,26:q,27:r,28:s,29:t,30:u,31:v,33:w,35:x,36:y,37:24,38:z,40:A},a(b,[2,5]),a(b,[2,6]),a(b,[2,17]),a(b,[2,18]),a(b,[2,19]),a(b,[2,20]),a(b,[2,21]),a(b,[2,22]),a(b,[2,23]),a(b,[2,24]),a(b,[2,25]),a(b,[2,26]),a(b,[2,27]),{32:[1,37]},{34:[1,38]},a(b,[2,30]),a(b,[2,31]),a(b,[2,32]),{39:[1,39]},a(b,[2,8]),a(b,[2,9]),a(b,[2,10]),a(b,[2,11]),a(b,[2,12]),a(b,[2,13]),a(b,[2,14]),a(b,[2,15]),a(b,[2,16]),{41:[1,40],43:[1,41]},a(b,[2,4]),a(b,[2,28]),a(b,[2,29]),a(b,[2,33]),a(b,[2,34],{42:[1,42],43:[1,43]}),a(b,[2,40],{41:[1,44]}),a(b,[2,35],{43:[1,45]}),a(b,[2,36]),a(b,[2,38],{42:[1,46]}),a(b,[2,37]),a(b,[2,39])],defaultActions:{},parseError:(0,g.__name)(function(a,b){if(b.recoverable)this.trace(a);else{var c=Error(a);throw c.hash=b,c}},"parseError"),parse:(0,g.__name)(function(a){var b=this,c=[0],d=[],e=[null],f=[],h=this.table,i="",j=0,k=0,l=0,m=f.slice.call(arguments,1),n=Object.create(this.lexer),o={};for(var p in this.yy)Object.prototype.hasOwnProperty.call(this.yy,p)&&(o[p]=this.yy[p]);n.setInput(a,o),o.lexer=n,o.parser=this,void 0===n.yylloc&&(n.yylloc={});var q=n.yylloc;f.push(q);var r=n.options&&n.options.ranges;function s(){var a;return"number"!=typeof(a=d.pop()||n.lex()||1)&&(a instanceof Array&&(a=(d=a).pop()),a=b.symbols_[a]||a),a}"function"==typeof o.parseError?this.parseError=o.parseError:this.parseError=Object.getPrototypeOf(this).parseError,(0,g.__name)(function(a){c.length=c.length-2*a,e.length=e.length-a,f.length=f.length-a},"popStack"),(0,g.__name)(s,"lex");for(var t,u,v,w,x,y,z,A,B,C={};;){if(v=c[c.length-1],this.defaultActions[v]?w=this.defaultActions[v]:(null==t&&(t=s()),w=h[v]&&h[v][t]),void 0===w||!w.length||!w[0]){var D="";for(y in B=[],h[v])this.terminals_[y]&&y>2&&B.push("'"+this.terminals_[y]+"'");D=n.showPosition?"Parse error on line "+(j+1)+":\n"+n.showPosition()+"\nExpecting "+B.join(", ")+", got '"+(this.terminals_[t]||t)+"'":"Parse error on line "+(j+1)+": Unexpected "+(1==t?"end of input":"'"+(this.terminals_[t]||t)+"'"),this.parseError(D,{text:n.match,token:this.terminals_[t]||t,line:n.yylineno,loc:q,expected:B})}if(w[0]instanceof Array&&w.length>1)throw Error("Parse Error: multiple actions possible at state: "+v+", token: "+t);switch(w[0]){case 1:c.push(t),e.push(n.yytext),f.push(n.yylloc),c.push(w[1]),t=null,u?(t=u,u=null):(k=n.yyleng,i=n.yytext,j=n.yylineno,q=n.yylloc,l>0&&l--);break;case 2:if(z=this.productions_[w[1]][1],C.$=e[e.length-z],C._$={first_line:f[f.length-(z||1)].first_line,last_line:f[f.length-1].last_line,first_column:f[f.length-(z||1)].first_column,last_column:f[f.length-1].last_column},r&&(C._$.range=[f[f.length-(z||1)].range[0],f[f.length-1].range[1]]),void 0!==(x=this.performAction.apply(C,[i,k,j,o,w[1],e,f].concat(m))))return x;z&&(c=c.slice(0,-1*z*2),e=e.slice(0,-1*z),f=f.slice(0,-1*z)),c.push(this.productions_[w[1]][0]),e.push(C.$),f.push(C._$),A=h[c[c.length-2]][c[c.length-1]],c.push(A);break;case 3:return!0}}return!0},"parse")};function C(){this.yy={}}return B.lexer={EOF:1,parseError:(0,g.__name)(function(a,b){if(this.yy.parser)this.yy.parser.parseError(a,b);else throw Error(a)},"parseError"),setInput:(0,g.__name)(function(a,b){return this.yy=b||this.yy||{},this._input=a,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:(0,g.__name)(function(){var a=this._input[0];return this.yytext+=a,this.yyleng++,this.offset++,this.match+=a,this.matched+=a,a.match(/(?:\r\n?|\n).*/g)?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),a},"input"),unput:(0,g.__name)(function(a){var b=a.length,c=a.split(/(?:\r\n?|\n)/g);this._input=a+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-b),this.offset-=b;var d=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),c.length-1&&(this.yylineno-=c.length-1);var e=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:c?(c.length===d.length?this.yylloc.first_column:0)+d[d.length-c.length].length-c[0].length:this.yylloc.first_column-b},this.options.ranges&&(this.yylloc.range=[e[0],e[0]+this.yyleng-b]),this.yyleng=this.yytext.length,this},"unput"),more:(0,g.__name)(function(){return this._more=!0,this},"more"),reject:(0,g.__name)(function(){return this.options.backtrack_lexer?(this._backtrack=!0,this):this.parseError("Lexical error on line "+(this.yylineno+1)+". You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},"reject"),less:(0,g.__name)(function(a){this.unput(this.match.slice(a))},"less"),pastInput:(0,g.__name)(function(){var a=this.matched.substr(0,this.matched.length-this.match.length);return(a.length>20?"...":"")+a.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:(0,g.__name)(function(){var a=this.match;return a.length<20&&(a+=this._input.substr(0,20-a.length)),(a.substr(0,20)+(a.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:(0,g.__name)(function(){var a=this.pastInput(),b=Array(a.length+1).join("-");return a+this.upcomingInput()+"\n"+b+"^"},"showPosition"),test_match:(0,g.__name)(function(a,b){var c,d,e;if(this.options.backtrack_lexer&&(e={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(e.yylloc.range=this.yylloc.range.slice(0))),(d=a[0].match(/(?:\r\n?|\n).*/g))&&(this.yylineno+=d.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:d?d[d.length-1].length-d[d.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+a[0].length},this.yytext+=a[0],this.match+=a[0],this.matches=a,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(a[0].length),this.matched+=a[0],c=this.performAction.call(this,this.yy,this,b,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),c)return c;if(this._backtrack)for(var f in e)this[f]=e[f];return!1},"test_match"),next:(0,g.__name)(function(){if(this.done)return this.EOF;this._input||(this.done=!0),this._more||(this.yytext="",this.match="");for(var a,b,c,d,e=this._currentRules(),f=0;f<e.length;f++)if((c=this._input.match(this.rules[e[f]]))&&(!b||c[0].length>b[0].length)){if(b=c,d=f,this.options.backtrack_lexer){if(!1!==(a=this.test_match(c,e[f])))return a;if(!this._backtrack)return!1;b=!1;continue}if(!this.options.flex)break}return b?!1!==(a=this.test_match(b,e[d]))&&a:""===this._input?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+". Unrecognized text.\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:(0,g.__name)(function(){var a=this.next();return a||this.lex()},"lex"),begin:(0,g.__name)(function(a){this.conditionStack.push(a)},"begin"),popState:(0,g.__name)(function(){return this.conditionStack.length-1>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:(0,g.__name)(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:(0,g.__name)(function(a){return(a=this.conditionStack.length-1-Math.abs(a||0))>=0?this.conditionStack[a]:"INITIAL"},"topState"),pushState:(0,g.__name)(function(a){this.begin(a)},"pushState"),stateStackSize:(0,g.__name)(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:(0,g.__name)(function(a,b,c,d){switch(c){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),31;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),33;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:case 15:case 18:case 21:case 24:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:case 9:case 10:case 12:case 13:break;case 11:return 10;case 14:this.begin("href");break;case 16:return 43;case 17:this.begin("callbackname");break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 22:return 42;case 23:this.begin("click");break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}},(0,g.__name)(C,"Parser"),C.prototype=B,B.Parser=C,new C}();Y.parser=Y,i.default.extend(j.default),i.default.extend(k.default),i.default.extend(l.default);var Z={friday:5,saturday:6},$="",_="",aa=void 0,ab="",ac=[],ad=[],ae=new Map,af=[],ag=[],ah="",ai="",aj=["active","done","crit","milestone","vert"],ak=[],al=!1,am=!1,an="sunday",ao="saturday",ap=0,aq=(0,g.__name)(function(){af=[],ag=[],ah="",ak=[],aW=0,b=void 0,c=void 0,a$=[],$="",_="",ai="",aa=void 0,ab="",ac=[],ad=[],al=!1,am=!1,ap=0,ae=new Map,(0,f.clear)(),an="sunday",ao="saturday"},"clear"),ar=(0,g.__name)(function(a){_=a},"setAxisFormat"),as=(0,g.__name)(function(){return _},"getAxisFormat"),at=(0,g.__name)(function(a){aa=a},"setTickInterval"),au=(0,g.__name)(function(){return aa},"getTickInterval"),av=(0,g.__name)(function(a){ab=a},"setTodayMarker"),aw=(0,g.__name)(function(){return ab},"getTodayMarker"),ax=(0,g.__name)(function(a){$=a},"setDateFormat"),ay=(0,g.__name)(function(){al=!0},"enableInclusiveEndDates"),az=(0,g.__name)(function(){return al},"endDatesAreInclusive"),aA=(0,g.__name)(function(){am=!0},"enableTopAxis"),aB=(0,g.__name)(function(){return am},"topAxisEnabled"),aC=(0,g.__name)(function(a){ai=a},"setDisplayMode"),aD=(0,g.__name)(function(){return ai},"getDisplayMode"),aE=(0,g.__name)(function(){return $},"getDateFormat"),aF=(0,g.__name)(function(a){ac=a.toLowerCase().split(/[\s,]+/)},"setIncludes"),aG=(0,g.__name)(function(){return ac},"getIncludes"),aH=(0,g.__name)(function(a){ad=a.toLowerCase().split(/[\s,]+/)},"setExcludes"),aI=(0,g.__name)(function(){return ad},"getExcludes"),aJ=(0,g.__name)(function(){return ae},"getLinks"),aK=(0,g.__name)(function(a){ah=a,af.push(a)},"addSection"),aL=(0,g.__name)(function(){return af},"getSections"),aM=(0,g.__name)(function(){let a=a3(),b=0;for(;!a&&b<10;)a=a3(),b++;return ag=a$},"getTasks"),aN=(0,g.__name)(function(a,b,c,d){let e=a.format(b.trim()),f=a.format("YYYY-MM-DD");return!(d.includes(e)||d.includes(f))&&(!!(c.includes("weekends")&&(a.isoWeekday()===Z[ao]||a.isoWeekday()===Z[ao]+1)||c.includes(a.format("dddd").toLowerCase()))||c.includes(e)||c.includes(f))},"isInvalidDate"),aO=(0,g.__name)(function(a){an=a},"setWeekday"),aP=(0,g.__name)(function(){return an},"getWeekday"),aQ=(0,g.__name)(function(a){ao=a},"setWeekend"),aR=(0,g.__name)(function(a,b,c,d){let e;if(!c.length||a.manualEndTime)return;let[f,g]=aS(e=(e=a.startTime instanceof Date?(0,i.default)(a.startTime):(0,i.default)(a.startTime,b,!0)).add(1,"d"),a.endTime instanceof Date?(0,i.default)(a.endTime):(0,i.default)(a.endTime,b,!0),b,c,d);a.endTime=f.toDate(),a.renderEndTime=g},"checkTaskDates"),aS=(0,g.__name)(function(a,b,c,d,e){let f=!1,g=null;for(;a<=b;)f||(g=b.toDate()),(f=aN(a,c,d,e))&&(b=b.add(1,"d")),a=a.add(1,"d");return[b,g]},"fixTaskDates"),aT=(0,g.__name)(function(a,b,c){if(c=c.trim(),("x"===b.trim()||"X"===b.trim())&&/^\d+$/.test(c))return new Date(Number(c));let d=/^after\s+(?<ids>[\d\w- ]+)/.exec(c);if(null!==d){let a=null;for(let b of d.groups.ids.split(" ")){let c=a1(b);void 0!==c&&(!a||c.endTime>a.endTime)&&(a=c)}if(a)return a.endTime;let b=new Date;return b.setHours(0,0,0,0),b}let e=(0,i.default)(c,b.trim(),!0);if(e.isValid())return e.toDate();{g.log.debug("Invalid date:"+c),g.log.debug("With date format:"+b.trim());let a=new Date(c);if(void 0===a||isNaN(a.getTime())||-1e4>a.getFullYear()||a.getFullYear()>1e4)throw Error("Invalid date:"+c);return a}},"getStartDate"),aU=(0,g.__name)(function(a){let b=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(a.trim());return null!==b?[Number.parseFloat(b[1]),b[2]]:[NaN,"ms"]},"parseDuration"),aV=(0,g.__name)(function(a,b,c,d=!1){c=c.trim();let e=/^until\s+(?<ids>[\d\w- ]+)/.exec(c);if(null!==e){let a=null;for(let b of e.groups.ids.split(" ")){let c=a1(b);void 0!==c&&(!a||c.startTime<a.startTime)&&(a=c)}if(a)return a.startTime;let b=new Date;return b.setHours(0,0,0,0),b}let f=(0,i.default)(c,b.trim(),!0);if(f.isValid())return d&&(f=f.add(1,"d")),f.toDate();let g=(0,i.default)(a),[h,j]=aU(c);if(!Number.isNaN(h)){let a=g.add(h,j);a.isValid()&&(g=a)}return g.toDate()},"getEndDate"),aW=0,aX=(0,g.__name)(function(a){return void 0===a?"task"+(aW+=1):a},"parseId"),aY=(0,g.__name)(function(a,b){let c=(":"===b.substr(0,1)?b.substr(1,b.length):b).split(","),d={};bb(c,d,aj);for(let a=0;a<c.length;a++)c[a]=c[a].trim();let e="";switch(c.length){case 1:d.id=aX(),d.startTime=a.endTime,e=c[0];break;case 2:d.id=aX(),d.startTime=aT(void 0,$,c[0]),e=c[1];break;case 3:d.id=aX(c[0]),d.startTime=aT(void 0,$,c[1]),e=c[2]}return e&&(d.endTime=aV(d.startTime,$,e,al),d.manualEndTime=(0,i.default)(e,"YYYY-MM-DD",!0).isValid(),aR(d,$,ad,ac)),d},"compileData"),aZ=(0,g.__name)(function(a,b){let c=(":"===b.substr(0,1)?b.substr(1,b.length):b).split(","),d={};bb(c,d,aj);for(let a=0;a<c.length;a++)c[a]=c[a].trim();switch(c.length){case 1:d.id=aX(),d.startTime={type:"prevTaskEnd",id:a},d.endTime={data:c[0]};break;case 2:d.id=aX(),d.startTime={type:"getStartDate",startData:c[0]},d.endTime={data:c[1]};break;case 3:d.id=aX(c[0]),d.startTime={type:"getStartDate",startData:c[1]},d.endTime={data:c[2]}}return d},"parseData"),a$=[],a_={},a0=(0,g.__name)(function(a,b){let d={section:ah,type:ah,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:b},task:a,classes:[]},e=aZ(c,b);d.raw.startTime=e.startTime,d.raw.endTime=e.endTime,d.id=e.id,d.prevTaskId=c,d.active=e.active,d.done=e.done,d.crit=e.crit,d.milestone=e.milestone,d.vert=e.vert,d.order=ap,ap++;let f=a$.push(d);c=d.id,a_[d.id]=f-1},"addTask"),a1=(0,g.__name)(function(a){return a$[a_[a]]},"findTaskById"),a2=(0,g.__name)(function(a,c){let d={section:ah,type:ah,description:a,task:a,classes:[]},e=aY(b,c);d.startTime=e.startTime,d.endTime=e.endTime,d.id=e.id,d.active=e.active,d.done=e.done,d.crit=e.crit,d.milestone=e.milestone,d.vert=e.vert,b=d,ag.push(d)},"addTaskOrg"),a3=(0,g.__name)(function(){let a=(0,g.__name)(function(a){let b=a$[a],c="";switch(a$[a].raw.startTime.type){case"prevTaskEnd":{let a=a1(b.prevTaskId);b.startTime=a.endTime;break}case"getStartDate":(c=aT(void 0,$,a$[a].raw.startTime.startData))&&(a$[a].startTime=c)}return a$[a].startTime&&(a$[a].endTime=aV(a$[a].startTime,$,a$[a].raw.endTime.data,al),a$[a].endTime&&(a$[a].processed=!0,a$[a].manualEndTime=(0,i.default)(a$[a].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),aR(a$[a],$,ad,ac))),a$[a].processed},"compileTask"),b=!0;for(let[c,d]of a$.entries())a(c),b=b&&d.processed;return b},"compileTasks"),a4=(0,g.__name)(function(a,b){let c=b;"loose"!==(0,f.getConfig2)().securityLevel&&(c=(0,h.sanitizeUrl)(b)),a.split(",").forEach(function(a){void 0!==a1(a)&&(a7(a,()=>{window.open(c,"_self")}),ae.set(a,c))}),a5(a,"clickable")},"setLink"),a5=(0,g.__name)(function(a,b){a.split(",").forEach(function(a){let c=a1(a);void 0!==c&&c.classes.push(b)})},"setClass"),a6=(0,g.__name)(function(a,b,c){if("loose"!==(0,f.getConfig2)().securityLevel||void 0===b)return;let d=[];if("string"==typeof c){d=c.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let a=0;a<d.length;a++){let b=d[a].trim();b.startsWith('"')&&b.endsWith('"')&&(b=b.substr(1,b.length-2)),d[a]=b}}0===d.length&&d.push(a),void 0!==a1(a)&&a7(a,()=>{e.utils_default.runFunc(b,...d)})},"setClickFun"),a7=(0,g.__name)(function(a,b){ak.push(function(){let c=document.querySelector(`[id="${a}"]`);null!==c&&c.addEventListener("click",function(){b()})},function(){let c=document.querySelector(`[id="${a}-text"]`);null!==c&&c.addEventListener("click",function(){b()})})},"pushFun"),a8=(0,g.__name)(function(a,b,c){a.split(",").forEach(function(a){a6(a,b,c)}),a5(a,"clickable")},"setClickEvent"),a9=(0,g.__name)(function(a){ak.forEach(function(b){b(a)})},"bindFunctions"),ba={getConfig:(0,g.__name)(()=>(0,f.getConfig2)().gantt,"getConfig"),clear:aq,setDateFormat:ax,getDateFormat:aE,enableInclusiveEndDates:ay,endDatesAreInclusive:az,enableTopAxis:aA,topAxisEnabled:aB,setAxisFormat:ar,getAxisFormat:as,setTickInterval:at,getTickInterval:au,setTodayMarker:av,getTodayMarker:aw,setAccTitle:f.setAccTitle,getAccTitle:f.getAccTitle,setDiagramTitle:f.setDiagramTitle,getDiagramTitle:f.getDiagramTitle,setDisplayMode:aC,getDisplayMode:aD,setAccDescription:f.setAccDescription,getAccDescription:f.getAccDescription,addSection:aK,getSections:aL,getTasks:aM,addTask:a0,findTaskById:a1,addTaskOrg:a2,setIncludes:aF,getIncludes:aG,setExcludes:aH,getExcludes:aI,setClickEvent:a8,setLink:a4,getLinks:aJ,bindFunctions:a9,parseDuration:aU,isInvalidDate:aN,setWeekday:aO,getWeekday:aP,setWeekend:aQ};function bb(a,b,c){let d=!0;for(;d;)d=!1,c.forEach(function(c){let e=RegExp("^\\s*"+c+"\\s*$");a[0].match(e)&&(b[c]=!0,a.shift(1),d=!0)})}(0,g.__name)(bb,"getTaskTags");var bc=(0,g.__name)(function(){g.log.debug("Something is calling, setConf, remove the call")},"setConf"),bd={monday:W.timeMonday,tuesday:W.timeTuesday,wednesday:W.timeWednesday,thursday:W.timeThursday,friday:W.timeFriday,saturday:W.timeSaturday,sunday:W.timeSunday},be=(0,g.__name)((a,b)=>{let c=[...a].map(()=>-1/0),d=[...a].sort((a,b)=>a.startTime-b.startTime||a.order-b.order),e=0;for(let a of d)for(let d=0;d<c.length;d++)if(a.startTime>=c[d]){c[d]=a.endTime,a.order=d+b,d>e&&(e=d);break}return e},"getMaxIntersections"),bf={parser:Y,db:ba,renderer:{setConf:bc,draw:(0,g.__name)(function(a,b,c,e){let h,j=(0,f.getConfig2)().gantt,k=(0,f.getConfig2)().securityLevel;"sandbox"===k&&(h=(0,m.select)("#i"+b));let l="sandbox"===k?(0,m.select)(h.nodes()[0].contentDocument.body):(0,m.select)("body"),r="sandbox"===k?h.nodes()[0].contentDocument:document,s=r.getElementById(b);void 0===(d=s.parentElement.offsetWidth)&&(d=1200),void 0!==j.useWidth&&(d=j.useWidth);let t=e.db.getTasks(),u=[];for(let a of t)u.push(a.type);u=G(u);let v={},w=2*j.topPadding;if("compact"===e.db.getDisplayMode()||"compact"===j.displayMode){let a={};for(let b of t)void 0===a[b.section]?a[b.section]=[b]:a[b.section].push(b);let b=0;for(let c of Object.keys(a)){let d=be(a[c],b)+1;b+=d,w+=d*(j.barHeight+j.barGap),v[c]=d}}else for(let a of(w+=t.length*(j.barHeight+j.barGap),u))v[a]=t.filter(b=>b.type===a).length;s.setAttribute("viewBox","0 0 "+d+" "+w);let x=l.select(`[id="${b}"]`),y=(0,n.default)().domain([(0,o.default)(t,function(a){return a.startTime}),(0,p.default)(t,function(a){return a.endTime})]).rangeRound([0,d-j.leftPadding-j.rightPadding]);function z(a,b){let c=a.startTime,d=b.startTime,e=0;return c>d?e=1:c<d&&(e=-1),e}function A(a,b,c){let d=j.barHeight,f=d+j.barGap,g=j.topPadding,h=j.leftPadding,i=(0,q.scaleLinear)().domain([0,u.length]).range(["#00B9FA","#F95002"]).interpolate(K);C(f,g,h,b,c,a,e.db.getExcludes(),e.db.getIncludes()),D(h,g,b,c),B(a,f,g,h,d,i,b,c),E(f,g,h,d,i),F(h,g,b,c)}function B(a,c,d,g,h,i,k){a.sort((a,b)=>a.vert===b.vert?0:a.vert?1:-1);let l=[...new Set(a.map(a=>a.order))].map(b=>a.find(a=>a.order===b));x.append("g").selectAll("rect").data(l).enter().append("rect").attr("x",0).attr("y",function(a,b){return a.order*c+d-2}).attr("width",function(){return k-j.rightPadding/2}).attr("height",c).attr("class",function(a){for(let[b,c]of u.entries())if(a.type===c)return"section section"+b%j.numberSectionStyles;return"section section0"}).enter();let n=x.append("g").selectAll("rect").data(a).enter(),o=e.db.getLinks();if(n.append("rect").attr("id",function(a){return a.id}).attr("rx",3).attr("ry",3).attr("x",function(a){return a.milestone?y(a.startTime)+g+.5*(y(a.endTime)-y(a.startTime))-.5*h:y(a.startTime)+g}).attr("y",function(a,b){return(b=a.order,a.vert)?j.gridLineStartPadding:b*c+d}).attr("width",function(a){return a.milestone?h:a.vert?.08*h:y(a.renderEndTime||a.endTime)-y(a.startTime)}).attr("height",function(a){return a.vert?t.length*(j.barHeight+j.barGap)+2*j.barHeight:h}).attr("transform-origin",function(a,b){return b=a.order,(y(a.startTime)+g+.5*(y(a.endTime)-y(a.startTime))).toString()+"px "+(b*c+d+.5*h).toString()+"px"}).attr("class",function(a){let b="";a.classes.length>0&&(b=a.classes.join(" "));let c=0;for(let[b,d]of u.entries())a.type===d&&(c=b%j.numberSectionStyles);let d="";return a.active?a.crit?d+=" activeCrit":d=" active":a.done?d=a.crit?" doneCrit":" done":a.crit&&(d+=" crit"),0===d.length&&(d=" task"),a.milestone&&(d=" milestone "+d),a.vert&&(d=" vert "+d),d+=c,"task"+(d+=" "+b)}),n.append("text").attr("id",function(a){return a.id+"-text"}).text(function(a){return a.task}).attr("font-size",j.fontSize).attr("x",function(a){let b=y(a.startTime),c=y(a.renderEndTime||a.endTime);if(a.milestone&&(b+=.5*(y(a.endTime)-y(a.startTime))-.5*h,c=b+h),a.vert)return y(a.startTime)+g;let d=this.getBBox().width;return d>c-b?c+d+1.5*j.leftPadding>k?b+g-5:c+g+5:(c-b)/2+b+g}).attr("y",function(a,b){return a.vert?j.gridLineStartPadding+t.length*(j.barHeight+j.barGap)+60:a.order*c+j.barHeight/2+(j.fontSize/2-2)+d}).attr("text-height",h).attr("class",function(a){let b=y(a.startTime),c=y(a.endTime);a.milestone&&(c=b+h);let d=this.getBBox().width,e="";a.classes.length>0&&(e=a.classes.join(" "));let f=0;for(let[b,c]of u.entries())a.type===c&&(f=b%j.numberSectionStyles);let g="";return(a.active&&(g=a.crit?"activeCritText"+f:"activeText"+f),a.done?g=a.crit?g+" doneCritText"+f:g+" doneText"+f:a.crit&&(g=g+" critText"+f),a.milestone&&(g+=" milestoneText"),a.vert&&(g+=" vertText"),d>c-b)?c+d+1.5*j.leftPadding>k?e+" taskTextOutsideLeft taskTextOutside"+f+" "+g:e+" taskTextOutsideRight taskTextOutside"+f+" "+g+" width-"+d:e+" taskText taskText"+f+" "+g+" width-"+d}),"sandbox"===(0,f.getConfig2)().securityLevel){let a=(0,m.select)("#i"+b).nodes()[0].contentDocument;n.filter(function(a){return o.has(a.id)}).each(function(b){var c=a.querySelector("#"+b.id),d=a.querySelector("#"+b.id+"-text");let e=c.parentNode;var f=a.createElement("a");f.setAttribute("xlink:href",o.get(b.id)),f.setAttribute("target","_top"),e.appendChild(f),f.appendChild(c),f.appendChild(d)})}}function C(a,b,c,d,f,h,k,l){let m,n;if(0===k.length&&0===l.length)return;for(let{startTime:a,endTime:b}of h)(void 0===m||a<m)&&(m=a),(void 0===n||b>n)&&(n=b);if(!m||!n)return;if((0,i.default)(n).diff((0,i.default)(m),"year")>5)return void g.log.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");let o=e.db.getDateFormat(),p=[],q=null,r=(0,i.default)(m);for(;r.valueOf()<=n;)e.db.isInvalidDate(r,o,k,l)?q?q.end=r:q={start:r,end:r}:q&&(p.push(q),q=null),r=r.add(1,"d");x.append("g").selectAll("rect").data(p).enter().append("rect").attr("id",a=>"exclude-"+a.start.format("YYYY-MM-DD")).attr("x",a=>y(a.start.startOf("day"))+c).attr("y",j.gridLineStartPadding).attr("width",a=>y(a.end.endOf("day"))-y(a.start.startOf("day"))).attr("height",f-b-j.gridLineStartPadding).attr("transform-origin",function(b,d){return(y(b.start)+c+.5*(y(b.end)-y(b.start))).toString()+"px "+(d*a+.5*f).toString()+"px"}).attr("class","exclude-range")}function D(a,b,c,d){let f,g=e.db.getDateFormat(),h=e.db.getAxisFormat();f=h||("D"===g?"%d":j.axisFormat??"%Y-%m-%d");let i=P(3,y).tickSize(-d+b+j.gridLineStartPadding).tickFormat((0,Q.timeFormat)(f)),k=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(e.db.getTickInterval()||j.tickInterval);if(null!==k){let a=k[1],b=k[2],c=e.db.getWeekday()||j.weekday;switch(b){case"millisecond":i.ticks(R.millisecond.every(a));break;case"second":i.ticks(S.timeSecond.every(a));break;case"minute":i.ticks(T.timeMinute.every(a));break;case"hour":i.ticks(U.timeHour.every(a));break;case"day":i.ticks(V.timeDay.every(a));break;case"week":i.ticks(bd[c].every(a));break;case"month":i.ticks(X.timeMonth.every(a))}}if(x.append("g").attr("class","grid").attr("transform","translate("+a+", "+(d-50)+")").call(i).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),e.db.topAxisEnabled()||j.topAxis){let c=P(1,y).tickSize(-d+b+j.gridLineStartPadding).tickFormat((0,Q.timeFormat)(f));if(null!==k){let a=k[1],b=k[2],d=e.db.getWeekday()||j.weekday;switch(b){case"millisecond":c.ticks(R.millisecond.every(a));break;case"second":c.ticks(S.timeSecond.every(a));break;case"minute":c.ticks(T.timeMinute.every(a));break;case"hour":c.ticks(U.timeHour.every(a));break;case"day":c.ticks(V.timeDay.every(a));break;case"week":c.ticks(bd[d].every(a));break;case"month":c.ticks(X.timeMonth.every(a))}}x.append("g").attr("class","grid").attr("transform","translate("+a+", "+b+")").call(c).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}function E(a,b){let c=0,d=Object.keys(v).map(a=>[a,v[a]]);x.append("g").selectAll("text").data(d).enter().append(function(a){let b=a[0].split(f.common_default.lineBreakRegex),c=-(b.length-1)/2,d=r.createElementNS("http://www.w3.org/2000/svg","text");for(let[a,e]of(d.setAttribute("dy",c+"em"),b.entries())){let b=r.createElementNS("http://www.w3.org/2000/svg","tspan");b.setAttribute("alignment-baseline","central"),b.setAttribute("x","10"),a>0&&b.setAttribute("dy","1em"),b.textContent=e,d.appendChild(b)}return d}).attr("x",10).attr("y",function(e,f){if(!(f>0))return e[1]*a/2+b;for(let g=0;g<f;g++)return c+=d[f-1][1],e[1]*a/2+c*a+b}).attr("font-size",j.sectionFontSize).attr("class",function(a){for(let[b,c]of u.entries())if(a[0]===c)return"sectionTitle sectionTitle"+b%j.numberSectionStyles;return"sectionTitle"})}function F(a,b,c,d){let f=e.db.getTodayMarker();if("off"===f)return;let g=x.append("g").attr("class","today"),h=new Date,i=g.append("line");i.attr("x1",y(h)+a).attr("x2",y(h)+a).attr("y1",j.titleTopMargin).attr("y2",d-j.titleTopMargin).attr("class","today"),""!==f&&i.attr("style",f.replace(/,/g,";"))}function G(a){let b={},c=[];for(let d=0,e=a.length;d<e;++d)Object.prototype.hasOwnProperty.call(b,a[d])||(b[a[d]]=!0,c.push(a[d]));return c}(0,g.__name)(z,"taskCompare"),t.sort(z),A(t,d,w),(0,f.configureSvgSize)(x,w,d,j.useMaxWidth),x.append("text").text(e.db.getDiagramTitle()).attr("x",d/2).attr("y",j.titleTopMargin).attr("class","titleText"),(0,g.__name)(A,"makeGantt"),(0,g.__name)(B,"drawRects"),(0,g.__name)(C,"drawExcludeDays"),(0,g.__name)(D,"makeGrid"),(0,g.__name)(E,"vertLabels"),(0,g.__name)(F,"drawToday"),(0,g.__name)(G,"checkUnique")},"draw")},styles:(0,g.__name)(a=>`
  .mermaid-main-font {
        font-family: ${a.fontFamily};
  }

  .exclude-range {
    fill: ${a.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${a.sectionBkgColor};
  }

  .section2 {
    fill: ${a.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${a.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${a.titleColor};
  }

  .sectionTitle1 {
    fill: ${a.titleColor};
  }

  .sectionTitle2 {
    fill: ${a.titleColor};
  }

  .sectionTitle3 {
    fill: ${a.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: ${a.fontFamily};
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${a.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${a.fontFamily};
    fill: ${a.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${a.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: ${a.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${a.taskTextDarkColor};
    text-anchor: start;
    font-family: ${a.fontFamily};
  }

  .taskTextOutsideLeft {
    fill: ${a.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${a.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${a.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${a.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${a.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${a.taskBkgColor};
    stroke: ${a.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${a.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${a.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${a.activeTaskBkgColor};
    stroke: ${a.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${a.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${a.doneTaskBorderColor};
    fill: ${a.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${a.taskTextDarkColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${a.critBorderColor};
    fill: ${a.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${a.critBorderColor};
    fill: ${a.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${a.critBorderColor};
    fill: ${a.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${a.taskTextDarkColor} !important;
  }

  .vert {
    stroke: ${a.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${a.vertLineColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${a.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${a.titleColor||a.textColor};
    font-family: ${a.fontFamily};
  }
`,"getStyles")};a.s(["diagram",()=>bf],141253)}];

//# sourceMappingURL=2374f_e48107ad._.js.map