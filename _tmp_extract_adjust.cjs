const fs = require('fs');
const j = JSON.parse(fs.readFileSync('public/assets/maps/hub02/hub_annotations.json', 'utf8'));
const adjust = j.layers.find(l => l.id === 'adjust');
console.log('Adjust shapes:', adjust.shapes.length);
adjust.shapes.forEach((s, i) => {
  const pts = s.points;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  console.log((i + 1) + '  (' + Math.round(minX) + ',' + Math.round(minY) + ')  w:' + Math.round(maxX - minX) + '  h:' + Math.round(maxY - minY));
});
