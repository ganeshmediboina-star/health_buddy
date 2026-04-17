import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getAiSuggestion(sessionCount: number, timeOfDay: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a wellness coach. The user just completed ${sessionCount} hour(s) of screen time. It is ${timeOfDay}. Give ONE specific, fun physical activity for a 5-minute break. Under 2 sentences. Be warm and encouraging. No bullets.`,
    });
    return response.text?.trim() || "Stand up and stretch your arms for a minute!";
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return "Time for a quick stretch and some water!";
  }
}

export async function getMotivationalMessage(sessionCount: number) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Give a short (1 sentence) motivational message for someone who just took their ${sessionCount} hourly break. Make it personal, warm, and uplifting. No quotes.`,
    });
    return response.text?.trim() || "You're doing great, keep focusing on your wellness!";
  } catch (error) {
    console.error("Gemini Motivation Error:", error);
    return "Great job taking care of yourself today!";
  }
}

export async function getAssistantReply(question: string, context: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Health Buddy, a smart friendly wellness companion. Context: ${context}. User asks: "${question}". Rules: Answer like a real human friend. NEVER start with "You have taken". Vary your sentence structure. Be warm and witty. 1-2 sentences max.`,
    });
    return response.text?.trim() || "I'm here to help you stay healthy and focused!";
  } catch (error) {
    console.error("Gemini Assistant Error:", error);
    return "I'm not sure about that, but don't forget to take your breaks!";
  }
}

export async function getMedicalGuidance(symptoms: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a caring and knowledgeable medical assistant. The user says: "${symptoms}".
      Format: 
      1. Empathetic acknowledgment.
      2. 2-3 possible causes in simple language.
      3. 2-3 practical home care tips.
      4. Urgency label: [ROUTINE], [SOON], or [EMERGENCY] on its own line.
      Keep it under 100 words. Always mention consulting a doctor.`,
    });
    return response.text?.trim() || "I'm sorry you're feeling unwell. Please rest and stay hydrated. Consulting a doctor is advised. [ROUTINE]";
  } catch (error) {
    console.error("Gemini Medical Error:", error);
    return "Please consult a medical professional if you're concerned about your symptoms. [ROUTINE]";
  }
}

export async function analyzePrescription(imageData: string, mimeType: string) {
  try {
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageData.split(',')[1], // Remove the data:image/png;base64, prefix
      },
    };
    const textPart = {
      text: `You are an expert prescription reader and medical assistant. Analyze this prescription image and:
      1. Extract the names of the medicines mentioned.
      2. State the primary purpose/use for each medicine in simple terms.
      3. Provide 2-3 specific wellness or health suggestions related to this prescription (e.g., diet tips, when to take them, or common side effect precautions).
      4. Urgency label: [ROUTINE], [SOON], or [EMERGENCY] based on the nature of medications.
      Keep it clear, concise, and friendly. ALWAYS add a disclaimer that they must verify with a pharmacist or doctor.`,
    };

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [imagePart, textPart] },
    });
    
    return response.text?.trim() || "I couldn't read the prescription clearly. Please ensure the photo is well-lit and the text is legible. [ROUTINE]";
  } catch (error) {
    console.error("Gemini Prescription Analysis Error:", error);
    return "An error occurred while analyzing the image. Please try again with a clearer photo. [ROUTINE]";
  }
}

export async function getDailyReport(sessionsCompleted: number, hoursTracked: number) {
  try {
    const hour = new Date().getHours();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Write a short 3-sentence personal wellness report for a user who took ${sessionsCompleted} breaks over ${hoursTracked} hours. Current time: ${hour}:00. Be warm and motivating.`,
    });
    return response.text?.trim() || "You've been consistent with your breaks today. Great job keeping your energy up!";
  } catch (error) {
    console.error("Gemini Report Error:", error);
    return "Keep up the consistent breaks to stay productive and healthy!";
  }
}
