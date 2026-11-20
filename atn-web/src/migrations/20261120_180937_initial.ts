import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`programas_benefits_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`icon\` text DEFAULT 'globe',
  	\`title\` text NOT NULL,
  	\`description\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`programas\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`programas_benefits_items_order_idx\` ON \`programas_benefits_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`programas_benefits_items_parent_id_idx\` ON \`programas_benefits_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`programas_call_images\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`programas\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`programas_call_images_order_idx\` ON \`programas_call_images\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`programas_call_images_parent_id_idx\` ON \`programas_call_images\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`programas_call_images_image_idx\` ON \`programas_call_images\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`programas_call_eligibility\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`text\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`programas\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`programas_call_eligibility_order_idx\` ON \`programas_call_eligibility\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`programas_call_eligibility_parent_id_idx\` ON \`programas_call_eligibility\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`programas_process_steps\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`icon\` text DEFAULT 'globe',
  	\`title\` text NOT NULL,
  	\`description\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`programas\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`programas_process_steps_order_idx\` ON \`programas_process_steps\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`programas_process_steps_parent_id_idx\` ON \`programas_process_steps\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`programas_stages_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`title\` text NOT NULL,
  	\`description\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`programas\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`programas_stages_items_order_idx\` ON \`programas_stages_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`programas_stages_items_parent_id_idx\` ON \`programas_stages_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`programas_stages_items_image_idx\` ON \`programas_stages_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`programas_testimonials_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`quote\` text NOT NULL,
  	\`name\` text NOT NULL,
  	\`detail\` text,
  	\`avatar_id\` integer,
  	FOREIGN KEY (\`avatar_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`programas\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`programas_testimonials_items_order_idx\` ON \`programas_testimonials_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`programas_testimonials_items_parent_id_idx\` ON \`programas_testimonials_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`programas_testimonials_items_avatar_idx\` ON \`programas_testimonials_items\` (\`avatar_id\`);`)
  await db.run(sql`CREATE TABLE \`programas\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`order\` numeric DEFAULT 1,
  	\`slug\` text,
  	\`hero_background_id\` integer,
  	\`hero_logo_id\` integer,
  	\`hero_title\` text,
  	\`hero_subtitle\` text,
  	\`hero_cta_label\` text,
  	\`hero_cta_url\` text,
  	\`intro_title\` text,
  	\`intro_body\` text,
  	\`intro_image_id\` integer,
  	\`benefits_title\` text,
  	\`call_title\` text,
  	\`call_cta_label\` text,
  	\`call_cta_url\` text,
  	\`call_eligibility_title\` text,
  	\`process_title\` text,
  	\`stages_title\` text,
  	\`testimonials_title\` text,
  	\`community_title\` text,
  	\`community_image_id\` integer,
  	\`community_cta_label\` text,
  	\`community_cta_url\` text,
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`seo_image_id\` integer,
  	\`seo_no_index\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`hero_background_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`hero_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`intro_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`community_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`programas_slug_idx\` ON \`programas\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`programas_hero_hero_background_idx\` ON \`programas\` (\`hero_background_id\`);`)
  await db.run(sql`CREATE INDEX \`programas_hero_hero_logo_idx\` ON \`programas\` (\`hero_logo_id\`);`)
  await db.run(sql`CREATE INDEX \`programas_intro_intro_image_idx\` ON \`programas\` (\`intro_image_id\`);`)
  await db.run(sql`CREATE INDEX \`programas_community_community_image_idx\` ON \`programas\` (\`community_image_id\`);`)
  await db.run(sql`CREATE INDEX \`programas_seo_seo_image_idx\` ON \`programas\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`programas_updated_at_idx\` ON \`programas\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`programas_created_at_idx\` ON \`programas\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`paginas\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`slug\` text,
  	\`content\` text,
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`seo_image_id\` integer,
  	\`seo_no_index\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`paginas_slug_idx\` ON \`paginas\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`paginas_seo_seo_image_idx\` ON \`paginas\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE INDEX \`paginas_updated_at_idx\` ON \`paginas\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`paginas_created_at_idx\` ON \`paginas\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`media\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`alt\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	\`focal_x\` numeric,
  	\`focal_y\` numeric,
  	\`sizes_thumbnail_url\` text,
  	\`sizes_thumbnail_width\` numeric,
  	\`sizes_thumbnail_height\` numeric,
  	\`sizes_thumbnail_mime_type\` text,
  	\`sizes_thumbnail_filesize\` numeric,
  	\`sizes_thumbnail_filename\` text,
  	\`sizes_card_url\` text,
  	\`sizes_card_width\` numeric,
  	\`sizes_card_height\` numeric,
  	\`sizes_card_mime_type\` text,
  	\`sizes_card_filesize\` numeric,
  	\`sizes_card_filename\` text,
  	\`sizes_large_url\` text,
  	\`sizes_large_width\` numeric,
  	\`sizes_large_height\` numeric,
  	\`sizes_large_mime_type\` text,
  	\`sizes_large_filesize\` numeric,
  	\`sizes_large_filename\` text,
  	\`sizes_og_url\` text,
  	\`sizes_og_width\` numeric,
  	\`sizes_og_height\` numeric,
  	\`sizes_og_mime_type\` text,
  	\`sizes_og_filesize\` numeric,
  	\`sizes_og_filename\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_thumbnail_sizes_thumbnail_filename_idx\` ON \`media\` (\`sizes_thumbnail_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_card_sizes_card_filename_idx\` ON \`media\` (\`sizes_card_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_large_sizes_large_filename_idx\` ON \`media\` (\`sizes_large_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_og_sizes_og_filename_idx\` ON \`media\` (\`sizes_og_filename\`);`)
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`reset_password_requested_at\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`programas_id\` integer,
  	\`paginas_id\` integer,
  	\`media_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`programas_id\`) REFERENCES \`programas\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`paginas_id\`) REFERENCES \`paginas\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_programas_id_idx\` ON \`payload_locked_documents_rels\` (\`programas_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_paginas_id_idx\` ON \`payload_locked_documents_rels\` (\`paginas_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`home_hero_slides\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_hero_slides_order_idx\` ON \`home_hero_slides\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_hero_slides_parent_id_idx\` ON \`home_hero_slides\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_hero_slides_image_idx\` ON \`home_hero_slides\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`home_impact_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`icon\` text DEFAULT 'globe',
  	\`title\` text NOT NULL,
  	\`description\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_impact_items_order_idx\` ON \`home_impact_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_impact_items_parent_id_idx\` ON \`home_impact_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`home_programs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`question\` text NOT NULL,
  	\`cta_label\` text NOT NULL,
  	\`cta_url\` text NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_programs_order_idx\` ON \`home_programs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_programs_parent_id_idx\` ON \`home_programs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_programs_image_idx\` ON \`home_programs\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`home_recetario_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`title\` text NOT NULL,
  	\`subtitle\` text,
  	\`file_id\` integer,
  	\`download_label\` text DEFAULT 'Descargar',
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`file_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_recetario_items_order_idx\` ON \`home_recetario_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_recetario_items_parent_id_idx\` ON \`home_recetario_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_recetario_items_image_idx\` ON \`home_recetario_items\` (\`image_id\`);`)
  await db.run(sql`CREATE INDEX \`home_recetario_items_file_idx\` ON \`home_recetario_items\` (\`file_id\`);`)
  await db.run(sql`CREATE TABLE \`home\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`hero_logo_id\` integer,
  	\`hero_title\` text,
  	\`about_title\` text,
  	\`about_body\` text,
  	\`about_image_id\` integer,
  	\`impact_title\` text,
  	\`map_enabled\` integer DEFAULT true,
  	\`map_title\` text,
  	\`map_description\` text,
  	\`map_image_id\` integer,
  	\`map_embed_url\` text,
  	\`map_primary_button_label\` text,
  	\`map_primary_button_url\` text,
  	\`map_secondary_button_label\` text,
  	\`map_secondary_button_url\` text,
  	\`recetario_enabled\` integer DEFAULT true,
  	\`recetario_title\` text,
  	\`community_cta_label\` text,
  	\`community_cta_url\` text,
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`seo_image_id\` integer,
  	\`seo_no_index\` integer DEFAULT false,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`hero_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`about_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`map_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`home_hero_hero_logo_idx\` ON \`home\` (\`hero_logo_id\`);`)
  await db.run(sql`CREATE INDEX \`home_about_about_image_idx\` ON \`home\` (\`about_image_id\`);`)
  await db.run(sql`CREATE INDEX \`home_map_map_image_idx\` ON \`home\` (\`map_image_id\`);`)
  await db.run(sql`CREATE INDEX \`home_seo_seo_image_idx\` ON \`home\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE TABLE \`comunidad_testimonials_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`quote\` text NOT NULL,
  	\`name\` text NOT NULL,
  	\`detail\` text,
  	\`avatar_id\` integer,
  	FOREIGN KEY (\`avatar_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`comunidad\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`comunidad_testimonials_items_order_idx\` ON \`comunidad_testimonials_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`comunidad_testimonials_items_parent_id_idx\` ON \`comunidad_testimonials_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`comunidad_testimonials_items_avatar_idx\` ON \`comunidad_testimonials_items\` (\`avatar_id\`);`)
  await db.run(sql`CREATE TABLE \`comunidad_recetario_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`title\` text NOT NULL,
  	\`subtitle\` text,
  	\`file_id\` integer,
  	\`download_label\` text DEFAULT 'Descargar',
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`file_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`comunidad\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`comunidad_recetario_items_order_idx\` ON \`comunidad_recetario_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`comunidad_recetario_items_parent_id_idx\` ON \`comunidad_recetario_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`comunidad_recetario_items_image_idx\` ON \`comunidad_recetario_items\` (\`image_id\`);`)
  await db.run(sql`CREATE INDEX \`comunidad_recetario_items_file_idx\` ON \`comunidad_recetario_items\` (\`file_id\`);`)
  await db.run(sql`CREATE TABLE \`comunidad\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`hero_eyebrow\` text,
  	\`hero_logo_id\` integer,
  	\`hero_title\` text,
  	\`hero_video_url\` text,
  	\`hero_video_file_id\` integer,
  	\`hero_poster_id\` integer,
  	\`map_enabled\` integer DEFAULT true,
  	\`map_title\` text,
  	\`map_description\` text,
  	\`map_image_id\` integer,
  	\`map_embed_url\` text,
  	\`map_primary_button_label\` text,
  	\`map_primary_button_url\` text,
  	\`map_secondary_button_label\` text,
  	\`map_secondary_button_url\` text,
  	\`testimonials_title\` text,
  	\`recetario_enabled\` integer DEFAULT true,
  	\`recetario_title\` text,
  	\`seo_title\` text,
  	\`seo_description\` text,
  	\`seo_image_id\` integer,
  	\`seo_no_index\` integer DEFAULT false,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`hero_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`hero_video_file_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`hero_poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`map_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`comunidad_hero_hero_logo_idx\` ON \`comunidad\` (\`hero_logo_id\`);`)
  await db.run(sql`CREATE INDEX \`comunidad_hero_hero_video_file_idx\` ON \`comunidad\` (\`hero_video_file_id\`);`)
  await db.run(sql`CREATE INDEX \`comunidad_hero_hero_poster_idx\` ON \`comunidad\` (\`hero_poster_id\`);`)
  await db.run(sql`CREATE INDEX \`comunidad_map_map_image_idx\` ON \`comunidad\` (\`map_image_id\`);`)
  await db.run(sql`CREATE INDEX \`comunidad_seo_seo_image_idx\` ON \`comunidad\` (\`seo_image_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_nav\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text NOT NULL,
  	\`url\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_nav_order_idx\` ON \`site_settings_nav\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_nav_parent_id_idx\` ON \`site_settings_nav\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_allies\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`heading\` text NOT NULL,
  	\`name\` text NOT NULL,
  	\`logo_id\` integer,
  	\`background_id\` integer,
  	\`url\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`background_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_allies_order_idx\` ON \`site_settings_allies\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_allies_parent_id_idx\` ON \`site_settings_allies\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_allies_logo_idx\` ON \`site_settings_allies\` (\`logo_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_allies_background_idx\` ON \`site_settings_allies\` (\`background_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_footer_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text NOT NULL,
  	\`url\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_footer_links_order_idx\` ON \`site_settings_footer_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_footer_links_parent_id_idx\` ON \`site_settings_footer_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_footer_logos\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`url\` text,
  	\`logo_id\` integer,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_footer_logos_order_idx\` ON \`site_settings_footer_logos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_footer_logos_parent_id_idx\` ON \`site_settings_footer_logos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_footer_logos_logo_idx\` ON \`site_settings_footer_logos\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_contact_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text NOT NULL,
  	\`url\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_contact_links_order_idx\` ON \`site_settings_contact_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_contact_links_parent_id_idx\` ON \`site_settings_contact_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`site_name\` text NOT NULL,
  	\`logo_id\` integer,
  	\`logo_light_id\` integer,
  	\`whatsapp_number\` text,
  	\`whatsapp_message\` text,
  	\`contact_title\` text,
  	\`social_facebook\` text,
  	\`social_linkedin\` text,
  	\`social_instagram\` text,
  	\`site_url\` text,
  	\`default_title\` text,
  	\`default_description\` text,
  	\`default_image_id\` integer,
  	\`google_verification\` text,
  	\`ga_id\` text,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_light_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`default_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_logo_idx\` ON \`site_settings\` (\`logo_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_logo_light_idx\` ON \`site_settings\` (\`logo_light_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_default_image_idx\` ON \`site_settings\` (\`default_image_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`programas_benefits_items\`;`)
  await db.run(sql`DROP TABLE \`programas_call_images\`;`)
  await db.run(sql`DROP TABLE \`programas_call_eligibility\`;`)
  await db.run(sql`DROP TABLE \`programas_process_steps\`;`)
  await db.run(sql`DROP TABLE \`programas_stages_items\`;`)
  await db.run(sql`DROP TABLE \`programas_testimonials_items\`;`)
  await db.run(sql`DROP TABLE \`programas\`;`)
  await db.run(sql`DROP TABLE \`paginas\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
  await db.run(sql`DROP TABLE \`home_hero_slides\`;`)
  await db.run(sql`DROP TABLE \`home_impact_items\`;`)
  await db.run(sql`DROP TABLE \`home_programs\`;`)
  await db.run(sql`DROP TABLE \`home_recetario_items\`;`)
  await db.run(sql`DROP TABLE \`home\`;`)
  await db.run(sql`DROP TABLE \`comunidad_testimonials_items\`;`)
  await db.run(sql`DROP TABLE \`comunidad_recetario_items\`;`)
  await db.run(sql`DROP TABLE \`comunidad\`;`)
  await db.run(sql`DROP TABLE \`site_settings_nav\`;`)
  await db.run(sql`DROP TABLE \`site_settings_allies\`;`)
  await db.run(sql`DROP TABLE \`site_settings_footer_links\`;`)
  await db.run(sql`DROP TABLE \`site_settings_footer_logos\`;`)
  await db.run(sql`DROP TABLE \`site_settings_contact_links\`;`)
  await db.run(sql`DROP TABLE \`site_settings\`;`)
}
