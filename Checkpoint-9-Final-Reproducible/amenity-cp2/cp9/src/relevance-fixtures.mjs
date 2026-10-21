// Frozen before embedding evaluation. Relevance is topic-specific decision-time
// narrative relevance, independent of all intervention outcomes. English only.
export const relevanceFixtures=[
 {id:'heldout-food-1',family:'heldout:cuisine-1',text:'People would like to learn culinary techniques and prepare meals together in this venue.',relevant:['reprogramme-0','reprogramme-1','reprogramme-2']},
 {id:'heldout-food-2',family:'heldout:cuisine-2',text:'Participants ask for hands-on tuition in making dishes, working with ingredients and preparing dinner.',relevant:['reprogramme-0','reprogramme-1','reprogramme-2']},
 {id:'heldout-music-1',family:'heldout:sound-1',text:'Local performers need ensemble sessions, melodic instruction and a place to practise songs.',relevant:['music-0','music-1','music-2']},
 {id:'heldout-music-2',family:'heldout:sound-2',text:'People hope to learn to play instruments together and rehearse tunes with a vocal group.',relevant:['music-0','music-1','music-2']},
 {id:'heldout-exercise-1',family:'heldout:movement-1',text:'Participants seek low-impact workouts, mobility sessions and opportunities to improve physical wellbeing.',relevant:['exercise-0','exercise-1','exercise-2']},
 {id:'heldout-exercise-2',family:'heldout:movement-2',text:'The venue could offer guided body conditioning, flexibility sessions and active healthy movement.',relevant:['exercise-0','exercise-1','exercise-2']}
];
export const RELEVANCE_POLICY={version:'predeclared-relevance-1',k:3,meaning:'Topic-specific pre-decision narrative relevance; all nine reference cases still meet the same hard comparability constraints. No suitability denominator is changed.',metric:'Precision@3 and mean reciprocal rank; prototype validation on simulated cases',baseline:'Same hard filters, rank by fewest noncritical structured differences, stable episode ID for exact ties; narrative text unused',holdout:'Query families have no reference episodes; no supervised training or parameter tuning on these judgements'};
