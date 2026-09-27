// Proposed permissions, pending client review. No role grants source-data editing.
export const permissions = Object.freeze({
  manager: Object.freeze({canDrillDown:true, canExport:true, canFeedback:true}),
  reporting: Object.freeze({canDrillDown:false, canExport:true, canFeedback:true}),
});
