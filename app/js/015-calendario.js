/* ---------- calendário ---------- */
const hcache={};
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return utc(y,mo-1,da)}
function holidays(y){if(hcache[y])return hcache[y];const s=new Set(),e=easter(y);[[0,1],[3,21],[4,1],[8,7],[9,12],[10,2],[10,15],[11,25]].forEach(([m,d])=>s.add(utc(y,m,d)));if(y>=2024)s.add(utc(y,10,20));[-48,-47,-2,60].forEach(o=>s.add(e+o*DAY));return hcache[y]=s}
function isBiz(t){const d=new Date(t),w=d.getUTCDay();return w!==0&&w!==6&&!holidays(d.getUTCFullYear()).has(t)}
const ducache=new Map();
const BZ0=Date.UTC(1999,0,1),BZN=Math.round((Date.UTC(2101,0,1)-BZ0)/DAY);let BZC=null;
function bzCum(){if(BZC)return BZC;const C=new Int32Array(BZN+1);let c=0;for(let i=0;i<BZN;i++){C[i]=c;if(isBiz(BZ0+i*DAY))c++}C[BZN]=c;return BZC=C}
function du(a,b){if(!(b>a))return 0;const ia=(a-BZ0)/DAY,ib=(b-BZ0)/DAY;if(Number.isInteger(ia)&&Number.isInteger(ib)&&ia>=0&&ib<=BZN){const C=bzCum();return C[ib]-C[ia]}
  const key=a+":"+b;let n=ducache.get(key);if(n!=null)return n;n=0;for(let t=a;t<b;t+=DAY)if(isBiz(t))n++;ducache.set(key,n);return n}
function parseDate(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||"");return m?utc(+m[1],+m[2]-1,+m[3]):NaN}
function addMonths(t,n){const d=new Date(t);return utc(d.getUTCFullYear(),d.getUTCMonth()+n,d.getUTCDate())}

