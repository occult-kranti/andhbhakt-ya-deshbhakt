/** Only missions backed by current device practice/Vault events belong on Home. */
export const PRACTICE_MISSION_TEMPLATES = Object.freeze([
  'answer-3', 'open-2', 'save-2', 'discovery-1', 'expedition-cards-2',
  'expedition-finish-1', 'correct-6', 'review-5', 'bold-4',
]);
export const missionTemplate = item => item?.template ?? item?.id?.split(':').pop();
export function practiceMissions(items) {
  return items.filter(item => PRACTICE_MISSION_TEMPLATES.includes(missionTemplate(item)));
}
