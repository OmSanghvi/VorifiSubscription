import { StreamingTextResponse, GoogleGenerativeAIStream, Message } from "ai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { transactions } from "@/db/schema";
import { sql } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { convertAmountFromMiliunits } from "@/lib/utils";

// IMPORTANT! Set the runtime to edge
export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const reqBody = await req.json();
    const images: string[] = reqBody.data?.images ? JSON.parse(reqBody.data.images) : [];
    const imageParts = filesArrayToGenerativeParts(images);
    const messages: Message[] = reqBody.messages;

    if (!messages || messages.length === 0) {
      throw new Error("No content is provided for sending chat message.");
    }

    // SQL query to calculate income and expenses
    const query = sql`
      SELECT
        SUM(CASE WHEN ${transactions.amount} >= 0 THEN ${transactions.amount} ELSE 0 END) AS income,
        SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END) AS expenses
      FROM ${transactions}
    `;

    const result = await db.execute(query);
    let income: number = 0;
    let expenses: number = 0;

    if (result && result.rows && result.rows.length > 0) {
      const row = result.rows[0] as { income: number | null; expenses: number | null };
      if (row) {
        income = row.income ?? 0;
        expenses = row.expenses ?? 0;
      }
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

    // Build the appropriate prompt for the API request
    let promptWithParts: (string | { inlineData: { data: string; mimeType: string } })[] = [];

    // Add messages to the prompt as strings
    const messageTexts = messages.map((message) => message.content);
    
    // Use a conversational instruction to guide the AI
    const userContext = `You are a financial advisor assisting a user with their finances. They have an income of ${convertAmountFromMiliunits(income)} and expenses of ${convertAmountFromMiliunits(expenses)} per month.`;
    
    promptWithParts = [userContext, ...messageTexts];

    // Add image parts if present
    if (imageParts.length > 0) {
      promptWithParts = promptWithParts.concat(imageParts);
    }

    if (promptWithParts.length === 0) {
      throw new Error("No valid content to send to the AI.");
    }

    // Wait for the streaming response
    const model = genAI.getGenerativeModel({
      model: "tunedModels/financialadvicedataset-ljf12fi60qq1",
    });

    const streamingResponse = await model.generateContent(promptWithParts);
    
    // Extract the text response
    const responseText = streamingResponse.response.text();
    
    // Return the response as plain text or JSON
    return new Response(JSON.stringify({ text: responseText }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in POST handler:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// Helper function to convert images to Google AI parts
function filesArrayToGenerativeParts(images: string[]) {
  return images.map((imageData) => ({
    inlineData: {
      data: imageData.split(",")[1],
      mimeType: imageData.substring(
        imageData.indexOf(":") + 1,
        imageData.lastIndexOf(";")
      ),
    },
  }));
}
