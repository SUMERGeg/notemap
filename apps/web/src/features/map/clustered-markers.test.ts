import { describe, expect, it } from 'vitest';
import { markerData, visibleFeatures } from './clustered-markers';
const point=(id:number)=>({id:String(id),longitude:37+id/10000,latitude:55,category:'food',label:`Место ${id}`,open:()=>{}});
describe('clustered marker adapter',()=>{
 it('passes 1000 points to worker without private text or callbacks',()=>{
  const data=markerData(Array.from({length:1000},(_,i)=>point(i)));
  expect(data.features).toHaveLength(1000);
  expect(data.features[0].properties).toEqual({id:'0'});
  expect(JSON.stringify(data)).not.toContain('Место');
 });
 it('deduplicates tile copies and rejects points outside viewport',()=>{
  const feature={type:'Feature',geometry:{type:'Point',coordinates:[37,55]},properties:{cluster:true,cluster_id:12,point_count:700}} as const;
  expect(visibleFeatures([feature,feature],()=>true)).toHaveLength(1);
  expect(visibleFeatures([feature],()=>false)).toHaveLength(0);
 });
 it('handles empty data and distinct note ids at one place',()=>{
  expect(markerData([]).features).toEqual([]);
  const points=[point(1),{...point(1),id:'import:1'}];
  expect(markerData(points).features.map(f=>f.properties.id)).toEqual(['1','import:1']);
 });
});

// Use the clustering engine already shipped with MapLibre, without a new dependency.
import { Supercluster } from '@maplibre/geojson-vt';
describe('MapLibre clustering engine with real large datasets',()=>{
 it('reduces 1000 dense points and expands to original ids at high zoom',()=>{
  const points=Array.from({length:1000},(_,i)=>({...point(i),longitude:37.617+i%40*.00005,latitude:55.755+Math.floor(i/40)*.00005}));
  const index=new Supercluster({radius:60,maxZoom:18});index.load(markerData(points).features);
  const low=index.getClusters([37,55,38,56],10);
  expect(low.length).toBeLessThan(20);
  const total=low.reduce((sum,f)=>sum+(f.properties?.cluster?Number(f.properties.point_count):1),0);
  expect(total).toBe(1000);
  const high=index.getClusters([37,55,38,56],19);
  expect(high).toHaveLength(1000);
  expect(new Set(high.map(f=>f.properties?.id)).size).toBe(1000);
 });
 it('paginates coincident points without losing any note or creating 1000 buttons',()=>{
  const index=new Supercluster({radius:60,maxZoom:18});index.load(markerData(Array.from({length:1000},(_,i)=>({...point(i),longitude:37,latitude:55}))).features);
  const [cluster]=index.getClusters([36,54,38,56],18);
  const id=Number(cluster.properties?.cluster_id);
  expect(index.getClusterExpansionZoom(id)).toBeGreaterThan(18);
  const first=index.getLeaves(id,20,0),second=index.getLeaves(id,20,20);
  expect(first).toHaveLength(20);expect(second).toHaveLength(20);
  expect(new Set([...first,...second].map(f=>f.properties?.id)).size).toBe(40);
 });
 it('rebuilds filtered/hidden sets and supports an empty layer',()=>{
  const index=new Supercluster({radius:60,maxZoom:18});index.load(markerData([]).features);
  expect(index.getClusters([-180,-85,180,85],10)).toEqual([]);
  index.load(markerData([point(1)]).features);
  expect(index.getClusters([-180,-85,180,85],10)).toHaveLength(1);
 });
});
