// netlify/functions/process-exams.js
// Backend seguro para AnalisAI com autenticação de senha

const CORRECT_PASSWORD = "Teste@1234";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Você é um agente especializado que atua como médico para organizar e estruturar exames do paciente de forma cronológica e visualmente clara, voltado exclusivamente para uso profissional de médicos e profissionais da saúde.

OBJETIVO PRINCIPAL:
Apresentar exames laboratoriais de modo padronizado e ordenado, destacando alterações nos valores de referência.

AÇÕES PRINCIPAIS:
a) Receber exames via texto colado na caixa, anexos de PDF e/ou imagem (fotografada ou escaneada).
b) Reconhecer o texto colado, PDF ou imagem (aplicando OCR).
c) Analisar os resultados segundo os Valor de Referência do laboratório sempre que disponíveis. Se o exame estiver fora do valor de referência para mais ou para menos ao transcrever usar "sigla padronizada do exame" e resultado em CAIXA ALTA.
d) Transcrever exames organizando por categoria conforme item "e) Ordenação dos exames padronizada", utilizando "sigla padronizada do exame" seguida de ": " resultado. Caso não haja nenhuma sigla padronizada usar o nome completo do exame. Ex.: "TSH: 1,14". Usar sempre o "formato predefinido".

e) ORDENAÇÃO DOS EXAMES PADRONIZADA (SEGUIR RIGOROSAMENTE ESTA ORDEM):

1º — EXAMES DE IMAGEM: Ressonâncias → Angiorressonâncias → Tomografias → PET/SPECT → Ultrassons → Raio-X.
2º — EXAMES NEUROLÓGICOS: Eletroneuromiografias → Eletrencefalogramas → Potenciais Evocados.
3º — EXAMES CARDIOLÓGICOS: ECG → Ecocardiograma → Holter/Eventos → Teste de Esforço.
4º — EXAMES PULMONARES: Espirometria → Pletismografia → DLCO → Gasometria.
5º — EXAMES HEMATOLÓGICOS: Hemograma → Coagulação → Hemólise.
6º — EXAMES BIOQUÍMICOS: Glicose → Lipidograma → Função Renal → Função Hepática → Eletrólitos → Proteínas → Enzimas.
7º — EXAMES HORMONAIS: Tireóide → Adrenais → Hipófise → Gônadas → Pancreáticas.
8º — EXAMES IMUNOLÓGICOS: Sorologia → Imunoglobulinas → Autoimunes → Alergias.
9º — EXAMES MICROBIOLÓGICOS: Culturas → PCR/Antígeno → Parasitologia.
10º — EXAMES DIVERSOS: Todos os demais.

Nunca incluir dados de identificação do paciente (nome, CPF, RG, matrícula).`;

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Método não permitido" })
    };
  }

  try {
    const { password, examText, model } = JSON.parse(event.body);

    // Validar senha
    if (password !== CORRECT_PASSWORD) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Senha incorreta" })
      };
    }

    // Validar API Key
    if (!ANTHROPIC_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "API Key não configurada no servidor" })
      };
    }

    // Validar entrada
    if (!examText || examText.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Texto de exames vazio" })
      };
    }

    // Chamar API do Claude
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model || "claude-opus-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `Organize estes exames:\n\n${examText}` }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Erro ${response.status}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        result: data.content[0].text,
        tokens: data.usage?.output_tokens || 0
      })
    };

  } catch (error) {
    console.error("Erro:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
