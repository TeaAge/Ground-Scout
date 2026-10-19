// Optional local companion. It never uses a logged-in browser profile or solves access challenges.
import {readFile,writeFile} from 'node:fs/promises';
import {publicURL,validatePublicTarget} from '../src/network.mjs';
const args=process.argv.slice(2),option=name=>{const index=args.indexOf(name);return index>=0&&!args[index+1]?.startsWith('--')?args[index+1]:undefined;};
for(let i=0;i<args.length;i+=2)if(!['--urls','--out','--job-id','--module','--chromium'].includes(args[i])||!option(args[i]))throw new Error('Unknown flag or missing value: '+args[i]);
const input=option('--urls'),output=option('--out'),job_id=option('--job-id');
if(!input||!output||!job_id)throw new Error('Usage: node scripts/browser-capture.mjs --urls urls.txt --out captures.jsonl --job-id JOB_ID [--module /path/puppeteer-core.js] [--chromium /path/chromium]');
const modulePath=args.includes('--module')?option('--module'):'puppeteer-core';
let puppeteer;try{puppeteer=(await import(modulePath)).default;}catch{throw new Error('Optional puppeteer-core is missing. Install locally or provide --module; production does not need this dependency.');}
const launch={headless:true,executablePath:args.includes('--chromium')?option('--chromium'):'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']};
if(process.env.HTTPS_PROXY)launch.args.push('--proxy-server='+process.env.HTTPS_PROXY);
const browser=await puppeteer.launch(launch),captures=[];
try{const urls=[...new Set((await readFile(input,'utf8')).split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];for(const raw of urls){const url=publicURL(raw).href,page=await browser.newPage();
 try{await page.setRequestInterception(true);page.on('request',async r=>{try{const u=new URL(r.url());if(u.protocol==='data:'||u.protocol==='blob:')return r.continue();await validatePublicTarget(u.href);if(['image','media','font'].includes(r.resourceType()))return r.abort();return r.continue();}catch{return r.abort();}});
  const response=await page.goto(url,{waitUntil:'networkidle2',timeout:25000});if([401,403,429].includes(response?.status()))throw new Error('Access block '+response.status());
  const body=await page.content();if(/<title[^>]*>\s*(?:just a moment|access denied|robot check)|verify you are human|bestätigen sie.{0,30}(?:mensch|kein roboter)/i.test(body))throw new Error('Access challenge; no capture attempted.');
  const html=await page.evaluate(()=>{const root=document.querySelector('main')||document.body,copy=root.cloneNode(true);for(const n of copy.querySelectorAll('script,style,svg,iframe,nav,header,footer'))n.remove();return '<html><body>'+copy.outerHTML+'</body></html>';});if(html.length>145000)throw new Error('Rendered DOM exceeds import limit. Select a smaller listing/detail page; no silent clipping.');
  const capture={job_id,url:publicURL(page.url()).href,html,captured_at:new Date().toISOString(),capture_complete:false};if(new TextEncoder().encode(JSON.stringify({name:'import_land_rendered_page',arguments:capture})).length>175000)throw new Error('Rendered capture exceeds HTTP byte budget. Select a smaller detail page; no silent clipping.');
  captures.push(capture);console.log(JSON.stringify({url,status:'captured',characters:html.length,origin:'local_browser_capture_unverified'}));
 }catch(e){console.log(JSON.stringify({url,status:'failed',error:e.message}));}finally{await page.close();}}
}finally{await browser.close();}
await writeFile(output,captures.map(c=>JSON.stringify(c)).join('\n')+(captures.length?'\n':''));
console.log(JSON.stringify({captures:captures.length,output,next_tool:'import_land_rendered_page',server_retrieval_verified:false}));
