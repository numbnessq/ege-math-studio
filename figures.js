// Чертежи строятся из тех же параметров, что и текст; все координаты локальны для рисунка.
function taskFigure(task){
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 320 200');
 svg.setAttribute('role','img');
 svg.setAttribute('aria-label','Рисунок к задаче «'+task.title+'»');
 function draw(tag,attrs,text){
   const el=document.createElementNS(ns,tag);
   for(const [name,val] of Object.entries(attrs))el.setAttribute(name,val);
   if(text!==undefined)el.textContent=text;
   svg.append(el);
 }
 const path=(d,dashed=false)=>draw('path',{d,fill:'none',stroke:'currentColor','stroke-width':1.6,...(dashed?{'stroke-dasharray':'5 4'}:{})});
 const line=(x,y,X,Y,dashed=false)=>path('M '+x+' '+y+' L '+X+' '+Y,dashed);
 const label=(x,y,s)=>draw('text',{x,y,'text-anchor':'middle','font-size':14,fill:'currentColor'},s);
 const circle=(x,y,r)=>draw('circle',{cx:x,cy:y,r,fill:'none',stroke:'currentColor','stroke-width':1.6});
 const point=(x,y)=>draw('circle',{cx:x,cy:y,r:2.7,fill:'currentColor'});
 function arrow(x,y,X,Y){
   line(x,y,X,Y);
   const angle=Math.atan2(Y-y,X-x);
   for(const d of [-.48,.48])line(X,Y,X-8*Math.cos(angle+d),Y-8*Math.sin(angle+d));
 }
 function graph(xmin,xmax,ymin,ymax){
   const x=v=>31+(v-xmin)*261/(xmax-xmin);
   const y=v=>170-(v-ymin)*145/(ymax-ymin);
   arrow(20,y(0),303,y(0));arrow(x(0),178,x(0),15);
   label(308,y(0)+15,'x');label(x(0)+12,16,'y');
   return {x,y,curve(fn){
     const coords=[];
     for(let i=0;i<=160;i++){
       const z=xmin+(xmax-xmin)*i/160,val=fn(z);
       if(val>=ymin&&val<=ymax)coords.push([x(z),y(val)]);
       else if(coords.length){path('M '+coords.join(' L '));coords.length=0}
     }
     if(coords.length)path('M '+coords.join(' L '));
   }};
 }
 const k=task.k;
 switch(task.type){
 case 1:
   if(task.title==='Высота к гипотенузе'){
     path('M 38 158 L 110 50 L 272 158 Z');line(110,50,110,158,true);
     path('M 110 149 h 9 v 9');label(73,179,4*k);label(190,179,9*k);label(101,112,'h');
   }else{
     const a=(k+19)*Math.PI/180, cx=155,cy=98,r=74;
     const X=r*Math.sin(a),Y=cy+r*Math.cos(a);
     circle(cx,cy,r);path('M '+(cx-X)+' '+Y+' L '+cx+' 24 L '+(cx+X)+' '+Y);
     path('M '+(cx-X)+' '+Y+' L '+cx+' '+cy+' L '+(cx+X)+' '+Y);
     label(cx-X-10,Y+13,'A');label(cx+X+10,Y+13,'B');label(cx,18,'C');label(cx,cy+27,(2*k+38)+'°');
   }break;
 case 2:{
   const upper=Math.max(5,k+2),g=graph(-1,upper,-1,upper);
   arrow(g.x(0),g.y(0),g.x(k),g.y(3));arrow(g.x(0),g.y(0),g.x(2),g.y(k+1));
   label(g.x(k)+10,g.y(3)+13,'a');label(g.x(2)-10,g.y(k+1)-4,'b');break;
 }
 case 3:
   path('M 48 154 L 197 154 L 264 115 L 141 23 Z M 197 154 L 141 23');
   path('M 48 154 L 115 115 L 264 115 M 115 115 L 141 23 M 141 23 L 141 136',true);
   label(124,175,k+2);label(159,89,3*k);break;
 case 8:case 12:{
   const f=task.type===8?x=>x*x-k*x:x=>(x-k)**2+k;
   const end=task.type===8?k+2:2*k+1;
   const min=task.type===8?-k*k/4-1:-1;
   const g=graph(-.5,end+.5,min,Math.max(f(0),f(end))+2);
   g.curve(f);
   if(task.type===8){
     const a=k+1,b=f(a);g.curve(x=>b+(k+2)*(x-a));point(g.x(a),g.y(b));
     line(g.x(a),g.y(0),g.x(a),g.y(b),true);label(g.x(a),g.y(0)+15,a);
   }else{for(const n of [0,end])point(g.x(n),g.y(f(n)));label(g.x(end),g.y(0)+15,end)}
   break;
 }
 case 11:{
   const g=graph(-.5,4,-2,4*k+5);g.curve(x=>k*x+3);
   for(const n of [1,3]){point(g.x(n),g.y(k*n+3));label(g.x(n)+20,g.y(k*n+3)-6,'('+n+'; '+(k*n+3)+')')}
   break;
 }
 case 14:
   draw('polygon',{points:'65,164 247,125 247,38 65,77',fill:'#e4e9e7'});
   path('M 65 164 H 196 L 247 125 V 38 H 116 L 65 77 V 164 M 65 77 H 196 L 247 38 M 196 77 V 164');
   path('M 65 164 L 116 125 H 247 M 116 125 V 38 M 116 125 L 196 164',true);
   path('M 65 164 L 247 125 M 65 77 L 247 38');
   for(const [x,y,s] of [[55,180,'A'],[202,180,'B'],[258,130,'C'],[106,125,'D'],[52,78,'A₁'],[193,69,'B₁'],[258,39,'C₁'],[108,32,'D₁'],[155,160,'O']])label(x,y,s);
   break;
 case 17:
   circle(155.5,100,21*Math.sqrt(16.25));path('M 82 58 H 229 M 145 16 V 184');
   for(const [x,y,s] of [[71,57,'A'],[240,57,'B'],[133,18,'C'],[156,191,'D'],[154,72,'P'],[110,52,3*k],[188,52,4*k],[129,43,2*k]])label(x,y,s);
   break;
 default:return null;
 }
 svg.classList.add('task-figure');return svg;
}
