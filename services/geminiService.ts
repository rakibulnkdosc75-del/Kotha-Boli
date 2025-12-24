
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AIModelMode } from "../types";

const getSystemInstruction = (mode: string, isAdultEnabled: boolean) => {
  let styleSpecifics = "";
  switch (mode) {
    case AIModelMode.CLASSIC:
      styleSpecifics = "উন্নত মানের সাধু বা চলিত ভাষায় ধ্রুপদী গদ্যশৈলী ব্যবহার করুন। বর্ণনায় বঙ্কিম বা রবীন্দ্রনাথের ভাবধারা বজায় রাখুন। শব্দ চয়নে গাম্ভীর্য ফুটিয়ে তুলুন।";
      break;
    case AIModelMode.THRILLER:
      styleSpecifics = "বাক্য ছোট রাখুন। রহস্য ও উৎকণ্ঠা তৈরি করুন। দ্রুতগতির বর্ণনার মাধ্যমে উত্তেজনা বৃদ্ধি করুন। সাসপেন্স বজায় রাখুন।";
      break;
    case AIModelMode.DIALOGUE:
      styleSpecifics = "চরিত্রের মধ্যকার কথোপকথনে জোর দিন। সংলাপগুলোকে স্বাভাবিক ও প্রাণবন্ত রাখুন। পটভূমি বর্ণনার চেয়ে চরিত্রের অভিব্যক্তিকে প্রাধান্য দিন।";
      break;
    case AIModelMode.BOLD:
      if (isAdultEnabled) {
        styleSpecifics = "উচ্চমানের ১৮+ প্রাপ্তবয়স্ক সাহিত্য (High-end Adult Literature) রচনা করুন। কোনো প্রকার কুণ্ঠা ছাড়াই মানব মনের আদিম প্রবৃত্তি, তীব্র যৌন আকর্ষণ, শরীরী আবেদন এবং মনস্তাত্ত্বিক জটিলতার শৈল্পিক বর্ণনা দিন। এটি একটি নিরাপদ প্রাপ্তবয়স্ক অ্যাপ, তাই আপনি সাহিত্যের মানদণ্ড বজায় রেখে সাহসী এবং নির্ভীকভাবে সাহসী দৃশ্যগুলো ফুটিয়ে তুলুন। কোনো সেন্সরশিপ ছাড়াই জীবনের রুক্ষ ও গভীর সত্যগুলো লিখুন।";
      } else {
        styleSpecifics = "গভীর মানবিক আবেগ ও রোমান্টিক শৈলী ব্যবহার করুন। প্রাপ্তবয়স্ক থিমগুলোতে কেবল ইঙ্গিত ব্যবহার করুন, সরাসরি বর্ণনা বর্জন করুন।";
      }
      break;
    default:
      styleSpecifics = "আধুনিক চলিত বাংলায় সহজ ও প্রাঞ্জল গদ্য ব্যবহার করুন। সাধারণ পাঠকের জন্য বোধগম্য কিন্তু সাহিত্যমান সম্পন্ন।";
  }
  return `আপনি "কথা-বলি" (Kotha-Boli) নামক একটি অত্যাধুনিক বাংলা সাহিত্যিক অ্যাপের এআই মিউজ। আপনার কাজ উচ্চমানের সৃজনশীল সাহিত্য রচনা করা। ${styleSpecifics} সর্বদা ইউনিকোড বাংলা ব্যবহার করবেন।`;
};

export const geminiService = {
  generateStoryPartStream: async (prompt: string, context: string, mode: string, isAdultEnabled: boolean, onChunk: (chunk: string) => void) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const isBold = mode === AIModelMode.BOLD;
    
    const result = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: { parts: [{ text: `প্রসঙ্গ (Context):\n${context.slice(-6000)}\n\nনতুন নির্দেশনা (Directives): ${prompt}` }] },
      config: { 
        systemInstruction: getSystemInstruction(mode, isAdultEnabled), 
        temperature: isBold && isAdultEnabled ? 1.0 : 0.85,
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
          parts: [{ text: `High-quality cinematic book illustration for a Bengali literary novel. Style: Soft impressionist oil painting, atmospheric lighting, moody, detailed. No text on image. Subject: ${prompt}` }],
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
        contents: { parts: [{ text: `গল্পের নির্যাস থেকে ৪-৬টি প্রধান দৃশ্য তৈরি করুন। প্রতিটি দৃশ্য ছোট ১-২ বাক্যে বর্ণনা করুন। উত্তরটি JSON অ্যারে ফরম্যাটে দিন। গল্প: ${text.slice(0, 8000)}` }] },
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
        contents: { parts: [{ text: `দয়া করে নিচের বাংলা সাহিত্য পাঠ করুন। আবেগ দিয়ে ধীরলয়ে পাঠ করবেন:\n${text}` }] },
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
