export const interventionDecisionPolicy = Object.freeze({version:'intervention-decision-1.0',numericActionScore:false,
  sharedRequiresExplanationSufficient:true,preserveRequiresHighDependencyStateSufficient:true,operatorHardBlockOverride:false,
  independentPurposeRepair:true,approvalIsExecution:false,requiresNonPreferredRationale:true,
  forbiddenActions:['permanent-repurposing','permanent-removal','demolition'],
  qualitativeOrders:{disruption:['none','limited','substantial'],functionLoss:['none','temporary','partial'],rollback:['immediate','simple','complex']}});
