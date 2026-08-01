-- ============================================================================
-- Settings audit M-5 / S-2.4 / S-5.3 — the bucket accepted anything, of any size.
--
--     file_size_limit = null, allowed_mime_types = null
--
-- The Startup screen's caption promises "PNG/SVG • up to 1 MB" and the
-- Signature screen's promises "PNG (transparent) • up to 500KB". Neither was
-- enforced anywhere: not in the bucket, not in `uploadInstitutionAsset`, and
-- the `accept=` attribute on a file input is a picker hint that any scripted
-- client ignores. So every authenticated account on a tenant could write
-- unbounded bytes of arbitrary content into that tenant's storage prefix.
--
-- WHY 2 MB AND NOT THE 1 MB THE CAPTION CLAIMS. The bucket is the backstop, not
-- the product rule. The client downscales through `shared/lib/imageResize` and
-- rejects at the tighter, per-purpose limit before a byte is sent; the bucket's
-- job is to be the thing that still holds when the client is bypassed. Setting
-- them equal means every legitimate near-limit upload becomes a race between
-- two checks with different rounding.
--
-- SVG STAYS ALLOWED. Institutions have vector logos and they belong on a
-- printed marksheet header. It is rendered through `<img src>`, which does not
-- execute script, and it is served from a private bucket via a signed URL — it
-- is never same-origin HTML. PDF stays for the student file attachments that
-- share this bucket.
-- ============================================================================

update storage.buckets
   set file_size_limit = 2097152,  -- 2 MiB
       allowed_mime_types = array[
         'image/png',
         'image/jpeg',
         'image/webp',
         'image/svg+xml',
         'application/pdf'
       ]
 where id = 'institution-assets';
