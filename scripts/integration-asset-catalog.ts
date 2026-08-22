import assert from 'node:assert/strict';
import pg from 'pg';
import { PostgresAssetCatalog } from '../packages/db/src/asset-catalog.ts';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL_REQUIRED');
const {Pool}=pg;
const pool=new Pool({connectionString});
const catalog=new PostgresAssetCatalog(connectionString);

try{
  const actorResult=await pool.query(`select u.id from users u join profiles p on p.id=u.profile_id where p.display_code='HML-OPERATOR' and u.status='active' limit 1`);
  const actorUserId=actorResult.rows[0]?.id;
  assert.match(actorUserId,/^[0-9a-f-]{36}$/i);

  const id=await catalog.create({
    historicalEventLabel:'Diretoria Histórica HML',assetType:'photo',storageKey:'hml/catalog/photo-001.jpg',title:'Público Diretoria HML',description:'Registro sintético para testar catálogo.',format:'jpg',quality:'high',usagePermission:'internal',rightsStatus:'review_required',rightsNotes:'Revisão necessária antes de mídia paga.',sourceCredit:'Fotógrafo Teste HML',externalSourceUrl:'https://example.invalid/photo-001',capturedAt:'2023-06-10T23:00:00Z',tags:['publico','historico','Publico'],
  },actorUserId);
  assert.match(id,/^[0-9a-f-]{36}$/i);

  let rows=await catalog.list({rightsStatus:'review_required',tag:'publico'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,id);
  assert.deepEqual(rows[0].tags,['historico','publico']);
  assert.equal(rows[0].usage_permission,'internal');
  assert.equal(rows[0].created_by,actorUserId);

  await catalog.update(id,{
    historicalEventLabel:'Diretoria Histórica HML',assetType:'photo',storageKey:'hml/catalog/photo-001.jpg',title:'Público Diretoria HML — revisado',format:'jpg',quality:'high',usagePermission:'paid',rightsStatus:'cleared',rightsNotes:'Liberado somente no cenário sintético do HML.',sourceCredit:'Fotógrafo Teste HML',capturedAt:'2023-06-10T23:00:00Z',tags:['publico','campanha'],
  },actorUserId);

  rows=await catalog.list({rightsStatus:'cleared',usagePermission:'paid',search:'revisado'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,id);
  assert.deepEqual(rows[0].tags,['campanha','publico']);
  assert.equal(rows[0].updated_by,actorUserId);

  const summary=await catalog.rightsSummary();
  assert.ok(summary.some((x:any)=>x.rights_status==='cleared'&&x.usage_permission==='paid'&&Number(x.count)>=1));

  const audit=await pool.query(`select action,before_data,after_data from audit_logs where entity_type='asset' and entity_id=$1 order by occurred_at`,[id]);
  assert.equal(audit.rows.length,2);
  assert.equal(audit.rows[0].action,'asset.catalog_created');
  assert.equal(audit.rows[1].action,'asset.catalog_updated');
  assert.equal(audit.rows[1].before_data.rightsStatus,'review_required');
  assert.equal(audit.rows[1].after_data.rightsStatus,'cleared');
  assert.equal(audit.rows[1].after_data.usagePermission,'paid');

  await assert.rejects(catalog.create({assetType:'photo',storageKey:'bad',usagePermission:'paid',rightsStatus:'invalid' as any},actorUserId),/RIGHTS_STATUS_INVALID/);
  await assert.rejects(catalog.list({limit:201}),/ASSET_LIMIT_INVALID/);

  console.log(JSON.stringify({ok:true,scenario:'asset_catalog',assetId:id,auditRows:audit.rows.length}));
}finally{await catalog.close();await pool.end();}
