// Pure helpers for the admin widgets, kept separate from init.js so they can be unit-tested.
const empty = (value) => value === undefined || value === null || value === '';

export const isImmutableMap = (value) => Boolean(value?.['@@__IMMUTABLE_MAP__@@']);

export const EXIF_TARGETS = {
  camera: ['photo', 'camera'],
  lens: ['photo', 'lens'],
  focalLength: ['photo', 'focalLength'],
  aperture: ['photo', 'aperture'],
  shutter: ['photo', 'shutter'],
  iso: ['photo', 'iso'],
  software: ['photo', 'software'],
  date: ['date'],
};

// EXIF only fills blanks, so values typed by hand survive a re-upload. `value` is the photo's
// Immutable map from Decap; `asset` is what the upload step learnt about the file.
export function prefill(value, asset) {
  if (empty(value.get('id')) && asset.id) value = value.set('id', asset.id);
  for (const [key, path] of Object.entries(EXIF_TARGETS))
    if (!empty(asset.exif?.[key]) && empty(value.getIn(path)))
      value = value.setIn(path, asset.exif[key]);
  return value;
}
