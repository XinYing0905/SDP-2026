// Adapter only for the portable, volatile-memory review artifact. Not the persistent backend.
// SHA-256 compatibility keeps all plan/version digest checks identical to the Node service.
export const browserCryptoSource = `
function sha256(text){
 const bytes=new TextEncoder().encode(text),length=bytes.length,total=Math.ceil((length+9)/64)*64;
 const data=new Uint8Array(total);data.set(bytes);data[length]=128;const view=new DataView(data.buffer);view.setUint32(total-8,Math.floor(length/536870912));view.setUint32(total-4,(length*8)>>>0);
 const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64),ror=(x,n)=>(x>>>n)|(x<<(32-n));
 for(let offset=0;offset<total;offset+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);for(let i=16;i<64;i++){let a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(ror(a,7)^ror(a,18)^(a>>>3))+w[i-7]+(ror(b,17)^ror(b,19)^(b>>>10)))>>>0;}
 let [a,b,c,d,e,f,g,j]=h;for(let i=0;i<64;i++){const t1=(j+(ror(e,6)^ror(e,11)^ror(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((ror(a,2)^ror(a,13)^ror(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}[a,b,c,d,e,f,g,j].forEach((v,i)=>h[i]=(h[i]+v)>>>0);}
 return h.map(n=>n.toString(16).padStart(8,'0')).join('');
}
const nodeCrypto={createHash:()=>{let text='';return{update(value){text+=value;return this},digest(){return sha256(text)}}},randomUUID:()=>crypto.randomUUID(),randomBytes:n=>{const a=crypto.getRandomValues(new Uint8Array(n));return{toString:()=>[...a].map(b=>b.toString(16).padStart(2,'0')).join('')}}};
`;
export const memoryRepositorySource = `
function createMemoryRepository(){const states=new Map(),events=new Map(),history=new Map(),copy=x=>structuredClone(x);
 const get=id=>{if(!states.has(id))throw Error('NOT_FOUND');return copy(states.get(id));};
 function commit(s,es){states.set(s.id,copy(s));events.set(s.id,[...(events.get(s.id)||[]),...copy(es)]);history.set(s.id,[...(history.get(s.id)||[]),copy(s)]);}
 return{get,list:()=>[...states.values()].map(copy),create(s,e){if(states.has(s.id))throw Error('ALREADY_EXISTS');commit(s,[e]);return get(s.id)},transact(id,rev,fn){const s=get(id);if(rev!=null&&s.revision!==rev)throw Error('VERSION_CONFLICT');const r=fn(s);if(!r.noWrite){s.revision++;commit(s,r.events||[]);}return copy(r.value??get(id));},events:id=>copy(events.get(id)||[]),history:id=>copy(history.get(id)||[])};
}
`;
