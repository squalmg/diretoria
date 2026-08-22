import assert from 'node:assert/strict';
import { PostgresAcquisitionCore } from '../packages/db/src/acquisition-core.ts';
import { PostgresCrmRead } from '../packages/db/src/crm-read.ts';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL_REQUIRED');
const acquisition=new PostgresAcquisitionCore(connectionString);
const crm=new PostgresCrmRead(connectionString);

try{
  const lead=await acquisition.captureLead({
    fullName:'CRM Read Smoke',
    email:'crm-read-smoke@example.invalid',
    phoneE164:'+5564999990033',
    policyVersion:'privacy-v1',
    source:'crm_test',
    medium:'ci',
    campaign:'crm_campaign',
    content:'integration',
    referralCode:'CRM-TEST',
    landingPage:'/crm-test',
    sessionKey:'crm-read-session',
    consents:{privacy:true,marketing:true,whatsapp:false,email:true},
  });

  const health=await crm.health();
  assert.equal(health,true);

  const overview=await crm.overview();
  assert.ok(Number(overview.total.total)>=1);
  assert.ok(overview.stages.some((x:any)=>x.stage==='lead'&&Number(x.count)>=1));
  assert.ok(overview.sources.some((x:any)=>x.source==='crm_test'));
  assert.ok(overview.campaigns.some((x:any)=>x.campaign==='crm_campaign'));
  assert.ok(overview.consents.some((x:any)=>x.consent_type==='privacy'&&Number(x.granted)>=1));

  const filtered=await crm.listProfiles({search:'CRM Read',stage:'lead',source:'crm_test',campaign:'crm_campaign',limit:20});
  assert.equal(filtered.items.length,1);
  assert.equal(filtered.items[0].id,lead.profileId);
  assert.equal(filtered.items[0].email_normalized,'crm-read-smoke@example.invalid');
  assert.equal(filtered.items[0].stage,'lead');
  assert.equal(filtered.items[0].source,'crm_test');
  assert.equal(filtered.items[0].campaign,'crm_campaign');
  assert.equal(filtered.items[0].privacy,true);
  assert.equal(filtered.items[0].marketing,true);
  assert.equal(filtered.items[0].whatsapp,false);
  assert.equal(filtered.items[0].email_consent,true);

  const profile=await crm.profile360(lead.profileId);
  assert.equal(profile.profile.id,lead.profileId);
  assert.equal(profile.stages[0].to_stage,'lead');
  assert.equal(profile.attributions[0].source,'crm_test');
  assert.equal(profile.attributions[0].campaign,'crm_campaign');
  assert.equal(profile.interactions[0].interaction_type,'lead_capture');
  assert.equal(profile.analytics[0].event_name,'lead_created');
  assert.equal(profile.consents.length,4);
  assert.equal(profile.payments.length,0);
  assert.equal(profile.credits.length,0);
  assert.ok(profile.audit.some((x:any)=>x.action==='lead.captured'));

  await assert.rejects(crm.listProfiles({limit:101}),/CRM_LIMIT_INVALID/);
  await assert.rejects(crm.profile360('invalid'),/PROFILE_ID_INVALID/);

  console.log(JSON.stringify({ok:true,scenario:'crm_read',profileId:lead.profileId,filtered:filtered.items.length}));
}finally{
  await crm.close();
  await acquisition.close();
}
