-- Gallery facets need identities, not image metadata; avoid thousands of heap reads.
create index web_images_identity_cover on showhome_web.images(builder_slug,catalogue_id) include(key);
analyze showhome_web.images,showhome_web.gallery_images,showhome_web.galleries,showhome_web.developments,showhome_web.buildings;
