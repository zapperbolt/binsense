// Which collection-point dataset (if any) makes sense for an item's disposal category.
// general waste and compost have no drop-off point, so they return null.
const COLLECTION_BY_CATEGORY = { recycle: 'recycling', special: 'ewaste', textile: 'textile' };

export function collectionCategoryFor(item) {
  return COLLECTION_BY_CATEGORY[item?.category] ?? null;
}

// How each disposal category is grouped for the filter chips: can it go in
// the blue bin, is it rubbish, or does it need a special drop-off?
// 'unknown' is for items the person says aren't in our guide.
const GROUP_BY_CATEGORY = { recycle: 'recyclable', general: 'rubbish', compost: 'rubbish', special: 'special', textile: 'special' };
export const GROUPS = ['recyclable', 'rubbish', 'special', 'unknown'];
export const FILTERS = ['all', ...GROUPS];
export const NOT_LISTED = 'not-listed';

export function disposalGroup(item) {
  if (!item) return 'unknown';
  // Unknown categories count as rubbish, never as recyclable: wrongly sending
  // something to the blue bin contaminates a whole bin of recyclables.
  return GROUP_BY_CATEGORY[item.category] ?? 'rubbish';
}

// i18n key for the badge text on a detection.
export const badgeKey = item => (item ? `badge.${GROUP_BY_CATEGORY[item.category] ? item.category : 'general'}` : 'badge.unknown');

// Condition advice only matters for things heading to the blue bin: a dirty
// tissue is general waste either way, but a dirty bottle needs rinsing first.
export function conditionAdviceKey(detection) {
  if (detection.group !== 'recyclable') return null;
  return ['not_empty', 'food_residue'].includes(detection.condition) ? `cond.${detection.condition}` : null;
}

// Joins Gemini detections with the guide data and numbers them 1..n in the
// order Gemini returned them. Detections whose ID isn't in the guide are dropped.
export function enrichDetections(detections, itemsById) {
  return (detections || []).flatMap(d => {
    const item = itemsById.get(d.item_id);
    return item ? [{ ...d, item, group: disposalGroup(item) }] : [];
  }).map((d, index) => ({ ...d, number: index + 1 }));
}

// Returns a new list where one detection is replaced by what the person says
// it really is. The number and box stay, so it still matches the photo.
export function applyCorrection(detections, number, correctedId, itemsById) {
  return detections.map(d => {
    if (d.number !== number) return d;
    const item = correctedId === NOT_LISTED ? null : itemsById.get(correctedId) ?? null;
    return { ...d, item_id: item?.id ?? NOT_LISTED, item, group: disposalGroup(item), corrected: true, originalId: d.originalId ?? d.item_id };
  });
}

export function countByGroup(detections) {
  const counts = Object.fromEntries(GROUPS.map(g => [g, 0]));
  for (const d of detections) counts[d.group] += 1;
  return counts;
}

export function filterDetections(detections, filterId) {
  return filterId === 'all' ? detections : detections.filter(d => d.group === filterId);
}
