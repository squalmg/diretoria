import assert from 'node:assert/strict';
import { PostgresAssetCatalog } from '../packages/db/src/asset-catalog.ts';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL_REQUIRED');
const catalog=new PostgresAssetCatalog(connectionString);

try{
  const id=await catalog.create({
    historicalEventLabel:'Diretoria Histórica HML',
    assetType:'photo',
    storageKey:'hml/catalog/photo-001.jpg',
    title:'Público Diretoria HML',
    description:'Registro sintético para testar catálogo.',
    format:'jpg',
    quality:'high',
    usagePermission:'internal',
    rightsStatus:'review_required',
    rightsNotes:'Revisão necessária antes de mídia paga.',
    sourceCredit:'Fotógrafo Teste HML',
    externalSourceUrl:'https://example.invalid/photo-001',
    capturedAt:'2023-06-10T23:00:00Z',
    tags:['publico','historico','Publico'],
  });
  assert.match(id,/^[0-9a-f-]{36}$/i);

  let rows=await catalog.list({rightsStatus:'review_required',tag:'publico'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,id);
  assert.deepEqual(rows[0].tags,['historico','publico']);
  assert.equal(rows[0].usage_permission,'internal');

  await catalog.update(id,{
    historicalEventLabel:'Diretoria Histórica HML',
    assetType:'photo',
    storageKey:'hml/catalog/photo-001.jpg',
    title:'Público Diretoria HML — revisado',
    format:'jpg',
    quality:'high',
    usagePermission:'paid',
    rightsStatus:'cleared',
    rightsNotes:'Liberado somente no cenário sintético do HML.',
    sourceCredit:'Fotógrafo Teste HML',
    capturedAt:'2023-06-10T23:00:00Z',
    tags:['publico','campanha'],
  });

  rows=await catalog.list({rightsStatus:'cleared',usagePermission:'paid',search:'revisado'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,id);
  assert.deepEqual(rows[0].tags,['campanha','publico']);

  const summary=await catalog.rightsSummary();
  assert.ok(summary.some((x:any)=>x.rights_status==='cleared'&&x.usage_permission==='paid'&&Number(x.count)>=1));

  await assert.rejects(catalog.create({assetType:'photo',storageKey:'bad',usagePermission:'paid',rightsStatus:'invalid' as any}),/RIGHTS_STATUS_INVALID/);
  await assert.rejects(catalog.list({limit:201}),/ASSET_LIMIT_INVALID/);

  console.log(JSON.stringify({ok:true,scenario:'asset_catalog',assetId:id}));
}finally{await catalog.close();}
