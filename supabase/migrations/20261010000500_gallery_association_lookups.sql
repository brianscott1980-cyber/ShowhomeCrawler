-- Card associations resolve a case-insensitive building name for every home.
-- An expression index avoids rescanning all directory cards for each membership.
create index if not exists web_directory_building_lookup
 on showhome_web.directory_cards (lower(building_name), href)
 where kind='buildings';
-- Building detail dialogs resolve published developments by builder and source URL.
create index if not exists web_directory_development_lookup
 on showhome_web.directory_cards (builder_slug, development_url)
 where kind='locations' and is_ready;
