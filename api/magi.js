const PERSONAS = {
  melchior: {
    name: 'MELCHIOR-1',
    instructions: `あなたは《MAGI》のMELCHIOR-1。データ解析担当です。キャッチコピーは「数字は嘘をつかない」。質問に対し、数字・記録・確認できる事実を最優先してください。与えられていない成績や事実を創作してはいけません。情報不足なら、それ自体を明示して判断を弱めてください。感情論より再現性・客観性・検証可能性を重視します。日本語で簡潔に答えてください。`
  },
  balthasar: {
    name: 'BALTHASAR-2',
    instructions: `あなたは《MAGI》のBALTHASAR-2。戦術演算担当です。質問に対し、勝利への道筋、起用、打順、継投、相手との相性、代替案、リスクを考えてください。最適解を一つに決めつけず、条件によって判断が変わる場合は明示してください。与えられていない事実を創作してはいけません。日本語で簡潔に答えてください。`
  },
  casper: {
    name: 'CASPER-3',
    instructions: `あなたは《MAGI》のCASPER-3。選手評価担当です。質問に対し、本人の成長、人間性、役割負担、周囲への影響、チームの自発性、信頼関係、将来性を重視してください。勝敗だけで人を評価せず、固定的な性格決めつけを避けてください。与えられていない事実を創作してはいけません。日本語で簡潔に答えてください。`
  }
};

const VOTE_LABELS = {
  yes: '🟢 ◎ 賛成',
  cond: '🔵 ○ 条件付き賛成',
  hold: '🟡 △ 判断保留',
  no: '🔴 ✕ 反対'
};

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  for (const item of data.output || []) {
    for (const c of item.content || []) {
      if (c.type === 'output_text' && typeof c.text === 'string') return c.text;
    }
  }
  throw new Error('AI response did not contain output text.');
}

async function askPersona(persona, question) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5.6-luna',
      reasoning: { effort: 'low' },
      instructions: persona.instructions + `\n判定は必ず yes / cond / hold / no の4種類から1つ選びます。analysisは140〜260文字程度。反対意見や懸念点を最低1つ含めてください。`,
      input: question,
      max_output_tokens: 650,
      store: false,
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'magi_persona_decision',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              vote: { type: 'string', enum: ['yes', 'cond', 'hold', 'no'] },
              analysis: { type: 'string' }
            },
            required: ['vote', 'analysis']
          }
        }
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const msg = data?.error?.message || `OpenAI API error (${response.status})`;
    throw new Error(msg);
  }

  const parsed = JSON.parse(extractOutputText(data));
  if (!VOTE_LABELS[parsed.vote]) throw new Error('Invalid vote returned by AI.');
  return { name: persona.name, vote: parsed.vote, label: VOTE_LABELS[parsed.vote], analysis: parsed.analysis };
}

function finalDecision(results) {
  const counts = { yes: 0, cond: 0, hold: 0, no: 0 };
  results.forEach(r => counts[r.vote]++);

  let vote = 'hold';
  if (counts.no >= 2) vote = 'no';
  else if (counts.yes >= 2) vote = 'yes';
  else if (counts.hold >= 2) vote = 'hold';
  else if (counts.yes + counts.cond >= 2) vote = 'cond';
  else if (counts.no + counts.hold >= 2) vote = 'hold';

  const reason = vote === 'yes'
    ? '三賢人の多数が積極的に支持。実行後も結果を検証する。'
    : vote === 'cond'
      ? '方向性は支持。ただし条件設定と検証を前提に運用する。'
      : vote === 'no'
        ? '懸念が優位。現状案は採用せず、代替案を再審議する。'
        : '意見が割れている、または材料不足。追加情報を得て再審議する。';

  return { vote, label: VOTE_LABELS[vote], reason };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on Vercel.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const question = String(body.question || '').trim();
    if (question.length < 2) return res.status(400).json({ error: '質問を入力してください。' });
    if (question.length > 4000) return res.status(400).json({ error: '質問が長すぎます。4000文字以内にしてください。' });

    const [melchior, balthasar, casper] = await Promise.all([
      askPersona(PERSONAS.melchior, question),
      askPersona(PERSONAS.balthasar, question),
      askPersona(PERSONAS.casper, question)
    ]);

    const results = [melchior, balthasar, casper];
    return res.status(200).json({
      engine: 'OpenAI Responses API / gpt-5.6-luna',
      question,
      results,
      final: finalDecision(results)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'MAGI AI processing failed.' });
  }
};