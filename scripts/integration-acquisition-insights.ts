import assert from 'node:assert/strict';
import { PostgresAcquisitionCore } from '../packages/db/src/acquisition-core.ts';
import { PostgresAcquisitionInsights } from '../packages/db/src/acquisition-insights.ts';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL_REQUIRED');
const acquisition=new PostgresAcquisitionCore(connectionString);
const insights=new PostgresAcquisitionInsights(connectionString);
try{
  await acquisition.captureLead({fullName:'Insight Alpha',email:'insight-alpha@example.invalid',phoneE164:'+5564999990041',policyVersion:'privacy-v1',source:'meta',medium:'paid_social',campaign:'reativacao-a',content:'video-a',sessionKey:'insight-a',consents:{privacy:true,marketing:true,whatsapp:true,email:false}});
  await acquisition.captureLead({fullName:'Insight Beta',email:'insight-beta@example.invalid',phoneE164:'+5564999990042',policyVersion:'privacy-v1',source:'google',medium:'cpc',campaign:'reativacao-b',content:'search-a',sessionKey:'insight-b',consents:{privacy:true,marketing:false,whatsapp:false,email:true}});

  const result=await insights.dashboard(30);
  assert.ok(Number(result.totals.leads)>=2);
  assert.ok(Number(result.totals.last_24h)>=2);
  assert.ok(result.daily.some((x:any)=>Number(x.leads)>=2));
  assert.ok(result.sources.some((x:any)=>x.source==='meta'&&Number(x.leads)>=1));
  assert.ok(result.sources.some((x:any)=>x.source==='google'&&Number(x.leads)>=1));
  assert.ok(result.campaigns.some((x:any)=>x.campaign==='reativacao-a'));
  assert.ok(result.campaigns.some((x:any)=>x.campaign==='reativacao-b'));
  const marketing=result.consents.find((x:any)=>x.consent_type==='marketing');
  assert.ok(marketing);
  assert.ok(Number(marketing.total)>=2);
  assert.ok(Number(marketing.granted)>=1);
  assert.ok(result.rateLimit24h);

  await assert.rejects(insights.dashboard(0),/INSIGHTS_DAYS_INVALID/);
  await assert.rejects(insights.dashboard(366),/INSIGHTS_DAYS_INVALID/);
  console.log(JSON.stringify({ok:true,scenario:'acquisition_insights',leads:result.totals.leads}));
}finally{await insights.close();await acquisition.close();}
