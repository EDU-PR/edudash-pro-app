module.exports=[649583,a=>{"use strict";var b=a.i(128048),c=a.i(807128),d=(0,c.__name)((a,d,g,h)=>{a.attr("class",g);let{width:i,height:j,x:k,y:l}=e(a,d);(0,b.configureSvgSize)(a,j,i,h);let m=f(k,l,i,j,d);a.attr("viewBox",m),c.log.debug(`viewBox configured: ${m} with padding: ${d}`)},"setupViewPortForSVG"),e=(0,c.__name)((a,b)=>{let c=a.node()?.getBBox()||{width:0,height:0,x:0,y:0};return{width:c.width+2*b,height:c.height+2*b,x:c.x,y:c.y}},"calculateDimensionsWithPadding"),f=(0,c.__name)((a,b,c,d,e)=>`${a-e} ${b-e} ${c} ${d}`,"createViewBox");a.s(["setupViewPortForSVG",()=>d])},754006,a=>{"use strict";var b=a.i(807128);a.i(669877);var c=a.i(510790),d=(0,b.__name)((a,b)=>{let d;return"sandbox"===b&&(d=(0,c.select)("#i"+a)),("sandbox"===b?(0,c.select)(d.nodes()[0].contentDocument.body):(0,c.select)("body")).select(`[id="${a}"]`)},"getDiagramElement");a.s(["getDiagramElement",()=>d])},596392,a=>{"use strict";var b=(0,a.i(807128).__name)(()=>`
  /* Font Awesome icon styling - consolidated */
  .label-icon {
    display: inline-block;
    height: 1em;
    overflow: visible;
    vertical-align: -0.125em;
  }
  
  .node .label-icon path {
    fill: currentColor;
    stroke: revert;
    stroke-width: revert;
  }
`,"getIconStyles");a.s(["getIconStyles",()=>b])},354868,a=>{"use strict";var b=a.i(637712),c=a.i(849053);a.s(["channel",0,(a,d)=>b.default.lang.round(c.default.parse(a)[d])],354868)}];

//# sourceMappingURL=2374f_b38fe5a0._.js.map