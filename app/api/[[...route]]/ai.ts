import {Message } from "ai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { accounts, categories, transactions } from "@/db/schema";
import { and, desc, eq, gte, lt, lte, sql, sum } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { calculatePercentChange, convertAmountFromMiliunits, fillMissingDays } from "@/lib/utils";
import { Hono } from "hono";
import { differenceInDays, parse, subDays } from "date-fns";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

// IMPORTANT! Set the runtime to edge
export const runtime = "edge";

const app = new Hono();

app.use(clerkMiddleware());

// GET request handler
export const GET = app.get(
  "/",
  clerkMiddleware(),
  zValidator("query", z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    accountId: z.string().optional()
  })),
  async (c) => {
    const auth = getAuth(c);
    const { from, to, accountId } = c.req.valid("query");
    if (!auth?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const defaultTo = new Date();
    const defaultFrom = subDays(defaultTo, 30);
    const startDate = from ? parse(from, "yyyy-MM-dd", new Date()) : defaultFrom;
    const endDate = to ? parse(to, "yyyy-MM-dd", new Date()) : defaultTo;

    const periodLength = differenceInDays(endDate, startDate) + 1;
    const lastPeriodStart = subDays(startDate, periodLength);
    const lastPeriodEnd = subDays(endDate, periodLength);

    const [currentPeriod] = await fetchFinancialData(auth.userId, startDate, endDate);
    const [lastPeriod] = await fetchFinancialData(auth.userId, lastPeriodStart, lastPeriodEnd);

    const incomeChange = calculatePercentChange(currentPeriod.income, lastPeriod.income);
    const expensesChange = calculatePercentChange(currentPeriod.expenses, lastPeriod.expenses);
    const remainingChange = calculatePercentChange(currentPeriod.remaining, lastPeriod.remaining);

    const category = await db
      .select({
        name: categories.name,
        value: sql`SUM(ABS(${transactions.amount}))`.mapWith(Number),
      }).from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          accountId ? eq(transactions.accountId, accountId) : undefined,
          eq(accounts.userId, auth.userId),
          lt(transactions.amount, 0),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      ).groupBy(categories.name)
      .orderBy(desc(sql`SUM(ABS(${transactions.amount}))`));

    const topCategories = category.slice(0, 3);
    const otherCategories = category.slice(3);
    const otherSum = otherCategories.reduce((sum, current) => sum + current.value, 0);
    const finalCategories = [...topCategories];

    if (otherCategories.length > 0) {
      finalCategories.push({
        name: "Other",
        value: otherSum,
      });
    }

    const activeDays = await db.select({
      date: transactions.date,
      income: sql`SUM(CASE WHEN ${transactions.amount} >= 0 THEN ${transactions.amount} ELSE 0 END)`.mapWith(Number),
      expenses: sql`SUM(CASE WHEN ${transactions.amount} < 0 THEN ABS(${transactions.amount}) ELSE 0 END)`.mapWith(Number),
    }).from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          accountId ? eq(transactions.accountId, accountId) : undefined,
          eq(accounts.userId, auth.userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      ).groupBy(transactions.date).orderBy(transactions.date);

    const days = fillMissingDays(activeDays, startDate, endDate);

    return c.json({
      data: {
        remainingAmount: currentPeriod.remaining,
        remainingChange,
        incomeAmount: currentPeriod.income,
        incomeChange,
        expensesAmount: currentPeriod.expenses,
        expensesChange,
        categories: finalCategories,
        days,
      }
    });
  }
);

// POST request handler
export const POST = app.post(async (c) => {
  try {
    const reqBody = await c.req.json();
    const images: string[] = reqBody.data?.images ? JSON.parse(reqBody.data.images) : [];
    const imageParts = filesArrayToGenerativeParts(images);
    const messages: Message[] = reqBody.messages;

    if (!messages || messages.length === 0) {
      throw new Error("No content is provided for sending chat message.");
    }

    const auth = getAuth(c);
    if (!auth?.userId) {
      throw new Error("Unauthorized");
    }

    const defaultTo = new Date();
    const defaultFrom = subDays(defaultTo, 30);
    const startDate = defaultFrom;
    const endDate = defaultTo;

    const [financialData] = await fetchFinancialData(auth.userId, startDate, endDate);

    const income = convertAmountFromMiliunits(financialData.income || 0);
    const expenses = convertAmountFromMiliunits(financialData.expenses || 0);

    const userContext = `You are a financial advisor assisting a user with their finances. They have an income of ${income} and expenses of ${expenses} per month.`;

    let promptWithParts: (string | { inlineData: { data: string; mimeType: string } })[] = [userContext, ...messages.map(message => message.content)];

    // Add image parts if present
    if (imageParts.length > 0) {
      promptWithParts = promptWithParts.concat(imageParts);
    }

    if (promptWithParts.length === 0) {
      throw new Error("No valid content to send to the AI.");
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "tunedModels/financialadvicedataset-ljf12fi60qq1",
    });

    const streamingResponse = await model.generateContent(promptWithParts);
    const responseText = streamingResponse.response.text();

    return new Response(JSON.stringify({ text: responseText }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in POST handler:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

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

// Function to fetch financial data for the user
async function fetchFinancialData(userId: string, startDate: Date, endDate: Date) {
  return await db.select({
    income: sql`SUM(CASE WHEN ${transactions.amount} >= 0 THEN ${transactions.amount} ELSE 0 END)`.mapWith(Number),
    expenses: sql`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`.mapWith(Number),
    remaining: sum(transactions.amount).mapWith(Number),
  })
  .from(transactions)
  .innerJoin(accounts,
    eq(transactions.accountId, accounts.id)
  ).where(
    and(
      eq(accounts.userId, userId),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate)
    )
  );
}

export default app;  // This line can be removed if you do not need a default export
