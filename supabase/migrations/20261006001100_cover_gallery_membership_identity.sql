-- Membership views only need these two image identity columns. Keep joins off
-- the image heap containing large classification metadata.
create index web_images_membership_identity on showhome_web.images(key) include(internal_id);
analyze showhome_web.images;
update showhome_web.publication_revision set revision=revision+1 where singleton=true;
truncate showhome_web.query_cache;
