export const nearbyTypes=[
  {id:'all',title:'Все',categories:'catering,commercial,service,healthcare,entertainment,leisure.park,tourism.sights'},
  {id:'cafe',title:'Кафе',categories:'catering.cafe'},
  {id:'restaurant',title:'Рестораны',categories:'catering.restaurant,catering.fast_food'},
  {id:'shops',title:'Магазины',categories:'commercial'},
  {id:'culture',title:'Культура',categories:'entertainment.culture,entertainment.museum,entertainment.cinema,tourism.sights'},
  {id:'parks',title:'Парки',categories:'leisure.park'},
] as const;
export type NearbyType=typeof nearbyTypes[number]['id'];
export type NearbyOptions={type?:NearbyType;radius?:500|1500|3000};
export function distanceMeters(a:[number,number],b:[number,number]){
  const radians=Math.PI/180;
  const h=Math.sin((b[1]-a[1])*radians/2)**2+Math.cos(a[1]*radians)*Math.cos(b[1]*radians)*Math.sin((b[0]-a[0])*radians/2)**2;
  return 2*6371000*Math.asin(Math.sqrt(Math.min(1,h)));
}
