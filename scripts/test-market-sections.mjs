import assert from 'node:assert/strict';
import polygonClipping from 'polygon-clipping';
import { splitMarketSections } from '../dist/utils/marketSections.js';
const rad=Math.PI/180;
const area=polygons=>polygons.reduce((total,p)=>total+p.reduce((sum,r,index)=>sum+(index? -1:1)*Math.abs(r.slice(0,-1).reduce((a,point,i)=>a+(point[0]-r[0][0])*rad*(Math.sin(r[i+1][1]*rad)-Math.sin(r[0][1]*rad))-(r[i+1][0]-r[0][0])*rad*(Math.sin(point[1]*rad)-Math.sin(r[0][1]*rad)),0))/2,0),0);
const shapes=[
  [[[77,28],[77.03,28],[77.03,28.03],[77,28.03],[77,28]]],
  [[[77,28],[77.03,28],[77,28.03],[77,28]]],
  [[[77,28],[77.03,28],[77.03,28.01],[77.01,28.01],[77.01,28.03],[77,28.03],[77,28]]],
  [[[77,28],[77.03,28],[77.03,28.03],[77,28.03],[77,28]],[[77.005,28.005],[77.025,28.005],[77.025,28.025],[77.005,28.025],[77.005,28.005]]]
];
for(const shape of shapes) for(const count of [1,2,3,5]) {
  const colors=['#ff0000','#0000ff','#00ff00','#ffff00','#00ffff'].slice(0,count);
  const sections=splitMarketSections(shape,colors.map((color,i)=>({id:String(i),color})));
  assert.equal(sections.length,count);
  const total=area([shape]);
  sections.forEach((section,i)=>{
    assert.equal(section.properties.color,colors[i]);
    assert.ok(Math.abs(area(section.geometry.coordinates)/total-1/count)<1e-6,'Equal actual areas');
  });
  const union=polygonClipping.union(...sections.map(s=>s.geometry.coordinates));
  assert.ok(Math.abs(area(union)/total-1)<1e-6,'Entire polygon covered');
  for(let i=0;i<count;i++) for(let j=i+1;j<count;j++) assert.ok(area(polygonClipping.intersection(sections[i].geometry.coordinates,sections[j].geometry.coordinates))/total<1e-7,'No overlapping colour sections');
}
assert.deepEqual(splitMarketSections(shapes[0],[]),[]);
console.log('Equal-area sections: rectangles, triangles, concave polygons, holes, 1/2/3/5 colours, coverage and no overlaps passed.');
