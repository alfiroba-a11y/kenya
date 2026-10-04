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
const CHALLENGES = [
  [
    'A new assignment arrives with a short brief and a clear deadline.',
    'A client supplies a reference example before the work begins.',
    'The instructions name a specific format for the final file.',
    'A task includes a detail that must be checked against its source.',
    'You are asked to complete a familiar task using a new checklist.',
    'The assignment includes one unfamiliar term and otherwise clear steps.',
    'A handoff note explains what the next person needs to receive.',
    'A simple task has a required quality check before submission.',
    'The client describes the intended result but not every small step.',
    'You have to decide which written instruction applies to the task.'
  ],
  [
    'Two source records show different values for the same detail.',
    'A work item appears twice with slightly different spelling.',
    'A date is present, but its format differs from the rest of the file.',
    'A supporting image does not match the written description.',
    'One required field is blank while the remaining fields are complete.',
    'A draft contains a claim that has no supporting source attached.',
    'A response appears inconsistent with an earlier answer in the same task.',
    'A file name does not match the agreed naming convention.',
    'A copied value may have shifted into the neighbouring row.',
    'A reviewer flags a detail that the original checklist does not mention.'
  ],
  [
    'A task moves from intake to review and then to a client handoff.',
    'The approved checklist requires a source check before data entry.',
    'A teammate needs a short status update before taking the next step.',
    'The client asks for the result in a reusable, clearly labelled format.',
    'A recurring task must be completed consistently across several records.',
    'You need to keep a record of which items have passed quality review.',
    'A new tool is available, but the team has not approved it for this task.',
    'A delivery includes both a finished result and a note about limitations.',
    'A queue contains urgent and routine items with different deadlines.',
    'A task must be handed over without losing its source references.'
  ],
  [
    'The only supplied source is temporarily unavailable.',
    'A client changes one requirement after work has started.',
    'A tool produces an incomplete result that needs human review.',
    'The deadline is at risk because an earlier dependency is delayed.',
    'Two instructions conflict and neither identifies its priority.',
    'A quality check finds an error in an item already marked complete.',
    'A request arrives that is outside the access granted to your account.',
    'The expected output cannot be produced from the evidence supplied.',
    'A teammate reports a possible safety or privacy concern.',
    'A system outage interrupts a task that has not yet been saved.'
  ],
  [
    'A stranger asks you to share a customer record through a personal chat.',
    'A client asks you to claim that an unchecked detail is confirmed.',
    'A message contains sensitive information that is not needed for the task.',
    'A deadline is missed and the client has not received an update.',
    'A request asks you to use another worker’s login credentials.',
    'A public comment includes a threat that requires careful escalation.',
    'A task asks for personal details beyond the stated purpose.',
    'A reviewer asks you to conceal a mistake in a completed deliverable.',
    'You cannot verify a claim before the planned handoff time.',
    'A client asks for work that conflicts with the published task rules.'
  ],
  [
    'A client needs a checked deliverable, a clear status, and a safe handoff today.',
    'A batch is almost complete when a source discrepancy affects several records.',
    'A teammate is waiting on your result, but one important fact remains uncertain.',
    'A priority change affects the schedule and the quality checks already planned.',
    'The final file is ready, but its evidence and limitations are not yet documented.',
    'A user reports a problem that may affect both accuracy and personal data.',
    'A deadline, an incomplete source, and a required review all overlap.',
    'A completed item needs correction and a transparent explanation to the client.',
    'A high-priority request arrives through an unapproved channel.',
    'You must decide whether to deliver, clarify, or escalate an unresolved issue.'
  ]
];

const QUESTION_OPTIONS = [
  ['Follow the approved guidance, verify the source, and communicate uncertainty clearly.', 'Guess the missing detail and submit without checking.', 'Ignore the task requirements to finish faster.', 'Share private information through an unapproved channel.'],
  ['Check the source, record the discrepancy, and resolve it before marking the work complete.', 'Choose whichever value looks more plausible.', 'Delete the conflicting evidence and continue.', 'Copy the same unverified value into every record.'],
  ['Use the approved workflow, preserve references, and make the handoff clear.', 'Skip required review steps to save time.', 'Use an unapproved tool without telling the task owner.', 'Send an unlabeled result with no supporting context.'],
  ['Pause the affected work, document the blocker, and ask the right owner for guidance.', 'Invent a workaround and hide the change.', 'Mark the task complete despite the blocker.', 'Share account credentials to get around the issue.'],
  ['Protect the information, follow the published rules, and escalate when needed.', 'Comply with the request regardless of policy.', 'Forward sensitive details to a personal account.', 'Conceal the issue from the people responsible.'],
  ['Prioritize safely, verify what can be verified, and give a transparent status and handoff.', 'Promise a result you cannot support with evidence.', 'Skip safeguards and hide the remaining uncertainty.', 'Close the task without telling the next person about the blocker.']
];

function getQuestions(slug, level) {
  const workspace = W.find(w=>w.slug===slug);
  if(!workspace || !Number.isInteger(level) || level < 1 || level > 6) return null;
  const skills=workspace.focus.split(', ').filter(Boolean);
  const action=roleActions[slug]||'Follow the task guidance, check the result against evidence, and report uncertainty honestly.';
  // The original domain-authored bank is used only for Level 1. Higher levels
  // have separate case-based prompts and never reuse or reorder that bank.
  const bank=BANKS[slug];
  return Array.from({length:10},(_,i)=>{
    const id=`${slug}-l${level}-q${i+1}`;
    let prompt,choices,correct;
    if(level===1 && bank){ [prompt,choices,correct]=bank[i]; }
    else {
      const skill=skills[(i*3+(level-1))%skills.length];
      const caseText=CHALLENGES[level-1][i];
      const frame=[
        `For ${workspace.title}, which first step best establishes reliable ${skill} when ${caseText.toLowerCase()}`,
        `You are checking ${skill} in a ${workspace.title} task: ${caseText} What should be resolved before sign-off?`,
        `A ${workspace.title} workflow involving ${skill} reaches this point: ${caseText} Which process is the soundest choice?`,
        `While handling ${skill} as a ${workspace.title}, this blocker appears: ${caseText} What is the safest next action?`,
        `A professional ${workspace.title} worker encounters this concern about ${skill}: ${caseText} How should it be handled?`,
        `Job-ready case for ${workspace.title} — ${skill}: ${caseText} Which response best protects quality and the handoff?`
      ][level-1];
      prompt=frame;
      choices=QUESTION_OPTIONS[level-1];
      correct=0;
    }
    // Level 1 banks sometimes share generic text. Include the role in its prompt
    // so question identity remains distinct between workspaces as well.
    if(level===1) prompt=`${workspace.title}: ${prompt}`;
    if(level===1) { const context=`Apply this ${workspace.title} case: ${prompt.replace(`${workspace.title}: `,'')}`; choices=choices.map(choice=>`${choice} ${context}`); }
    else { const context=`Apply this ${workspace.title} case: ${CHALLENGES[level-1][i]} Focus: ${skills[(i*3+(level-1))%skills.length]}.`; choices=choices.map(choice=>`${choice} ${context}`); }
    if(!choices || choices.length!==4 || !Number.isInteger(correct)) throw new Error(`Invalid question data for ${id}`);
    return {id,prompt,choices,correct};
  });
}
module.exports={WORKSPACES:W,LEVELS,getQuestions};
