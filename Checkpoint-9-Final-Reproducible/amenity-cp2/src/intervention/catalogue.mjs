export const interventionCatalogue = Object.freeze([
  {code:'monitor',name:'Monitor',ladderPosition:1,purpose:'Observe a justified persistence/recovery question',intent:'observe-pattern'},
  {code:'validate',name:'Validate',ladderPosition:2,purpose:'Resolve a named decision-relevant uncertainty',intent:'resolve-gap'},
  {code:'repair',name:'Repair / Restore',ladderPosition:3,purpose:'Restore an independently evidenced existing function',intent:'restore-existing'},
  {code:'reprogramme',name:'Reprogramme',ladderPosition:4,purpose:'Address a supported programme/configuration need',intent:'programme-adjustment'},
  {code:'pilot',name:'Temporary Alternative-Use Pilot',ladderPosition:5,purpose:'Run a bounded intervention that can generate evidence',intent:'bounded-experiment'},
  {code:'shared',name:'Shared / Partial Reallocation',ladderPosition:6,purpose:'Add supported shared use while retaining protected function',intent:'share-capacity'},
  {code:'preserve',name:'Preserve',ladderPosition:null,purpose:'Maintain the current function for a protected dependent cohort',intent:'maintain-function'}
].map(Object.freeze));
export const INTERVENTION_CATALOGUE_VERSION='intervention-catalogue-1.0';
