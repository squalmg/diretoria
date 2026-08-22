import pg from 'pg';

const { Pool } = pg;

export class PostgresAcquisitionInsights {
  private readonly pool: any;
  constructor(connectionString:string){if(!connectionString)throw new Error('DATABASE_URL_REQUIRED');this.pool=new Pool({connectionString,max:4,idleTimeoutMillis:5_000,connectionTimeoutMillis:5_000});}
  async close(){await this.pool.end();}

  async dashboard(days=30){
    if(!Number.isInteger(days)||days<1||days>365)throw new Error('INSIGHTS_DAYS_INVALID');
    const [totals,daily,sources,campaigns,consents,rate]=await Promise.all([
      this.pool.query(`select count(*)::int as leads,
        count(*) filter(where occurred_at>=now()-interval '24 hours')::int as last_24h,
        count(*) filter(where occurred_at>=now()-interval '7 days')::int as last_7d
        from analytics_events where event_name='lead_created' and occurred_at>=now()-($1::text||' days')::interval`,[days]),
      this.pool.query(`select date_trunc('day',occurred_at)::date as event_day,count(*)::int as leads
        from analytics_events where event_name='lead_created' and occurred_at>=now()-($1::text||' days')::interval
        group by 1 order by 1`,[days]),
      this.pool.query(`select source,count(*)::int as leads,count(distinct profile_id)::int as people
        from acquisition_attributions where occurred_at>=now()-($1::text||' days')::interval
        group by source order by leads desc,source limit 20`,[days]),
      this.pool.query(`select coalesce(campaign,'(sem campanha)') as campaign,count(*)::int as leads,count(distinct profile_id)::int as people
        from acquisition_attributions where occurred_at>=now()-($1::text||' days')::interval
        group by coalesce(campaign,'(sem campanha)') order by leads desc,campaign limit 30`,[days]),
      this.pool.query(`with latest as (
        select distinct on(profile_id,consent_type) profile_id,consent_type,granted
        from consents order by profile_id,consent_type,granted_at desc,id desc
      )
      select consent_type,count(*)::int as total,count(*) filter(where granted)::int as granted,
        round(100.0*count(*) filter(where granted)/nullif(count(*),0),2) as granted_pct
      from latest group by consent_type order by consent_type`),
      this.pool.query(`select coalesce(sum(hit_count),0)::int as hits,count(*)::int as buckets,max(updated_at) as last_hit_at
        from public_lead_rate_limits where bucket_start>=now()-interval '24 hours'`),
    ]);
    return {rangeDays:days,totals:totals.rows[0],daily:daily.rows,sources:sources.rows,campaigns:campaigns.rows,consents:consents.rows,rateLimit24h:rate.rows[0]};
  }
}
