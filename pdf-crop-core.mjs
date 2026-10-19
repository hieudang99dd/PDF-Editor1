/*
 * PDF Đạo Chích — robust non-destructive PDF CropBox geometry and validation.
 * Coordinates selected in PDF.js rotated viewport space, then converted back
 * to underlying PDF user space by transforming all four rectangle corners.
 */
export const MIN_SELECTION = 0.018;
export function clamp(v,min=0,max=1){return Math.min(max,Math.max(min,v));}
export function normalizeRect(a,b,minSize=MIN_SELECTION){
 const x=clamp(Math.min(a.x,b.x)),y=clamp(Math.min(a.y,b.y));
 const right=clamp(Math.max(a.x,b.x)),bottom=clamp(Math.max(a.y,b.y));
 if(right-x<minSize||bottom-y<minSize)throw Error('Vùng cắt quá nhỏ; hãy chọn một vùng lớn hơn.');
 return {x,y,w:right-x,h:bottom-y};
}
export function validRect(r){
 if(!r||![r.x,r.y,r.w,r.h].every(Number.isFinite))throw Error('Tọa độ vùng cắt không hợp lệ.');
 if(r.w<MIN_SELECTION||r.h<MIN_SELECTION||r.x<0||r.y<0||r.x+r.w>1+1e-8||r.y+r.h>1+1e-8)
  throw Error('Vùng cắt phải nằm trong trang PDF và có kích thước hợp lệ.');
 return r;
}
export function fromMargins({left=0,top=0,right=0,bottom=0}){
 const rect={x:left,y:top,w:1-left-right,h:1-top-bottom};
 return validRect(rect);
}
export function toMargins(r){
 validRect(r);
 return {left:r.x,top:r.y,right:1-r.x-r.w,bottom:1-r.y-r.h};
}
export function isFullPage(r,epsilon=0.0005){
 validRect(r);
 return Math.abs(r.x)<epsilon&&Math.abs(r.y)<epsilon&&Math.abs(1-r.x-r.w)<epsilon&&Math.abs(1-r.y-r.h)<epsilon;
}
export function viewportCropRect(viewport,selection,mediaBox,currentCropBox){
 validRect(selection);
 if(!viewport || !Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||typeof viewport.convertToPdfPoint!=='function')
  throw Error('Không nhận diện được hệ tọa độ của trang.');
 const w=viewport.width,h=viewport.height;
 const coords=[[selection.x,selection.y],[selection.x+selection.w,selection.y],
    [selection.x+selection.w,selection.y+selection.h],[selection.x,selection.y+selection.h]]
    .map(([x,y])=>viewport.convertToPdfPoint(x*w,y*h));
 if(coords.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))
  throw Error('PDF.js không chuyển được tọa độ vùng cắt.');
 let x=Math.min(...coords.map(p=>p[0])),y=Math.min(...coords.map(p=>p[1]));
 let right=Math.max(...coords.map(p=>p[0])),top=Math.max(...coords.map(p=>p[1]));
 const m=mediaBox,c=currentCropBox||m;
 const floorX=Math.max(m.x,c.x),floorY=Math.max(m.y,c.y);
 const ceilX=Math.min(m.x+m.width,c.x+c.width),ceilY=Math.min(m.y+m.height,c.y+c.height);
 // Numerical tolerance for transform rounding. Never expand beyond visible box.
 x=clamp(x,floorX,ceilX);y=clamp(y,floorY,ceilY);
 right=clamp(right,floorX,ceilX);top=clamp(top,floorY,ceilY);
 if(right-x<1||top-y<1)throw Error('Vùng cắt quá nhỏ trên trang PDF.');
 return {x,y,width:right-x,height:top-y};
}
export function almostEqualBox(a,b,tol=.06){
 return ['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<=tol);
}
export function cropSummary(oldBox,newBox){
 const mm=pt=>+(pt*25.4/72).toFixed(1);
 return {before:[mm(oldBox.width),mm(oldBox.height)],
  after:[mm(newBox.width),mm(newBox.height)],
  margins:[mm(newBox.x-oldBox.x),mm(oldBox.y+oldBox.height-newBox.y-newBox.height),
    mm(oldBox.x+oldBox.width-newBox.x-newBox.width),mm(newBox.y-oldBox.y)]};
}
export function findInkBounds(image,{cutoff=242,pad=.024}={}){
 const {width,height,data}=image||{};
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<10||height<10||!data||data.length<width*height*4)
  throw Error('Không có ảnh trang để dò lề.');
 const stride=Math.max(1,Math.floor(Math.max(width,height)/1050));
 const xs=Math.ceil(width/stride),ys=Math.ceil(height/stride);
 const rows=new Uint32Array(ys),cols=new Uint32Array(xs);
 for(let j=0,y=0;y<height;j++,y+=stride){
  for(let i=0,x=0;x<width;i++,x+=stride){
   const k=(y*width+x)*4;
   if(data[k+3]>100&&Math.min(data[k],data[k+1],data[k+2])<cutoff){rows[j]++;cols[i]++;}
  }
 }
 // Reject isolated scan noise. More conservative than a raw non-white bbox.
 const rowThreshold=Math.max(1,Math.floor(xs*.002)),colThreshold=Math.max(1,Math.floor(ys*.002));
 const activeY=[],activeX=[];
 rows.forEach((v,i)=>{if(v>=rowThreshold)activeY.push(i)});
 cols.forEach((v,i)=>{if(v>=colThreshold)activeX.push(i)});
 if(!activeY.length||!activeX.length)return null;
 const minX=clamp(activeX[0]*stride/width-pad),maxX=clamp((activeX.at(-1)+1)*stride/width+pad);
 const minY=clamp(activeY[0]*stride/height-pad),maxY=clamp((activeY.at(-1)+1)*stride/height+pad);
 if(maxX-minX<MIN_SELECTION||maxY-minY<MIN_SELECTION)return null;
 return {x:minX,y:minY,w:maxX-minX,h:maxY-minY};
}
export function describeChanges(original,cropped,targets){
 const rows=[];
 for(const n of targets){
  const a=original.getPage(n-1).getCropBox(),b=cropped.getPage(n-1).getCropBox();
  if(!almostEqualBox(a,b))rows.push({page:n,oldBox:a,newBox:b,...cropSummary(a,b)});
 }
 return rows;
}
