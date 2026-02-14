const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (_) {}
const mammoth = require('mammoth');

async function extractText(filePath, fileName, textContentFromForm) {
  if (textContentFromForm && String(textContentFromForm).trim())
    return String(textContentFromForm).trim();
  if (!filePath || !fs.existsSync(filePath)) return '';

  const ext = path.extname(fileName || '').toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === '.pdf' && pdfParse) {
    const data = await pdfParse(buffer);
    return data.text || '';
  }
  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
  if (['.txt', '.html'].includes(ext))
    return buffer.toString('utf8', 0, 50000);
  return '';
}

async function evaluateWithAI(filePath, fileName, textContentFromForm) {
  const text = await extractText(filePath, fileName, textContentFromForm);

  // Optional: use OpenAI if API key is set
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && text.length > 20) {
    try {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a university assignment grader. Give brief, constructive feedback. Rate content relevance (0-100), grammar (0-100), and originality (0-100). End with one short paragraph of overall feedback and a single overall score 0-100.'
          },
          {
            role: 'user',
            content: 'Evaluate this assignment submission:\n\n' + text.slice(0, 6000)
          }
        ],
        max_tokens: 500
      });
      const content = completion.choices[0]?.message?.content || '';
      const scoreMatch = content.match(/\b(\d{1,3})\s*\/\s*100|\b(?:overall\s*)?score[:\s]*(\d{1,3})/i) || content.match(/\b(\d{1,3})\s*%/);
      const score = scoreMatch ? parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3], 10) : null;
      return { feedback: content, score: score >= 0 && score <= 100 ? score : 75 };
    } catch (_err) {
    }
  }

  // Fallback: rule-based feedback (no API key or error)
  let score = 70;
  const tips = [];
  const wordCount = (text.match(/\S+/g) || []).length;
  if (wordCount < 50) {
    score = Math.max(40, score - 20);
    tips.push('Add more content; the submission is quite short.');
  } else if (wordCount > 200) tips.push('Good length and development.');
  if (text.includes('http') || text.includes('www.')) tips.push('Consider citing sources to support originality.');
  const sentences = (text.match(/[.!?]+/g) || []).length;
  if (sentences < 3 && wordCount > 30) tips.push('Break long paragraphs into clearer sentences.');
  const feedback = [
    '**Evaluation (automated):**',
    '- Content length: ' + wordCount + ' words.',
    tips.length ? '- Suggestions: ' + tips.join(' ') : '- Structure looks reasonable.',
    '- Overall: ' + (score >= 70 ? 'Acceptable. ' : 'Needs improvement. ') + 'Review the suggestions above.',
    '**Score: ' + score + '/100**'
  ].join('\n');
  return { feedback, score };
}

module.exports = { evaluateWithAI, extractText };
