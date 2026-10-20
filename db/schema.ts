import {sqliteTable,text,integer,index,primaryKey} from 'drizzle-orm/sqlite-core';
export const projects=sqliteTable('projects',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),title:text('title').notNull(),status:text('status').notNull().default('researching'),payload:text('payload').notNull(),revision:integer('revision').notNull().default(1),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[index('idx_projects_owner_updated').on(t.ownerId,t.updatedAt)]);
export const savedSearches=sqliteTable('saved_searches',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),title:text('title').notNull(),filters:text('filters').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[index('idx_searches_owner_updated').on(t.ownerId,t.updatedAt)]);
export const sourceDocuments=sqliteTable('source_documents',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),name:text('name').notNull(),sourceUrl:text('source_url'),origin:text('origin').notNull(),textContent:text('text_content').notNull(),textHash:text('text_hash').notNull(),metadata:text('metadata'),createdAt:text('created_at').notNull()
},t=>[index('idx_documents_owner_created').on(t.ownerId,t.createdAt)]);
export const evidenceClaims=sqliteTable('evidence_claims',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),documentId:text('document_id').notNull(),checkId:text('check_id').notNull(),statement:text('statement').notNull(),quote:text('quote').notNull(),createdAt:text('created_at').notNull()
},t=>[index('idx_claims_owner_id').on(t.ownerId,t.id)]);
export const marketObservations=sqliteTable('market_observations',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),listingId:text('listing_id').notNull(),sourceUrl:text('source_url').notNull(),fingerprint:text('fingerprint').notNull(),payload:text('payload').notNull(),observedAt:text('observed_at').notNull()
},t=>[index('idx_observations_owner_listing_time').on(t.ownerId,t.listingId,t.observedAt)]);
export const crawlSources=sqliteTable('crawl_sources',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),name:text('name').notNull(),config:text('config').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[index('idx_crawl_sources_owner_updated').on(t.ownerId,t.updatedAt)]);
export const crawlRuns=sqliteTable('crawl_runs',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),sourceId:text('source_id').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull()
},t=>[index('idx_crawl_runs_owner_created').on(t.ownerId,t.createdAt)]);
export const llmSnapshots=sqliteTable('llm_snapshots',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),metadata:text('metadata').notNull(),createdAt:text('created_at').notNull()
},t=>[index('idx_llm_snapshots_owner_created').on(t.ownerId,t.createdAt)]);
export const llmSnapshotItems=sqliteTable('llm_snapshot_items',{
 snapshotId:text('snapshot_id').notNull(),ownerId:text('owner_id').notNull(),listingKey:text('listing_key').notNull(),position:integer('position').notNull(),payload:text('payload').notNull(),sourceText:text('source_text').notNull()
},t=>[primaryKey({columns:[t.snapshotId,t.listingKey]}),index('idx_llm_items_owner_snapshot_position').on(t.ownerId,t.snapshotId,t.position)]);

export const searchJobs=sqliteTable('search_jobs',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),title:text('title').notNull(),config:text('config').notNull(),status:text('status').notNull().default('ready'),revision:integer('revision').notNull().default(1),leaseToken:text('lease_token'),leaseUntil:text('lease_until'),requests:integer('requests').notNull().default(0),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[index('idx_search_jobs_owner_updated').on(t.ownerId,t.updatedAt)]);
export const searchTasks=sqliteTable('search_tasks',{
 jobId:text('job_id').notNull(),ownerId:text('owner_id').notNull(),taskKey:text('task_key').notNull(),url:text('url').notNull(),host:text('host').notNull(),kind:text('kind').notNull(),status:text('status').notNull().default('queued'),priority:integer('priority').notNull().default(50),payload:text('payload').notNull(),report:text('report'),attempts:integer('attempts').notNull().default(0),retryAt:text('retry_at'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[primaryKey({columns:[t.jobId,t.taskKey]}),index('idx_tasks_owner_job_queue').on(t.ownerId,t.jobId,t.status,t.priority),index('idx_tasks_owner_host').on(t.ownerId,t.jobId,t.host,t.status)]);
export const searchListings=sqliteTable('search_listings',{
 jobId:text('job_id').notNull(),ownerId:text('owner_id').notNull(),listingKey:text('listing_key').notNull(),title:text('title').notNull(),location:text('location').notNull(),sourceUrl:text('source_url').notNull(),source:text('source').notNull(),state:text('state'),building:text('building').notNull(),solar:text('solar').notNull(),askingPrice:integer('asking_price'),valuation:integer('valuation'),area:integer('area'),expired:integer('expired').notNull().default(0),broker:integer('broker').notNull().default(0),payload:text('payload').notNull(),firstSeen:text('first_seen').notNull(),lastSeen:text('last_seen').notNull()
},t=>[primaryKey({columns:[t.jobId,t.listingKey]}),index('idx_listings_owner_job').on(t.ownerId,t.jobId),index('idx_listings_job_price').on(t.ownerId,t.jobId,t.askingPrice)]);
export const searchDocuments=sqliteTable('search_documents',{
 jobId:text('job_id').notNull(),ownerId:text('owner_id').notNull(),documentKey:text('document_key').notNull(),sourceUrl:text('source_url').notNull(),pageStart:integer('page_start').notNull(),payload:text('payload').notNull(),textContent:text('text_content').notNull(),createdAt:text('created_at').notNull()
},t=>[primaryKey({columns:[t.jobId,t.documentKey]}),index('idx_search_documents_owner_job').on(t.ownerId,t.jobId)]);

export const marketInventory=sqliteTable('market_inventory',{
 ownerId:text('owner_id').notNull(),listingKey:text('listing_key').notNull(),payload:text('payload').notNull(),origin:text('origin').notNull(),fingerprint:text('fingerprint').notNull(),firstSeen:text('first_seen').notNull(),lastSeen:text('last_seen').notNull(),lastSourceAt:text('last_source_at'),lastJobId:text('last_job_id').notNull(),sightings:integer('sightings').notNull().default(1),changeCount:integer('change_count').notNull().default(0)
},t=>[primaryKey({columns:[t.ownerId,t.listingKey]}),index('idx_inventory_owner_seen').on(t.ownerId,t.lastSeen)]);
export const marketEvents=sqliteTable('market_events',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),listingKey:text('listing_key').notNull(),jobId:text('job_id').notNull(),eventType:text('event_type').notNull(),origin:text('origin').notNull(),sourceAt:text('source_at'),receivedAt:text('received_at').notNull(),fingerprint:text('fingerprint').notNull(),payload:text('payload').notNull()
},t=>[index('idx_market_events_owner_listing').on(t.ownerId,t.listingKey,t.receivedAt)]);
