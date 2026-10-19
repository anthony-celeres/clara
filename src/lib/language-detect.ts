import { franc } from 'franc-min';

export function detectLanguage(text: string): 'eng' | 'fil' | 'vis' {
  if (!text) return 'fil';
  const cleanText = text.toLowerCase().trim();

  // Simple keyword heuristic rules to improve accuracy for short phrases
  const visKeywords = [
    'dad-a', 'andam', 'mobalor', 'hulat', 'dugang', 'tungod', 'lumad', 'pamatuod', 
    'unsa', 'karon', 'niana', 'kasa', 'lilo', 'lila', 'magparehistro', 'apelyido', 'apilyido',
    'gikan', 'ubos', 'igo', 'pamatuod', 'duha', 'saksi', 'kumuha og', 'dad-a ang', 'dunay'
  ];

  const filKeywords = [
    'paano', 'ano', 'kailan', 'bakit', 'salamat', 'dalawa', 'magkaiba', 'lolo', 'lola', 
    'mag-antay', 'ihanda', 'dalhin', 'magbayad', 'karagdagang', 'katutubo', 'sapat',
    'apelyido', 'papa', 'ko', 'magparehistro', 'ihanda ang', 'dalhin ang'
  ];

  const engKeywords = [
    'how', 'what', 'when', 'why', 'who', 'please', 'thanks', 'thank you', 'correct', 'error',
    'clerical', 'registration', 'negative', 'witness', 'witnesses', 'birth', 'certificate', 'fees',
    'requirements', 'original', 'valid', 'proxy', 'filing', 'indigenous', 'peoples', ' chieftain'
  ];

  // 1. First run exact keyword matches
  for (const keyword of visKeywords) {
    if (cleanText.includes(keyword)) {
      return 'vis';
    }
  }

  for (const keyword of filKeywords) {
    if (cleanText.includes(keyword)) {
      return 'fil';
    }
  }

  for (const keyword of engKeywords) {
    if (cleanText.includes(keyword)) {
      return 'eng';
    }
  }

  // 2. Fall back to franc-min classifier
  try {
    const langCode = franc(text, { minLength: 3 });
    if (langCode === 'tgl') return 'fil';
    if (langCode === 'ceb') return 'vis';
    if (langCode === 'eng') return 'eng';
  } catch (e) {
    console.error("Language detection error:", e);
  }

  // 3. Fallback to default (Filipino)
  return 'fil';
}
