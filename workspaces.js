const LEVELS = [
  'Getting the basics right', 'Building accuracy and consistency', 'Using tools and workflows',
  'Solving everyday work problems', 'Working professionally and safely', 'Job-ready practice'
];
const W = [
['brain-test','Brain Test','Sharpen logic, memory and problem-solving','◈','Patterns, working memory, estimation, deduction, sequencing, and careful reasoning.'],
['house-review','House Review','Evaluate property listings like a pro','⌂','Listing accuracy, photo checks, amenity verification, fair comparisons, and clear reports.'],
['aviator-skills-quiz','Aviator Skills Quiz','Understand chance, risk and discipline','✈','Probability, variance, limits, record-keeping, and recognizing that outcomes cannot be predicted.'],
['surveys','Surveys','Learn how professional surveys work','▤','Neutral wording, consent, eligibility, honest answers, and survey quality.'],
['transcriptionist','Transcriptionist','Turn audio into clean, accurate text','♫','Listening, verbatim conventions, speaker labels, timestamps, research, and proofreading.'],
['chat-moderator','Chat Moderator','Kuchat na wazungu — keep conversations safe and professional','☏','Tone, escalation, privacy, boundaries, policy enforcement, and clear written English.'],
['data-entry-worker','Data Entry Worker','Speed, accuracy and confidentiality','▦','Validation, consistent formatting, duplicate checks, secure handling, and quality control.'],
['online-survey-participant','Online Survey Participant','Get chosen for more paid surveys','◎','Profile accuracy, screening questions, attention checks, honest participation, and privacy.'],
['search-engine-evaluator','Search Engine Evaluator','Rate search results like a professional','⌕','Intent, relevance, trust, location, freshness, and applying rating guidelines consistently.'],
['ai-data-annotator','AI Data Annotator','Label data that trains reliable AI','✳','Label taxonomies, edge cases, uncertainty, bias awareness, privacy, and annotation consistency.'],
['virtual-assistant','Virtual Assistant','Support clients professionally, from anywhere','▧','Prioritization, calendar management, client communication, confidentiality, and follow-through.'],
['website-tester','Website Tester','Find bugs before users do','⌘','Reproduction steps, expected versus actual behavior, device coverage, severity, and evidence.'],
['product-reviewer','Product Reviewer','Write reviews people can trust','☆','Firsthand use, specific evidence, balanced pros and cons, disclosure, and honest conclusions.'],
['online-tutor','Online Tutor','Teach clearly, anywhere in Kenya','◉','Lesson goals, explanation, checking understanding, feedback, inclusion, and learner safety.'],
['proofreader','Proofreader','Catch the errors others miss','¶','Grammar, spelling, punctuation, consistency, meaning, and careful final checks.'],
['social-media-moderator','Social Media Moderator','Protect and grow online communities','⌗','Community rules, context, harassment, escalation, privacy, and calm public responses.'],
['audio-recorder','Audio Recorder / Voice Contributor','Contribute clean voice recordings that pay','◖','Prompt accuracy, quiet rooms, microphone distance, natural delivery, file checks, and consent.'],
['microtask-worker','Microtask Worker','Small tasks, steady earnings','⠿','Instruction following, quality checks, task eligibility, time management, and honest reporting.'],
['online-researcher','Online Researcher','Find facts fast — and verify them','⌖','Source quality, cross-checking, dates, primary evidence, citations, and separating fact from opinion.']
].map(([slug,title,description,icon,focus])=>({slug,title,description,icon,focus}));

// Each workspace uses a domain-specific assessment bank. Each of its 10 prompts is
// contextualized for the level's learning goal; correct answers stay server-side.
const BANKS = {
'brain-test':[
['A sequence is 2, 4, 8, 16. What comes next?',['24','30','32','18'],2],['All Neris are blue. This shape is a Neri. What follows?',['It is blue','It is round','It is not blue','There is not enough information'],0],['You remember a code by grouping digits into pairs. What strategy is this?',['Chunking','Guessing','Skimming','Switching'],0],['A task has three steps; step C needs step B first. What should you do?',['Do C now','Complete B before C','Skip B','Repeat A only'],1],['Which estimate is closest to 198 + 305?',['400','500','600','700'],1],['You have 4 red and 3 blue tiles. How many tiles altogether?',['7','8','12','1'],0],['A statement says every square has four sides. A shape is a square. What is certain?',['It has four sides','It is blue','It is large','It is a circle'],0],['Which is the best way to check a puzzle answer?',['Use a second method','Choose the longest option','Stop after guessing','Ignore the clues'],0],['A, C, E, G: what is the next letter?',['H','I','J','K'],1],['A rule applies to every item in a group. One item breaks the rule. What is useful next?',['Check whether it belongs in the group','Change the rule instantly','Hide the item','Ignore the exception'],0]],
'house-review':[
['The listing says 2 bedrooms, but the floor plan shows 3. What should you do?',['Guess which is right','Flag the mismatch and verify','Delete the floor plan','Publish both as fact'],1],['A photo appears to show a different property. What is the best action?',['Use it anyway','Check the source and report the mismatch','Call it a bonus room','Crop out the clue'],1],['How should you compare two similar rentals?',['Use the same criteria for both','Pick the prettier one','Compare unrelated features','Use only the headline'],0],['An amenity is mentioned but not evidenced. How should it be recorded?',['Verified','Not confirmed','Guaranteed','Ignore the listing'],1],['What makes a review note useful?',['Specific observation and evidence','A personal insult','A guess','Only “bad”'],0],['A price differs between text and image. What next?',['Record the discrepancy','Choose the lower price','Choose the higher price','Hide the image'],0],['Which photo detail can help verify a room?',['Consistent layout and fixtures','The file size alone','A watermark color','The caption font'],0],['A property location is vague. What is safest?',['State the uncertainty and request confirmation','Invent an address','Use another listing’s location','Publish a precise pin'],0],['How should you describe an unverified claim?',['As confirmed','As unverified','As a guarantee','As your own observation'],1],['Before submitting a listing evaluation, you should…',['Check facts against the available evidence','Assume missing details','Copy the headline','Skip discrepancies'],0]],
'aviator-skills-quiz':[
['Can a past random outcome guarantee the next outcome?',['Yes, always','No, independent outcomes are uncertain','Only after a streak','Only with a prediction app'],1],['A 1-in-4 chance means…',['It must happen every fourth try','Each trial has a 1-in-4 probability','It cannot happen','It happens exactly once'],1],['What is a sensible way to manage risk?',['Set a limit in advance','Chase losses','Borrow to continue','Assume a pattern'],0],['A long streak has occurred. What can you conclude about the next random result?',['It must reverse','The streak guarantees a win','No certainty follows from the streak','The next result is larger'],2],['Why keep a record of decisions?',['To review behavior and limits','To predict guaranteed outcomes','To remove all risk','To change past results'],0],['What does “expected value” describe?',['A long-run average across outcomes','A guaranteed single result','The most recent result','A way to remove uncertainty'],0],['If an activity risks money you need for essentials, what is prudent?',['Do not risk essential funds','Double the amount','Borrow more','Ignore the budget'],0],['A “near miss” proves the next result is due. True or false?',['True','False','Only online','Only after three misses'],1],['What should you do if a game feels hard to stop?',['Pause and seek support','Increase the stake','Hide the activity','Chase the loss'],0],['Which statement is most accurate?',['Random results can be predicted from a lucky streak','No strategy can guarantee a random outcome','A streak guarantees profit','Past outcomes erase future risk'],1]],
'surveys':[
['A survey question is unclear. What should you do?',['Ask for clarification or answer honestly if possible','Invent an answer','Choose any option quickly','Ask another person to answer'],0],['Why read the consent note before starting?',['To understand use of your responses','To get extra points','To skip eligibility','To reveal other responses'],0],['A question asks about an experience you have not had. Best response?',['Answer honestly or select not applicable','Pretend you have','Copy a friend','Leave random details'],0],['What is a leading question?',['One that nudges toward a particular answer','A question at the top','A required question','A question about a date'],0],['An attention check asks you to select “Agree”. What should you do?',['Follow the instruction carefully','Choose randomly','Skip every check','Ask a stranger'],0],['Why should survey answers stay consistent?',['Inconsistent answers can reduce data quality','It guarantees selection','It shortens every survey','It changes the questions'],0],['A survey requests unnecessary sensitive details. What is wise?',['Review privacy terms and avoid unsafe disclosure','Share passwords','Post details publicly','Use someone else’s identity'],0],['How do you improve screening accuracy?',['Keep your profile truthful and current','Change answers to qualify','Use multiple identities','Guess what the client wants'],0],['What should you do if you no longer qualify?',['Exit honestly','Keep answering as if eligible','Ask another person to take over','Change your profile'],0],['What makes research responses valuable?',['Honest, attentive answers','Fast random clicks','Repeated submissions','Copied responses'],0]],
};
const fallback = [
['A client gives an unclear instruction. What is the best first step?',['Ask a concise clarifying question','Make an assumption and hide it','Ignore the instruction','Send unrelated work'],0],
['You notice a possible error before submitting. What should you do?',['Check it against the brief and correct it','Submit without review','Delete the whole task','Blame the client'],0],
['A task asks for private customer details in a public post. What is safest?',['Do not expose private data; follow policy','Post it quickly','Send it to a friend','Store it publicly'],0],
['You cannot finish by the agreed time. What is professional?',['Tell the client early with a realistic update','Wait until the deadline passes','Claim it is complete','Stop responding'],0],
['Two instructions conflict. What should guide your next step?',['Confirm priority with the client or task owner','Pick whichever is easier','Do both secretly','Ignore both'],0],
['Why follow a consistent naming or formatting convention?',['It makes files easier to use and verify','It makes them private','It guarantees approval','It removes the need for review'],0],
['You are unsure whether a detail is verified. How should you present it?',['Clearly label the uncertainty','State it as fact','Invent a source','Remove all context'],0],
['A coworker requests your login password to help. What should you do?',['Never share credentials; use approved access','Send it by chat','Reuse a public password','Write it on a task'],0],
['What is a useful final quality check?',['Compare the finished work to the requirements','Check only the title','Assume the tool caught everything','Submit an empty file'],0],
['A task is outside your skill or access. What should you do?',['Say so and ask for guidance','Fake the result','Use another person’s account','Submit guesses'],0]
];
const roleActions={
'chat-moderator':'Apply the community rules consistently, protect user privacy, and escalate threats or uncertainty through the approved process.',
'data-entry-worker':'Enter only source-supported values, validate the format, and check for duplicates before submitting.',
'online-survey-participant':'Answer honestly, follow screening and attention-check instructions, and never invent experiences.',
'search-engine-evaluator':'Judge the result against the query intent and rating guide, then record a concise evidence-based reason.',
'ai-data-annotator':'Use the label definitions consistently, inspect edge cases, and flag uncertainty instead of guessing.',
'virtual-assistant':'Confirm the client priority, protect account information, and send a clear status update when plans change.',
'website-tester':'Reproduce the issue, record expected and actual behavior, and attach clear steps and evidence.',
'product-reviewer':'Describe firsthand use with specific evidence, disclose relevant relationships, and balance pros with cons.',
'online-tutor':'Set a clear learning goal, explain one step at a time, and check understanding before moving on.',
'proofreader':'Preserve the writer’s meaning while correcting errors, then make a final consistency pass.',
'social-media-moderator':'Use the published community policy, consider context, and escalate credible safety concerns.',
'audio-recorder':'Follow the prompt exactly, record in a quiet space at a steady distance, and review the audio before upload.',
'microtask-worker':'Check eligibility and instructions first, complete the requested steps carefully, and report blockers honestly.',
'online-researcher':'Prefer primary and current sources, cross-check important claims, and cite where each fact came from.',
'house-review':'Compare the listing with the available evidence, record discrepancies, and label unverified claims clearly.',
'transcriptionist':'Replay unclear sections, follow the transcription style guide, and mark uncertainty rather than inventing words.'
};
function getQuestions(slug, level) {
  const workspace = W.find(w=>w.slug===slug); if(!workspace) return null;
  const bank = BANKS[slug] || (()=>{
    const focus=workspace.focus.split(', ').filter(Boolean), action=roleActions[slug]||'Follow the task guidance, check the result against evidence, and report uncertainty honestly.';
    const options=[action,'Guess missing details and submit without checking.','Ignore the task guidance when it slows you down.','Share private information in an unapproved channel.'];
    return Array.from({length:10},(_,i)=>{const skill=focus[Math.floor(i/2)%focus.length],prompt=i%2===0?`How should you handle ${skill} as a ${workspace.title}?`:`Before submitting ${workspace.title} work involving ${skill}, what is the best check?`;return[prompt,options,0]});
  })();
  const stage = LEVELS[level-1];
  const focus=workspace.focus.split(', ').filter(Boolean);
  const situations=['on a first assignment','during a busy workday','while using your usual tools','when an unexpected issue appears','when handling a sensitive detail','during your final handoff'];
  return bank.map((item,i)=>({ id:`${slug}-l${level}-q${i+1}`, prompt:`Level ${level} · ${stage} · ${situations[level-1]}: ${workspace.title} — ${focus[i%focus.length]}. ${item[0]}`, choices:item[1], correct:item[2] }));
}
module.exports={WORKSPACES:W,LEVELS,getQuestions};
