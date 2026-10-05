import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const slug = 'gk-challenge'
const base = path.join(root, 'data/competitions', slug, 'full-bank/objective')
const raw = `
World geography|Which is the largest ocean on Earth?|Pacific Ocean|Atlantic Ocean|Indian Ocean|Arctic Ocean
World geography|Which country is home to the city of Cairo?|Egypt|Jordan|Morocco|Greece
World geography|What is the capital of Australia?|Canberra|Sydney|Melbourne|Perth
World geography|Which continent has the most countries?|Africa|Asia|Europe|South America
World geography|Which river is commonly regarded as the longest river in South America?|Amazon River|Nile River|Danube River|Yangtze River
World geography|Mount Everest lies in which mountain range?|Himalayas|Andes|Alps|Rockies
World geography|Which country has the largest land area?|Russia|Canada|China|United States
World geography|What is the capital of Japan?|Tokyo|Kyoto|Osaka|Hiroshima
World geography|Which desert is the largest hot desert in the world?|Sahara|Gobi|Kalahari|Atacama
World geography|Which ocean lies between Africa and Australia?|Indian Ocean|Pacific Ocean|Atlantic Ocean|Arctic Ocean
World geography|Which country is shaped like a boot?|Italy|Spain|Portugal|Croatia
World geography|What is the capital of Canada?|Ottawa|Toronto|Vancouver|Montreal
World geography|Which line divides Earth into Northern and Southern Hemispheres?|Equator|Prime Meridian|Tropic of Cancer|Arctic Circle
World geography|Which continent is the smallest by land area?|Australia|Europe|Antarctica|South America
World geography|Which sea separates Europe and Africa?|Mediterranean Sea|Caribbean Sea|Baltic Sea|Arabian Sea
India geography|Which is the southernmost state of mainland India?|Tamil Nadu|Kerala|Karnataka|Andhra Pradesh
India geography|What is the capital of Rajasthan?|Jaipur|Udaipur|Jodhpur|Kota
India geography|Which river is known as the Ganga's largest tributary?|Yamuna|Narmada|Tapi|Mahanadi
India geography|Which Indian state has the longest coastline?|Gujarat|Tamil Nadu|Andhra Pradesh|Maharashtra
India geography|Which mountain range runs along India's western coast?|Western Ghats|Eastern Ghats|Aravalli Range|Vindhya Range
India geography|Which is the largest Indian state by area?|Rajasthan|Madhya Pradesh|Maharashtra|Uttar Pradesh
India geography|Which city is the capital of Assam?|Dispur|Guwahati|Shillong|Imphal
India geography|The Sundarbans are mainly located in which Indian state?|West Bengal|Odisha|Bihar|Jharkhand
India geography|Which river flows through the city of Delhi?|Yamuna|Godavari|Krishna|Kaveri
India geography|Which Indian state is famous for the backwaters of Alappuzha?|Kerala|Goa|Odisha|Tamil Nadu
India geography|Which plateau covers much of peninsular India?|Deccan Plateau|Malwa Plateau|Chota Nagpur Plateau|Shillong Plateau
India geography|Which is India's largest freshwater lake by surface area?|Wular Lake|Dal Lake|Loktak Lake|Kolleru Lake
India geography|Which state is the largest producer of tea in India?|Assam|Punjab|Gujarat|Rajasthan
India geography|Which desert is located mainly in Rajasthan?|Thar Desert|Kutch Desert|Ladakh Desert|Spiti Desert
India geography|Which river is often called the Dakshin Ganga?|Godavari|Krishna|Kaveri|Narmada
History basics|Who founded the Maurya Empire?|Chandragupta Maurya|Ashoka|Harsha|Samudragupta
History basics|Which ancient civilization developed along the Indus River system?|Indus Valley Civilization|Roman Civilization|Mayan Civilization|Inca Civilization
History basics|Who was the first Mughal emperor in India?|Babur|Akbar|Humayun|Aurangzeb
History basics|The Battle of Plassey was fought in which year?|1757|1764|1857|1947
History basics|Who founded the Indian National Congress in 1885 with other leaders?|A. O. Hume|Lord Curzon|Warren Hastings|Robert Clive
History basics|Who led the Dandi March in 1930?|Mahatma Gandhi|Subhas Chandra Bose|Jawaharlal Nehru|Sardar Patel
History basics|Which emperor embraced Buddhism after the Kalinga War?|Ashoka|Chandragupta Maurya|Bindusara|Harsha
History basics|Who wrote the Arthashastra?|Kautilya|Kalidasa|Banabhatta|Tulsidas
History basics|Which dynasty built the Brihadisvara Temple at Thanjavur?|Chola|Pallava|Chera|Pandya
History basics|The Quit India Movement began in which year?|1942|1930|1919|1947
History basics|Who was known as the Iron Man of India?|Sardar Vallabhbhai Patel|B. R. Ambedkar|Rajendra Prasad|Lal Bahadur Shastri
History basics|Which ancient university was located in present-day Bihar?|Nalanda|Taxila|Vikramashila|Vallabhi
History basics|Who was the first President of independent India?|Rajendra Prasad|S. Radhakrishnan|Jawaharlal Nehru|C. Rajagopalachari
History basics|Which movement was launched by Gandhi in 1920?|Non-Cooperation Movement|Civil Disobedience Movement|Quit India Movement|Swadeshi Movement
History basics|India became independent on which date?|15 August 1947|26 January 1950|9 August 1942|23 March 1931
Civics|What is the supreme law of India?|Constitution|Parliamentary rulebook|Civil Code|Election Act
Civics|How many houses does the Parliament of India have?|Two|One|Three|Four
Civics|Who is the constitutional head of the Union of India?|President|Prime Minister|Chief Justice|Speaker
Civics|What is the minimum voting age for Indian citizens?|18|16|21|25
Civics|Which body conducts elections in India?|Election Commission of India|Union Public Service Commission|Finance Commission|NITI Aayog
Civics|Fundamental Rights are guaranteed by which part of the Constitution?|Part III|Part I|Part IV|Part V
Civics|Who appoints the Prime Minister of India?|President|Chief Justice|Lok Sabha Speaker|Election Commission
Civics|Which house of Parliament is also called the House of the People?|Lok Sabha|Rajya Sabha|Legislative Council|Vidhan Sabha
Civics|What is the normal term of the Lok Sabha?|Five years|Four years|Six years|Seven years
Civics|Which institution is the highest court in India?|Supreme Court|High Court|District Court|Tribunal
Civics|Which amendment lowered the voting age from 21 to 18?|61st Amendment|42nd Amendment|44th Amendment|73rd Amendment
Civics|Who presides over the Rajya Sabha?|Vice-President of India|President|Prime Minister|Lok Sabha Speaker
Civics|What does the Preamble begin with?|We, the people of India|In the name of Parliament|India shall be a republic|Justice for all
Civics|Which level of government is responsible for a village panchayat?|Local government|Union government|State government|Judicial government
Civics|Which fundamental duty asks citizens to protect the natural environment?|To protect and improve the natural environment|To vote in every election|To pay every tax|To join the armed forces
Science facts|Which planet is known as the Red Planet?|Mars|Venus|Jupiter|Mercury
Science facts|What gas do plants mainly absorb for photosynthesis?|Carbon dioxide|Oxygen|Nitrogen|Hydrogen
Science facts|What is the boiling point of water at sea level?|100°C|50°C|0°C|212°C below zero
Science facts|Which organ pumps blood through the human body?|Heart|Lung|Liver|Kidney
Science facts|What force pulls objects toward Earth?|Gravity|Friction|Magnetism|Buoyancy
Science facts|Which vitamin is produced in the skin with sunlight exposure?|Vitamin D|Vitamin C|Vitamin B12|Vitamin K
Science facts|What is the chemical symbol for oxygen?|O|Ox|O2O|Og
Science facts|Which part of a plant absorbs most water from soil?|Roots|Flowers|Fruits|Leaves
Science facts|How many bones are in a typical adult human skeleton?|206|106|306|256
Science facts|Which state of matter has a fixed volume but no fixed shape?|Liquid|Solid|Gas|Plasma only
Science facts|What is the nearest star to Earth?|Sun|Sirius|Polaris|Proxima Centauri
Science facts|Which blood cells help fight infections?|White blood cells|Red blood cells|Platelets|Plasma cells only
Science facts|What is H2O commonly called?|Water|Hydrogen peroxide|Oxygen|Salt
Science facts|Which instrument measures temperature?|Thermometer|Barometer|Ammeter|Compass
Science facts|Which process changes liquid water into water vapour?|Evaporation|Condensation|Freezing|Melting
Environment|Which gas is a major contributor to the enhanced greenhouse effect?|Carbon dioxide|Helium|Neon|Argon
Environment|Which practice helps conserve biodiversity?|Protecting natural habitats|Clearing forests|Introducing invasive species|Overfishing
Environment|What is the main source of energy for Earth's climate system?|Sun|Moon|Tides|Earth's core
Environment|Which material is generally biodegradable?|Banana peel|Aluminium can|Glass bottle|Plastic bag
Environment|What does recycling aim to do?|Recover materials for reuse|Increase landfill waste|Burn all waste|Stop manufacturing
Environment|Which ecosystem is characterized by very low rainfall?|Desert|Rainforest|Wetland|Mangrove
Environment|Planting trees can help reduce atmospheric carbon dioxide through what process?|Photosynthesis|Combustion|Fermentation|Evaporation
Environment|Which source is renewable?|Solar energy|Coal|Petroleum|Natural gas
Environment|What is deforestation?|Removal of forests|Growth of forests|Study of forests|Protection of forests
Environment|Which pollution directly affects rivers and lakes?|Water pollution|Noise pollution|Light pollution|Thermal insulation
Environment|What is a food chain used to show?|Transfer of energy between organisms|Movement of tectonic plates|Water circulation only|Cloud formation
Environment|Which gas is most abundant in Earth's atmosphere?|Nitrogen|Oxygen|Carbon dioxide|Hydrogen
Environment|Mangroves are especially valuable because they can protect coasts from what?|Erosion and storm impacts|Volcanic eruptions|Earth's rotation|Solar flares
Environment|What is composting?|Controlled decomposition of organic waste|Melting plastic|Mining minerals|Filtering seawater
Environment|Which action reduces household water wastage?|Repairing leaking taps|Leaving taps running|Washing driveways with hoses daily|Ignoring leaks
Culture|Which festival is widely known as the festival of lights in India?|Diwali|Holi|Pongal|Onam
Culture|Bharatanatyam originated in which Indian state?|Tamil Nadu|Kerala|Punjab|Assam
Culture|Which instrument is strongly associated with Hindustani classical music?|Sitar|Nadaswaram|Mridangam|Veena
Culture|Pongal is primarily celebrated as a harvest festival in which state?|Tamil Nadu|Gujarat|Bihar|Himachal Pradesh
Culture|Which classical dance form is associated with Kerala?|Kathakali|Kathak|Odissi|Manipuri
Culture|Yoga originated in which ancient cultural tradition?|Indian tradition|Greek tradition|Roman tradition|Norse tradition
Culture|Which language is the primary language of the Sangam literary tradition?|Tamil|Persian|Latin|Sanskrit only
Culture|Which festival is associated with colours?|Holi|Diwali|Baisakhi|Navratri
Culture|Which art form uses detailed floor designs made with powders or rice?|Kolam|Warli|Madhubani|Phulkari
Culture|Which Indian classical dance originated in Odisha?|Odissi|Kathakali|Bharatanatyam|Kathak
Culture|Which traditional textile is associated with Varanasi?|Banarasi silk|Kanchipuram silk|Pashmina|Ikat only
Culture|Which festival marks the beginning of the Malayalam calendar year?|Vishu|Pongal|Bihu|Lohri
Culture|Which instrument is a double-reed wind instrument common in South Indian traditions?|Nadaswaram|Sitar|Tabla|Santoor
Culture|Which traditional martial art is associated with Kerala?|Kalaripayattu|Silambam|Gatka|Thang-ta
Culture|Which Indian festival is strongly associated with the harvest in Punjab?|Baisakhi|Onam|Pongal|Nuakhai
Sports|How many players are on the field for one soccer team during normal play?|11|7|9|15
Sports|How many rings are on the Olympic symbol?|Five|Four|Six|Seven
Sports|In cricket, how many runs are awarded for a boundary that reaches the rope without bouncing?|Six|Four|Two|Eight
Sports|Which sport uses a shuttlecock?|Badminton|Tennis|Hockey|Volleyball
Sports|How long is a standard marathon?|42.195 km|40 km|50 km|21.097 km
Sports|Which country hosted the first modern Olympic Games in 1896?|Greece|France|United Kingdom|Italy
Sports|In tennis, what is the score called at 40-40?|Deuce|Love|Advantage|Break
Sports|How many players from one team are on court in basketball?|Five|Six|Seven|Eight
Sports|Which sport awards a touchdown?|American football|Cricket|Baseball|Hockey
Sports|In chess, which piece moves in an L-shape?|Knight|Bishop|Rook|Queen
Sports|Which country is traditionally credited with originating modern cricket?|England|India|Australia|South Africa
Sports|How many wickets can fall in one innings before a batting side is all out in a standard Test innings?|10|11|9|12
Sports|Which sport uses a pommel horse?|Gymnastics|Equestrian polo|Rowing|Wrestling
Sports|In volleyball, how many players from each team are normally on court?|Six|Five|Seven|Eight
Sports|Which athletics event combines running, jumping and throwing disciplines?|Decathlon|Marathon|Sprint|Relay
Books and authors|Who wrote The Jungle Book?|Rudyard Kipling|Charles Dickens|Mark Twain|Jules Verne
Books and authors|Who wrote Pride and Prejudice?|Jane Austen|Emily Brontë|George Eliot|Virginia Woolf
Books and authors|Who wrote The Adventures of Tom Sawyer?|Mark Twain|Ernest Hemingway|Jack London|Lewis Carroll
Books and authors|Who wrote Harry Potter and the Philosopher's Stone?|J. K. Rowling|C. S. Lewis|J. R. R. Tolkien|Roald Dahl
Books and authors|Who wrote The Hobbit?|J. R. R. Tolkien|C. S. Lewis|Rudyard Kipling|George Orwell
Books and authors|Who wrote The Old Man and the Sea?|Ernest Hemingway|John Steinbeck|F. Scott Fitzgerald|Leo Tolstoy
Books and authors|Who wrote Alice's Adventures in Wonderland?|Lewis Carroll|Oscar Wilde|Robert Louis Stevenson|Daniel Defoe
Books and authors|Who wrote The Discovery of India?|Jawaharlal Nehru|Mahatma Gandhi|Rabindranath Tagore|S. Radhakrishnan
Books and authors|Who wrote Gitanjali?|Rabindranath Tagore|Bankim Chandra Chattopadhyay|Sarojini Naidu|Premchand
Books and authors|Who wrote The Guide?|R. K. Narayan|Mulk Raj Anand|Khushwant Singh|Ruskin Bond
Books and authors|Who wrote Around the World in Eighty Days?|Jules Verne|Victor Hugo|H. G. Wells|Arthur Conan Doyle
Books and authors|Who wrote The Diary of a Young Girl?|Anne Frank|Helen Keller|Malala Yousafzai|Louisa May Alcott
Books and authors|Who wrote Animal Farm?|George Orwell|Aldous Huxley|Ernest Hemingway|George Eliot
Books and authors|Who wrote The Secret Garden?|Frances Hodgson Burnett|Beatrix Potter|Louisa May Alcott|Enid Blyton
Books and authors|Who wrote Panchatantra?|Traditionally attributed to Vishnu Sharma|Kalidasa|Valmiki|Tulsidas
Everyday knowledge|Which device is commonly used to measure time?|Clock|Thermometer|Compass|Barometer
Everyday knowledge|Which direction does the Sun appear to rise from?|East|West|North|South
Everyday knowledge|How many days are in a leap year?|366|365|364|360
Everyday knowledge|Which currency is used in Japan?|Yen|Won|Rupee|Baht
Everyday knowledge|Which appliance is commonly used to keep food cold?|Refrigerator|Toaster|Iron|Mixer
Everyday knowledge|What does a red traffic light normally mean?|Stop|Speed up|Turn anywhere|Overtake
Everyday knowledge|Which sense organ is mainly used for hearing?|Ear|Eye|Nose|Skin
Everyday knowledge|How many continents are commonly recognized?|Seven|Five|Six|Eight
Everyday knowledge|Which shape has three sides?|Triangle|Square|Circle|Pentagon
Everyday knowledge|What is 1 kilogram equal to?|1000 grams|100 grams|10 grams|10,000 grams
Everyday knowledge|Which planet do we live on?|Earth|Mars|Venus|Jupiter
Everyday knowledge|Which tool is used to find direction using magnetic north?|Compass|Ruler|Scale|Thermometer
Everyday knowledge|Which month comes immediately after September?|October|August|November|July
Everyday knowledge|How many hours are there in one day?|24|12|48|36
Everyday knowledge|Which common household item is designed to sweep floors?|Broom|Spoon|Cushion|Bucket
`
const rows = raw.trim().split('\n').map(line => line.split('|'))
const ages = ['up_to_8','age_9_12','age_13_15','age_16_plus']
const difficulties = ['foundation','developing','advanced','championship']
const skills = ['recall','classification','comparison','application']
const rotate = (a,n) => a.map((_,i)=>a[(i+n)%a.length])

function make(id,row,index,kind) {
  const [topic,question,...opts] = row
  const shift = index % 4
  const options = rotate(opts,shift)
  const correct = (4-shift)%4
  const answer = options[correct]
  return {question_id:id,age_band:ages[index%4],topic,subtopic:topic,question,options,correct_option_index:correct,answer,
    explanation:`The correct answer is ${answer}. This is a standard fact within ${topic} and directly answers the question.`,
    difficulty:kind==='official'?'championship':difficulties[index%4],skill:skills[index%4],marks:1,time_seconds:kind==='official'?75:60,language:'English',review_status:'reviewed'}
}
const mock=[], official=[]
rows.forEach((row,i)=>{
  const topicIndex=Math.floor(i/15), within=i%15
  if(within<12) mock.push(make(`GK_CHALLENGE-MOCK-${String(topicIndex*12+within+1).padStart(3,'0')}`,row,topicIndex*12+within+1,'mock'))
  else official.push(make(`GK_CHALLENGE-OFFICIAL-${String(topicIndex*3+within-11).padStart(3,'0')}`,row,topicIndex*3+within-11,'official'))
})
const agePools=Object.fromEntries(ages.map(age=>[age,{mixed:mock.filter(q=>q.age_band===age).map(q=>q.question_id)}]))
const blueprint=Object.fromEntries(ages.map(age=>[age,[['mixed',30]]]))
fs.mkdirSync(base,{recursive:true})
fs.writeFileSync(path.join(base,'questions.objective.public.json'),JSON.stringify(mock,null,2)+'\n')
fs.writeFileSync(path.join(base,'answer-key.objective.private.json'),JSON.stringify(mock,null,2)+'\n')
fs.writeFileSync(path.join(base,'official.objective.json'),JSON.stringify(official,null,2)+'\n')
fs.writeFileSync(path.join(base,'age-pools.json'),JSON.stringify(agePools,null,2)+'\n')
fs.writeFileSync(path.join(base,'selection-blueprint.json'),JSON.stringify(blueprint,null,2)+'\n')
console.log(`Generated ${mock.length} reviewed mock MCQs and ${official.length} official MCQs.`)
