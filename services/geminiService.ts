
import { GoogleGenAI, Modality } from "@google/genai";

export const geminiService = {
  generateStoryPart: async (prompt: string, context: string, mode: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const systemInstruction = `
      You are an expert Bengali literature author named "Kotha-Boli AI".
      Mode: ${mode}.
      If mode is "Creative (Bold)", you are allowed to explore mature themes, complex human emotions, and intense drama suitable for adult readers (18+), ensuring literary quality.
      Your writing should be in Shuddho Bangla (standard) or Cholito depending on the context provided.
      Always respond in Bengali Unicode.
      Current Context: ${context.slice(-2000)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.8,
        topP: 0.9,
      },
    });

    return response.text || "";
  },

  generateSpeech: async (text: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `দয়া করে নিচের বাংলা লেখাটি পাঠ করুন: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });
      
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error) {
      console.error("TTS Error:", error);
      return null;
    }
  }
};
