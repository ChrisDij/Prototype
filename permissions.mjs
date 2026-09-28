// Owner/member boundaries from the supplied wireframes. No role edits source data.
export const permissions = Object.freeze({
  manager: Object.freeze({canDrillDown:true, canExport:true, canFeedback:true, canManageTeam:true, canViewAlerts:true}),
  reporting: Object.freeze({canDrillDown:true, canExport:true, canFeedback:true, canManageTeam:false, canViewAlerts:false}),
});
