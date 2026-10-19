export interface Guide {
  guide_id: number;
  kb_id: number;
  title: string;
  category: 'Birth' | 'Marriage' | 'Death';
  steps_json: { step_number: number; instruction: string }[];
  requirements_json: string[];
  fees_text: string;
  tips: string;
  language: 'eng' | 'fil' | 'vis';
}

export interface Persona {
  persona_id: number;
  name: string;
  avatar: string;
  age: number;
  address: string;
  backstory: string;
  problem_type: string;
  test_query: string;
  checklist_items: string[];
}

export const GUIDES_SEED: Guide[] = [
  // RA 9048 Clerical Error Correction - Filipino (fil)
  {
    guide_id: 1,
    kb_id: 101,
    title: "Clerical Error Correction (RA 9048)",
    category: "Birth",
    steps_json: [
      { step_number: 1, instruction: "Ihanda ang Special Power of Attorney (SPA) kung ikaw ay proxy." },
      { step_number: 2, instruction: "Dalhin ang orihinal na PSA Birth Certificate at valid IDs sa LCRO." },
      { step_number: 3, instruction: "Magbayad ng filing fee na nagkakahalaga ng ₱1,000." },
      { step_number: 4, instruction: "Mag-antay ng 1-3 buwan para sa posting at PSA affirmation period." }
    ],
    requirements_json: [
      "Notarized Special Power of Attorney (Original)",
      "Representative's Valid ID",
      "Owner's Valid ID",
      "PSA Birth Certificate (Original)",
      "Filing Fee (₱1,000)"
    ],
    fees_text: "Filing fee: ₱1,000. Karagdagang local fees at PSA copy fees (~₱155-₱365).",
    tips: "Ang pag-proseso ay tumatagal ng 1 hanggang 3 buwan dahil sa mandatory 10-day posting period.",
    language: "fil"
  },
  // RA 9048 Clerical Error Correction - English (eng)
  {
    guide_id: 2,
    kb_id: 101,
    title: "Clerical Error Correction (RA 9048)",
    category: "Birth",
    steps_json: [
      { step_number: 1, instruction: "Prepare a Notarized Special Power of Attorney (SPA) if you are filing as a proxy." },
      { step_number: 2, instruction: "Bring the original PSA Birth Certificate and valid IDs to the Local Civil Registry Office (LCRO)." },
      { step_number: 3, instruction: "Pay the filing fee amounting to ₱1,000." },
      { step_number: 4, instruction: "Wait 1 to 3 months for the mandatory posting and PSA affirmation period." }
    ],
    requirements_json: [
      "Notarized Special Power of Attorney (Original)",
      "Representative's Valid ID",
      "Owner's Valid ID",
      "PSA Birth Certificate (Original)",
      "Filing Fee (₱1,000)"
    ],
    fees_text: "Filing fee: ₱1,000. Additional local fees and PSA copy fees (~₱155-₱365).",
    tips: "Processing takes 1 to 3 months due to the mandatory 10-day posting period.",
    language: "eng"
  },
  // RA 9048 Clerical Error Correction - Bisaya (vis)
  {
    guide_id: 3,
    kb_id: 101,
    title: "Clerical Error Correction (RA 9048)",
    category: "Birth",
    steps_json: [
      { step_number: 1, instruction: "I-andam ang Notarized Special Power of Attorney (SPA) kung ikaw representante lamang." },
      { step_number: 2, instruction: "Dad-a ang orihinal nga PSA Birth Certificate ug valid IDs sa LCRO." },
      { step_number: 3, instruction: "Magbayad og filing fee nga mobalor og ₱1,000." },
      { step_number: 4, instruction: "Hulat og 1 hangtod 3 ka bulan para sa posting ug PSA affirmation period." }
    ],
    requirements_json: [
      "Notarized Special Power of Attorney (Original)",
      "Representative's Valid ID",
      "Owner's Valid ID",
      "PSA Birth Certificate (Original)",
      "Filing Fee (₱1,000)"
    ],
    fees_text: "Filing fee: ₱1,000. Adunay dugang nga local fees ug PSA copy fees (~₱155-₱365).",
    tips: "Ang proseso molungtad og 1 hangtod 3 ka bulan tungod sa mandatory 10-day posting period.",
    language: "vis"
  },

  // Late Registration of Birth - Filipino (fil)
  {
    guide_id: 4,
    kb_id: 102,
    title: "Late Registration of Birth",
    category: "Birth",
    steps_json: [
      { step_number: 1, instruction: "Kumuha ng Certificate of Negative Registration mula sa PSA." },
      { step_number: 2, instruction: "Ihanda ang Joint Affidavit ng dalawang testigo." },
      { step_number: 3, instruction: "Dalhin ang mga supporting records (School Form 137, Baptismal, atbp.)." },
      { step_number: 4, instruction: "Mag-antay ng 10-araw na mandatory posting period sa LCRO bago aprubahan." }
    ],
    requirements_json: [
      "Certificate of Negative Registration (PSA)",
      "Joint Affidavit of Two Witnesses",
      "Supporting Records (School Form 137, Baptismal Certificate)",
      "Valid ID of Registrant",
      "Barangay Certification of Residency"
    ],
    fees_text: "Registration fees: ₱200-₱500. PSA copy fees: ₱155-₱365.",
    tips: "Ang mandatory 10-day posting period ay kinakailangan bago aprubahan ng LCRO.",
    language: "fil"
  },
  // Late Registration of Birth - English (eng)
  {
    guide_id: 5,
    kb_id: 102,
    title: "Late Registration of Birth",
    category: "Birth",
    steps_json: [
      { step_number: 1, instruction: "Obtain a Certificate of Negative Registration from the PSA." },
      { step_number: 2, instruction: "Prepare a Joint Affidavit of two disinterested witnesses." },
      { step_number: 3, instruction: "Bring supporting records (School Form 137, Baptismal Certificate, etc.)." },
      { step_number: 4, instruction: "Wait for the 10-day mandatory posting period at the LCRO before approval." }
    ],
    requirements_json: [
      "Certificate of Negative Registration (PSA)",
      "Joint Affidavit of Two Witnesses",
      "Supporting Records (School Form 137, Baptismal Certificate)",
      "Valid ID of Registrant",
      "Barangay Certification of Residency"
    ],
    fees_text: "Registration fees: ₱200-₱500. PSA copy fees: ₱155-₱365.",
    tips: "A mandatory 10-day posting period is required before approval by the LCRO.",
    language: "eng"
  },
  // Late Registration of Birth - Bisaya (vis)
  {
    guide_id: 6,
    kb_id: 102,
    title: "Late Registration of Birth",
    category: "Birth",
    steps_json: [
      { step_number: 1, instruction: "Kumuha og Certificate of Negative Registration gikan sa PSA." },
      { step_number: 2, instruction: "I-andam ang Joint Affidavit sa duha ka saksi." },
      { step_number: 3, instruction: "Dad-a ang mga supporting records (School Form 137, Baptismal, ug uban pa)." },
      { step_number: 4, instruction: "Hulat sa 10 ka adlaw nga mandatory posting period sa LCRO sa dili pa kini aprobahan." }
    ],
    requirements_json: [
      "Certificate of Negative Registration (PSA)",
      "Joint Affidavit of Two Witnesses",
      "Supporting Records (School Form 137, Baptismal Certificate)",
      "Valid ID of Registrant",
      "Barangay Certification of Residency"
    ],
    fees_text: "Registration fees: ₱200-₱500. PSA copy fees: ₱155-₱365.",
    tips: "Kinahanglan ang mandatory nga 10 ka adlaw nga posting period sa dili pa aprobahan sa LCRO.",
    language: "vis"
  },

  // Indigenous Peoples Registration (IPRA RA 8371) - Filipino (fil)
  {
    guide_id: 7,
    kb_id: 103,
    title: "Indigenous Peoples Registration (IPRA RA 8371)",
    category: "Birth",
    steps_json: [
      { step_number: 1, instruction: "Kumuha ng Tribal Chieftain Certificate ng pagkakakilanlan." },
      { step_number: 2, instruction: "Kumuha ng Barangay Certification of residency." },
      { step_number: 3, instruction: "I-file sa LCRO. Kuwalipikado sa libreng pagpaparehistro sa ilalim ng BRAP." }
    ],
    requirements_json: [
      "Tribal Chieftain's Certification of Identity",
      "Barangay Certification of Residency",
      "Affidavit of Two Community Elders",
      "NCIP Certificate (if available)"
    ],
    fees_text: "Libreng late registration sa ilalim ng Birth Registration Assistance Project (BRAP) para sa Indigenous Peoples.",
    tips: "Ang mga katutubo ay maaaring gumamit ng Tribal Chieftain Affidavit bilang sapat na patunay ng pagkakakilanlan.",
    language: "fil"
  },
  // Indigenous Peoples Registration (IPRA RA 8371) - English (eng)
  {
    guide_id: 8,
    kb_id: 103,
    title: "Indigenous Peoples Registration (IPRA RA 8371)",
    category: "Birth",
    steps_json: [
      { step_number: 1, instruction: "Obtain a Tribal Chieftain Certificate of identity." },
      { step_number: 2, instruction: "Obtain a Barangay Certification of residency." },
      { step_number: 3, instruction: "File with the LCRO. Eligible for free registration under BRAP." }
    ],
    requirements_json: [
      "Tribal Chieftain's Certification of Identity",
      "Barangay Certification of Residency",
      "Affidavit of Two Community Elders",
      "NCIP Certificate (if available)"
    ],
    fees_text: "Free late registration under the Birth Registration Assistance Project (BRAP) for Indigenous Peoples.",
    tips: "Indigenous peoples can use a Tribal Chieftain Affidavit as sufficient proof of identity.",
    language: "eng"
  },
  // Indigenous Peoples Registration (IPRA RA 8371) - Bisaya (vis)
  {
    guide_id: 9,
    kb_id: 103,
    title: "Indigenous Peoples Registration (IPRA RA 8371)",
    category: "Birth",
    steps_json: [
      { step_number: 1, instruction: "Kumuha og Tribal Chieftain Certificate isip kamatuoran sa pagkakakilanlan." },
      { step_number: 2, instruction: "Kumuha og Barangay Certification sa residency." },
      { step_number: 3, instruction: "I-file sa LCRO. Kwalipikado sa libre nga pagparehistro ubos sa BRAP." }
    ],
    requirements_json: [
      "Tribal Chieftain's Certification of Identity",
      "Barangay Certification of Residency",
      "Affidavit of Two Community Elders",
      "NCIP Certificate (if available)"
    ],
    fees_text: "Libre nga late registration ubos sa Birth Registration Assistance Project (BRAP) para sa mga Indigenous Peoples.",
    tips: "Ang mga lumad/katutubo mahimong mogamit sa Tribal Chieftain Affidavit isip igo nga pamatuod sa pagkakakilanlan.",
    language: "vis"
  }
];

export const PERSONAS_SEED: Persona[] = [
  {
    persona_id: 1,
    name: "Sharmaine C. Dalandan",
    avatar: "👧",
    age: 21,
    address: "Cagayan de Oro City, Misamis Oriental",
    backstory: "Education student in Cagayan de Oro City. She discovered she has a double birth registration (registered in both Manila and CDO LCROs) with a minor name discrepancy. This issue is blocking her registration for the upcoming Licensure Examination for Teachers (LET). She needs to know how to cancel one registration and correct the other.",
    problem_type: "Double Registration",
    test_query: "May dalawa akong birth certificate — magkaiba ang pangalan at lugar ng rehistro. Ano ang gagawin ko para sa LET board exam?",
    checklist_items: [
      "PSA Birth Certificate Manila Copy (Original)",
      "PSA Birth Certificate CDO Copy (Original)",
      "LET Application Form / Document Checklist",
      "School Records (Transcript / Form 137)",
      "Valid Government Issued ID"
    ]
  },
  {
    persona_id: 2,
    name: "Vanessa A. Maralangaw",
    avatar: "👩",
    age: 20,
    address: "T'boli Ancestral Domain, South Cotabato",
    backstory: "A T'boli college student in South Cotabato. Her grandparents have traditional singular names and have never had official birth certificates. Due to this, they have no school, baptismal, or other standard records. She needs a culturally sensitive and legal registration pathway for her grandparents under the Indigenous Peoples Rights Act (IPRA RA 8371).",
    problem_type: "Indigenous Peoples Registration",
    test_query: "Lolo at lola ko ay mga T'boli, isang pangalan lang ang gamit nila. Walang silang birth certificate. Paano sila magparehistro sa LCRO?",
    checklist_items: [
      "Tribal Chieftain's Certification of Identity",
      "Barangay Certification of Residency",
      "Affidavit of Two Community Elders",
      "NCIP Certification"
    ]
  },
  {
    persona_id: 3,
    name: "Melanie P. Avocardo",
    avatar: "👩‍💼",
    age: 22,
    address: "Davao City, Davao del Sur",
    backstory: "College student acting as proxy for her father. Her father's birth certificate contains a clerical spelling error in the surname (spelled 'Avocado' instead of 'Avocardo'). She has made multiple wasted trips to the Davao LCRO because she kept getting conflicting requirements. She needs a single, verified, upfront checklist under RA 9048 to resolve it in one final trip.",
    problem_type: "Clerical Error (RA 9048)",
    test_query: "Pabalik-balik ako sa LCRO para sa correction ng apelyido ng papa ko galing Avocado papuntang Avocardo. Ano ba talaga ang kailangan?",
    checklist_items: [
      "Notarized Special Power of Attorney (Original)",
      "Representative's Valid ID (Melanie's)",
      "Owner's Valid ID (Father's)",
      "PSA Birth Certificate of Father (Original)",
      "Filing Fee (₱1,000)"
    ]
  }
];
