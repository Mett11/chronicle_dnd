export async function onRequestPost(context: any) {
  try {
    const req = context.request;
    const body = await req.json();
    const {
      prompt,
      model = 'black-forest-labs/FLUX.1-dev',
      aspectRatio = 'square',
      seed,
      huggingfaceKey,
      geminiApiKey,
      engine,
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Prompt mancante o non valido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const hfToken = (
      huggingfaceKey ||
      req.headers.get('x-huggingface-key') ||
      context.env?.HUGGINGFACE_TOKEN ||
      context.env?.HF_TOKEN ||
      ''
    ).trim();

    const hfModel = (model && typeof model === 'string' && model.trim()) ? model.trim() : 'black-forest-labs/FLUX.1-schnell';

    if (!hfToken) {
      return new Response(
        JSON.stringify({
          error:
            'Token Hugging Face non configurato. Inserisci il tuo Access Token (hf_...) nelle Impostazioni o nelle Chiavi API (ottenibile gratis su huggingface.co/settings/tokens).',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const { InferenceClient } = await import('@huggingface/inference');
      const client = new InferenceClient(hfToken);

      const imageBlob: any = await client.textToImage({
        model: hfModel,
        inputs: prompt.trim(),
      });

      const arrayBuffer = await imageBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);
      const mime = imageBlob.type || 'image/jpeg';
      const dataUrl = `data:${mime};base64,${b64}`;

      return new Response(
        JSON.stringify({
          dataUrl,
          mimeType: mime,
          modelUsed: `Hugging Face (${hfModel.split('/').pop()})`,
          engine: 'huggingface',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (hfErr: any) {
      const errMsg = hfErr.message || String(hfErr);
      const status = hfErr.httpResponse?.status || hfErr.status;

      if (status === 401 || errMsg.includes('Invalid username or password') || errMsg.includes('Unauthorized')) {
        return new Response(
          JSON.stringify({
            error: 'Token Hugging Face non valido o non autorizzato (401). Verifica che il tuo token su huggingface.co sia corretto e abbia il permesso "Inference" o "Read".',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (errMsg.includes('No Inference Provider available') || errMsg.includes('not supported for task') || errMsg.includes('have not been able to find inference provider')) {
        return new Response(
          JSON.stringify({
            error: `Il modello "${hfModel}" non dispone di un serverless provider attivo su Hugging Face. Scegli uno dei modelli verificati (es. black-forest-labs/FLUX.1-schnell o stabilityai/stable-diffusion-xl-base-1.0).`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (status === 402 || errMsg.includes('Payment Required') || errMsg.includes('credit')) {
        return new Response(
          JSON.stringify({
            error: `Crediti insufficienti per eseguire l'inferenza di questo modello sul provider Hugging Face (${errMsg}).`,
          }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (status === 404 || errMsg.includes('404')) {
        return new Response(
          JSON.stringify({
            error: `Modello Hugging Face non trovato (404): "${hfModel}". Controlla che l'ID su huggingface.co sia digitato correttamente.`,
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (status === 429 || errMsg.includes('rate limit')) {
        return new Response(
          JSON.stringify({
            error: 'Limite di richieste superato su Hugging Face (429). Attendi qualche secondo e riprova.',
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Errore Hugging Face: ${errMsg}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Errore interno generazione immagine' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
