// Compare the exact rendered markup and PNG bytes from two diagnostic runs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
// Chromium emits non-interlaced, 8-bit RGB/RGBA PNGs; compare pixels, not encoder output.
function pixels(png){
 let width,height,channels;const chunks=[];
 for(let pos=8;pos<png.length;){const size=png.readUInt32BE(pos),type=png.toString('ascii',pos+4,pos+8),data=png.subarray(pos+8,pos+8+size);if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[12],0);channels=({2:3,6:4})[data[9]];assert.ok(channels);}if(type==='IDAT')chunks.push(data);pos+=size+12;}
 const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,out=Buffer.alloc(stride*height);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const mode=raw[y*(stride+1)];for(let x=0;x<stride;x++){const at=y*stride+x,a=x>=channels?out[at-channels]:0,b=y?out[at-stride]:0,c=y&&x>=channels?out[at-stride-channels]:0;out[at]=(raw[y*(stride+1)+x+1]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][mode])&255;}}
 return {width,height,channels,data:out};
}
const [beforeLabel,afterLabel]=process.argv.slice(2);
if(!beforeLabel||!afterLabel||![beforeLabel,afterLabel].every(x=>/^[a-z-]+$/.test(x)))throw Error('Provide before and after labels');
const dir='.local/performance-final',read=label=>JSON.parse(readFileSync(`${dir}/${label}.json`,'utf8'));
const before=read(beforeLabel),after=read(afterLabel),comparison={before:beforeLabel,after:afterLabel,states:[],measurements:[]};
for(const state of ['hero','course',...[390,1440].flatMap(w=>['dashboard','drawer','day','week','month'].map(s=>s+'-'+w))]){
 assert.ok(JSON.stringify(after[state])===JSON.stringify(before[state]),`Rendered markup differs: ${state}`);
 const a=readFileSync(`${dir}/${beforeLabel}-${state}.png`),b=readFileSync(`${dir}/${afterLabel}-${state}.png`);
 const pa=pixels(a),pb=pixels(b);assert.equal(pa.width,pb.width);assert.equal(pa.height,pb.height);assert.equal(pa.channels,pb.channels);const changed=pa.data.reduce((n,v,i)=>n+(v!==pb.data[i]?1:0),0);assert.equal(changed,0,`Screenshot differs: ${state}, changed channels`);
 comparison.states.push({state,identical:true,sha256:createHash('sha256').update(a).digest('hex')});
}
const median=a=>{const b=[...a].sort((a,b)=>a-b);return b.length%2?b[(b.length-1)/2]:(b[b.length/2-1]+b[b.length/2])/2;};
for(const b of before.samples){const a=after.samples.find(x=>x.width===b.width&&x.phase===b.phase);const time=sample=>median((sample.phase==='day'?sample.values.slice(-1):sample.values).map(v=>typeof v==='number'?v:v.total));const old=time(b),next=time(a);comparison.measurements.push({width:b.width,phase:b.phase,before:old,after:next,changePercent:100*(next/old-1)});}
writeFileSync(`${dir}/comparison-${beforeLabel}-${afterLabel}.json`,JSON.stringify(comparison,null,2));
console.log(JSON.stringify(comparison,null,2));
