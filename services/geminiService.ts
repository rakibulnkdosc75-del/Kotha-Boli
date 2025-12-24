
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AIModelMode } from "../types";

const getSystemInstruction = (mode: string) => {
  let styleSpecifics = "";
  switch (mode) {
    case AIModelMode.CLASSIC:
      styleSpecifics = "উন্নত মানের সাধু বা চলিত ভাষায় ধ্রুপদী গদ্যশৈলী ব্যবহার করুন। বর্ণনায় বঙ্কিম বা রবীন্দ্রনাথের ভাবধারা বজায় রাখুন।";
      break;
    case AIModelMode.THRILLER:
      styleSpecifics = "বাক্য ছোট রাখুন। রহস্য ও উৎকণ্ঠা তৈরি করুন। দ্রুতগতির বর্ণনার মাধ্যমে উত্তেজনা বৃদ্ধি করুন।";
      break;
    case AIModelMode.DIALOGUE:
      styleSpecifics = "চরিত্রের মধ্যকার কথোপকথনে জোর দিন। সংলাপগুলোকে স্বাভাবিক ও প্রাণবন্ত রাখুন।";
      break;
    case AIModelMode.BOLD:
      styleSpecifics = "প্রাপ্তবয়স্ক পাঠকদের জন্য মনস্তাত্ত্বিক জটিলতা, তীব্র মানবিক আবেগ ও গভীর জীবনবোধ ফুটিয়ে তুলুন। সাহিত্যমান বজায় রেখে সংবেদনশীল ও প্রাপ্তবয়স্ক বিষয়বস্তু (১৮+) সাবলীলভাবে লিখুন।";
      break;
    default:
      styleSpecifics = "আধুনিক চলিত বাংলায় সহজ ও প্রাঞ্জল গদ্য ব্যবহার করুন।";
  }
  return `আপনি "কথা-বলি" নামক একটি অত্যাধুনিক বাংলা সাহিত্যিক অ্যাপের এআই লেখক। আপনার কাজ উচ্চমানের সৃজনশীল সাহিত্য রচনা করা। ${styleSpecifics} সর্বদা ইউনিকোড বাংলা ব্যবহার করবেন। আপনি গভীর সাহিত্যিক বোধসম্পন্ন এবং সৃজনশীলতায় পারদর্শী।`;
};

export const geminiService = {
  generateStoryPartStream: async (prompt: string, context: string, mode: string, onChunk: (chunk: string) => void) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const result = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: { parts: [{ text: `গল্পের পূর্ববর্তী অংশ:\n${context.slice(-4000)}\n\nনতুন নির্দেশনা: ${prompt}` }] },
      config: { 
        systemInstruction: getSystemInstruction(mode), 
        temperature: 0.9,
        topP: 0.95,
        thinkingConfig: { thinkingBudget: 16000 }
      },
    });
    for await (const chunk of result) {
      if (chunk.text) onChunk(chunk.text);
    }
  },

  generateImage: async (prompt: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `High-quality cinematic book illustration for a Bengali literary novel. Style: Impressionist oil painting, moody lighting, atmospheric. Subject: ${prompt}` }],
        },
        config: { 
          imageConfig: { aspectRatio: "16:9" } 
        }
      });
      
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part ? `data:image/png;base64,${part.inlineData.data}` : null;
    } catch (error) {
      console.error("Image Gen Error:", error);
      return null;
    }
  },

  breakIntoScenes: async (text: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: `এই বাংলা গল্পটিকে স্টোরিবোর্ডের জন্য ৪-৬টি প্রধান দৃশ্যে ভাগ করুন। উত্তরটি অবশ্যই একটি JSON অ্যারে হতে হবে। গল্প: ${text.slice(0, 5000)}` }] },
        config: { 
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Scene Break Error:", error);
      return [];
    }
  },

  generateSpeech: async (text: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text: `দয়া করে নিচের বাংলা সাহিত্য পাঠ করুন:\n${text}` }] },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } 
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
