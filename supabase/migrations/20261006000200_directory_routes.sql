alter table showhome_web.directory_cards add column collection_slugs text[] not null default '{}';
create index web_directory_route on showhome_web.directory_cards(kind,href);
